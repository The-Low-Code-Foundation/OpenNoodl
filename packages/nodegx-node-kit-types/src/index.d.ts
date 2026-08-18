/**
 * NodeGX node-kit types — the authoring surface of a custom node, as a single
 * self-contained `.d.ts`.
 *
 * ## What this file is for
 *
 * A node kit is plain JavaScript. There is no SDK, no bundler and no `npm
 * install`: the runtime loads React as `window.React` before the kit's
 * `index.js` runs, and the kit calls `Noodl.defineModule({ reactNodes: [...] })`.
 * That is the supported path and the only one (ruling D2, phase 69).
 *
 * The cost of having no toolchain is that an author gets no help from their
 * editor — until they point at this file:
 *
 * ```js
 * /** @type {import('./types/node-kit').ReactNodeDefinition} *\/
 * const Chip = {
 *   name: 'mykit.Chip',
 *   getReactComponent: function () { return ChipComponent; }
 * };
 * ```
 *
 * That gives autocomplete and inline errors in any editor running the
 * TypeScript language service, with **no `tsconfig`, no build step and no
 * `node_modules`**. Nothing here is imported at runtime; a `.d.ts` emits
 * nothing.
 *
 * ## Two rules this file must keep
 *
 * 1. **Self-contained.** No `import`, no `/// <reference>`, no dependency on
 *    `@noodl/types` or on React's types. The file is meant to be *copied into a
 *    kit folder* and reached by a relative path, where none of those resolve.
 *    A bare specifier (`import('@nodegx/node-kit-types')`) resolves only when
 *    the package is physically installed, which a kit project has no way to
 *    arrange — measured, CN-005.
 * 2. **It must not lie.** A type that overstates the runtime is worse than no
 *    type, because it is believed. Every member below is mirrored from the
 *    runtime's own declarations and `tests/drift.test.js` fails when the two
 *    disagree. Where a shape is deliberately partial, it says so.
 *
 * ## Where each half comes from
 *
 * | Section | Mirrors |
 * |---|---|
 * | Ports, dynamic ports, visual states | `@noodl/types` `runtime/node-definition.d.ts` |
 * | `ReactNodeDefinition` and its port shapes | `noodl-viewer-react` `src/react-component-node.ts` |
 * | `NodeDefinitionOptions` (the logic half) | `@noodl/types` `runtime/node-definition.d.ts` |
 *
 * @packageDocumentation
 */

// ===========================================================================
// Port value types
// ===========================================================================

/** Port value type names the runtime registries actually carry. */
export type PortTypeName =
  | '*'
  | 'array'
  | 'boolean'
  | 'cloudfile'
  | 'color'
  | 'component'
  | 'date'
  | 'dimension'
  | 'domelement'
  | 'enum'
  | 'font'
  | 'icon'
  | 'image'
  | 'mediastream'
  | 'number'
  | 'object'
  | 'pages'
  | 'proplist'
  | 'reference'
  | 'signal'
  | 'source'
  | 'string'
  | 'stringlist'
  | 'textStyle';

/** The object form of a port type — used when the type needs configuration. */
export interface PortType {
  name: PortTypeName | string;
  enums?: Array<{ label: string; value: string } | string>;
  /** Present when the enum list is computed at runtime and not statically known. */
  enumsAreDynamic?: boolean;
  units?: string[];
  defaultUnit?: string;
  allowConnectionsOnly?: boolean;
  allowEditOnly?: boolean;
  [extra: string]: unknown;
}

/**
 * The value type of a port, as authored.
 *
 * Write either the bare name (`type: 'number'`) or the object form when the
 * type needs configuration (`type: { name: 'enum', enums: ['a', 'b'] }`). Both
 * reach the editor unchanged.
 */
export type PortTypeSpec = PortTypeName | (string & {}) | PortType;

/** Colour bucket the editor paints the node header with. */
export type NodeColorName = 'data' | 'visual' | 'logic' | 'component' | 'javascript' | (string & {});

/** How the editor truncates the label taken from `usePortAsLabel`. */
export type PortLabelTruncationMode = 'length' | 'path' | (string & {});

/**
 * A port's hover tooltip. The bare string is HTML; the object form separates
 * the short text from the expanded one.
 */
export type PortTooltipText = string | { standard?: string; extended?: string };

/**
 * A *keyed* map of tooltips, for a port that renders more than one control —
 * keyed by enum value, or by sub-control for a dimension port.
 */
export type PortTooltipMap = Record<string, PortTooltipText>;

export type PortTooltip = PortTooltipText | PortTooltipMap;

/**
 * Which property-panel tab a port belongs to.
 *
 * A plain string names the tab. The object form groups several ports into one
 * tabbed control.
 */
export type PortTab = string | { group?: string; tab?: string; label?: string };

