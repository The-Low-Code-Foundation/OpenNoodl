/**
 * The node-definition API — the shape a node author must satisfy.
 *
 * These types describe the object passed to `NodeDefinition.defineNode(opts)` in
 * `@noodl/runtime` (`packages/noodl-runtime/src/nodedefinition.js`), and the compiled
 * definition it returns.
 *
 * ## Relationship to the node catalog (SUB-004)
 *
 * The catalog in `../node-catalog.d.ts` describes nodes *as observed*, after the runtime
 * has compiled every definition and the editor has been told about them. This file
 * describes the same nodes *as authored*. They are two views of one model and must not
 * drift, so the shared vocabulary lives in the catalog and is re-exported here:
 *
 * | Concept          | Authored (this file)      | Observed (catalog)          |
 * |------------------|---------------------------|-----------------------------|
 * | Port value type  | `PortTypeSpec`            | `PortType`                  |
 * | Input port       | `InputPortDefinition`     | `CatalogPort` (plug 'input')|
 * | Output port      | `OutputPortDefinition`    | `CatalogPort` (plug 'output')|
 * | Numbered inputs  | `NumberedInputDefinition` | `NumberedInputSpec`         |
 * | Dynamism         | see `DynamicPortMechanism` mapping below                |
 *
 * ## Dynamic ports
 *
 * A node's port set is not always static, and these types do not pretend otherwise.
 * Each of the catalog's `DynamicPortMechanism` values corresponds to something concrete
 * an author writes here:
 *
 * - `declared-port-groups` — {@link NodeDefinitionOptions.dynamicports}: groups of ports
 *   the editor shows or hides according to a `condition` string. The ports themselves are
 *   statically declared; only their *visibility* is dynamic.
 * - `numbered-inputs` — {@link NodeDefinitionOptions.numberedInputs}: the runtime
 *   synthesises `"<base> 0"`, `"<base> 1"`, … on demand by wrapping
 *   `registerInputIfNeeded`. The port *set* is genuinely unbounded.
 * - `component-ports` — {@link NodeDefinitionOptions.haveComponentPorts}: ports come from
 *   the component the node instantiates, so they are known only per project.
 * - `runtime-discovered` — the node overrides {@link NodeInstance.registerInputIfNeeded} /
 *   {@link NodeInstance.registerOutputIfNeeded} and/or pushes port sets to the editor via
 *   `editorConnection.sendDynamicPorts`. Function and Expression nodes work this way:
 *   the ports depend on user code or user text and cannot be known statically at all.
 * - `editor-adapter` — the port set is computed by editor-side code rather than by the
 *   node definition; nothing in this file describes it.
 *
 * Only the first is expressible as data. The rest are behaviour, so the honest type for a
 * dynamic node's port set is "the declared ports, plus more" — never a closed record.
 * Consumers that need the closed set must read the catalog, which records the mechanism.
 */

import { NodeCategory, NumberedInputSpec, PortType, PortTypeName } from '../node-catalog';

export { NodeCategory, NumberedInputSpec, PortType, PortTypeName };

/**
 * The value type of a port, as authored.
 *
 * Authors write either the bare name (`type: 'string'`) or an object when the type needs
 * configuration (`type: { name: 'enum', enums: [...] }`). Both forms reach the compiled
 * metadata unchanged, so consumers must handle both — see `isPortTypeName` usage patterns
 * in `nodelibraryexport.js`.
 */
export type PortTypeSpec = PortTypeName | (string & {}) | PortType;

/** Colour bucket the editor paints the node header with. */
export type NodeColorName = 'data' | 'visual' | 'logic' | 'component' | 'javascript' | (string & {});

/** How the editor truncates the label taken from `usePortAsLabel`. */
export type PortLabelTruncationMode = 'length' | 'path' | (string & {});

/**
 * `this` inside every author-supplied callback on a node definition.
 *
 * This is the runtime `Node` instance. It is declared structurally rather than imported
 * from `./node.d.ts` so that this file stays usable as documentation on its own; the
 * members here are the ones a node author is expected to call.
 */
export interface NodeInstance {
  readonly id: string;
  readonly name: string;

