'use strict';

/**
 * The runtime's entry point: one object owning the node register, the graph model, the
 * editor connection and the update loop.
 *
 * `NoodlRuntime.instance` is the reason this file is TypeScript. It is assigned inside the
 * constructor, which TypeScript's inference over a `.js` file does not track — so every
 * converted module that needed it used a bare untyped `require` instead (PLAT-003 NOTES
 * §29.4, ~10 files). Declaring the static here is what retires that workaround, and what
 * lets `noodl-viewer-react` resolve this package's declarations instead of compiling its
 * sources (PLAT-006).
 *
 * @module noodl-runtime
 */

import type {
  NodeDefinition as NodeDefinitionType,
  NodeDefinitionOptions,
  ProjectMetaData,
  ProjectSettingsValues,
  RuntimeEventEmitter
} from '@noodl/types';

import type { RuntimeNode } from './src/internal';

import NodeContext = require('./src/nodecontext');
import EditorConnection = require('./src/editorconnection');
import generateNodeLibrary = require('./src/nodelibraryexport');
import ProjectSettings = require('./src/projectsettings');
import GraphModel = require('./src/models/graphmodel');
import NodeDefinition = require('./src/nodedefinition');
import Node = require('./src/node');
import EditorModelEventsHandler = require('./src/editormodeleventshandler');
import Services = require('./src/services/services');
import EdgeTriggeredInput = require('./src/edgetriggeredinput');

import EventEmitter = require('./src/events');
import asyncPool = require('./src/async-pool');

// Derived rather than re-declared: both shapes are module-local to files that use
// `export =`, which forbids exporting anything beside the default. Reading them off the
// signatures that already accept them keeps one description (PLAT-003 NOTES §29.6 trap 3).
type GraphExportData = Parameters<InstanceType<typeof GraphModel>['importEditorData']>[0];
type EditorModelEvent = Parameters<typeof EditorModelEventsHandler.handleEvent>[2];

/**
 * A node module as `registerModule` accepts it: either `{ node }` wrappers or bare
 * definitions, plus an optional `setup` the runtime calls once data has loaded.
 */
interface NoodlModule {
  name?: string;
  nodes?: Array<NodeDefinitionOptions | { node: NodeDefinitionOptions }>;
  setup?(this: NoodlModule): void;
}

/**
 * CN-015 — one kit that never made it into the register, as the page recorded it.
 *
 * Produced by `@nodegx/module-inject`'s capture preamble, which is the only
 * place the fact exists: `registerModule` is never called for a kit whose
 * script threw, so no amount of inspecting this runtime afterwards can tell
 * *"that kit is broken"* from *"that kit was never installed"*.
 */
interface ModuleLoadFailure {
  /** The manifest name, from the `__noodl_module_name` marker CN-003 emits. */
  module: string;
  /** `threw` — an exception or a parse error; `script-not-loaded` — the file did not fetch. */
  reason: string;
  /** What the browser reported, passed through rather than summarised. */
  message: string;
}

/** What `registerNode` accepts — the same two shapes, one at a time. */
interface NodeRegistration {
  node?: NodeDefinitionOptions;
  setup?(context: InstanceType<typeof NodeContext>, graphModel: InstanceType<typeof GraphModel>): void;
}

/** The host services the runtime cannot provide for itself. */
interface RuntimePlatform {
  requestUpdate(callback: () => void): void;
  getCurrentTime(): number;
  webSocketOptions?: unknown;
  objectToString?(object: unknown): string;
  /**
   * A host may carry more than the runtime reads — `EditorConnectionPlatform` declares an
   * index signature for exactly that reason, and this must match it to be assignable.
   */
  [extra: string]: unknown;
  /**
   * Set only by the SSR server's entry; makes client-only nodes instantiate inert
   * (`makeNodeInert` in nodedefinition.ts) instead of running browser code.
   */
  isSSRServer?: boolean;
}

interface NoodlRuntimeArgs {
  type?: string;
  platform?: Partial<RuntimePlatform>;
  /** True in a deployed build: no editor communication, and `runningInEditor` is false. */
  runDeployed?: boolean;
  dontCreateRootComponent?: boolean;
  /** Receives each exported component; the cloud runtime uses it to load only its own. */
  componentFilter?(component: { name: string; [extra: string]: unknown }): boolean;
  /**
   * AIX-008: sandbox previews register under a known id so the editor can feed them their
   * own export. Undefined everywhere else — an anonymous guid.
   */
  editorClientId?: string;
}

