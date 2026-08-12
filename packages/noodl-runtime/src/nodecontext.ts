'use strict';

import type { RuntimeNode, RuntimeNodeContext, RuntimeOutputProperty } from './internal';

import EventEmitter = require('./events');
import NodeRegister = require('./noderegister');
import {
  RuntimeErrorBus,
  createConsoleErrorSubscriber,
  createEditorWarningSubscriber,
  setAmbientErrorBus
} from './runtimeerror';
import TimerScheduler = require('./timerscheduler');
import { DEFAULT_VALUE_CAP, TraceBuffer, previewValue, toWireEvent } from './tracebuffer';
import type { SessionDictionary, TraceEvent, TraceState } from './tracebuffer';
import Variants = require('./variants');
import { createBlockRunRecorder } from './blockrun';
import type { BlockRunRecorder } from './blockrun';

/** Set by the viewer before any node runs; carries deploy-time environment values. */
declare const Noodl: { Env: Record<string, string> };

/** A value the editor is showing live, either on a connection or in a node inspector. */
interface DebugInspector {
  type: 'connection' | 'node';
  id?: string;
  nodeId?: string;
  connection?: { fromId: string; fromProperty: string };
}

/** One port whose current value OBS-002's layer 1 wants. */
interface PortValueRequest {
  node: string;
  port: string;
  direction: 'input' | 'output';
}

/**
 * ⚠️ `exists: false` is not the same as `value: undefined`. A port that is absent (the graph
 * changed, or the node never declared it) must read differently in the walk from a port that
 * is genuinely holding `undefined`, which is a common and meaningful state in this runtime.
 */
interface PortValueResult extends PortValueRequest {
  exists: boolean;
  value: string | undefined;
}

/**
 * The answer to one "Do It" (LGC-002).
 *
 * ⚠️ `found: false` is a *different* answer from an error, and the balloon says something
 * different for each. "The app is running but this node is not in it right now" is the most
 * likely thing a builder hits — the component is not on screen — and reporting it as a failure
 * of the block would send them looking in the wrong place.
 */
interface BlockFragmentReply {
  requestId: string;
  nodeId: string;
  /** Whether this viewer has the node at all. Nothing else is meaningful when false. */
  found: boolean;
  ok?: boolean;
  value?: string;
  error?: string;
  errorPhase?: 'compile' | 'run';
  suppressedSignals?: string[];
}

/**
 * The runtime's single per-application object: node register, scheduler, global values,
 * component models, and the editor channel.
 *
 * Everything the core needs from it is described by {@link RuntimeNodeContext}; this
 * interface adds the members that only the context itself and its host (the viewer) use.
 */
interface NodeContext extends RuntimeNodeContext {
  _dirtyNodes: RuntimeNode[];
  callbacksAfterUpdate: Array<() => void>;
  graphModel: any;
  platform: any;
  eventEmitter: any;
  eventSenderEmitter: any;
  globalValues: Record<string, unknown>;
  globalsEventEmitter: any;
  runningInEditor: boolean;
  currentFrameTime: number;
  frameNumber: number;
  timerScheduler: any;
  componentModels: Record<string, any>;
  debugInspectorsEnabled: boolean;
  /**
   * OBS-001. Deliberately distinct from `debugInspectorsEnabled`: turning on the trace must
   * not force canvas inspectors on, and vice versa. Read on the propagation hot path, so it
   * is a plain boolean and is checked before anything else happens.
   */
  traceEnabled: boolean;
  /**
   * HUD-004 — who asked for the trace.
   *
   * ⚠️ **`traceEnabled` is derived from this: it means "the set is non-empty".** Two peers share
   * this switch — the editor's Record and `nodegx-observe`'s `start_trace` — and until this set
   * existed the second one to arm *replaced the buffer*, silently destroying a recording the
   * first was in the middle of. Ownership is what makes the buffer's lifetime match the
   * recording's rather than the last message's.
   *
   * The derived boolean is kept as a plain field precisely so the propagation hot path
   * (`traceEdgeSend`, `outputproperty`, `node`) never has to ask a Set anything.
   */
  _traceOwners: Set<string>;
  /**
   * LGC-003 — the Logic Builder nodes whose block values are being watched.
   *
   * ⚠️ **Deliberately not `_traceOwners`, not `traceEnabled`, and not `_traceBuffer`.** See
   * {@link NodeContext.setBlockTracing}: joining the shared trace switch would mean a block
   * editor opening could clear a human's Provenance recording, which is the accident TALK-003
   * recorded and HUD-004 had to build an ownership set to survive.
   */
  _blockTraceNodes: Set<string> | undefined;
  /** Monotonic run counter for block frames. Only its ordering is used. */
  _blockRunSeq: number;
  _traceBuffer: TraceBuffer | undefined;
  _traceValueCap: number;
  /**
   * The `seq` of the edge event whose delivery is being processed right now, or 0 at a root.
   * Set by `Node.update` as it drains its input queue; read by `traceEdgeSend`.
   */
  _currentCause: number;
  connectionsToPulse: Record<string, { timestamp: number; connections: string[] }>;
  connectionsToPulseChanged: boolean;
  debugInspectors: Record<string, DebugInspector>;
  connectionPulsingCallbackScheduled: boolean;
  rootComponent: any;
  _outputHistory: Record<string, { value: unknown; timestamp: number }>;
  _signalHistory: Record<string, { count: number }>;
  warningTypes: Record<string, boolean>;
  bundleFetchesInFlight: Map<string, Promise<void>>;
  isUpdating?: boolean;
  onShowPopup?: (group: any) => void;
  onClosePopup?: (group: any) => void;