  /** Per-instance scratch space. Node definitions own this; the runtime never reads it. */
  _internal: Record<string, unknown>;

  context: NodeContextLike;
  nodeScope: NodeScopeLike;
  model?: unknown;

  // --- inputs -------------------------------------------------------------
  hasInput(name: string): boolean;
  getInput(name: string): InputPortDefinition | undefined;
  getInputValue(name: string): unknown;
  registerInput(name: string, input: InputPortDefinition): void;
  registerInputs(inputs: Record<string, InputPortDefinition>): void;
  deregisterInput(name: string): void;
  isInputConnected(inputName: string): boolean;
  queueInput(inputName: string, value: unknown): void;
  setInputValue(name: string, value: unknown): void;

  /**
   * Override to create inputs on demand. This is the `runtime-discovered` dynamic-port
   * mechanism: the base implementation is a no-op, and a node that overrides it is
   * declaring that its input set cannot be enumerated statically.
   */
  registerInputIfNeeded(name: string): void;

  // --- outputs ------------------------------------------------------------
  hasOutput(name: string): boolean;
  getOutput(name: string): OutputPropertyLike;
  registerOutput(name: string, output: OutputPortDefinition): void;
  registerOutputs(outputs: Record<string, OutputPortDefinition>): void;
  deregisterOutput(name: string): void;

  /** Output-side counterpart of {@link registerInputIfNeeded}. */
  registerOutputIfNeeded(name: string): void;

  sendValue(name: string, value: unknown): void;
  sendSignalOnOutput(outputName: string): void;
  flagOutputDirty(name: string): void;
  flagAllOutputsDirty(): void;

  // --- scheduling ---------------------------------------------------------
  flagDirty(): void;
  update(): void;
  scheduleAfterInputsHaveUpdated(callback: (this: NodeInstance) => void): void;
  addDeleteListener(listener: (this: NodeInstance) => void): void;
}

/** The subset of `NodeContext` node definitions actually reach for. */
export interface NodeContextLike {
  editorConnection?: EditorConnectionLike;
  /** Present in the browser viewer; absent in the cloud runtime. */
  styles?: unknown;
  [extra: string]: unknown;
}

/** The subset of `NodeScope` node definitions actually reach for. */
export interface NodeScopeLike {
  componentOwner: { name: string; [extra: string]: unknown };
  [extra: string]: unknown;
}

/** The editor channel, present only when running against a live editor. */
export interface EditorConnectionLike {
  isRunningLocally(): boolean;
  sendWarning(componentName: string, nodeId: string, key: string, warning: unknown): void;
  clearWarning(componentName: string, nodeId: string, key: string): void;
  /**
   * Replace the editor's idea of a node's ports. The `runtime-discovered` mechanism.
   */
  sendDynamicPorts(nodeId: string, ports: unknown[], options?: unknown): void;
  [extra: string]: unknown;
}

/** An output port at runtime, as handed back by {@link NodeInstance.getOutput}. */
export interface OutputPropertyLike {
  readonly name: string;
  readonly value: unknown;
  hasConnections(): boolean;
  sendValue(value: unknown): void;
}

/**
 * An input port, as authored.
 *
 * Exactly one of {@link set} and {@link valueChangedToTrue} is meaningful. A port with
 * `valueChangedToTrue` is a *signal* input: the runtime installs an edge-triggered setter
 * and forces `type` to `{ name: 'signal', allowConnectionsOnly: true }`, overriding
 * whatever `type` was declared.
 */
export interface InputPortDefinition {
  type?: PortTypeSpec;

  /** Receives the new value. `this` is the node instance. */
  set?(this: NodeInstance, value: any): void;

  /**
   * Marks the port as a signal. Called on every false → true transition, never on the
   * falling edge. Declaring this replaces `type` with the signal type.
   */
  valueChangedToTrue?(this: NodeInstance): void;

  /** Called when a unit-bearing value ({ value, unit }) changes unit. */
  setUnitType?(this: NodeInstance, unit: string): void;

  /** Value used when the project sets no parameter. Unit types wrap it as `{ value, unit }`. */
  default?: unknown;