/** Extra project-settings ports contributed by the host, merged into the node library. */
interface HostProjectSettings {
  ports?: unknown[];
  dynamicports?: unknown[];
}

interface NoodlRuntime {
  type: string;
  noodlModules: NoodlModule[];
  eventEmitter: RuntimeEventEmitter;
  updateScheduled: boolean;
  rootComponent: RuntimeNode | undefined;
  _currentLoadedData: unknown;
  isWaitingForExport: boolean;
  graphModel: InstanceType<typeof GraphModel>;
  errorHandlers: Array<(message: unknown) => void>;
  frameNumber: number;
  dontCreateRootComponent: boolean;
  componentFilter?: (component: { name: string; [extra: string]: unknown }) => boolean;
  runningInEditor: boolean;
  platform: RuntimePlatform;
  editorConnection: InstanceType<typeof EditorConnection>;
  context: InstanceType<typeof NodeContext>;
  projectSettings?: HostProjectSettings;
  /** CN-015 — set by the host viewer; absent on a runtime with no page to capture from. */
  moduleFailures?: ModuleLoadFailure[];
  lastSentNodeLibrary?: string;
  /** SSR re-loads the graph data; this stops the second load duplicating every node. */
  _disableLoad?: boolean;

  prefetchBundles(bundleNames: string[], numParallelFetches: number): Promise<void>;
  _setupEditorCommunication(args: NoodlRuntimeArgs): void;
  setDebugInspectorsEnabled(enabled: boolean): void;
  setTraceEnabled(enabled: boolean): void;
  registerModule(module: NoodlModule): void;
  registerGraphModelListeners(): void;
  reload(): void;
  registerNode(nodeDefinition: NodeRegistration | NodeDefinitionType): void;
  _setRootComponent(rootComponentName: string | null): Promise<void>;
  setData(graphData: unknown): Promise<void>;
  scheduleUpdate(): void;
  _doUpdate(): void;
  setProjectSettings(settings: HostProjectSettings): void;
  setModuleFailures(failures: ModuleLoadFailure[] | undefined): void;
  getNodeLibrary(): string;
  sendNodeLibrary(): void;
  connectToEditor(address: string): void;
  onModelUpdateReceived(event: EditorModelEvent): Promise<void>;
  addErrorHandler(callback: (message: unknown) => void): void;
  reportError(message: unknown): void;
  getProjectSettings(): ProjectSettingsValues;
  /** Keyed lookup into the project's metadata block; unknown keys are `unknown`. */
  getMetaData<K extends keyof ProjectMetaData>(key: K): ProjectMetaData[K];
}

interface NoodlRuntimeConstructor {
  new (args?: NoodlRuntimeArgs): NoodlRuntime;
  prototype: NoodlRuntime;

  /**
   * The most recently constructed runtime.
   *
   * Assigned in the constructor, so there is exactly one in practice — a viewer builds one
   * runtime per page. Reached from ~10 modules that have no other route to the context.
   */
  instance: NoodlRuntime;

  Services: typeof Services;
  Node: typeof Node;
  NodeDefinition: typeof NodeDefinition;
  EdgeTriggeredInput: typeof EdgeTriggeredInput;
}

/**
 * Nodes registered here reach **every** runtime — the browser viewer registers extra nodes on
 * top of this list, but it never subtracts. That is why a node written for the browser and put
 * here by mistake silently becomes part of the cloud function vocabulary: it is what happened to
 * the agentic-UI batch (AIX-005), whose nine browser-state nodes were offered on a server-side
 * function canvas for months without anyone choosing it (TALK-007 §2).
 *
 * The `type !== 'cloud'` block at the foot of this function is the subtraction that did not
 * exist. Add to it rather than deleting a `require`: a node in neither list is in no product.
 */