  setRootComponent(rootComponent: any): void;
  getCurrentTime(): number;
  onDebugInspectorsUpdated(inspectors: DebugInspector[]): void;
  updateDirtyNodes(): void;
  update(): void;
  reset(): void;
  scheduleUpdate(): void;
  scheduleAfterUpdate(func: () => void): void;
  setGlobalValue(name: string, value: unknown): void;
  getGlobalValue(name: string): unknown;
  registerComponentModel(componentModel: any): void;
  deregisterComponentModel(componentModel: any): void;
  fetchComponentBundle(name: string): Promise<void>;
  getComponentModel(name: string): Promise<any>;
  _formatConnectionValue(value: any): unknown;
  clearDebugInspectors(): void;
  clearOldConnectionPulsing(): void;
  _getDebugInspectorValueForNode(id: string): { type: 'node'; id: string; value: unknown } | undefined;
  sendDebugInspectorValues(): void;
  setDebugInspectorsEnabled(enabled: boolean): void;
  setTraceEnabled(enabled: boolean, owner?: string): void;
  releaseTraceOwner(owner: string): void;
  getTraceState(): TraceState;
  traceEdgeSend(
    fromNode: string,
    fromPort: string,
    toNode: string,
    toPort: string,
    value: unknown,
    kind: 'value' | 'signal'
  ): number;
  buildSessionDictionary(): SessionDictionary;
  getTraceEvents(afterSeq?: number): TraceEvent[];
  getPortValues(ports: PortValueRequest[]): PortValueResult[];
  evaluateBlockFragment(requestId: string, nodeId: string, code: string): BlockFragmentReply;
  /** Is this node in this viewer's live scope right now? */
  hasNode(nodeId: string): boolean;
  setBlockTracing(nodeId: string, enabled: boolean): void;
  isBlockTracing(nodeId: string): boolean;
  beginBlockRun(nodeId: string): BlockRunRecorder | undefined;
  endBlockRun(nodeId: string, recorder: BlockRunRecorder): void;
  clearTrace(): void;
  sendGlobalEventFromEventSender(channelName: string, inputValues: unknown): void;
  setPopupCallbacks(callbacks: { onShow: (group: any) => void; onClose: (group: any) => void }): void;
  /** Open popups, oldest first. At most one entry unless a node opts into `'stack'`. */
  popupStack: PopupStackEntry[];
  _dismissOpenPopups(): void;
  showPopup(popupComponent: string, params: Record<string, unknown>, args?: any): Promise<void>;
  setWarningTypes(warningTypes: Record<string, boolean>): void;
}

/** One open popup. `group` is unset until the popup has actually reached the viewer. */
interface PopupStackEntry {
  group?: any;
  dismissed: boolean;
  /** Close this popup implicitly, because something replaced it. */
  dismiss(): void;
}

interface NodeContextArgs {
  graphModel?: any;
  platform?: any;
  editorConnection?: any;
  runningInEditor?: boolean;
}

interface NodeContextConstructor {
  new (args?: NodeContextArgs): NodeContext;
  prototype: NodeContext;
}