/** Palette category a node is filed under. */
export type NodeCategory =
  | 'Animation'
  | 'Cloud'
  | 'Cloud Services'
  | 'Component Utilities'
  | 'CustomCode'
  | 'Data'
  | 'Events'
  | 'Interpolation'
  | 'Javascript'
  | 'Logic'
  | 'Math'
  | 'Navigation'
  | 'String Manipulation'
  | 'Utilities'
  | 'Variables'
  | 'Visual';

// ===========================================================================
// The React component a node renders
// ===========================================================================

/**
 * What {@link ReactNodeDefinition.getReactComponent} returns.
 *
 * Declared structurally rather than as `React.ComponentType`, because a kit has
 * no `@types/react` to resolve — React arrives as the `window.React` global at
 * runtime. A tag name string (`'div'`) is accepted too, and the built-in nodes
 * use that form.
 */
export type KitReactComponent = string | ((props: any) => any) | (new (props: any) => any);

// ===========================================================================
// Ports, as authored
// ===========================================================================

/**
 * An input port, as authored.
 *
 * Exactly one of {@link set} and {@link valueChangedToTrue} is meaningful. A
 * port with `valueChangedToTrue` is a *signal* input: the runtime installs an
 * edge-triggered setter and forces `type` to
 * `{ name: 'signal', allowConnectionsOnly: true }`, overriding whatever `type`
 * was declared.
 */
export interface InputPortDefinition {
  type?: PortTypeSpec;

  /** Receives the new value. `this` is the node instance. */
  set?(this: NodeInstance, value: any): void;

  /**
   * Marks the port as a signal. Called on every false → true transition, never
   * on the falling edge. Declaring this replaces `type` with the signal type.
   */
  valueChangedToTrue?(this: NodeInstance): void;

  /** Called when a unit-bearing value (`{ value, unit }`) changes unit. */
  setUnitType?(this: NodeInstance, unit: string): void;

  /** Value used when the project sets no parameter. Unit types wrap it as `{ value, unit }`. */
  default?: unknown;

  displayName?: string;
  /** Name shown in the property panel when it should differ from `displayName`. */
  editorName?: string;
  group?: string;
  /**
   * Redundant on a statically declared input — a member of `inputs` is an input
   * by construction. It exists because dynamic-port payloads do need to say
   * which side they belong to, and the two shapes get written side by side.
   */
  plug?: 'input' | (string & {});
  /** Property-panel tab this port belongs to. See {@link PortTab}. */
  tab?: PortTab;
  /** Property-panel popout group this port belongs to. */
  popout?: unknown;
  index?: number;
  tooltip?: PortTooltip;
  /** Defaults to `true`. Set `false` to keep the port out of the editor entirely. */
  exportToEditor?: boolean;
  /** Higher priority inputs are applied first within one update. Defaults to `0`. */
  inputPriority?: number;
  /** Allows per-visual-state values (hover, pressed, …) for this port. */
  allowVisualStates?: boolean;
  nodeDoubleClickAction?: unknown;
  /** One-sentence description, read by the catalog, the validator and the AI authoring loop. */
  description?: string;
}

/**
 * An output port, as authored.
 *
 * `get` and `getter` are the same thing — `get` is the current spelling. Signal
 * outputs (`type: 'signal'`) need no getter: a signal is emitted as a
 * false/true pair rather than read.
 */
export interface OutputPortDefinition {
  type?: PortTypeSpec;

  /** Returns the current value. `this` is the node instance. */
  get?(this: NodeInstance): unknown;
  /** @deprecated Historical spelling of {@link get}; still honoured. */
  getter?(this: NodeInstance): unknown;

  /** Fired when the port goes from zero connections to one. */
  onFirstConnectionAdded?(this: NodeInstance): void;
  /** Fired when the port's last connection is removed. */
  onLastConnectionRemoved?(this: NodeInstance): void;

  displayName?: string;
  editorName?: string;
  group?: string;
  index?: number;
  /** Defaults to `true`. */
  exportToEditor?: boolean;
  /** NDA-005. Outputs carry no `tooltip`, so this is their only documentation. */
  description?: string;
}

/**
 * A family of inputs named `"<base> 0"`, `"<base> 1"`, … created on demand.
 *
 * The port set is unbounded by construction.
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
 * A group of statically-declared ports the editor shows only when `condition`
 * holds — the `declared-port-groups` mechanism, and the only kind of dynamism
 * that is pure data.
 *
 * `condition` is the editor's own mini-language, e.g.
 * `'storeType = cloud OR storeType NOT SET'`.
 *
 * ⚠️ This is the shape the catalog and the validator read. `inputs` and
 * `outputs` are **port names**, not port objects — a group written as
 * `{ ports: [{ name: 'x' }] }` is passed through untransformed and its
 * condition is never found (CN-004).
 */
export interface ConditionalPortGroup {
  /** Defaults to `'conditionalports/basic'`. */
  name?: string;
  condition?: string;
  /** Names of ports declared in the node's `inputs` / `inputProps` / `inputCss`. */
  inputs?: string[];
  /** Names of ports declared in the node's `outputs` / `outputProps`. */
  outputs?: string[];
}