function registerNodes(noodlRuntime: NoodlRuntime) {
  [
    require('./src/nodes/componentinputs'),
    require('./src/nodes/componentoutputs'),

    require('./src/nodes/std-library/runtasks'),

    // Data
    require('./src/nodes/std-library/data/restnode'),
    // require('./src/nodes/std-library/data/httpnode'), // moved to viewer for debugging

    // Custom code
    require('./src/nodes/std-library/expression'),
    require('./src/nodes/std-library/simplejavascript'),
    require('./src/nodes/std-library/logic-builder'),

    // Records
    require('./src/nodes/std-library/data/dbcollectionnode2'),
    require('./src/nodes/std-library/data/dbmodelnode2'),
    require('./src/nodes/std-library/data/setdbmodelpropertiesnode'),
    require('./src/nodes/std-library/data/deletedbmodelpropertiesnode'),
    require('./src/nodes/std-library/data/newdbmodelpropertiesnode'),
    require('./src/nodes/std-library/data/dbmodelnode-addrelation'),
    require('./src/nodes/std-library/data/dbmodelnode-removerelation'),
    require('./src/nodes/std-library/data/filterdbmodelsnode'),

    // Object
    require('./src/nodes/std-library/data/modelnode2'),
    require('./src/nodes/std-library/data/setmodelpropertiesnode'),
    require('./src/nodes/std-library/data/newmodelnode'),

    // Array (CWF-008). Moved here from `noodl-viewer-react`, where they sat by history rather
    // than by dependency — every one of them imports this package and `@noodl/types` and nothing
    // else. A cloud function could iterate (Run Tasks) and query (the record nodes) but had no
    // way to *produce* the list it iterated over; this is what removes that "cannot".
    require('./src/nodes/std-library/data/collectionnode2'),
    require('./src/nodes/std-library/data/collectionnode-new'),
    require('./src/nodes/std-library/data/collectionnode-insert'),
    require('./src/nodes/std-library/data/collectionnode-remove'),
    require('./src/nodes/std-library/data/collectionnode-clear'),
    require('./src/nodes/std-library/data/filtercollectionnode'),
    require('./src/nodes/std-library/data/mapcollectionnode'),
    require('./src/nodes/std-library/data/staticdata'),

    // Scratch state (CWF-008). A cloud function is created per request and torn down on send,
    // so a Component Object is per-request state and a Variable is per-run state — see the
    // scoping note on `variablenode2.ts`. The *parent* variants stay browser-only: a function
    // graph rarely nests and "parent" has no meaning at the top of one.
    require('./src/nodes/std-library/data/variablenode2'),
    require('./src/nodes/std-library/data/setvariablenode'),
    require('./src/nodes/std-library/componentutils/componentobject'),
    require('./src/nodes/std-library/componentutils/setcomponentobjectproperties'),

    // Cloud
    require('./src/nodes/std-library/data/cloudfilenode'),
    require('./src/nodes/std-library/data/signfileurl'), // BAK-006 follow-up
    // FH-018: `dbconfig` (the Config node) was deleted, not moved to the browser-only
    // block below. It fetched project settings over a public `GET /config` so an app
    // could read an API key in the browser — and anything the browser can read, the
    // user can read. Server-side secrets belong in a cloud function (CWF-009).

    // Variables
    require('./src/nodes/std-library/variables/number'),
    require('./src/nodes/std-library/variables/string'),
    require('./src/nodes/std-library/variables/boolean'),

    // Utils
    require('./src/nodes/std-library/condition'),
    require('./src/nodes/std-library/and'),
    require('./src/nodes/std-library/or'),
    require('./src/nodes/std-library/booleantostring'),
    require('./src/nodes/std-library/datetostring'),
    require('./src/nodes/std-library/stringmapper'),
    require('./src/nodes/std-library/inverter'),
    require('./src/nodes/std-library/substring'),
    require('./src/nodes/std-library/stringformat'),
    require('./src/nodes/std-library/counter'),
    require('./src/nodes/std-library/uniqueid'),

    // Crypto (CWF-010). Shared, because hashing, random bytes and ids are as ordinary in a
    // browser as on a server and none of them takes a key. The three that DO take a key —
    // HMAC, JWT Sign, JWT Verify — are registered in `noodl-viewer-cloud` instead: a key in a
    // browser is a key in the hands of everyone who opens the page.
    require('./src/nodes/std-library/crypto/hash'),
    require('./src/nodes/std-library/crypto/randombytes'),
    require('./src/nodes/std-library/crypto/uuid'),

    // Date maths (CWF-011). `Date To String` was the entire date vocabulary in both runtimes, so
    // "what time is it", "what is this plus 30 days", "how far apart are these" and "is this
    // before that" were an Expression or a Function node in every project. Shared, for the reason
    // the task gives: the browser wants them just as much as a cloud function does.
    require('./src/nodes/std-library/date/now'),
    require('./src/nodes/std-library/date/dateadd'),
    require('./src/nodes/std-library/date/datedifference'),
    require('./src/nodes/std-library/date/datecompare'),
    require('./src/nodes/std-library/date/dateparts'),

    // CSV, both directions (CWF-012). The tokeniser has shipped inside `Static Array` for years
    // but only ever ran at authoring time; these two put it in front of text that arrives at
    // runtime. Shared, and deliberately with no cloud guard: a browser app importing a
    // spreadsheet wants this exactly as much as a function parsing a supplier's file does.
    require('./src/nodes/std-library/data/parsecsv'),
    require('./src/nodes/std-library/data/tocsv'),

    // CWF-013 — `Log`. Shared rather than cloud-only, and the task argued that out: a browser
    // app wants a log line too, and two implementations behind one name is the mistake. So the
    // node has one branch and the RUNTIME chooses the destination — the cloud runner attaches a
    // sink to the run (`src/runcontext.ts`), nothing does in the browser, and the browser falls
    // through to the console.
    require('./src/nodes/std-library/log'),

    // CWF-008: multi-way Switch and range maths. The cloud had only the two-way Condition.
    require('./src/nodes/std-library/switch'),
    require('./src/nodes/std-library/numberremapper'),
    // The Failure Contract's global error boundary (NDA-004 §1). Registered here rather than
    // in the viewer so it exists in the cloud runtime and in exported code too — a catch-all
    // that only works in the browser would miss the contexts hardest to debug.
    require('./src/nodes/std-library/onapperror'),

    // User
    require('./src/nodes/std-library/user/setuserproperties'),
    require('./src/nodes/std-library/user/user'),
    // Agentic UI (AIX-005) — the streaming six. These are the ones that make sense on a server:
    // calling an upstream streaming API from a cloud function is CWF-007's whole case.
    require('./src/nodes/std-library/agent/websocket'),
    require('./src/nodes/std-library/agent/sse'),
    require('./src/nodes/std-library/agent/text-accumulator'),
    require('./src/nodes/std-library/agent/json-stream-parser'),
    require('./src/nodes/std-library/agent/pattern-extractor'),
    require('./src/nodes/std-library/agent/stream-buffer')
  ].forEach((node) => noodlRuntime.registerNode(node));

  /**
   * Browser-only, by decision (Richard, 2026-08-05 — TALK-007 Pile B).
   *
   * All nine model **client session state**: a store that outlives a request, an optimistic
   * update waiting for a server to confirm it, an undo stack, a snapshot to restore a UI to, an
   * action bus between components on one page. A cloud function is a single request that answers
   * once and is then torn down (`CloudRunner.run` deletes the component and resets the scope on
   * send), so in that runtime they range from inert to actively misleading — a Global Store that
   * silently forgets between two calls is worse than no Global Store.
   *
   * They stay registered in the browser unchanged; this only subtracts them from `type: 'cloud'`.
   *
   * FH-021's `Subscribe To Changes` is here too, for a different reason recorded at its own line:
   * not per-session state but a connection that has to outlive the request a cloud function is.
   */
  if (noodlRuntime.type !== 'cloud') {
    [
      require('./src/nodes/std-library/agent/globalstorenode'),
      require('./src/nodes/std-library/agent/globalstoresetnode'),
      require('./src/nodes/std-library/agent/globalstoresubscribenode'),
      require('./src/nodes/std-library/agent/optimisticupdatenode'),
      require('./src/nodes/std-library/agent/statehistorynode'),
      require('./src/nodes/std-library/agent/undonode'),
      require('./src/nodes/std-library/agent/statesnapshotnode'),
      require('./src/nodes/std-library/agent/actiondispatchernode'),
      require('./src/nodes/std-library/agent/actionhandlernode'),

      /**
       * FH-021. Not scratch state like the nine above — a *long-lived SSE stream*, which is
       * the same mistake with a socket attached. A cloud function is one request that
       * answers and is torn down (`CloudRunner.run` deletes the component on send), so a
       * subscription there either never delivers or leaks the connection that outlives it.
       *
       * Its declaration also says `ssr: { compat: 'client-only' }`, which is the browser's
       * own half of the same rule; this line is what keeps it out of the cloud vocabulary,
       * and `cloud-library:check` is what proves it (the generated snapshot is the picker).
       */
      require('./src/nodes/std-library/data/subscribetochanges')
    ].forEach((node) => noodlRuntime.registerNode(node));
  }
}

