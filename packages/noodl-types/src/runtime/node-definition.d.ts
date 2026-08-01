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
import { TimerScheduler } from './timer_scheduler.d';

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
 * A port's hover tooltip.
 *
 * The bare string is HTML, and is what `createTooltip` in the React viewer builds. The
 * object form separates the short text from the expanded one; the editor reads
 * `standard` when it is given an object (`shared/view.js`, `SizeModeInput.tsx`) and both
 * `node-shared-port-definitions.js` and the Video node author it.
 */
export type PortTooltipText = string | { standard?: string; extended?: string };

/**
 * The third form, found by typing `node-shared-port-definitions`: a *keyed* map of
 * tooltips for a port that renders more than one control.
 *
 * The key is not a fixed set. For the enum port `sizeMode` it is the enum value
 * (`explicit`, `contentHeight`, …), so each choice gets its own explanation; for
 * `width`/`height` it is the sub-control (`dimension`, `fixed`). Both are authored in
 * `addDimensionTooltips`.
 */
export type PortTooltipMap = Record<string, PortTooltipText>;

export type PortTooltip = PortTooltipText | PortTooltipMap;

/**
 * Which property-panel tab a port belongs to.
 *
 * A plain string names the tab. The object form groups several ports into one
 * tabbed control: `_addCornerRadius` emits `{ group: 'corners', tab, label }` so
 * the four corner radii render as tabs of a single editor widget rather than as
 * four separate rows. `nodedefinition.ts` copies whichever form it is given
 * straight onto the port metadata without inspecting it.
 */
export type PortTab = string | { group?: string; tab?: string; label?: string };

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
  /**
   * The authored node this instance was built from. Present for nodes that came from the
   * project graph; absent for ones the runtime created directly. Nodes with
   * `runtime-discovered` ports read `model.inputPorts` / `model.outputPorts` to find out
   * which ports the editor believes they have.
   */
  model?: GraphNodeModel;

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

  // --- failure ------------------------------------------------------------
  /**
   * Report that this node was asked to act and could not.
   * See `dev-docs/reference/FAILURE-CONTRACT.md`.
   *
   * Use this in place of `context.editorConnection.sendWarning`: the warning channel exists
   * only in the editor, so anything reported through it disappears in a deployed app, in the
   * cloud runtime and in exported code — exactly when an author most needs to know.
   *
   * `nodeId`, `componentName` and `nodeType` are filled in by the runtime, so a call site
   * cannot misattribute itself.
   *
   * @param code    Stable, kebab-case, namespaced by node type — `'run-tasks/no-success-output'`.
   *                Tests and tooling match on this, so treat it as an interface: reword
   *                `message` freely, never `code`.
   * @param message One human-readable sentence, no trailing period.
   * @param detail  Optional structured payload (the caught error, the offending value). Must
   *                be safe to serialise — the cloud and export paths will JSON it.
   *
   * Only raise for actual failures. An unset input (see the Empty-Value Contract), an empty
   * result set, or a condition being false are not failures, and a `Failure` port that fires
   * on those trains authors to ignore it.
   */
  raiseRuntimeError(code: string, message: string, detail?: unknown): void;
}

/**
 * The vendored Node `EventEmitter` (`noodl-runtime/src/events.js`), as node definitions use
 * it. Distinct from {@link EventSenderLike}, which is the runtime's own ref-scoped emitter
 * used by the graph and node *models*.
 */
export interface RuntimeEventEmitter {
  on(eventName: string, listener: (...args: any[]) => void): this;
  once(eventName: string, listener: (...args: any[]) => void): this;
  removeListener(eventName: string, listener: (...args: any[]) => void): this;
  removeAllListeners(eventName?: string): this;
  emit(eventName: string, ...args: any[]): boolean;
  setMaxListeners(n: number): this;
}

/**
 * The project's style tokens, as node definitions read them.
 *
 * Both lookups are total: an unknown colour name comes back unchanged (so a literal
 * `'#ff0000'` passes straight through), and an unknown text style yields `{}`. Neither
 * throws, so there is nothing to guard beyond `styles` itself being present.
 */
export interface StylesLike {
  /** Maps a named project colour to its value; returns `color` unchanged if unnamed. */
  resolveColor(color: string): string;
  getTextStyle(styleName: string): Record<string, unknown>;
}

/** The payload of a {@link ModelLike} `'change'` notification. */
export interface ModelChangeEvent {
  /** Property that changed. With `{ resolve: true }` writes this is the *leaf* name. */
  name: string;
  value: unknown;
  old: unknown;
}

/**
 * A Noodl Object at runtime — the id-keyed, observable record behind the Object node,
 * component state and every collection entry. `@noodl/runtime/src/model`.
 *
 * Three things about it are surprising enough to state. `Model.get(id)` *creates* the record
 * if it does not exist, so there is no "does this object exist" question to answer before
 * reading — which is why the Component Object node can key state on an instance id without
 * ever initialising it. What it hands back is a **Proxy**, not the bare object: unknown
 * property reads are forwarded to {@link get} and writes to {@link set}, which is what makes
 * `Noodl.Object` behave like a plain object in Function nodes. And `set` only notifies when
 * the value actually changed, unless `forceChange` says otherwise.
 *
 * `{ resolve: true }` on {@link get}/{@link set} treats a dotted name as a path *through
 * nested Models* — not through plain objects. A path that hits a non-Model on the way is
 * abandoned silently: the read returns `undefined` and the write does nothing.
 */