const NodeContext = function NodeContext(this: NodeContext, args?: NodeContextArgs) {
  args = args || {};
  args.runningInEditor = args.hasOwnProperty('runningInEditor') ? args.runningInEditor : false;

  this._dirtyNodes = [];
  this.callbacksAfterUpdate = [];

  this.graphModel = args.graphModel;

  this.platform = args.platform;

  this.eventEmitter = new EventEmitter();
  this.eventEmitter.setMaxListeners(1000000);

  this.eventSenderEmitter = new EventEmitter(); //used by event senders and receivers
  this.eventSenderEmitter.setMaxListeners(1000000);

  this.globalValues = {};
  this.globalsEventEmitter = new EventEmitter();
  this.globalsEventEmitter.setMaxListeners(1000000);

  this.runningInEditor = args.runningInEditor;
  this.currentFrameTime = 0;
  this.frameNumber = 0;
  this.updateIteration = 0;

  this.nodeRegister = new NodeRegister(this);
  this.timerScheduler = new TimerScheduler(this.scheduleUpdate.bind(this));

  this.componentModels = {};
  /** Open popups, oldest first. See {@link NodeContext.showPopup} and the stack policy. */
  this.popupStack = [];
  this.debugInspectorsEnabled = false;
  // OBS-001. The buffer is not allocated until tracing is turned on — an app nobody is
  // debugging holds no trace storage at all, not even an empty ring.
  this.traceEnabled = false;
  this._traceOwners = new Set();
  this._traceBuffer = undefined;
  this._traceValueCap = DEFAULT_VALUE_CAP;
  this._currentCause = 0;
  this.connectionsToPulse = {};
  this.connectionsToPulseChanged = false;

  this.debugInspectors = {};

  this.connectionPulsingCallbackScheduled = false;

  this.editorConnection = args.editorConnection;

  this.rootComponent = undefined;

  this._outputHistory = {};
  this._signalHistory = {};

  this.warningTypes = {}; //default is to send all warning types

  this.bundleFetchesInFlight = new Map();

  this.variants = new Variants({
    graphModel: this.graphModel,
    getNodeScope: () => (this.rootComponent ? this.rootComponent.nodeScope : null)
  });

  // The runtime error channel (FAILURE-CONTRACT.md). Created before anything can raise, with
  // the default subscriber for this context: the editor keeps the warning panel it always
  // had, and every other runtime — deployed app, cloud, SSR, export — gets a structured
  // console line so a failure is never fully silent.
  //
  // **The two subscribers are not alternatives, and choosing between them on `editorConnection`
  // was wrong.** `NoodlRuntime` builds an `EditorConnection` in *every* runtime and says so at
  // `noodl-runtime.ts:285-288` — "create an editor connection even if we're running deployed …
  // it won't connect and act as a no-op" — so `if (this.editorConnection)` was always true and
  // `createConsoleErrorSubscriber` was unreachable outside a directly-constructed context, i.e.
  // outside tests. Measured on a real Deploy To Folder: the deployed browser app and the SSG
  // build both carried `editorWarningSubscriber` and nothing else, so every raised failure went
  // to a socket that connects to nothing and produced no console output anywhere. The clause
  // above was true of the *bus* and false of every runtime that ships.
  //
  // So the editor subscriber stays unconditional — it is a no-op when disconnected, and it must
  // be armed before the socket opens or a boot-time warning is lost — and the console subscriber
  // is added everywhere the editor's warning panel is not the surface an author is watching.
  // `runningInEditor` is the right discriminator for the browser (`noodl-runtime.ts:265` derives
  // it from `runDeployed`, so it is true only in the editor's preview window), and the cloud
  // runtime is added by name because it leaves `runDeployed` unset — a deployed cloud function
  // reports `runningInEditor: true` while having no editor to report to, and its console *is*
  // the server log.
  this.errorBus = new RuntimeErrorBus();
  if (this.editorConnection) {
    this.errorBus.subscribe(createEditorWarningSubscriber(this.editorConnection));
  }
  if (!this.editorConnection || !this.runningInEditor || this.editorConnection.runtimeType === 'cloud') {
    this.errorBus.subscribe(createConsoleErrorSubscriber());
  }
  // So failures raised where no node is in scope — `Collection`'s notification loop — have
  // somewhere to go. See `raiseUnattributedRuntimeError`.
  setAmbientErrorBus(this.errorBus);

  if (this.editorConnection) {
    this.editorConnection.on('debugInspectorsUpdated', (inspectors) => {
      this.onDebugInspectorsUpdated(inspectors);
    });

    this.editorConnection.on('getConnectionValue', ({ clientId, connectionId }) => {
      if (this.editorConnection.clientId !== clientId) return;
      const connection = this._outputHistory[connectionId];
      this.editorConnection.sendConnectionValue(connectionId, connection ? connection.value : undefined);
    });

    // OBS-001. The editor pulls rather than the runtime pushing: the buffer is an index the
    // walk queries, not a firehose anyone reads front to back, and pushing 250k events at a
    // renderer is precisely the failure the shelved panel died of.
    // ⚠️ The payload gained an `owner` (HUD-004) and the old shape was a bare boolean. Both are
    // accepted: the runtime and the editor are built together, but a viewer bundle and an
    // `nodegx-observe` on disk are not, and an argument silently read as `undefined` here would
    // route every peer onto the same anonymous key — i.e. straight back to the bug.
    this.editorConnection.on('traceEnabledChanged', (message) => {
      if (typeof message === 'boolean') this.setTraceEnabled(message);
      else this.setTraceEnabled(!!message.enabled, message.owner);
    });

    // HUD-004 slice 3 — the relay saying an editor peer's socket has gone. Without it an agent
    // that crashes mid-trace holds its ownership for the life of the page, and the human's Stop
    // silently does nothing because the set never empties.
    this.editorConnection.on('peerDisconnected', ({ clientId }) => {
      this.releaseTraceOwner(clientId);
    });

    this.editorConnection.on('getTraceState', ({ clientId }) => {
      if (this.editorConnection.clientId !== clientId) return;
      this.editorConnection.sendTraceState(this.getTraceState());
    });

    this.editorConnection.on('getTraceEvents', ({ clientId, afterSeq }) => {
      if (this.editorConnection.clientId !== clientId) return;
      this.editorConnection.sendTraceEvents(this.getTraceEvents(afterSeq).map(toWireEvent));
    });

    // OBS-002. A consumer attaching to a trace already in progress needs the topology, and
    // `setTraceEnabled` only sends it on the transition.
    this.editorConnection.on('getTraceDictionary', ({ clientId }) => {
      if (this.editorConnection.clientId !== clientId) return;
      this.editorConnection.sendTraceDictionary(this.buildSessionDictionary());
    });

    this.editorConnection.on('getPortValues', ({ clientId, ports }) => {
      if (this.editorConnection.clientId !== clientId) return;
      this.editorConnection.sendPortValues(this.getPortValues(ports));
    });

    // LGC-002 — "Do It". Deliberately **not** filtered on `clientId` the way its neighbours
    // are: the editor is asking "whichever of you has this node, evaluate this", because a
    // block editor tab knows its node id and nothing more. Every viewer answers, and one of
    // the two answers is `found: false`.
    this.editorConnection.on('evaluateBlockFragment', ({ requestId, nodeId, code }) => {
      this.editorConnection.sendBlockFragmentResult(this.evaluateBlockFragment(requestId, nodeId, code));
    });

    /**
     * LGC-003 §1 — arm or disarm block-value tracing for one Logic Builder node.
     *
     * ⚠️ **Broadcast to arm, addressed on the way back**, which is the correction LGC-002's
     * handover asked for. A block editor tab knows a node id and nothing else, so it cannot
     * name the viewer it wants; every viewer arms, and every viewer that *has* the node says
     * so with its own `clientId` in the ack. The editor pins that client and drops frames
     * from any other, so two previews showing the same component can never interleave two
     * programs' values into one set of badges.
     *
     * Arming a node this viewer does not have costs a string in a Set, which is why arming is
     * unconditional: the component may be mounted a moment later, and a switch that had
     * refused would then be off with nothing to turn it back on.
     */
    this.editorConnection.on('setBlockTracing', ({ nodeId, enabled }) => {
      this.setBlockTracing(nodeId, !!enabled);
      this.editorConnection.sendBlockTraceState({
        nodeId: nodeId,
        enabled: !!enabled,
        // "Do I have this node right now?" — the same walk `evaluateBlockFragment` does, and
        // the same distinction: not having the node is a different answer from an error, and
        // the editor says something different for each.
        attached: this.hasNode(nodeId)
      });
    });
  }
} as unknown as NodeContextConstructor;

NodeContext.prototype.setRootComponent = function (rootComponent) {
  this.rootComponent = rootComponent;

  // The dictionary is only meaningful once there is a graph to describe. After a reload this
  // is where the new one becomes available, so it is where the delta is sent.
  if (this.traceEnabled && this.editorConnection && this.editorConnection.sendTraceDictionary) {
    this.editorConnection.sendTraceDictionary(this.buildSessionDictionary());
  }
};

NodeContext.prototype.getCurrentTime = function () {
  return this.platform.getCurrentTime();
};

NodeContext.prototype.onDebugInspectorsUpdated = function (inspectors) {
  if (!this.debugInspectorsEnabled) return;

  inspectors = inspectors.map((inspector) => {
    if (inspector.type === 'connection') {
      const connection = inspector.connection;
      inspector.id = connection.fromId + connection.fromProperty;
    } else if (inspector.type === 'node') {
      inspector.id = inspector.nodeId;
    }
    return inspector;
  });

  this.debugInspectors = {};
  inspectors.forEach((inspector) => (this.debugInspectors[inspector.id] = inspector));

  this.sendDebugInspectorValues();
};