const NoodlRuntime = function NoodlRuntime(this: NoodlRuntime, args?: NoodlRuntimeArgs) {
  args = args || {};
  args.platform = args.platform || {};
  // Assigned through the constructor's declared type rather than the `const` being
  // initialised: inside its own initializer TypeScript has not yet resolved the latter.
  (NoodlRuntime as unknown as NoodlRuntimeConstructor).instance = this;

  this.type = args.type || 'browser';
  this.noodlModules = [];
  this.eventEmitter = new EventEmitter();
  this.updateScheduled = false;
  this.rootComponent = null;
  this._currentLoadedData = null;
  this.isWaitingForExport = true;
  this.graphModel = new GraphModel();
  this.errorHandlers = [];
  this.frameNumber = 0;
  this.dontCreateRootComponent = !!args.dontCreateRootComponent;
  this.componentFilter = args.componentFilter;

  this.runningInEditor = args.runDeployed ? false : true;

  this.platform = {
    requestUpdate: args.platform.requestUpdate,
    getCurrentTime: args.platform.getCurrentTime,
    webSocketOptions: args.platform.webSocketOptions,
    objectToString: args.platform.objectToString,
    // Set only by the SSR server's entry; makes client-only nodes instantiate
    // inert (nodedefinition.ts makeNodeInert) instead of running browser code.
    isSSRServer: args.platform.isSSRServer
  } as RuntimePlatform;

  if (!args.platform.requestUpdate) {
    throw new Error('platform.requestUpdate must be set');
  }

  if (!args.platform.getCurrentTime) {
    throw new Error('platform.getCurrentTime must be set');
  }

  //Create an editor connection even if we're running deployed.
  //If won't connect and act as a "noop" in deployed mode,
  // and reduce the need for lots of if(editorConnection)
  this.editorConnection = new EditorConnection({
    platform: this.platform,
    runtimeType: this.type,
    // AIX-008: sandbox previews register under a known id so the editor can feed
    // them their own export. Undefined everywhere else — an anonymous guid.
    clientId: args.editorClientId
  });

  this.context = new NodeContext({
    runningInEditor: args.runDeployed ? false : true,
    editorConnection: this.editorConnection,
    platform: this.platform,
    graphModel: this.graphModel
  });

  this.context.eventEmitter.on('scheduleUpdate', this.scheduleUpdate.bind(this));

  if (!args.runDeployed) {
    this._setupEditorCommunication(args);
  }

  this.registerGraphModelListeners();

  registerNodes(this);
} as unknown as NoodlRuntimeConstructor;