export interface ModelLike {
  readonly id: string;
  /** The record's own properties. Read directly by nodes that want the whole object. */
  data: Record<string, unknown>;

  get(name: string, args?: { resolve?: boolean }): unknown;
  set(name: string, value: unknown, args?: { resolve?: boolean; silent?: boolean; forceChange?: boolean }): void;
  /** Bulk assignment. Notifies once per genuinely changed property; skips `id`. */
  setAll(obj: Record<string, unknown>): void;
  /** Overwrites every existing property with `value` (default `null`), notifying for each. */
  fill(value?: unknown): void;
  getId(): string;
  toJSON(): Record<string, unknown>;

  /**
   * The backend class this record came from, set by `CloudStore._fromJSON` when the record
   * is deserialised — so it is present on anything fetched or created through the database
   * nodes, and absent on a record the graph made itself.
   *
   * It is what lets `Noodl.Records.save(id)` and friends work from an id alone: the class
   * is read back off the record rather than passed again. Every one of those call sites
   * reached it through the index signature below and therefore got `unknown`.
   */
  _class?: string;

  /** The only event the runtime emits is `'change'`. */
  on(event: string, listener: (args: ModelChangeEvent) => void): void;
  off(event: string, listener: (args: ModelChangeEvent) => void): void;
  notify(event: string, args?: unknown): void;

  /** The Proxy's fall-through: any other property read goes to {@link get}. */
  [property: string]: unknown;
}

/**
 * The `@noodl/runtime/src/model` module object — the factory side of {@link ModelLike}.
 *
 * It is a constructor function with statics hung off it, which is why `value instanceof
 * Model` type-checks. Note that {@link instanceOf} is *not* null-safe: it evaluates
 * `value.target` when the `instanceof` test fails, so passing `null` or `undefined`
 * throws rather than returning `false`. Every call site in the standard library happens
 * to pass a value it has already established is an object.
 */
export interface ModelModule {
  new (id: string, data: Record<string, unknown>): ModelLike;
  readonly prototype: ModelLike;
  /**
   * Fetches — or, for an unknown or omitted id, *creates* — the record. Never fails.
   *
   * ⚠️ `id` is `string | number`. Directus and PostgREST hand back JSON numbers for a
   * record's primary key (measured, BCN-004 step 6), and the store keys a **plain
   * object**, so `7` and `'7'` land on one record. That coercion is why the mixture has
   * been harmless — and it is load-bearing: `WeakRegistry` already uses a `Map`, which
   * does not coerce, so moving `models` to one would silently split every integer-keyed
   * record in two.
   */
  get(id?: string | number): ModelLike;
  /** Creates a record from a plain object. `data.id` picks the id; other keys are set. */
  create(data?: Record<string, unknown>): ModelLike;
  exists(id: string | number): boolean;
  /** Throws on `null`/`undefined` — see the interface note. */
  instanceOf(value: unknown): boolean;
  /** A 10-character random id. The runtime's only id generator for records. */
  guid(): string;
}

/**
 * A *scoped* record store — `Model.Scope`, reached as {@link NodeScopeLike.modelScope}.
 *
 * The idiom to recognise is `(this.nodeScope.modelScope || Model)`, which appears at
 * roughly thirty sites across the data nodes. `modelScope` is normally `undefined`, and
 * then records live in the one process-wide store the {@link ModelModule} itself owns;
 * when it is set, the same ids resolve to a *different* set of records. That is what makes
 * a sandboxed preview possible — the same graph, the same ids, an isolated store —
 * and it is inherited: `componentinstance.ts` copies the parent scope's `modelScope` into
 * each child scope it creates, so a whole component subtree shares one.
 *
 * It deliberately mirrors the module's own read/write surface rather than extending it:
 * a scope has no constructor and no `prototype`, so `ModelModule` is not a supertype.
 */
export interface ModelScopeLike {
  /** Fetches — or, for an unknown or omitted id, *creates* — the record. Never fails. */
  get(id?: string): ModelLike;
  /** Creates a record from a plain object. `data.id` picks the id; other keys are set. */
  create(data?: Record<string, unknown>): ModelLike;
  exists(id: string): boolean;
  /** Throws on `null`/`undefined`, like {@link ModelModule.instanceOf}. */
  instanceOf(value: unknown): boolean;
  /** A 10-character random id. */
  guid(): string;
  /** Drops every record in this scope, and the cloud store cached against it. */
  reset(): void;
  [extra: string]: unknown;
}

/**
 * The payload of a {@link CollectionLike} `'add'` or `'remove'` notification.
 *
 * `'change'` carries no payload at all — it is notified with no argument once per logical
 * mutation, so a listener that reads `args` on `'change'` reads `undefined`. The overloads
 * on {@link CollectionLike.on} keep the two apart.
 *
 * A bulk mutation (`splice`, `length = 0`, `set`) emits an `'add'`/`'remove'` per structural
 * change and **one** `'change'` for the operation — see
 * `dev-docs/reference/REACTIVITY-CONTRACT.md`.
 */
export interface CollectionChangeEvent {
  item: ModelLike;
  /** Absent on the `'remove'` notification sent to the *item*, present on the rest. */
  index?: number;
}