/**
 * A dynamic-port entry already in the editor's own wire format.
 *
 * Entries carrying `ports`, `template`, `port` or `channelPort` are passed
 * straight through without transformation. These shapes are defined by the
 * editor rather than the runtime, so they are typed permissively on purpose.
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
 * How a node type behaves under server-side rendering. Absent means `safe`.
 *
 * - `safe`: runs server-side with full behavior.
 * - `partial`: runs server-side, but some behavior only completes in the
 *   browser. `note` states the caveat.
 * - `client-only`: the logic cannot run server-side at all. The instance is
 *   created inert — ports exist so connections stay valid, but `initialize` is
 *   skipped, input setters are no-ops and outputs read `undefined` — and the
 *   browser runs it normally after hydration.
 */
export interface NodeSSRCompat {
  compat: 'safe' | 'partial' | 'client-only';
  /** Human-readable caveat, surfaced in the node catalog. */
  note?: string;
}

/**
 * One entry in the editor's node inspector popup.
 *
 * `type` selects the renderer: `image` and `color` get dedicated ones,
 * everything else falls through to a JSON view for objects and a plain value
 * view for primitives.
 */
export interface InspectInfoEntry {
  type?: 'text' | 'value' | 'image' | 'color' | (string & {});
  value: unknown;
  [extra: string]: unknown;
}

/**
 * What `getInspectInfo` may return.
 *
 * ⚠️ Returning a bare `boolean`, `number` or plain object — anything that is
 * neither a string nor an `{ type, value }` entry — produces an inspector that
 * shows *nothing*. It is not an error; the value simply has no `.value` to read.
 */
export type InspectInfo = string | InspectInfoEntry | InspectInfoEntry[];

/** One entry in a node type's `panels` list. */
export interface NodePanel {
  name: string;
  /** When the panel applies: `'select'`, `'connectTo'`, `'connectFrom'`. */
  context?: string[];
  title?: string;
  plug?: 'input' | 'output' | 'input/output' | (string & {});
  /** The port type the panel creates ports with. */
  type?: PortTypeSpec;
  hidden?: boolean;
  group?: string;
  [extra: string]: unknown;
}

export type NodePanels = NodePanel[] | 'none';

/**
 * Extra methods and accessors mixed into the node's prototype.
 *
 * ⚠️ A bare function is normalised to `{ value: fn }`, and a descriptor whose
 * `value` is falsy is re-wrapped — so `{ get }` descriptors work but
 * `{ value: 0 }` does not survive.
 */
export type PrototypeExtensions = Record<string, ((this: NodeInstance, ...args: any[]) => any) | PropertyDescriptor>;

// ===========================================================================
// `this` inside a callback
// ===========================================================================

/**
 * `this` inside every author-supplied callback on a node definition.
 *
 * ⚠️ **Deliberately partial.** The runtime instance carries more than this —
 * this publishes the members a kit author is expected to call, and the index
 * signature keeps everything else reachable without the compiler complaining.
 * `tests/drift.test.js` proves every member here still exists on the runtime's
 * own `NodeInstance`; it does not require this list to be complete.
 */
export interface NodeInstance {
  readonly id: string;
  readonly name: string;

  /** Per-instance scratch space. Node definitions own this; the runtime never reads it. */
  _internal: Record<string, unknown>;

  // --- inputs -------------------------------------------------------------
  hasInput(name: string): boolean;
  getInputValue(name: string): unknown;
  registerInput(name: string, input: InputPortDefinition): void;
  registerInputs(inputs: Record<string, InputPortDefinition>): void;
  deregisterInput(name: string): void;
  isInputConnected(inputName: string): boolean;
  setInputValue(name: string, value: unknown): void;

  // --- outputs ------------------------------------------------------------
  hasOutput(name: string): boolean;
  registerOutput(name: string, output: OutputPortDefinition): void;
  registerOutputs(outputs: Record<string, OutputPortDefinition>): void;
  deregisterOutput(name: string): void;
  /** Marks an output dirty so its `get` is re-read and the value propagated. */
  flagOutputDirty(name: string): void;
  flagAllOutputsDirty(): void;
  /** Emits a signal on a signal-typed output. */
  sendSignalOnOutput(name: string): void;
  sendValue(name: string, value: unknown): void;

  // --- the control-signal class -------------------------------------------

  /**
   * Should a new value on `inputName` re-run this node?
   *
   * 🔴 **Call this from the governed input's `set`.** Declaring
   * {@link NodeDefinitionOptions.runOnValueChange} synthesises the checkbox
   * **port** and nothing else — obeying it is the definition's job, exactly as
   * every built-in in the class does it:
   *
   * ```js
   * set: function (value) {
   *   this._internal.reading = Number(value);
   *   if (this.shouldRunOnValueChange('reading')) this.flagOutputDirty('output');
   * }
   * ```
   *
   * ⚠️ Omitting the guard is silent and looks like a runtime bug rather than an
   * authoring one: the output keeps the value `connectInput` pushed at boot, so
   * a consumer reads a confident `0` from a node that has never run. That is
   * measured, not hypothetical — it is what CN-012's first logic kit did.
   *
   * Answers `true` for an input the author has never unticked (absent means
   * ticked), so a node is auto-running until someone deliberately says not to.
   */
  shouldRunOnValueChange(inputName: string): boolean;

