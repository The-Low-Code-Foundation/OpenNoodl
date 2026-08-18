// We need to import this so it's available in NoodlRuntime.Services

//import WebSocket from 'ws';
import { NoodlRequest, NoodlResponse } from './bridge';
import { loadCloudKitModules, type CloudKitLoadResult, type CloudKitModule } from './kitModules';
import { registerNodes } from './nodes';
import NoodlRuntime from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import NodeScope from '@noodl/runtime/src/nodescope';
import type { NodeRunContext, RuntimeLogEntry, RuntimeLogLevel } from '@noodl/runtime/src/runcontext';
import type { RuntimeNodeContext } from '@noodl/runtime/src/internal';
import './noodl-js-api';

// CWF-013 — the shape a host has to fill in to give a cloud function's `Log` node somewhere to
// go. Re-exported from the package entry because the backend reaches this module through the
// `@cloud-runtime` bundler alias and has no other way to name the type.
export type { NodeRunContext, RuntimeLogEntry, RuntimeLogLevel };

// CN-013 — the cloud kit loader's vocabulary, re-exported for the same reason as the three above:
// `nodegx-backend` reaches this module through the `@cloud-runtime` bundler alias and has no other
// way to name these types.
export { loadCloudKitModules, REQUIRE_LIMIT } from './kitModules';
export type { CloudKitModule, CloudKitLoadFailure, CloudKitLoadResult } from './kitModules';

require('./services/userservice');

/** Per-invocation options for {@link CloudRunner.run}. */
export interface CloudRunOptions {
  /**
   * How long to wait for a Response node before abandoning the run, in
   * milliseconds. `0` (and omitting it) means **wait forever**, which is what
   * every caller did before CWF-018 and what a streaming response (CWF-007)
   * will need — the bound belongs to the caller, not to this class.
   */
  timeoutMs?: number;
  /**
   * CWF-013 — per-run services the graph may reach, attached to the request's
   * own `NodeScope` and inherited by every component instance below it (the
   * same propagation `modelScope` gets, in `componentinstance.ts`).
   *
   * ⚠️ It has to travel this way rather than as a process global, which is what
   * `_noodl_send_email` and `_noodl_get_secret` are. Those two answer the same
   * thing whoever asks; a log line does not — it carries the request id, and two
   * cloud functions run concurrently in this one process. A module-level
   * "current run" would attribute one caller's line to the other's request the
   * first time two overlapped.
   */
  runContext?: NodeRunContext;
}

/**
 * A run abandoned because no Response node fired in time (CWF-018).
 *
 * The vocabulary is the workflow engine's, deliberately: `RunAbortedError`
 * already splits `cancelled` from `timeout`, and a second word for the same
 * disposition is how a UI ends up showing two names for one thing.
 */
export class CloudFunctionTimeoutError extends Error {
  readonly kind: 'timeout' = 'timeout';

  constructor(
    readonly functionName: string,
    readonly timeoutMs: number
  ) {
    super(`Cloud function "${functionName}" did not send a response within ${timeoutMs}ms`);
    this.name = 'CloudFunctionTimeoutError';
  }
}

/**
 * Is this the timeout above? Checked by `name` rather than `instanceof` because
 * the backend consumes this module through a bundler alias (`@cloud-runtime`),
 * and an `instanceof` that depends on one module instance is a check that
 * silently starts answering "no".
 */
export function isCloudFunctionTimeout(e: unknown): e is CloudFunctionTimeoutError {
  return !!e && typeof e === 'object' && (e as Error).name === 'CloudFunctionTimeoutError';
}

export class CloudRunner {
  private runtime: NoodlRuntime;

  /**
   * Kit modules this runner has already evaluated, by manifest name.
   *
   * Per-runner rather than per-`load`: `WorkflowRunner` loads every bundle it serves into one
   * runner, and two projects on one backend may ship the same kit. Re-evaluating an entry script
   * is a side effect an author has no reason to expect.
   */
  private loadedKitModules = new Set<string>();

  /** What {@link load} made of each bundle's kits, newest last. Read by hosts that log. */
  public readonly kitLoads: CloudKitLoadResult[] = [];