/**
 * A Noodl Array at runtime — the ordered list of {@link ModelLike} behind the Array node,
 * every query result and the Repeater's item source. `@noodl/runtime/src/collection`.
 *
 * **A Collection is a real `Array`** (`class Collection extends Array`), and the members
 * below that a plain array does not have are installed by `collection.js` onto
 * `Array.prototype` itself, for *every* array in the process. That is not incidental
 * tidiness — it is load-bearing. Nodes bind to their `items` input by calling
 * `value.on('change', …)` without first checking what `value` is, so a plain JavaScript
 * array arriving from a Function node has to answer `on`, `size` and `set` too. Anything
 * that "cleans up" the patch into an ordinary class breaks every one of those nodes, and
 * it breaks them at runtime, in the viewer, where no type-check will have said a word.
 *
 * The consequence for typing: an `items` port carries a `CollectionLike` in practice
 * whatever the author connected, so annotate the field rather than narrowing the input.
 *
 * `set` is a *diff*, not an assignment — it removes, reorders and adds so that identity is
 * preserved for entries present in both, which is what lets the Repeater keep mounted
 * components alive across an update. Entries that are not already Models are passed
 * through `Model.create` on the way in.
 */
export interface CollectionLike extends Array<ModelLike> {
  readonly id: string;
  getId(): string;
  /**
   * The collection as a notifying view. Present because node code and `getInspectInfo` read
   * `collection.items`; assigning to it is the same as calling {@link set}.
   *
   * NDA-002: this used to hand back the raw backing array, so anything a caller did through
   * it (`items.push(x)`, `items[0] = x`) was invisible to listeners. It returns the same
   * write-through Proxy that `Collection.get`/`create` hand out, which is why it is now
   * typed as a `CollectionLike` and why `arr.items === arr` for any collection a consumer
   * holds.
   */
  items: CollectionLike;
  size(): number;
  get(index: number): ModelLike | undefined;
  each(callback: (item: ModelLike, index: number) => void): void;
  contains(item: ModelLike): boolean;
  /** Diffs `src` into this collection. `undefined` is treated as an empty list. */
  set(src: ArrayLike<ModelLike | Record<string, unknown>> | CollectionLike | undefined): void;
  /**
   * The four mutators are **synchronous**: every listener has run by the time the call
   * returns, exactly as for {@link ModelLike.set}. They used to be `async` and to `await`
   * each listener, so the mutation settled a turn after the call site expected; NDA-002's
   * third clause retired that. `await`ing one is harmless and does nothing.
   */
  add(item: ModelLike): void;
  addAtIndex(item: ModelLike, index: number): void;
  remove(item: ModelLike): void;
  removeAtIndex(index: number): void;

  on(event: 'add' | 'remove', listener: (args: CollectionChangeEvent) => void): void;
  on(event: 'change', listener: () => void): void;
  off(event: 'add' | 'remove', listener: (args: CollectionChangeEvent) => void): void;
  off(event: 'change', listener: () => void): void;
  notify(event: string, args?: unknown): void;
}

/**
 * The `@noodl/runtime/src/collection` module object — the factory side of
 * {@link CollectionLike}.
 *
 * Unlike {@link ModelModule.instanceOf}, {@link instanceOf} here is a plain
 * `instanceof` test and so is null-safe *and* narrow: a plain array that carries every
 * patched member is still not a `Collection`. Code that must accept both should test the
 * member it needs, not the constructor.
 */
export interface CollectionModule {
  new (): CollectionLike;
  readonly prototype: CollectionLike;
  /** Fetches — or, for an unknown or omitted id, *creates* — the collection. */
  get(id?: string): CollectionLike;
  /** A fresh collection with a generated id, seeded via {@link CollectionLike.set}. */
  create(items?: ArrayLike<ModelLike | Record<string, unknown>> | CollectionLike): CollectionLike;
  instanceOf(value: unknown): value is CollectionLike;
  exists(id: string): boolean;
}

/** The subset of `NodeContext` node definitions actually reach for. */
/**
 * One failure, structured — the payload of the runtime error channel.
 * See `dev-docs/reference/FAILURE-CONTRACT.md`.
 *
 * Published here rather than kept inside `noodl-runtime` because it is an interface in both
 * directions: node definitions build the `detail`, and the `On App Error` node hands the
 * whole event out on an `object` output for authors to log or forward.
 */
export interface RuntimeErrorEventLike {
  nodeId: string;
  componentName: string;
  nodeType: string;
  /** Stable, kebab-case, namespaced by node type — `'run-tasks/no-completion-output'`. */
  code: string;
  message: string;
  /** Optional structured payload. Must be safe to serialise — cloud and export paths JSON it. */
  detail?: unknown;
}

export interface RuntimeErrorSubscriptionLike {
  unsubscribe(): void;
}

/**
 * The runtime error channel, as node definitions see it.
 *
 * Nodes *raise* through {@link NodeInstance.raiseRuntimeError}, never through this. Direct
 * access is for the handful of nodes that need to observe every failure — `On App Error` is
 * the one in the standard library.
 */
export interface RuntimeErrorBusLike {
  subscribe(subscriber: (event: RuntimeErrorEventLike) => void): RuntimeErrorSubscriptionLike;
  unsubscribe(subscriber: (event: RuntimeErrorEventLike) => void): void;
  readonly hasSubscribers: boolean;
}

