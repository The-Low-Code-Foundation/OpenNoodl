/**
 * Contracts the core runtime files share with each other but that are *not* part of the
 * node-definition API a node author writes against.
 *
 * `@noodl/types` publishes the authored surface — what `defineNode` accepts and what a
 * node's own callbacks may call. This file describes the underscore-prefixed machinery
 * `node.ts`, `outputproperty.ts`, `nodecontext.ts` and `nodescope.ts` use to talk to one
 * another. Keeping the two apart is deliberate: publishing these would invite node authors
 * to depend on internals that exist to be changed.
 */

import type {
  EditorConnectionLike,
  InputPortDefinition,
  NodeInstance,
  NodeVariant,
  RuntimeEventEmitter,
  StylesLike,
  TimerScheduler
} from '@noodl/types';

import type { RuntimeErrorBus } from './runtimeerror';

/**
 * The editor channel as the runtime core uses it.
 *
 * {@link EditorConnectionLike} publishes only what a node definition may call; this adds
 * the debugging and lifecycle surface the context drives — connection-value history,
 * pulsing connections and inspector values all flow through here.
 */
export interface RuntimeEditorConnection extends EditorConnectionLike {
  clientId?: string;
  debugInspectorsEnabled?: boolean;

  /**
   * `'browser'` or `'cloud'` — `NoodlRuntime.type`, forwarded at construction. Read when
   * choosing the error channel's default subscribers: a deployed cloud function reports
   * `runningInEditor: true` (it never passes `runDeployed`) yet has no editor to report to.
   */
  runtimeType?: string;

  isConnected(): boolean;
  on(eventName: string, callback: (data: any) => void): void;
  sendConnectionValue(connectionId: string, value: unknown): void;
  sendPulsingConnections(connections: unknown): void;
  sendDebugInspectorValues(values: unknown[]): void;
}

/**
 * The node context as the core sees it — the scheduler and editor channel the published
 * {@link NodeContextLike} deliberately hides from node authors.
 */
export interface RuntimeNodeContext {
  editorConnection?: RuntimeEditorConnection;

  /**
   * The runtime error channel. Present in every context, editor or not — that is the whole
   * point of it. See `dev-docs/reference/FAILURE-CONTRACT.md`; nodes raise through
   * `Node.raiseRuntimeError` rather than touching this directly.
   */
  errorBus: RuntimeErrorBus;
  /** Supplied by the viewer, which owns the implementation; absent in the cloud runtime. */
  styles?: StylesLike;

  /** Monotonic counter used to scope cyclic-loop detection to a single update pass. */
  updateIteration: number;

  nodeIsDirty(node: RuntimeNode): void;
  scheduleNextFrame(callback: () => void): void;
  /** Opens a popup component in the viewer's popup layer; resolves immediately without one. See `nodecontext.ts`. */
  showPopup(popupComponent: string, params: Record<string, unknown>, args?: unknown): Promise<void>;
  /** Runs `callback` once the current update has finished processing every dirty node. */
  scheduleAfterUpdate(callback: () => void): void;
  /** Flushes the dirty-node queue synchronously. DOM event handlers call this so a
   * click takes effect without waiting for the next scheduled frame. See `nodecontext.ts`. */
  updateDirtyNodes(): void;
  connectionSentValue(sourcePort: RuntimeOutputProperty, value: unknown): void;
  connectionSentSignal(sourcePort: RuntimeOutputProperty): void;
  isWarningTypeEnabled(warningType: string): boolean;
  getDefaultValueForInput(nodeType: string, inputName: string): unknown;

  /** The node-type table. See `noderegister.ts`. */
  nodeRegister: any;
  /** Shared parameter sets. See `variants.ts`. */
  variants: any;
  /** The frame-driven timer service. See `timerscheduler.js`. */
  timerScheduler: TimerScheduler;
  /** Broadcasts an Event Sender's payload to every receiver in the project. */
  sendGlobalEventFromEventSender(channelName: string, inputValues: unknown): void;
  /** Runtime lifecycle events. See `nodecontext.ts`. */
  eventEmitter: RuntimeEventEmitter;
  /** The Event Sender / Event Receiver channel bus. */
  eventSenderEmitter: RuntimeEventEmitter;