NodeContext.prototype.updateDirtyNodes = function () {
  var i, len;

  var loop = true,
    iterations = 0;

  this.updateIteration++;

  this.isUpdating = true;

  while (loop && iterations < 10) {
    var dirtyNodes = this._dirtyNodes;
    this._dirtyNodes = [];
    for (i = 0, len = dirtyNodes.length; i < len; ++i) {
      try {
        if (!dirtyNodes[i]._deleted) {
          dirtyNodes[i].update();
        }
      } catch (e) {
        console.error(e, e.stack);
      }
    }

    //make a new reference and reset array in case new callbacks are scheduled
    //by the current callbacks
    var callbacks = this.callbacksAfterUpdate;
    this.callbacksAfterUpdate = [];
    for (i = 0, len = callbacks.length; i < len; i++) {
      try {
        callbacks[i]();
      } catch (e) {
        console.error(e);
      }
    }

    loop = this.callbacksAfterUpdate.length > 0 || this._dirtyNodes.length > 0;
    iterations++;
  }

  this.isUpdating = false;
};

NodeContext.prototype.update = function () {
  this.frameNumber++;

  this.updateDirtyNodes();

  if (this.timerScheduler.hasPendingTimers()) {
    this.scheduleUpdate();
    this.timerScheduler.runTimers(this.currentFrameTime);
  }

  if (this.debugInspectorsEnabled) {
    this.sendDebugInspectorValues();
  }
};

NodeContext.prototype.reset = function () {
  //removes listeners like device orientation, websockets and more
  this.eventEmitter.emit('applicationDataReloaded');

  var eventEmitter = this.eventEmitter;
  ['frameStart', 'frameEnd'].forEach(function (name) {
    eventEmitter.removeAllListeners(name);
  });

  this.globalValues = {};
  this._dirtyNodes.length = 0;
  this.callbacksAfterUpdate.length = 0;

  this.timerScheduler.runningTimers = [];
  this.timerScheduler.newTimers = [];
  this.rootComponent = undefined;

  this.clearDebugInspectors();
  // OBS-001: a preview reload starts a new session. Events from the graph that just went away
  // reference node ids the next dictionary may not contain, so keeping them would produce a
  // walk that silently mixes two graphs.
  this.clearTrace();
};

NodeContext.prototype.nodeIsDirty = function (node) {
  this._dirtyNodes.push(node);
  this.scheduleUpdate();
};

NodeContext.prototype.scheduleUpdate = function () {
  this.eventEmitter.emit('scheduleUpdate');
};

NodeContext.prototype.scheduleAfterUpdate = function (func) {
  this.callbacksAfterUpdate.push(func);
  this.scheduleUpdate();
};

NodeContext.prototype.scheduleNextFrame = function (func) {
  this.eventEmitter.once('frameStart', func);
  this.scheduleUpdate();
};

NodeContext.prototype.setGlobalValue = function (name, value) {
  this.globalValues[name] = value;
  this.globalsEventEmitter.emit(name);
};

NodeContext.prototype.getGlobalValue = function (name) {
  return this.globalValues[name];
};

NodeContext.prototype.registerComponentModel = function (componentModel) {
  if (this.componentModels.hasOwnProperty(componentModel.name)) {
    throw new Error('Duplicate component name ' + componentModel.name);
  }
  this.componentModels[componentModel.name] = componentModel;

  var self = this;
  componentModel.on(
    'renamed',
    function (event) {
      delete self.componentModels[event.oldName];
      self.componentModels[event.newName] = componentModel;
    },
    this
  );
};

NodeContext.prototype.deregisterComponentModel = function (componentModel) {
  if (this.componentModels.hasOwnProperty(componentModel.name)) {
    this.componentModels[componentModel.name].removeListenersWithRef(this);
    delete this.componentModels[componentModel.name];
  }
};

NodeContext.prototype.fetchComponentBundle = async function (name) {
  const fetchBundle = async (name) => {
    let baseUrl = Noodl.Env["BaseUrl"] || '/';
    let bundleUrl = `${baseUrl}noodl_bundles/${name}.json`;

    const response = await fetch(bundleUrl);
    if (response.status === 404) {
      throw new Error('Component not found ' + name);
    }

    const data = await response.json();
    for (const component of data) {
      if (this.graphModel.hasComponentWithName(component.name) === false) {
        await this.graphModel.importComponentFromEditorData(component);
      }
    }
  };

  if (this.bundleFetchesInFlight.has(name)) {
    await this.bundleFetchesInFlight.get(name);
  } else {
    const promise = fetchBundle(name);
    this.bundleFetchesInFlight.set(name, promise);
    await promise;
    //the promise is kept in bundleFetchesInFlight to mark what bundles have been downloaded
    //so eventual future requests will just await the resolved promise and resolve immediately
  }
};

NodeContext.prototype.getComponentModel = async function (name) {
  if (!name) {
    throw new Error('Component instance must have a name');
  }

  if (this.componentModels.hasOwnProperty(name) === false) {
    const bundleName = this.graphModel.getBundleContainingComponent(name);
    if (!bundleName) {
      throw new Error("Can't find component model for " + name);
    }

    //start fetching dependencies in the background
    for (const bundleDep of this.graphModel.getBundleDependencies(bundleName)) {
      this.fetchComponentBundle(bundleDep);
    }

    //and wait for the bundle that has the component we need
    await this.fetchComponentBundle(bundleName);
  }

  return this.componentModels[name];
};

NodeContext.prototype.hasComponentModelWithName = function (name) {
  return this.componentModels.hasOwnProperty(name);
};

NodeContext.prototype.createComponentInstanceNode = async function (componentName, id, nodeScope, extraProps) {
  var ComponentInstanceNode = require('./nodes/componentinstance');
  var node = new ComponentInstanceNode(this, id, nodeScope);
  node.name = componentName;

  for (const prop in extraProps) {
    node[prop] = extraProps[prop];
  }

  const componentModel = await this.getComponentModel(componentName);
  await node.setComponentModel(componentModel);

  return node;
};

NodeContext.prototype._formatConnectionValue = function (value) {
  if (typeof value === 'object' && value && value.constructor && value.constructor.name === 'Node') {
    value = '<Node> ' + value.name;
  } else if (typeof value === 'object' && typeof window !== 'undefined' && value instanceof HTMLElement) {
    value = `DOM Node <${value.tagName}>`;
  } else if (typeof value === 'string' && !value.startsWith('[Signal]')) {
    return '"' + value + '"';
  } else if (Number.isNaN(value)) {
    return 'NaN';
  }

  return value;
};