export interface NodeContextLike {
  editorConnection?: EditorConnectionLike;
  /**
   * The runtime error channel. Present in every context — editor, deployed browser app,
   * cloud runtime, SSR and exported code — which is the whole point of it, and the reason
   * it is not `editorConnection.sendWarning`.
   */
  errorBus: RuntimeErrorBusLike;
  /**
   * Runtime lifecycle events. The one node definitions listen for is
   * `'applicationDataReloaded'`, which is their cue to drop listeners they registered
   * against the previous project data.
   */
  eventEmitter: RuntimeEventEmitter;
  /**
   * The Event Sender / Event Receiver channel bus, keyed by channel name. Separate from
   * {@link eventEmitter} so application events cannot collide with lifecycle ones.
   */
  eventSenderEmitter: RuntimeEventEmitter;
  /**
   * Project-level style tokens. Present in the browser viewer; absent in the cloud runtime,
   * so guard before use.
   */
  styles?: StylesLike;
  /** The frame-driven timer service. Delay, animation and transition nodes all use it. */
  timerScheduler: TimerScheduler;
  /**
   * Broadcasts an event to every Event Receiver in the project, regardless of scope.
   * The scoped alternative is {@link NodeScopeLike.sendEventFromThisScope}.
   */
  sendGlobalEventFromEventSender(channelName: string, inputValues: unknown): void;
  /** Runs `callback` at the start of the next frame. */
  scheduleNextFrame(callback: () => void): void;
  /**
   * Opens `popupComponent` in the viewer's popup layer. `args.senderNode` scopes the
   * popup to the opener's component; `args.onClosePopup` receives the close action and
   * result values a Close Popup node sends back. Resolves once the popup is created.
   * No-ops (resolving immediately) where no popup layer is attached, e.g. the cloud
   * runtime.
   */
  showPopup(popupComponent: string, params: Record<string, unknown>, args?: unknown): Promise<void>;
  /**
   * Runs `callback` at the end of the current update, once every dirty node has been
   * processed. The escape hatch for work that needs the whole node tree to exist — the
   * Parent Component Object node uses it because its parent's scope may not be built yet
   * when its own `nodeScopeDidInitialize` runs.
   */
  scheduleAfterUpdate(callback: () => void): void;
  /**
   * Whether the editor wants warnings of this kind. Guard `editorConnection.sendWarning`
   * with it — the categories are user-toggleable.
   */
  isWarningTypeEnabled(warningType: string): boolean;
  /**
   * Flushes the dirty-node queue synchronously, right now.
   *
   * DOM event handlers are the caller that matters: a click arrives outside the
   * runtime's own update loop, so whatever inputs the handler queued would otherwise
   * sit unprocessed until the next scheduled frame. `pointerlisteners` wraps every
   * pointer callback in a call to this so a click takes effect in the same turn.
   */
  updateDirtyNodes(): void;
  /**
   * Project-wide values shared by name, behind the deprecated Globals node.
   *
   * Reset on every `applicationDataReloaded`. The current mechanism is the Variable
   * node, which keeps its values in a {@link ModelLike} instead.
   */
  globalValues: Record<string, unknown>;
  /**
   * Notifies listeners that a global changed, one event per global *name*.
   *
   * Its max-listener cap is raised to a million at construction, because a project
   * can hold arbitrarily many readers of one global.
   */
  globalsEventEmitter: RuntimeEventEmitter;
  /** Writes {@link globalValues} and emits `name` on {@link globalsEventEmitter}. */
  setGlobalValue(name: string, value: unknown): void;
  getGlobalValue(name: string): unknown;
  [extra: string]: unknown;
}

/** How far a scoped event travels from the scope that sent it. */
export type EventPropagation = 'parent' | 'children' | 'siblings' | null | undefined;

/**
 * A node that can sit at the top of a component, as {@link ComponentInstanceLike.getRoots}
 * hands it back.
 *
 * Both members are optional because a component's roots are not all the same kind of thing,
 * and the code that walks upwards tests for each in turn: an ordinary visual node has
 * `getVisualParentNode`, a nested component instance has `parentNodeScope`, and a logic node
 * at the root of a non-visual component has neither.
 */
export interface ComponentRootNode extends NodeInstance {
  /** Present on visual nodes. Returns `undefined` at the top of the visual tree. */
  getVisualParentNode?(): NodeInstance | undefined;
  /** Present on component-instance nodes: the scope this instance itself lives in. */
  parentNodeScope?: NodeScopeLike;
}

/**
 * The Component Instance node that owns a node scope — `nodeScope.componentOwner`.
 *
 * Two things node definitions use it for. Its `name` is the first argument of every
 * `editorConnection.sendWarning`/`clearWarning` call, because that is how the editor knows
 * which component to draw the warning in. And `getInstanceId()` is the key that
 * component-scoped state is stored under: the Component Object node keys its
 * {@link ModelLike} on `'componentState' + getInstanceId()`, which is what makes one
 * component's state distinct per instance rather than per component.
 *
 * Walking *up* from here is deliberately awkward, and both ways matter. A component
 * instance mounted inside another node's visual tree is reached through its roots'
 * `getVisualParentNode()`; one that is not visual is reached through `parentNodeScope`.
 * `parentcomponentobject.js` and `setparentcomponentobjectproperties.js` each implement
 * that walk.
 */
export interface ComponentInstanceLike extends NodeInstance {
  /** The component's name, as the editor shows it. */
  readonly name: string;
  /** Identity of this *instance*. Distinct instances of one component get distinct ids. */
  getInstanceId(): string;
  /** The nodes at the top of this component. Empty for a component with no root node. */
  getRoots(): ComponentRootNode[];
  /** Visual parent, when this instance is mounted inside another node's tree. */
  parent?: NodeInstance;
  /** The scope this instance itself lives in — one level up from {@link nodeScope}. */
  parentNodeScope?: NodeScopeLike;