  /**
   * Mint a `runOnChange-<name>` checkbox for an input **discovered at runtime**.
   * Declared inputs get theirs from `defineNode`; a node whose ports come from
   * user text or a schema has to register them alongside the port they govern.
   */
  registerRunOnValueChangeInput(inputName: string, displayName?: string): void;
  /** Drop the checkbox for an input that no longer exists, and forget its answer. */
  deregisterRunOnValueChangeInput(inputName: string): void;

  /** Defers work until every input in the current update has been applied. */
  scheduleAfterInputsHaveUpdated(callback: () => void): void;
  /** Reports a runtime error against this node, shown in the editor. */
  raiseRuntimeError(message: string): void;

  [extra: string]: any;
}

/**
 * `this` inside every callback on a **React** node definition, and the type of
 * `props.noodlNode` in the component the node renders.
 *
 * It is {@link NodeInstance} plus what the React bridge mixes in — children,
 * styling, variants and visual states.
 *
 * ⚠️ **Deliberately partial**, on the same terms as {@link NodeInstance}.
 */
export interface ReactNodeInstance extends NodeInstance {
  /** The props handed to the React component. */
  props: ReactNodeProps;
  /** The node's own inline styles, applied to the root element. */
  style: Record<string, any>;

  /** Whatever the *inner* component put in its `ref` — often, but not always, a DOM node. */
  innerReactComponentRef: any;
  /** Identity of this node's React element; changing it forces a full remount. */
  reactKey: string;

  children: ReactNodeInstance[];
  parent?: ReactNodeInstance;
  childIndex: number;
  childrenCount: number;

  /** Re-render this node. Coalesced to at most once per frame. */
  forceUpdate(): void;
  /** Re-key the node so React rebuilds its subtree from scratch. */
  _resetReactVirtualDOM(): void;

  /** Write styles onto the root element, or onto the element carrying `styleTag`. */
  setStyle(newStyles: Record<string, any>, styleTag?: string): void;
  removeStyle(styles: string[], styleTag?: string): void;
  getStyle(style: string): unknown;
  getDOMElement(): HTMLElement | null;
  /**
   * Root-element reporting contract: a component attaches
   * `ref={(el) => props.noodlNode?.setDOMElement(el)}` on its root host element.
   */
  setDOMElement(element: Element | null): void;

  /**
   * Run an action on the inner React component, deferring it until there is
   * one rather than dropping it. Use in place of
   * `this.innerReactComponentRef && this.innerReactComponentRef.doThing()`.
   *
   * @param onDropped Called if the queue's 16-deep cap discards the action
   * before the node ever mounts — the one path on which it can end in silence.
   */
  withInnerComponent(action: (inner: any) => void, onDropped?: () => void): void;

  /** The node this one renders inside, hopping out of the component if it is a root. */
  getVisualParentNode(): ReactNodeInstance | undefined;
  getChildren(): ReactNodeInstance[];

  getParameter(name: string): unknown;
  setVisualStates(newStates: string[]): void;

  [extra: string]: any;
}

/** The props a React node's component receives. */
export interface ReactNodeProps {
  /** Per-`styleTag` style objects, for nodes that style more than one element. */
  styles: Record<string, Record<string, any>>;
  [prop: string]: any;
}

// ===========================================================================
// The visual (React) node definition — the supported authoring surface
// ===========================================================================

/** A callback an author writes on a React node definition. */
export type ReactNodeCallback<TArgs extends any[] = any[], TResult = void> = (
  this: ReactNodeInstance,
  ...args: TArgs
) => TResult;

/**
 * An ordinary runtime input, declared on a React node — you write the `set`
 * yourself and decide what it does.
 *
 * Reach for {@link ReactInputPropDefinition} or {@link ReactInputCssDefinition}
 * first; this form is for inputs that are neither a prop nor a style.
 */
export interface ReactInputDefinition extends Omit<InputPortDefinition, 'set' | 'valueChangedToTrue' | 'setUnitType'> {
  set?: ReactNodeCallback<[any]>;
  valueChangedToTrue?: ReactNodeCallback;
  setUnitType?: ReactNodeCallback<[string]>;
}

/** An ordinary runtime output. See {@link ReactInputDefinition}. */
export interface ReactOutputDefinition
  extends Omit<OutputPortDefinition, 'get' | 'getter' | 'onFirstConnectionAdded' | 'onLastConnectionRemoved'> {
  get?: ReactNodeCallback<[], unknown>;
  /** @deprecated Historical spelling of {@link get}; still honoured. */
  getter?: ReactNodeCallback<[], unknown>;
  onFirstConnectionAdded?: ReactNodeCallback;
  onLastConnectionRemoved?: ReactNodeCallback;
}

