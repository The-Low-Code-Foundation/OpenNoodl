/**
 * CN-013 / D18 — the caller that lets a kit's **logic** nodes exist in the cloud runtime.
 *
 * ## What was actually missing
 *
 * Not the runtime. CN-012's M4 built the caller and measured all three arms: a kit logic node in a
 * cloud function **hung** as shipped, a built-in `Counter` in the same graph shape answered `200`,
 * and the same kit node answered `200` the moment `runtime.registerModule` was called by hand.
 * `NoodlRuntime.registerModule` works perfectly in the cloud runtime — what did not exist was
 * anything that calls it. `CloudRunner`'s constructor called `registerNodes` and nothing else, and
 * `load(exportData, projectSettings)` had no parameter a module could arrive through.
 *
 * 🔴 **And the failure mode was a hang, not an error.** An unregistered type is logged and skipped
 * by `NodeScope`, its connections are dropped, and the graph runs with the chain cut — so no
 * Response node ever fires. Without CWF-018's timeout the socket stayed open; with it the author
 * gets a 504 that says nothing about kits. Naming the cause is therefore half of this module's job,
 * not a nicety: see {@link CloudKitLoadResult.failures} and {@link REQUIRE_LIMIT}.
 *
 * ## Scope, by ruling
 *
 * D18 rules **pure-JS logic nodes IN** and **server-side SDK dependencies OUT** of phase 69. The
 * binding reason is packaging, not execution: a deployed backend is a single prebuilt `cli.js`
 * copied into the image, with no `npm install` and no `node_modules` — **there is nowhere for a
 * user's package to land.** `manifest.dependencies` is script paths/URLs, not npm, and every real
 * module vendors a UMD build inline.
 *
 * ⚠️ **D18's other stated reason does not hold and this module does not rely on it.** The ruling
 * says the editor's cloud preview runs in `sandbox.isolate.js`, an isolate whose `require` is
 * stubbed, and that preview and production therefore disagree. Measured in s25
 * (`notes/cn-013-cloud-premise.md`): **nothing in this repo loads that isolate**, its shims call a
 * `_noodl_api_call` host global that has no implementation anywhere here, and the editor's
 * "preview" spawns `nodegx-backend/dist/cli.js` — the same bundle a deploy target runs. There is
 * one execution context. What genuinely differs is the **build shape** (source via the
 * `@cloud-runtime` alias, versus the esbuild bundle), which is where a `new Function` loader can
 * behave differently, and which is what this module's suites check in both.
 *
 * ## Why `new Function` and not `vm`
 *
 * A kit's entry script is a browser `<script>`: it defines nodes and calls `Noodl.defineModule`.
 * `new Function` gives it the same global-scope evaluation a script tag does, in both build shapes,
 * with no bundler-visible `require` for esbuild to rewrite. `vm` would buy an isolate this ruling
 * explicitly does not attempt (D6/CN-017 own the trust story) at the cost of a Node built-in the
 * browser bootstraps do not have — two divergent load paths for one artefact.
 *
 * @module @noodl/cloud-runtime/kitModules
 */

/**
 * One module as the cloud-function bundle carries it.
 *
 * Structurally `@nodegx/module-inject`'s `CloudModuleSource`, redeclared rather than imported: that
 * package is the editor-side producer and this runtime is bundled into `nodegx-backend`'s `cli.js`
 * with no dependency on it. ⚠️ Two declarations of one shape is the trap this repo has recorded
 * before — `cn-013-kit-bundle-agreement.test.ts` asserts the producer's output satisfies this consumer's reader
 * over the **whole** population rather than a hand-written sample.
 */
export interface CloudKitModule {
  /** Manifest name. The handle every diagnostic below uses. */
  name: string;
  /** The kit's entry script, verbatim. `null` for a module that is not cloud-enabled. */
  source?: string | null;
  /** The manifest's `runtimes`, already defaulted to `['browser']` by the producer. */
  runtimes?: string[];
  /** Whether the producer classed this as a cloud module. */
  cloud?: boolean;
  /** Why a cloud module arrived with no source, when that happened. */
  error?: string | null;
}

/** Why one kit's nodes are not in the register. */
export interface CloudKitLoadFailure {
  /** Manifest name of the kit. */
  module: string;
  /**
   * `threw` — the entry script raised while defining its nodes.
   * `needs-require` — it reached for a module loader; see {@link REQUIRE_LIMIT}.
   * `no-module-defined` — it ran to completion and never called `Noodl.defineModule`.
   * `not-cloud-enabled` — its `runtimes` does not include `cloud`, so no source was shipped.
   * `unreadable` — the producer could not read its entry script.
   */
  reason: 'threw' | 'needs-require' | 'no-module-defined' | 'not-cloud-enabled' | 'unreadable';
  /** A sentence an author can act on. Names the kit and, where there is one, the limit. */
  message: string;
}