  /**
   * The record this component instance was repeated for, when a Repeater created it.
   *
   * Set as an `extraProps` entry on `nodeScope.createNode`, so it is present only on
   * instances the Repeater (or Run Tasks) made. It is the runtime's *ambient item*
   * protocol, not a private field of the Repeater: the Object, Record and Function nodes
   * all resolve "the current item" by walking `parentNodeScope` upwards until they find a
   * `componentOwner` that has one — see `javascriptnodeparser.js` and `modelcrudbase.js`.
   * Anything that renames or stops setting it silently strips that ambient item from
   * every node inside a Repeater template.
   */
  _forEachModel?: ModelLike;
  /** The Repeater instance that created this one. Set alongside {@link _forEachModel}. */
  _forEachNode?: NodeInstance;

  /**
   * Present on a component instance that was opened as a popup: how to close it.
   *
   * Set by `NodeContext.showPopup`. `Close Popup` resolves *upwards* to the nearest
   * ancestor carrying one, which is what lets it work from anywhere inside the popup's
   * tree rather than only from the popup's own top-level scope (NDA-010 §2). Like
   * {@link _forEachModel} this is an ambient protocol, not a private field — see
   * `dev-docs/reference/BINDING-CONTRACT.md`.
   */
  _popupCloseHandler?(action: string | undefined, results: Record<string, unknown>): void;

  [extra: string]: unknown;
}

/** The subset of `NodeScope` node definitions actually reach for. */
export interface NodeScopeLike {
  componentOwner: ComponentInstanceLike;
  /**
   * The record store this scope's nodes read and write, or `undefined` for the global one.
   * See {@link ModelScopeLike} — and note that every call site spells the fallback out as
   * `(nodeScope.modelScope || Model)`, because `undefined` is the common case.
   */
  modelScope?: ModelScopeLike;
  /** Every live instance of `name` in this scope. Does not descend into child scopes. */
  getNodesWithType(name: string): NodeInstance[];
  /**
   * Sends an event to a *related* scope rather than the whole project. Returns whether a
   * receiver consumed it. `sendEventInThisScope` is set by the recursive calls the runtime
   * makes as it walks up or down; node definitions leave it alone.
   */
  sendEventFromThisScope(
    eventName: string,
    data: unknown,
    propagation: EventPropagation,
    sendEventInThisScope?: boolean,
    _exclude?: unknown
  ): boolean | undefined;
  /**
   * Instantiates a node — or, when `name` is a component path, a whole component — inside
   * this scope. Asynchronous because a component may still need loading.
   */
  createNode(name: string, id?: string, extraProps?: Record<string, unknown>): Promise<NodeInstance>;
  /**
   * Instantiates a *primitive* node — one registered directly, never a component —
   * synchronously. The Component Stack and Router use it for their page container Groups,
   * and the Push transition for its dark overlay.
   */
  createPrimitiveNode(name: string, id?: string, extraProps?: Record<string, unknown>): NodeInstance;
  deleteNode(nodeInstance: NodeInstance): void;
  /**
   * The live instance with this id in this scope, or `undefined`. Ids here are *instance*
   * ids — the same id the graph model uses for a node the project persisted, but a
   * generated one for anything created at runtime.
   */
  getNodeWithId(id: string): NodeInstance | undefined;
  [extra: string]: unknown;
}

/** The editor channel, present only when running against a live editor. */
export interface EditorConnectionLike {
  isRunningLocally(): boolean;
  sendWarning(componentName: string, nodeId: string, key: string, warning: unknown): void;
  clearWarning(componentName: string, nodeId: string, key: string): void;
  /**
   * Replace the editor's idea of a node's ports. The `runtime-discovered` mechanism.
   *
   * The array elements are {@link RuntimeDiscoveredPort}s. The parameter stays `unknown[]`
   * rather than naming that type, because the call sites predate it and several build
   * their arrays as `Record<string, unknown>[]`; authors writing new ones should annotate
   * the array instead.
   */
  sendDynamicPorts(nodeId: string, ports: unknown[], options?: unknown): void;
  /**
   * What a scope-resolving node bound to, for the node card's sub-label
   * (`dev-docs/reference/BINDING-CONTRACT.md` §(b)). `undefined` clears it.
   *
   * Display text, not structure and not a warning — see `runtime/src/editorconnection.ts`.
   * Node definitions should go through `ResolvedTargetReporter` rather than calling this
   * directly, so that a graph node with several live instances reports one summary instead
   * of flickering between them.
   */
  sendNodeSubLabel(nodeId: string, subLabel: string | undefined): void;
  [extra: string]: unknown;
}

/** One wire out of an output port: the node it feeds, and which input of it. */
export interface OutputConnectionLike {
  node: NodeInstance;
  inputPortName: string;
}