  /**
   * Builds an instance of a *component* rather than a registered node type. Lives on the
   * context because the implementation is framework-specific and ships with the viewer.
   */
  createComponentInstanceNode(
    name: string,
    id: string,
    nodeScope: any,
    extraProps?: Record<string, unknown>
  ): Promise<any>;
  hasComponentModelWithName(name: string): boolean;

  /** Project-wide values behind the deprecated Globals node. See `nodecontext.ts`. */
  globalValues: Record<string, unknown>;
  /** One event per global *name*. See `nodecontext.ts`. */
  globalsEventEmitter: RuntimeEventEmitter;
  setGlobalValue(name: string, value: unknown): void;
  getGlobalValue(name: string): unknown;

  [extra: string]: unknown;
}

/** A source port plus the input it feeds, as recorded on {@link RuntimeOutputProperty}. */
export interface OutputConnection {
  node: RuntimeNode;
  inputPortName: string;
}

/** The runtime view of an output port. See `outputproperty.ts`. */
export interface RuntimeOutputProperty {
  readonly name: string;
  readonly id: string;
  readonly value: unknown;
  getter: (this: RuntimeNode) => unknown;
  owner: RuntimeNode;
  /** The port's declared type, used to scope the object/array -> string typecast (NDA-014). */
  type?: unknown;
  connections: OutputConnection[];
  onFirstConnectionAdded?: (this: RuntimeNode) => void;
  onLastConnectionRemoved?: (this: RuntimeNode) => void;

  registerConnection(node: RuntimeNode, inputPortName: string): void;
  deregisterConnection(node: RuntimeNode, inputPortName: string): void;
  flagDependeesDirty(): void;
  sendValue(value: unknown): void;
  /** Sends a signal as one queue entry per receiver. See `SIGNAL_PULSE` in node.ts. */
  sendPulse(): void;
  hasConnections(): boolean;

  /** Cyclic-loop bookkeeping; see the 500-values-per-iteration guard in `sendValue`. */
  _lastUpdateIteration?: number;
  valuesSendThisIteration?: number;
  _id?: string;
}

/** A live expression binding on an input port. See `Node._evaluateExpressionParameter`. */
export interface ExpressionSubscription {
  unsub: () => void;
  expression: string;
}

/**
 * A node as the runtime sees it: the published {@link NodeInstance} surface plus the
 * internal state the scheduler, connections and dirty-flagging depend on.
 */
export interface RuntimeNode extends NodeInstance {
  /** Mutable here, read-only on the published surface: only the constructor assigns it. */
  id: string;
  name: string;
  model?: any;
  variant?: NodeVariant;
  nodeScope: any;
  context: RuntimeNodeContext;

  _dirty: boolean;
  _inputs: Record<string, InputPortDefinition>;
  _inputValues: Record<string, unknown>;
  _outputs: Record<string, RuntimeOutputProperty>;
  _inputConnections: Record<string, RuntimeOutputProperty[]>;
  _outputList: RuntimeOutputProperty[];
  _isUpdating: boolean;
  _inputValuesQueue: Record<string, unknown[]>;
  _afterInputsHaveUpdatedCallbacks: Array<(this: RuntimeNode) => void>;
  _signalsSentThisUpdate: Record<string, boolean>;
  _deleted: boolean;
  _deleteListeners: Array<(this: RuntimeNode) => void>;
  _isFirstUpdate: boolean;
  _valuesFromConnections: Record<string, unknown>;
  _expressionSubscriptions: Record<string, ExpressionSubscription>;
  /** NDA-017 §2. Deliberate answers only; absent reads as ticked. */
  _runOnValueChange: Record<string, boolean>;