NodeContext.prototype.connectionSentValue = function (output, value) {
  if (!this.editorConnection || !this.editorConnection.isConnected() || !this.debugInspectorsEnabled) {
    return;
  }

  const timestamp = this.getCurrentTime();

  this._outputHistory[output.id] = {
    value,
    timestamp
  };

  if (this.connectionsToPulse.hasOwnProperty(output.id)) {
    this.connectionsToPulse[output.id].timestamp = timestamp;
    return;
  }

  const connections = [];

  output.connections.forEach((connection) => {
    connections.push(output.owner.id + output.name + connection.node.id + connection.inputPortName);
  });

  this.connectionsToPulse[output.id] = {
    timestamp,
    connections: connections
  };

  this.connectionsToPulseChanged = true;

  if (this.connectionPulsingCallbackScheduled === false) {
    this.connectionPulsingCallbackScheduled = true;
    setTimeout(this.clearOldConnectionPulsing.bind(this), 100);
  }
};

NodeContext.prototype.connectionSentSignal = function (output) {
  const id = output.id;
  if (!this._signalHistory.hasOwnProperty(id)) {
    this._signalHistory[id] = {
      count: 0
    };
  }

  this._signalHistory[id].count++;

  this.connectionSentValue(output, '[Signal] Trigger count ' + this._signalHistory[id].count);
};

NodeContext.prototype.clearDebugInspectors = function () {
  this.debugInspectors = {};
  this.connectionsToPulse = {};

  this.editorConnection.sendPulsingConnections(this.connectionsToPulse);
};

NodeContext.prototype.clearOldConnectionPulsing = function () {
  this.connectionPulsingCallbackScheduled = false;

  var now = this.getCurrentTime();
  var self = this;

  var connectionIds = Object.keys(this.connectionsToPulse);
  connectionIds.forEach(function (id) {
    var con = self.connectionsToPulse[id];
    if (now - con.timestamp > 100) {
      self.connectionsToPulseChanged = true;
      delete self.connectionsToPulse[id];
    }
  });

  if (this.connectionsToPulseChanged) {
    this.connectionsToPulseChanged = false;
    this.editorConnection.sendPulsingConnections(this.connectionsToPulse);
  }

  if (Object.keys(this.connectionsToPulse).length > 0) {
    this.connectionPulsingCallbackScheduled = true;
    setTimeout(this.clearOldConnectionPulsing.bind(this), 500);
  }
};

NodeContext.prototype._getDebugInspectorValueForNode = function (id) {
  if (!this.rootComponent) return;
  const nodes = this.rootComponent.nodeScope.getNodesWithIdRecursive(id);
  const node = nodes[nodes.length - 1];

  if (node && node.getInspectInfo) {
    const info = node.getInspectInfo();
    if (info !== undefined) {
      return { type: 'node', id, value: info };
    }
  }
};

NodeContext.prototype.sendDebugInspectorValues = function () {
  const valuesToSend = [];

  for (const id in this.debugInspectors) {
    const inspector = this.debugInspectors[id];

    if (inspector.type === 'connection' && this._outputHistory.hasOwnProperty(id)) {
      const value = this._outputHistory[id].value;

      valuesToSend.push({
        type: 'connection',
        id,
        value: this._formatConnectionValue(value)
      });
    } else if (inspector.type === 'node') {
      const inspectorValue = this._getDebugInspectorValueForNode(id);
      inspectorValue && valuesToSend.push(inspectorValue);
    }
  }

  if (valuesToSend.length > 0) {
    this.editorConnection.sendDebugInspectorValues(valuesToSend);
  }

  if (this.connectionsToPulseChanged) {
    this.connectionsToPulseChanged = false;
    this.editorConnection.sendPulsingConnections(this.connectionsToPulse);
  }
};

NodeContext.prototype.setDebugInspectorsEnabled = function (enabled) {
  this.debugInspectorsEnabled = enabled;
  this.editorConnection.debugInspectorsEnabled = enabled;
  if (enabled) {
    this.sendDebugInspectorValues();
  }
};

/**
 * Turn the per-edge trace on or off, for one owner (OBS-001, HUD-004).
 *
 * Independent of `setDebugInspectorsEnabled` on purpose — the two answer different questions
 * and the editor turns them on from different surfaces.
 *
 * ⚠️ **Ownership is a set, and capture is "the set is non-empty".** This switch has two peers —
 * the editor's Record button and `nodegx-observe`'s `start_trace` — and the message that carried
 * it had no identity in it at all. Two things followed, both real and both hit by accident:
 *
 *  1. an agent's `stop_trace` disarmed a human's recording, with no signal anywhere; and
 *  2. an agent's `start_trace` **destroyed** it, because arming replaced the buffer
 *     unconditionally. That one is data loss, not confusion, and it is what this set is for.
 *
 * So the buffer is created only on **empty→non-empty** and dropped only on **non-empty→empty**.
 * A second owner arming into a live trace joins it and changes nothing; the first owner leaving
 * while a second is still there stops nothing.
 *
 * ⚠️ **An `owner` of `undefined` maps to one legacy key**, so a peer that has not been updated
 * behaves exactly as it always did — including the old "last message wins" feel, which is the
 * correct behaviour for a single anonymous peer and the only thing it can be given for two.
 */
const ANONYMOUS_TRACE_OWNER = '(anonymous)';

NodeContext.prototype.setTraceEnabled = function (enabled, owner) {
  if (!this._traceOwners) this._traceOwners = new Set();

  const key = typeof owner === 'string' && owner.length > 0 ? owner : ANONYMOUS_TRACE_OWNER;
  const was = this._traceOwners.size > 0;

  if (enabled) this._traceOwners.add(key);
  else this._traceOwners.delete(key);

  const now = this._traceOwners.size > 0;
  // Nothing crossed the boundary: somebody joined a trace already running, or left one somebody
  // else is still holding. Returning here is the whole fix — this is where the buffer used to be
  // thrown away under a recording that was still going.
  if (now === was) return;

  this.traceEnabled = now;

  if (now) {
    // Starting a trace clears whatever the last one left, so a recording always begins empty.
    this._traceBuffer = new TraceBuffer();
    this._currentCause = 0;
    if (this.editorConnection && this.editorConnection.sendTraceDictionary) {
      this.editorConnection.sendTraceDictionary(this.buildSessionDictionary());
    }
  } else {
    // Drop the storage rather than merely stopping writes.
    this._traceBuffer = undefined;
    this._currentCause = 0;
  }
};