/** An output port at runtime, as handed back by {@link NodeInstance.getOutput}. */
export interface OutputPropertyLike {
  readonly name: string;
  readonly value: unknown;
  /**
   * The live wire list, in registration order — not a copy.
   *
   * Reading it is how a node inspects what it is driving: the deprecated Animation
   * node samples `connections[0].node.getInputValue(connections[0].inputPortName)`
   * to discover the value it should animate *from*, which is the only way to start
   * an implicit animation at wherever the target currently is.
   */
  connections: OutputConnectionLike[];
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
  /**
   * Redundant on a statically declared input — a member of `inputs` is an input by
   * construction, and nothing reads this. It appears because dynamic-port payloads (the
   * objects handed to `sendDynamicPorts`) *do* need to say which side they belong to, and
   * the two shapes get written side by side. The Function node declares it on
   * `functionScript`; published so that stays expressible rather than silently dropped.
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

/**
 * One port in the editor's wire format — an element of the array handed to
 * {@link EditorConnectionLike.sendDynamicPorts}.
 *
 * This is the *imperative* half of the dynamic-port story and should not be confused with
 * {@link DynamicPortEntry}, which is the declarative `dynamicports` a definition carries.
 * An entry there tells the editor a rule; one of these tells it a fact, computed from the
 * project's own data — a record class's columns, a REST response's fields, a script's
 * discovered outputs — and replaces the node's whole port set each time it is sent.
 *
 * Unlike {@link InputPortDefinition}, `plug` is required: an editor-side port has to say
 * which side it belongs to, since there is no `inputs`/`outputs` object to place it in.
 */
export interface RuntimeDiscoveredPort {
  name: string;
  /**
   * `'input/output'` declares *one* port on each side under the same name, which the Object
   * node's `prop-…` ports and the editor's `detectRenamed` option both rely on. It has no
   * counterpart in {@link InputPortDefinition.plug}, where a port's side is decided by which
   * object it is declared in.
   */
  plug: 'input' | 'output' | 'input/output';
  /** Omitted means the editor's default, which is `'*'`. */
  type?: PortTypeSpec;
  displayName?: string;
  group?: string;
  default?: unknown;
  index?: number;
  tab?: PortTab;
  /** Groups this port under another in the property panel. */
  parent?: string;
  parentItemId?: string;
  /** Anything the editor understands but the runtime does not need to name. */
  [extra: string]: unknown;
}

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
 * One entry in a node type's {@link NodePanels} list.
 *
 * `name` must match a panel the editor has registered — `'PortEditor'` and
 * `'PropertyEditor'` are the two in the repository. Everything else on the entry is
 * forwarded to that panel as its `args`, so the remaining fields are panel-owned and
 * typed permissively on purpose; the ones below are what the in-repo entries carry.
 */
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

/**
 * Property-panel extras the editor renders for this node type.
 *
 * A **list**, not a record: `sidebarmodel.tsx` filters it for the first entry whose
 * `name` matches a registered panel, and falls back to `'PropertyEditor'` when none
 * does. The literal string `'none'` suppresses the sidebar entirely, and is checked
 * before the list is walked.
 */
export type NodePanels = NodePanel[] | 'none';

/**
 * Extra methods and accessors mixed into the node's prototype.
 *
 * Values may be plain functions or full property descriptors; `defineNode` normalises a
 * bare function to `{ value: fn }` before handing the object to `Object.create`. Note the
 * consequence: a descriptor whose `value` is falsy is re-wrapped, so descriptors of the
 * `{ get }` form work, but `{ value: 0 }` does not survive.
 */
export type PrototypeExtensions = Record<string, ((this: NodeInstance, ...args: any[]) => any) | PropertyDescriptor>;

/**
 * One entry in the editor's node inspector popup.
 *
 * `type` selects the renderer: `image` and `color` get dedicated ones, everything else
 * falls through to a JSON view for objects and a plain value view for primitives.
 */
export interface InspectInfoEntry {
  type?: 'text' | 'value' | 'image' | 'color' | (string & {});
  value: unknown;
  [extra: string]: unknown;
}

/**
 * What `getInspectInfo` may return.
 *
 * The editor's `InspectPopup` normalises in exactly three steps: a `string` becomes
 * `{ type: 'value', value }`, a non-array becomes a one-element array, and each entry is
 * then rendered by its `type`. An entry with no `value` key renders nothing, and the popup
 * hides itself when no entry has one.
 *
 * The consequence is worth stating plainly, because several nodes get it wrong: returning a
 * bare `boolean`, `number` or plain object — anything that is neither a string nor an
 * `{ type, value }` entry — produces an inspector that shows *nothing*. It is not an error
 * and never has been; the value simply has no `.value` property to read. Those sites are
 * typed against this union so the compiler says so, and are listed in PLAT-003 NOTES §13.
 */
export type InspectInfo = string | InspectInfoEntry | InspectInfoEntry[];

/**
 * How a node type behaves when the graph runs under server-side rendering
 * (RUN-002). Absent means `safe` — the audit annotates only the exceptions.
 *
 * - `safe`: runs server-side with full behavior.
 * - `partial`: runs server-side, but some behavior only completes in the
 *   browser (e.g. TimerScheduler never advances on the server, so a Delay
 *   never fires Finished). `note` states the caveat.
 * - `client-only`: the node's logic cannot run server-side at all. The SSR
 *   server creates the instance inert — ports exist so connections stay
 *   valid, but initialize is skipped, input setters are no-ops and outputs
 *   read `undefined` — and the browser runs it normally after hydration.
 */
export interface NodeSSRCompat {
  compat: 'safe' | 'partial' | 'client-only';
  /** Human-readable caveat, surfaced in the node catalog. */
  note?: string;
}

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
  tooltip?: PortTooltip;
  /** Copied verbatim from the authored port. See {@link PortTab}. */
  tab?: PortTab;
  popout?: unknown;
  allowVisualStates?: boolean;
  nodeDoubleClickAction?: unknown;
  /**
   * NDA-005 — the one-sentence description read by the catalog, the semantic validator and the
   * AI authoring loop. Distinct from {@link tooltip}, which is the editor's hover popup: a
   * heading plus paragraphs, and sometimes images, none of which flattens into a sentence.
   */
  description?: string;
}