  /**
   * Set false by the node scope while a component is being built, so nodes do not update
   * before every connection is in place. See `Node.flagDirty`.
   */
  updateOnDirtyFlagging: boolean;

  /** Iteration bookkeeping used to detect cyclic loops. */
  _updatedAtIteration?: number;
  _updateIteration?: number;
  _cyclicLoop?: boolean;
  _cyclicWarningSent?: boolean;
  /**
   * Which cycle breaker tripped — the 500-sends-per-iteration one in `outputproperty.ts` or
   * the 100-update-iterations one in `node.ts`. Carried as the `detail` of the raised
   * `runtime/cyclic-loop` error.
   */
  _cyclicLoopCause?: { limit: string; count: number; port?: string };

  /** Present only on visual nodes; see `_onNodeModelParameterUpdated`. */
  _getVisualStates?: () => string[];
  /** Present only on React-backed nodes. */
  _resetReactVirtualDOM?: () => void;

  /**
   * Set when the SSR server created this instance inert because its type is
   * classified `client-only` (see `makeNodeInert` in nodedefinition.ts).
   */
  _ssrDeferred?: boolean;
  /** Lifecycle hook installed on the prototype when the definition declares it. */
  nodeScopeDidInitialize?(): void;

  getOutput(name: string): RuntimeOutputProperty;
  setVariant?(variant: NodeVariant): void;

  /** Graph wiring. Called by the node scope as it builds a component, never by nodes. */
  connectInput(inputName: string, sourceNode: RuntimeNode, sourcePortName: string): void;
  removeInputConnection(inputName: string, sourceNodeId: string, sourcePortName: string): void;

  _evaluateExpressionParameter(paramValue: unknown, portName: string): unknown;
  _updateDependencies(): void;
  _performDirtyUpdate(): void;
  _setValueFromConnection(inputName: string, value: unknown, sourceType?: unknown): void;
  _setPulseFromConnection(inputName: string): void;
  _hasInputBeenSetFromAConnection(inputName: string): boolean;
  _onNodeDeleted(): void;
  _onNodeModelParameterUpdated(event: NodeModelParameterUpdatedEvent): void;
  _onNodeModelVariantUpdated(variant: NodeVariant): void;
  setNodeModel(nodeModel: any): void;
}

/**
 * The child-tree protocol that visual nodes implement.
 *
 * Kept here rather than in `@noodl/types` because it is not part of what a node *author*
 * writes — a node definition never implements these; the runtime and the renderer do. Two
 * things already implement it in full: `nodes/componentinstance.ts` in this package, and
 * `ReactNodeInstance` in `noodl-viewer-react/src/react-component-node.ts`, which declared
 * the same members locally before this existed. Naming it once is the §15.2 rule — a
 * second description of one object is how the two drift apart.
 *
 * Every member is optional on the *consuming* side in practice: a Component Instance may
 * hold roots that are not visual (the Repeater is the standard example), which is why the
 * call sites guard with `root.render && root.render()` rather than assuming presence.
 */
export interface RuntimeVisualNode extends RuntimeNode {
  parent?: RuntimeVisualNode;
  /** Memoised child list; set to `undefined` to force the parent to re-render children. */
  cachedChildren?: unknown;

  addChild(child: RuntimeVisualNode, index?: number): void;
  removeChild(child: RuntimeVisualNode): void;
  isChild(child: RuntimeVisualNode): boolean;
  getChildren(): RuntimeVisualNode[];
  contains?(node: RuntimeVisualNode): boolean;
  setChildIndex?(index: number): void;

  render?(): unknown;
  forceUpdate(): void;
  getRef?(): unknown;
  /** SSR: run the mount lifecycle after the server render has settled. */
  triggerDidMount?(): void;
}

/** Payload of the model's `parameterUpdated` event. */
export interface NodeModelParameterUpdatedEvent {
  name: string;
  value: unknown;
  /** Set when the parameter applies only in a particular visual state. */
  state?: string;
}