/**
 * A traced peer went away without disarming — HUD-004 slice 3.
 *
 * An agent whose process is killed mid-trace holds its ownership forever otherwise, and the
 * human's Stop then appears not to work: the set never empties, so capture never stops. Same
 * class as FH-011's "a project switch leaves the runtime tracing forever", and the relay is the
 * only party that knows a socket has gone.
 *
 * ⚠️ Only ever called with a real peer id. An empty one would map to the anonymous key and
 * disarm a legacy peer that is still very much there.
 */
NodeContext.prototype.releaseTraceOwner = function (owner) {
  if (typeof owner !== 'string' || owner.length === 0) return;
  this.setTraceEnabled(false, owner);
};

/**
 * Who is tracing, and how far the buffer has got — HUD-004 slice 4.
 *
 * ⚠️ **`highestSeq` is why this exists at all**, more than `owners` is. Arming used to clear the
 * runtime's buffer, so the editor could safely start reading from `seq 0`. It no longer does, so
 * a peer that arms into a trace somebody else started would otherwise pull that peer's history
 * on its first poll and present it as what the user had just recorded.
 */
NodeContext.prototype.getTraceState = function () {
  return {
    enabled: !!this.traceEnabled,
    owners: this._traceOwners ? Array.from(this._traceOwners) : [],
    // `peekNextSeq` is the seq the *next* push will take, so the last one assigned is one below.
    // Zero with no buffer, which is what a fresh recording should start from.
    highestSeq: this._traceBuffer ? this._traceBuffer.peekNextSeq() - 1 : 0
  };
};

/**
 * Record one value or signal crossing one edge, and return the `seq` assigned to it.
 *
 * The caller hands that seq to the receiving node, which carries it until it processes that
 * input — see `Node.queueInput` / `Node.update`. That is what makes `cause` exact rather than
 * "whatever fired most recently": delivery in this runtime is **queued, not a call stack**
 * (`OutputProperty.sendValue` pushes into `_inputValuesQueue` and the target drains it later
 * in its own update), so a call-stack-based cause would attribute an entire frame's cascade
 * to whatever happened to be on the stack.
 */
NodeContext.prototype.traceEdgeSend = function (fromNode, fromPort, toNode, toPort, value, kind) {
  if (!this.traceEnabled || !this._traceBuffer) return 0;

  return this._traceBuffer.push(
    this.getCurrentTime(),
    this._currentCause,
    fromNode,
    fromPort,
    toNode,
    toPort,
    previewValue(value, this._traceValueCap),
    kind
  );
};

/**
 * Ids to names, types, components, plus the connection topology.
 *
 * ⚠️ The edge list is load-bearing, not a nicety. OBS-002's backward walk and OBS-004's agent
 * both need to know what *should* be connected in order to diff it against what actually
 * fired — a wire that never fired has no event, so its absence is only meaningful against a
 * declared topology. Shipping it here is also what lets a consumer render a chain with real
 * node names and **no project access**.
 */
NodeContext.prototype.buildSessionDictionary = function () {
  const dictionary: SessionDictionary = { nodes: {}, edges: [] };
  if (!this.rootComponent) return dictionary;

  const nodes = this.rootComponent.nodeScope.getAllNodesRecursive();

  for (const node of nodes) {
    let component = '';
    try {
      component = (node.nodeScope && node.nodeScope.componentOwner && node.nodeScope.componentOwner.name) || '';
    } catch (e) {
      /* provenance is best-effort; the entry is still useful with an id and a type */
    }

    dictionary.nodes[node.id] = {
      name: node.name || '',
      type: (node.model && node.model.type) || node.name || '',
      component
    };

    // Topology comes off the output ports, which is where the runtime actually holds it —
    // `_inputConnections` on the receiving side is the same edges seen from the other end.
    if (node._outputList) {
      for (const output of node._outputList) {
        for (const connection of output.connections) {
          dictionary.edges.push({
            from: { node: node.id, port: output.name },
            to: { node: connection.node.id, port: connection.inputPortName }
          });
        }
      }
    }
  }

  return dictionary;
};

/**
 * Read the *current* value of a batch of ports (OBS-002 layer 1).
 *
 * ⚠️ **Deliberately not `_outputHistory`.** That map records what was sent, and only while
 * `debugInspectorsEnabled` was true — so on an app that booted with debugging off it is empty,
 * and a walk over it would show every hop as blank until the user reproduced the bug. The
 * whole point of layer 1 is that it answers *"why is this label X?"* on a cold editor with
 * nothing fired, so it has to read the ports rather than a log of past sends.
 *
 * An output port holds no value of its own — `OutputProperty#value` calls the owner's getter
 * on every read — which is what makes a genuinely current read possible at all.
 *
 * ⚠️ Every read is individually guarded. A getter is arbitrary node code that can throw, and a
 * single bad node must not blank the other nine rows of a walk, let alone take down the app it
 * is being used to debug.
 */
NodeContext.prototype.getPortValues = function (ports) {
  const out = [];
  if (!Array.isArray(ports) || !this.rootComponent) return out;

  const byId = {};
  for (const node of this.rootComponent.nodeScope.getAllNodesRecursive()) {
    byId[node.id] = node;
  }

  for (const ref of ports) {
    if (!ref || typeof ref.node !== 'string' || typeof ref.port !== 'string') continue;
    const node = byId[ref.node];
    const entry = { node: ref.node, port: ref.port, direction: ref.direction, exists: false, value: undefined };

    if (node) {
      try {
        if (ref.direction === 'output') {
          if (node.hasOutput(ref.port)) {
            entry.exists = true;
            entry.value = previewValue(node.getOutput(ref.port).value, this._traceValueCap);
          }
        } else if (node.hasInput(ref.port)) {
          entry.exists = true;
          entry.value = previewValue(node.getInputValue(ref.port), this._traceValueCap);
        }
      } catch (e) {
        entry.value = '<unreadable>';
      }
    }

    out.push(entry);
  }

  return out;
};