  constructor(options: {
    webSocketClass?: any;
    enableDebugInspectors?: boolean;
    connectToEditor?: boolean;
    editorAddress?: string;
  }) {
    this.runtime = new NoodlRuntime({
      type: 'cloud',
      platform: {
        requestUpdate: (f: any) => setImmediate(f),
        getCurrentTime: () => new Date().getTime(),
        objectToString: (o: any) => JSON.stringify(o, null, 2),
        webSocketClass: options.webSocketClass,
        isRunningLocally: () => options.connectToEditor
      },
      componentFilter: (c) => c.name.startsWith('/#__cloud__/'),
      dontCreateRootComponent: true
    });

    registerNodes(this.runtime);

    this.runtime.setDebugInspectorsEnabled(options.enableDebugInspectors ?? false);

    if (options.connectToEditor && options.editorAddress) {
      this.runtime.connectToEditor(options.editorAddress);
    }
  }

  /**
   * Load one cloud-function bundle, registering its kits first.
   *
   * ⚠️ **The order is not what it looks like, and the comment that used to be
   * here was wrong.** The obvious reason to register before `setData` —
   * *"`importEditorData` resolves node types as it imports"* — does not apply to
   * this class: it is constructed with `dontCreateRootComponent: true` and
   * builds its graph **per request** in {@link run}, via
   * `createComponentInstanceNode`, long after `setData` has returned. Moving the
   * registration after `setData` broke nothing in the suite, which is how the
   * claim was caught.
   *
   * What the order genuinely buys is `setup`: `NoodlRuntime.setData` loops
   * `this.noodlModules` and calls each module's `setup` once. A kit registered
   * afterwards is not in that list yet and its `setup` silently never runs.
   * `cn-013-cloud-kits.test.ts` pins that, and reddens if the two are swapped.
   *
   * 🔴 What the *registration itself* buys is the whole feature. An unregistered
   * type is logged and skipped by `NodeScope` **with its connections**, so the
   * graph runs with the chain cut and no Response node is ever reached. That is
   * CN-012's measured failure — a hang, not an error, until CWF-018 bounded it
   * into a 504 that says nothing about kits.
   *
   * The result is kept on {@link kitLoads} rather than thrown: one kit that
   * cannot load must not stop the bundle's other functions serving, and the
   * host is the thing with somewhere to log. `WorkflowRunner` prints it.
   */
  public async load(exportData: any, projectSettings?: any) {
    const kitLoad = loadCloudKitModules(
      this.runtime,
      exportData && (exportData.modules as CloudKitModule[] | undefined),
      this.loadedKitModules
    );
    this.kitLoads.push(kitLoad);

    await this.runtime.setData(exportData);

    if (projectSettings) this.runtime.setProjectSettings(projectSettings);

    return kitLoad;
  }