NoodlRuntime.prototype.prefetchBundles = async function (bundleNames: string[], numParallelFetches: number) {
  await asyncPool(numParallelFetches, bundleNames, async (name) => {
    await this.context.fetchComponentBundle(name);
  });
};

NoodlRuntime.prototype._setupEditorCommunication = function (args: NoodlRuntimeArgs) {
  function objectEquals(x: unknown, y: unknown): boolean {
    if (x === null || x === undefined || y === null || y === undefined) {
      return x === y;
    }
    if (x === y) {
      return true;
    }
    if (Array.isArray(x) && x.length !== (y as unknown[]).length) {
      return false;
    }

    // if they are strictly equal, they both need to be object at least
    if (!(x instanceof Object)) {
      return false;
    }
    if (!(y instanceof Object)) {
      return false;
    }

    // recursive object equality check
    const left = x as Record<string, unknown>;
    const right = y as Record<string, unknown>;
    var p = Object.keys(left);
    return (
      Object.keys(right).every(function (i) {
        return p.indexOf(i) !== -1;
      }) &&
      p.every(function (i) {
        return objectEquals(left[i], right[i]);
      })
    );
  }

  this.editorConnection.on('exportDataFull', async (exportData) => {
    if (this.graphModel.isEmpty() === false) {
      this.reload();
      return;
    }

    this.isWaitingForExport = false;
    if (objectEquals(this._currentLoadedData, exportData) === false) {
      if (this.componentFilter) {
        exportData.components = exportData.components.filter((c) => this.componentFilter(c));
      }

      await this.setData(exportData);

      //get the rest of the components
      //important to get all the dynamic ports evaluated
      if (exportData.componentIndex) {
        const allBundles = Object.keys(exportData.componentIndex);
        await this.prefetchBundles(allBundles, 2);
      }

      this.graphModel.emit('editorImportComplete');
    }
  });

  this.editorConnection.on('reload', this.reload.bind(this));
  this.editorConnection.on('modelUpdate', this.onModelUpdateReceived.bind(this));
  // There was a third listener here, for 'metadataUpdate'. Nothing has ever emitted that
  // event — `editorconnection.ts` dispatches a fixed set and it is not among them — and
  // its handler called `EditorMetaDataEventsHandler`, an identifier that has never existed
  // in this repository (`git log -S` reaches the initial commit). Both are gone: the branch
  // was unreachable, and had it ever been reached it would have thrown a ReferenceError.

  this.editorConnection.on('connected', () => {
    this.sendNodeLibrary();
  });
};