/**
 * LGC-002 — evaluate one Blockly block's generated fragment on the node that owns it.
 *
 * The node lookup is `getPortValues`' — the same walk of the live scope, for the same reason:
 * this has to answer about the app as it is now, not about a model of it.
 *
 * ⚠️ **Everything here is guarded and nothing here throws.** The caller is a socket message
 * handler; a throw would take the whole editor channel down, and the thing that would take it
 * down is a diagnostic the user reached for because something was already wrong.
 *
 * ⚠️ **A node that is not a Logic Builder is refused by capability, not by type name.** The
 * type id `'Logic Builder'` is frozen and could be checked, but `_probeFragment` is the actual
 * contract and checking for it means the day a second node hosts blocks, this works.
 */
NodeContext.prototype.evaluateBlockFragment = function (requestId, nodeId, code) {
  const reply = { requestId: requestId, nodeId: nodeId, found: false };

  if (typeof nodeId !== 'string' || !this.rootComponent) return reply;

  let node;
  for (const candidate of this.rootComponent.nodeScope.getAllNodesRecursive()) {
    if (candidate.id === nodeId) {
      node = candidate;
      break;
    }
  }

  if (!node || typeof node._probeFragment !== 'function') return reply;

  reply.found = true;

  try {
    return Object.assign(reply, node._probeFragment(typeof code === 'string' ? code : ''));
  } catch (e) {
    // `_probeFragment` already guards itself; this is the belt for the braces, because a
    // silent failure here is precisely the defect §4 of the task exists to stop repeating.
    return Object.assign(reply, {
      ok: false,
      errorPhase: 'run',
      error: 'The node could not evaluate this block: ' + (e && e.message ? e.message : String(e))
    });
  }
};

/**
 * Is this node in the live scope right now? LGC-003.
 *
 * The same walk `evaluateBlockFragment` does, named so both can use it and so the answer has
 * one definition. "The preview is running but this Logic Builder is not in it" is the most
 * common thing a builder hits, and it is not an error.
 */
NodeContext.prototype.hasNode = function (nodeId) {
  if (typeof nodeId !== 'string' || !this.rootComponent) return false;
  for (const candidate of this.rootComponent.nodeScope.getAllNodesRecursive()) {
    if (candidate.id === nodeId) return true;
  }
  return false;
};

/**
 * LGC-003 §1 — arm or disarm block-value recording for one Logic Builder node.
 *
 * ⚠️ **This is a different switch from `setTraceEnabled`, and that is the point.** The task's
 * own warning is that `start_trace` also *clears* the trace the editor's Provenance panel is
 * showing, and TALK-003 recorded a human losing an in-progress recording to exactly that.
 * HUD-004 made the shared switch survivable with an ownership set; this declines to join it at
 * all, which is strictly stronger: opening a block editor cannot clear a recording, cannot
 * change `traceEnabled`, cannot add an owner and cannot replace `_traceBuffer`, because it
 * touches none of them. `nodecontext.block-trace.test.ts` asserts every one of those by
 * identity rather than by reading the code.
 *
 * Per node, not per app: a builder watching one Visual Function should not make every other
 * one in the project allocate a map per run.
 */
NodeContext.prototype.setBlockTracing = function (nodeId, enabled) {
  if (typeof nodeId !== 'string' || nodeId === '') return;
  if (!this._blockTraceNodes) this._blockTraceNodes = new Set();

  if (enabled) this._blockTraceNodes.add(nodeId);
  else this._blockTraceNodes.delete(nodeId);
};

NodeContext.prototype.isBlockTracing = function (nodeId) {
  return !!this._blockTraceNodes && this._blockTraceNodes.has(nodeId);
};

/**
 * Start recording one run, or return `undefined` so the node uses the identity probes.
 *
 * ⚠️ **`undefined` is the hot path and it is one Set lookup.** Every Logic Builder run in every
 * app calls this. Returning a recorder that then throws its map away would be the shape that
 * looks tidier and costs an allocation per run per node, forever, for nobody.
 */
NodeContext.prototype.beginBlockRun = function (nodeId) {
  if (!this._blockTraceNodes || !this._blockTraceNodes.has(nodeId)) return undefined;
  return createBlockRunRecorder(this._traceValueCap);
};

/**
 * Send one run's map to the editor.
 *
 * ⚠️ **Batched, not unbatched** — the opposite of `sendBlockFragmentResult`, and for the
 * opposite reason. A Do It is a request a human is watching a balloon for, so 200 ms of
 * nothing reads as broken. This is a program on a frame clock pushing a frame per run, and the
 * relay's 200 ms coalescing is the first of the two places §5.3's "repaint on an animation
 * frame, not per value" is enforced. The second is the editor's `FramePaintScheduler`.
 */
NodeContext.prototype.endBlockRun = function (nodeId, recorder) {
  if (!recorder) return;

  this._blockRunSeq = (this._blockRunSeq || 0) + 1;
  // `getCurrentTime` goes through the platform clock, which a context built without a platform
  // does not have. The frame's `t` labels the scrubber and nothing else reads it, so a wall
  // clock is a correct answer for it — and throwing here would cost the whole frame.
  const now = this.platform ? this.getCurrentTime() : Date.now();
  const frame = recorder.take(nodeId, this._blockRunSeq, now);

  if (this.editorConnection && typeof this.editorConnection.sendBlockValues === 'function') {
    this.editorConnection.sendBlockValues(frame);
  }
};

NodeContext.prototype.getTraceEvents = function (afterSeq) {
  if (!this._traceBuffer) return [];
  return afterSeq === undefined ? this._traceBuffer.toArray() : this._traceBuffer.since(afterSeq);
};

NodeContext.prototype.clearTrace = function () {
  if (this._traceBuffer) this._traceBuffer.clear();
  this._currentCause = 0;
};

NodeContext.prototype.sendGlobalEventFromEventSender = function (channelName, inputValues) {
  this.eventSenderEmitter.emit(channelName, inputValues);
};

NodeContext.prototype.setPopupCallbacks = function ({ onShow, onClose }) {
  this.onShowPopup = onShow;
  this.onClosePopup = onClose;
};

/**
 * Close every popup currently open, telling each one why.
 *
 * `dismiss` is the *implicit* path — a popup going away because another one replaced it,
 * not because anything in its graph asked it to. It is reported separately from a real
 * close for that reason: an author's `Closed` branch means "the user finished with this
 * dialog", and firing it for a popup that was superseded (or that never got as far as being
 * drawn) would run a save-or-commit branch for an interaction that did not happen.
 */