/**
 * An input that writes a React prop.
 *
 * The value is stored at `this.props[name]`, or at `this.props[propPath][name]`
 * when {@link propPath} is set. A `type` of `'node'` is special: the connected
 * node is rendered and the resulting element passed as the prop.
 */
export interface ReactInputPropDefinition extends Omit<InputPortDefinition, 'set'> {
  /** Nests the prop one level down, e.g. `propPath: 'inputProps'`. */
  propPath?: string;
  /** Called after the prop is written. */
  onChange?: ReactNodeCallback<[any]>;
  /**
   * **Generated. Do not write this.** The bridge synthesises the setter onto
   * the object you wrote, in place; anything you put here is overwritten.
   * Use {@link onChange} to react to a new value.
   */
  set?: ReactNodeCallback<[any]>;
}

/**
 * An input that writes a CSS property.
 *
 * The value goes to `this.style`, or to `this.props.styles[styleTag]` when
 * {@link styleTag} is set — which is how a node styles more than one element.
 */
export interface ReactInputCssDefinition extends Omit<InputPortDefinition, 'set'> {
  /** The style property to write; defaults to the port's own name. */
  targetStyleProperty?: string;
  /** Marks the element (via a `noodl-style-tag` attribute) this style applies to. */
  styleTag?: string;
  /** Set `false` to declare a default for the editor without applying it at runtime. */
  applyDefault?: boolean;
  /** Called after the style is written. */
  onChange?: ReactNodeCallback<[any]>;
  /**
   * **Generated. Do not write this.** See
   * {@link ReactInputPropDefinition.set}.
   */
  set?: ReactNodeCallback<[any]>;
}

/**
 * An output driven by a React prop — a callback the component invokes.
 *
 * Either the port *is* the prop (the component calls `props.onClick()`), or
 * {@link props} declares a group of prop callbacks that all feed this one port.
 */
export interface ReactOutputPropDefinition extends Omit<OutputPortDefinition, 'get'> {
  /** Nests the prop one level down, matching {@link ReactInputPropDefinition.propPath}. */
  propPath?: string;
  /** Several prop callbacks handled together, keyed by prop name. */
  props?: Record<string, ReactNodeCallback>;
  /** Derives the port's value from the prop callback's arguments; defaults to the first. */
  getValue?: ReactNodeCallback<any[], unknown>;
  /** Called after the value is stored and the port flagged dirty. */
  onChange?: ReactNodeCallback<[any]>;
  /**
   * **Generated for non-signal outputs. Do not write this.** See
   * {@link ReactInputPropDefinition.set}.
   */
  get?: (this: ReactNodeInstance) => unknown;
}

/**
 * Frame-based layout opt-in — the standard dimension, transform, margin,
 * padding and alignment port groups, plus the layout pass that applies them.
 *
 * Setting any sub-field registers that group of shared ports on the node;
 * setting `frame` at all (to any truthy value) turns on the `Layout.size` /
 * `Layout.align` pass in the bridge's render.
 *
 * ⚠️ **Unexercised in-repo, and that is the caveat worth knowing.** No built-in
 * node sets `frame` — they reach layout through `inputCss` and the shared port
 * definitions directly — so this path is live but lightly travelled. It was
 * retained (DEBT-006, 2026-07-25) specifically because a module defining React
 * nodes can legitimately use it.
 */
export interface ReactNodeFrame {
  /** `true`, or an options object forwarded to the shared dimension ports. */
  dimensions?: boolean | Record<string, unknown>;
  position?: boolean;
  margins?: boolean;
  padding?: boolean;
  align?: boolean;
}

/**
 * A visual node, as an author writes it — the object you put in
 * `Noodl.defineModule({ reactNodes: [...] })`.
 *
 * Only {@link name} and {@link getReactComponent} are required.
 *
 * **Ports are the product.** A decision that belongs to the person building the
 * app — a threshold, a colour, a date format, a label — belongs on a port, not
 * in the JavaScript. The JavaScript is for what a node graph genuinely cannot
 * do: measure the DOM, follow a pointer at frame rate, talk to a browser API.
 *
 * ⚠️ Fields not listed here are **not** forwarded to the runtime definition,
 * with the exception of the index signature's escape hatch. `category` is
 * accepted and ignored: every React node is registered as `'Visual'`.
 */
export interface ReactNodeDefinition {
  /**
   * Canonical type string, as it appears in project files. Namespace it with
   * your kit (`'mykit.Chip'`) — a collision with another kit or a built-in is
   * a project-level failure.
   */
  name: string;
  /** Returns the React component to render. Called once per instance. */
  getReactComponent: ReactNodeCallback<[], KitReactComponent>;