/** What one call to {@link loadCloudKitModules} did. */
export interface CloudKitLoadResult {
  /** Manifest names of the kits whose nodes are now in the register. */
  registered: string[];
  /** Node type names registered by this call, in registration order. */
  nodeTypes: string[];
  /** Every kit that did not register, with a reason. */
  failures: CloudKitLoadFailure[];
  /**
   * Kits that defined React nodes, and how many were skipped.
   *
   * ⚠️ Not a failure. `reactNodes` need `createNodeFromReactComponent` from the browser viewer and
   * a DOM to render into; a kit may legitimately carry both halves and only the logic half is
   * meaningful here. Its *logic* nodes still register — which is why this is reported separately
   * from `failures` rather than folded into it.
   */
  skippedReactNodes: Array<{ module: string; count: number }>;
}

/**
 * The sentence D18 obliges this loader to produce instead of a hang.
 *
 * *"Say what it does not cover, in the diagnostic and in the docs. A logic kit node that reaches
 * for an SDK must fail with a sentence naming the limit, not with the hang that s24 just removed."*
 */
export const REQUIRE_LIMIT =
  'a cloud kit cannot require() modules. Cloud functions run inside a single prebuilt backend ' +
  'bundle with no node_modules, so there is nowhere for an npm package to be installed. Kit nodes ' +
  'in the cloud runtime are limited to pure JavaScript — date maths, validation, transforms, ' +
  'formatting, pricing rules. Server-side SDKs (Stripe, AWS, Anthropic) are not supported here.';

/**
 * The `require` a cloud kit sees.
 *
 * 🔴 **Defined rather than left absent, and the trade-off is deliberate.** Left absent, a kit
 * reaching for a package dies with `ReferenceError: require is not defined` — true, and useless: it
 * names neither the kit nor the reason nor what the author can do instead. Defined, the throw
 * carries {@link REQUIRE_LIMIT}, and it carries it from a node's *method* at run time as well as
 * from the entry script at load time, which is the half a load-time-only check cannot reach.
 *
 * ⚠️ The cost, stated because it is real: a kit that feature-detects with
 * `typeof require === 'function'` now takes the require branch and throws, where in a browser — and
 * in this runtime before this change — it would have taken its fallback. That fallback is a global
 * from a `<script>` dependency, which the cloud has no way to provide either, so the kit fails
 * whichever branch it takes; this way it fails saying why. A UMD wrapper is unaffected: it tests
 * `module`/`exports`/`define`, none of which are defined here, so it falls through to its
 * global-assignment branch exactly as it does in a browser.
 */
function cloudRequire(id: unknown): never {
  throw new Error(`require(${JSON.stringify(String(id))}) — ${REQUIRE_LIMIT}`);
}

/** Does this throw look like the kit reaching for a module loader? */
function isRequireReach(e: unknown): boolean {
  const message = e && typeof e === 'object' ? String((e as Error).message || '') : String(e);
  if (message.indexOf(REQUIRE_LIMIT) !== -1) return true;
  // A kit may reach through `module.require`, `process.mainModule` or a bundler's own helper,
  // none of which are defined here. Those arrive as ReferenceErrors naming the identifier.
  return /^(require|module|exports|process|__webpack_require__) is not defined$/.test(message);
}

/**
 * The `Noodl` a kit's entry script is called with.
 *
 * Deliberately the browser bootstrap's shape (`static/deploy/index.js`, `static/ssr/runtime-globals.js`,
 * the editor viewer's `index.html`) and not the cloud's per-invocation `Noodl` API: a kit defines
 * nodes at load, and the object it sees at that moment is the same three fields in every other
 * runtime. A kit node's *methods* reach the runtime through `this`, as every built-in does.
 *
 * 🔴 The name is adopted here and not in `registerModule`, for the reason CN-003 recorded: a kit's
 * `index.js` calls `Noodl.defineModule({...})` with no idea what its own manifest says, so the
 * runtime names the module `undefined` and every node reports `module: 'Unknown Module'`. The
 * browser bootstraps adopt `window.__noodl_module_name`; here the manifest name is in hand
 * directly, which is the same fix with one fewer indirection.
 */
function makeKitNoodl(manifestName: string, captured: Record<string, unknown>[]) {
  return {
    defineModule(m: Record<string, unknown>) {
      if (m && !m.name && manifestName) m.name = manifestName;
      captured.push(m);
    },
    deployed: true,
    Env: {}
  };
}

/**
 * Evaluate one kit's entry script and hand back whatever it defined.
 *
 * `new Function` rather than `eval`: the body is evaluated in global scope with exactly the two
 * bindings below and none of this module's, which is both what a `<script>` tag gives a kit and
 * what keeps esbuild from rewriting anything inside it.
 */