NodeContext.prototype._dismissOpenPopups = function () {
  // Copy: each `dismiss` splices the entry it owns out of `popupStack`.
  const open = this.popupStack.slice();
  for (const entry of open) {
    entry.dismiss();
  }
};

/**
 * Show a popup, subject to the stack policy.
 *
 * **The policy exists because there was none.** `scheduleShow` coalesces repeated pulses
 * within one Show Popup node and that was the whole of the de-duplication: two Show Popup
 * nodes pulsed in the same frame — a button and a keyboard shortcut, say — each landed here
 * and the user got two identical dialogs stacked, each with its own close callback. NDA-010
 * §3 settles it as **one modal slot by default** (`args.stackPolicy === 'replace'`), with
 * `'stack'` as an explicit per-node opt-in for the cases that really do layer, such as a
 * confirmation over an open editor.
 *
 * The slot is claimed **synchronously**, before the first `await`. Two calls in one update
 * pass both run to that point before either resumes, so a check made after `createNode` would
 * see an empty stack in both and stack them anyway — the exact defect, moved.
 */
NodeContext.prototype.showPopup = async function (popupComponent, params, args) {
  if (!this.onShowPopup) return;

  const nodeScope = this.rootComponent.nodeScope;

  const entry = {
    group: undefined,
    dismissed: false,
    dismiss: () => {
      if (entry.dismissed) return;
      entry.dismissed = true;

      const index = this.popupStack.indexOf(entry);
      if (index !== -1) this.popupStack.splice(index, 1);

      // A popup dismissed before its group reached the viewer was never drawn; there is
      // nothing to tear down but the node, and that is handled where the await resumes.
      if (entry.group) {
        this.onClosePopup(entry.group);
        nodeScope.deleteNode(entry.group);
      }

      args && args.onDismissPopup && args.onDismissPopup();
    }
  };

  if ((args?.stackPolicy ?? 'replace') === 'replace') {
    this._dismissOpenPopups();
  }
  this.popupStack.push(entry);

  const popupNode = await nodeScope.createNode(popupComponent);

  if (entry.dismissed) {
    // Replaced while this one was still being built. Nothing was shown, so nothing is
    // closed — but the node exists and would otherwise leak, along with everything its
    // component scope created.
    nodeScope.deleteNode(popupNode);
    return;
  }
  for (const inputKey in params) {
    popupNode.setInputValue(inputKey, params[inputKey]);
  }

  popupNode.popupParent = args?.senderNode || null;

  // Create container group
  const group = nodeScope.createPrimitiveNode('Group');
  group.setInputValue('flexDirection', 'node');
  group.setInputValue('cssClassName', 'noodl-popup');

  const bodyScroll = this.graphModel.getSettings().bodyScroll;

  //if the body can scroll the position of the popup needs to be fixed.
  group.setInputValue('position', bodyScroll ? 'fixed' : 'absolute');

  // NDA-010 §2 / NDA-015: closing a popup is *pull*, not only push.
  //
  // This used to hand the close callback to `getNodesWithType('NavigationClosePopup')` on
  // the popup's own scope and nothing else, so a Close Popup node one component deeper
  // inside the popup was never given one and silently did nothing. That is the reported
  // "very hard to find the right place to put the close popup node so that it actually
  // works": whether the node worked depended on which scope it happened to sit in, with no
  // indication either way.
  //
  // The handler is now published on the popup's component instance as well, where
  // `closepopup.ts` finds it by walking up (`componentwalk.ts`) from wherever it sits. The
  // push is kept for the nodes that already had it — identical behaviour, no reliance on
  // walk ordering for graphs that work today — and the pull is the fallback.
  const closeHandler = (action, results) => {
    //close next frame so all nodes have a chance to update before being deleted
    this.scheduleNextFrame(() => {
      //avoid double callbacks
      if (!nodeScope.hasNodeWithId(group.id)) return;

      // This popup is closing on its own terms, so it leaves the stack without being
      // dismissed — `entry.dismissed` marks it spoken-for so a later replace does not also
      // report it as superseded.
      entry.dismissed = true;
      const index = this.popupStack.indexOf(entry);
      if (index !== -1) this.popupStack.splice(index, 1);

      this.onClosePopup(group);
      nodeScope.deleteNode(group);
      args && args.onClosePopup && args.onClosePopup(action, results);
    });
  };

  // Read by `closepopup.ts`'s upward walk. Set unconditionally: a popup whose only Close
  // Popup node sits in a nested component used to get no handler at all, because the
  // registration below never ran.
  popupNode._popupCloseHandler = closeHandler;

  var closePopupNodes = popupNode.nodeScope.getNodesWithType('NavigationClosePopup');
  if (closePopupNodes && closePopupNodes.length > 0) {
    for (var j = 0; j < closePopupNodes.length; j++) {
      closePopupNodes[j]._setCloseCallback(closeHandler);
    }
  }

  entry.group = group;
  this.onShowPopup(group);

  requestAnimationFrame(() => {
    //hack to make the react components have the right props
    //TODO: figure out why this requestAnimationFrame is necessary
    group.addChild(popupNode);
  });
};

NodeContext.prototype.setWarningTypes = function (warningTypes) {
  Object.assign(this.warningTypes, warningTypes);
};

NodeContext.prototype.isWarningTypeEnabled = function (warning) {
  if (!this.warningTypes.hasOwnProperty(warning)) {
    //if a level isn't set, default to true
    return true;
  }

  return this.warningTypes[warning] ? true : false;
};

NodeContext.prototype.getDefaultValueForInput = function (nodeType, inputName) {
  if (this.nodeRegister.hasNode(nodeType) === false) {
    return undefined;
  }

  const nodeMetadata = this.nodeRegister.getNodeMetadata(nodeType);
  const inputMetadata = nodeMetadata.inputs[inputName];

  if (!inputMetadata) {
    return undefined;
  }

  if (inputMetadata.type.defaultUnit) {
    return {
      value: inputMetadata.default,
      unit: inputMetadata.type.defaultUnit
    };
  }

  return inputMetadata.default;
};

export = NodeContext;
