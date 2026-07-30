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
import Variants = require('./variants');

/** Set by the viewer before any node runs; carries deploy-time environment values. */
declare const Noodl: { Env: Record<string, string> };

/** A value the editor is showing live, either on a connection or in a node inspector. */
interface DebugInspector {
  type: 'connection' | 'node';
  id?: string;
  nodeId?: string;
  connection?: { fromId: string; fromProperty: string };
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
  this.errorBus = new RuntimeErrorBus();
  if (this.editorConnection) {
    this.errorBus.subscribe(createEditorWarningSubscriber(this.editorConnection));
  } else {
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
  }
} as unknown as NodeContextConstructor;

NodeContext.prototype.setRootComponent = function (rootComponent) {
  this.rootComponent = rootComponent;
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