  displayName?: string;
  /** Name shown in the property panel when it should differ from `displayName`. */
  editorName?: string;
  group?: string;
  /** Property-panel tab this port belongs to. */
  tab?: string;
  /** Property-panel popout group this port belongs to. */
  popout?: unknown;
  index?: number;
  tooltip?: string;
  /** Defaults to `true`. Set `false` to keep the port out of the editor entirely. */
  exportToEditor?: boolean;
  /** Higher priority inputs are applied first within one update. Defaults to `0`. */
  inputPriority?: number;
  /** Allows per-visual-state values (hover, pressed, …) for this port. */
  allowVisualStates?: boolean;
  nodeDoubleClickAction?: unknown;
  description?: string;
}

/**
 * An output port, as authored.
 *
 * `get` and `getter` are the same thing — `get` is the current spelling, `getter` the
 * historical one, and `nodedefinition.js` accepts either. Signal outputs (`type: 'signal'`)
 * need no getter: the runtime installs one that always returns `undefined`, because a
 * signal is emitted as a false/true pair rather than read.
 */
export interface OutputPortDefinition {
  type?: PortTypeSpec;

  /** Returns the current value. `this` is the node instance. */
  get?(this: NodeInstance): unknown;
  /** @deprecated Historical spelling of {@link get}; still honoured. */
  getter?(this: NodeInstance): unknown;

  /** Fired when the port goes from zero connections to one. `this` is the node instance. */
  onFirstConnectionAdded?(this: NodeInstance): void;
  /** Fired when the port's last connection is removed. `this` is the node instance. */
  onLastConnectionRemoved?(this: NodeInstance): void;

  displayName?: string;
  editorName?: string;
  group?: string;
  index?: number;
  /** Defaults to `true`. */
  exportToEditor?: boolean;
  description?: string;
}

/**
 * A family of inputs named `"<base> 0"`, `"<base> 1"`, … created on demand.
 *
 * This is the `numbered-inputs` dynamic-port mechanism. The runtime wraps
 * `registerInputIfNeeded` so any input whose name starts with the family's key is
 * synthesised on first use, and — when connected to an editor — recomputes the visible
 * port set from the node's parameters and connections whenever either changes.
 *
 * The port set is unbounded by construction. Do not type it as a closed record.
 */
export interface NumberedInputDefinition {
  type?: PortTypeSpec;
  /** Returns the setter for index `n`. Called with `this` bound to the node instance. */
  createSetter(this: NodeInstance, index: number): (this: NodeInstance, value: any) => void;
  /** Label prefix in the editor; defaults to the family's key. */
  displayPrefix?: string;
  group?: string;
  /** Index of `"<base> 0"`; later ports get `index + n`. */
  index?: number;
}

/**
 * A group of statically-declared ports the editor shows only when `condition` holds.
 *
 * This is the `declared-port-groups` mechanism — the only kind of dynamism that is pure
 * data. `condition` is the editor's own mini-language, e.g.
 * `'storeType = cloud OR storeType NOT SET'`.
 */
export interface ConditionalPortGroup {
  /** Defaults to `'conditionalports/basic'`. */
  name?: string;
  condition?: string;
  /** Names of ports declared in {@link NodeDefinitionOptions.inputs}. */
  inputs?: string[];
  /** Names of ports declared in {@link NodeDefinitionOptions.outputs}. */
  outputs?: string[];
}

/**
 * A dynamic-port entry already in the editor's own wire format.
 *
 * `nodelibraryexport.js` passes any entry carrying `ports`, `template`, `port` or
 * `channelPort` straight through without transforming it. These shapes are defined by the
 * editor rather than by the runtime, so they are typed permissively on purpose — a precise
 * type here would be a guess about code that lives in another package.
 */
export interface RawDynamicPortEntry {
  type?: string;
  name?: string;
  condition?: string;
  ports?: unknown[];
  template?: unknown;
  port?: unknown;
  /** @deprecated No editor code reads this any more. */
  channelPort?: { name: string; plug: 'input' | 'output'; [extra: string]: unknown };
  [extra: string]: unknown;
}

export type DynamicPortEntry = ConditionalPortGroup | RawDynamicPortEntry;