NoodlRuntime.prototype.setDebugInspectorsEnabled = function (enabled: boolean) {
  this.context.setDebugInspectorsEnabled(enabled);
};

/**
 * OBS-001. Note this is *not* also wired in `viewer.jsx` the way `debuggingEnabledChanged` is:
 * `NodeContext` subscribes to `traceEnabledChanged` itself, so the trace works in every runtime
 * that has an editor connection — including the cloud runtime, which never runs `viewer.jsx`.
 * This method exists for hosts that drive the runtime directly rather than over the relay.
 */
NoodlRuntime.prototype.setTraceEnabled = function (enabled: boolean) {
  this.context.setTraceEnabled(enabled);
};

NoodlRuntime.prototype.registerModule = function (module: NoodlModule) {
  if (module.nodes) {
    const moduleName = module.name || 'Unknown Module';

    /**
     * ✅ **D20** — every register this module has performed, newest last, with what it displaced.
     *
     * ⚠️ **Reverse order on the way out matters.** A kit may register the same name twice; undoing
     * newest-first walks back through its own overwrites to whatever was there before the kit ran.
     *
     * ⚠️ **What this does NOT undo, stated rather than implied:** `setup` and
     * `setupNumberedInputDynamicPorts` run under the same loop and may have attached graph-model
     * listeners or dynamic-port rules. Those are left behind, inert — they key off node types that
     * are no longer registered, so nothing can instantiate one. The nodes are the thing a kit is
     * judged by and the nodes all go.
     */
    const displaced: { name: string; previous: ReturnType<typeof this.context.nodeRegister.peek> }[] = [];
    const rollBack = () => {
      for (let j = displaced.length - 1; j >= 0; j--) {
        this.context.nodeRegister.restore(displaced[j].name, displaced[j].previous);
      }
    };

    for (let i = 0; i < module.nodes.length; i++) {
      const entry = module.nodes[i];
      // A module may list bare definitions or `{ node }` wrappers; both are accepted.
      const wrapped: NodeRegistration =
        'node' in entry && entry.node ? (entry as { node: NodeDefinitionOptions }) : { node: entry as NodeDefinitionOptions };
      wrapped.node.module = moduleName;

      // ✅ D20 — what this node is about to displace, so a kit that throws later
      // can put every one of them back. Recorded BEFORE the register, and only
      // for a definition that has a name to register under.
      const typeName = wrapped.node && typeof wrapped.node.name === 'string' ? wrapped.node.name : undefined;
      if (typeName !== undefined) {
        displaced.push({ name: typeName, previous: this.context.nodeRegister.peek(typeName) });
      }

      /*
       * 🔴 CN-015 — the kit's name, on the way out of *any* registration throw.
       *
       * `defineNode` names the kit itself now, but it is not the only thing that
       * can throw in here: `nodeRegister.register`, a definition's `setup`, and
       * `setupNumberedInputDynamicPorts` all run under this loop, and a throw
       * from any of them is unattributed the way the `category` throw was.
       *
       * ✅ **D20 — still thrown, but the module is atomic now.** The nodes this
       * kit had already registered are rolled back first, so a caller sees
       * either the whole kit or none of it. Half a kit was the state CN-015
       * named as the alarming one: the nodes before the bad definition live, the
       * ones after are gone, and the kit looks partly fine.
       *
       * 🔴 **The throw stays because two callers depend on it to report at all**
       * — `noodl-viewer-cloud/src/kitModules.ts` and `noodl-mcp`'s kit
       * extractor both wrap this in a `try` and push a failure from the `catch`.
       * Swallowing here would leave those two `catch` blocks dead and both
       * surfaces would call a broken kit healthy. The blast radius moves at the
       * *call sites* — `viewer.jsx` catches per module and records the failure
       * on the CN-015 channel — not by making this function silent.
       *
       * ⚠️ The index is the module's own `nodes` array position, which is what
       * an author scrolls to in their `index.js`. `nodeAt` degrades to the index
       * alone when the entry has no usable name — the failing definition is
       * precisely the one whose name may be missing.
       */
      try {
        this.registerNode(wrapped);
      } catch (e) {
        rollBack();
        const message = e && (e as Error).message ? (e as Error).message : String(e);
        const nodeAt = wrapped.node && wrapped.node.name ? `"${wrapped.node.name}"` : `at index ${i}`;

        // Not re-prefixed when `defineNode` already said which kit — the two
        // must not stack into "in kit X … in kit X" on the common path.
        if (message.indexOf(`kit "${moduleName}"`) !== -1) {
          if (wrapped.node && wrapped.node.name) throw e;

          // ⚠️ Except when the definition has no name: the kit is named but the
          // node cannot be, and the position is then the only locator there is.
          // Caught by a test that expected the index and got a bare kit name.
          const located = new Error(`${message} It is the definition at index ${i} in the kit's \`nodes\` list.`);
          (located as Error & { cause?: unknown }).cause = e;
          throw located;
        }

        const error = new Error(`Kit "${moduleName}" failed to register its node ${nodeAt}: ${message}`);
        // Keep the original for anything reading a stack rather than a message.
        (error as Error & { cause?: unknown }).cause = e;
        throw error;
      }
    }
  }

  this.noodlModules.push(module);
};