/** An output port as it appears in compiled {@link NodeMetadata}. */
export interface OutputPortMetadata {
  type?: PortTypeSpec;
  displayName?: string;
  editorName?: string;
  group?: string;
  index?: number;
  exportToEditor: boolean;
  /** NDA-005. Outputs carry no `tooltip`, so this is their only documentation. */
  description?: string;
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
  docs?: string;
  searchTags?: string[];
  color?: NodeColorName;
  module?: string;
  version?: string;
  deprecated?: boolean;
  /** Server-side-rendering compatibility. Absent means `safe`. */
  ssr?: NodeSSRCompat;

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

/**
 * The runtime's event emitter, as node modules use it.
 *
 * `emit` is asynchronous and sequential — it awaits each listener before calling the next.
 * Registering with a `ref` lets every listener belonging to that ref be dropped in one
 * call, which is how nodes detach from their models. See `eventsender.ts`.
 */
export interface EventSenderLike {
  on(eventName: string, callback: (data?: any) => unknown, ref?: unknown): void;
  removeListenersWithRef(ref: unknown): void;
  removeAllListeners(eventName?: string): void;
  emit(eventName: string, data?: unknown): Promise<void>;
}

/**
 * A node as the *graph model* sees it: the authored node the editor persisted, not a live
 * instance. `NodeInstance` is the running object; this is its blueprint.
 *
 * Only reachable from a {@link NodeModule.setup} function, and only when running against a
 * live editor — the graph model exists in deployed bundles but nothing pushes ports to it.
 *
 * The event a `setup` function almost always wants is `'parameterUpdated'`, emitted with
 * `{ name, value, state }` whenever a parameter changes.
 */
export interface GraphNodeModel extends EventSenderLike {
  readonly id: string;
  readonly type: string;
  /** Values the editor persisted for this node's input ports. */
  parameters: Record<string, unknown>;
  /** Per-visual-state parameter overrides. Absent until a state value is set. */
  stateParameters?: Record<string, Record<string, unknown>>;
  /** Per-state, per-parameter transitions. Merged with the node's variant, if any. */
  stateTransitions?: Record<string, Record<string, StateTransition>>;
  /** Fallback transition for every parameter of a state, keyed by state name. */
  defaultStateTransitions?: Record<string, StateTransition>;
  children: GraphNodeModel[];
  /**
   * Visual parent in the authored graph, or `undefined` at the top of a component.
   * Changes are announced as `'parentUpdated'` with the new parent (or `undefined`) —
   * the Repeater listens for it, because its items are added to its *parent*, not to
   * itself.
   */
  parent?: GraphNodeModel;
  /** Ports the editor knows about, keyed by port name. Includes dynamic ones. */
  inputPorts: Record<string, GraphPortModel>;
  outputPorts: Record<string, GraphPortModel>;
  /** Set by `ComponentModel.addNode`, so present on any node that reached the graph. */
  component?: ComponentModelLike;
  [extra: string]: unknown;
}

/** A port as recorded on a {@link GraphNodeModel}. */
export interface GraphPortModel {
  name: string;
  /** Either the bare type name or the configured object form — check both. */
  type: PortTypeSpec;
  /**
   * Four values reach this field, not two.
   *
   * `'input/output'` is a port that is both — the Object node depends on it, which is why
   * {@link RuntimeDiscoveredPort.plug} admits it too. `'outputs'` is a *misspelling* that
   * exists in real exported projects: `NodeModel.createFromExportData` rewrites it to
   * `'output'` on the way in, so nothing downstream has to know, but the field genuinely
   * holds it until that runs.
   */
  plug?: 'input' | 'output' | 'input/output' | 'outputs';
  [extra: string]: unknown;
}

/** One component in the graph model. */
export interface ComponentModelLike extends EventSenderLike {
  readonly name: string;
  nodes: GraphNodeModel[];
  /** Ids of the component's root nodes. */
  roots: string[];
  /**
   * The component's *own* ports — what an instance of it exposes to the graph around it,
   * not the ports of the nodes inside it. Keyed by port name.
   *
   * A `setup` function that mirrors another component's interface has to track these
   * rather than read them once: the six `inputPortAdded`/`outputPortAdded`/
   * `…PortRemoved`/`…PortTypesUpdated` events all fire as the author edits, and the
   * Repeater re-derives its forwarded item outputs from each one.
   */
  inputPorts: Record<string, GraphPortModel>;
  outputPorts: Record<string, GraphPortModel>;
  /**
   * Accessors for {@link inputPorts} / {@link outputPorts}. They return the live record,
   * not a copy — `componentmodel.js` returns the field directly, exactly as
   * {@link getRoots} does.
   */
  getInputPorts(): Record<string, GraphPortModel>;
  getOutputPorts(): Record<string, GraphPortModel>;
  getNodeWithId(id: string): GraphNodeModel | undefined;
  getAllNodes(): GraphNodeModel[];
  getNodesWithType(type: string): GraphNodeModel[];
  /**
   * The same array as {@link roots} — `componentmodel.js` returns it directly rather
   * than a copy, so callers must not mutate the result. Paired with the `rootAdded`
   * and `rootRemoved` events, which carry the affected node id.
   */
  getRoots(): string[];
  [extra: string]: unknown;
}

/**
 * One entry in the exported router index's `pages` list.
 *
 * Produced by `getRouterIndex` in the editor's exporter and read back by the viewer's
 * router at navigation time, which is why it is described here rather than on either side.
 */
export interface RouterPageInfo {
  /** URL path, with `{param}` placeholders for every declared path parameter. */
  path: string;
  title: string;
  /** Full component name, e.g. `/Pages/Article`. */
  component: string;
}

/**
 * The index of routers and pages shipped alongside the graph.
 *
 * It exists so the viewer can resolve a URL to a component *without* loading the whole
 * project: the bundle for a page is fetched only once that page is navigated to.
 */
/**
 * One Router node's parameters, spread verbatim into the index.
 *
 * Only `name` and `pages` are named: those are what the viewer's router reads back when
 * resolving a URL. Everything else a Router node carries passes through the index
 * signature.
 */
export interface RouterIndexEntry {
  name?: string;
  /** The routes control's value: the component names this router can show. */
  pages?: { routes?: string[] };
  [parameter: string]: unknown;
}

export interface RouterIndex {
  /** Each Router node's parameters, spread verbatim. Only named routers are included. */
  routers: RouterIndexEntry[];
  pages: RouterPageInfo[];
}

/**
 * Project settings as the *runtime* reads them.
 *
 * Only the keys the runtime itself branches on are named; the editor's settings panel
 * writes many more (`htmlTitle`, `headCode`, …) and they pass through the index signature.
 */
export interface ProjectSettingsValues {
  /** Lets the page router scroll the document body rather than an inner element. */
  bodyScroll?: boolean;
  /** Repeaters stop reacting to collection changes while unmounted. */
  repeaterDisabledWhenUnmounted?: boolean;
  /** Repeaters build their child components across frames instead of in one pass. */
  repeaterCreateComponentsAsync?: boolean;
  navigationPathType?: string;
  [setting: string]: unknown;
}

/**
 * The viewer's user service, as the *runtime* and the cloud runtime see it.
 *
 * The class itself lives in `noodl-viewer-react` and is hung on
 * `NoodlRuntime.Services.UserService` at import time. It cannot be described there,
 * because `@noodl/runtime` and `noodl-viewer-cloud` both reach it and neither depends on
 * the react viewer — so the shared surface is named here, once, and the implementation
 * satisfies it.
 *
 * Only what a cross-package consumer calls is declared. Everything the react viewer's own
 * nodes use they reach through the concrete class.
 */
export interface UserServiceLike {
  /** The signed-in user, or undefined. Read directly by the cloud runtime's Request node. */
  current?: ModelLike;
  fetchCurrentUser(options: {
    sessionToken?: string;
    success(response?: unknown): void;
    error(error?: unknown): void;
  }): void;
}

/** The factory side: one service per model scope, so a sandbox gets its own. */
export interface UserServiceModule {
  forScope(modelScope: unknown): UserServiceLike;
}

/** The backend credentials a deployed project carries in its metadata. */
export interface CloudServicesMetaData {
  endpoint: string;
  appId: string;
  [extra: string]: unknown;
}

/**
 * The project's metadata block, keyed by what the runtime actually stores in it.
 *
 * Named keys are the ones read by more than one call site; anything else falls through the
 * index signature as `unknown`, which is what an unrecognised key genuinely is.
 */
export interface ProjectMetaData {
  cloudservices?: CloudServicesMetaData;
  backendServices?: unknown;
  dbCollections?: unknown;
  systemCollections?: unknown;
  dbConfigSchema?: unknown;
  dbVersionMajor?: unknown;
  appConfig?: unknown;
  styles?: unknown;
  [key: string]: unknown;
}

/**
 * The project's whole node graph, as a {@link NodeModule.setup} function sees it.
 *
 * Beyond the query methods, `setup` functions subscribe to *type-scoped* events: the model
 * emits both `'nodeAdded'` and `'nodeAdded.<node type>'`, and likewise for `'nodeRemoved'`
 * and `'nodeWasRemoved'`. Subscribing to the scoped form is how a node type learns about
 * its own instances without filtering.
 */
export interface GraphModelLike extends EventSenderLike {
  /** Keyed by component name. */
  components: Record<string, ComponentModelLike>;