  /**
   * Run one cloud function and settle when it answers.
   *
   * ⚠️ CWF-018: this promise used to settle on exactly three events — a Response
   * node firing, the component failing to instantiate, and no Request node being
   * found. A graph that ran and simply never reached a Response node settled on
   * NONE of them, so the caller's HTTP connection was held until the client gave
   * up, and the component instance plus its model scope were leaked for the life
   * of the process. That is the ordinary authoring mistake — every outcome node
   * has `Failure` and `Unchanged` ports beside `Done`, and wiring only the happy
   * path is what everyone does first — and it is also what an **unregistered
   * node type** produces, because the runtime logs the unknown node and its
   * connections and carries on with a graph whose chain now stops short.
   *
   * `options.timeoutMs` bounds the wait. On expiry the run is torn down exactly
   * as a delivered response tears it down, and the promise rejects with
   * {@link CloudFunctionTimeoutError} so the caller can answer with a status
   * that is distinguishable from a crash.
   */
  public async run(
    functionName: string,
    request: NoodlRequest,
    options: CloudRunOptions = {}
  ): Promise<NoodlResponse> {
    return new Promise<NoodlResponse>((resolve, reject) => {
      const requestId = Math.random().toString(26).slice(2);

      // `this.runtime` is typed via `@noodl/runtime`'s own `types` field (dist-types),
      // while `NodeScope` is deep-imported from source (`@noodl/runtime/src/nodescope`)
      // — two declarations of the same `RuntimeNodeContext`, structurally identical but
      // nominally distinct because dist-types is a verbatim copy of the same hand-written
      // .d.ts, and a private field makes TS compare them by declaration site, not shape.
      const requestScope = new NodeScope(this.runtime.context as unknown as RuntimeNodeContext);
      requestScope.modelScope = new Model.Scope();
      // CWF-013: the same per-request channel `modelScope` uses. Set on the scope the function
      // component is created in, so `componentinstance.ts` hands it down the whole tree.
      requestScope.runContext = options.runContext;

      // One request, one settlement. Every path — delivery, timeout, a throw
      // out of the request node — goes through `settle`, which is the only
      // thing that decides whether this run is still open.
      let settled = false;
      let tornDown = false;
      let functionComponent: any = null;
      let timer: any = null;

      /**
       * Delete the component instance and empty the request's scopes.
       *
       * This used to live inside the response callback and therefore ran on the
       * success path ONLY: a timed-out run, and the "no request node" rejection
       * below, both leaked an instance and a model scope. Teardown is the half
       * of CWF-018 that turns a slow endpoint into an outage, so it belongs to
       * the settlement, not to the answer.
       */
      const teardown = () => {
        if (tornDown) return;
        tornDown = true;
        try {
          //the functionComponent is "manually" created outside of a scope, so call the delete function directly
          if (functionComponent) functionComponent._onNodeDeleted();
        } catch (e) {
          // A half-built graph must not stop the rest of the teardown running.
        }
        try {
          requestScope.reset(); //this deletes any remaining nodes, although there shouldn't be any at this point
        } catch (e) {
          /* as above */
        }
        try {
          //clean upp all models
          requestScope.modelScope.reset();
        } catch (e) {
          /* as above */
        }
      };

      /** Settle once: stop the clock, tear the graph down, then deliver. */
      const settle = (deliver: () => void): boolean => {
        if (settled) return false;
        settled = true;
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        teardown();
        deliver();
        return true;
      };

      const timeoutMs = options.timeoutMs || 0;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          settle(() => reject(new CloudFunctionTimeoutError(functionName, timeoutMs)));
        }, timeoutMs);
        // A pending timeout must never be the reason the process stays alive
        // while shutting down (the same `unref` stance as the workflow engine's
        // timers, and the reason a timeout cannot race `service.stop()`).
        if (timer && typeof timer.unref === 'function') timer.unref();
      }

      this.runtime.context
        .createComponentInstanceNode('/#__cloud__/' + functionName, requestId + '-' + functionName, requestScope)
        .then((component) => {
          functionComponent = component;
          // The clock starts before the graph exists — instantiating a component
          // is per-request work and can itself hang. If it already ran, this
          // instance arrived after the answer went out and exists only to be
          // deleted.
          if (settled) {
            teardown();
            return;
          }

          // Look for the first request node (should only be one)
          const requestNode = functionComponent.nodeScope.getNodesWithType('noodl.cloud.request')[0];
          if (requestNode) {
            // Look for all response nodes
            const responseNodes = functionComponent.nodeScope.getNodesWithTypeRecursive('noodl.cloud.response');
            responseNodes.forEach((resp) => {
              // NDA-004 §3: the callback reports whether it actually delivered.
              //
              // The "is this request still open" flag lives here, in the per-request
              // closure, and it has to: two different Response nodes both firing is the
              // ordinary shape of the defect, so no single node can know locally that the
              // request is already answered. Before this, the second send was swallowed
              // here without a trace — the node had no outputs at all, so "responded" and
              // "silently discarded" were indistinguishable from the graph. Returning the
              // verdict lets the node own the report, which is where the provenance is
              // (Failure Contract).
              // Asked *before* delivery, because delivering destroys the asker: teardown
              // runs synchronously inside `settle`, so the node cannot report anything
              // after it returns.
              //
              // Since CWF-018 it also covers the timeout: a Response that fires after the
              // run was abandoned is refused here rather than resolving a promise whose
              // caller has already been answered.
              resp._internal._requestIsOpen = () => !settled;

              resp._internal._sendResponseCallback = (payload) => settle(() => resolve(payload));
            });

            setImmediate(() => {
              if (settled) return;
              try {
                requestNode.sendRequest(request).catch((e) => settle(() => reject(e)));
              } catch (e) {
                settle(() => reject(e));
              }
            });
          } else {
            settle(() => reject(Error('Could not find request node for function')));
          }
        })
        .catch((e) => {
          // Failed creating component
          settle(() => reject(e));
        });
    });
  }
}