  /** Name shown on the node in the graph and in the palette. */
  displayNodeName?: string;
  /** Fallback for {@link displayNodeName}. */
  displayName?: string;
  /** Prose: the author's own sentence about what the node is for. */
  docs?: string;
  /**
   * URL of a documentation page for this node.
   *
   * 🔴 **Separate from {@link docs} on purpose (D10).** `docs` is one field over
   * two vocabularies — a URL on the 158 shipped nodes that carry one, the kit
   * author's own prose on a kit node — so a kit had no way to offer a link
   * without its sentence being rendered as an `href` that opens nothing.
   * Sniffing for `http` was considered and rejected: it encodes a guess about
   * the author's intent in a regex, and it mislabels a kit whose prose merely
   * opens with a URL. Two fields, two meanings, no guessing.
   */
  docsUrl?: string;
  allowChildren?: boolean;
  allowAsExportRoot?: boolean;
  /** Only one instance of this type may exist per project. */
  singleton?: boolean;
  /** Node supports variants — shared, named parameter sets. */
  useVariants?: boolean;
  visualStates?: VisualStateDefinition[];
  /** Name of an input port whose value is shown as the node's label. */
  usePortAsLabel?: string;
  portLabelTruncationMode?: PortLabelTruncationMode;
  connectionPanel?: unknown;
  nodeDoubleClickAction?: unknown;
  /** Port groups the editor shows or hides by condition. See {@link ConditionalPortGroup}. */
  dynamicports?: DynamicPortEntry[];

  /** Passes the node itself to the React component as `props.noodlNode`. */
  noodlNodeAsProp?: boolean;
  /** Set `false` to omit the standard `mounted` input. */
  mountedInput?: boolean;
  /** See {@link ReactNodeFrame}. */
  frame?: ReactNodeFrame;

  /** Styles applied to every instance before any input is set. */
  defaultCss?: Record<string, any>;

  /** Ports written as ordinary runtime inputs, with their own `set`. */
  inputs?: Record<string, ReactInputDefinition>;
  /** Ports that write React props. The usual way to give a node an input. */
  inputProps?: Record<string, ReactInputPropDefinition>;
  /** Ports that write CSS properties. */
  inputCss?: Record<string, ReactInputCssDefinition>;
  /** Ports written as ordinary runtime outputs, with their own `get`. */
  outputs?: Record<string, ReactOutputDefinition>;
  /** Ports driven by React prop callbacks. The usual way to give a node an output. */
  outputProps?: Record<string, ReactOutputPropDefinition>;

  /** Runs once per instance, after ports are registered and defaults applied. */
  initialize?: ReactNodeCallback;
  /** Extra members put straight onto the node's prototype. */
  methods?: Record<string, ReactNodeCallback<any[], any>>;
  /** Supplies the editor's node inspector with what to show for this instance. */
  getInspectInfo?: ReactNodeCallback<[], InspectInfo>;
  /** Called once the enclosing node scope has finished initialising. */
  nodeScopeDidInitialize?: ReactNodeCallback;
  /** Runs once at registration, not per instance. */
  setup?: (context: any, graphModel: any) => void;

  /** @deprecated Ignored — React nodes are always registered as `'Visual'`. */
  category?: string;
  /** Marks the node deprecated in the runtime definition and the catalog. */
  deprecated?: boolean;
  /** Server-side-rendering compatibility; forwarded to the catalog. */
  ssr?: NodeSSRCompat;

  // 🔴 THE ONE DELIBERATE DIVERGENCE FROM THE RUNTIME, and it is the whole
  // value of annotating a kit.
  //
  // `react-component-node.ts` declares `[extra: string]: unknown` here. Publish
  // that and a misspelled field — `dispayNodeName`, `inputProp`, `outputprops`
  // — matches the index signature, so the compiler says nothing. It is then
  // dropped in silence at runtime too: `createNodeFromReactComponent` builds the
  // compiled definition by naming every field it forwards, one at a time, and a
  // field it does not name never reaches the runtime. Measured, CN-005.
  //
  // Silent at both ends is the worst outcome available, and it is the single
  // most common authoring mistake. Omitting the index signature turns it into an
  // editor error, and cannot produce a false one: a field this interface does
  // not list is a field the bridge does not forward.
  //
  // `tests/drift.test.js` asserts this divergence explicitly, because a missing
  // index signature is invisible to a property-set comparison — it would
  // otherwise be the one piece of drift the drift check cannot see.
}

// ===========================================================================
// The logic (non-visual) node definition — PROVISIONAL
// ===========================================================================