/** A visual state (hover, pressed, …) a node's ports can carry per-state values for. */
export interface VisualStateDefinition {
  name: string;
  label: string;
}

/**
 * How a parameter animates when the node changes visual state.
 *
 * A transition without a `curve` is not a transition: both the runtime and the editor
 * treat `curve` as the marker of a real entry, so `{}` means "snap to the new value".
 */
export interface StateTransition {
  /** Cubic-bezier control points. Its presence is what makes the entry count. */
  curve?: number[];
  /** Duration in milliseconds. */
  dur?: number;
  /** Delay before starting, in milliseconds. */
  delay?: number;
  [extra: string]: unknown;
}

/**
 * A named, shared parameter set that any node of `typename` can adopt.
 *
 * `parameters` are the neutral values; `stateParameters` holds per-visual-state overrides,
 * keyed by state name. A variant applied at runtime takes precedence over the one the
 * editor persisted on the node model.
 */
export interface NodeVariant {
  name: string;
  typename: string;
  parameters: Record<string, unknown>;
  stateParameters: Record<string, Record<string, unknown>>;

  /**
   * Per-state, per-parameter transitions, keyed by state name and then by parameter.
   * Merged with — and overridden by — the same field on the node's own model.
   */
  stateTransitions?: Record<string, Record<string, StateTransition>>;
  /**
   * Fallback transition for every parameter of a state, keyed by state name. Used only
   * when {@link stateTransitions} has nothing for the parameter in question.
   */
  defaultStateTransitions?: Record<string, StateTransition>;
}

/**
 * Property-panel extras the editor renders for this node type, keyed by panel name.
 * The contents are editor-owned, so they stay untyped here.
 */
export type NodePanels = Record<string, unknown>;

/**
 * Extra methods and accessors mixed into the node's prototype.
 *
 * Values may be plain functions or full property descriptors; `defineNode` normalises a
 * bare function to `{ value: fn }` before handing the object to `Object.create`. Note the
 * consequence: a descriptor whose `value` is falsy is re-wrapped, so descriptors of the
 * `{ get }` form work, but `{ value: 0 }` does not survive.
 */
export type PrototypeExtensions = Record<string, ((this: NodeInstance, ...args: any[]) => any) | PropertyDescriptor>;

/** One line of the editor's node inspector. */
export type InspectInfo =
  | string
  | Array<{ type: 'text' | 'value' | string; value: unknown; [extra: string]: unknown }>;

/**
 * The object passed to `defineNode`.
 *
 * `name` and `category` are the only required fields — `defineNode` throws without them.
 */
export interface NodeDefinitionOptions {
  /** Canonical type string, as it appears in project files. Must be unique. */
  name: string;
  /** Palette category. Required. */
  category: NodeCategory | (string & {});

  /** Name shown on the node in the graph and in the palette. */
  displayNodeName?: string;
  /** Fallback for {@link displayNodeName}. */
  displayName?: string;
  /** One-line description for the node picker. */
  shortDesc?: string;
  /** URL of the node's documentation page. */
  docs?: string;
  /** Extra terms the node picker matches on. */
  searchTags?: string[];
  color?: NodeColorName;
  /** Owning module, for nodes contributed outside the standard library. */
  module?: string;
  version?: string;
  /** Hides the node from the picker while keeping existing projects working. */
  deprecated?: boolean;

  inputs?: Record<string, InputPortDefinition>;
  outputs?: Record<string, OutputPortDefinition>;
  numberedInputs?: Record<string, NumberedInputDefinition>;
  dynamicports?: DynamicPortEntry[];
  /** Include runtime-discovered ports when exporting the project. */
  exportDynamicPorts?: boolean;
  /** The node instantiates a component, so its ports come from that component. */
  haveComponentPorts?: boolean;