function evaluateKit(name: string, source: string): Record<string, unknown>[] {
  const captured: Record<string, unknown>[] = [];
  const Noodl = makeKitNoodl(name, captured);
  // eslint-disable-next-line no-new-func
  const run = new Function('Noodl', 'require', `${source}\n//# sourceURL=noodl_modules/${name}/index.js`);
  run(Noodl, cloudRequire);
  return captured;
}

/**
 * Register every cloud-enabled kit in a bundle, and say what happened to the rest.
 *
 * Idempotent by module name: `WorkflowRunner.loadWorkflow` builds a candidate runner out of *every*
 * loaded bundle, so one runner sees the same kit once per project it serves. `alreadyLoaded` is the
 * runner's own memory of what it has evaluated — without it a second bundle re-runs a kit's entry
 * script, which is a side effect an author has no reason to expect and which pushes a duplicate
 * into `runtime.noodlModules` (where `setData` then calls its `setup` twice).
 *
 * ⚠️ Registration must happen **before** `setData`: `GraphModel.importEditorData` resolves node
 * types as it imports, and a type that is not in the register at that moment is skipped with its
 * connections, which is the hang above.
 *
 * @param runtime the `NoodlRuntime` to register into
 * @param modules the bundle's `modules` array, if it has one
 * @param alreadyLoaded module names this runtime has already evaluated; mutated
 */
export function loadCloudKitModules(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime: any,
  modules: CloudKitModule[] | undefined,
  alreadyLoaded: Set<string>
): CloudKitLoadResult {
  const result: CloudKitLoadResult = { registered: [], nodeTypes: [], failures: [], skippedReactNodes: [] };
  if (!modules || !modules.length) return result;

  for (const m of modules) {
    const name = (m && m.name) || 'Unknown Module';

    if (alreadyLoaded.has(name)) continue;

    // Not cloud-enabled. Reported, never silent: this is the record that turns "no such node type"
    // into "that kit exists and has not opted in", which is the difference between a 504 an author
    // can act on and one they cannot.
    if (!m.cloud || typeof m.source !== 'string') {
      alreadyLoaded.add(name);
      if (m.error) {
        result.failures.push({ module: name, reason: 'unreadable', message: `Kit "${name}": ${m.error}` });
      } else if (!m.cloud) {
        result.failures.push({
          module: name,
          reason: 'not-cloud-enabled',
          message:
            `Kit "${name}" is not available to cloud functions: its manifest declares ` +
            `runtimes ${JSON.stringify(m.runtimes || ['browser'])}. Add "cloud" to that list to ` +
            'register its logic nodes here.'
        });
      }
      continue;
    }

    alreadyLoaded.add(name);

    let defined: Record<string, unknown>[];
    try {
      defined = evaluateKit(name, m.source);
    } catch (e) {
      const message = e && typeof e === 'object' ? String((e as Error).message || e) : String(e);
      result.failures.push({
        module: name,
        reason: isRequireReach(e) ? 'needs-require' : 'threw',
        message: isRequireReach(e)
          ? `Kit "${name}" did not load: ${message.indexOf(REQUIRE_LIMIT) !== -1 ? message : `${message} — ${REQUIRE_LIMIT}`}`
          : `Kit "${name}" threw while defining its nodes: ${message}`
      });
      continue;
    }

    if (!defined.length) {
      result.failures.push({
        module: name,
        reason: 'no-module-defined',
        message:
          `Kit "${name}" ran without calling Noodl.defineModule, so it registered no nodes. ` +
          'A kit that guards its definition on `window` will do this in the cloud, where there is none.'
      });
      continue;
    }

    for (const mod of defined) {
      const reactNodes = (mod.reactNodes as unknown[] | undefined) || [];
      if (reactNodes.length) {
        result.skippedReactNodes.push({ module: name, count: reactNodes.length });
        // Dropped rather than passed through: `registerModule` would hand a React node definition
        // to `defineNode` unchanged, and it is only a node after
        // `createNodeFromReactComponent` — which lives in the browser viewer and needs a DOM.
        delete mod.reactNodes;
      }

      const nodes = (mod.nodes as Array<Record<string, unknown>> | undefined) || [];
      for (const entry of nodes) {
        const def = (entry && (entry.node as Record<string, unknown>)) || entry;
        if (def && typeof def.name === 'string') result.nodeTypes.push(def.name);
      }

      // One kit whose Nth node is malformed must not take the kits after it with it: `registerModule`
      // loops the node list and `defineNode` throws, so the throw arrives mid-module.
      try {
        runtime.registerModule(mod);
      } catch (e) {
        const message = e && typeof e === 'object' ? String((e as Error).message || e) : String(e);
        result.failures.push({
          module: name,
          reason: 'threw',
          message: `Kit "${name}" failed to register: ${message}`
        });
        continue;
      }

      if (result.registered.indexOf(name) === -1) result.registered.push(name);
    }
  }

  return result;
}