NoodlRuntime.prototype.registerGraphModelListeners = function () {
  var self = this;

  this.graphModel.on(
    'componentAdded',
    function (component) {
      self.context.registerComponentModel(component);
    },
    this
  );

  this.graphModel.on(
    'componentRemoved',
    function (component) {
      self.context.deregisterComponentModel(component);
    },
    this
  );
};

NoodlRuntime.prototype.reload = function () {
  location.reload();
};

NoodlRuntime.prototype.registerNode = function (nodeDefinition: NodeRegistration) {
  if (nodeDefinition.node) {
    const definedNode = NodeDefinition.defineNode(nodeDefinition.node);
    this.context.nodeRegister.register(definedNode);

    definedNode.setupNumberedInputDynamicPorts &&
      definedNode.setupNumberedInputDynamicPorts(this.context, this.graphModel);
  } else {
    this.context.nodeRegister.register(nodeDefinition);
  }

  nodeDefinition.setup && nodeDefinition.setup(this.context, this.graphModel);
};

NoodlRuntime.prototype._setRootComponent = async function (rootComponentName: string | null) {
  if (this.rootComponent && this.rootComponent.name === rootComponentName) return;

  if (this.rootComponent) {
    this.rootComponent.model && this.rootComponent.model.removeListenersWithRef(this);
    this.rootComponent = undefined;
  }

  if (rootComponentName) {
    this.rootComponent = await this.context.createComponentInstanceNode(rootComponentName, 'rootComponent');

    this.rootComponent.componentModel.on('rootAdded', () => this.eventEmitter.emit('rootComponentUpdated'), this);
    this.rootComponent.componentModel.on('rootRemoved', () => this.eventEmitter.emit('rootComponentUpdated'), this);

    this.context.setRootComponent(this.rootComponent);
  }

  this.eventEmitter.emit('rootComponentUpdated');
};

NoodlRuntime.prototype.setData = async function (graphData: GraphExportData) {
  // Added for SSR Support
  // In SSR, we re-load the graphData and when we render the componet it will
  // invoke this method again, which will cause a duplicate node exception.
  // To avoid this, we flag the runtime to not load again.
  if (this._disableLoad) return;

  this._currentLoadedData = graphData;
  await this.graphModel.importEditorData(graphData);

  // Run setup on all modules
  for (const module of this.noodlModules) {
    typeof module.setup === 'function' && module.setup.apply(module);
  }

  if (this.dontCreateRootComponent !== true) {
    await this._setRootComponent(this.graphModel.rootComponent);

    //listen to delta updates on the root component
    this.graphModel.on('rootComponentNameUpdated', (name) => {
      this._setRootComponent(name);
    });

    //check if the root component was deleted
    this.graphModel.on('componentRemoved', (componentModel) => {
      if (this.rootComponent && this.rootComponent.name === componentModel.name) {
        this._setRootComponent(null);
      }
    });

    //check if the root component was added when it previously didn't exist (e.g. when user deletes it and then hits undo)
    this.graphModel.on('componentAdded', (componentModel) => {
      setTimeout(() => {
        if (!this.rootComponent && this.graphModel.rootComponent === componentModel.name) {
          this._setRootComponent(componentModel.name);
        }
      }, 1);
    });
  }

  this.scheduleUpdate();
};

NoodlRuntime.prototype.scheduleUpdate = function () {
  if (this.updateScheduled) {
    return;
  }

  this.updateScheduled = true;
  this.platform.requestUpdate(NoodlRuntime.prototype._doUpdate.bind(this));
};

NoodlRuntime.prototype._doUpdate = function () {
  this.updateScheduled = false;

  this.context.currentFrameTime = this.platform.getCurrentTime();

  this.context.eventEmitter.emit('frameStart');

  this.context.update();

  this.context.eventEmitter.emit('frameEnd');

  this.frameNumber++;
};