  /** Only one instance of this type may exist per project. */
  singleton?: boolean;
  allowChildren?: boolean;
  allowChildrenWithCategory?: string[];
  allowAsChild?: boolean;
  allowAsExportRoot?: boolean;
  /** Node supports variants (shared, named parameter sets). */
  useVariants?: boolean;
  visualStates?: VisualStateDefinition[];
  panels?: NodePanels;
  connectionPanel?: unknown;
  /** Name of an input port whose value is shown as the node's label. */
  usePortAsLabel?: string;
  portLabelTruncationMode?: PortLabelTruncationMode;
  nodeDoubleClickAction?: unknown;

  /** Runs once per instance, after ports are registered and defaults applied. */
  initialize?(this: NodeInstance): void;
  /** Extra prototype members. Current spelling. */
  methods?: PrototypeExtensions;
  /** @deprecated Historical spelling of {@link methods}; still honoured. */
  prototypeExtensions?: PrototypeExtensions;
  /** Supplies the editor's node inspector with what to show for this instance. */
  getInspectInfo?(this: NodeInstance): InspectInfo;
  /** Called once the enclosing node scope has finished initialising. */
  nodeScopeDidInitialize?(this: NodeInstance): void;

  /** Seed for the instance's `_internal` scratch space. */
  _internal?: Record<string, unknown>;

  [extra: string]: unknown;
}

/** An input port as it appears in compiled {@link NodeMetadata}. */
export interface InputPortMetadata {
  type?: PortTypeSpec;
  default?: unknown;
  displayName?: string;
  editorName?: string;
  group?: string;
  index?: number;
  exportToEditor: boolean;
  inputPriority: number;
  tooltip?: string;
  tab?: string;
  popout?: unknown;
  allowVisualStates?: boolean;
  nodeDoubleClickAction?: unknown;
}

/** An output port as it appears in compiled {@link NodeMetadata}. */
export interface OutputPortMetadata {
  type?: PortTypeSpec;
  displayName?: string;
  editorName?: string;
  group?: string;
  index?: number;
  exportToEditor: boolean;
}

/**
 * What `defineNode` compiles its options into, and what the node register hands back from
 * `getNodeMetadata`. Port *values* live on instances; this is the type-level description.
 */
export interface NodeMetadata {
  name: string;
  category: NodeCategory | (string & {});
  inputs: Record<string, InputPortMetadata>;
  outputs: Record<string, OutputPortMetadata>;

  displayNodeName?: string;
  shortDesc?: string;
  docs?: string;
  searchTags?: string[];
  color?: NodeColorName;
  module?: string;
  version?: string;
  deprecated?: boolean;

  dynamicports?: DynamicPortEntry[];
  exportDynamicPorts?: boolean;
  haveComponentPorts?: boolean;

  singleton?: boolean;
  allowChildren?: boolean;
  allowChildrenWithCategory?: string[];
  allowAsChild?: boolean;
  allowAsExportRoot?: boolean;
  useVariants?: boolean;
  visualStates?: VisualStateDefinition[];
  panels?: NodePanels;
  connectionPanel?: unknown;
  usePortAsLabel?: string;
  portLabelTruncationMode?: PortLabelTruncationMode;
  nodeDoubleClickAction?: unknown;
}

/**
 * The value `defineNode` returns and `NodeRegister.register` stores: a factory that builds
 * one instance, with the compiled metadata hung off it.
 */
export interface NodeDefinition {
  (context: NodeContextLike, id: string, nodeScope?: NodeScopeLike): NodeInstance;
  metadata: NodeMetadata;
  /**
   * Present only when the definition declares {@link NodeDefinitionOptions.numberedInputs}.
   * Wires the graph-model listeners that keep the editor's port list in step with the
   * numbered inputs actually in use.
   */
  setupNumberedInputDynamicPorts?(context: NodeContextLike, graphModel: unknown): void;
}

/** The module `@noodl/runtime`'s `NodeDefinition` export exposes. */
export interface NodeDefinitionModule {
  defineNode(opts: NodeDefinitionOptions): NodeDefinition;
  /**
   * Deep-merges `source` into `target`, in place, and returns `target`.
   *
   * Three special cases matter to node authors: `initialize` functions are *chained*
   * rather than replaced, arrays present on both sides are *concatenated*, and plain
   * objects are merged recursively. Everything else is overwritten.
   */
  extend<T extends object, U extends object>(target: T, source: U): T & U;
}