/**
 * A logic node, as an author writes it — the object you put in
 * `Noodl.defineModule({ nodes: [...] })`, and the same shape `defineNode`
 * takes.
 *
 * `name` and `category` are the only required fields.
 *
 * ✅ **ESTABLISHED (phase 69 CN-012, 2026-08-18).** The provisional marker that
 * stood here is gone, and it was lifted by building the caller rather than by
 * re-reading the runtime. A kit supplying only `nodes` — no `reactNodes`, no
 * React, no DOM — was registered by the real extractor and run in real
 * Chromium:
 *
 * - it registers exactly as a built-in does (`registerModule` loops `nodes`
 *   with no visual assumption anywhere, and `viewer.jsx`'s `reactNodes` branch
 *   is guarded, so a logic-only module takes the same path);
 * - a **built-in visual** node's signal reached a kit logic node's signal input,
 *   the node held state across the call and published a value through
 *   `flagOutputDirty`;
 * - the kit node's own `sendSignalOnOutput` reached **another kit logic node's**
 *   signal input, which published in turn — so kit-to-kit signal edges work;
 * - `runOnValueChange` synthesises its `runOnChange-<input>` checkbox on a kit
 *   node with the runtime's own wording, and {@link NodeInstance.shouldRunOnValueChange}
 *   answers it. ⚠️ See that method: declaring `runOnValueChange` does **not**
 *   wire itself, and the first kit written against this file got it wrong.
 *
 * ## Where a logic node runs — ✅ UPDATED, CN-013 / D18, 2026-08-18
 *
 * This paragraph used to read *"a kit runs in the browser only … there is no
 * caller … `manifest.runtimes` has one honest value today, `["browser"]`"*. That
 * was measured and true when written (CN-012 M4) and **it is now false**: the
 * cloud loader landed and this file did not hear about it. It is kept as a
 * sentence rather than deleted because it is the exact staleness this phase
 * keeps re-finding — a claim of ABSENCE outlives the absence, and no suite
 * reddens when it does.
 *
 * **There are two loaders, and `manifest.runtimes` has two honest values:**
 *
 * - **`browser`** — `@nodegx/module-inject`'s `buildInjectionTags` emits a
 *   `<script>` tag per kit and the browser runs it.
 * - **`cloud`** — `@noodl/cloud-runtime`'s `kitModules.ts` evaluates a
 *   cloud-enabled kit's entry script and registers its **logic** nodes. The
 *   cloud function that used to time out on a kit node now answers `200` with
 *   that node's own arithmetic, measured through the esbuild bundle a deploy
 *   target actually runs.
 *
 * 🔴 **The two are a set, not a fallback: `runtimes` is a filter on both sides.**
 * Declaring `["cloud"]` alone still takes the kit out of the browser injector.
 * A kit whose nodes are wanted in both places declares
 * `["browser", "cloud"]`; leaving the field out defaults to browser and is
 * still right for a visual kit.
 *
 * ⚠️ **There is no `"ssr"` value and there should not be.** SSR/SSG are the
 * *browser* app rendered on a server: `static/ssr/kit-modules.js` loads exactly
 * the scripts the injector put in the page, so a kit reaches a server render by
 * declaring **`browser`**. A kit declaring only `ssr` is in no page and runs
 * nowhere.
 *
 * ⚠️ **Cloud carries logic nodes only, and it cannot `require`.** A server-side
 * SDK dependency is out of scope by D18 — a deployed backend is one prebuilt
 * bundle with no `node_modules` for a package to land in — so the cloud
 * loader's `require` shim throws a sentence naming that limit rather than
 * dying on `require is not defined`.
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
  /** Prose: the author's own sentence about what the node is for. */
  docs?: string;
  /**
   * URL of a documentation page for this node.
   *
   * 🔴 **Separate from {@link docs} on purpose (D10).** `docs` is one field over
   * two vocabularies — a URL on the 158 shipped nodes that carry one, the kit
   * author's own prose on a kit node — so a kit had no way to offer a link
   * without its sentence being rendered as an `href` that opens nothing.
   * Sniffing for `http` was considered and rejected: it encodes a guess about
   * the author's intent in a regex, and it mislabels a kit whose prose merely
   * opens with a URL. Two fields, two meanings, no guessing.
   */
  docsUrl?: string;
  /** Extra terms the node picker matches on. */
  searchTags?: string[];
  color?: NodeColorName;
  /** Owning module, for nodes contributed outside the standard library. */
  module?: string;
  version?: string;
  /** Hides the node from the picker while keeping existing projects working. */
  deprecated?: boolean;
  /** Server-side-rendering compatibility. Absent means `safe`. */
  ssr?: NodeSSRCompat;

  inputs?: Record<string, InputPortDefinition>;
  outputs?: Record<string, OutputPortDefinition>;
  numberedInputs?: Record<string, NumberedInputDefinition>;
  dynamicports?: DynamicPortEntry[];
  /** Include runtime-discovered ports when exporting the project. */
  exportDynamicPorts?: boolean;
  /** The node instantiates a component, so its ports come from that component. */
  haveComponentPorts?: boolean;

  /**
   * Declares this node a member of the control-signal class: one
   * `runOnChange-<input>` checkbox port is synthesised per named input.
   *
   * 🔴 **This declaration creates the ports. It does not wire them.** Each
   * governed input's own `set` must ask
   * {@link NodeInstance.shouldRunOnValueChange} before it does any work — see
   * that method for the two-line shape and for what silently happens if you
   * forget.
   */
  runOnValueChange?: {
    /** The control signal that used to make every value setter passive. */
    controlSignal: string;
    /** The value inputs that get a checkbox, keyed to their port names. */
    inputs?: string[];
    /** Change sources governed the same way but which are **not input ports**. */
    sources?: { name: string; displayName: string }[];
  };

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
  getInspectInfo?(this: NodeInstance): InspectInfo | void;
  /** Called once the enclosing node scope has finished initialising. */
  nodeScopeDidInitialize?(this: NodeInstance): void;

  /** Seed for the instance's `_internal` scratch space. */
  _internal?: Record<string, unknown>;

  // ✅ D14 (2026-08-18): the index signature that stood here is GONE, so a
  // misspelled optional field is a compile error instead of silence.
  //
  // It read `[extra: string]: unknown`, which made every typo assignable:
  // only *required*-field mistakes were caught, and `displayNodeName` /
  // `docs` misspellings were measured silent (s24). A logic node's whole
  // authoring contract is this object, so the field a typo lands on is the
  // one thing an author cannot check any other way.
  //
  // 🔴 This is the SECOND deliberate divergence from the runtime's own
  // `NodeDefinitionOptions`, which keeps its index signature because it is a
  // structural type the runtime assigns arbitrary internals onto.
  // `tests/drift.test.js` names both divergences and their reasons — a
  // missing index signature is invisible to a property-set comparison, so
  // that test is the only thing that can see this line's absence.
}