  getNodesWithType(type: string): GraphNodeModel[];
  getAllNodes(): GraphNodeModel[];
  getComponentWithName(name: string): ComponentModelLike | undefined;
  hasComponentWithName(name: string): boolean;
  getAllComponents(): ComponentModelLike[];
  getSettings(): Record<string, unknown>;
  getMetaData(key: string): unknown;
  getRootComponentName?(): string | undefined;
  [extra: string]: unknown;
}

/**
 * What a node *file* exports, and what `NoodlRuntime.registerNode` accepts.
 *
 * Almost every node file in the standard library exports this shape. `registerNode`
 * compiles `node` with `defineNode` and registers the result; a module with no `node` is
 * treated as an already-compiled {@link NodeDefinition} and registered as-is.
 *
 * `setup` runs once, at registration, and is the node type's hook into the *project* rather
 * than into any one instance. It is where `runtime-discovered` dynamic ports come from:
 * subscribe to the graph model, read the parameters the author typed, and push the
 * resulting port set back with `editorConnection.sendDynamicPorts`. Guard it with
 * `editorConnection.isRunningLocally()` — there is no editor to talk to in a deployed app.
 */
export interface NodeModule {
  node?: NodeDefinitionOptions;
  setup?(context: NodeContextLike, graphModel: GraphModelLike): void;
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