NoodlRuntime.prototype.setProjectSettings = function (settings: HostProjectSettings) {
  this.projectSettings = settings;
};

/**
 * CN-015 — the kit load failures the page captured, on their way to the editor.
 *
 * A kit whose `index.js` throws, fails to parse or 404s never reaches this
 * runtime at all: `registerModule` is simply never called for it, so **there is
 * nothing here that can be inspected after the fact.** The only record is the
 * one `@nodegx/module-inject`'s capture preamble made while the page was
 * loading, and this is the hand-off from that record into the payload the
 * editor already receives (✅ **D3** — the editor extracts nothing; it reads
 * what the viewer sent).
 *
 * ⚠️ The host supplies these, exactly as it does `setProjectSettings`. This
 * package is platform-neutral and must not reach for `window` — the browser
 * viewer reads the global and calls this; an SSR or cloud runtime, which has no
 * such capture, calls nothing and the field is absent rather than empty.
 */
NoodlRuntime.prototype.setModuleFailures = function (failures: ModuleLoadFailure[] | undefined) {
  this.moduleFailures = Array.isArray(failures) ? failures : undefined;
};

NoodlRuntime.prototype.getNodeLibrary = function () {
  var projectSettings = ProjectSettings.generateProjectSettings(this.graphModel.getSettings(), this.noodlModules);

  if (this.projectSettings) {
    this.projectSettings.ports && (projectSettings.ports = projectSettings.ports.concat(this.projectSettings.ports));
    this.projectSettings.dynamicports &&
      (projectSettings.dynamicports = projectSettings.ports.concat(this.projectSettings.dynamicports));
  }

  // `projectsettings` is stamped on here rather than produced by the exporter: the
  // settings are the *project's*, and the exporter only knows the node register.
  const nodeLibrary = generateNodeLibrary(this.context.nodeRegister, {
    runtimeType: this.type
  }) as ReturnType<typeof generateNodeLibrary> & {
    projectsettings?: unknown;
    modulefailures?: ModuleLoadFailure[];
  };
  nodeLibrary.projectsettings = projectSettings;

  // CN-015: stamped here for the same reason `projectsettings` is — the
  // exporter knows the node register and nothing else, and a kit that failed to
  // load is by definition *not* in the register.
  //
  // ⚠️ Omitted entirely when there are none, rather than sent as `[]`. The
  // payload for a healthy project is then byte-identical to what it was before
  // this task, which keeps `sendNodeLibrary`'s "don't send the same export
  // twice" comparison and every recorded-payload fixture unperturbed.
  if (this.moduleFailures && this.moduleFailures.length) {
    nodeLibrary.modulefailures = this.moduleFailures;
  }

  return JSON.stringify(nodeLibrary, null, 3);
};

NoodlRuntime.prototype.sendNodeLibrary = function () {
  const nodeLibrary = this.getNodeLibrary();
  if (this.lastSentNodeLibrary !== nodeLibrary) {
    this.lastSentNodeLibrary = nodeLibrary;
    this.editorConnection.sendNodeLibrary(nodeLibrary);
  }
};

NoodlRuntime.prototype.connectToEditor = function (address: string) {
  this.editorConnection.connect(address);
};

NoodlRuntime.prototype.onModelUpdateReceived = async function (event: EditorModelEvent) {
  if (this.isWaitingForExport) {
    return;
  }

  if (event.type === 'projectInstanceChanged') {
    this.reload();
  }
  //wait for data to load before applying model changes
  else if (this.graphModel.isEmpty() === false) {
    await EditorModelEventsHandler.handleEvent(this.context, this.graphModel, event);
  }
};

NoodlRuntime.prototype.addErrorHandler = function (callback: (message: unknown) => void) {
  this.errorHandlers.push(callback);
};

NoodlRuntime.prototype.reportError = function (message: unknown) {
  this.errorHandlers.forEach(function (eh: (message: unknown) => void) {
    eh(message);
  });
};

NoodlRuntime.prototype.getProjectSettings = function () {
  return this.graphModel.getSettings() as ProjectSettingsValues;
};

NoodlRuntime.prototype.getMetaData = function (key: string) {
  return this.graphModel.getMetaData(key);
} as NoodlRuntime['getMetaData'];

NoodlRuntime.Services = Services;
NoodlRuntime.Node = Node;
NoodlRuntime.NodeDefinition = NodeDefinition;
NoodlRuntime.EdgeTriggeredInput = EdgeTriggeredInput;

export = NoodlRuntime;