/** Readable alias for {@link NodeDefinitionOptions}. */
export type LogicNodeDefinition = NodeDefinitionOptions;

// ===========================================================================
// The module
// ===========================================================================

/**
 * What a kit's `index.js` passes to `Noodl.defineModule`.
 *
 * ```js
 * Noodl.defineModule({ reactNodes: [Chip, Badge] });
 * ```
 *
 * ```js
 * Noodl.defineModule({ nodes: [Accumulator] });   // the logic half
 * ```
 */
export interface NodeKitModule {
  /** Visual nodes — the established path. */
  reactNodes?: ReactNodeDefinition[];
  /**
   * Logic nodes — no React, no DOM. ✅ Established by CN-012; see
   * {@link NodeDefinitionOptions}. A module may supply `nodes`, `reactNodes`, or
   * both.
   */
  nodes?: NodeDefinitionOptions[];
  /**
   * Set by the injector from the kit's `manifest.json` if the module does not
   * name itself. Provenance in the editor's property panel reads it.
   */
  name?: string;
  [extra: string]: unknown;
}

/**
 * The `Noodl` global a kit's `index.js` runs against.
 *
 * Installed by the bootstrap *before* any kit script, in all three runtimes —
 * the local viewer, a deployed bundle, and the SSR server.
 */
export interface NoodlGlobal {
  /** Registers the kit. Call it once, at the end of `index.js`. */
  defineModule(module: NodeKitModule): void;
  /** `false` in the editor's local viewer, `true` in a deployed or SSR bundle. */
  deployed: boolean;
  /**
   * Project environment variables.
   *
   * ⚠️ Optional because it genuinely is: the viewer and deploy bootstraps set
   * `Env: {}`, and **the SSR bootstrap does not set it at all**. Reading
   * `Noodl.Env.KEY` unguarded throws server-side.
   */
  Env?: Record<string, string>;
  [extra: string]: unknown;
}

declare global {
  /**
   * The registration entry point. Always present by the time a kit runs.
   */
  const Noodl: NoodlGlobal;

  /**
   * React, loaded by the runtime before any kit script — which is why a kit
   * needs no bundler and why there is exactly one React, so hooks are safe.
   *
   * Typed `any` deliberately: a kit has no `@types/react` to resolve, and
   * claiming a shape this package cannot verify against the React the runtime
   * happens to load would be a guess. `var h = React.createElement;` is the
   * usual opening line.
   *
   * ⚠️ Prefer bare `React` over `window.React`. Both work in the browser, but
   * the SSR bootstrap installs it on `globalThis` with no `window` to reach.
   *
   * 🔴 **The one place this declaration is wrong: a project that already has
   * `@types/react`.** React publishes its own UMD global, and two global
   * `React` declarations collide — `Cannot redeclare block-scoped variable
   * 'React'`. A kit folder has no `node_modules` and so never hits it; a
   * TypeScript project that pulls this file in alongside React's types will.
   * Delete this `const React` line in that case and use React's own types,
   * which are better than `any`. Pinned by a test, so the day it becomes more
   * than this one diagnostic somebody finds out.
   */
  const React: any;

  interface Window {
    Noodl: NoodlGlobal;
    /** Browser only — see the note on the global {@link React}. */
    React: any;
    /** The array `defineModule` pushes into. Runtime-internal. */
    __noodl_modules: NodeKitModule[];
  }
}
