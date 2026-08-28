/**
 * Component analysis — EXP-002 step 4's decision stage, extended by step 5. Parsing recorded
 * what the project says; this walks each component's visual tree and decides what the generator
 * will do about it: which nodes render (and as what), which collapse, which become stubs, and
 * which defer to EXP-003. Dispositions are analysis output about the graph, never facts of it
 * (IR design).
 *
 * Step 5 adds the app-state constructs (EXP-002-STEP5-TARGET-OUTPUT.md): Variables become the
 * stores module, Send/Receive Event pairs become channels, and signal wires compile into
 * handler *actions* — a navigate, a store `.set`, a channel `.emit` — attached to whichever
 * handler owns the triggering signal (a rendered element's DOM event, or a receiver's
 * `useSignal`). Value wires resolve by sink context: the same `Variable2.value` read is a
 * `useValue` hook in rendered content and a `.get()` snapshot inside a handler.
 *
 * Step 6 adds statically-knowable logic (EXP-002-LOGIC-TARGET-OUTPUT.md): String Format and
 * Condition resolve into *expression trees* over the same source vocabulary, rendered inline
 * wherever their output lands — the `derived()` row of EXP-001's table compiled away, because
 * the hooks a component already earns are the reactivity a Derived would provide. A Condition
 * in a handler chain (`trigger → eval`, `ontrue → sink`) becomes a branch action — an `if`
 * statement in the trigger's handler — and only when the author unticked Run On Value Change,
 * because Evaluate is additive and an onClick cannot carry on-change firing.
 *
 * Everything here is pure decision-making over the IR; no text is generated. The emit layer
 * (emit/component.ts) turns a ComponentPlan into TSX/CSS.
 */

import { CatalogIndex } from '../catalog';
import { ComponentIR, ConnectionIR, Disposition, ExportIR, KitNodeIR, ModuleIR, NodeIR } from '../ir/types';
import { componentReachability, Reachability } from './reach';
import { routedPages } from '../emit/scaffold';
import { pascalCase } from '../emit/naming';
import { CONTENT_PARAMS, iconSourceOf, StyleRole } from '../emit/style';
import {
  expressionIdentifiersOf,
  functionMinedPortsOf,
  jsBodyOf,
  jsNodeKindOf,
  jsPurityDefer,
  JS_EXPRESSION,
  JS_FUNCTION
} from './jsfun';
import {
  censusOf,
  hasProgram,
  isVisualFunction,
  visualGateOf,
  visualIoOf,
  workspaceOf,
  VISUAL_FUNCTION_LABEL
} from './logicbuilder';
import {
  AppStateRegistry,
  ChannelPlan,
  collectAppState,
  collectionNameOf,
  CollectionPlan,
  GLOBAL_STORE,
  GLOBAL_STORE_SET,
  GLOBAL_STORE_SUBSCRIBE,
  initialStateOf,
  InsertChain,
  insertChainOf,
  isTextInputType,
  payloadKeysOf,
  StorePlan,
  storeNameOf,
  subscribeKeysOf,
  VariablePlan
} from './appState';

export type {
  ChannelPlan,
  CollectionKeyPlan,
  CollectionPlan,
  StoreKeyPlan,
  StorePlan,
  VariablePlan
} from './appState';

/**
 * How a node participates in the render, or null for pure logic nodes.
 *
 * `'custom'` is EXP-010's: a visual node from a `noodl_modules` kit. It is its own role rather
 * than a `StyleRole` because a kit node has no Noodl style ports at all — every parameter on one
 * is a port the kit itself declared (measured across every project on this machine: not one custom
 * node carries a `width`, a `margin` or a `backgroundColor`), so the style tables have nothing to
 * say about it and `computeNodeStyle` must not be asked.
 */
export type RenderRole = StyleRole | 'instance' | 'repeater' | 'custom';

/** The per-component-instance record node (COMPONENT-OBJECT-TARGET; componentobject.ts). */
const COMPONENT_OBJECT = 'net.noodl.ComponentObject';

/**
 * The record verbs (RECORD-VERBS-TARGET) — one node assembled three ways by
 * `dbmodelcrudbase`'s mixins, and the first asynchronous action in the vocabulary.
 */
const RECORD_VERBS: Record<string, 'create' | 'update' | 'delete'> = {
  NewDbModelProperties: 'create',
  SetDbModelProperties: 'update',
  DeleteDbModelProperties: 'delete'
};

/**
 * The two relation verbs (RECORD-VERBS-TARGET §17) — the same `dbmodelcrudbase` assembly with
 * `addRelationProperty` mixed in, which is what gives them a `relationProperty` dropdown and a
 * `targetId` input, and what makes `validateInputs` the whole of their pre-flight.
 */
const RELATION_VERBS: Record<string, 'add' | 'remove'> = {
  AddDbModelRelation: 'add',
  RemoveDbModelRelation: 'remove'
};

/**
 * The node types whose `Id` output names a record the app has actually *loaded*.
 *
 * NDA-012 (Data): `AddDbModelRelation.targetCollection` reads the target's class off
 * `Model.get(targetModelId)`, and `Model.get` **mints a record on read** — so an id that came
 * from a text input or a URL parameter resolves to a record nothing ever loaded, whose class is
 * `undefined`. The runtime refuses that case rather than sending a class-less pointer, because
 * the failing write is what burns the relation column into the class schema as
 * `Relation<undefined>` for the life of the class. Statically, these two are the only outputs
 * that can satisfy it.
 */
const LOADED_RECORD_SOURCES = new Set(['DbModel2', 'DbCollection2']);

/**
 * The user family's three *actions* (USER-FAMILY-TARGET §1) — the record verbs' shape again,
 * with `UserService` where `cloudStore` was: one trigger, value inputs that accumulate without
 * triggering, an `error` output that is never cleared, and `done` after the service answers.
 *
 * ⚠️ **Log Out's trigger port is spelled `login`**, not `logout`. That is not a transcription
 * slip — `logout.ts` says the name "is persisted in every project that uses this node, so it
 * cannot be corrected without breaking them".
 */
const USER_VERBS: Record<
  string,
  { verb: 'login' | 'logout' | 'signup'; trigger: string; fnName: string; inputs: string[] }
> = {
  'net.noodl.user.LogIn': { verb: 'login', trigger: 'login', fnName: 'logIn', inputs: ['username', 'password'] },
  'net.noodl.user.LogOut': { verb: 'logout', trigger: 'login', fnName: 'logOut', inputs: [] },
  'net.noodl.user.SignUp': {
    verb: 'signup',
    trigger: 'signup',
    fnName: 'signUp',
    inputs: ['username', 'password', 'email']
  }
};

/** The `User` node's outputs this slice reads off the session stub (USER-FAMILY-TARGET §4c). */
const SESSION_READS: Record<string, { field: 'id' | 'username' | 'email'; maybeUndefined: boolean } | 'authenticated'> =
  {
    authenticated: 'authenticated',
    id: { field: 'id', maybeUndefined: true },
    username: { field: 'username', maybeUndefined: true },
    email: { field: 'email', maybeUndefined: true }
  };

export type BindingSource =
  | { kind: 'prop'; name: string }
  | { kind: 'store'; variableName: string }
  | { kind: 'store-key'; storeName: string; key: string }
  | { kind: 'computed'; expr: ValueExpr }
  | { kind: 'unresolved'; fromId: string; fromProperty: string };

/**
 * A value read inside a handler or binding, resolved to what the generated code can actually
 * say. `input-text` and `payload` are context-bound: they only exist inside the owning input's
 * onChange and the owning receiver's handler respectively — attachment validates that.
 *
 * Step 6's additions compose: `format` is a String Format resolved to alternating static text
 * and sub-expressions (a template literal at emit), and `store-key-get` is a single-key
 * Subscribe read usable in either context (the selector hook local in render, `.get().<key>`
 * in a handler).
 *
 * The boolean kinds (`logical`, `not`, `truthy` — LOGIC-TARGET §6) are truthiness devices:
 * their short forms (`a && b`, `!x`, the bare operand) are truthiness-equal to the runtime's
 * strict-boolean outputs, not value-equal, so analysis admits them into truthiness sinks only
 * (a Condition's test, another logical's operand, the `enabled` render sink). `truthy` marks a
 * Condition's `result` — provenance the value-sink gates need, emitted as the bare condition.
 *
 * `undefined` is a Component Object property's boot value (COMPONENT-OBJECT-TARGET §3): the
 * record boots empty and no wire writes the key, so the read is the constant the runtime
 * would deliver. It is maybe-undefined by definition and folds at its sinks the way the
 * runtime folds it — format parts to '', truthiness to false, render children/attrs to the
 * empty/omitted form.
 */
export type ValueExpr =
  | { kind: 'prop'; name: string }
  | { kind: 'input-text'; inputId: string }
  | { kind: 'store-get'; variableName: string }
  | { kind: 'store-key-get'; storeName: string; key: string }
  | { kind: 'payload'; key: string; receiverId: string }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'format'; parts: Array<string | ValueExpr> }
  | { kind: 'logical'; op: 'and' | 'or'; operands: ValueExpr[] }
  | { kind: 'not'; operand: ValueExpr }
  | { kind: 'truthy'; operand: ValueExpr }
  | { kind: 'undefined' }
  /**
   * A re-hosted Function/Expression output (EXP-003 §4): in render it reads the node's render
   * local (`formatShoutOut.text`); in a handler it inlines the call over `.get()` snapshots —
   * legal because the gate admits only pure bodies, so recomputation is unobservable. `fold`
   * carries Expression's typed getters (`asString` → `String(x ?? '')`, `asNumber` →
   * `Number(x) || 0`, `asBoolean` → `!!x` — expression.ts, verbatim semantics). `viaState` is
   * the 4f landing zone (CONTROLLED-STATE-TARGET): an *invoked* node whose outputs feed render
   * sinks materializes its output record as a state var, and render reads go through it
   * (`stockCheckOut?.warning`) — maybe-undefined until the first invocation, the runtime's own
   * pre-first-run contract.
   */
  | { kind: 'jsfun-out'; nodeId: string; output: string; fold?: 'string' | 'number' | 'boolean'; viaState?: string }
  /**
   * A state var read (CONTROLLED-STATE-TARGET §3.2): the render closure's value in both render
   * and handler positions. Inside a handler chain the attachment pass applies the chain-local
   * snapshot rule — a read after a `state-set` in the same chain is rewritten to the written
   * expression, because the runtime updates state synchronously mid-chain and React closures
   * do not.
   */
  | { kind: 'state-get'; name: string; maybeUndefined?: boolean }
  /**
   * The user-path value inside a control's own onChange (CONTROLLED-STATE-TARGET §4c) — the
   * `input-text` context rule generalized per control role: `event.target.checked` for a
   * checkbox, `Number(event.target.value)` for a range, `event.target.value` for a dropdown.
   */
  | { kind: 'control-event'; controlId: string; form: 'string' | 'checked' | 'number' }
  /**
   * A read of the signed-in user (USER-FAMILY-TARGET §4c) — the `User` node's outputs, which are
   * getters over the session rather than stored values. `authenticated` is
   * `model !== undefined` in the runtime, so it is a real boolean and lands at value sinks as
   * well as truthiness ones; the other three are `model.get(…)` and read undefined while nobody
   * is signed in, which is exactly the state the stub reports.
   */
  | { kind: 'session-get'; nodeId: string; field: 'authenticated' | 'id' | 'username' | 'email' }
  /**
   * A named client-side array, read as a list (EXP-011 Tier 1.1).
   *
   * The collections slice could reach a named array only as a repeater's feed, through
   * {@link RepeaterPlan.itemsCollectionName} — a dedicated field, not an expression. That was
   * enough while `For Each` was the only consumer; `Array Filter` and `Array Map` are a second
   * and third, and they compose (`notes → filter → map → For Each`), which a per-consumer field
   * cannot express. So the array becomes an ordinary value expression and the transforms are
   * ordinary functions of it.
   *
   * In render it is the `useCollection` local, so the component re-renders when the array
   * changes; in a handler it is `.peek()` — a read that deliberately creates no dependency edge,
   * which is what a handler wants and what `Collection.get()` would get wrong.
   */
  | { kind: 'collection-get'; collectionName: string }
  /**
   * `Array Map` over a list (EXP-011 Tier 1.1) — `mapcollectionnode.ts`'s `map({…})` with every
   * mapping a **property name**, which is `m.set(key, model.get(mapping))` in the runtime and
   * `{ key: row.mapping }` here.
   *
   * ⚠️ A mapping whose value is a *function* is arbitrary JavaScript over a live `Model` and
   * defers to EXP-003 — {@link parseIdentityMapping} answers null for it, which is the same
   * gate `For Each`'s own mapping script goes through.
   */
  | { kind: 'list-map'; source: ValueExpr; entries: Array<{ key: string; field: string }> }
  /**
   * `Array Filter` over a list (EXP-011 Tier 1.1) — the panel-authored filter, sort and
   * skip/limit, which are `filterSettings` and not a script (`filtercollectionnode.ts`).
   *
   * Each piece is optional and they compose in the runtime's own order: filter, then sort, then
   * skip, then limit (`scheduleFilter`). Emitting them in any other order would silently change
   * which rows survive a limit.
   */
  | {
      kind: 'list-filter';
      source: ValueExpr;
      tests: Array<{ field: string; op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'; value: string | number | boolean }>;
      sort: Array<{ field: string; direction: 'ascending' | 'descending' }>;
      skip?: number;
      limit?: number;
    };

export type HandlerAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'emit'; channelName: string; payload: Array<{ key: string; expr: ValueExpr }> }
  | { kind: 'store-set'; variableName: string; expr: ValueExpr }
  | { kind: 'globalstore-set'; storeName: string; key: string; expr: ValueExpr }
  | { kind: 'collection-add'; collectionName: string; entries: Array<{ key: string; expr: ValueExpr }> }
  /**
   * `Clear Array` (EXP-011 Tier 1.1) — `notes.clear()`, plus the two chains the runtime's own
   * outcome fork owes.
   *
   * `collectionnode-clear.ts` measures `wasEmpty` **before** `set([])` and reports `unchanged`
   * for an array that was already empty, `done` otherwise (ERG-001: "the post-condition already
   * held"). So a `done` chain emitted unconditionally would fire where the interpreter stays
   * silent. The emitted form tests the length instead of keeping a local, which is exact rather
   * than merely close: `Collection.clear()` is itself `if (length === 0) return`, so skipping
   * the call on the empty arm is the same no-op the guard would have made.
   */
  | { kind: 'collection-clear'; collectionName: string; then: HandlerAction[]; unchangedThen: HandlerAction[] }
  /** A Condition in a handler chain: `if (cond) whenTrue; else whenFalse;` (LOGIC-TARGET §3). */
  | { kind: 'branch'; cond: ValueExpr; whenTrue: HandlerAction[]; whenFalse: HandlerAction[] }
  /** Fires the component's own signal output: `onWaved?.()` (COMPONENT-OUTPUTS-TARGET §4). */
  | { kind: 'output-signal'; prop: string }
  /**
   * Opens a popup slot: `setOpenPopup('AboutDialog')`, then the Show Popup's `done`-chain as
   * following statements in the same handler (POPUPS-TARGET §3).
   */
  | { kind: 'popup-show'; slotKey: string; then: HandlerAction[] }
  /**
   * Closes the enclosing popup through the reserved prop (POPUPS-TARGET §4): with a
   * `done`-chain, `if (onClose) { onClose('ok'); …then }`; without one, `onClose?.('ok')`.
   * `action` undefined is the plain `Close` (the runtime's `Closed` outcome).
   */
  | { kind: 'popup-close'; action?: string; then: HandlerAction[] }
  /**
   * A pure Function/Expression fired from a handler chain (EXP-003 §4 A2h): the actions its
   * `done` wires described, in wire order. The node's own compute needs no statement — output
   * reads inside the chain inline the call at their sinks, and a pure body run without reading
   * its outputs is unobservable. `done` is invocation-only in both runtimes, so this is exact.
   * `materialize` (CONTROLLED-STATE-TARGET §4f) names the state var the run writes when the
   * node's outputs also feed render sinks: `setStockCheckOut(stockCheck({ … }))` precedes the
   * chain, and render reads go through the var.
   */
  | { kind: 'jsfun-run'; nodeId: string; then: HandlerAction[]; materialize?: string }
  /**
   * A state var write (CONTROLLED-STATE-TARGET §3.3). `op` is a functional update
   * (`setX(v => !v)`) — immune to closure staleness, which is why Switch's `flip` and
   * Counter's arithmetic use it, never `expr`.
   */
  | { kind: 'state-set'; name: string; expr?: ValueExpr; op?: 'toggle' | 'inc' | 'dec' }
  /**
   * An awaited call into an api stub (RECORD-VERBS-TARGET §4, USER-FAMILY-TARGET §4e): the
   * vocabulary's asynchronous action. The emitted handler becomes `async`, the call is awaited,
   * `then` is the `done` chain — which is where `reportOutcomes(…, 'done')` sits in the runtime,
   * after the service answers — and the catch writes `errorState`, the node's `Error` output,
   * which the runtime never clears once set.
   *
   * ⚠️ **One kind, two families.** The record verbs and the user family emit the *same* action;
   * they differ only in `fnName` and in the shape of `args`. USER-FAMILY §4e records why this is
   * a rename of `record-op` rather than a sibling case beside it: a new discriminant recruits
   * every switch site silently and the wrong ones fail without throwing (s19's dispatcher trap),
   * whereas a rename is a compile error at each site until it is handled.
   */
  | {
      kind: 'api-call';
      nodeId: string;
      /** What produced the call — for notes and the stub's provenance line. */
      verb: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'signup';
      /** The api module's exported function: `createPuppy` / `updatePuppy` / `logIn` / `logOut`. */
      fnName: string;
      /**
       * The call's arguments, in position order. `updatePuppy(id, {…})` is `[expr, data]`,
       * `logIn(u, p)` is `[expr, expr]`, `logOut()` is `[]`.
       */
      args: ApiCallArg[];
      /**
       * Refuse before calling when the leading id argument is absent or empty, the way the
       * runtime does (RECORD-VERBS-TARGET §1): `setModelID` reads `undefined`/`null`/`''` as
       * *clear the binding*, after which every verb answers `setError('Missing Record Id')` and
       * never reaches the backend. Gate 9 already defers an id that is **statically** absent;
       * this is its dynamic twin, and the corpus reaches it because every emitted component prop
       * is optional, so an id wired from one is `string | undefined` at the call.
       *
       * False only where the guard is provably dead — a non-empty literal id, and every `create`,
       * which takes no id at all.
       */
      guardId: boolean;
      errorState: string;
      then: HandlerAction[];
    };

/**
 * One argument of an {@link HandlerAction} `api-call`: either a plain value, or the object
 * literal a record verb's `prop-*` set (and a Sign Up's credentials) collapses into.
 */
export type ApiCallArg =
  | { kind: 'expr'; expr: ValueExpr }
  | { kind: 'data'; props: Array<{ key: string; expr: ValueExpr }> };

/**
 * One re-hosted Function/Expression node (EXP-003-JS-TARGET-OUTPUT §4): the verbatim body plus
 * everything the wrapper reproduces of the runtime's contract — inputs arriving as a record,
 * assignments to `Outputs` publishing, script-declared signal outputs callable (as no-ops when
 * nothing consumes them, exactly as an unwired pulse lands nowhere).
 */
export interface JsFunctionPlan {
  nodeId: string;
  kind: 'function' | 'expression' | 'visual';
  /** Module-scope wrapper name — the sanitized node label, deduped per component file. */
  fnName: string;
  /** The verbatim body (Function), expression text (Expression) or generated code (Visual). */
  body: string;
  /**
   * The wrapper's input record, in script order: wire-fed inputs carry the resolved source,
   * literal `in-*` parameters fold, mined-but-unfed inputs stay fields so the body's reads
   * typecheck (they read `undefined`, exactly as a never-delivered runtime input does).
   */
  inputs: Array<{ name: string; tsType: string; expr?: ValueExpr }>;
  /** Function only: the Outputs record's value fields (mined + declared + consumed). */
  outputs: Array<{ name: string; tsType: string }>;
  /** Function only: signal outputs (mined call syntax / `outtype-*: signal`), seeded no-op. */
  signals: string[];
  /** Expression only: preamble Math aliases the expression references (`pi` → `Math.PI`). */
  mathAliases: string[];
  /**
   * Visual only: app-wide Variables the block program reads or writes, from the workspace's
   * `noodl_get_variable`/`noodl_set_variable` fields — never mined from the generated text.
   *
   * These become the `Noodl.Variables` facade the wrapper binds (LOGIC-BUILDER-TARGET §3.4):
   * the body keeps its verbatim `Noodl.Variables["x"]` reads and writes, and they land on the
   * export's own variables store. Every name here is registered in `ProjectPlan.variables`,
   * minted by the block program where no `Variable` node declares it.
   */
  variables?: string[];
  /**
   * reactive — no `run` wire: one render local per instance, recomputed per render (grade Q).
   * invoked — `run` wired: calls inline inside its own handler chain only (grade I).
   */
  mode: 'reactive' | 'invoked';
}

export interface ReceiverPlan {
  nodeId: string;
  channelName: string;
  /** Actions in trigger-wire source order — statement order in the useSignal handler. */
  actions: HandlerAction[];
}

/**
 * One `useState` row in the component (CONTROLLED-STATE-TARGET §3.1) — the first construct
 * that materializes state in the emitted component rather than compiling it away. Names live
 * in the component's one identifier space (props, hooks, wrappers — the stores rule).
 */
export interface StateVarPlan {
  name: string;
  setterName: string;
  /** The useState type parameter, `' | undefined'` included where the boot is undefined. */
  tsType: string;
  /** Boot value; null is the `undefined` boot (`useState<T | undefined>()`). */
  boot: string | number | boolean | null;
  originNodeId: string;
  origin: 'switch' | 'counter' | 'control' | 'lifted' | 'jsfun' | 'record-error' | 'variable';
  /** The provenance comment above the row. */
  comment: string;
}

/**
 * The graph path of a wired control-state input (CONTROLLED-STATE-TARGET §3.4): a useEffect
 * running the *input setter's* semantics — coercion, abstain guards, clamping, per §1's table —
 * and never the `Changed` chain (the runtime's own asymmetry).
 */
export interface SyncEffectPlan {
  stateName: string;
  source: ValueExpr;
  /**
   * The `variable-*` forms are the value Variables (EXP-011 Tier 1.4) reaching the same
   * construct from the other direction: their `value` input under Run On Value Change is a
   * graph path that stores without firing `Changed`, exactly as a control's is, so
   * `variablebase.setValueTo`'s table — abstain on `undefined`, `Treat empty as` on `null`,
   * `args.cast` otherwise, `NaN` banned — is written here as one more coercion. `variable-none`
   * is Color's identity cast.
   */
  coerce: 'checkbox' | 'slider' | 'dropdown' | 'textinput' | 'variable-string' | 'variable-number' | 'variable-boolean' | 'variable-none';
  /** Slider only: the literal clamp bounds (a wired min/max defers the node before this). */
  min?: number;
  max?: number;
  /** `variable-*` only: what a `null` arrival stores — the selected `Treat empty as` coercion. */
  empty?: string | number | boolean | null;
}

/**
 * The lifted value output's child side (CONTROLLED-STATE-TARGET §3.5, CO §6 built): a push
 * effect firing the optional callback prop on change and once at mount — the boot delivery a
 * parent wire gets from the interpreter, so the mount fire is the faithful part.
 */
export interface PushEffectPlan {
  prop: string;
  expr: ValueExpr;
}

/**
 * A reactive Condition (LOGIC-TARGET §10): the box is ticked, so the node re-tests on every
 * arrival on `condition` and fires exactly one arm — a re-run keyed on the condition, which is
 * a `useEffect`, not a handler. The Evaluate-only Condition is the other half and compiles to a
 * `branch` action inside whatever handler drives it (§3).
 *
 * `action` is always a `branch`, so every emit-side sweep that already walks branch arms — the
 * import, navigate and state-reference collectors — reaches these arms for free.
 */
export interface BranchEffectPlan {
  nodeId: string;
  action: HandlerAction;
  /** The provenance comment above the effect — the node's authored label when it has one. */
  comment: string;
}

export interface PropPlan {
  name: string;
  tsType: string;
}

export interface QueryPlan {
  nodeId: string;
  collectionName: string;
  /** `puppies` / `setPuppies` / `puppy` / `fetchPuppies` / `Puppy` / api module base `puppies`. */
  stateName: string;
  setterName: string;
  itemName: string;
  fetchName: string;
  typeName: string;
  moduleBase: string;
}

/**
 * One translated record verb (RECORD-VERBS-TARGET §4d): what the api stub module has to export
 * for it. The naming is a pure function of the class name, identical to {@link QueryPlan}'s, so a
 * project that both reads and writes one collection gets a single module.
 */
export interface MutationPlan {
  nodeId: string;
  verb: 'create' | 'update' | 'delete';
  collectionName: string;
  /** `createPuppy` / `updatePuppy` / `deletePuppy`. */
  fnName: string;
  typeName: string;
  moduleBase: string;
  /**
   * The columns this verb actually writes, with the type its argument resolves to — the graph's
   * own evidence of the record's shape (RECORD-VERBS-TARGET §4d).
   *
   * The interface is minted from the project's collection **schema snapshot**, and 32 of the 39
   * corpus projects carry none at all: `metadata.dbCollections` is absent, so every collection
   * types as `{ id: string }` and *any* `create`/`update` that writes a property emits a call
   * that does not compile. The schema is the authority where it exists and silent where it does
   * not; a `prop-` the graph writes is direct evidence of a column, so the two union. Empty for
   * `delete`, which writes nothing.
   */
  writes: Array<{ name: string; tsType: string }>;
}

/**
 * One translated user-family node (USER-FAMILY-TARGET §4d): what `src/api/session.ts` has to
 * export for it. Unlike {@link MutationPlan} there is nothing to key on — a project has one
 * session — so the three writes and the read all land in a single module.
 */
export interface SessionCallPlan {
  nodeId: string;
  verb: 'login' | 'logout' | 'signup' | 'read';
  /** `logIn` / `logOut` / `signUp` / `useSession`. */
  fnName: string;
}

export interface RepeaterPlan {
  nodeId: string;
  /** Legacy component path of the template ("/Components/PuppyCard"), or null when unset. */
  templatePath: string | null;
  /** The DbCollection2 node wired into `items`, or null when nothing statically known feeds it. */
  itemsQueryId: string | null;
  /** The named client-side array wired into `items` (Collection2.items), or null. */
  itemsCollectionName: string | null;
  /**
   * The identity mapping parsed from the effective mapping script (authored parameter, else the
   * declared port's default — the fixture's trap). **No script at all is 'template-inputs'**:
   * the runtime then identity-maps item properties onto same-named component inputs by itself
   * (foreach.tsx), so the mapping is the template's input names, resolved at emit. Null when
   * the script is anything beyond a static string→string `map({...})` literal; that repeater
   * defers to EXP-003.
   */
  mapping: Array<{ input: string; field: string }> | 'template-inputs' | null;
  /**
   * A list-typed vocabulary source wired into `items` (CONTROLLED-STATE-TARGET §4e) — a
   * prop-fed or state-fed plain list. Emitted `(expr ?? []).map(…)`: `?? []` is foreach.tsx's
   * own "empty arrival clears the list", rows key by index (no identity column, and the
   * runtime re-renders on array identity change anyway — grade Q).
   */
  itemsExpr?: ValueExpr;
  /**
   * A Static Data node whose parsed rows are hoisted to a module constant (STATIC-DATA §3).
   * Deliberately not `itemsExpr`: that path's contract is "no statically-known item shape, so
   * fields read as `any` and every mapped input is kept". Static Data's shape *is* known, so it
   * takes the `collection` treatment instead — derived type, `allowedFields`, a real key.
   */
  itemsStaticId?: string;
}

/**
 * One Static Data node hoisted to a frozen module constant (STATIC-DATA-TARGET §3).
 *
 * The node's three inputs are all `allowEditOnly` (staticdata.ts), so no wire can feed them and
 * the rows are knowable by construction rather than by a solver that happened to succeed. Only
 * nodes that pass every §4 gate get a plan; the rest defer with their reason named.
 */
export interface StaticDataPlan {
  nodeId: string;
  /** `PRODUCTS_DATA` — SCREAMING_SNAKE of the authored label, deduped against reserved names. */
  constName: string;
  /** `FeaturedProduct` — the row type alias. */
  typeName: string;
  /** Nested object/array aliases this row type references, declaration order (§3.1). */
  nestedTypes: Array<{ name: string; decl: string }>;
  /** The row type's own field list, source order. */
  fields: Array<{ name: string; tsType: string; optional: boolean }>;
  /** The parsed rows, verbatim — emitted as a frozen literal. */
  rows: Array<Record<string, unknown>>;
  /**
   * `id` when every row carries a unique, primitive, non-null one — which mirrors the runtime's
   * own identity notion, since `Collection.set` mints each row into a Model and treats `id` as
   * the record's identity rather than ordinary data (collection.ts:542). Null ⇒ key by index.
   */
  keyField: string | null;
}

/**
 * One conditional popup render in the hosting component (POPUPS-TARGET §2, §5). Show Popup
 * nodes opening the same target with identical literal params share a slot — safe because a
 * node with any consumed close outcome defers, so shared keys never conflate observable
 * behaviour.
 */
export interface PopupSlotPlan {
  /** The slot's string literal (`'AboutDialog'`), from the target path's last segment. */
  slotKey: string;
  /** Legacy component path of the popup component ("/Components/AboutDialog"). */
  targetLegacy: string;
  /** Literal `popupParam-*` values, keyed by the target's input port name — props at emit. */
  params: Array<{ input: string; value: string | number | boolean }>;
}

export interface ComponentFilePlan {
  dir: 'pages' | 'components';
  /** "ThankYou" — file base name, deduplicated per directory. */
  fileBase: string;
  /** "ThankYouPage" for pages, "PuppyCard" for components. */
  symbol: string;
}

export interface ComponentPlan {
  path: string;
  legacyPath: string;
  role: 'page' | 'component';
  /** Null when nothing is emitted for this component (no visual root, or the router shell). */
  file: ComponentFilePlan | null;
  /** Why file is null, for the report. */
  skipReason?: string;
  /** The node the JSX root renders (the Page node for pages). */
  rootId: string | null;
  /** A page's sole Group child merged into the page div (TARGET-OUTPUT §2's shape). */
  collapsedGroupId?: string;
  head?: { title?: string; description?: string };
  /** Root node's authored label — the component's doc comment. */
  docComment?: string;
  props: PropPlan[];
  /**
   * Props that carry the enclosing repeater's row (EXP-011 Tier 1.1) — an `Object` node in
   * "From repeater" mode, compiled away into the component's interface
   * (EXP-002-MODEL2-TARGET-OUTPUT §4). Minting order.
   *
   * 🔴 `field` is carried separately from `prop` and is **not** decoration. The prop name is
   * deduplicated against everything else the component declares, so an `Object` reading `mood`
   * in a component that already has a `mood` input becomes the prop `mood2` — and the parent
   * must still bind it from `item.mood`. Deriving the field from the prop name would silently
   * read a field no row has, exactly where the collision made it hardest to notice.
   */
  rowProps: Array<{ prop: string; field: string }>;
  /**
   * Declared signal outputs as callback props (`onWaved?: () => void`), declaration order —
   * the parent side reads the same list off the target's plan (COMPONENT-OUTPUTS-TARGET §2).
   */
  outputProps: Array<{ port: string; prop: string }>;
  /** Render children per node, collapse applied, logic nodes filtered out. */
  childrenOf: Record<string, string[]>;
  roleOf: Record<string, RenderRole>;
  /**
   * EXP-010. The kit node definition behind each rendered `'custom'` node, plus the module it came
   * from. Carried on the plan rather than looked up again at emit time so there is one answer to
   * "which kit owns this node" — the emitted wrapper's import path is derived from it.
   */
  customNodes: Record<string, { moduleDir: string; def: KitNodeIR }>;
  /**
   * EXP-010. A custom node's value outputs that something in this component reads, as local state:
   * the wrapper calls `onXChanged`, the setter writes the row, and the sink binds to it.
   *
   * ⚠️ Local, unlike {@link instanceLifted}, and that is not an oversight. A component instance's
   * value output has to wait for `planProject`'s second phase because whether the *child* lifted
   * the port is a fact about another plan. A kit node publishes its own outputs from its own
   * definition, which this component already has — there is nothing to wait for.
   */
  customLifted: Record<string, Array<{ port: string; setterName: string }>>;
  /**
   * EXP-010 AC3. Visual children of a rendered node that the export could not identify at all,
   * per parent id, in child order — the emitter prints a comment where each one sat.
   *
   * 🔴 **Unidentifiable, not merely undrawn**, and the difference is the whole criterion. A
   * `Masonry` that defers is a built-in with a reason the report can state and a slice that will
   * one day handle it. A node whose type is in no catalog and no loaded kit is *the author's own
   * node*, and before EXP-010 it left the emitted JSX with a gap and nothing in the file to say a
   * node had ever been there. That silence is the defect this task exists to end, and it is not
   * ended by a kit that loads — it is ended by the case where the kit does **not**.
   */
  droppedChildren: Record<string, Array<{ nodeId: string; type: string; reason: string }>>;
  /** nodeId → toProperty → source, for value wires landing on rendered nodes. */
  bindings: Record<string, Record<string, BindingSource>>;
  /** nodeId → source signal port → actions, for signal wires resolved to handler statements. */
  handlers: Record<string, Record<string, HandlerAction[]>>;
  /** Rendered text input id → actions its onChange performs (the wired-onTextChanged rule). */
  changeHandlers: Record<string, HandlerAction[]>;
  /** Event Receivers this component hosts as useSignal subscriptions. */
  receivers: ReceiverPlan[];
  /** Popup slots this component renders, registration order — earned by attachment (§2). */
  popups: PopupSlotPlan[];
  /** True when a translated Close Popup attached — the component declares `onClose` (§4). */
  closesPopup: boolean;
  queries: QueryPlan[];
  /** Record verbs translated in this component (RECORD-VERBS-TARGET §4), compile order. */
  mutations: MutationPlan[];
  /** The user-family nodes that translated — what `src/api/session.ts` must export. */
  sessionCalls: SessionCallPlan[];
  repeaters: Record<string, RepeaterPlan>;
  /** Static Data nodes hoisted to module constants (STATIC-DATA-TARGET §3), resolution order. */
  staticData: StaticDataPlan[];
  /**
   * Re-host wrapper definitions by node id (EXP-003 §4), registered the moment a read of the
   * node resolves — the emit layer prints exactly the wrappers that surviving expressions
   * reference, so a definition nothing kept costs nothing. Insertion order is resolution order
   * and therefore deterministic.
   */
  jsFunctions: Record<string, JsFunctionPlan>;
  /**
   * State rows (CONTROLLED-STATE-TARGET §3), registered the moment a use resolves — the emit
   * layer prints exactly the vars that surviving actions/expressions/effects reference.
   */
  stateVars: StateVarPlan[];
  /** Sync effects (§3.4), registration order — one per translated wired control-state input. */
  syncEffects: SyncEffectPlan[];
  /** Push effects (§3.5), registration order — the lifted value outputs' child side. */
  pushEffects: PushEffectPlan[];
  /** Reactive Conditions (LOGIC-TARGET §10), compile order — one useEffect each. */
  branchEffects: BranchEffectPlan[];
  /**
   * Value output ports this component lifts (§4d child side) — the parent side consults this
   * list off the target's plan, so parent and child agree by construction (the s10 rule).
   */
  liftedOutputProps: Array<{ port: string; prop: string; tsType: string }>;
  /** Instance id → lifted callbacks the parent passes (`onXChanged={setX}`) (§4d parent side). */
  instanceLifted: Record<string, Array<{ prop: string; setterName: string }>>;
  /**
   * Parent-side lifted wires awaiting the target's plan (planProject's second phase): a
   * consumed instance value output binds only when the child actually lifted the port —
   * otherwise the parent would pass a prop the child's emitted interface does not declare.
   */
  pendingLifted: Array<{
    connectionKey: string;
    instanceId: string;
    targetLegacy: string;
    port: string;
    toNodeId: string;
    toProperty: string;
  }>;
  dispositions: Record<string, Disposition>;
  /** Dropped wires, unhandled constructs — EXP-004's report feed. Nothing silently dropped. */
  notes: string[];
}

export interface ProjectPlan {
  plans: ComponentPlan[];
  byLegacyPath: Map<string, ComponentPlan>;
  /** Legacy component path → exported url path, from the scaffold's route table. */
  urlPathByLegacy: Map<string, string>;
  /** Collections needing an api stub module, in first-use order. */
  stubCollections: string[];
  /** App-wide Variables, discovery order — src/stores/variables.ts when non-empty. */
  variables: VariablePlan[];
  /** Event channels, discovery order — src/events.ts when non-empty. */
  channels: ChannelPlan[];
  /** Named Global Stores, discovery order — one src/stores/<exportName>.ts each. */
  stores: StorePlan[];
  /** Named client-side arrays, discovery order — one src/collections/<exportName>.ts each. */
  collections: CollectionPlan[];
  /**
   * Which components a route can reach (reach.ts). Not a disposition and never a reason to emit
   * less — every component is still emitted. It is what lets the report say whether a deferral is
   * work the app is missing or a node in a component nothing renders, which over this corpus is
   * the difference between 85.00% and 93.38%.
   */
  reachability: Reachability;
  /**
   * EXP-010. Node types more than one kit registers, as `type (kit that lost)`.
   *
   * 🔴 A collision, not a warning about one: `registerModule` refuses the second registration, so
   * the running app shows the *first* kit's node. The export follows that rule and says which kit
   * it therefore ignored — silently taking either one would emit an app that does not match the
   * one the author is looking at.
   */
  kitDuplicates: string[];
}

export function planProject(ir: ExportIR, catalog: CatalogIndex): ProjectPlan {
  const pages = routedPages(ir);
  const urlPathByLegacy = new Map(pages.map((p) => [`/${p.componentPath}`, p.urlPath]));
  const pageFileByPath = new Map(pages.map((p) => [p.componentPath, { fileBase: p.fileBase, symbol: p.symbol }]));
  const registry = collectAppState(ir);

  const usedPageNames = new Set(pages.map((p) => p.fileBase));
  const usedComponentNames = new Set<string>();

  // EXP-010: one index for the whole project, built before any component is planned — a kit node
  // type is a project-level fact and re-deriving it per component would report a duplicate once
  // per component that happens to use one.
  const { index: kits, duplicates: kitDuplicates } = indexKitNodes(ir.project.modules);

  const plans = ir.components.map((component) =>
    planComponent(
      component,
      ir,
      catalog,
      registry,
      urlPathByLegacy,
      pageFileByPath,
      usedPageNames,
      usedComponentNames,
      kits
    )
  );

  const byLegacyPath = new Map(plans.map((p) => [p.legacyPath, p]));

  // Second phase (CONTROLLED-STATE-TARGET §4d, parent side): a consumed instance value output
  // binds only after the child's plan exists — the child lifts the port (prop + push effect)
  // or it does not, and a parent passing `onXChanged` to a child whose emitted interface lacks
  // it would fail the emitted app's own typecheck (the popups closable lesson).
  for (const plan of plans) {
    const liftedVarByKey = new Map<string, string>();
    for (const pending of plan.pendingLifted) {
      const child = byLegacyPath.get(pending.targetLegacy);
      const lifted = child?.liftedOutputProps.find((l) => l.port === pending.port);
      if (!lifted) {
        plan.notes.push(
          `wire ${pending.connectionKey} dropped: instance output "${pending.port}" is not lifted by ${pending.targetLegacy} — its feed defers there`
        );
        continue;
      }
      const varKey = `${pending.instanceId}:${pending.port}`;
      let name = liftedVarByKey.get(varKey);
      if (name === undefined) {
        const taken = takenNamesOf(plan);
        const cleaned = pending.port.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^_+|_+$/g, '');
        const base = cleaned.length > 0 && !/^[0-9]/.test(cleaned) ? cleaned : `_${cleaned || 'lifted'}`;
        name = base;
        let counter = 2;
        while (taken.has(name) || taken.has(setterNameOf(name))) name = `${base}${counter++}`;
        liftedVarByKey.set(varKey, name);
        plan.stateVars.push({
          name,
          setterName: setterNameOf(name),
          tsType: `${lifted.tsType} | undefined`,
          boot: null,
          originNodeId: pending.instanceId,
          origin: 'lifted',
          comment: `Lifted from ${pending.targetLegacy}'s value output "${pending.port}" — undefined until the child's mount push (CONTROLLED-STATE-TARGET §4d).`
        });
        const list = (plan.instanceLifted[pending.instanceId] = plan.instanceLifted[pending.instanceId] ?? []);
        list.push({ prop: lifted.prop, setterName: setterNameOf(name) });
      }
      plan.bindings[pending.toNodeId] = plan.bindings[pending.toNodeId] ?? {};
      plan.bindings[pending.toNodeId][pending.toProperty] = {
        kind: 'computed',
        expr: { kind: 'state-get', name, maybeUndefined: true }
      };
    }
    plan.pendingLifted = [];
  }

  const stubCollections: string[] = [];
  for (const plan of plans) {
    for (const query of plan.queries) {
      if (!stubCollections.includes(query.collectionName)) stubCollections.push(query.collectionName);
    }
  }
  return {
    plans,
    byLegacyPath,
    urlPathByLegacy,
    stubCollections,
    variables: [...registry.variables.values()],
    channels: [...registry.channels.values()],
    stores: [...registry.stores.values()],
    collections: [...registry.collections.values()],
    reachability: componentReachability(ir),
    kitDuplicates
  };
}

function planComponent(
  component: ComponentIR,
  ir: ExportIR,
  catalog: CatalogIndex,
  registry: AppStateRegistry,
  urlPathByLegacy: Map<string, string>,
  pageFileByPath: Map<string, { fileBase: string; symbol: string }>,
  usedPageNames: Set<string>,
  usedComponentNames: Set<string>,
  kits: KitIndex
): ComponentPlan {
  const nodeById = new Map(component.nodes.map((n) => [n.id, n]));
  const dispositions: Record<string, Disposition> = {};
  const notes: string[] = [];

  const plan: ComponentPlan = {
    path: component.path,
    legacyPath: `/${component.path}`,
    role: component.role,
    file: null,
    rootId: null,
    props: [],
    rowProps: [],
    outputProps: [],
    childrenOf: {},
    roleOf: {},
    customNodes: {},
    customLifted: {},
    droppedChildren: {},
    bindings: {},
    handlers: {},
    changeHandlers: {},
    receivers: [],
    popups: [],
    closesPopup: false,
    queries: [],
    mutations: [],
    sessionCalls: [],
    repeaters: {},
    staticData: [],
    jsFunctions: {},
    stateVars: [],
    syncEffects: [],
    pushEffects: [],
    branchEffects: [],
    liftedOutputProps: [],
    instanceLifted: {},
    pendingLifted: [],
    dispositions,
    notes
  };

  // The router shell: the scaffold generates App.tsx from RouterIR; the visual generator owns
  // nothing here (TARGET-OUTPUT §3).
  if (component.nodes.some((n) => n.type === 'Router')) {
    for (const node of component.nodes) {
      dispositions[node.id] =
        node.type === 'Router'
          ? { kind: 'collapsed', into: 'src/App.tsx' }
          : // A Visual Function that never runs asked nothing of the translation, so calling it
            // deferred would be untrue even here (LOGIC-BUILDER-TARGET §3.5). Everything else
            // beside the router really is work the scaffold does not do.
            isVisualFunction(node.type) && !(hasProgram(node) && component.connections.some((c) => c.toId === node.id && c.toProperty === 'run'))
            ? { kind: 'static' }
            : { kind: 'deferred', to: 'EXP-003', reason: 'node beside the router shell' };
    }
    plan.skipReason = 'router shell — emitted as src/App.tsx by the scaffold';
    return plan;
  }

  // A supported visual type can still be un-renderable statically (wire-fed structure, masonry,
  // an inline icon) — those nodes read 'unsupported' with a recorded reason (VISUALS-TARGET).
  // Sink key → the type feeding it. A Set answered "is this port wired?", which is all the
  // structure check needs; the content check (§19) has to name what feeds the port, because
  // that — not the port — is the wall the node is actually behind.
  const wiredIn = new Map(component.connections.map((c) => [`${c.toId}:${c.toProperty}`, nodeById.get(c.fromId)?.type ?? 'a wire']));
  const deferReasons = new Map<string, string>();
  const roleOf = (node: NodeIR): RenderRole | 'unsupported' | null => {
    const role = renderRole(node, catalog, kits);
    if (role === null || role === 'unsupported' || role === 'instance' || role === 'repeater') return role;
    // EXP-010: the structure/content walls are statements about *built-in* ports — a wired
    // `layoutString`, a wire-fed icon source. A kit node has none of those ports; every port it
    // has is one the kit declared, and whether a wire into it is translatable is decided by the
    // definition, in the custom-node passes below.
    if (role === 'custom') return role;
    const reason = visualDeferReason(node, role, wiredIn, catalog);
    if (reason !== null) {
      deferReasons.set(node.id, reason);
      return 'unsupported';
    }
    return role;
  };

  // Visual roots: parentless nodes that render. Order is source order (D2), which matches the
  // file's visualRoots in every observed project. A Radio Button cannot root a component — it
  // only works inside a Radio Button Group (the runtime raises radio-button/no-group).
  // The file states this outright. `nodes.json.visualRoots` is what feeds `componentModel.roots`,
  // and `componentinstance.ts:326` renders `roots[0]` and nothing else — so the declared list is
  // the runtime's own answer, and the editor recomputes it on every save. The parentless rule
  // below is only a fallback for files that predate the field: it reads hierarchy from `parent`
  // while the tree walk at `walk()` reads it from `children`, so a file that expresses nesting
  // ONLY through `children` (two in the corpus) makes every node look parentless and invents a
  // root per node. Measured before changing this: across 437 components the two rules never
  // disagreed about roots[0], so the emitted tree is unchanged — what changes is that the answer
  // is now derived from the field that decides it rather than from source order happening to
  // put the real root first.
  const rootable = (n: NodeIR) =>
    roleOf(n) !== null && roleOf(n) !== 'unsupported' && roleOf(n) !== 'radio';
  const declaredRoots = component.visualRoots
    ?.map((id) => nodeById.get(id))
    .filter((n): n is NodeIR => n !== undefined);
  const roots = (declaredRoots ?? component.nodes.filter((n) => n.parent === undefined)).filter(rootable);
  const rendered = new Set<string>();
  if (roots.length === 0) {
    // The record-neighbour sweep reaches here too (§17). This path returns before the sweep at
    // the bottom of the function ever runs, so without this line a relation verb in a logic-only
    // component would still fall to `logic node (…)` — a hole the sweep's own mutation check
    // found, and exactly the shape the gate it names exists to close.
    for (const node of component.nodes) {
      const named = recordNeighbourDefer(node, component, nodeById, pageFileByPath.has(component.path), null);
      dispositions[node.id] =
        named !== undefined ? { kind: 'deferred', to: 'EXP-003', reason: named } : dispositionForLogic(node, kits);
    }
    plan.skipReason = 'no visual root — logic-only components defer to EXP-003';
    return plan;
  }
  if (roots.length > 1) {
    notes.push(`component has ${roots.length} visual roots; only the first renders in step 4`);
  }
  const root = roots[0];
  plan.rootId = root.id;
  if (root.authoredLabel) plan.docComment = root.authoredLabel;

  // File identity: routed pages keep the scaffold's names so the page file replaces its
  // placeholder exactly; everything else allocates within its directory (D5). A routed
  // component is a page whatever its component.json says — the editor home page
  // (#__page__/Home) declares itself "visual".
  const routed = pageFileByPath.get(component.path);
  if (component.role === 'page' || routed) {
    const fileBase = routed?.fileBase ?? dedupe(pascalCase(lastSegment(component.path)), usedPageNames);
    plan.file = { dir: 'pages', fileBase, symbol: routed?.symbol ?? `${fileBase}Page` };
    if (!routed) notes.push('page is not listed by any router — exported without a route');
  } else {
    const fileBase = dedupe(pascalCase(lastSegment(component.path)), usedComponentNames);
    plan.file = { dir: 'components', fileBase, symbol: fileBase };
  }

  // Walk the visual tree: roles, render children, the page collapse. The radio-group flag rides
  // the walk: a Radio Button anywhere below a Radio Button Group joins its group (React context
  // in the runtime); one outside any group is inert there (radio-button/no-group) and defers.
  const walk = (node: NodeIR, inRadioGroup: boolean) => {
    const role = roleOf(node);
    if (role === null || role === 'unsupported') return;
    rendered.add(node.id);
    plan.roleOf[node.id] = role;
    dispositions[node.id] = { kind: 'static' };
    if (role === 'custom') {
      const kit = kits.get(node.type)!;
      plan.customNodes[node.id] = { moduleDir: kit.moduleDir, def: kit.def };
      if (!kit.def.allowChildren && (node.children ?? []).length > 0) {
        notes.push(
          `node ${node.id} (${node.type}) has children but the kit declares allowChildren: false — they are rendered as this node's children and the kit decides whether it draws them`
        );
      }
    }
    const children = (node.children ?? [])
      .map((id) => nodeById.get(id))
      .filter((c): c is NodeIR => c !== undefined);
    plan.childrenOf[node.id] = [];
    const childInGroup = inRadioGroup || role === 'radiogroup';
    for (const child of children) {
      const childRole = roleOf(child);
      if (childRole === 'radio' && !childInGroup) {
        const reason =
          'a Radio Button outside a Radio Button Group cannot be selected (the runtime raises radio-button/no-group)';
        dispositions[child.id] = { kind: 'deferred', to: 'EXP-003', reason };
        notes.push(`node ${child.id} (${child.type}) deferred: ${reason}`);
        continue;
      }
      if (childRole === null || childRole === 'unsupported') {
        const reason =
          deferReasons.get(child.id) ??
          `visual child of ${node.id} with no deterministic generator (${child.type || 'untyped'})`;
        dispositions[child.id] = { kind: 'deferred', to: 'EXP-003', reason };
        notes.push(
          deferReasons.has(child.id)
            ? `node ${child.id} (${child.type}) deferred: ${reason}`
            : `node ${child.id} (${child.type || 'untyped'}) is in the visual tree but has no generator yet`
        );
        // EXP-010 AC3. A child the export cannot *identify* — no catalog entry, no component, no
        // loaded kit — is marked where it stood. See `droppedChildren`: this is the population the
        // silent-hole defect was about, and a kit that failed to load puts its nodes here.
        if (child.type !== '' && !child.type.startsWith('/') && child.catalogRef === null && !kits.has(child.type)) {
          const list = (plan.droppedChildren[node.id] = plan.droppedChildren[node.id] ?? []);
          list.push({
            nodeId: child.id,
            type: child.type,
            reason: `No catalog entry, and no kit in noodl_modules registered this type — if it came from a custom kit, that kit did not load`
          });
        }
        continue;
      }
      plan.childrenOf[node.id].push(child.id);
      walk(child, childInGroup);
    }
  };
  walk(root, false);

  // Everything hanging off a root the runtime discards. `componentinstance.ts:326` renders
  // `roots[0]` alone, and the editor already tells the author so — graph-warnings.ts sends
  // "This node is detached from the main node tree and won't be rendered" against exactly
  // roots[1..]. These nodes are therefore not waiting on EXP-003 to grow a generator; they do
  // not draw in the running app at all, and translating them would emit a page the runtime
  // never shows. Naming that here is the difference between "not yet" and "never" in the report
  // — the same distinction §17a drew for the record verbs that always fail.
  if (roots.length > 1) {
    // No count in the message. `roots` here is the file's list filtered by THIS side's notion of
    // a drawing node, and the two predicates are not identical: `Puppy test`'s Home2 declares a
    // `Page Stack` root that the editor's `allowAsChild` accepted and the export's `isVisual`
    // rejects. Quoting either number would state the other one's answer as fact; the claim that
    // matters — only the first root draws — needs no count to be true.
    const detachedReason =
      'detached from the node tree — the runtime renders only the first of this component\'s ' +
      'visual roots, so this node never draws (the editor flags it too)';
    const markDetached = (node: NodeIR) => {
      // A node the real root already reached is not detached — two corpus Apps declare roots that
      // are also children of roots[0], and what draws wins over what does not. Testing
      // `dispositions` rather than `rendered` is deliberate: `walk()` dispositions every node it
      // renders, so the two conditions select the same set, and a mutation run showed either
      // alone passes the whole suite while dropping both fails. One guard that is also the idiom
      // every later pass uses beats two that cannot be told apart.
      if (dispositions[node.id] !== undefined) return;
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: detachedReason };
      notes.push(`node ${node.id} (${node.type}) deferred: ${detachedReason}`);
      for (const id of node.children ?? []) {
        const child = nodeById.get(id);
        if (child !== undefined) markDetached(child);
      }
    };
    // `slice(1)` and the guard above overlap: `walk()` has already dispositioned roots[0], so
    // passing the whole list here would behave identically and no test can tell the two apart.
    // The slice stays because it says which roots are the discarded ones; the guard is what makes
    // that safe.
    for (const discarded of roots.slice(1)) markDetached(discarded);
  }

  // TARGET-OUTPUT §2's page shape: a Page whose sole visual child is a Group merges that Group
  // into the page div — one wrapper, classed after the Page node, styled by both.
  if (plan.roleOf[root.id] === 'page') {
    const title = literalParam(root, 'title');
    const description = literalParam(root, 'description');
    plan.head = {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(description !== undefined ? { description: String(description) } : {})
    };
    const rootChildren = plan.childrenOf[root.id];
    if (rootChildren.length === 1 && plan.roleOf[rootChildren[0]] === 'group') {
      const groupId = rootChildren[0];
      plan.collapsedGroupId = groupId;
      plan.childrenOf[root.id] = plan.childrenOf[groupId];
      // 🔴 The dropped children move with the rendered ones. The collapse rehomes the Group's
      // subtree onto the page div, and a marker left keyed to the Group would be looked up under
      // an id the emitter never renders — so the one node in the file that says "something was
      // here" would be the node that disappeared. Concatenated, not assigned: a Page can have a
      // dropped child of its own beside the single Group that made it collapsible.
      plan.droppedChildren[root.id] = [
        ...(plan.droppedChildren[root.id] ?? []),
        ...(plan.droppedChildren[groupId] ?? [])
      ];
      delete plan.droppedChildren[groupId];
      dispositions[groupId] = { kind: 'collapsed', into: root.id };
    }
  }

  /**
   * 🔴 Declared here rather than beside its first *historical* reader, because EXP-011 Tier
   * 1.1's `Object` pre-pass below runs earlier than every previous consumer and a `const` read
   * before its declaration executes is a temporal-dead-zone `ReferenceError`. It is a pure
   * derivation of `component.connections`, so moving it earlier changes nothing but the moment
   * it exists.
   */
  const wiredPorts = new Set(component.connections.map((c) => `${c.toId}:${c.toProperty}`));

  /**
   * Which nodes, anywhere in the project, name a component as their template — the two
   * producers of the ambient `_forEachModel` (`foreachitem.ts`: *"Two producers, not one"*).
   *
   * ⚠️ A `For Each` whose `templateType` is `dynamic` is excluded even when it also carries a
   * `template` parameter: its component is chosen per row from the row's own data
   * (`EXP-002-MODEL2-TARGET-OUTPUT §2` measured a corpus doing exactly that), so it is not
   * statically the template of anything.
   */
  const foreachTemplateHosts = new Map<string, Array<{ nodeId: string; componentPath: string; kind: 'foreach' | 'runtasks' }>>();
  for (const comp of ir.components) {
    for (const n of comp.nodes) {
      const kind = n.type === 'For Each' ? 'foreach' : n.type === 'Run Tasks' ? 'runtasks' : null;
      if (kind === null) continue;
      if (kind === 'foreach' && literalParam(n, 'templateType') === 'dynamic') continue;
      const template = literalParam(n, 'template');
      if (typeof template !== 'string' || template === '') continue;
      const list = foreachTemplateHosts.get(template) ?? [];
      list.push({ nodeId: n.id, componentPath: comp.path, kind });
      foreachTemplateHosts.set(template, list);
    }
  }

  /**
   * EXP-002-MODEL2-TARGET-OUTPUT §5 — why an `Object` node does *not* compile away into props.
   * Null means it does. Every branch names the runtime fact behind it.
   */
  const model2ForeachGate = (node: NodeIR): string | null => {
    // §5.1. `modelcrudbase.ts` declares `idSource` with `default: 'explicit'`, so an unset one is
    // explicit — an id-addressed record in the global Model store, which is store() work with no
    // repeater row behind it at all.
    const idSource = literalParam(node, 'idSource');
    if (idSource !== 'foreach') {
      return idSource === undefined
        ? 'its Id Source is unset, which the runtime reads as "explicit" — an id-addressed record in the global store, not a repeater row'
        : `its Id Source is "${String(idSource)}", not "From repeater"`;
    }
    if (wiredPorts.has(`${node.id}:modelId`)) return 'its Object Id is wired, so the record is chosen at runtime';
    // §5.6. An explicit target names *which* repeater, which the props model — nearest-wins —
    // does not represent.
    if (literalParam(node, 'repeaterComponent') !== undefined || wiredPorts.has(`${node.id}:repeaterComponent`)) {
      return 'it names an explicit Repeater Component, which the props model has no shape for (BINDING-CONTRACT §a)';
    }
    // §5.2. The row only exists because a For Each renders this component as its template, so
    // "which For Each" must be a statically single answer.
    const hosts = foreachTemplateHosts.get(plan.legacyPath) ?? [];
    if (hosts.length === 0) {
      return 'no For Each names this component as its template, so there is no repeater row to read';
    }
    if (hosts.length > 1) {
      return `${hosts.length} For Each nodes name this component as their template, and their rows need not share a shape`;
    }
    // §5.7. `runtasks.ts:193` is the other `_forEachModel` producer — a task input, not a
    // rendered list item, and nothing renders the template at all.
    if (hosts[0].kind === 'runtasks') {
      return 'its row comes from a Run Tasks template, where the item is a task input rather than a rendered row';
    }
    // §5.4. A write into the row is state owned by the list, not a prop — the collection-state
    // slice, which this one is not.
    const write = component.connections.find((c) => c.toId === node.id && c.toProperty.startsWith('prop-'));
    if (write) return `"${write.toProperty}" is written, and a row written from inside the row is state the list owns`;
    // §5.5. Signal-on-write is effect() work, as everywhere else in this phase.
    const signal = component.connections.find(
      (c) =>
        c.fromId === node.id &&
        (c.fromProperty === 'changed' || c.fromProperty.startsWith('changed-') || c.fromProperty === 'fetched' || c.fromProperty === 'done' || c.fromProperty === 'failure')
    );
    if (signal) return `its ${signal.fromProperty} signal is consumed, and signal-on-write has no shape in this slice`;
    if (wiredPorts.has(`${node.id}:fetch`)) return 'its Fetch is wired, which re-reads the store rather than the row';
    // §5.3 (the `id` half). Gate 4 removes the one corpus consumer; without a minted row id
    // there is nothing in the emitted app for it to be.
    const idRead = component.connections.find((c) => c.fromId === node.id && c.fromProperty === 'id');
    if (idRead) return 'its Id output is consumed, and a repeater row has no id in the emitted app';
    // §5.6. A dotted name is `{resolve: true}` path resolution through nested records, which
    // this slice's expressions cannot walk.
    const dotted = component.connections.find(
      (c) => c.fromId === node.id && c.fromProperty.startsWith('prop-') && c.fromProperty.includes('.')
    );
    if (dotted) return `"${dotted.fromProperty.slice('prop-'.length)}" is a dotted path, which resolves through nested records`;
    return null;
  };

  // Props: every Component Inputs port is a typed optional prop, source order.
  for (const node of component.nodes) {
    if (node.type !== 'Component Inputs') continue;
    dispositions[node.id] = { kind: 'static' };
    for (const port of node.declaredPorts) {
      if (port.plug !== 'output') continue;
      plan.props.push({ name: port.name, tsType: tsTypeOf(port.type, port.kind) });
    }
  }

  /**
   * §13b — a component's interface is what a `Component Inputs` node *declares*, and a port it
   * does not declare delivers nothing at runtime however many wires read it. `getPorts()` inverts
   * the plug (a Component Inputs *input* port is a component *output*), so a node whose ports are
   * all plugged `input` advertises outputs and no inputs at all, and a component with no
   * `Component Inputs` node declares nothing. Both are authoring defects the corpus carries.
   *
   * A read of an undeclared name is dropped and named, never minted: minting the prop from the
   * wire would make the exported app disagree with the runtime about what arrives, which is the
   * one thing this phase does not do. The blank card in the export is the blank card in the app.
   */
  /**
   * EXP-011 Tier 1.1 — `Object` in "From repeater" mode compiles away into props
   * (EXP-002-MODEL2-TARGET-OUTPUT §4). Node id → `prop-<p>` port name → the prop it became.
   *
   * 🔴 **Minted here, in a pre-pass, and deliberately NOT in `resolveExpr`.** `resolveExpr` runs
   * speculatively and a later pass may drop the wire it resolved — minting there would declare a
   * prop for a read that did not survive, and the parent would then pass a row field into an
   * interface position nothing reads. This is EXP-011 §6.2's trap one construct over. What is
   * read here is a fact of the graph — which `prop-*` outputs have wires at all — not a fact of
   * resolution, so it is stable before any pass runs.
   *
   * ⚠️ This is the one place the export *mints* a prop, against §13b's standing rule that a read
   * of an undeclared Component Inputs port is dropped and never minted. The rule holds there
   * because minting would make the exported app disagree with the runtime about what arrives.
   * Here it is the opposite: the runtime *does* deliver the repeater's row to this node, by
   * ambient lookup rather than through the component's interface, and a prop is the only shape
   * the emitted app has for "the row this instance is rendering". The parent binds it in the
   * same pass that renders the repeater, so both sides always agree.
   */
  const model2Props = new Map<string, Map<string, string>>();
  for (const node of component.nodes) {
    if (node.type !== 'Model2') continue;
    const gate = model2ForeachGate(node);
    if (gate !== null) {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: `Object ${node.id}: ${gate}` };
      continue;
    }
    const byPort = new Map<string, string>();
    // Source order is the wires' order, which is `connections.json`'s (D2) — so two components
    // with the same graph mint the same props in the same order.
    for (const wire of component.connections) {
      if (wire.fromId !== node.id || !wire.fromProperty.startsWith('prop-')) continue;
      if (byPort.has(wire.fromProperty)) continue;
      const property = wire.fromProperty.slice('prop-'.length);
      const taken = takenNamesOf(plan);
      const cleaned = property.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^_+|_+$/g, '');
      const base = cleaned.length > 0 && !/^[0-9]/.test(cleaned) ? cleaned : `_${cleaned || 'row'}`;
      let name = base;
      let counter = 2;
      while (taken.has(name)) name = `${base}${counter++}`;
      byPort.set(wire.fromProperty, name);
      plan.rowProps.push({ prop: name, field: property });
      // `any`, not a guessed type: the row's shape is the parent's business and the §4e feed
      // types its rows `any` for exactly this reason. A claimed `string` here would be the
      // emitter asserting something the graph never said.
      plan.props.push({ name, tsType: 'any' });
    }
    if (byPort.size > 0) model2Props.set(node.id, byPort);
    dispositions[node.id] = { kind: 'collapsed', into: plan.rootId ?? node.id };
  }

  const declaresProp = (name: string): boolean => plan.props.some((p) => p.name === name);
  /** The named drop, spelled once so both read sites (expression and binding) say the same thing. */
  const undeclaredPropReason = (name: string): string =>
    plan.props.length === 0
      ? `"${name}" is read from Component Inputs, which declares no component inputs at all — nothing is delivered to it at runtime`
      : `"${name}" is not one of this component's declared inputs (${plan.props.map((p) => p.name).join(', ')}) — nothing is delivered to it at runtime`;

  // Output props: every declared signal output port is an optional callback prop
  // (COMPONENT-OUTPUTS-TARGET §2). Ports that cannot become props, and value-kind ports,
  // are reported here once; wires into them are reported where they drop.
  const outputInterface = componentOutputInterface(component);
  plan.outputProps = outputInterface.props;
  for (const failure of outputInterface.failed) notes.push(failure.reason);
  const outputPropByPort = new Map(outputInterface.props.map((p) => [p.port, p.prop]));
  const failedOutputPorts = new Map(outputInterface.failed.map((f) => [f.port, f.reason]));
  const valueOutputPorts = new Set(outputInterface.valuePorts);
  /** Outputs node id → the first fed port's failure — the node's deferral reason (§4). */
  const failedOutputsNodes = new Map<string, string>();

  // Repeaters: template + effective mapping (authored parameter, else the declared port's
  // default — the mapping script usually is not in `parameters` at all).
  for (const node of component.nodes) {
    if (plan.roleOf[node.id] !== 'repeater') continue;
    const template = literalParam(node, 'template');
    const authored = node.parameters.find((p) => p.name === 'inputMappingScript')?.value;
    const declaredDefault = node.declaredPorts.find((p) => p.name === 'inputMappingScript')?.default;
    const script =
      authored?.kind === 'script'
        ? authored.source
        : typeof declaredDefault === 'string'
          ? declaredDefault
          : undefined;
    plan.repeaters[node.id] = {
      nodeId: node.id,
      templatePath: typeof template === 'string' ? template : null,
      itemsQueryId: null,
      itemsCollectionName: null,
      // No script anywhere is the runtime's own identity mapping over the template's inputs
      // (foreach.tsx) — not an empty mapping. Resolved against the template plan at emit.
      mapping: script !== undefined ? parseIdentityMapping(script) : 'template-inputs'
    };
  }

  // ---- wires (step 5 restructured step 4's single loop into targeted passes) --------------
  //
  // 1. Action sinks (RouterNavigate, Event Sender, Set Variable) compile once each.
  // 2. Signal wires into their trigger ports attach the compiled action to the handler owner —
  //    a rendered element's DOM event, or a receiver's useSignal.
  // 3. A wired onTextChanged into a Variable becomes the input's onChange (write-through).
  // 4. Variable reads into rendered sinks become store bindings (useValue at emit).
  // 5. Component Inputs bindings and the query→repeater feed (step 4's rules, unchanged).
  // 6. Whatever no pass consumed is reported. Nothing silently dropped.
  const consumed = new Set<string>();

  const variableNameOf = (node: NodeIR): string | undefined => {
    const name = literalParam(node, 'name');
    return typeof name === 'string' && registry.variables.has(name) ? name : undefined;
  };
  const storePlanOf = (node: NodeIR): StorePlan | undefined => {
    const name = storeNameOf(node, wiredPorts);
    return name !== undefined ? registry.stores.get(name) : undefined;
  };
  const channelNameOf = (node: NodeIR): string | undefined => {
    const name = literalParam(node, 'channelName');
    return typeof name === 'string' && registry.channels.has(name) ? name : undefined;
  };

  /**
   * Everything a resolved expression tree drags along: internal wires to consume, logic nodes
   * to collapse, Subscribe nodes whose translation the tree is, and — on failure — why. The
   * caller applies these only when it actually uses the expression.
   */
  type ResolveCtx = {
    consumes: string[];
    logicNodeIds: string[];
    subscriberIds: string[];
    visited: Set<string>;
    defer?: string;
  };
  const newCtx = (): ResolveCtx => ({ consumes: [], logicNodeIds: [], subscriberIds: [], visited: new Set() });

  /** The pass-4b eligibility rules for a single-key Subscribe read, shared with resolveExpr. */
  const storeKeyReadOf = (node: NodeIR): { storeName: string; key: string } | { defer: string } => {
    const store = storePlanOf(node);
    if (store === undefined) return { defer: 'store name is not a literal' };
    if (store.deferred !== undefined) return { defer: store.deferred };
    if (wiredPorts.has(`${node.id}:keys`)) return { defer: "the subscription's keys are wired, not literal" };
    const keys = subscribeKeysOf(node);
    if (keys.length !== 1) {
      return { defer: `${keys.length === 0 ? 'a whole-store' : 'a multi-key'} subscription is not translated in this slice` };
    }
    const keyType = store.keys.find((k) => k.key === keys[0])?.tsType;
    if (keyType !== 'string' && keyType !== 'number') {
      return { defer: `key "${keys[0]}" of store "${store.name}" has no statically-typed value` };
    }
    return { storeName: store.name, key: keys[0] };
  };

  /**
   * The Component Object node gates (COMPONENT-OBJECT-TARGET §4) — any hit defers the whole
   * node, and every read through it. The record is per component *instance*
   * (`componentState<instanceId>`, componentobject.ts), shared by the whole family, which is
   * what gates 1, 3 and 4 protect: another statically-invisible reader or writer of the same
   * record makes the compile-away translation a lie.
   */
  const componentObjectGateMemo = new Map<string, string | null>();
  const componentObjectGate = (node: NodeIR): string | null => {
    const cached = componentObjectGateMemo.get(node.id);
    if (cached !== undefined) return cached;
    const verdict = ((): string | null => {
      if (component.nodes.filter((n) => n.type === COMPONENT_OBJECT).length > 1) {
        return 'two Component Object nodes share one record — not translated in this slice';
      }
      const properties = node.parameters.find((p) => p.name === 'properties');
      if (properties !== undefined && properties.value.kind !== 'literal') {
        return 'its Properties list is not a literal';
      }
      if (component.nodes.some((n) => n.type === 'net.noodl.SetComponentObjectProperties')) {
        return 'a Set Component Object Properties node writes the same record — not translated in this slice';
      }
      if (parentFamilyReachesThisRecord()) {
        return "a descendant component reaches this record through Parent Component Object — not translated in this slice";
      }
      // Absent means ticked (the Evaluate-additive family): unticked silences the model
      // subscription, so outputs freeze between Fetch pulses and a live alias would lie.
      if (literalParam(node, 'runOnChange-object') === false) {
        return 'Object properties is unticked under Run On Value Change — its outputs freeze between Fetch pulses';
      }
      if (wiredPorts.has(`${node.id}:fetch`)) {
        return 'Fetch republishes every property as a batch — signal semantics this slice does not translate';
      }
      const signalOut = component.connections.find(
        (c) =>
          c.fromId === node.id &&
          (c.fromProperty === 'changed' ||
            c.fromProperty === 'fetched' ||
            c.fromProperty === 'done' ||
            c.fromProperty === 'completed' ||
            c.fromProperty.startsWith('changed-'))
      );
      if (signalOut !== undefined) {
        return `its ${signalOut.fromProperty} signal is consumed — signal-on-write belongs to the component-state slice`;
      }
      return null;
    })();
    componentObjectGateMemo.set(node.id, verdict);
    return verdict;
  };

  /**
   * Gate 4: whether any component reachable from this one (instances and For Each templates,
   * transitively) hosts a parent-family node — its walk (componentwalk.ts, unbounded) can
   * resolve *this* component's record. Shadowing by an intermediate Component Object component
   * is ignored: that only over-defers.
   */
  let parentPoisonCache: boolean | undefined;
  const parentFamilyReachesThisRecord = (): boolean => {
    if (parentPoisonCache !== undefined) return parentPoisonCache;
    const hostsParentFamily = new Set(
      ir.components
        .filter((c) =>
          c.nodes.some(
            (n) => n.type === 'net.noodl.ParentComponentObject' || n.type === 'net.noodl.SetParentComponentObjectProperties'
          )
        )
        .map((c) => `/${c.path}`)
    );
    if (hostsParentFamily.size === 0) return (parentPoisonCache = false);
    const childrenOf = (legacy: string): string[] => {
      const comp = ir.components.find((c) => `/${c.path}` === legacy);
      if (!comp) return [];
      const out: string[] = [];
      for (const n of comp.nodes) {
        if (n.type.startsWith('/')) out.push(n.type);
        if (n.type === 'For Each') {
          const template = literalParam(n, 'template');
          if (typeof template === 'string') out.push(template);
        }
      }
      return out;
    };
    const visited = new Set<string>();
    const queue = childrenOf(`/${component.path}`);
    while (queue.length > 0) {
      const legacy = queue.pop()!;
      if (visited.has(legacy)) continue;
      visited.add(legacy);
      if (hostsParentFamily.has(legacy)) return (parentPoisonCache = true);
      queue.push(...childrenOf(legacy));
    }
    return (parentPoisonCache = false);
  };

  /**
   * A Component Object read as an expression (COMPONENT-OBJECT-TARGET §3): the record compiles
   * away. Every statically-visible write is a continuous mirror (`value-X` has no trigger —
   * componentobject.ts), so a single-writer property reads its writer's source; a property no
   * wire writes reads its boot value, `undefined` — runtime scripts that would write it are
   * deferred nodes, and faithfulness is to the translated subset (the popups "open-forever"
   * ruling). Dotted keys defer: the runtime's `resolve: true` path-resolves them (model.ts).
   */
  const componentObjectReadExpr = (fromNode: NodeIR, fromProperty: string, ctx: ResolveCtx): ValueExpr | null => {
    const gate = componentObjectGate(fromNode);
    if (gate !== null) {
      ctx.defer = gate;
      return null;
    }
    const prop = fromProperty.slice('value-'.length);
    if (prop.includes('.')) {
      ctx.defer = `property "${prop}" is a dotted path the record would resolve through nested models`;
      return null;
    }
    const writers = component.connections.filter((c) => c.toId === fromNode.id && c.toProperty === fromProperty);
    if (writers.length > 1) {
      ctx.defer = `two wires write property "${prop}" — last-writer-wins is not statically ordered`;
      return null;
    }
    if (writers.length === 0) return { kind: 'undefined' };
    const cycleKey = `${fromNode.id}:${prop}`;
    if (ctx.visited.has(cycleKey)) {
      ctx.defer = 'a wire cycle through logic nodes';
      return null;
    }
    ctx.visited.add(cycleKey);
    const writerExpr = resolveExpr(nodeById.get(writers[0].fromId), writers[0].fromProperty, ctx);
    if (writerExpr === null) {
      if (ctx.defer === undefined) ctx.defer = `property "${prop}" mirrors a source with no static translation`;
      return null;
    }
    // The record would hold the operand a && b evaluates to, and a read is a value context.
    if (isBooleanExpr(writerExpr)) {
      ctx.defer = `property "${prop}" mirrors a logic truth value — only truthiness sinks take one in this slice`;
      return null;
    }
    ctx.consumes.push(writers[0].key);
    return writerExpr;
  };

  // ---- the re-host slice (EXP-003-JS-TARGET-OUTPUT §3–§4) --------------------------------

  /** Expression's value outputs (expression.ts) — everything else it emits is a pulse or error. */
  const EXPRESSION_VALUE_OUTPUTS = new Set(['result', 'isTrue', 'isFalse', 'asString', 'asNumber', 'asBoolean']);
  /**
   * ⚠️ A Visual Function's ports are the *workspace's*, read through the runtime's own
   * `detectIO` — never mined from the generated code and never taken from `ConnectionIR.kind`.
   *
   * 🔴 The wire kind would be the plausible-looking mistake: parse reports `value` for every
   * wire out of this node, including its block-declared **signals**, because it cannot see
   * across into a runtime-discovered port set (the IR contract says as much). `detectIO` is the
   * only thing that knows `ok` is a pulse and `title` is a value. LOGIC-BUILDER-TARGET §3.1.
   */
  const isJsValueOutput = (node: NodeIR, fromProperty: string): boolean => {
    if (node.type === JS_FUNCTION) return fromProperty.startsWith('out-');
    if (node.type === JS_EXPRESSION) return EXPRESSION_VALUE_OUTPUTS.has(fromProperty);
    if (isVisualFunction(node.type)) {
      const io = visualIoOf(node);
      return io.outputs.some((p) => p.name === fromProperty) && !io.signalOutputs.includes(fromProperty);
    }
    return false;
  };

  /** `outtype-*`/`intype-*` enum → the wrapper's field type. `any` is the honest type of an
   * untyped runtime delivery — `unknown` would fail the emitted app's tsc on the corpus's own
   * bodies (§4's build-gate ruling, recorded in the design doc's addendum). */
  const jsOutputTsType = (declared: string | number | boolean | undefined): string => {
    switch (declared) {
      case 'string':
      case 'color':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'any[]';
      default:
        return 'any';
    }
  };

  type JsFunRecord =
    | { def: JsFunctionPlan; consumes: string[]; logicNodeIds: string[]; subscriberIds: string[] }
    | { defer: string };
  const jsFunMemo = new Map<string, JsFunRecord>();
  /** Nodes whose inputs are being resolved right now — a JS output read while non-empty is a
   * JS-node chain, deferred whole in this slice (it would need a translated-order fixpoint). */
  const jsResolving = new Set<string>();
  const usedJsFnNames = new Set<string>();
  const allocJsFnName = (node: NodeIR, kind: JsFunctionPlan['kind']): string => {
    const cleaned = (node.authoredLabel ?? '').replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^_+|_+$/g, '');
    let base = cleaned.length > 0 ? cleaned : kind === 'function' ? 'fn' : kind === 'visual' ? 'blocks' : 'expr';
    if (/^[0-9]/.test(base)) base = `_${base}`;
    const taken = (name: string) =>
      usedJsFnNames.has(name) ||
      usedStateVarNames.has(name) ||
      plan.props.some((p) => p.name === name) ||
      plan.outputProps.some((o) => o.prop === name) ||
      outputInterface.valueProps.some((v) => v.prop === name) ||
      name === plan.file?.symbol ||
      name === 'Inputs' ||
      name === 'Outputs';
    let name = base;
    let counter = 2;
    while (taken(name)) name = `${base}${counter++}`;
    usedJsFnNames.add(name);
    return name;
  };

  /**
   * The per-node half of the purity gate (§3) plus the wrapper definition: body checks from
   * jsfun.ts, then every statically-known input resolved through the emit vocabulary. Each
   * failure is a named defer — the deferrals are the map for the next slice.
   */
  const jsFunDefOf = (node: NodeIR): JsFunRecord => {
    const cached = jsFunMemo.get(node.id);
    if (cached !== undefined) return cached;
    const result = ((): JsFunRecord => {
      const kind = jsNodeKindOf(node.type)!;
      const word = kind === 'function' ? 'script' : kind === 'expression' ? 'expression' : 'block program';
      const body = jsBodyOf(node, kind);
      if (body === undefined || body.trim().length === 0) {
        return {
          defer:
            kind === 'function'
              ? 'the node has no script to run'
              : kind === 'expression'
                ? 'the node has no expression'
                : 'the node has no blocks to run'
        };
      }
      if (kind === 'visual') {
        // The vocabulary gate (LOGIC-BUILDER-TARGET §4) replaces jsPurityDefer here, and is
        // stronger: it reads the workspace's block types rather than scanning the generated
        // text, so it can license the `Noodl.Variables` binding a text scan would have to
        // refuse. See logicbuilder.ts's header for why that distinction is sound.
        const gate = visualGateOf(node);
        if (gate.defer !== null) return { defer: gate.defer };
      } else {
        const purity = jsPurityDefer(kind, body);
        if (purity !== null) return { defer: `the ${word} ${purity}` };
      }

      /**
       * A Visual Function is **always** invoked: values arriving on its inputs are stored and
       * run nothing (`logic-builder.ts`'s setter says so — *"Don't auto-execute"*), so there is
       * no reactive-derived mode for it at all. Function and Expression keep both shapes.
       */
      const mode: JsFunctionPlan['mode'] =
        kind === 'visual' || wiredPorts.has(`${node.id}:run`) ? 'invoked' : 'reactive';

      // The input name set: mined from the body exactly as the runtime mints ports, plus any
      // properly-prefixed extras the graph feeds (proplist-declared ports the body may ignore).
      const mined = kind === 'function' ? functionMinedPortsOf(body) : { inputs: [], outputs: [], signals: [] };
      const exprIds = kind === 'expression' ? expressionIdentifiersOf(body) : { ports: [], mathAliases: [], raw: new Set<string>() };
      // A Visual Function's inputs are the workspace's, not the body's (§3.1).
      const visualIo = kind === 'visual' ? visualIoOf(node) : undefined;
      const inputNames: string[] =
        kind === 'function' ? [...mined.inputs] : kind === 'visual' ? visualIo!.inputs.map((p) => p.name) : [...exprIds.ports];
      const portNameOf = (name: string) => (kind === 'function' ? `in-${name}` : name);
      if (kind === 'function') {
        for (const c of component.connections) {
          if (c.toId !== node.id || !c.toProperty.startsWith('in-')) continue;
          const name = c.toProperty.slice('in-'.length);
          if (!inputNames.includes(name)) inputNames.push(name);
        }
        for (const p of node.parameters) {
          if (!p.name.startsWith('in-') || p.value.kind !== 'literal') continue;
          const name = p.name.slice('in-'.length);
          if (!inputNames.includes(name)) inputNames.push(name);
        }
      }

      const inputs: JsFunctionPlan['inputs'] = [];
      const consumes: string[] = [];
      const logicNodeIds: string[] = [];
      const subscriberIds: string[] = [];
      let anyDelivery = false;
      jsResolving.add(node.id);
      try {
        for (const name of inputNames) {
          const port = portNameOf(name);
          const wires = component.connections.filter((c) => c.toId === node.id && c.toProperty === port);
          if (wires.length > 1) {
            return { defer: `two wires feed input "${name}" — last-writer-wins is not statically ordered` };
          }
          const runChangeParam = kind === 'function' ? `runOnChange-in-${name}` : `runOnChange-${name}`;
          if (wires.length === 1) {
            const wire = wires[0];
            // Absent means ticked (the Evaluate-additive family). An unticked input's changes
            // do not re-run the script, a stale snapshot render-derived code cannot hold.
            if (mode === 'reactive' && literalParam(node, runChangeParam) === false) {
              return {
                defer: `input "${name}" is unticked under Run On Value Change — its changes would not re-run the ${word}`
              };
            }
            const from = nodeById.get(wire.fromId);
            const ctx = newCtx();
            const expr = resolveExpr(from, wire.fromProperty, ctx);
            if (expr === null) {
              return {
                defer: `input "${name}" is fed by ${from?.type ?? 'a missing node'} — ${
                  ctx.defer ?? 'no statically known source in the emit vocabulary'
                }`
              };
            }
            if (isBooleanExpr(expr)) {
              return { defer: `input "${name}" is fed a logic truth value — only truthiness sinks take one in this slice` };
            }
            anyDelivery = true;
            const tsType = exprTsType(expr);
            inputs.push({
              name,
              tsType: tsType === 'string' || tsType === 'number' || tsType === 'boolean' ? tsType : 'any',
              expr
            });
            consumes.push(wire.key, ...ctx.consumes);
            logicNodeIds.push(...ctx.logicNodeIds);
            subscriberIds.push(...ctx.subscriberIds);
            continue;
          }
          const literal = literalParam(node, port);
          if (literal !== undefined) {
            anyDelivery = true;
            inputs.push({ name, tsType: typeof literal, expr: { kind: 'literal', value: literal } });
            continue;
          }
          // Mined but never fed: the field keeps the body's reads typechecking, and the read
          // answers undefined — exactly what a never-delivered runtime input reads (§3.5).
          inputs.push({ name, tsType: 'any' });
        }
      } finally {
        jsResolving.delete(node.id);
      }

      // Automatic evaluation is gated on any input having arrived unless the expression
      // references no ports (expression.ts) — an expression whose inputs never arrive never
      // evaluates, and its outputs abstain null where a render local would compute.
      if (kind === 'expression' && mode === 'reactive' && exprIds.ports.length > 0 && !anyDelivery) {
        return { defer: 'none of its inputs is ever delivered — the expression never evaluates (its outputs abstain null)' };
      }

      // The Outputs record types every name the body can write: mined value assignments,
      // proplist-declared outputs, and outtype-typed declarations. Signal outputs (mined call
      // syntax, or declared `signal`) seed as no-op callables so `Outputs.Done()` cannot throw.
      const outputs: JsFunctionPlan['outputs'] = [];
      const signals: string[] = [];
      if (kind === 'function') {
        const declaredTypeOf = (name: string) => literalParam(node, `outtype-${name}`);
        const outputNames: string[] = [...mined.outputs];
        for (const p of node.parameters) {
          if (!p.name.startsWith('outtype-')) continue;
          const name = p.name.slice('outtype-'.length);
          if (!outputNames.includes(name)) outputNames.push(name);
        }
        for (const c of component.connections) {
          if (c.fromId !== node.id || !c.fromProperty.startsWith('out-')) continue;
          const name = c.fromProperty.slice('out-'.length);
          if (!outputNames.includes(name)) outputNames.push(name);
        }
        for (const name of mined.signals) {
          if (!signals.includes(name)) signals.push(name);
        }
        for (const name of outputNames) {
          if (signals.includes(name)) continue;
          if (declaredTypeOf(name) === 'signal') {
            signals.push(name);
            continue;
          }
          outputs.push({ name, tsType: jsOutputTsType(declaredTypeOf(name)) });
        }
      } else if (kind === 'visual') {
        // Straight off `detectIO`: the port set the runtime registers, types included. A name
        // that is both a value and a signal reads as the signal, because that is the one port
        // the node actually has (`interfacePorts`' own rule).
        for (const name of visualIo!.signalOutputs) {
          if (!signals.includes(name)) signals.push(name);
        }
        /**
         * 🔴 **A `Define output … type number` is a claim about the port, not a check on the
         * writes** (RECORD-VERBS §12). Nothing enforces it: the block editor's generator emits
         * `Outputs["result"] = null;` for a `set output` with an empty value socket without ever
         * consulting the declaration, and the runtime stores that null verbatim and delivers it
         * down the wire — the one typecast on the way (`node.ts` NDA-014, object/array → string)
         * excludes null by its own guard.
         *
         * So the emitted field has to admit the null. It cannot be coerced away: the body is
         * re-hosted **verbatim**, which is the same ruling that shims `__p`/`__s` instead of
         * stripping them (EXP-003 §4) — rewriting an assignment inside it would need an AST over
         * generated code, and would make the exported app disagree with the graph about what the
         * port sends.
         *
         * An already-`any` port is left alone: `any` admits null, and `any | null` is `any`.
         */
        const emptyWrites = new Set(censusOf(workspaceOf(node)).emptyOutputWrites);
        for (const port of visualIo!.outputs) {
          if (signals.includes(port.name)) continue;
          const declared = jsOutputTsType(port.type === '*' ? undefined : port.type);
          const tsType = declared !== 'any' && emptyWrites.has(port.name) ? `${declared} | null` : declared;
          outputs.push({ name: port.name, tsType });
        }
      }

      const def: JsFunctionPlan = {
        nodeId: node.id,
        kind,
        fnName: allocJsFnName(node, kind),
        body,
        inputs,
        outputs,
        signals,
        mathAliases: exprIds.mathAliases,
        mode,
        ...(kind === 'visual'
          ? {
              variables: [
                ...new Set([
                  ...censusOf(workspaceOf(node)).variableReads,
                  ...censusOf(workspaceOf(node)).variableWrites
                ])
              ]
            }
          : {})
      };
      return { def, consumes, logicNodeIds, subscriberIds };
    })();
    jsFunMemo.set(node.id, result);
    if ('def' in result) plan.jsFunctions[result.def.nodeId] = result.def;
    return result;
  };

  /**
   * A JS node's output as an expression (§4). Value outputs resolve to `jsfun-out`; consumed
   * built-in pulses and errors defer with the §3.6 named reason; a read while another JS def
   * is resolving is a node chain and defers whole. Whether an *invoked* node's read is legal
   * (only inside its own Run chain) is the attachment walk's decision, not resolution's.
   */
  const jsFunReadExpr = (fromNode: NodeIR, fromProperty: string, ctx: ResolveCtx): ValueExpr | null => {
    const kind = jsNodeKindOf(fromNode.type)!;
    if (!isJsValueOutput(fromNode, fromProperty)) {
      if (fromProperty === 'error') {
        ctx.defer = 'its error output is consumed — failure reporting is not translated in this slice';
      } else if (fromProperty === 'isTrueEv' || fromProperty === 'isFalseEv') {
        ctx.defer = `its ${fromProperty} pulse fires per evaluation — render-derived code has no faithful analogue`;
      } else if (kind === 'function' && !fromProperty.startsWith('out-')) {
        ctx.defer = `a Function output registers as "out-<name>" — the runtime never delivers a wire from "${fromProperty}"`;
      } else if (kind === 'visual' && visualIoOf(fromNode).signalOutputs.includes(fromProperty)) {
        // ⚠️ Reached through `detectIO`, not the wire kind — parse reports `value` here.
        ctx.defer = `its block-declared signal "${fromProperty}" is consumed as a value — a pulse carries nothing to read`;
      } else if (kind === 'visual' && ['success', 'failure', 'done', 'unchanged', 'completed'].includes(fromProperty)) {
        ctx.defer = `its ${fromProperty} outcome signal is consumed — the outcome contract is the invocation tier`;
      } else {
        ctx.defer = `its ${fromProperty} output is consumed — signal semantics this slice does not translate`;
      }
      return null;
    }
    if (jsResolving.size > 0) {
      ctx.defer = 'it is fed by another Function/Expression node — JS-node chains are not translated in this slice';
      return null;
    }
    const record = jsFunDefOf(fromNode);
    if ('defer' in record) {
      ctx.defer = record.defer;
      return null;
    }
    const { def } = record;
    const output = kind === 'function' ? fromProperty.slice('out-'.length) : fromProperty;
    if (kind === 'function' && def.signals.includes(output)) {
      ctx.defer = `its signal output "${output}" is consumed — author-signal pulses are not translated in this slice`;
      return null;
    }
    ctx.consumes.push(...record.consumes);
    ctx.logicNodeIds.push(...record.logicNodeIds);
    ctx.subscriberIds.push(...record.subscriberIds);
    // An invoked node materialized by its Run chain (§4f): reads outside the chain go through
    // the state var. In-chain reads resolve before materialization exists and keep inlining.
    const via = def.mode === 'invoked' ? jsMaterializedVars.get(fromNode.id) : undefined;
    const base: ValueExpr = {
      kind: 'jsfun-out',
      nodeId: fromNode.id,
      // Expression has one value output under six spellings, so its record field is always
      // `result`; Function and Visual Function both carry a record keyed by the port's own name.
      output: kind === 'expression' ? 'result' : output,
      ...(via !== undefined ? { viaState: via.name } : {})
    };
    if (kind === 'function' || kind === 'visual') return base;
    switch (output) {
      case 'result':
        return base;
      // The abstain-null pre-first-evaluation state is unreachable in the emitted world —
      // every vocabulary source has a boot value (§4, noted not modeled).
      case 'isTrue':
        return truthyExpr(base);
      case 'isFalse':
        return notExpr(base);
      case 'asString':
        return { ...base, fold: 'string' };
      case 'asNumber':
        return { ...base, fold: 'number' };
      default:
        return { ...base, fold: 'boolean' };
    }
  };

  // ---- the controlled-state slice (CONTROLLED-STATE-TARGET §3–§4): allocation ------------

  const usedStateVarNames = new Set<string>();
  const stateNameTaken = (name: string): boolean =>
    usedStateVarNames.has(name) ||
    usedJsFnNames.has(name) ||
    plan.props.some((p) => p.name === name) ||
    plan.outputProps.some((o) => o.prop === name) ||
    outputInterface.valueProps.some((v) => v.prop === name) ||
    name === plan.file?.symbol ||
    ['Inputs', 'Outputs', 'event', 'navigate', 'payload', 'styles', 'joinClasses'].includes(name);

  const allocStateVar = (
    label: string | undefined,
    fallback: string,
    tsType: string,
    boot: StateVarPlan['boot'],
    originNodeId: string,
    origin: StateVarPlan['origin'],
    comment: string
  ): StateVarPlan => {
    // "Show Details" → showDetails: word-joining camelCase, not underscore substitution — the
    // row reads like the label the author gave the node. (camelCase('') answers the literal
    // fallback "node", so an absent label must bypass it and take this call's own fallback.)
    const trimmedLabel = (label ?? '').replace(/[^A-Za-z0-9]+/g, ' ').trim();
    const cleaned = trimmedLabel.length > 0 ? pascalCase(trimmedLabel).replace(/[^A-Za-z0-9_$]/g, '') : '';
    let base = cleaned.length > 0 ? cleaned.charAt(0).toLowerCase() + cleaned.slice(1) : fallback;
    if (/^[0-9]/.test(base)) base = `_${base}`;
    let name = base;
    let counter = 2;
    while (stateNameTaken(name) || stateNameTaken(setterNameOf(name))) name = `${base}${counter++}`;
    usedStateVarNames.add(name);
    usedStateVarNames.add(setterNameOf(name));
    const stateVar: StateVarPlan = { name, setterName: setterNameOf(name), tsType, boot, originNodeId, origin, comment };
    plan.stateVars.push(stateVar);
    return stateVar;
  };

  /**
   * The `Error` output of a record verb as component state (RECORD-VERBS-TARGET §4a).
   *
   * Allocated on first need and memoized, because the read (a `Text.text` binding) and the write
   * (the verb's own catch) are planned in different passes and must agree on the name. Nothing
   * clears it: the port's own description says the reason is *"kept after a later attempt
   * succeeds"*, and `_internal.error` is assigned only in `setError`.
   */
  const verbErrorVars = new Map<string, StateVarPlan>();
  /**
   * Verbs whose `Do` actually attached to a handler, filled by the attachment sweep. Every
   * binding pass runs after it, so an `Error` read can require it: a verb whose trigger the
   * slice could not translate still *runs* in the interpreter, and binding its Error to a state
   * row nothing writes would render a blank where the interpreter shows a message.
   */
  const attachedRecordVerbs = new Set<string>();
  /**
   * Whether a `User` node may be read as a plain session read (USER-FAMILY-TARGET §5.6–§5.10),
   * or the named reason it may not. Every gate is a fork in §1's contract that the session stub
   * has no shape for; the `Fetch` path owns four of them.
   */
  const sessionReadGate = (node: NodeIR): string | null => {
    if (wiredPorts.has(`${node.id}:fetch`)) {
      return 'its Fetch is wired — a re-read of the session is an invocation, and the export\'s session stub has no fetch to make';
    }
    // Absent means ticked (NDA-017, the `Run`-trap family) — so check `!== false`, never falsy.
    if (literalParam(node, 'runOnChange-user') === false) {
      return 'its Run On Value Change is unticked, so the ports stop tracking the session — the export\'s read cannot reproduce a subscription that is switched off';
    }
    if (literalParam(node, 'backendId') !== undefined || wiredPorts.has(`${node.id}:backendId`)) {
      return 'it names a specific Backend — one session module is all this slice emits';
    }
    for (const wire of component.connections.filter((c) => c.fromId === node.id)) {
      if (SESSION_READS[wire.fromProperty] !== undefined) continue;
      if (wire.fromProperty.startsWith('prop-')) {
        return `its ${wire.fromProperty} output is consumed — the project's own _User columns, which the session stub carries no schema for`;
      }
      return `its ${wire.fromProperty} output is consumed — it belongs to the Fetch path, which is not translated in this slice`;
    }
    return null;
  };

  const verbErrorStateOf = (node: NodeIR): StateVarPlan => {
    let stateVar = verbErrorVars.get(node.id);
    if (stateVar === undefined) {
      stateVar = allocStateVar(
        node.authoredLabel === undefined ? undefined : `${node.authoredLabel} Error`,
        'recordError',
        'string | undefined',
        null,
        node.id,
        'record-error',
        `The Error output of ${node.authoredLabel ? `"${node.authoredLabel}"` : `the ${node.type}`} — written when the write is refused, and never cleared (RECORD-VERBS-TARGET §1).`
      );
      verbErrorVars.set(node.id, stateVar);
    }
    return stateVar;
  };

  // ---- Static Data: the authored blob as a build-time constant (STATIC-DATA-TARGET) --------
  //
  // `type`, `csv` and `json` are all `allowEditOnly` (staticdata.ts), so this is not a solver
  // that might succeed — the rows are knowable by construction. Every rejection below names its
  // reason, because §8's defer fixtures assert the reason, not merely that something deferred.

  const usedStaticNames = new Set<string>();

  /** An authored key is arbitrary text; only an identifier can print bare. */
  const tsFieldKey = (name: string) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name));

  /** §3.1 — the type of one JS value, recursing into objects and arrays. */
  const staticTsType = (
    value: unknown,
    typeBase: string,
    nested: Array<{ name: string; decl: string }>
  ): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      // An empty array has no element to inspect; a mixed one has no single element type.
      const elemTypes = [...new Set(value.map((v) => staticTsType(v, typeBase, nested)))];
      if (elemTypes.length !== 1) return 'readonly unknown[]';
      return `readonly ${elemTypes[0]}[]`;
    }
    if (typeof value === 'object') {
      const rows = [value as Record<string, unknown>];
      const name = allocStaticTypeName(typeBase);
      const decl = staticRowTypeDecl(rows, name, nested);
      nested.push({ name, decl });
      return name;
    }
    return typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
  };

  const allocStaticTypeName = (base: string): string => {
    let name = base;
    let counter = 2;
    while (usedStaticNames.has(name) || stateNameTaken(name)) name = `${base}${counter++}`;
    usedStaticNames.add(name);
    return name;
  };

  /** §3.1 — the union of keys across rows, each typed by the union of its values' types. */
  const staticRowFields = (
    rows: Array<Record<string, unknown>>,
    typeBase: string,
    nested: Array<{ name: string; decl: string }>
  ): Array<{ name: string; tsType: string; optional: boolean }> => {
    const keys: string[] = [];
    for (const row of rows) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k);
    return keys.map((key) => {
      const present = rows.filter((r) => key in r);
      const types = [...new Set(present.map((r) => staticTsType(r[key], `${typeBase}${pascalCase(key)}`, nested)))];
      return { name: key, tsType: types.sort().join(' | '), optional: present.length < rows.length };
    });
  };

  const staticRowTypeDecl = (
    rows: Array<Record<string, unknown>>,
    name: string,
    nested: Array<{ name: string; decl: string }>
  ): string => {
    const fields = staticRowFields(rows, name, nested);
    const body = fields.map((f) => `  ${tsFieldKey(f.name)}${f.optional ? '?' : ''}: ${f.tsType};`).join('\n');
    return `type ${name} = {\n${body}\n};`;
  };

  for (const node of component.nodes) {
    if (node.type !== 'Static Data') continue;

    // §4.1 — `type` defaults to csv, and unset ALSO parses csv (parseData's first branch).
    const authoredType = literalParam(node, 'type');
    if (authoredType !== 'json') {
      notes.push(
        `${plan.path}: node ${node.id} (Static Data) deferred: CSV is not translated in this slice` +
          (authoredType === undefined ? ' (Type is unset, which the runtime reads as CSV)' : '')
      );
      continue;
    }
    // ⚠️ The `json` input is a code-editor port, so its ParamIR arrives as `kind: 'script'` —
    // NOT `literal`. `literalParam` answers undefined for it, which reads as "no JSON" and
    // defers every node in the corpus. Measured against the artefact, not assumed.
    const jsonParam = node.parameters.find((p) => p.name === 'json')?.value;
    const raw =
      jsonParam === undefined
        ? undefined
        : jsonParam.kind === 'script'
          ? jsonParam.source
          : jsonParam.kind === 'literal'
            ? String(jsonParam.value)
            : jsonParam.kind === 'json'
              ? JSON.stringify(jsonParam.value)
              : undefined;
    if (typeof raw !== 'string' || raw.trim() === '') {
      notes.push(`${plan.path}: node ${node.id} (Static Data) deferred: no JSON is authored`);
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      notes.push(
        `${plan.path}: node ${node.id} (Static Data) deferred: the authored JSON does not parse (${(e as Error).message})`
      );
      continue;
    }
    // §4.3 / §4.4 — the runtime mints each row into a Model, so a non-record row has no field
    // to map; and a non-array parse has no rows at all.
    if (!Array.isArray(parsed)) {
      notes.push(`${plan.path}: node ${node.id} (Static Data) deferred: the authored JSON is not an array of records`);
      continue;
    }
    if (!parsed.every((r) => typeof r === 'object' && r !== null && !Array.isArray(r))) {
      notes.push(`${plan.path}: node ${node.id} (Static Data) deferred: a row is not a record`);
      continue;
    }
    // §4.5 — a node that reaches here has already parsed, so `failure` can never fire and
    // `error` is always empty. Emitting nothing for a wired parse-failure channel would delete
    // a behaviour rather than defer it, so the node defers instead.
    const failureWire = component.connections.find(
      (c) => c.fromId === node.id && (c.fromProperty === 'failure' || c.fromProperty === 'error')
    );
    if (failureWire !== undefined) {
      notes.push(
        `${plan.path}: node ${node.id} (Static Data) deferred: the parse-failure channel is wired ("${failureWire.fromProperty}"), and a node that reaches emit has already parsed`
      );
      continue;
    }

    const rows = parsed as Array<Record<string, unknown>>;
    const label = (node.authoredLabel ?? '').replace(/[^A-Za-z0-9]+/g, ' ').trim();
    const typeBase = allocStaticTypeName(label.length > 0 ? pascalCase(label) : 'StaticRow');
    const nestedTypes: Array<{ name: string; decl: string }> = [];
    const fields = staticRowFields(rows, typeBase, nestedTypes);

    // §3.2 — `id` is the key only when every row carries a unique, primitive, non-null one.
    const ids = rows.map((r) => r.id);
    const keyField =
      ids.every((v) => (typeof v === 'string' || typeof v === 'number') && v !== null) &&
      new Set(ids).size === rows.length
        ? 'id'
        : null;

    let constName = (label.length > 0 ? label : 'staticRows').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
    if (/^[0-9]/.test(constName)) constName = `_${constName}`;
    let counter = 2;
    const base = constName;
    while (usedStaticNames.has(constName) || stateNameTaken(constName)) constName = `${base}_${counter++}`;
    usedStaticNames.add(constName);

    plan.staticData.push({ nodeId: node.id, constName, typeName: typeBase, nestedTypes, fields, rows, keyField });
  }

  // ---- the latches (§4a): Switch and Counter, the same shape in boolean and number --------

  const LATCH_PULSES: Record<string, string[]> = {
    Switch: ['switched', 'switchedToOn', 'switchedToOff', 'done', 'unchanged'],
    Counter: ['countChanged']
  };
  const LATCH_TRIGGERS: Record<string, string[]> = {
    Switch: ['on', 'off', 'flip'],
    Counter: ['increase', 'decrease', 'reset']
  };
  const isLatchType = (type: string): boolean => type === 'Switch' || type === 'Counter';

  const latchMemo = new Map<string, { stateVar: StateVarPlan } | { defer: string }>();
  const latchStateOf = (node: NodeIR): { stateVar: StateVarPlan } | { defer: string } => {
    const cached = latchMemo.get(node.id);
    if (cached !== undefined) return cached;
    const result = ((): { stateVar: StateVarPlan } | { defer: string } => {
      const consumedPulse = component.connections.find(
        (c) => c.fromId === node.id && (LATCH_PULSES[node.type] ?? []).includes(c.fromProperty)
      );
      if (consumedPulse) {
        return {
          defer: `its ${consumedPulse.fromProperty} signal is consumed — change-conditional pulses are not translated in this slice`
        };
      }
      if (node.type === 'Switch') {
        // The State input's setter emits the switched signals on every set — "announces a
        // switch even though nothing switched" (switch.ts) — so a wired one fabricates pulses.
        if (wiredPorts.has(`${node.id}:onFromStart`)) {
          return { defer: 'its State input is wired — the setter announces a switch even though nothing switched (switch.ts)' };
        }
        const stateVar = allocStateVar(
          node.authoredLabel,
          'switchState',
          'boolean',
          literalParam(node, 'onFromStart') === true,
          node.id,
          'switch',
          `From the Switch node${node.authoredLabel ? ` "${node.authoredLabel}"` : ''} — a latch: On/Off/Flip write it, Current State reads it.`
        );
        return { stateVar };
      }
      if (literalParam(node, 'limitsEnabled') === true || wiredPorts.has(`${node.id}:limitsEnabled`)) {
        return { defer: 'its limits gate the mutations — clamped counting is not translated in this slice' };
      }
      if (wiredPorts.has(`${node.id}:startValue`)) {
        return { defer: 'its Start Value is wired — the first arrival seeds the count and announces countChanged (counter.ts)' };
      }
      const rawStart = literalParam(node, 'startValue');
      const boot = typeof rawStart === 'number' ? rawStart : Number(rawStart ?? 0) || 0;
      const stateVar = allocStateVar(
        node.authoredLabel,
        'count',
        'number',
        boot,
        node.id,
        'counter',
        `From the Counter node${node.authoredLabel ? ` "${node.authoredLabel}"` : ''} — Increase/Decrease/Reset write it, Count reads it.`
      );
      return { stateVar };
    })();
    latchMemo.set(node.id, result);
    return result;
  };

  // ---- the value Variables (EXP-011 Tier 1.4): String / Number / Boolean / Color -----------

  /**
   * A value-Variable node reads as one of two things, and which one is decided by its wires.
   *
   * **Constant** — nothing wired into `value` and nothing wired into `Set`. `savedValue` can
   * then only ever report the authored parameter (cast by the node's own `cast`), or the
   * type's `startValue` when the author left the panel alone. No state row is minted: the read
   * is a literal, because in the interpreter it is one too.
   *
   * **Mirror** — `value` is wired and Run On Value Change is ticked (the default, and *absent
   * means ticked* per `run-on-value-change.ts`). Arrivals write straight through, so the node
   * is a `useState` fed by a sync effect carrying `variablebase.setValueTo`'s own rules: an
   * `undefined` arrival abstains, a `null` one stores the `Treat empty as` value, anything else
   * goes through `cast`, and a cast that produced `NaN` is banned and becomes the empty value.
   * That is the §3.4 dual-path shape the four controls already use, with this family's table.
   *
   * ⚠️ **`Set` is deliberately outside this slice**, and the reason is a real one rather than
   * effort: with `saveValue` wired the node stops writing through and parks arrivals in
   * `latestValue`, so the store is *the value that last arrived, cast, unless it was undefined*
   * — an abstain guard and a cast around a value expression, and `state-set` carries an
   * expression with no room for either. Naming it is honest; faking it would store an
   * uncast `undefined` where the interpreter stores nothing.
   */
  type ValueVariableSpec = {
    /** The `useState` type before nullability is decided. */
    tsType: 'string' | 'number' | 'boolean';
    /** How the emit layer writes `args.cast` — 'none' is Color's identity cast. */
    cast: 'string' | 'number' | 'boolean' | 'none';
    /** `args.startValue`: what `initialize` seeds, and what `savedValue` reports unauthored. */
    start: string | number | boolean;
    /** `args.emptyOptions` by enum value, first entry the default — `coerce`, keyed. */
    empties: Record<string, string | number | boolean | null>;
    /** The state row's name when the author left the node unlabelled. */
    fallbackName: string;
  };
  const VALUE_VARIABLES: Record<string, ValueVariableSpec> = {
    String: { tsType: 'string', cast: 'string', start: '', empties: { null: null, 'empty-string': '' }, fallbackName: 'text' },
    Number: { tsType: 'number', cast: 'number', start: 0, empties: { null: null, zero: 0 }, fallbackName: 'count' },
    Boolean: { tsType: 'boolean', cast: 'boolean', start: false, empties: { null: null, false: false }, fallbackName: 'flag' },
    // Color's `cast` is `function (value) { return value; }` — a colour needs no coercion, it
    // already arrives as the string the property panel or a style produced (color.ts).
    Color: { tsType: 'string', cast: 'none', start: '#f1f2f4', empties: { null: null, 'empty-string': '' }, fallbackName: 'color' }
  };
  /** Outputs whose consumption makes a value Variable change-conditional — the latch rule. */
  const VALUE_VARIABLE_PULSES = ['changed', 'done', 'unchanged'];

  /**
   * `args.cast` applied to an authored parameter, as `setValueTo` would apply it. `empty` is the
   * node's *selected* `Treat empty as` coercion and not the family default — deriving it here
   * instead read every unparseable Number as null even where the author had ticked Zero.
   */
  const castLiteral = (
    spec: ValueVariableSpec,
    value: string | number | boolean,
    empty: string | number | boolean | null
  ): string | number | boolean | null => {
    if (spec.cast === 'string') return String(value);
    if (spec.cast === 'boolean') return Boolean(value);
    if (spec.cast === 'number') {
      const next = Number(value);
      // `NaN` is banned as a stored value outright (variablebase): it becomes the empty value.
      return Number.isNaN(next) ? empty : next;
    }
    return value;
  };

  /** The selected `Treat empty as` coercion — `emptyOptions[0]` (null) unless the panel says. */
  function emptyValueOf(spec: ValueVariableSpec, selected: unknown): string | number | boolean | null {
    if (typeof selected === 'string' && selected in spec.empties) return spec.empties[selected];
    return spec.empties[Object.keys(spec.empties)[0]];
  }

  type ValueVariableRec =
    | { constant: string | number | boolean | null }
    | { stateVar: StateVarPlan; sync: SyncEffectPlan; wireKey: string; ctx: ResolveCtx }
    | { defer: string };

  const valueVariableMemo = new Map<string, ValueVariableRec>();
  const valueVariableOf = (node: NodeIR): ValueVariableRec => {
    const cached = valueVariableMemo.get(node.id);
    if (cached !== undefined) return cached;
    const result = ((): ValueVariableRec => {
      const spec = VALUE_VARIABLES[node.type];
      const empty = emptyValueOf(spec, literalParam(node, 'treatEmptyAs'));

      // The latch rule (§4a), for the same reason: `Changed` fires only when the stored value
      // actually differs, and the interpreter's `hasBeenSet` guard makes the *first* store a
      // change even when it stores the value the node booted with. Nothing here reproduces that,
      // so a consumed pulse defers rather than firing on React's terms.
      const consumedPulse = component.connections.find(
        (c) => c.fromId === node.id && VALUE_VARIABLE_PULSES.includes(c.fromProperty)
      );
      if (consumedPulse) {
        return {
          defer: `its ${consumedPulse.fromProperty} signal is consumed — change-conditional pulses are not translated in this slice`
        };
      }

      const valueWire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'value');
      const setWired = wiredPorts.has(`${node.id}:saveValue`);
      // *Absent means ticked* (run-on-value-change.ts): only a deliberate `false` unticks.
      const runsOnChange = literalParam(node, 'runOnChange-value') !== false;

      if (setWired) {
        return {
          defer:
            'its Set commits a pending value — the node parks arrivals in `latestValue` and stores them only when Set fires, applying its cast and abstaining on undefined (variablebase.setValueTo), and a state write carries an expression with room for neither'
        };
      }

      if (valueWire === undefined) {
        // A constant. An authored parameter reaches `currentValue` through the setter, so it is
        // cast; an unauthored one never runs a setter at all and `initialize`'s `startValue` is
        // what `savedValue` reports. Run On Value Change does not enter into it — with no Set to
        // park behind, the parameter lands either way.
        const authored = literalParam(node, 'value');
        return { constant: authored === undefined ? spec.start : castLiteral(spec, authored, empty) };
      }

      if (!runsOnChange) {
        return {
          defer:
            'Run On Value Change is unticked on Value and no Set is wired, so nothing ever stores — the node reports its start value for the life of the app, which is not what the wire says it is for'
        };
      }

      const ctx = newCtx();
      const source = resolveExpr(nodeById.get(valueWire.fromId), valueWire.fromProperty, ctx);
      if (source === null) return { defer: ctx.defer ?? 'the Value wire has no statically known source' };
      if (isBooleanExpr(source)) {
        return { defer: 'its Value is fed a logic truth value — only truthiness sinks take one in this slice' };
      }
      // The effect runs in render, so a handler-only read (an input's own event value, a
      // receiver's payload) is not in scope there — the control sync effect's own gate.
      if (!exprValidIn(source, { kind: 'render' })) {
        return { defer: 'its Value reads a value that only exists inside a handler' };
      }
      if (source.kind === 'undefined') {
        return { defer: 'its Value arrival is statically undefined, which abstains — nothing ever stores' };
      }

      // `null` only ever reaches the store from a wire, so a node nothing wires cannot be
      // nullable — and one that is wired is nullable exactly when `Treat empty as` left the
      // default. Widening further would type a row `null` that nothing can write.
      const tsType = empty === null ? `${spec.tsType} | null` : spec.tsType;
      const stateVar = allocStateVar(
        node.authoredLabel,
        spec.fallbackName,
        tsType,
        spec.start,
        node.id,
        'variable',
        `From the ${node.type} node${node.authoredLabel ? ` "${node.authoredLabel}"` : ''} — Value writes it under Run On Value Change, Value reads it.`
      );
      // ⚠️ The effect is **not** pushed here. `resolveExpr` runs speculatively and a pass may
      // drop the wire it resolved; a sync effect is referenced unconditionally at emit
      // (component.ts's `referencedStateNames` sweep), so pushing one for a read that never
      // landed would emit a `useState` and a `useEffect` no line of the component reads — the
      // dead-`useSession` trap this file already names for the session reads. The verdict sweep
      // pushes it once the node has actually collapsed.
      const sync: SyncEffectPlan = {
        stateName: stateVar.name,
        source,
        coerce: `variable-${spec.cast}` as SyncEffectPlan['coerce'],
        empty
      };
      return { stateVar, sync, wireKey: valueWire.key, ctx };
    })();
    valueVariableMemo.set(node.id, result);
    return result;
  };

  // ---- the controls (§4c): local state + sync effect, the dual-path contract --------------

  type ControlSpec = {
    statePort: string;
    output: string;
    tsType: 'boolean' | 'number' | 'string';
    coerce: SyncEffectPlan['coerce'];
    eventForm: 'string' | 'checked' | 'number';
    fallbackName: string;
  };
  const CONTROL_STATE: Partial<Record<RenderRole, ControlSpec>> = {
    checkbox: {
      statePort: 'checked',
      output: 'checked',
      tsType: 'boolean',
      coerce: 'checkbox',
      eventForm: 'checked',
      fallbackName: 'checked'
    },
    range: {
      statePort: 'value',
      output: 'value',
      tsType: 'number',
      coerce: 'slider',
      eventForm: 'number',
      fallbackName: 'rangeValue'
    },
    select: {
      statePort: 'value',
      output: 'value',
      tsType: 'string',
      coerce: 'dropdown',
      eventForm: 'string',
      fallbackName: 'selected'
    },
    input: {
      statePort: 'startValue',
      output: 'onTextChanged',
      tsType: 'string',
      coerce: 'textinput',
      eventForm: 'string',
      fallbackName: 'text'
    }
  };
  /** Rendered control node id → its state var, populated by the minting pass below. */
  const controlStateVars = new Map<string, StateVarPlan>();
  /** Invoked JS node id → the §4f materialized state var, minted by compileJsRun. */
  const jsMaterializedVars = new Map<string, StateVarPlan>();
  const controlSpecOf = (id: string): ControlSpec | undefined => {
    const role = plan.roleOf[id];
    return role === undefined ? undefined : CONTROL_STATE[role];
  };
  /** Action ports whose translation needs local control state (§4c: check/uncheck, clear). */
  const CONTROL_ACTION_PORTS: Partial<Record<RenderRole, string[]>> = {
    checkbox: ['check', 'uncheck'],
    input: ['clear']
  };

  /**
   * The three nodes whose `items` output is a list this slice can read (EXP-011 Tier 1.1).
   *
   * `Static Data` is deliberately absent: its rows have a *statically-known shape*, so it takes
   * the typed `itemsStaticId` treatment on a repeater (a derived row type, a real key, dropped
   * fields reported). Routing it through here would retype its rows as `any` and lose that —
   * the §10 "untyped list" contract applied to the one source that does not need it.
   */
  const LIST_PRODUCERS = new Set(['Collection2', 'Filter Collection', 'Map Collection']);

  /**
   * Whether a `Collection2` is a plain read of a named array (COLLECTIONS-TARGET §2).
   *
   * 🔴 **Declared here, beside its first caller, and not in Pass 5 where it was.** `listReadOf`
   * runs from Pass 2 onward, and a `const` arrow read before its declaration executes is a
   * temporal-dead-zone `ReferenceError`, not a hoisted function — the crash would have been in
   * the first project wiring an array into a transform.
   *
   * EXP-011 Tier 1.1 widened the allowed consumer set: the array's `items` may now also feed
   * `Array Filter` and `Array Map`, which are reads of it exactly as `For Each` is. Anything
   * else — a `count` into a Text, a `firstItemId` into a verb — is still logic this slice does
   * not translate, and still says so.
   */
  const collectionReadEligible = (node: NodeIR): true | string => {
    if (component.connections.some((c) => c.toId === node.id)) {
      return 'the array node has wired inputs (seeding or fetch) — not translated in this slice';
    }
    const stray = component.connections.find(
      (c) =>
        c.fromId === node.id &&
        !(
          c.fromProperty === 'items' &&
          c.toProperty === 'items' &&
          (nodeById.get(c.toId)?.type === 'For Each' || LIST_PRODUCERS.has(nodeById.get(c.toId)?.type ?? ''))
        )
    );
    if (stray) return `its ${stray.fromProperty} output drives logic this slice does not translate`;
    return true;
  };

  /**
   * The value a list producer's `items` output carries, or null with `ctx.defer` set.
   *
   * Recursive, so `notes → Array Filter → Array Map → For Each` resolves as one nested
   * expression. `ctx.visited` is the cycle guard: the graph permits a transform to be wired back
   * into itself and the runtime merely fails to settle, which is not a reason for this to
   * recurse forever.
   */
  const listReadOf = (node: NodeIR, ctx: ResolveCtx): ValueExpr | null => {
    if (ctx.visited.has(node.id)) {
      ctx.defer = `the array feeding "${node.authoredLabel ?? node.id}" is wired back into itself`;
      return null;
    }
    ctx.visited.add(node.id);

    if (node.type === 'Collection2') {
      const collectionName = collectionNameOf(node, wiredPorts);
      if (collectionName === undefined) {
        ctx.defer = 'its Array Id is not a literal name — a runtime-addressed array has no emitted module';
        return null;
      }
      if (!registry.collections.has(collectionName)) {
        ctx.defer = `no emitted module names the array "${collectionName}"`;
        return null;
      }
      const eligible = collectionReadEligible(node);
      if (eligible !== true) {
        ctx.defer = eligible;
        return null;
      }
      ctx.logicNodeIds.push(node.id);
      return { kind: 'collection-get', collectionName };
    }

    // Both transforms take their source from a single `items` wire. Two wires is last-writer-wins
    // in the runtime and has no static order, the same ruling the credential inputs take.
    const feeds = component.connections.filter((c) => c.toId === node.id && c.toProperty === 'items');
    if (feeds.length === 0) {
      ctx.defer = 'nothing is wired into its Items input';
      return null;
    }
    if (feeds.length > 1) {
      ctx.defer = 'two wires feed its Items input — last-writer-wins is not statically ordered';
      return null;
    }
    const source = resolveExpr(nodeById.get(feeds[0].fromId), feeds[0].fromProperty, ctx);
    if (source === null) return null;
    if (!exprTsType(source).endsWith('[]')) {
      ctx.defer = `its Items input is fed by a source not statically typed as a list (${exprTsType(source)})`;
      return null;
    }
    ctx.consumes.push(feeds[0].key);

    /**
     * Every *other* output is a refusal, and each is named rather than lumped together.
     *
     * The signals are the real content of this gate: `Changed`/`Filtered` fire once per run and
     * `Done` once per requested run, which are events in a push runtime and have no counterpart
     * in a derived expression that is simply always current. Translating the list while
     * silently dropping a signal chain would leave an app whose rows are right and whose
     * side-effects never happen.
     */
    for (const wire of component.connections.filter((c) => c.fromId === node.id && c.fromProperty !== 'items')) {
      const port = wire.fromProperty;
      if (port === 'modified' || port === 'done' || port === 'failure' || port === 'completed') {
        ctx.defer = `its ${port === 'modified' ? 'Changed/Filtered' : port} signal is consumed — a derived list is always current and has no run to announce`;
        return null;
      }
      ctx.defer = `its ${port} output is consumed, which this slice does not read`;
      return null;
    }

    if (node.type === 'Map Collection') return mapReadOf(node, source, ctx);
    return filterReadOf(node, source, ctx);
  };

  /** `Array Map` — the `map({…})` script, when every mapping is a plain property name. */
  const mapReadOf = (node: NodeIR, source: ValueExpr, ctx: ResolveCtx): ValueExpr | null => {
    if (wiredPorts.has(`${node.id}:mapScript`)) {
      ctx.defer = 'its Script input is wired';
      return null;
    }
    const param = node.parameters.find((p) => p.name === 'mapScript')?.value;
    const script = param === undefined ? undefined : param.kind === 'script' || param.kind === 'expression' ? param.source : param.kind === 'literal' ? String(param.value) : undefined;
    if (script === undefined) {
      /**
       * ⚠️ An unauthored Script is the *declared default*, and the default maps nothing — it is
       * the commented-out template `mapcollectionnode.ts` ships. The runtime compiles it in
       * `initialize` and it produces a record with no properties, so every row maps to `{}`.
       * That is a faithful translation of a node the author has not filled in, and emitting it
       * is better than deferring: the deferral would read as "this cannot be exported" when the
       * truth is "this does nothing yet".
       */
      return { kind: 'list-map', source, entries: [] };
    }
    const mapping = parseIdentityMapping(script);
    if (mapping === null) {
      ctx.defer = 'its Script does more than name source properties — a function-valued mapping is arbitrary JavaScript over a live record';
      return null;
    }
    ctx.logicNodeIds.push(node.id);
    return { kind: 'list-map', source, entries: mapping.map((m) => ({ key: m.input, field: m.field })) };
  };

  /** `Array Filter` — the panel-authored filter, sort and skip/limit. */
  const filterReadOf = (node: NodeIR, source: ValueExpr, ctx: ResolveCtx): ValueExpr | null => {
    if (wiredPorts.has(`${node.id}:enabled`)) {
      ctx.defer = 'its Enabled input is wired — whether the filter applies is a runtime value';
      return null;
    }
    /**
     * Every `filter…` setting is a dynamic input the editor registers, so a *wire* into any of
     * them makes the filter a runtime value. Checked as a family rather than per port: the port
     * set is generated (`updatePorts`), so there is no closed list to enumerate against.
     */
    const wiredSetting = [...wiredPorts].find((p) => p.startsWith(`${node.id}:filter`));
    if (wiredSetting !== undefined) {
      ctx.defer = `its ${wiredSetting.slice(node.id.length + 1)} setting is wired — the filter is not statically known`;
      return null;
    }
    // `enabled` false passes the array straight through, unfiltered, unsorted and unlimited
    // (`scheduleFilter` skips the whole block) — so the translation is the source itself.
    if (literalParam(node, 'enabled') === false) {
      ctx.logicNodeIds.push(node.id);
      return source;
    }

    const tests: Array<{ field: string; op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'; value: string | number | boolean }> = [];
    const filterList = literalParam(node, 'filterFilter');
    for (const field of typeof filterList === 'string' && filterList !== '' ? filterList.split(',') : []) {
      const op = literalParam(node, `filterFilterOp-${field}`) ?? 'eq';
      if (op === 'regex') {
        ctx.defer = `its "${field}" test is a regex — the pattern is compiled per row and a malformed one throws, which this slice does not reproduce`;
        return null;
      }
      if (op !== 'eq' && op !== 'neq' && op !== 'gt' && op !== 'lt' && op !== 'gte' && op !== 'lte') {
        ctx.defer = `its "${field}" test uses the operator "${String(op)}", which this slice does not translate`;
        return null;
      }
      const value = literalParam(node, `filterFilterValue-${field}`);
      /**
       * 🔴 An absent value is not "match everything". `getFilter` builds `{[field]: {$eq:
       * undefined}}` and `applyFilter` then returns false for every row whose property is
       * absent and compares `item[key] == undefined` otherwise — so the honest translation is
       * not a comparison this vocabulary can spell. Deferred rather than dropped.
       */
      if (value === undefined) {
        ctx.defer = `its "${field}" test has no value — the runtime compares against undefined, which is not a test this slice can spell`;
        return null;
      }
      tests.push({ field, op, value });
    }

    const sort: Array<{ field: string; direction: 'ascending' | 'descending' }> = [];
    const sortList = literalParam(node, 'filterSort');
    for (const field of typeof sortList === 'string' && sortList !== '' ? sortList.split(',') : []) {
      sort.push({ field, direction: literalParam(node, `filterSort-${field}`) === 'descending' ? 'descending' : 'ascending' });
    }

    // `getLimit`/`getSkip` both answer undefined unless the limit is enabled, and then default
    // to 10 and 0 — the defaults are the runtime's, not this file's invention.
    let skip: number | undefined;
    let limit: number | undefined;
    if (literalParam(node, 'filterEnableLimit') === true) {
      const authoredLimit = literalParam(node, 'filterLimit');
      const authoredSkip = literalParam(node, 'filterSkip');
      limit = typeof authoredLimit === 'number' && authoredLimit !== 0 ? authoredLimit : 10;
      skip = typeof authoredSkip === 'number' ? authoredSkip : 0;
    }

    ctx.logicNodeIds.push(node.id);
    return { kind: 'list-filter', source, tests, sort, ...(skip ? { skip } : {}), ...(limit !== undefined ? { limit } : {}) };
  };

  const resolveExpr = (fromNode: NodeIR | undefined, fromProperty: string, ctx: ResolveCtx): ValueExpr | null => {
    if (!fromNode) return null;
    if (LIST_PRODUCERS.has(fromNode.type) && fromProperty === 'items') return listReadOf(fromNode, ctx);
    /**
     * `Object` in "From repeater" mode is the repeater's row read sideways
     * (EXP-002-MODEL2-TARGET-OUTPUT §4), so a `prop-p` read is a prop read on this component.
     * The prop was minted in the pre-pass above; a node that failed a §5 gate has no entry and
     * falls through to the deferral its disposition already names.
     */
    if (fromNode.type === 'Model2' && fromProperty.startsWith('prop-')) {
      const name = model2Props.get(fromNode.id)?.get(fromProperty);
      if (name === undefined) {
        const disposition = dispositions[fromNode.id];
        ctx.defer = disposition?.kind === 'deferred' ? disposition.reason : `Object ${fromNode.id} does not read the repeater row`;
        return null;
      }
      return { kind: 'prop', name };
    }
    if (fromNode.type === 'Component Inputs') {
      if (!declaresProp(fromProperty)) {
        ctx.defer = undeclaredPropReason(fromProperty);
        return null;
      }
      return { kind: 'prop', name: fromProperty };
    }
    if (fromNode.type === COMPONENT_OBJECT && fromProperty.startsWith('value-')) {
      return componentObjectReadExpr(fromNode, fromProperty, ctx);
    }
    if (jsNodeKindOf(fromNode.type) !== null) {
      return jsFunReadExpr(fromNode, fromProperty, ctx);
    }
    // STATIC-DATA §4.6 — the rows are known at emit, so `count` is a number literal. No new
    // machinery: the runtime's own `count` is `collection.size()` over exactly these rows.
    if (fromNode.type === 'Static Data' && fromProperty === 'count') {
      const sd = plan.staticData.find((s) => s.nodeId === fromNode.id);
      if (sd === undefined) {
        ctx.defer = 'the Static Data node it counts deferred';
        return null;
      }
      return { kind: 'literal', value: sd.rows.length };
    }
    if (fromNode.type === 'Variable2' && fromProperty === 'value') {
      const name = variableNameOf(fromNode);
      return name !== undefined ? { kind: 'store-get', variableName: name } : null;
    }
    if (fromNode.type === GLOBAL_STORE_SUBSCRIBE && fromProperty === 'value') {
      const read = storeKeyReadOf(fromNode);
      if ('defer' in read) {
        ctx.defer = read.defer;
        return null;
      }
      ctx.subscriberIds.push(fromNode.id);
      return { kind: 'store-key-get', storeName: read.storeName, key: read.key };
    }
    // Latch reads (CONTROLLED-STATE-TARGET §4a): `state`/`currentCount` read the latch's var.
    if (
      (fromNode.type === 'Switch' && fromProperty === 'state') ||
      (fromNode.type === 'Counter' && fromProperty === 'currentCount')
    ) {
      const rec = latchStateOf(fromNode);
      if ('defer' in rec) {
        ctx.defer = rec.defer;
        return null;
      }
      return { kind: 'state-get', name: rec.stateVar.name };
    }
    // Value Variable reads (EXP-011 Tier 1.4): `savedValue` is the constant the node reports or
    // the row its Value wire mirrors. `length` is String's extra output — exact over a constant
    // (`typeof value === 'string' ? value.length : 0`, string.ts, folded here because the string
    // is known) and deferred over a row, where the expression vocabulary has no member access.
    if (VALUE_VARIABLES[fromNode.type] !== undefined && (fromProperty === 'savedValue' || fromProperty === 'length')) {
      const rec = valueVariableOf(fromNode);
      if ('defer' in rec) {
        ctx.defer = rec.defer;
        return null;
      }
      if (fromProperty === 'length') {
        if (fromNode.type !== 'String') {
          ctx.defer = `its ${fromProperty} output is not a port this slice reads`;
          return null;
        }
        if (!('constant' in rec)) {
          ctx.defer = 'its Length reads a stored string — a member read has no shape in this slice’s expressions';
          return null;
        }
        return { kind: 'literal', value: typeof rec.constant === 'string' ? rec.constant.length : 0 };
      }
      if ('constant' in rec) {
        // A cleared Variable reports `null`, and `undefined` is the expression vocabulary's only
        // absent value — but a constant reaches `null` solely through `Treat empty as`, which
        // needs a stored null to coerce, and a constant never stores one. So this cannot fire
        // today; it is here because `constant` is typed to admit null and silently emitting
        // `null` as a literal would be a lie the type allows.
        if (rec.constant === null) {
          ctx.defer = 'it reports a cleared (null) value, which this slice’s expressions cannot carry';
          return null;
        }
        return { kind: 'literal', value: rec.constant };
      }
      return { kind: 'state-get', name: rec.stateVar.name };
    }
    // A stateful control's value output reads its local state anywhere in the component
    // (§4c); inside the control's own onChange the chain-local snapshot rewrites it to the
    // user-path event value. A text input nothing makes stateful keeps today's own-chain rule.
    {
      const spec = controlSpecOf(fromNode.id);
      if (spec !== undefined && fromProperty === spec.output) {
        const stateVar = controlStateVars.get(fromNode.id);
        if (stateVar !== undefined) return { kind: 'state-get', name: stateVar.name };
      }
    }
    // A record verb's Error output (RECORD-VERBS-TARGET §4a) — component state, maybe-undefined
    // until the first refusal, which folds at its sinks exactly as the runtime's own unwritten
    // getter does. Read only when the verb itself translates: a deferred verb never writes it,
    // and a state row nothing writes would be an invented value.
    if ((RECORD_VERBS[fromNode.type] !== undefined || USER_VERBS[fromNode.type] !== undefined) && fromProperty === 'error') {
      if (!attachedRecordVerbs.has(fromNode.id)) {
        const trigger = USER_VERBS[fromNode.type]?.trigger ?? 'store';
        const compiled = compiledOf(fromNode, trigger);
        ctx.defer = 'defer' in compiled ? compiled.defer : 'its Do is never fired by a translatable trigger';
        return null;
      }
      return { kind: 'state-get', name: verbErrorStateOf(fromNode).name, maybeUndefined: true };
    }
    // The `User` node's session reads (USER-FAMILY-TARGET §4c). Not an action: the runtime's
    // outputs are getters over `UserService`, re-read on four session events, so the faithful
    // translation is a read of the session and not a stored value.
    if (fromNode.type === 'net.noodl.user.User') {
      const read = SESSION_READS[fromProperty];
      if (read === undefined) {
        ctx.defer = `its ${fromProperty} output belongs to the Fetch path, which is not translated in this slice`;
        return null;
      }
      const gate = sessionReadGate(fromNode);
      if (gate !== null) {
        ctx.defer = gate;
        return null;
      }
      // Deliberately *not* pushed onto `plan.sessionCalls` here: `resolveExpr` runs
      // speculatively and a pass may drop the wire it resolved, which would leave a
      // `useSession` in the stub module that nothing imports. The read is earned by a
      // surviving expression instead — the sweep below §4c's comment.
      ctx.logicNodeIds.push(fromNode.id);
      return read === 'authenticated'
        ? { kind: 'session-get', nodeId: fromNode.id, field: 'authenticated' }
        : { kind: 'session-get', nodeId: fromNode.id, field: read.field };
    }
    if (isTextInputType(fromNode.type) && fromProperty === 'onTextChanged') {
      return { kind: 'input-text', inputId: fromNode.id };
    }
    if (fromNode.type === 'Event Receiver' && fromProperty !== 'eventReceived') {
      const name = channelNameOf(fromNode);
      const known = name !== undefined && registry.channels.get(name)!.payload.some((p) => p.key === fromProperty);
      return known ? { kind: 'payload', key: fromProperty, receiverId: fromNode.id } : null;
    }
    if (fromNode.type === 'String Format' && fromProperty === 'formatted') {
      if (ctx.visited.has(fromNode.id)) {
        ctx.defer = 'a wire cycle through logic nodes';
        return null;
      }
      ctx.visited.add(fromNode.id);
      return formatExprOf(fromNode, ctx);
    }
    if ((fromNode.type === 'And' || fromNode.type === 'Or') && fromProperty === 'result') {
      if (ctx.visited.has(fromNode.id)) {
        ctx.defer = 'a wire cycle through logic nodes';
        return null;
      }
      ctx.visited.add(fromNode.id);
      return logicalExprOf(fromNode, fromNode.type === 'And' ? 'and' : 'or', ctx);
    }
    if (fromNode.type === 'Inverter' && fromProperty === 'result') {
      if (ctx.visited.has(fromNode.id)) {
        ctx.defer = 'a wire cycle through logic nodes';
        return null;
      }
      ctx.visited.add(fromNode.id);
      return inverterExprOf(fromNode, ctx);
    }
    if (fromNode.type === 'Condition' && (fromProperty === 'result' || fromProperty === 'isfalse')) {
      if (ctx.visited.has(fromNode.id)) {
        ctx.defer = 'a wire cycle through logic nodes';
        return null;
      }
      ctx.visited.add(fromNode.id);
      return conditionValueExprOf(fromNode, fromProperty, ctx);
    }
    return null;
  };

  /** Truthiness of an expression, folded: literals fold, boolean kinds pass through. */
  const truthyExpr = (expr: ValueExpr): ValueExpr => {
    if (expr.kind === 'literal') return { kind: 'literal', value: Boolean(expr.value) };
    if (expr.kind === 'undefined') return { kind: 'literal', value: false };
    if (expr.kind === 'logical' || expr.kind === 'not' || expr.kind === 'truthy') return expr;
    return { kind: 'truthy', operand: expr };
  };

  /** Negation, folded: literals fold, a double negation collapses (LOGIC-TARGET §9). */
  const notExpr = (expr: ValueExpr): ValueExpr => {
    if (expr.kind === 'literal') return { kind: 'literal', value: !expr.value };
    if (expr.kind === 'undefined') return { kind: 'literal', value: true };
    if (expr.kind === 'not') return truthyExpr(expr.operand);
    if (expr.kind === 'truthy') return { kind: 'not', operand: expr.operand };
    return { kind: 'not', operand: expr };
  };

  /** The truthiness-only kinds — admitted into value-shaped sinks never (LOGIC-TARGET §5 headnote). */
  const isBooleanExpr = (expr: ValueExpr): boolean =>
    expr.kind === 'logical' || expr.kind === 'not' || expr.kind === 'truthy';

  /**
   * Whether an expression can statically be undefined — the Inverter gate (§6): the runtime
   * passes undefined through where `!x` would say true. The emit layer keeps its own twin of
   * this judgement for `?? ''` interpolation (component.ts maybeUndefined); they serve
   * different sinks but must agree on the sources.
   */
  const maybeUndefinedExpr = (expr: ValueExpr): boolean => {
    switch (expr.kind) {
      case 'prop':
      case 'store-get':
      case 'payload':
        return true;
      case 'store-key-get':
        return !(registry.stores.get(expr.storeName)?.keys.find((k) => k.key === expr.key)?.required ?? false);
      // `authenticated` is `model !== undefined` — a real boolean, never absent. The other three
      // are `model.get(…)` and read undefined while nobody is signed in (USER-FAMILY §1).
      case 'session-get':
        return expr.field !== 'authenticated';
      case 'undefined':
        return true;
      // An output the body might not write reads undefined, exactly like the runtime getter
      // (§4); the typed Expression folds never answer undefined. A materialized read is
      // undefined until the first invocation (CONTROLLED-STATE §4f).
      case 'jsfun-out':
        return expr.viaState !== undefined || expr.fold === undefined;
      case 'state-get':
        return expr.maybeUndefined === true;
      // A list is never undefined: a named array is a module-scope `collection([])` that exists
      // from module load, and both transforms return a fresh array on every run
      // (`Collection.create(...)` in the runtime, `.map`/`.filter` here).
      case 'collection-get':
      case 'list-map':
      case 'list-filter':
      case 'input-text':
      case 'control-event':
      case 'literal':
      case 'format':
      case 'logical':
      case 'not':
      case 'truthy':
        return false;
    }
  };

  /**
   * An And/Or as an expression (LOGIC-TARGET §6): operands in port order (`input 0`, …), a
   * wire winning over a literal parameter on the same port. Literal operands fold — a decisive
   * one (false into And, true into Or) collapses the whole node after every operand has
   * resolved and been consumed; a single survivor collapses to its truthiness.
   */
  const logicalExprOf = (node: NodeIR, op: 'and' | 'or', ctx: ResolveCtx): ValueExpr | null => {
    const indices = new Set<number>();
    for (const c of component.connections) {
      const match = c.toId === node.id ? /^input (\d+)$/.exec(c.toProperty) : null;
      if (match) indices.add(Number(match[1]));
    }
    for (const p of node.parameters) {
      const match = /^input (\d+)$/.exec(p.name);
      if (match && p.value.kind === 'literal') indices.add(Number(match[1]));
    }
    if (indices.size === 0) {
      ctx.defer = `the ${node.type} has no inputs wired or authored`;
      return null;
    }
    const operands: ValueExpr[] = [];
    for (const index of [...indices].sort((a, b) => a - b)) {
      const wire = component.connections.find((c) => c.toId === node.id && c.toProperty === `input ${index}`);
      if (wire) {
        const expr = resolveExpr(nodeById.get(wire.fromId), wire.fromProperty, ctx);
        if (expr === null) {
          if (ctx.defer === undefined) ctx.defer = `input ${index} has no statically known source`;
          return null;
        }
        operands.push(expr);
        ctx.consumes.push(wire.key);
      } else {
        operands.push({ kind: 'literal', value: literalParam(node, `input ${index}`)! });
      }
    }
    ctx.logicNodeIds.push(node.id);
    const kept: ValueExpr[] = [];
    for (const operand of operands) {
      // An undefined boot value is a falsy constant — folded exactly as a false literal.
      if (operand.kind === 'literal' || operand.kind === 'undefined') {
        const truthy = operand.kind === 'literal' && Boolean(operand.value);
        if (op === 'and' ? !truthy : truthy) return { kind: 'literal', value: op === 'or' };
        continue;
      }
      kept.push(operand);
    }
    if (kept.length === 0) return { kind: 'literal', value: op === 'and' };
    if (kept.length === 1) return truthyExpr(kept[0]);
    return { kind: 'logical', op, operands: kept };
  };

  /** An Inverter as `!x` — only when x cannot be undefined; the passthrough otherwise (§6). */
  const inverterExprOf = (node: NodeIR, ctx: ResolveCtx): ValueExpr | null => {
    const wire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'value');
    let operand: ValueExpr;
    if (wire) {
      const resolved = resolveExpr(nodeById.get(wire.fromId), wire.fromProperty, ctx);
      if (resolved === null) {
        if (ctx.defer === undefined) ctx.defer = 'the inverted value has no statically known source';
        return null;
      }
      operand = resolved;
      ctx.consumes.push(wire.key);
    } else {
      const literal = literalParam(node, 'value');
      if (literal === undefined) {
        ctx.defer = 'nothing statically known feeds the Inverter';
        return null;
      }
      operand = { kind: 'literal', value: literal };
    }
    if (maybeUndefinedExpr(operand)) {
      ctx.defer = 'its operand can be undefined, and the Inverter passes undefined through where !x would say true';
      return null;
    }
    ctx.logicNodeIds.push(node.id);
    return notExpr(operand);
  };

  /**
   * A Condition's value outputs as expressions (LOGIC-TARGET §6): live only while the node
   * re-tests on change, so the gate is the branch gate mirrored — `runOnChange-condition`
   * must be ticked (absent), and the node must be *only* a comparator: no Evaluate, no arms,
   * no outcome wired. `result` is the condition's own truthiness, `isfalse` its negation.
   */
  const conditionValueExprOf = (node: NodeIR, output: 'result' | 'isfalse', ctx: ResolveCtx): ValueExpr | null => {
    if (literalParam(node, 'runOnChange-condition') === false) {
      ctx.defer =
        'its value outputs are snapshots of the last Evaluate (Run On Value Change is unticked) — only a live comparator translates in this slice';
      return null;
    }
    const mixed =
      wiredPorts.has(`${node.id}:eval`) ||
      component.connections.some((c) => c.fromId === node.id && c.fromProperty !== 'result' && c.fromProperty !== 'isfalse');
    if (mixed) {
      ctx.defer = 'a Condition mixing Evaluate or branch wiring with value outputs has no single honest translation';
      return null;
    }
    const condWire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'condition');
    let cond: ValueExpr;
    if (condWire) {
      const resolved = resolveExpr(nodeById.get(condWire.fromId), condWire.fromProperty, ctx);
      if (resolved === null) {
        if (ctx.defer === undefined) ctx.defer = 'the condition wire has no statically known source';
        return null;
      }
      cond = resolved;
      ctx.consumes.push(condWire.key);
    } else {
      const literal = literalParam(node, 'condition');
      if (literal === undefined) {
        ctx.defer = 'nothing statically known feeds condition';
        return null;
      }
      cond = { kind: 'literal', value: literal };
    }
    ctx.logicNodeIds.push(node.id);
    return output === 'result' ? truthyExpr(cond) : notExpr(cond);
  };

  /**
   * A String Format as an expression: static text transcribed (a literal parameter on a
   * placeholder folds in; an unfed placeholder substitutes '' — the runtime's own rule), wired
   * placeholders resolved recursively. All-static formats fold to a literal; a bare
   * single-placeholder format collapses to its string-typed expression (LOGIC-TARGET §2).
   */
  const formatExprOf = (node: NodeIR, ctx: ResolveCtx): ValueExpr | null => {
    if (wiredPorts.has(`${node.id}:format`)) {
      ctx.defer = 'the format string is wired, not literal';
      return null;
    }
    const format = literalParam(node, 'format');
    if (typeof format !== 'string') {
      ctx.defer = 'the format string is not a literal';
      return null;
    }
    const parts: Array<string | ValueExpr> = [];
    const pushText = (text: string) => {
      if (text.length === 0) return;
      const last = parts.length - 1;
      if (typeof parts[last] === 'string') parts[last] = (parts[last] as string) + text;
      else parts.push(text);
    };
    const placeholderPattern = /\{([A-Za-z0-9_]*)\}/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = placeholderPattern.exec(format)) !== null) {
      pushText(format.slice(cursor, match.index));
      cursor = match.index + match[0].length;
      const name = match[1];
      if (name.length === 0) {
        ctx.defer = 'the format contains a nameless {} placeholder';
        return null;
      }
      const wire = component.connections.find((c) => c.toId === node.id && c.toProperty === name);
      if (wire) {
        const expr = resolveExpr(nodeById.get(wire.fromId), wire.fromProperty, ctx);
        if (expr === null) {
          if (ctx.defer === undefined) ctx.defer = `placeholder "${name}" has no statically known source`;
          return null;
        }
        if (isBooleanExpr(expr)) {
          ctx.defer = `placeholder "${name}" is fed a logic truth value — only truthiness sinks take one in this slice`;
          return null;
        }
        // An undefined boot value substitutes '' — the runtime's own rule for an undefined
        // delivery (step 6): the placeholder disappears, the wire is still translated.
        if (expr.kind === 'undefined') {
          ctx.consumes.push(wire.key);
          continue;
        }
        parts.push(expr);
        ctx.consumes.push(wire.key);
        continue;
      }
      const literal = literalParam(node, name);
      if (literal !== undefined) pushText(String(literal));
      // Neither wire nor parameter: the runtime substitutes '' — the placeholder disappears.
    }
    pushText(format.slice(cursor));
    ctx.logicNodeIds.push(node.id);
    const exprs = parts.filter((p): p is ValueExpr => typeof p !== 'string');
    if (exprs.length === 0) return { kind: 'literal', value: parts.length === 1 ? (parts[0] as string) : '' };
    if (parts.length === 1 && exprTsType(exprs[0]) === 'string') return exprs[0];
    return { kind: 'format', parts };
  };

  /** As far as an expression's TypeScript type is statically known — the format-collapse gate. */
  const exprTsType = (expr: ValueExpr): string => {
    switch (expr.kind) {
      case 'prop':
        return plan.props.find((p) => p.name === expr.name)?.tsType ?? 'unknown';
      case 'input-text':
        return 'string';
      case 'store-get':
        return registry.variables.get(expr.variableName)?.tsType ?? 'unknown';
      case 'store-key-get':
        return registry.stores.get(expr.storeName)?.keys.find((k) => k.key === expr.key)?.tsType ?? 'unknown';
      case 'session-get':
        return expr.field === 'authenticated' ? 'boolean' : 'string';
      case 'payload':
        return registry.channels.get(channelNameOf(nodeById.get(expr.receiverId)!)!)?.payload.find((p) => p.key === expr.key)?.tsType ?? 'unknown';
      case 'literal':
        return typeof expr.value;
      case 'format':
        return 'string';
      case 'undefined':
        return 'undefined';
      case 'jsfun-out':
        return expr.fold ?? 'unknown';
      case 'state-get':
        return plan.stateVars.find((v) => v.name === expr.name)?.tsType.replace(' | undefined', '') ?? 'unknown';
      case 'control-event':
        return expr.form === 'checked' ? 'boolean' : expr.form === 'number' ? 'number' : 'string';
      case 'logical':
      case 'not':
      case 'truthy':
        return 'boolean';
      /**
       * `any[]`, and the `[]` is load-bearing: the repeater's §4e feed gates on
       * `tsType.endsWith('[]')`, so this is what admits a filtered or mapped array as a `For
       * Each`'s items. `any` rather than a derived row type because that path's contract is
       * "no statically-known item shape, so fields read as `any` and every mapped input is
       * kept" — claiming a row type here would make the repeater drop mapped inputs it cannot
       * prove the row carries, which is the §10 ruling in reverse.
       */
      case 'collection-get':
      case 'list-map':
      case 'list-filter':
        return 'any[]';
    }
  };

  type CompiledSink =
    | { action: HandlerAction; consumes: string[]; collapses?: string[]; subscribes?: string[] }
    | { defer: string };

  const TRIGGER_PORTS: Record<string, string> = {
    RouterNavigate: 'navigate',
    'Event Sender': 'sendEvent',
    'Set Variable': 'do',
    [GLOBAL_STORE_SET]: 'set',
    NewModel: 'new',
    // EXP-011 Tier 1.1. The port is `clear`; its display name is "Do".
    CollectionClear: 'clear',
    Condition: 'eval',
    NewDbModelProperties: 'store',
    SetDbModelProperties: 'store',
    DeleteDbModelProperties: 'store',
    // ⚠️ Log Out's is `login` too — the port name is persisted in every project that uses the
    // node, so the runtime could not correct it (USER-FAMILY-TARGET §1).
    'net.noodl.user.LogIn': 'login',
    'net.noodl.user.LogOut': 'login',
    'net.noodl.user.SignUp': 'signup'
  };

  /** The popup nodes' trigger ports are dynamic (`closeAction-*`), so membership is a predicate. */
  const isTriggerWire = (type: string, toProperty: string): boolean =>
    TRIGGER_PORTS[type] === toProperty ||
    (type === 'NavigationShowPopup' && toProperty === 'show') ||
    (type === 'NavigationClosePopup' && (toProperty === 'close' || toProperty.startsWith('closeAction-'))) ||
    (jsNodeKindOf(type) !== null && toProperty === 'run') ||
    (isLatchType(type) && (LATCH_TRIGGERS[type] ?? []).includes(toProperty)) ||
    ((type === 'net.noodl.controls.checkbox' || type === 'Checkbox') && (toProperty === 'check' || toProperty === 'uncheck')) ||
    (isTextInputType(type) && toProperty === 'clear');

  // Which components open as popups anywhere in the project — the close side translates only
  // inside one; elsewhere the runtime resolves an enclosing popup by ancestor walk, which a
  // prop cannot thread statically (POPUPS-TARGET §4).
  const popupTargetLegacies = new Set<string>();
  for (const comp of ir.components) {
    for (const n of comp.nodes) {
      if (n.type !== 'NavigationShowPopup') continue;
      const target = literalParam(n, 'target');
      if (typeof target === 'string') popupTargetLegacies.add(target);
    }
  }

  // The slot registry (POPUPS-TARGET §2): nodes opening the same target with identical literal
  // params share a key; distinct param sets on one target take numeric suffixes in compile
  // order. plan.popups is filtered to the keys that actually attached, after pass 2.
  const slotRegistry: PopupSlotPlan[] = [];
  const slotFor = (targetLegacy: string, params: PopupSlotPlan['params']): string => {
    const identity = JSON.stringify([targetLegacy, params]);
    const existing = slotRegistry.find((s) => JSON.stringify([s.targetLegacy, s.params]) === identity);
    if (existing) return existing.slotKey;
    const base = pascalCase(lastSegment(targetLegacy.replace(/^\//, '')));
    let key = base;
    let counter = 2;
    while (slotRegistry.some((s) => s.slotKey === key)) key = `${base}${counter++}`;
    slotRegistry.push({ slotKey: key, targetLegacy, params });
    return key;
  };

  /** Reserved-prop collision (§4): checked from both sides of the declared interface. */
  const closePropCollision = (() => {
    const taken = new Set(plan.props.map((p) => p.name));
    plan.outputProps.forEach((o) => taken.add(o.prop));
    return taken.has('onClose')
      ? 'a declared port already claims the reserved prop "onClose" — rename the port (POPUPS-TARGET §4)'
      : undefined;
  })();

  /**
   * Compile the wires off a popup node's `done` into actions appended in the same handler
   * (POPUPS-TARGET §3, §4). A `done`-chain into a Component Outputs port fires the callback
   * (the outputs node keeps its own disposition); into any other sink it must be a
   * translatable trigger. Anything else defers the popup node.
   */
  type DoneChain = { then: HandlerAction[]; consumes: string[]; collapses: string[]; subscribes: string[] };
  /**
   * `port` is a parameter rather than a second copy of this function because EXP-011 Tier 1.1's
   * `Clear Array` owes chains off **two** outcome ports (`done` and `unchanged`), compiled by
   * identical rules — and FINDINGS B-iv's standing lesson here is that the divergence between
   * near-identical copies is itself the defect. Defaulted, so every existing call site keeps
   * asking exactly what it asked before.
   */
  const doneChainOf = (node: NodeIR, port = 'done'): DoneChain | { defer: string } => {
    const then: HandlerAction[] = [];
    const consumes: string[] = [];
    const collapses: string[] = [];
    const subscribes: string[] = [];
    for (const wire of component.connections.filter((c) => c.fromId === node.id && c.fromProperty === port)) {
      if (wire.toId === node.id) return { defer: `its ${port} output drives itself` };
      const target = nodeById.get(wire.toId);
      if (target?.type === 'Component Outputs') {
        const sink = outputSinkOf(wire.toProperty, node);
        if ('drop' in sink) {
          notes.push(`wire ${wire.key} dropped: ${sink.drop}`);
          consumes.push(wire.key);
          continue;
        }
        if ('defer' in sink) return { defer: sink.defer };
        then.push(sink.action);
        consumes.push(wire.key);
        continue;
      }
      if (!target || !isTriggerWire(target.type, wire.toProperty)) {
        return { defer: `its ${port} output drives no translatable action` };
      }
      const compiled = compiledOf(target, wire.toProperty);
      if ('defer' in compiled) return { defer: compiled.defer };
      then.push(compiled.action);
      consumes.push(wire.key, ...compiled.consumes);
      collapses.push(target.id, ...(compiled.collapses ?? []));
      subscribes.push(...(compiled.subscribes ?? []));
    }
    return { then, consumes, collapses, subscribes };
  };

  /** Show Popup → the slot set + `done`-chain (POPUPS-TARGET §3). */
  const compileShowPopup = (node: NodeIR): CompiledSink => {
    if (wiredPorts.has(`${node.id}:target`)) {
      return { defer: 'target is wired — which component opens is not statically knowable' };
    }
    const target = literalParam(node, 'target');
    if (typeof target !== 'string') {
      return { defer: "no Target component is set (the runtime's show-popup/no-target failure)" };
    }
    const targetComp = ir.components.find((c) => `/${c.path}` === target);
    if (!targetComp) return { defer: `popup target ${target} is not in the project` };
    if (targetComp.role === 'page' || targetComp.nodes.some((n) => n.type === 'Page' || n.type === 'Router')) {
      return { defer: 'a page cannot open as a popup slot in this slice' };
    }
    const rootable = targetComp.nodes.some((n) => {
      if (n.parent !== undefined) return false;
      const role = renderRole(n, catalog, kits);
      return role !== null && role !== 'unsupported' && role !== 'radio';
    });
    if (!rootable) return { defer: `popup target ${target} exports no component (no visual root)` };
    if (literalParam(node, 'stackPolicy') === 'stack' || wiredPorts.has(`${node.id}:stackPolicy`)) {
      return { defer: 'Show On Top layers popups — the slot is single in this slice (POPUPS-TARGET §7)' };
    }
    const consumedOutput = component.connections.find((c) => c.fromId === node.id && c.fromProperty !== 'done');
    if (consumedOutput) {
      return {
        defer: `its ${consumedOutput.fromProperty} output is consumed — close-outcome dispatch is future work (POPUPS-TARGET §7)`
      };
    }
    const wiredParam = component.connections.find((c) => c.toId === node.id && c.toProperty.startsWith('popupParam-'));
    if (wiredParam) {
      return {
        defer: `${wiredParam.toProperty} is wired — the runtime snapshots params at open; only literal params translate`
      };
    }
    const targetInputs = new Set<string>();
    for (const n of targetComp.nodes) {
      if (n.type !== 'Component Inputs') continue;
      for (const p of n.declaredPorts) if (p.plug === 'output') targetInputs.add(p.name);
    }
    const params: PopupSlotPlan['params'] = [];
    for (const param of node.parameters) {
      if (!param.name.startsWith('popupParam-')) continue;
      const input = param.name.slice('popupParam-'.length);
      if (param.value.kind !== 'literal') {
        return { defer: `popup param "${input}" is not a literal value` };
      }
      if (!targetInputs.has(input)) {
        notes.push(`Show Popup ${node.id} param "${input}" names no input on ${target} — dropped, reported`);
        continue;
      }
      params.push({ input, value: param.value.value });
    }
    const chain = doneChainOf(node);
    if ('defer' in chain) return chain;
    return {
      action: { kind: 'popup-show', slotKey: slotFor(target, params), then: chain.then },
      consumes: chain.consumes,
      collapses: chain.collapses,
      subscribes: chain.subscribes
    };
  };

  /** Close Popup → the reserved-prop call (POPUPS-TARGET §4), per trigger port. */
  const compileClosePopup = (node: NodeIR, port: string): CompiledSink => {
    if (!popupTargetLegacies.has(`/${component.path}`)) {
      return {
        defer:
          'closes an enclosing popup the runtime resolves by ancestor walk — only a component opened directly as a popup target translates in this slice'
      };
    }
    if (literalParam(node, 'targetComponent') !== undefined || wiredPorts.has(`${node.id}:targetComponent`)) {
      return { defer: 'Popup names a specific enclosing popup — nested popups are not translated in this slice' };
    }
    if (
      literalParam(node, 'results') !== undefined ||
      component.connections.some((c) => c.toId === node.id && c.toProperty.startsWith('result-'))
    ) {
      return { defer: 'close results are value outputs — lifted state belongs to the component-state slice' };
    }
    const consumedOutput = component.connections.find((c) => c.fromId === node.id && c.fromProperty !== 'done');
    if (consumedOutput) {
      return { defer: `its ${consumedOutput.fromProperty} output is consumed — not translated in this slice` };
    }
    if (closePropCollision !== undefined) return { defer: closePropCollision };
    const chain = doneChainOf(node);
    if ('defer' in chain) return chain;
    return {
      action: {
        kind: 'popup-close',
        ...(port === 'close' ? {} : { action: port.slice('closeAction-'.length) }),
        then: chain.then
      },
      consumes: chain.consumes,
      collapses: chain.collapses,
      subscribes: chain.subscribes
    };
  };

  // The NewModel → CollectionInsert chains (COLLECTIONS-TARGET §2), keyed by the NewModel so
  // the trigger wire into `new` compiles the whole pair. An insert whose chain defers parks the
  // reason on the NewModel feeding its Do, so the trigger wire reports why.
  const chainByNewModel = new Map<string, { chain: InsertChain } | { defer: string }>();
  for (const node of component.nodes) {
    if (node.type !== 'CollectionInsert') continue;
    const result = insertChainOf(component, node, nodeById, wiredPorts);
    if ('chain' in result) {
      chainByNewModel.set(result.chain.newModelId, result);
    } else {
      const addWire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'add');
      const from = addWire ? nodeById.get(addWire.fromId) : undefined;
      if (from?.type === 'NewModel' && !chainByNewModel.has(from.id)) chainByNewModel.set(from.id, result);
    }
  }

  /**
   * A2h (EXP-003 §4): `run` wired from a handler chain, outputs consumed in that chain. The
   * compiled action carries only the `done`-chain — a pure body run without reading its outputs
   * is unobservable, and every output read inside the chain inlines the call at its sink. The
   * runtime's `done` is invocation-only for both nodes (empty-token runs pulse nothing), so the
   * handler-only translation is exact, not an approximation.
   */
  const compileJsRun = (node: NodeIR): CompiledSink => {
    const record = jsFunDefOf(node);
    if ('defer' in record) return { defer: record.defer };
    // §3.6 over the run path: success co-fires with done, failure/unchanged/error report the
    // run itself, isTrueEv/isFalseEv pulse per evaluation — any of them consumed defers.
    for (const c of component.connections) {
      if (c.fromId !== node.id || c.fromProperty === 'done' || isJsValueOutput(node, c.fromProperty)) continue;
      if (node.type === JS_FUNCTION && !c.fromProperty.startsWith('out-')) {
        const builtIn = ['success', 'failure', 'unchanged', 'completed', 'error'].includes(c.fromProperty);
        if (!builtIn) continue; // a dead bare-name wire — the pre-pass noted and consumed it
      }
      if (isVisualFunction(node.type) && visualIoOf(node).signalOutputs.includes(c.fromProperty)) {
        // A `send signal` block fires a chain of its own, conditionally on the branch the
        // program took. Compiling that means one guarded chain per signal off a `fired` list —
        // the next increment. Both corpus instances land on sinks this slice cannot translate
        // anyway (a deferred DB node, and an imperative focus), so nothing is lost by refusing
        // it here rather than building it untested.
        const sink = nodeById.get(c.toId);
        return {
          defer: `its block-declared signal "${c.fromProperty}" drives ${sink?.type ?? 'a missing node'}.${c.toProperty} — conditional signal chains are the next increment`
        };
      }
      return { defer: `its ${c.fromProperty} output is consumed — only done continues a Run chain in this slice` };
    }
    const chain = doneChainOf(node);
    if ('defer' in chain) return chain;
    const strayRead = component.connections.find(
      (c) => c.fromId === node.id && isJsValueOutput(node, c.fromProperty) && !chain.consumes.includes(c.key)
    );
    // §4f (CONTROLLED-STATE-TARGET): outputs read outside the Run chain materialize the output
    // record as a state var written where the chain runs — render reads are maybe-undefined
    // until the first invocation, the runtime's own pre-first-run contract.
    let materialize: string | undefined;
    if (strayRead) {
      const strayRendered = nodeById.get(strayRead.toId);
      if (!strayRendered || !rendered.has(strayRead.toId)) {
        return {
          defer: `its ${strayRead.fromProperty} output is consumed outside the Run chain by an unrendered sink — the last run's value is not statically expressible there`
        };
      }
      const def = record.def;
      const fields = def.outputs.map(
        (o) => `${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(o.name) ? o.name : JSON.stringify(o.name)}?: ${o.tsType}`
      );
      const tsType =
        def.kind !== 'expression'
          ? `${fields.length > 0 ? `{ ${fields.join('; ')} }` : 'Record<string, never>'} | undefined`
          : 'any';
      const stateVar = allocStateVar(
        `${def.fnName}Out`,
        'runOut',
        tsType,
        null,
        node.id,
        'jsfun',
        `The last run of ${def.fnName} (§4f) — undefined until the first invocation, as the runtime's unwritten outputs read.`
      );
      materialize = stateVar.name;
      jsMaterializedVars.set(node.id, stateVar);
    }
    if (chain.then.length === 0 && materialize === undefined) {
      return { defer: 'its Run drives nothing this slice translates — no done-chain action consumes its work' };
    }
    return {
      action: {
        kind: 'jsfun-run',
        nodeId: node.id,
        then: chain.then,
        ...(materialize !== undefined ? { materialize } : {})
      },
      consumes: chain.consumes,
      collapses: chain.collapses,
      subscribes: chain.subscribes
    };
  };

  /**
   * A latch trigger as a state write (CONTROLLED-STATE-TARGET §4a): `on`/`off` set literally,
   * `flip` and the Counter arithmetic are functional updates (immune to closure staleness —
   * which is why they are `op`, never `expr`), `reset` writes the literal start value.
   */
  const compileLatch = (node: NodeIR, port: string): CompiledSink => {
    const rec = latchStateOf(node);
    if ('defer' in rec) return { defer: rec.defer };
    const name = rec.stateVar.name;
    const action: HandlerAction =
      port === 'on'
        ? { kind: 'state-set', name, expr: { kind: 'literal', value: true } }
        : port === 'off'
          ? { kind: 'state-set', name, expr: { kind: 'literal', value: false } }
          : port === 'flip'
            ? { kind: 'state-set', name, op: 'toggle' }
            : port === 'increase'
              ? { kind: 'state-set', name, op: 'inc' }
              : port === 'decrease'
                ? { kind: 'state-set', name, op: 'dec' }
                : { kind: 'state-set', name, expr: { kind: 'literal', value: rec.stateVar.boot as number } };
    return { action, consumes: [] };
  };

  /** Checkbox check/uncheck and Text Input clear as state writes on a stateful control (§4c). */
  const compileControlAction = (node: NodeIR, port: string): CompiledSink => {
    const consumedOutcome = component.connections.find(
      (c) => c.fromId === node.id && (c.fromProperty === 'done' || c.fromProperty === 'unchanged')
    );
    if (consumedOutcome) {
      return {
        defer: `its ${consumedOutcome.fromProperty} outcome is consumed — change-conditional pulses are not translated in this slice`
      };
    }
    const stateVar = controlStateVars.get(node.id);
    if (stateVar === undefined) {
      return { defer: `its ${port} action writes control state nothing else observes — no state row is minted` };
    }
    const action: HandlerAction =
      port === 'check'
        ? { kind: 'state-set', name: stateVar.name, expr: { kind: 'literal', value: true } }
        : port === 'uncheck'
          ? { kind: 'state-set', name: stateVar.name, expr: { kind: 'literal', value: false } }
          : // clear → the field type's empty value, projected onto the DOM string (FB-026).
            { kind: 'state-set', name: stateVar.name, expr: { kind: 'literal', value: '' } };
    return { action, consumes: [] };
  };

  /**
   * A record verb fired from a handler chain (RECORD-VERBS-TARGET §4/§5).
   *
   * Every gate below is a fork in the runtime contract (§1) that the emit vocabulary has no
   * shape for, and each names the slice that owns it. The two the corpus actually exercises are
   * the missing class name — where the runtime answers `Failure` with *"No class name
   * specified"* and never reaches the backend, so a working call would be a hole shaped exactly
   * like the defect — and the two-writer property, which is CO §4's rule in its own words.
   */
  const compileRecordOp = (node: NodeIR): CompiledSink => {
    const verb = RECORD_VERBS[node.type];
    const authoredOrWired = (name: string) =>
      node.parameters.some((p) => p.name === name) || wiredPorts.has(`${node.id}:${name}`);

    if (node.parameters.some((p) => p.name === 'accessControl' || p.name.startsWith('acl-'))) {
      return { defer: 'it writes access-control rules with the record — the ACL has no shape in the api stub' };
    }
    if (authoredOrWired('backendId')) return { defer: 'it names a specific Backend — one api module per class is all this slice emits' };
    if (verb === 'create' && authoredOrWired('sourceObjectId')) {
      return { defer: 'its Source Object Id seeds the new record from an existing one — that read is not translated in this slice' };
    }
    if (literalParam(node, 'idSource') === 'foreach' || authoredOrWired('repeaterComponent')) {
      return { defer: 'its Id Source is the enclosing repeater\'s row — row identity is not statically knowable in this slice' };
    }
    if (verb === 'update') {
      if (literalParam(node, 'storeType') === 'local' || wiredPorts.has(`${node.id}:storeType`)) {
        return { defer: 'Store to is Local only — an in-memory-only write, and the export holds no record to write into' };
      }
      if (literalParam(node, 'storeProperties') === 'all' || wiredPorts.has(`${node.id}:storeProperties`)) {
        return { defer: 'Properties to store is All — it sends every field the record holds, and the export holds none of them' };
      }
    }

    const collectionName = literalParam(node, 'collectionName');
    if (typeof collectionName !== 'string' || collectionName === '' || wiredPorts.has(`${node.id}:collectionName`)) {
      return {
        defer:
          collectionName === undefined
            ? 'no class is named, so the runtime answers Failure with "No class name specified" and never calls the backend'
            : 'its class name is not a literal'
      };
    }

    // Consumed outcome pulses beyond `done`, and the `id` output: the runtime pulses/publishes
    // them per invocation and nothing in this slice's shape carries them (§5.11).
    for (const wire of component.connections.filter((c) => c.fromId === node.id)) {
      if (wire.fromProperty === 'failure' || wire.fromProperty === 'completed') {
        return { defer: `its ${wire.fromProperty} output is consumed — only the done chain and the Error value are translated in this slice` };
      }
      if (wire.fromProperty === 'id') {
        return { defer: 'its Id output is consumed — the record it names exists only inside the invoking chain, which the relation verbs would need' };
      }
    }

    const ctx = newCtx();
    const consumes: string[] = [];

    // The record the verb acts on. `setModelID` treats an empty id as *clear the binding*, after
    // which every verb answers `setError('Missing Record Id')` — so an Update or Delete with no
    // Id at all is gate 1 by a second road (§5.9).
    let idExpr: ValueExpr | undefined;
    if (verb !== 'create') {
      const idWires = component.connections.filter((c) => c.toId === node.id && c.toProperty === 'modelId');
      if (idWires.length > 1) {
        return { defer: 'two wires feed its Id — last-writer-wins is not statically ordered' };
      }
      if (idWires.length === 1) {
        const expr = resolveExpr(nodeById.get(idWires[0].fromId), idWires[0].fromProperty, ctx);
        if (expr === null) return { defer: ctx.defer ?? 'its Id has no statically known source' };
        if (isBooleanExpr(expr)) return { defer: 'its Id is fed a logic truth value — only truthiness sinks take one in this slice' };
        idExpr = expr;
        consumes.push(idWires[0].key);
      } else {
        const literal = literalParam(node, 'modelId');
        if (typeof literal !== 'string' || literal === '') {
          return { defer: 'it names no record, so the runtime answers Failure with "Missing Record Id" every time' };
        }
        idExpr = { kind: 'literal', value: literal };
      }
    }

    // `prop-*` accumulate rather than trigger (§1): the body is whatever has arrived when `Do`
    // fires. Wire order first, then literal parameters the wires do not already cover.
    const props: Array<{ key: string; expr: ValueExpr }> = [];
    if (verb !== 'delete') {
      const seen = new Set<string>();
      for (const wire of component.connections) {
        if (wire.toId !== node.id || !wire.toProperty.startsWith('prop-')) continue;
        const key = wire.toProperty.slice('prop-'.length);
        if (seen.has(key)) {
          return { defer: `two wires feed prop-${key} — last-writer-wins is not statically ordered` };
        }
        seen.add(key);
        const expr = resolveExpr(nodeById.get(wire.fromId), wire.fromProperty, ctx);
        if (expr === null) return { defer: ctx.defer ?? `property "${key}" has no statically known source` };
        if (isBooleanExpr(expr)) {
          return { defer: `property "${key}" is fed a logic truth value — only truthiness sinks take one in this slice` };
        }
        props.push({ key, expr });
        consumes.push(wire.key);
      }
      for (const param of node.parameters) {
        if (!param.name.startsWith('prop-')) continue;
        const key = param.name.slice('prop-'.length);
        if (seen.has(key)) continue;
        const literal = literalParam(node, param.name);
        if (literal === undefined) return { defer: `property "${key}" is authored as something other than a literal` };
        props.push({ key, expr: { kind: 'literal', value: literal } });
      }
    }

    const chain = doneChainOf(node);
    if ('defer' in chain) return { defer: chain.defer };

    const { typeName, moduleBase } = collectionModuleNames(collectionName);
    const fnName = `${verb}${typeName}`;
    plan.mutations.push({
      nodeId: node.id,
      verb,
      collectionName,
      fnName,
      typeName,
      moduleBase,
      writes: props.map(({ key, expr }) => {
        // `unknown` where the argument's type is not statically known: honest, and still
        // assignable from whatever the call passes because every field is optional.
        const t = exprTsType(expr);
        return { name: key, tsType: t === 'string' || t === 'number' || t === 'boolean' ? t : 'unknown' };
      })
    });

    return {
      action: {
        kind: 'api-call',
        nodeId: node.id,
        verb,
        fnName,
        // `updatePuppy(id, {…})` / `createPuppy({…})` / `deletePuppy(id)` — position order.
        args: [
          ...(idExpr === undefined ? [] : [{ kind: 'expr' as const, expr: idExpr }]),
          ...(verb === 'delete' ? [] : [{ kind: 'data' as const, props }])
        ],
        guardId: idExpr !== undefined && idExpr.kind !== 'literal',
        errorState: verbErrorStateOf(node).name,
        then: chain.then
      },
      consumes: [...consumes, ...chain.consumes, ...ctx.consumes],
      collapses: [...ctx.logicNodeIds, ...chain.collapses],
      subscribes: [...ctx.subscriberIds, ...chain.subscribes]
    };
  };

  /**
   * A user-family action fired from a handler chain (USER-FAMILY-TARGET §4/§5).
   *
   * The record verbs' shape with a different service behind it, so this shares their action,
   * their Error state row, their attachment sweep and their `done`-chain compilation — the only
   * things that differ are the gates, and every gate here is a fork in §1's contract that the
   * emit vocabulary has no shape for.
   */
  const compileUserOp = (node: NodeIR): CompiledSink => {
    const spec = USER_VERBS[node.type];
    const ctx = newCtx();
    const consumes: string[] = [];

    // Consumed outcome pulses beyond `done`: the runtime pulses them per invocation, and only
    // the done chain and the Error value are translated in this slice (§5.4).
    for (const wire of component.connections.filter((c) => c.fromId === node.id)) {
      if (wire.fromProperty === 'failure' || wire.fromProperty === 'completed') {
        return {
          defer: `its ${wire.fromProperty} output is consumed — only the done chain and the Error value are translated in this slice`
        };
      }
    }

    // The credentials. Like `prop-*` these accumulate rather than trigger (§1), so the request
    // carries whatever has arrived when the trigger fires — and a control's state boots `''`,
    // which is §6's named divergence from the runtime's absent input.
    const props: Array<{ key: string; expr: ValueExpr }> = [];
    for (const key of spec.inputs) {
      const wires = component.connections.filter((c) => c.toId === node.id && c.toProperty === key);
      if (wires.length > 1) {
        return { defer: `two wires feed ${key} — last-writer-wins is not statically ordered` };
      }
      if (wires.length === 1) {
        const expr = resolveExpr(nodeById.get(wires[0].fromId), wires[0].fromProperty, ctx);
        if (expr === null) return { defer: ctx.defer ?? `its ${key} has no statically known source` };
        if (isBooleanExpr(expr)) {
          return { defer: `its ${key} is fed a logic truth value — only truthiness sinks take one in this slice` };
        }
        props.push({ key, expr });
        consumes.push(wires[0].key);
        continue;
      }
      const literal = literalParam(node, key);
      if (literal !== undefined) props.push({ key, expr: { kind: 'literal', value: literal } });
    }

    // Sign Up's extra `_User` columns: the export's session stub carries no user schema to type
    // them against, and the corpus has none — designed and deferred on §4c/§4e's precedent
    // rather than built with nothing to test it (§5.5).
    if (
      spec.verb === 'signup' &&
      (component.connections.some((c) => c.toId === node.id && c.toProperty.startsWith('prop-')) ||
        node.parameters.some((p) => p.name.startsWith('prop-')))
    ) {
      return {
        defer: 'it sets extra _User columns at sign-up — the export\'s session stub carries no user schema to type them against'
      };
    }

    const chain = doneChainOf(node);
    if ('defer' in chain) return { defer: chain.defer };

    plan.sessionCalls.push({ nodeId: node.id, verb: spec.verb, fnName: spec.fnName });

    return {
      action: {
        kind: 'api-call',
        nodeId: node.id,
        verb: spec.verb,
        fnName: spec.fnName,
        // `logIn(username, password)` / `signUp({…})` / `logOut()` — Log In reads better
        // positionally, Sign Up carries a widening field set, and Log Out takes nothing.
        args:
          spec.verb === 'signup'
            ? [{ kind: 'data' as const, props }]
            : spec.inputs.map((key) => ({
                kind: 'expr' as const,
                expr: props.find((p) => p.key === key)?.expr ?? { kind: 'literal' as const, value: '' }
              })),
        // No leading id argument: the user verbs act on the session, not on a record.
        guardId: false,
        errorState: verbErrorStateOf(node).name,
        then: chain.then
      },
      consumes: [...consumes, ...chain.consumes, ...ctx.consumes],
      collapses: [...ctx.logicNodeIds, ...chain.collapses],
      subscribes: [...ctx.subscriberIds, ...chain.subscribes]
    };
  };

  /**
   * `Clear Array` (EXP-011 Tier 1.1) — the array vocabulary's one unblocked mutator.
   *
   * The other two do not reach here and the reasons are recorded rather than inferred:
   * `Create New Array` mints an anonymous collection whose only consumer is another node's
   * *wired* Array Id, and a wired Array Id is precisely what {@link collectionNameOf} cannot
   * resolve; `Remove Object From Array` needs an Object Id, which in every shape a person
   * actually builds comes from inside a repeater row — and a row's outputs cannot reach the
   * page at all yet ("which row fired is not statically expressible", the relay gate below).
   */
  const compileCollectionClear = (node: NodeIR): CompiledSink => {
    const collectionName = collectionNameOf(node, wiredPorts);
    if (collectionName === undefined) {
      return {
        defer: 'its Array Id is not a literal name — a runtime-addressed array has no emitted module'
      };
    }
    if (!registry.collections.has(collectionName)) {
      return { defer: `no emitted module names the array "${collectionName}"` };
    }

    const consumes: string[] = [];
    for (const wire of component.connections.filter((c) => c.fromId === node.id)) {
      if (wire.fromProperty === 'completed') {
        return {
          defer: 'its Completed output is consumed — this slice translates the Done and Unchanged chains only'
        };
      }
      /**
       * 🔴 Dropped, not deferred, and the difference is a measured fact about the runtime.
       *
       * `Failure` has exactly one cause here — `_internal.collection === undefined`
       * (`collectionnode-clear.ts`) — and `setCollectionIdInput` leaves it undefined only when
       * the Array Id is cleared. A literal id goes to `resolveCollectionId`, which is
       * `Collection.get(id)`, and that mints a named collection for *any* string including `''`
       * (`collection-failure.ts` says so in its own words). So past the literal-name gate above
       * this wire cannot fire in the interpreter either. Deferring the whole node over a wire
       * that is already dead would lose a translation to a no-op.
       */
      if (wire.fromProperty === 'failure') {
        notes.push(
          `wire ${wire.key} dropped: Clear Array's Failure fires only when no array is bound, and a literal Array Id always resolves — the wire is dead in the interpreter too`
        );
        consumes.push(wire.key);
      }
    }

    const done = doneChainOf(node, 'done');
    if ('defer' in done) return { defer: done.defer };
    const unchanged = doneChainOf(node, 'unchanged');
    if ('defer' in unchanged) return { defer: unchanged.defer };

    return {
      action: {
        kind: 'collection-clear',
        collectionName,
        then: done.then,
        unchangedThen: unchanged.then
      },
      consumes: [...consumes, ...done.consumes, ...unchanged.consumes],
      collapses: [...done.collapses, ...unchanged.collapses],
      subscribes: [...done.subscribes, ...unchanged.subscribes]
    };
  };

  const compileSink = (node: NodeIR, port: string): CompiledSink => {
    if (RECORD_VERBS[node.type] !== undefined && port === 'store') return compileRecordOp(node);
    if (USER_VERBS[node.type] !== undefined && port === USER_VERBS[node.type].trigger) return compileUserOp(node);
    if (jsNodeKindOf(node.type) !== null && port === 'run') return compileJsRun(node);
    if (isLatchType(node.type)) return compileLatch(node, port);
    if ((plan.roleOf[node.id] === 'checkbox' || plan.roleOf[node.id] === 'input') && (CONTROL_ACTION_PORTS[plan.roleOf[node.id]] ?? []).includes(port)) {
      return compileControlAction(node, port);
    }
    if (node.type === 'NavigationShowPopup') return compileShowPopup(node);
    if (node.type === 'NavigationClosePopup') return compileClosePopup(node, port);
    if (node.type === 'RouterNavigate') {
      const target = literalParam(node, 'target');
      const url = typeof target === 'string' ? urlPathByLegacy.get(target) : undefined;
      if (url === undefined) return { defer: `navigation target ${String(target)} is not a routed page` };
      return { action: { kind: 'navigate', to: url }, consumes: [] };
    }
    if (node.type === 'Event Sender') {
      const channelName = channelNameOf(node);
      if (channelName === undefined) return { defer: 'channel name is not a literal' };
      const propagation = literalParam(node, 'propagation') ?? 'global';
      if (propagation !== 'global') {
        return { defer: `propagation "${String(propagation)}" scopes the event to the component tree` };
      }
      const ctx = newCtx();
      const payload: Array<{ key: string; expr: ValueExpr }> = [];
      const consumes: string[] = [];
      for (const key of payloadKeysOf(node)) {
        const wire = component.connections.find((c) => c.toId === node.id && c.toProperty === key);
        if (!wire) continue; // an unwired payload key sends undefined — omitted (C3)
        const expr = resolveExpr(nodeById.get(wire.fromId), wire.fromProperty, ctx);
        if (expr === null) return { defer: ctx.defer ?? `payload "${key}" has no statically known source` };
        if (isBooleanExpr(expr)) {
          return { defer: `payload "${key}" is fed a logic truth value — only truthiness sinks take one in this slice` };
        }
        payload.push({ key, expr });
        consumes.push(wire.key);
      }
      return {
        action: { kind: 'emit', channelName, payload },
        consumes: [...consumes, ...ctx.consumes],
        collapses: ctx.logicNodeIds,
        subscribes: ctx.subscriberIds
      };
    }
    if (node.type === GLOBAL_STORE_SET) {
      const store = storePlanOf(node);
      if (store === undefined) return { defer: 'store name is not a literal' };
      if (store.deferred !== undefined) return { defer: store.deferred };
      if (literalParam(node, 'merge') === true || wiredPorts.has(`${node.id}:merge`)) {
        return { defer: 'merge writes shallow-merge objects — not translated in this slice' };
      }
      if (literalParam(node, 'transaction') === true || wiredPorts.has(`${node.id}:transaction`)) {
        return { defer: 'batched writes are not translated in this slice' };
      }
      const key = literalParam(node, 'key');
      if (typeof key !== 'string' || key === '' || wiredPorts.has(`${node.id}:key`)) {
        return { defer: 'key is not a literal' };
      }
      const keyType = store.keys.find((k) => k.key === key)?.tsType ?? 'unknown';
      if (keyType === 'number' || keyType === 'boolean') {
        return { defer: `key "${key}" is ${keyType}-typed by the initial state; only string writes translate in this slice` };
      }
      const wire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'value');
      if (!wire) return { defer: 'nothing is wired into value' };
      const ctx = newCtx();
      const expr = resolveExpr(nodeById.get(wire.fromId), wire.fromProperty, ctx);
      if (expr === null) return { defer: ctx.defer ?? 'the value wire has no statically known source' };
      if (isBooleanExpr(expr)) {
        return { defer: 'the value wire carries a logic truth value — only truthiness sinks take one in this slice' };
      }
      return {
        action: { kind: 'globalstore-set', storeName: store.name, key, expr },
        consumes: [wire.key, ...ctx.consumes],
        collapses: ctx.logicNodeIds,
        subscribes: ctx.subscriberIds
      };
    }
    if (node.type === 'NewModel') {
      const result = chainByNewModel.get(node.id);
      if (result === undefined) return { defer: 'the created object is never inserted into a translated array' };
      if ('defer' in result) return { defer: result.defer };
      const chain = result.chain;
      const ctx = newCtx();
      const entries: Array<{ key: string; expr: ValueExpr }> = [];
      for (const property of chain.properties) {
        if (property.wire) {
          const expr = resolveExpr(nodeById.get(property.wire.fromId), property.wire.fromProperty, ctx);
          if (expr === null) return { defer: ctx.defer ?? `property "${property.key}" has no statically known source` };
          if (isBooleanExpr(expr)) {
            return { defer: `property "${property.key}" is fed a logic truth value — only truthiness sinks take one in this slice` };
          }
          entries.push({ key: property.key, expr });
        } else if (property.literal !== undefined) {
          entries.push({ key: property.key, expr: { kind: 'literal', value: property.literal } });
        }
      }
      return {
        action: { kind: 'collection-add', collectionName: chain.collectionName, entries },
        consumes: [...chain.consumes, ...ctx.consumes],
        collapses: [chain.insertId, ...ctx.logicNodeIds],
        subscribes: ctx.subscriberIds
      };
    }
    if (node.type === 'CollectionClear') return compileCollectionClear(node);
    if (node.type === 'Condition') return compileCondition(node);
    // Set Variable
    const variableName = variableNameOf(node);
    if (variableName === undefined) return { defer: 'variable name is not a literal' };
    const setWith = literalParam(node, 'setWith');
    if (setWith !== undefined && setWith !== 'string') {
      return { defer: `setWith "${String(setWith)}" conversion is not translated in step 5` };
    }
    const wire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'value');
    if (!wire) return { defer: 'nothing is wired into value' };
    const ctx = newCtx();
    const expr = resolveExpr(nodeById.get(wire.fromId), wire.fromProperty, ctx);
    if (expr === null) return { defer: ctx.defer ?? 'the value wire has no statically known source' };
    if (isBooleanExpr(expr)) {
      return { defer: 'the value wire carries a logic truth value — only truthiness sinks take one in this slice' };
    }
    return {
      action: { kind: 'store-set', variableName, expr },
      consumes: [wire.key, ...ctx.consumes],
      collapses: ctx.logicNodeIds,
      subscribes: ctx.subscriberIds
    };
  };

  /**
   * A Condition in a handler chain (LOGIC-TARGET §3): `trigger → eval`, arms into action
   * sinks. Translates only when the author unticked Run On Value Change — Evaluate is additive
   * (NDA-017), so a ticked box means the branch also fires on every change of the condition
   * input, behaviour a handler cannot carry.
   */
  const compileCondition = (node: NodeIR): CompiledSink => {
    if (literalParam(node, 'runOnChange-condition') !== false) {
      // Ticked: the node also re-tests on every arrival, which a handler cannot carry. §10's
      // effect takes it instead — but only when `Evaluate` is unwired, because a ticked node
      // with `Evaluate` wired does *both* and neither shape alone is faithful.
      return {
        defer: wiredPorts.has(`${node.id}:eval`)
          ? 'Condition re-tests on every change of its input *and* on Evaluate (Run On Value Change is ticked) — the two fire independently, which neither a handler nor an effect reproduces alone'
          : 'Condition re-tests on every change of its input (Run On Value Change is ticked) — only an Evaluate-only condition translates in this slice'
      };
    }
    return compileConditionBranch(node);
  };

  /**
   * Everything a Condition compiles to once its Run On Value Change gate has been settled: the
   * condition expression and the two arms. Shared by the Evaluate-only sink (§3) and the
   * reactive effect (LOGIC-TARGET §10) — they differ in *what fires the branch*, never in what it does.
   */
  const compileConditionBranch = (node: NodeIR): CompiledSink => {
    const stray = component.connections.find(
      (c) => c.fromId === node.id && c.fromProperty !== 'ontrue' && c.fromProperty !== 'onfalse'
    );
    if (stray) return { defer: `its ${stray.fromProperty} output drives logic this slice does not translate` };

    const ctx = newCtx();
    let cond: ValueExpr;
    const condWire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'condition');
    if (condWire) {
      const resolved = resolveExpr(nodeById.get(condWire.fromId), condWire.fromProperty, ctx);
      if (resolved === null) return { defer: ctx.defer ?? 'the condition wire has no statically known source' };
      cond = resolved;
      ctx.consumes.push(condWire.key);
    } else {
      const literal = literalParam(node, 'condition');
      if (literal === undefined) return { defer: 'nothing statically known feeds condition' };
      cond = { kind: 'literal', value: literal };
    }

    const consumes: string[] = [...ctx.consumes];
    const collapses: string[] = [...ctx.logicNodeIds];
    const subscribes: string[] = [...ctx.subscriberIds];
    const arm = (port: 'ontrue' | 'onfalse'): HandlerAction[] | { defer: string } => {
      const actions: HandlerAction[] = [];
      for (const wire of component.connections.filter((c) => c.fromId === node.id && c.fromProperty === port)) {
        const target = nodeById.get(wire.toId);
        // A Component Outputs port is a translatable arm target: the arm fires the callback.
        // The outputs node keeps its own disposition (the post-pass) — it never collapses here.
        if (target?.type === 'Component Outputs') {
          const prop = outputPropByPort.get(wire.toProperty);
          if (prop === undefined) {
            return {
              defer: valueOutputPorts.has(wire.toProperty)
                ? `its ${port} arm fires value output "${wire.toProperty}" — a lifted value takes a continuous feed, not a pulse`
                : `its ${port} wire drives no translatable action`
            };
          }
          actions.push({ kind: 'output-signal', prop });
          consumes.push(wire.key);
          continue;
        }
        if (!target || !isTriggerWire(target.type, wire.toProperty)) {
          return { defer: `its ${port} wire drives no translatable action` };
        }
        if (target.type === 'Condition') {
          return { defer: `its ${port} arm drives another Condition — nesting is not translated in this slice` };
        }
        const compiled = compiledOf(target, wire.toProperty);
        if ('defer' in compiled) return { defer: compiled.defer };
        actions.push(compiled.action);
        consumes.push(wire.key, ...compiled.consumes);
        collapses.push(target.id, ...(compiled.collapses ?? []));
        subscribes.push(...(compiled.subscribes ?? []));
      }
      return actions;
    };
    const whenTrue = arm('ontrue');
    if ('defer' in whenTrue) return whenTrue;
    const whenFalse = arm('onfalse');
    if ('defer' in whenFalse) return whenFalse;
    if (whenTrue.length === 0 && whenFalse.length === 0) {
      return { defer: 'neither branch drives a translatable action' };
    }
    return { action: { kind: 'branch', cond, whenTrue, whenFalse }, consumes, collapses, subscribes };
  };

  /** Keyed `${nodeId}:${port}` — the popup nodes compile per trigger port (`closeAction-*`). */
  const compiledSinks = new Map<string, CompiledSink>();
  /**
   * Why a reactive Condition (LOGIC-TARGET §10) did not become an effect, by node id. The Condition sweep
   * prefers this over the `:eval` sink's reason: for a ticked node that sink only ever says
   * "the box is ticked", which is the gate the effect pass has already passed.
   */
  const reactiveConditionDefers = new Map<string, string>();
  const compiling = new Set<string>();
  const compiledOf = (node: NodeIR, port: string): CompiledSink => {
    const key = `${node.id}:${port}`;
    const cached = compiledSinks.get(key);
    if (cached !== undefined) return cached;
    // A chain that re-enters itself (done-chains or arms wired in a loop) defers rather than
    // recursing forever; the outer call records the reason.
    if (compiling.has(key)) return { defer: 'its trigger chain is cyclic' };
    compiling.add(key);
    const result = compileSink(node, port);
    compiling.delete(key);
    compiledSinks.set(key, result);
    return result;
  };

  type ExprContext = { kind: 'dom'; nodeId: string } | { kind: 'receiver'; receiverId: string } | { kind: 'render' };

  const exprValidIn = (expr: ValueExpr, context: ExprContext, invokedScope?: ReadonlySet<string>): boolean => {
    switch (expr.kind) {
      case 'prop':
      case 'store-get':
      case 'store-key-get':
      case 'literal':
      case 'undefined':
      case 'state-get':
      case 'session-get':
        return true;
      case 'format':
        return expr.parts.every((p) => typeof p === 'string' || exprValidIn(p, context, invokedScope));
      case 'logical':
        return expr.operands.every((o) => exprValidIn(o, context, invokedScope));
      case 'not':
      case 'truthy':
        return exprValidIn(expr.operand, context, invokedScope);
      // A named array reads in every context — the `useCollection` local in render, `.peek()`
      // in a handler — so, like a store read, it constrains nothing. The transforms are valid
      // wherever their source is.
      case 'collection-get':
        return true;
      case 'list-map':
      case 'list-filter':
        return exprValidIn(expr.source, context, invokedScope);
      case 'input-text':
        return context.kind === 'dom' && context.nodeId === expr.inputId;
      case 'control-event':
        return context.kind === 'dom' && context.nodeId === expr.controlId;
      case 'payload':
        return context.kind === 'receiver' && context.receiverId === expr.receiverId;
      // A reactive node's output reads anywhere its args do (render local / inline snapshot
      // call — pure, so recomputation is unobservable). An invoked node's output reads only
      // inside its own Run chain — unless the run materialized its record as state (§4f),
      // through which render reads the last run's value exactly as the runtime getter does.
      case 'jsfun-out': {
        const def = plan.jsFunctions[expr.nodeId];
        if (def === undefined) return false;
        if (expr.viaState !== undefined) return true;
        if (def.mode === 'invoked' && !(invokedScope?.has(expr.nodeId) ?? false)) return false;
        return def.inputs.every((i) => i.expr === undefined || exprValidIn(i.expr, context, invokedScope));
      }
    }
  };

  /** Action-tree validity, carrying the set of invoked JS nodes in scope (their Run chains). */
  const actionsValidIn = (actions: HandlerAction[], context: ExprContext, invokedScope: ReadonlySet<string> = new Set()): boolean =>
    actions.every((action) => {
      switch (action.kind) {
        case 'emit':
          return action.payload.every((p) => exprValidIn(p.expr, context, invokedScope));
        case 'collection-add':
          return action.entries.every((e) => exprValidIn(e.expr, context, invokedScope));
        case 'collection-clear':
          return (
            actionsValidIn(action.then, context, invokedScope) &&
            actionsValidIn(action.unchangedThen, context, invokedScope)
          );
        case 'store-set':
        case 'globalstore-set':
          return exprValidIn(action.expr, context, invokedScope);
        case 'state-set':
          return action.expr === undefined || exprValidIn(action.expr, context, invokedScope);
        case 'branch':
          return (
            exprValidIn(action.cond, context, invokedScope) &&
            actionsValidIn(action.whenTrue, context, invokedScope) &&
            actionsValidIn(action.whenFalse, context, invokedScope)
          );
        case 'popup-show':
        case 'popup-close':
          return actionsValidIn(action.then, context, invokedScope);
        case 'api-call':
          return (
            action.args.every((arg) =>
              arg.kind === 'expr'
                ? exprValidIn(arg.expr, context, invokedScope)
                : arg.props.every((p) => exprValidIn(p.expr, context, invokedScope))
            ) && actionsValidIn(action.then, context, invokedScope)
          );
        case 'jsfun-run': {
          const def = plan.jsFunctions[action.nodeId];
          if (def === undefined) return false;
          const inner = new Set(invokedScope);
          inner.add(action.nodeId);
          return (
            def.inputs.every((i) => i.expr === undefined || exprValidIn(i.expr, context, inner)) &&
            actionsValidIn(action.then, context, inner)
          );
        }
        case 'navigate':
        case 'output-signal':
          return true;
      }
    });

  const receiverEligible = (node: NodeIR): { channelName: string } | { defer: string } => {
    const channelName = channelNameOf(node);
    if (channelName === undefined) return { defer: 'channel name is not a literal' };
    const enabledWired = component.connections.some((c) => c.toId === node.id && c.toProperty === 'enabled');
    if (literalParam(node, 'enabled') !== undefined || enabledWired) {
      return { defer: 'an authored enabled input gates this receiver' };
    }
    return { channelName };
  };

  // A component instance's signal outputs, from the *target* component's declarations —
  // parse cannot resolve a source port kind across components (instance-output wires all
  // parse as 'value'), so analysis consults the interface directly (COMPONENT-OUTPUTS §5).
  const instanceOutputPropCache = new Map<string, Map<string, string>>();
  const instanceSignalOutputs = (node: NodeIR): Map<string, string> => {
    let cached = instanceOutputPropCache.get(node.type);
    if (cached === undefined) {
      const target = ir.components.find((c) => `/${c.path}` === node.type);
      cached = new Map(target ? componentOutputInterface(target).props.map((p) => [p.port, p.prop]) : []);
      instanceOutputPropCache.set(node.type, cached);
    }
    return cached;
  };

  /**
   * A custom node's signal outputs, from its kit definition (EXP-010).
   *
   * The same blindness `instanceSignalOutputs` exists for, from a different direction: parse
   * resolves a source port's kind from the node's own `dynamicports` or the catalog, and a kit
   * node has neither — so every wire out of one parses as `'value'` and a `Money Pill`'s
   * `dropped` would compile as a value read of a port that never has a value.
   */
  const customSignalOutputs = (node: NodeIR): Set<string> => {
    const def = kits.get(node.type)?.def;
    if (!def) return new Set();
    return new Set(def.outputs.filter((o) => o.kind === 'signal').map((o) => o.name));
  };

  /**
   * A Component Outputs node as an action sink with dynamic trigger ports (§4): a declared
   * signal port compiles to the prop call; a value port, a failed prop, or a For Each relay
   * fails the node; a port nothing declares drops alone — the runtime's own `hasOutput`
   * guard drops that write too, so silence there is the faithful translation.
   */
  const outputSinkOf = (port: string, fromNode: NodeIR | undefined): CompiledSink | { drop: string } => {
    const prop = outputPropByPort.get(port);
    if (prop !== undefined) {
      if (fromNode?.type === 'For Each') {
        return {
          defer: `a repeater relays its rows' outputs into "${port}" — which row fired is not statically expressible in this slice`
        };
      }
      return { action: { kind: 'output-signal', prop }, consumes: [] };
    }
    if (valueOutputPorts.has(port)) {
      return { defer: `output "${port}" is a value output that did not lift — its name or feed failed (the component's notes say why)` };
    }
    const failedReason = failedOutputPorts.get(port);
    if (failedReason !== undefined) return { defer: failedReason };
    return { drop: `no Component Outputs declaration names port "${port}" — the runtime's hasOutput guard drops the write too` };
  };

  // ---- the controlled-state slice: execution (CONTROLLED-STATE-TARGET §4) -----------------

  const boundSubscribers = new Set<string>();
  /**
   * Wires the state passes consumed whose sinks stay ordinary rendered nodes — the CO/JS
   * verdict sweeps read this to see the read landed (their `collapsed`-sink test cannot).
   */
  const stateLandedKeys = new Set<string>();
  /** Why each control minted state — the statically-undefined feed demotes a wire-only mint. */
  const controlMintReasons = new Map<string, { stateWired: boolean; actionWired: boolean; outputRead: boolean }>();

  // Minting (§4c): a control earns local state when its state input is wired (the sync-effect
  // shape), when its value output is read outside its own onChange (a render sink or a lifted
  // mirror), or when a state-writing action (check/uncheck/clear) targets it. An unwired
  // control nobody reads keeps today's uncontrolled translation — no state row is minted for
  // a control nobody feeds.
  for (const node of component.nodes) {
    if (!rendered.has(node.id)) continue;
    const spec = controlSpecOf(node.id);
    if (spec === undefined) continue;
    const role = plan.roleOf[node.id] as RenderRole;
    const unticked = spec.coerce === 'textinput' && literalParam(node, 'runOnChange-startValue') === false;
    const stateWired = wiredPorts.has(`${node.id}:${spec.statePort}`) && !unticked;
    const actionWired = (CONTROL_ACTION_PORTS[role] ?? []).some((port) => wiredPorts.has(`${node.id}:${port}`));
    const outputRead = component.connections.some((c) => {
      if (c.fromId !== node.id || c.fromProperty !== spec.output) return false;
      const sink = nodeById.get(c.toId);
      if (!sink) return false;
      if (sink.type === 'Component Outputs') return valueOutputPorts.has(c.toProperty);
      // RECORD-VERBS-TARGET §3 — the third reader class, and the whole of why the form idiom
      // was blocked. `onTextChanged` resolves to `input-text`, which is legal only inside that
      // input's own DOM handler; a submit chain reads five fields from the *button's* handler.
      // §4c already says a control's value output "anywhere in the component" reads its local
      // state — a handler action's argument is anywhere.
      if (RECORD_VERBS[sink.type] !== undefined) {
        return c.toProperty.startsWith('prop-') || c.toProperty === 'modelId';
      }
      // USER-FAMILY-TARGET §3 — the first test of §3's claim that "every later handler-argument
      // reader (the User nodes' credentials, HTTP's body) earns control state by the same
      // clause". The credentials are read from the *button's* handler, exactly as the five form
      // fields were, so the clause holds unchanged.
      if (USER_VERBS[sink.type] !== undefined) return USER_VERBS[sink.type].inputs.includes(c.toProperty);
      return rendered.has(sink.id) && !isTriggerWire(sink.type, c.toProperty);
    });
    if (!stateWired && !actionWired && !outputRead) continue;
    controlMintReasons.set(node.id, { stateWired, actionWired, outputRead });
    const authored = literalParam(node, spec.statePort);
    const catalogDefault = node.catalogRef ? catalog.inputDefault(node.catalogRef, spec.statePort) : undefined;
    const raw =
      authored !== undefined
        ? authored
        : typeof catalogDefault === 'string' || typeof catalogDefault === 'number' || typeof catalogDefault === 'boolean'
          ? catalogDefault
          : undefined;
    const boot =
      spec.tsType === 'boolean'
        ? raw === true
        : spec.tsType === 'number'
          ? typeof raw === 'number'
            ? raw
            : Number(raw ?? 0) || 0
          : raw === undefined
            ? ''
            : String(raw);
    controlStateVars.set(
      node.id,
      allocStateVar(
        node.authoredLabel,
        spec.fallbackName,
        spec.tsType,
        boot,
        node.id,
        'control',
        `The ${role}'s local state (§4c) — the graph path syncs it without firing Changed; the user path writes it and runs the Changed chain.`
      )
    );
  }

  // Sync effects (§3.4): the wired control-state input's graph path — the input setter's own
  // coercion and abstain guards per §1's table, and never the Changed chain.
  for (const node of component.nodes) {
    if (!rendered.has(node.id)) continue;
    const spec = controlSpecOf(node.id);
    if (spec === undefined) continue;
    const wires = component.connections.filter((c) => c.toId === node.id && c.toProperty === spec.statePort);
    if (wires.length === 0) continue;
    if (spec.coerce === 'textinput' && literalParam(node, 'runOnChange-startValue') === false) {
      for (const w of wires) {
        consumed.add(w.key);
        notes.push(
          `wire ${w.key} dropped: Value is unticked under Run On Value Change — arrivals wait for a Set pulse, which is not translated in this slice`
        );
      }
      continue;
    }
    const stateVar = controlStateVars.get(node.id);
    if (stateVar === undefined) continue;
    if (wires.length > 1) {
      for (const w of wires) consumed.add(w.key);
      notes.push(
        `wires into ${node.id}.${spec.statePort} dropped: two wires feed the control's state — last-writer-wins is not statically ordered`
      );
      continue;
    }
    const wire = wires[0];
    consumed.add(wire.key);
    const from = nodeById.get(wire.fromId);
    const ctx = newCtx();
    const expr = from === undefined ? null : resolveExpr(from, wire.fromProperty, ctx);
    if (expr === null) {
      notes.push(
        `wire ${wire.key} dropped: ${
          ctx.defer ?? `fed by ${from?.type ?? 'a missing node'} with no statically known source in the emit vocabulary`
        } — the control keeps local state without the graph feed`
      );
      continue;
    }
    if (isBooleanExpr(expr) && spec.coerce !== 'checkbox') {
      notes.push(
        `wire ${wire.key} dropped: a logic truth value lands only in a truthiness sink — a ${plan.roleOf[node.id]} state input is value-shaped`
      );
      continue;
    }
    if (!exprValidIn(expr, { kind: 'render' })) {
      notes.push(`wire ${wire.key} dropped: the expression reads values that only exist inside a handler`);
      continue;
    }
    // A statically-undefined feed (a boot-value read) never applies — the input abstains or
    // keeps its boot state (§1) — so no sync effect prints, and a control whose only state
    // demand was this wire keeps today's uncontrolled shape.
    if (expr.kind === 'undefined') {
      if (from?.type === COMPONENT_OBJECT) {
        notes.push(
          `wire ${wire.key}: property "${wire.fromProperty.slice('value-'.length)}" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form`
        );
      } else {
        notes.push(`wire ${wire.key}: the arrival is statically undefined — the control keeps its boot state, no sync effect`);
      }
      stateLandedKeys.add(wire.key);
      for (const k of ctx.consumes) consumed.add(k);
      const reasons = controlMintReasons.get(node.id);
      if (reasons !== undefined && !reasons.actionWired && !reasons.outputRead) {
        const index = plan.stateVars.indexOf(stateVar);
        if (index >= 0) plan.stateVars.splice(index, 1);
        controlStateVars.delete(node.id);
      }
      continue;
    }
    const sync: SyncEffectPlan = { stateName: stateVar.name, source: expr, coerce: spec.coerce };
    if (spec.coerce === 'slider') {
      const minRaw = literalParam(node, 'min') ?? (node.catalogRef ? catalog.inputDefault(node.catalogRef, 'min') : undefined);
      const maxRaw = literalParam(node, 'max') ?? (node.catalogRef ? catalog.inputDefault(node.catalogRef, 'max') : undefined);
      sync.min = typeof minRaw === 'number' ? minRaw : Number(minRaw ?? 0) || 0;
      sync.max = typeof maxRaw === 'number' ? maxRaw : Number(maxRaw ?? 100) || 100;
    }
    plan.syncEffects.push(sync);
    stateLandedKeys.add(wire.key);
    for (const k of ctx.consumes) consumed.add(k);
    for (const s of ctx.subscriberIds) boundSubscribers.add(s);
    if (plan.file) {
      for (const l of ctx.logicNodeIds) {
        dispositions[l] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
      }
    }
  }

  // §4d child side: a Component Outputs value port fed by the vocabulary lifts — an optional
  // callback prop plus a push effect. A port whose feed does not resolve fails alone (the
  // mixed-outputs rule); the node's verdict names the first failure while good ports keep
  // firing.
  {
    const valuePropByPort = new Map(outputInterface.valueProps.map((v) => [v.port, v]));
    const wiresByPort = new Map<string, typeof component.connections>();
    for (const c of component.connections) {
      const toNode = nodeById.get(c.toId);
      if (toNode?.type !== 'Component Outputs' || !valueOutputPorts.has(c.toProperty)) continue;
      wiresByPort.set(c.toProperty, [...(wiresByPort.get(c.toProperty) ?? []), c]);
    }
    for (const [port, wires] of wiresByPort) {
      const vp = valuePropByPort.get(port);
      if (vp === undefined) continue; // naming failed — outputInterface.failed reports it; pass 2 rules the node
      const fail = (key: string | null, reason: string) => {
        for (const w of wires) {
          consumed.add(w.key);
          if (!failedOutputsNodes.has(w.toId)) failedOutputsNodes.set(w.toId, reason);
        }
        notes.push(key !== null ? `wire ${key} dropped: ${reason}` : reason);
      };
      if (wires.length > 1) {
        fail(null, `two wires feed value output "${port}" — last-writer-wins is not statically ordered`);
        continue;
      }
      const wire = wires[0];
      const from = nodeById.get(wire.fromId);
      if (from?.type === 'For Each') {
        fail(
          wire.key,
          `a repeater relays its rows' outputs into "${port}" — which row fired is not statically expressible in this slice`
        );
        continue;
      }
      const ctx = newCtx();
      const expr = from === undefined ? null : resolveExpr(from, wire.fromProperty, ctx);
      if (expr === null) {
        fail(
          wire.key,
          `value output "${port}" is fed by ${from?.type ?? 'a missing node'} — ${
            ctx.defer ?? 'no statically known source in the emit vocabulary'
          }`
        );
        continue;
      }
      if (isBooleanExpr(expr)) {
        fail(wire.key, `value output "${port}" is fed a logic truth value — only truthiness sinks take one in this slice`);
        continue;
      }
      if (!exprValidIn(expr, { kind: 'render' })) {
        fail(wire.key, `value output "${port}" reads values that only exist inside a handler`);
        continue;
      }
      consumed.add(wire.key);
      stateLandedKeys.add(wire.key);
      plan.pushEffects.push({ prop: vp.prop, expr });
      plan.liftedOutputProps.push({ port, prop: vp.prop, tsType: vp.tsType });
      for (const k of ctx.consumes) consumed.add(k);
      for (const s of ctx.subscriberIds) boundSubscribers.add(s);
      if (plan.file) {
        for (const l of ctx.logicNodeIds) {
          dispositions[l] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
        }
      }
    }
    // Declared value ports that did not lift keep a named note (the s10 report, updated).
    for (const port of outputInterface.valuePorts) {
      if (!plan.liftedOutputProps.some((l) => l.port === port)) {
        notes.push(`output "${port}" is a value output with no statically-translatable feed — not lifted in this slice`);
      }
    }
  }

  // §4d parent side: consumed instance value outputs are recorded pending and resolved after
  // every plan exists (planProject's second phase) — binding requires the child to have
  // actually lifted the port, or the parent would pass a prop the child does not declare.
  for (const c of component.connections) {
    if (consumed.has(c.key)) continue;
    const fromNode = nodeById.get(c.fromId);
    if (!fromNode || plan.roleOf[fromNode.id] !== 'instance' || !rendered.has(fromNode.id)) continue;
    const targetIR = ir.components.find((tc) => `/${tc.path}` === fromNode.type);
    if (!targetIR) continue;
    const vp = componentOutputInterface(targetIR).valueProps.find((v) => v.port === c.fromProperty);
    if (vp === undefined) continue;
    const toNode = nodeById.get(c.toId);
    if (!toNode || !rendered.has(toNode.id)) {
      consumed.add(c.key);
      notes.push(
        `wire ${c.key} dropped: instance output "${c.fromProperty}" feeds an unrendered sink — lifted values land only in rendered sinks in this slice`
      );
      continue;
    }
    const contentRole = (CONTENT_PARAMS[toNode.type] ?? {})[c.toProperty];
    const truthinessSink = c.toProperty === 'visible' || c.toProperty === 'mounted';
    const bindable =
      truthinessSink ||
      contentRole === 'children' ||
      contentRole === 'attr-not:disabled' ||
      (contentRole !== undefined && contentRole.startsWith('attr:'));
    if (!bindable) {
      consumed.add(c.key);
      notes.push(
        `wire ${c.key} dropped: instance output "${c.fromProperty}" feeds ${toNode.type}.${c.toProperty}, which has no static binding in this slice`
      );
      continue;
    }
    if (c.toProperty === 'mounted' && toNode.id === plan.rootId) {
      consumed.add(c.key);
      notes.push(`wire ${c.key} dropped: a mounted wire into the component root is a router concern — not translated in this slice`);
      continue;
    }
    consumed.add(c.key);
    plan.pendingLifted.push({
      connectionKey: c.key,
      instanceId: fromNode.id,
      targetLegacy: fromNode.type,
      port: c.fromProperty,
      toNodeId: toNode.id,
      toProperty: c.toProperty
    });
  }

  // EXP-010 AC2, the value half: a custom node's value output feeding a rendered sink becomes a
  // local `useState` row, written by the wrapper's `onXChanged` callback and read by the sink.
  //
  // ⚠️ **Local, and settled here rather than in `planProject`'s second phase.** The instance pass
  // above has to wait because whether the child lifted the port is a fact about *another plan*. A
  // kit node's outputs are in its own definition, which this component already holds — deferring
  // would buy nothing and would make the two passes look like they share a constraint they do not.
  const customLiftedVarByKey = new Map<string, string>();
  for (const c of component.connections) {
    if (consumed.has(c.key)) continue;
    const fromNode = nodeById.get(c.fromId);
    if (!fromNode || plan.roleOf[fromNode.id] !== 'custom' || !rendered.has(fromNode.id)) continue;
    const def = kits.get(fromNode.type)?.def;
    if (!def) continue;
    const output = def.outputs.find((o) => o.name === c.fromProperty);
    // 🔴 An output the kit does not declare is named, never skipped past. This is the `rename-kit`
    // case on the output side: a port removed from the definition while a wire still used it. The
    // running app drops that wire too — the difference is that here it is said out loud.
    if (output === undefined) {
      consumed.add(c.key);
      notes.push(
        `wire ${c.key} dropped: ${fromNode.type} declares no output "${c.fromProperty}" — the kit's definition has no such port, so the running app delivers nothing either`
      );
      continue;
    }
    if (output.kind === 'signal') continue; // handled by the handler pass above
    const toNode = nodeById.get(c.toId);
    if (!toNode || !rendered.has(toNode.id)) {
      consumed.add(c.key);
      notes.push(
        `wire ${c.key} dropped: custom node output "${c.fromProperty}" feeds an unrendered sink — lifted values land only in rendered sinks in this slice`
      );
      continue;
    }
    const bindable = customSinkIsBindable(toNode, c.toProperty, plan.roleOf[toNode.id], kits);
    if (bindable !== true) {
      consumed.add(c.key);
      notes.push(`wire ${c.key} dropped: custom node output "${c.fromProperty}" ${bindable}`);
      continue;
    }
    if (c.toProperty === 'mounted' && toNode.id === plan.rootId) {
      consumed.add(c.key);
      notes.push(`wire ${c.key} dropped: a mounted wire into the component root is a router concern — not translated in this slice`);
      continue;
    }

    const varKey = `${fromNode.id}:${c.fromProperty}`;
    let name = customLiftedVarByKey.get(varKey);
    if (name === undefined) {
      const taken = takenNamesOf(plan);
      const cleaned = c.fromProperty.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^_+|_+$/g, '');
      const base = cleaned.length > 0 && !/^[0-9]/.test(cleaned) ? cleaned : `_${cleaned || 'lifted'}`;
      name = base;
      let counter = 2;
      while (taken.has(name) || taken.has(setterNameOf(name))) name = `${base}${counter++}`;
      customLiftedVarByKey.set(varKey, name);
      plan.stateVars.push({
        name,
        setterName: setterNameOf(name),
        tsType: `${valueTsTypeOf(output.type)} | undefined`,
        boot: null,
        originNodeId: fromNode.id,
        origin: 'lifted',
        comment: `Lifted from ${fromNode.type}'s value output "${c.fromProperty}" — undefined until the kit node first publishes it.`
      });
      const list = (plan.customLifted[fromNode.id] = plan.customLifted[fromNode.id] ?? []);
      list.push({ port: c.fromProperty, setterName: setterNameOf(name) });
    }
    consumed.add(c.key);
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][c.toProperty] = {
      kind: 'computed',
      expr: { kind: 'state-get', name, maybeUndefined: true }
    };
  }

  // ---- the chain-local snapshot rule (§3) -------------------------------------------------
  // The runtime writes state synchronously mid-chain; React's setter does not update the
  // closure. Inside one compiled handler chain, a read after a `state-set { expr }` resolves
  // to the written expression; a read after an `op` write defers the reading node — the
  // compiler never silently emits the stale read.
  type ChainSnapshot = Map<string, ValueExpr | 'op'>;
  const exprTouchesSnap = (e: ValueExpr, snap: ChainSnapshot): boolean => {
    switch (e.kind) {
      case 'state-get':
        return snap.has(e.name);
      case 'format':
        return e.parts.some((p) => typeof p !== 'string' && exprTouchesSnap(p, snap));
      case 'logical':
        return e.operands.some((o) => exprTouchesSnap(o, snap));
      case 'not':
      case 'truthy':
        return exprTouchesSnap(e.operand, snap);
      case 'jsfun-out':
        return (plan.jsFunctions[e.nodeId]?.inputs ?? []).some((i) => i.expr !== undefined && exprTouchesSnap(i.expr, snap));
      default:
        return false;
    }
  };
  const snapExpr = (expr: ValueExpr, snap: ChainSnapshot): ValueExpr | { defer: string } => {
    switch (expr.kind) {
      case 'state-get': {
        const written = snap.get(expr.name);
        if (written === undefined) return expr;
        if (written === 'op') {
          return {
            defer: `it reads state "${expr.name}" after a functional update earlier in the chain — the value is not statically expressible mid-chain`
          };
        }
        return written;
      }
      case 'format': {
        const parts: Array<string | ValueExpr> = [];
        for (const part of expr.parts) {
          if (typeof part === 'string') {
            parts.push(part);
            continue;
          }
          const r = snapExpr(part, snap);
          if ('defer' in r) return r;
          parts.push(r);
        }
        return { ...expr, parts };
      }
      case 'logical': {
        const operands: ValueExpr[] = [];
        for (const o of expr.operands) {
          const r = snapExpr(o, snap);
          if ('defer' in r) return r;
          operands.push(r);
        }
        return { ...expr, operands };
      }
      case 'not':
      case 'truthy': {
        const r = snapExpr(expr.operand, snap);
        if ('defer' in r) return r;
        return { ...expr, operand: r };
      }
      case 'jsfun-out': {
        // Wrapper argument records are shared across call sites — a per-site rewrite cannot
        // land, so a chain-written argument gates instead (zero corpus demand).
        if (exprTouchesSnap(expr, snap)) {
          return { defer: 'a Function argument reads state written earlier in this chain — not translated in this slice' };
        }
        return expr;
      }
      default:
        return expr;
    }
  };
  const snapActionList = (actions: HandlerAction[], snap: ChainSnapshot): HandlerAction[] | { defer: string } => {
    const out: HandlerAction[] = [];
    for (const a of actions) {
      const r = snapAction(a, snap);
      if ('defer' in r) return r;
      out.push(r);
    }
    return out;
  };
  const snapAction = (action: HandlerAction, snap: ChainSnapshot): HandlerAction | { defer: string } => {
    switch (action.kind) {
      case 'state-set': {
        if (action.expr !== undefined) {
          const e = snapExpr(action.expr, snap);
          if ('defer' in e) return e;
          snap.set(action.name, e);
          return { ...action, expr: e };
        }
        snap.set(action.name, 'op');
        return action;
      }
      case 'store-set':
      case 'globalstore-set': {
        const e = snapExpr(action.expr, snap);
        if ('defer' in e) return e;
        return { ...action, expr: e };
      }
      case 'emit': {
        const payload: Array<{ key: string; expr: ValueExpr }> = [];
        for (const p of action.payload) {
          const e = snapExpr(p.expr, snap);
          if ('defer' in e) return e;
          payload.push({ key: p.key, expr: e });
        }
        return { ...action, payload };
      }
      case 'collection-add': {
        const entries: Array<{ key: string; expr: ValueExpr }> = [];
        for (const entry of action.entries) {
          const e = snapExpr(entry.expr, snap);
          if ('defer' in e) return e;
          entries.push({ key: entry.key, expr: e });
        }
        return { ...action, entries };
      }
      case 'branch': {
        const cond = snapExpr(action.cond, snap);
        if ('defer' in cond) return cond;
        const trueSnap = new Map(snap);
        const whenTrue = snapActionList(action.whenTrue, trueSnap);
        if (!Array.isArray(whenTrue)) return whenTrue;
        const falseSnap = new Map(snap);
        const whenFalse = snapActionList(action.whenFalse, falseSnap);
        if (!Array.isArray(whenFalse)) return whenFalse;
        // A write inside either arm is order-unknown after the branch — later reads defer.
        for (const [k, v] of trueSnap) if (snap.get(k) !== v) snap.set(k, 'op');
        for (const [k, v] of falseSnap) if (snap.get(k) !== v) snap.set(k, 'op');
        return { ...action, cond, whenTrue, whenFalse };
      }
      /**
       * Two mutually exclusive arms, so this takes `branch`'s treatment and not `popup-show`'s:
       * only one of them runs, and which one is a runtime fact, so a state write inside either
       * leaves later reads in the enclosing chain order-unknown.
       */
      case 'collection-clear': {
        const doneSnap = new Map(snap);
        const then = snapActionList(action.then, doneSnap);
        if (!Array.isArray(then)) return then;
        const unchangedSnap = new Map(snap);
        const unchangedThen = snapActionList(action.unchangedThen, unchangedSnap);
        if (!Array.isArray(unchangedThen)) return unchangedThen;
        for (const [k, v] of doneSnap) if (snap.get(k) !== v) snap.set(k, 'op');
        for (const [k, v] of unchangedSnap) if (snap.get(k) !== v) snap.set(k, 'op');
        return { ...action, then, unchangedThen };
      }
      case 'popup-show':
      case 'popup-close': {
        const then = snapActionList(action.then, snap);
        if (!Array.isArray(then)) return then;
        return { ...action, then };
      }
      // The call's arguments are read before the await, so they take the snapshot in place; the
      // done chain follows it and carries the same map onward.
      case 'api-call': {
        const args: ApiCallArg[] = [];
        for (const arg of action.args) {
          if (arg.kind === 'expr') {
            const e = snapExpr(arg.expr, snap);
            if ('defer' in e) return e;
            args.push({ kind: 'expr', expr: e });
            continue;
          }
          const props: Array<{ key: string; expr: ValueExpr }> = [];
          for (const p of arg.props) {
            const e = snapExpr(p.expr, snap);
            if ('defer' in e) return e;
            props.push({ key: p.key, expr: e });
          }
          args.push({ kind: 'data', props });
        }
        const then = snapActionList(action.then, snap);
        if (!Array.isArray(then)) return then;
        return { ...action, args, then };
      }
      case 'jsfun-run': {
        if ((plan.jsFunctions[action.nodeId]?.inputs ?? []).some((i) => i.expr !== undefined && exprTouchesSnap(i.expr, snap))) {
          return { defer: 'a Function argument reads state written earlier in this chain — not translated in this slice' };
        }
        const then = snapActionList(action.then, snap);
        if (!Array.isArray(then)) return then;
        return { ...action, then };
      }
      default:
        return action;
    }
  };
  /** One snapshot per handler owner; a stateful control's own chain seeds its user-path value. */
  const chainSnapshots = new Map<string, ChainSnapshot>();
  const chainSnapshotFor = (ownerKey: string, seedControlId?: string): ChainSnapshot => {
    let snap = chainSnapshots.get(ownerKey);
    if (snap === undefined) {
      snap = new Map();
      if (seedControlId !== undefined) {
        const stateVar = controlStateVars.get(seedControlId);
        const spec = controlSpecOf(seedControlId);
        if (stateVar !== undefined && spec !== undefined) {
          snap.set(
            stateVar.name,
            spec.coerce === 'textinput'
              ? { kind: 'input-text', inputId: seedControlId }
              : { kind: 'control-event', controlId: seedControlId, form: spec.eventForm }
          );
        }
      }
      chainSnapshots.set(ownerKey, snap);
    }
    return snap;
  };

  // Every action sink compiles before attachment — the sweeps that report unattached sinks
  // read compiledSinks for their reasons. (This loop sits below outputSinkOf because the popup
  // compilers' done-chains reach it.)
  for (const node of component.nodes) {
    if (TRIGGER_PORTS[node.type] !== undefined) compiledOf(node, TRIGGER_PORTS[node.type]);
    else if (node.type === 'NavigationShowPopup') compiledOf(node, 'show');
    else if (node.type === 'NavigationClosePopup') {
      compiledOf(node, 'close');
      for (const c of component.connections) {
        if (c.toId === node.id && c.toProperty.startsWith('closeAction-')) compiledOf(node, c.toProperty);
      }
    } else if (jsNodeKindOf(node.type) !== null && wiredPorts.has(`${node.id}:run`)) {
      compiledOf(node, 'run');
    }
  }

  // Dead wires on JS nodes, before any pass can misread them (EXP-003 §1): a Function's ports
  // register as `in-<name>`/`out-<name>` — nodescope catches the failed connect on any other
  // name and the wire never delivers. An Expression input that is not an identifier of the
  // expression delivers into scope nobody reads. Dropping each with its note is the faithful
  // translation (the runtime's own guard drops them too — the hasOutput precedent).
  /**
   * Visual Functions that never run (LOGIC-BUILDER-TARGET §3.5) — **first**, before any pass
   * can judge them.
   *
   * Two states, one faithful translation: **nothing**.
   *
   * - **No blocks.** `_compileFunction` returns null with no `compileError`, so `_executeLogic`
   *   reports `Unchanged` and returns. Six of the corpus's fourteen instances are this — a
   *   freshly dropped node.
   * - **No trigger wired.** A Visual Function never runs on its own: values arriving on inputs
   *   are stored and run nothing (`logic-builder.ts`'s setter — *"Don't auto-execute"*), so with
   *   nothing wired to `run` the program never executes and its outputs never publish.
   *
   * 🔴 Neither is a **deferral**. A deferral says "this slice could not translate it"; these say
   * "the runtime does nothing here, and neither does the emitted app". `static` is the honest
   * disposition, and the wires are consumed because they genuinely carry nothing — an input
   * wire's value is stored and never read, and an output wire is dead (the `hasOutput`
   * precedent: the runtime drops a wire from a port it never registered).
   *
   * ⚠️ **It has to run before pass 2.** Attaching a trigger wire defers its *target* node with
   * the compile's reason, so leaving this until pass 5 let "the node has no blocks to run"
   * become the node's verdict — a deferral for a node that asked nothing of the translation.
   */
  for (const node of component.nodes) {
    if (!isVisualFunction(node.type) || dispositions[node.id] !== undefined) continue;
    if (hasProgram(node) && wiredPorts.has(`${node.id}:run`)) continue;

    const why = !hasProgram(node)
      ? 'it has no blocks yet — the runtime reports Unchanged and runs nothing'
      : 'nothing is wired to its Run — a Visual Function never runs on its own, so its program never executes';
    for (const c of component.connections) {
      if (c.fromId === node.id || c.toId === node.id) consumed.add(c.key);
    }
    dispositions[node.id] = { kind: 'static' };
    notes.push(`node ${node.id} (${VISUAL_FUNCTION_LABEL}) emits nothing: ${why}`);
  }

  const jsDeadWireKeys = new Set<string>();
  for (const node of component.nodes) {
    const kind = jsNodeKindOf(node.type);
    if (kind === null) continue;
    /**
     * A Visual Function's dead wires are decided by `detectIO`, not by the Function's
     * `in-`/`out-` spelling or the Expression's identifier list — it registers author names
     * verbatim. Falling through to the Expression rule (as this loop did when `jsNodeKindOf`
     * grew a third kind) would call *every* wire on the node dead.
     */
    if (kind === 'visual') {
      const io = visualIoOf(node);
      const liveIn = new Set([...io.inputs.map((p) => p.name), ...io.signalInputs, 'run']);
      const liveOut = new Set([
        ...io.outputs.map((p) => p.name),
        ...io.signalOutputs,
        'success',
        'failure',
        'done',
        'unchanged',
        'completed',
        'error'
      ]);
      for (const c of component.connections) {
        if (consumed.has(c.key)) continue;
        const dead =
          (c.toId === node.id && !liveIn.has(c.toProperty)) || (c.fromId === node.id && !liveOut.has(c.fromProperty));
        if (!dead) continue;
        consumed.add(c.key);
        jsDeadWireKeys.add(c.key);
        const port = c.toId === node.id ? c.toProperty : c.fromProperty;
        notes.push(
          `wire ${c.key} dropped: the block program declares no port "${port}" — the runtime never delivers this connection`
        );
      }
      continue;
    }
    const body = jsBodyOf(node, kind);
    const exprPorts = kind === 'expression' && body !== undefined ? expressionIdentifiersOf(body).ports : [];
    for (const c of component.connections) {
      if (consumed.has(c.key)) continue;
      if (c.toId === node.id && c.toProperty !== 'run') {
        const dead =
          kind === 'function'
            ? !c.toProperty.startsWith('in-')
            : !exprPorts.includes(c.toProperty);
        if (dead) {
          consumed.add(c.key);
          jsDeadWireKeys.add(c.key);
          notes.push(
            kind === 'function'
              ? `wire ${c.key} dropped: a Function input registers as "in-<name>" — the runtime never delivers a connection to "${c.toProperty}"`
              : `wire ${c.key} dropped: the expression does not reference an identifier "${c.toProperty}" — the delivery is unobservable`
          );
        }
      }
      if (c.fromId === node.id) {
        const dead =
          kind === 'function'
            ? !c.fromProperty.startsWith('out-') &&
              !['run', 'success', 'failure', 'done', 'unchanged', 'completed', 'error'].includes(c.fromProperty)
            : !EXPRESSION_VALUE_OUTPUTS.has(c.fromProperty) &&
              !['isTrueEv', 'isFalseEv', 'failure', 'done', 'completed', 'error'].includes(c.fromProperty);
        if (dead) {
          consumed.add(c.key);
          jsDeadWireKeys.add(c.key);
          notes.push(
            `wire ${c.key} dropped: ${node.type} registers no output named "${c.fromProperty}" — the runtime never delivers this connection`
          );
        }
      }
    }
  }

  // Pass 2: attach compiled actions to handler owners, trigger wires in source order. A wire
  // from a Condition's arm into a trigger port is chain-internal: the branch consumes it when
  // it attaches, and the Condition sweep reports it when it does not. A popup node's `done`
  // wires are chain-internal the same way — the popup compile consumes them on attach, and the
  // popup sweep reports the node when it never attaches. A Component Outputs sink never takes
  // its disposition here — failures accumulate in failedOutputsNodes and the post-pass rules
  // once, so the outcome cannot depend on wire order.
  const receiverActions = new Map<string, HandlerAction[]>();
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode) continue;
    const outputsSink = toNode.type === 'Component Outputs';
    if (!outputsSink && !isTriggerWire(toNode.type, connection.toProperty)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (fromNode?.type === 'Condition' && (connection.fromProperty === 'ontrue' || connection.fromProperty === 'onfalse')) {
      continue;
    }
    if (
      (fromNode?.type === 'NavigationShowPopup' || fromNode?.type === 'NavigationClosePopup') &&
      connection.fromProperty === 'done'
    ) {
      continue;
    }
    // A JS node's `done` wires are its Run chain, chain-internal exactly as a popup's (the
    // compile consumes them on attach); with Run unwired, `done` never pulses — the JS sweep
    // drops the wire with that note.
    if (fromNode !== undefined && jsNodeKindOf(fromNode.type) !== null && connection.fromProperty === 'done') {
      continue;
    }
    consumed.add(connection.key);
    let compiled: CompiledSink;
    if (outputsSink) {
      const sink = outputSinkOf(connection.toProperty, fromNode);
      if ('drop' in sink) {
        notes.push(`wire ${connection.key} dropped: ${sink.drop}`);
        continue;
      }
      compiled = sink;
    } else {
      compiled = compiledOf(toNode, connection.toProperty);
    }
    if ('defer' in compiled) {
      if (outputsSink) {
        if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, compiled.defer);
      } else {
        dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: compiled.defer };
      }
      notes.push(`wire ${connection.key} dropped: ${compiled.defer}`);
      continue;
    }
    // A rendered input's `textChanged` pulse is its onChange: the action joins the same handler
    // the write-through rule uses, so `value ← onTextChanged` + `set ← textChanged` from one
    // input collapse into a single onChange attribute (NAMED-STORES-TARGET §2).
    if (
      fromNode &&
      rendered.has(fromNode.id) &&
      isTextInputType(fromNode.type) &&
      connection.fromProperty === 'textChanged'
    ) {
      if (!actionsValidIn([compiled.action], { kind: 'dom', nodeId: fromNode.id })) {
        const reason = 'the action reads values that only exist in another handler';
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, reason);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason };
        }
        notes.push(`wire ${connection.key} dropped: ${reason}`);
        continue;
      }
      const snapped = snapAction(compiled.action, chainSnapshotFor(`change:${fromNode.id}`, fromNode.id));
      if ('defer' in snapped) {
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, snapped.defer);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: snapped.defer };
        }
        notes.push(`wire ${connection.key} dropped: ${snapped.defer}`);
        continue;
      }
      const list = (plan.changeHandlers[fromNode.id] = plan.changeHandlers[fromNode.id] ?? []);
      list.push(snapped);
      if (!outputsSink) dispositions[toNode.id] = { kind: 'collapsed', into: fromNode.id };
      for (const id of compiled.collapses ?? []) dispositions[id] = { kind: 'collapsed', into: fromNode.id };
      for (const key of compiled.consumes) consumed.add(key);
      for (const id of compiled.subscribes ?? []) boundSubscribers.add(id);
      continue;
    }
    // A rendered instance's declared signal output owns handlers exactly as a DOM event does —
    // the wire's parsed kind is 'value' (cross-component blindness), so the interface decides.
    const instanceSignal =
      fromNode !== undefined &&
      plan.roleOf[fromNode.id] === 'instance' &&
      instanceSignalOutputs(fromNode).has(connection.fromProperty);
    // EXP-010, the same rule for a kit node: the wire parses as 'value' because nothing static
    // knows the port, and the definition is what decides.
    const customSignal =
      fromNode !== undefined &&
      plan.roleOf[fromNode.id] === 'custom' &&
      customSignalOutputs(fromNode).has(connection.fromProperty);
    if (fromNode && rendered.has(fromNode.id) && (connection.kind === 'signal' || instanceSignal || customSignal)) {
      if (!actionsValidIn([compiled.action], { kind: 'dom', nodeId: fromNode.id })) {
        const reason = 'the action reads values that only exist in another handler';
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, reason);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason };
        }
        notes.push(`wire ${connection.key} dropped: ${reason}`);
        continue;
      }
      // A stateful control's own Changed chain sees the user-path value the runtime wrote
      // before pulsing — the snapshot seed (§3's rule, applied to the leading set).
      const seedId = connection.fromProperty === 'onChange' && controlStateVars.has(fromNode.id) ? fromNode.id : undefined;
      const snapped = snapAction(
        compiled.action,
        chainSnapshotFor(`dom:${fromNode.id}:${connection.fromProperty}`, seedId)
      );
      if ('defer' in snapped) {
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, snapped.defer);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: snapped.defer };
        }
        notes.push(`wire ${connection.key} dropped: ${snapped.defer}`);
        continue;
      }
      plan.handlers[fromNode.id] = plan.handlers[fromNode.id] ?? {};
      const list = (plan.handlers[fromNode.id][connection.fromProperty] =
        plan.handlers[fromNode.id][connection.fromProperty] ?? []);
      list.push(snapped);
      if (!outputsSink) dispositions[toNode.id] = { kind: 'collapsed', into: fromNode.id };
      for (const id of compiled.collapses ?? []) dispositions[id] = { kind: 'collapsed', into: fromNode.id };
      for (const key of compiled.consumes) consumed.add(key);
      for (const id of compiled.subscribes ?? []) boundSubscribers.add(id);
      continue;
    }
    if (fromNode?.type === 'Event Receiver' && connection.fromProperty === 'eventReceived') {
      const eligible = receiverEligible(fromNode);
      if ('defer' in eligible) {
        dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: eligible.defer };
        notes.push(`wire ${connection.key} dropped: ${eligible.defer}`);
        continue;
      }
      if (!actionsValidIn([compiled.action], { kind: 'receiver', receiverId: fromNode.id })) {
        const reason = 'the action reads values that only exist in another handler';
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, reason);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason };
        }
        notes.push(`wire ${connection.key} dropped: ${reason}`);
        continue;
      }
      const snappedRecv = snapAction(compiled.action, chainSnapshotFor(`recv:${fromNode.id}`));
      if ('defer' in snappedRecv) {
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, snappedRecv.defer);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: snappedRecv.defer };
        }
        notes.push(`wire ${connection.key} dropped: ${snappedRecv.defer}`);
        continue;
      }
      receiverActions.set(fromNode.id, [...(receiverActions.get(fromNode.id) ?? []), snappedRecv]);
      if (!outputsSink) dispositions[toNode.id] = { kind: 'collapsed', into: fromNode.id };
      for (const id of compiled.collapses ?? []) dispositions[id] = { kind: 'collapsed', into: fromNode.id };
      for (const key of compiled.consumes) consumed.add(key);
      for (const id of compiled.subscribes ?? []) boundSubscribers.add(id);
      continue;
    }
    const untranslatable = `trigger ${connection.fromId}.${connection.fromProperty} is not a rendered element event or a receiver`;
    if (outputsSink) {
      if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, untranslatable);
    } else {
      dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: untranslatable };
    }
    notes.push(`wire ${connection.key} dropped: the trigger is not a rendered element event or a receiver`);
  }

  // Component Outputs nodes rule once, after every wire has spoken: the interface declaration
  // is static (Component Inputs' own disposition) unless some fed port failed — then the node
  // defers with that first failure, while the ports that did translate keep their behaviour
  // (a missing callback is absent behaviour, reported — not a lying structure) (§4).
  for (const node of component.nodes) {
    if (node.type !== 'Component Outputs' || dispositions[node.id] !== undefined) continue;
    const failure = failedOutputsNodes.get(node.id);
    if (failure !== undefined) {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: failure };
      notes.push(`node ${node.id} (Component Outputs) deferred: ${failure}`);
    } else {
      dispositions[node.id] = { kind: 'static' };
    }
  }

  // Receivers with attached actions become useSignal subscriptions in this component's file.
  for (const node of component.nodes) {
    if (node.type !== 'Event Receiver') continue;
    const actions = receiverActions.get(node.id);
    if (!actions || actions.length === 0) {
      if (dispositions[node.id] === undefined) {
        dispositions[node.id] = {
          kind: 'deferred',
          to: 'EXP-003',
          reason: 'received event drives nothing statically translatable'
        };
      }
      continue;
    }
    if (!plan.file) {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: 'component emits no file to host the subscription' };
      notes.push(`receiver ${node.id} deferred: component emits no file to host the subscription`);
      continue;
    }
    if (literalParam(node, 'consume') === 'always') {
      notes.push(`receiver ${node.id} consumes events; exported subscribers all receive every event`);
    }
    plan.receivers.push({ nodeId: node.id, channelName: channelNameOf(node)!, actions });
    dispositions[node.id] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
  }

  // Popup slots and the close prop are earned by attachment (POPUPS-TARGET §2, §4): a compiled
  // popup action whose trigger never attached must leave no state, render, or prop behind.
  //
  // The record verbs earn their api-stub exports and their Error state row the same way
  // (RECORD-VERBS-TARGET §4): a compiled verb whose `Do` never attached must not put a
  // `createPuppy` in the api module that nothing calls, nor a `useState` nothing writes.
  {
    const attachedSlotKeys = new Set<string>();
    const attachedMutations = attachedRecordVerbs;
    let closeAttached = false;
    const scanActions = (actions: HandlerAction[]) => {
      for (const action of actions) {
        if (action.kind === 'popup-show') {
          attachedSlotKeys.add(action.slotKey);
          scanActions(action.then);
        } else if (action.kind === 'popup-close') {
          closeAttached = true;
          scanActions(action.then);
        } else if (action.kind === 'api-call') {
          attachedMutations.add(action.nodeId);
          scanActions(action.then);
        } else if (action.kind === 'branch') {
          scanActions(action.whenTrue);
          scanActions(action.whenFalse);
        }
      }
    };
    for (const byPort of Object.values(plan.handlers)) for (const actions of Object.values(byPort)) scanActions(actions);
    for (const actions of Object.values(plan.changeHandlers)) scanActions(actions);
    for (const receiver of plan.receivers) scanActions(receiver.actions);
    plan.popups = slotRegistry.filter((s) => attachedSlotKeys.has(s.slotKey));
    plan.closesPopup = closeAttached;
    plan.mutations = plan.mutations.filter((m) => attachedMutations.has(m.nodeId));
    // The user family earns its session exports the same way (USER-FAMILY-TARGET §5.1). The
    // `read` entries are pushed after the 4x passes and are earned separately, by a surviving
    // expression — so only the verbs are filtered here.
    plan.sessionCalls = plan.sessionCalls.filter((c) => c.verb === 'read' || attachedMutations.has(c.nodeId));
    for (const [nodeId, stateVar] of verbErrorVars) {
      if (attachedMutations.has(nodeId)) continue;
      const index = plan.stateVars.indexOf(stateVar);
      if (index >= 0) plan.stateVars.splice(index, 1);
    }
  }

  // The popup sweep: popup nodes the passes did not collapse defer with their compiled reason.
  for (const node of component.nodes) {
    if (dispositions[node.id] !== undefined) continue;
    if (node.type !== 'NavigationShowPopup' && node.type !== 'NavigationClosePopup') continue;
    const show = node.type === 'NavigationShowPopup';
    const compiled = compiledSinks.get(`${node.id}:${show ? 'show' : 'close'}`);
    const reason =
      compiled !== undefined && 'defer' in compiled
        ? compiled.defer
        : `${show ? 'Show' : 'Close'} is never fired by a translatable trigger`;
    dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
    notes.push(`node ${node.id} (${node.type}) deferred: ${reason}`);
  }

  // The record-verb sweep, the popup sweep's twin: a verb the attachment pass did not collapse
  // defers with its *compiled* reason rather than falling to the catch-all "logic node (…)" —
  // the named-deferral rule, which is what makes the audit a map of the next slices.
  for (const node of component.nodes) {
    if (dispositions[node.id] !== undefined) continue;
    const trigger =
      RECORD_VERBS[node.type] !== undefined ? 'store' : USER_VERBS[node.type] !== undefined ? USER_VERBS[node.type].trigger : undefined;
    if (trigger === undefined) continue;
    const compiled = compiledSinks.get(`${node.id}:${trigger}`);
    const reason =
      compiled !== undefined && 'defer' in compiled
        ? compiled.defer
        : 'its Do is never fired by a translatable trigger';
    dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
    notes.push(`node ${node.id} (${node.type}) deferred: ${reason}`);
  }

  // Pass 3: a wired onTextChanged into a Variable is the input's onChange — write-through,
  // and nothing else: the input stays uncontrolled because no wire feeds text back in.
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const toNode = nodeById.get(connection.toId);
    if (toNode?.type !== 'Variable2' || connection.toProperty !== 'value') continue;
    consumed.add(connection.key);
    const variableName = variableNameOf(toNode);
    const fromNode = nodeById.get(connection.fromId);
    if (
      variableName !== undefined &&
      fromNode &&
      isTextInputType(fromNode.type) &&
      connection.fromProperty === 'onTextChanged' &&
      rendered.has(fromNode.id)
    ) {
      const list = (plan.changeHandlers[fromNode.id] = plan.changeHandlers[fromNode.id] ?? []);
      list.push({ kind: 'store-set', variableName, expr: { kind: 'input-text', inputId: fromNode.id } });
    } else {
      notes.push(
        `wire ${connection.key} dropped: a variable write is only translated from a rendered text input in step 5`
      );
    }
  }

  // Pass 4: Variable reads into rendered sinks become store bindings (useValue at emit).
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (fromNode?.type !== 'Variable2' || connection.fromProperty !== 'value') continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // leave for the catch-all
    consumed.add(connection.key);
    const variableName = variableNameOf(fromNode);
    if (variableName === undefined) {
      notes.push(`wire ${connection.key} dropped: variable name is not a literal`);
      continue;
    }
    if (registry.variables.get(variableName)!.tsType !== 'string') {
      notes.push(`wire ${connection.key} dropped: variable "${variableName}" has no statically-typed writer`);
      continue;
    }
    if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) {
      notes.push(`wire ${connection.key} dropped: a mounted wire into the component root is a router concern — not translated in this slice`);
      continue;
    }
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][connection.toProperty] = { kind: 'store', variableName };
  }

  // Pass 4b: single-key Subscribe reads into rendered sinks become store-key bindings
  // (useStore selectors at emit — NAMED-STORES-TARGET §2).
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (fromNode?.type !== GLOBAL_STORE_SUBSCRIBE || connection.fromProperty !== 'value') continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // leave for the catch-all
    consumed.add(connection.key);
    const read = storeKeyReadOf(fromNode);
    if ('defer' in read) {
      notes.push(`wire ${connection.key} dropped: ${read.defer}`);
      continue;
    }
    if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) {
      notes.push(`wire ${connection.key} dropped: a mounted wire into the component root is a router concern — not translated in this slice`);
      continue;
    }
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][connection.toProperty] = { kind: 'store-key', storeName: read.storeName, key: read.key };
    boundSubscribers.add(fromNode.id);
  }

  // Pass 4c: a logic node's value output into a rendered sink becomes a computed binding — the
  // expression tree rendered inline at the sink, its hooks earned exactly as direct bindings
  // earn them (LOGIC-TARGET §2, §6). The whole tree's wires are consumed together; a tree that
  // fails to resolve defers whole, never as a half-filled literal. Boolean expressions land
  // only in the one truthiness sink the render vocabulary has — a control's `enabled` (§7).
  const LOGIC_VALUE_OUTPUTS: Record<string, string[]> = {
    'String Format': ['formatted'],
    And: ['result'],
    Or: ['result'],
    Inverter: ['result'],
    Condition: ['result', 'isfalse']
  };
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (!fromNode || !(LOGIC_VALUE_OUTPUTS[fromNode.type] ?? []).includes(connection.fromProperty)) continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // leave for the catch-all
    consumed.add(connection.key);
    const ctx = newCtx();
    const expr = resolveExpr(fromNode, connection.fromProperty, ctx);
    if (expr === null) {
      notes.push(`wire ${connection.key} dropped: ${ctx.defer ?? 'the logic output has no statically known source'}`);
      continue;
    }
    if (!exprValidIn(expr, { kind: 'render' })) {
      notes.push(`wire ${connection.key} dropped: the expression reads values that only exist inside a handler`);
      continue;
    }
    const role = plan.roleOf[toNode.id];
    const enabledSink =
      connection.toProperty === 'enabled' &&
      (role === 'button' || role === 'input' || role === 'checkbox' || role === 'radio' || role === 'select' || role === 'range');
    // `visible`/`mounted` join `enabled` in the truthiness admission list (CONTROLLED-STATE
    // §4b) — both fold a maybe-undefined source exactly as the runtime's `if (value)` does.
    const truthinessSink =
      enabledSink || connection.toProperty === 'visible' || connection.toProperty === 'mounted';
    if (isBooleanExpr(expr) && !truthinessSink) {
      notes.push(
        `wire ${connection.key} dropped: a logic truth value lands only in a truthiness sink (a control's enabled, visible, mounted) in this slice`
      );
      continue;
    }
    if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) {
      notes.push(`wire ${connection.key} dropped: a mounted wire into the component root is a router concern — not translated in this slice`);
      continue;
    }
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][connection.toProperty] = { kind: 'computed', expr };
    for (const key of ctx.consumes) consumed.add(key);
    for (const id of ctx.subscriberIds) boundSubscribers.add(id);
    if (plan.file) {
      for (const id of ctx.logicNodeIds) {
        dispositions[id] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
      }
    }
  }

  // Pass 4d: Component Object reads into rendered sinks (COMPONENT-OBJECT-TARGET §3) — the
  // record compiles away: a mirrored property reads its writer's source, an unwritten one its
  // boot value. Only sinks the emitter honestly renders consume here (`children`, `attr:`,
  // the enabled inversion); everything else is the strict-mixed sweep's to name (§5).
  const coBoundReadKeys = new Set<string>();
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (fromNode?.type !== COMPONENT_OBJECT || !connection.fromProperty.startsWith('value-')) continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // the sweep names the reason
    const contentRole = (CONTENT_PARAMS[toNode.type] ?? {})[connection.toProperty];
    const truthinessSink = connection.toProperty === 'visible' || connection.toProperty === 'mounted';
    const bindable =
      truthinessSink ||
      contentRole === 'children' ||
      contentRole === 'attr-not:disabled' ||
      (contentRole !== undefined && contentRole.startsWith('attr:'));
    if (!bindable) continue; // the sweep names the reason
    if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) continue; // the sweep names the reason
    const ctx = newCtx();
    const expr = resolveExpr(fromNode, connection.fromProperty, ctx);
    if (expr === null) continue; // the sweep defers the node with this reason
    if (!exprValidIn(expr, { kind: 'render' })) continue;
    if (isBooleanExpr(expr) && contentRole !== 'attr-not:disabled' && !truthinessSink) continue;
    consumed.add(connection.key);
    coBoundReadKeys.add(connection.key);
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][connection.toProperty] = { kind: 'computed', expr };
    if (expr.kind === 'undefined') {
      notes.push(
        `wire ${connection.key}: property "${connection.fromProperty.slice('value-'.length)}" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form`
      );
    }
    for (const key of ctx.consumes) consumed.add(key);
    for (const id of ctx.subscriberIds) boundSubscribers.add(id);
    if (plan.file) {
      for (const id of ctx.logicNodeIds) {
        dispositions[id] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
      }
    }
  }

  // Pass 4e: JS value outputs into rendered sinks (EXP-003 §4 A1) — the node becomes a render
  // local, the sink reads its field. Only sinks the emitter honestly renders consume here
  // (children, `attr:`, the enabled inversion — pass 4d's discipline, not 4c's silent hole);
  // everything else is the strict-mixed sweep's to name. Boolean shapes (isTrue/isFalse) land
  // only in the truthiness sink; the folds and the unfolded any-typed reads land anywhere.
  const jsBoundReadKeys = new Set<string>();
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (!fromNode || jsNodeKindOf(fromNode.type) === null || !isJsValueOutput(fromNode, connection.fromProperty)) {
      continue;
    }
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // the sweep names the reason
    const contentRole = (CONTENT_PARAMS[toNode.type] ?? {})[connection.toProperty];
    const truthinessSink = connection.toProperty === 'visible' || connection.toProperty === 'mounted';
    const bindable =
      truthinessSink ||
      contentRole === 'children' ||
      contentRole === 'attr-not:disabled' ||
      (contentRole !== undefined && contentRole.startsWith('attr:'));
    if (!bindable) continue; // the sweep names the reason
    if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) continue; // the sweep names the reason
    const ctx = newCtx();
    const expr = resolveExpr(fromNode, connection.fromProperty, ctx);
    if (expr === null) continue; // the sweep defers the node with this reason
    if (!exprValidIn(expr, { kind: 'render' })) continue; // handler-only args, or an invoked node
    if (isBooleanExpr(expr) && contentRole !== 'attr-not:disabled' && !truthinessSink) continue;
    consumed.add(connection.key);
    jsBoundReadKeys.add(connection.key);
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][connection.toProperty] = { kind: 'computed', expr };
    for (const key of ctx.consumes) consumed.add(key);
    for (const id of ctx.subscriberIds) boundSubscribers.add(id);
    if (plan.file) {
      for (const id of ctx.logicNodeIds) {
        dispositions[id] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
      }
    }
  }

  // Pass 4f: latch state and stateful-control value outputs into rendered sinks
  // (CONTROLLED-STATE-TARGET §4a, §4c) — `Switch.state → Group.visible`,
  // `range.value → Text.text`. Same bindable discipline as 4d/4e, plus the truthiness sinks.
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (!fromNode) continue;
    const isLatchRead =
      (fromNode.type === 'Switch' && connection.fromProperty === 'state') ||
      (fromNode.type === 'Counter' && connection.fromProperty === 'currentCount');
    const spec = controlSpecOf(fromNode.id);
    const isControlRead =
      spec !== undefined && connection.fromProperty === spec.output && controlStateVars.has(fromNode.id);
    // STATIC-DATA §4.6 — `count` over rows known at emit, which resolves to a number literal.
    // It rides this pass because it wants exactly the same bindable discipline.
    const isStaticCountRead = fromNode.type === 'Static Data' && connection.fromProperty === 'count';
    // An awaited call's Error into a rendered sink (RECORD-VERBS-TARGET §4a) — the status line.
    // It rides this pass because it is a state read into a bindable sink, exactly like the two
    // above, `stateLandedKeys` included so the verdict sweeps can see the read landed.
    //
    // ⚠️ **Both families, not just the record verbs.** This predicate named one of them while
    // `resolveExpr` named both, and the mismatch **failed silently**: the Log In status line
    // resolved and then fell through to the catch-all note, rendering an empty `<p>` where the
    // interpreted app shows the refusal (USER-FAMILY-TARGET §9). s19's dispatcher rule in its
    // second family — when a vocabulary grows a member, audit every site that enumerates it.
    const isRecordErrorRead =
      (RECORD_VERBS[fromNode.type] !== undefined || USER_VERBS[fromNode.type] !== undefined) &&
      connection.fromProperty === 'error';
    // A `User` output into a rendered sink (USER-FAMILY-TARGET §4c) — `Signed in as <username>`
    // and the `authenticated` visibility gates. It rides this pass for the same reason the
    // Error read does: it is a read of ambient state into a bindable sink.
    const isSessionRead = fromNode.type === 'net.noodl.user.User' && SESSION_READS[connection.fromProperty] !== undefined;
    // A value Variable's `savedValue` (and String's `length`) into a rendered sink (EXP-011
    // Tier 1.4). It rides this pass for the reason the two above do: whether it resolves to a
    // literal or to a state row is a fact about the node's wires, and both are reads of ambient
    // state into a bindable sink. `resolveExpr` decides which; this only decides where it lands.
    const isValueVariableRead =
      VALUE_VARIABLES[fromNode.type] !== undefined &&
      (connection.fromProperty === 'savedValue' || connection.fromProperty === 'length');
    if (!isLatchRead && !isControlRead && !isStaticCountRead && !isRecordErrorRead && !isSessionRead && !isValueVariableRead) {
      continue;
    }
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // handler reads resolve at compile; the sweep names the rest
    const contentRole = (CONTENT_PARAMS[toNode.type] ?? {})[connection.toProperty];
    const truthinessSink = connection.toProperty === 'visible' || connection.toProperty === 'mounted';
    const bindable =
      truthinessSink ||
      contentRole === 'children' ||
      contentRole === 'attr-not:disabled' ||
      (contentRole !== undefined && contentRole.startsWith('attr:'));
    if (!bindable) continue; // the sweep names the reason
    // Three verbs sharing one status line is the corpus's own shape (the Puppy admin form). The
    // runtime shows whichever wrote last, which is not statically ordered — so the first wire
    // binds and the rest are dropped *with a note*, never overwritten in silence.
    if (isRecordErrorRead && plan.bindings[toNode.id]?.[connection.toProperty] !== undefined) {
      consumed.add(connection.key);
      notes.push(
        `wire ${connection.key} dropped: ${toNode.id}.${connection.toProperty} already shows another node's Error — the runtime shows whichever wrote last, which is not statically ordered`
      );
      continue;
    }
    if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) {
      consumed.add(connection.key);
      notes.push(`wire ${connection.key} dropped: a mounted wire into the component root is a router concern — not translated in this slice`);
      continue;
    }
    const ctx = newCtx();
    const expr = resolveExpr(fromNode, connection.fromProperty, ctx);
    if (expr === null) continue; // the sweep defers with this reason
    consumed.add(connection.key);
    stateLandedKeys.add(connection.key);
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][connection.toProperty] = { kind: 'computed', expr };
  }

  /**
   * Pass 4g: `Object` reads into rendered sinks (EXP-011 Tier 1.1) — the repeater's row, read
   * sideways (EXP-002-MODEL2-TARGET-OUTPUT §4).
   *
   * Pass 4d's shape, for the same reason: the port name is a *prefix* (`prop-`), so the
   * whitelist Pass 4c matches on cannot express it. The expression is the simplest one this file
   * has — the prop minted for this read — so there is nothing to resolve beyond the §5 gates the
   * pre-pass already applied; a node that failed one has no entry, and Pass 6 names its reason.
   *
   * Sinks are restricted exactly as 4d restricts them, and for the same stated reason: only the
   * ones the emitter honestly renders consume here, so a read landing somewhere the export draws
   * nothing is reported rather than silently swallowed.
   */
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (fromNode?.type !== 'Model2' || !connection.fromProperty.startsWith('prop-')) continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // Pass 6 names the reason
    const contentRole = (CONTENT_PARAMS[toNode.type] ?? {})[connection.toProperty];
    const truthinessSink = connection.toProperty === 'visible' || connection.toProperty === 'mounted';
    const bindable =
      truthinessSink ||
      contentRole === 'children' ||
      contentRole === 'attr-not:disabled' ||
      (contentRole !== undefined && contentRole.startsWith('attr:'));
    if (!bindable) continue;
    if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) continue;
    const ctx = newCtx();
    const expr = resolveExpr(fromNode, connection.fromProperty, ctx);
    if (expr === null) {
      notes.push(`wire ${connection.key} dropped: ${ctx.defer ?? 'the Object node does not read the repeater row'}`);
      consumed.add(connection.key);
      continue;
    }
    consumed.add(connection.key);
    plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
    plan.bindings[toNode.id][connection.toProperty] = { kind: 'computed', expr };
  }

  // Pass 5: Component Inputs bindings and the query/array→repeater feeds (step 4's rules,
  // plus the Collection2 read side — COLLECTIONS-TARGET §2).
  const boundCollectionReaders = new Set<string>();
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    const toNode = nodeById.get(connection.toId);
    // §4e: a list-typed vocabulary source into `items` — a prop-fed or state-fed plain list.
    if (
      toNode?.type === 'For Each' &&
      connection.toProperty === 'items' &&
      plan.repeaters[toNode.id] &&
      fromNode !== undefined &&
      fromNode.type !== 'DbCollection2' &&
      fromNode.type !== 'Collection2' &&
      // Static Data has a statically-known item shape, so it takes the typed branch below
      // rather than this one, whose contract is "untyped list, fields read as `any`".
      fromNode.type !== 'Static Data'
    ) {
      consumed.add(connection.key);
      const ctx = newCtx();
      const expr = resolveExpr(fromNode, connection.fromProperty, ctx);
      if (expr === null) {
        notes.push(`wire ${connection.key} dropped: ${ctx.defer ?? 'items are fed by no statically known source'}`);
        continue;
      }
      const tsType = exprTsType(expr);
      if (!tsType.endsWith('[]')) {
        notes.push(`wire ${connection.key} dropped: items are fed by a source not statically typed as a list (${tsType})`);
        continue;
      }
      if (!exprValidIn(expr, { kind: 'render' })) {
        notes.push(`wire ${connection.key} dropped: the expression reads values that only exist inside a handler`);
        continue;
      }
      plan.repeaters[toNode.id].itemsExpr = expr;
      stateLandedKeys.add(connection.key);
      for (const k of ctx.consumes) consumed.add(k);
      for (const s of ctx.subscriberIds) boundSubscribers.add(s);
      if (plan.file) {
        for (const l of ctx.logicNodeIds) {
          dispositions[l] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
        }
      }
      continue;
    }
    if (fromNode?.type === 'Component Inputs' && toNode && rendered.has(toNode.id)) {
      if (connection.toProperty === 'mounted' && toNode.id === plan.rootId) {
        consumed.add(connection.key);
        notes.push(`wire ${connection.key} dropped: a mounted wire into the component root is a router concern — not translated in this slice`);
        continue;
      }
      if (!declaresProp(connection.fromProperty)) {
        consumed.add(connection.key);
        notes.push(`wire ${connection.key} dropped: ${undeclaredPropReason(connection.fromProperty)}`);
        continue;
      }
      plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
      plan.bindings[toNode.id][connection.toProperty] = { kind: 'prop', name: connection.fromProperty };
      consumed.add(connection.key);
      continue;
    }
    if (
      toNode?.type === 'For Each' &&
      connection.toProperty === 'items' &&
      fromNode?.type === 'DbCollection2' &&
      plan.repeaters[toNode.id]
    ) {
      plan.repeaters[toNode.id].itemsQueryId = fromNode.id;
      consumed.add(connection.key);
      continue;
    }
    // STATIC-DATA §3 — the authored blob's rows, hoisted to a module constant. Ordered before
    // the Collection2 branch only for readability; the two cannot both match.
    if (
      toNode?.type === 'For Each' &&
      connection.toProperty === 'items' &&
      fromNode?.type === 'Static Data' &&
      connection.fromProperty === 'items' &&
      plan.repeaters[toNode.id]
    ) {
      const sd = plan.staticData.find((s) => s.nodeId === fromNode.id);
      if (sd === undefined) {
        // The node deferred at its own gate, which already filed the reason (§4).
        notes.push(`wire ${connection.key} dropped: the Static Data node it reads deferred`);
        continue;
      }
      consumed.add(connection.key);
      plan.repeaters[toNode.id].itemsStaticId = fromNode.id;
      continue;
    }
    if (
      toNode?.type === 'For Each' &&
      connection.toProperty === 'items' &&
      fromNode?.type === 'Collection2' &&
      connection.fromProperty === 'items' &&
      plan.repeaters[toNode.id]
    ) {
      consumed.add(connection.key);
      const collectionName = collectionNameOf(fromNode, wiredPorts);
      if (collectionName === undefined) {
        notes.push(`wire ${connection.key} dropped: array id is not a literal`);
        continue;
      }
      const eligible = collectionReadEligible(fromNode);
      if (eligible !== true) {
        notes.push(`wire ${connection.key} dropped: ${eligible}`);
        continue;
      }
      plan.repeaters[toNode.id].itemsCollectionName = collectionName;
      boundCollectionReaders.add(fromNode.id);
      continue;
    }
  }

  // The Component Object verdict — strict-mixed, the Component Outputs precedent
  // (COMPONENT-OBJECT-TARGET §5): collapsed only when the gates pass and every value-* read
  // landed; otherwise deferred with the first unlanded read's reason, while the reads that did
  // land keep their behaviour. Dead mirror writes on a collapsed node are elided with a note —
  // with no signal consumer (gate 7) the record is unobservable in the emitted app.
  for (const node of component.nodes) {
    if (node.type !== COMPONENT_OBJECT || dispositions[node.id] !== undefined) continue;
    const reads = component.connections.filter((c) => c.fromId === node.id && c.fromProperty.startsWith('value-'));
    const writes = component.connections.filter((c) => c.toId === node.id && c.toProperty.startsWith('value-'));
    let verdict: string | null = componentObjectGate(node);
    if (verdict === null && reads.length === 0) {
      verdict =
        writes.length === 0
          ? 'its properties feed nothing statically translatable'
          : 'its record is only written, never read — nothing observable to translate';
    }
    if (verdict === null) {
      for (const read of reads) {
        // Landed: bound by pass 4d, or consumed by a handler chain whose sink attached. A wire
        // pass 2 consumed while *dropping* leaves its sink deferred, so it does not count.
        if (coBoundReadKeys.has(read.key) || stateLandedKeys.has(read.key)) continue;
        if (consumed.has(read.key) && dispositions[read.toId]?.kind === 'collapsed') continue;
        const ctx = newCtx();
        const resolved = resolveExpr(node, read.fromProperty, ctx);
        if (resolved === null) {
          verdict = ctx.defer ?? `property "${read.fromProperty.slice('value-'.length)}" has no static translation`;
        } else {
          const sink = nodeById.get(read.toId);
          verdict =
            sink !== undefined && dispositions[read.toId] !== undefined && dispositions[read.toId].kind === 'deferred'
              ? `its ${read.fromProperty} feeds ${sink.type}, which is itself deferred`
              : `its ${read.fromProperty} feeds ${sink?.type ?? 'a missing node'}.${read.toProperty}, which has no static binding in this slice`;
        }
        break;
      }
    }
    if (verdict === null && !plan.file) verdict = 'component emits no file to host its bindings';
    if (verdict !== null) {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: verdict };
      notes.push(`node ${node.id} (${COMPONENT_OBJECT}) deferred: ${verdict}`);
      continue;
    }
    dispositions[node.id] = { kind: 'collapsed', into: `src/${plan.file!.dir}/${plan.file!.fileBase}.tsx` };
    for (const write of writes) {
      if (consumed.has(write.key)) continue;
      consumed.add(write.key);
      notes.push(
        `wire ${write.key} dropped: it mirrors into property "${write.toProperty.slice('value-'.length)}", which nothing reads — the record is not observable in the emitted app`
      );
    }
  }

  // The JS-node verdict — strict-mixed, the Component Outputs/Object precedent (EXP-003 §3.6):
  // collapsed only when the gate passes and every consumed value output landed (a pass-4e bind,
  // or a handler chain whose sink attached); otherwise deferred with the first unlanded read's
  // named reason, while the reads that did land keep their behaviour. An invoked node never
  // reaches here — its Run trigger attachment already ruled it.
  for (const node of component.nodes) {
    const kind = jsNodeKindOf(node.type);
    if (kind === null || dispositions[node.id] !== undefined) continue;
    const allReads = component.connections.filter((c) => c.fromId === node.id && isJsValueOutput(node, c.fromProperty));
    let verdict: string | null = null;
    const record = jsFunDefOf(node);
    if ('defer' in record) verdict = record.defer;
    if (verdict === null && wiredPorts.has(`${node.id}:run`)) {
      const compiled = compiledSinks.get(`${node.id}:run`);
      verdict =
        compiled !== undefined && 'defer' in compiled ? compiled.defer : 'Run is never fired by a translatable trigger';
    }
    if (verdict === null) {
      for (const c of component.connections) {
        if (c.fromId !== node.id || jsDeadWireKeys.has(c.key) || isJsValueOutput(node, c.fromProperty)) continue;
        if (c.fromProperty === 'done') {
          // Outcome tokens exist only on the Run path (§1) — with Run unwired the runtime
          // never pulses done, so the wire is dropped as the runtime drops it.
          consumed.add(c.key);
          notes.push(`wire ${c.key} dropped: done is invocation-only and Run is not wired — the runtime never pulses it`);
          continue;
        }
        if (kind === 'function' && c.fromProperty === 'unchanged') {
          consumed.add(c.key);
          notes.push(`wire ${c.key} dropped: unchanged is invocation-only and Run is not wired — the runtime never pulses it`);
          continue;
        }
        const perEvaluation = c.fromProperty === 'isTrueEv' || c.fromProperty === 'isFalseEv';
        verdict = perEvaluation
          ? `its ${c.fromProperty} pulse fires per evaluation — render-derived code has no faithful analogue`
          : c.fromProperty === 'error'
            ? 'its error output is consumed — failure reporting is not translated in this slice'
            : `its ${c.fromProperty} output is consumed — per-run pulses have no render analogue (grade I, EXP-003 §5)`;
        break;
      }
    }
    if (verdict === null && allReads.length === 0) verdict = 'its outputs feed nothing statically translatable';
    if (verdict === null) {
      for (const read of allReads) {
        if (jsBoundReadKeys.has(read.key) || stateLandedKeys.has(read.key)) continue;
        if (consumed.has(read.key) && dispositions[read.toId]?.kind === 'collapsed') continue;
        const ctx = newCtx();
        const resolved = resolveExpr(node, read.fromProperty, ctx);
        if (resolved === null) {
          verdict = ctx.defer ?? `its ${read.fromProperty} output has no static translation`;
        } else {
          const sink = nodeById.get(read.toId);
          verdict =
            sink !== undefined && dispositions[read.toId]?.kind === 'deferred'
              ? `its ${read.fromProperty} feeds ${sink.type}, which is itself deferred`
              : `its ${read.fromProperty} feeds ${sink?.type ?? 'a missing node'}.${read.toProperty}, which has no static binding in this slice`;
        }
        break;
      }
    }
    if (verdict === null && !plan.file) verdict = 'component emits no file to host its wrapper';
    if (verdict !== null) {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: verdict };
      notes.push(`node ${node.id} (${node.type}) deferred: ${verdict}`);
      continue;
    }
    dispositions[node.id] = { kind: 'collapsed', into: `src/${plan.file!.dir}/${plan.file!.fileBase}.tsx` };
  }

  // The latch verdict (CONTROLLED-STATE-TARGET §4a) — the Component Outputs precedent: a
  // Switch/Counter the passes did not rule defers with the gate's reason or the first
  // unlanded wire's; one whose every wire landed collapses into the file.
  for (const node of component.nodes) {
    if (!isLatchType(node.type) || dispositions[node.id] !== undefined) continue;
    let verdict: string | null = null;
    const rec = latchStateOf(node);
    if ('defer' in rec) verdict = rec.defer;
    if (verdict === null) {
      for (const c of component.connections) {
        if (consumed.has(c.key)) continue;
        if (c.toId === node.id && (LATCH_TRIGGERS[node.type] ?? []).includes(c.toProperty)) {
          const compiled = compiledSinks.get(`${node.id}:${c.toProperty}`);
          verdict =
            compiled !== undefined && 'defer' in compiled
              ? compiled.defer
              : `its ${c.toProperty} trigger is never fired by a translatable source`;
          break;
        }
        if (c.fromId === node.id) {
          const sink = nodeById.get(c.toId);
          verdict = `its ${c.fromProperty} read feeds ${sink?.type ?? 'a missing node'}.${c.toProperty}, which has no static binding in this slice`;
          break;
        }
      }
    }
    if (verdict === null && !component.connections.some((c) => c.fromId === node.id || c.toId === node.id)) {
      verdict = 'its state feeds nothing statically translatable';
    }
    if (verdict === null && !plan.file) verdict = 'component emits no file to host its state';
    if (verdict !== null) {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: verdict };
      notes.push(`node ${node.id} (${node.type}) deferred: ${verdict}`);
      continue;
    }
    dispositions[node.id] = { kind: 'collapsed', into: `src/${plan.file!.dir}/${plan.file!.fileBase}.tsx` };
  }

  // The value Variable verdict (EXP-011 Tier 1.4) — the latch sweep's shape, with one addition:
  // a mirror row's sync effect is pushed *here*, not where the read resolved, because a read
  // that resolved speculatively and was then dropped would otherwise leave an effect emit
  // references unconditionally. A node reaching this sweep collapsed means a read landed.
  for (const node of component.nodes) {
    if (VALUE_VARIABLES[node.type] === undefined || dispositions[node.id] !== undefined) continue;
    let verdict: string | null = null;
    const rec = valueVariableOf(node);
    if ('defer' in rec) verdict = rec.defer;
    if (verdict === null) {
      for (const c of component.connections) {
        if (consumed.has(c.key)) continue;
        // Its own Value feed is not an unlanded wire — the sweep below consumes it.
        if ('stateVar' in rec && c.key === rec.wireKey) continue;
        if (c.toId === node.id && c.toProperty === 'value') {
          verdict = 'its Value is fed by a source with no static translation in this slice';
          break;
        }
        if (c.fromId === node.id) {
          // Re-resolve the read so its own reason wins over the sink's. The gates that live in
          // `resolveExpr` rather than in `valueVariableOf` — a Length over a stored string, a
          // Length on a type that has none, a constant that cleared to null — are about the
          // *port*, not the node, and reporting "no static binding in this slice" for them
          // would blame the sink for a refusal the source made.
          const ctx = newCtx();
          const reason = resolveExpr(node, c.fromProperty, ctx) === null ? ctx.defer : undefined;
          const sink = nodeById.get(c.toId);
          verdict =
            reason ??
            `its ${c.fromProperty} read feeds ${sink?.type ?? 'a missing node'}.${c.toProperty}, which has no static binding in this slice`;
          break;
        }
      }
    }
    // A constant nothing reads is not a value the app ever shows. Said the latches' way: a node
    // whose whole contribution is a number no line prints has not been translated, it has been
    // dropped, and the report is the only place that difference can be seen.
    if (verdict === null && !component.connections.some((c) => c.fromId === node.id)) {
      verdict = 'its Value is read by nothing statically translatable';
    }
    if (verdict === null && !plan.file) verdict = 'component emits no file to host its state';
    if (verdict !== null) {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: verdict };
      notes.push(`node ${node.id} (${node.type}) deferred: ${verdict}`);
      continue;
    }
    if ('stateVar' in rec) {
      plan.syncEffects.push(rec.sync);
      consumed.add(rec.wireKey);
      for (const k of rec.ctx.consumes) consumed.add(k);
      for (const s of rec.ctx.subscriberIds) boundSubscribers.add(s);
      for (const l of rec.ctx.logicNodeIds) {
        dispositions[l] = { kind: 'collapsed', into: `src/${plan.file!.dir}/${plan.file!.fileBase}.tsx` };
      }
    }
    dispositions[node.id] = { kind: 'collapsed', into: `src/${plan.file!.dir}/${plan.file!.fileBase}.tsx` };
  }

  // Reactive Conditions (LOGIC-TARGET §10): the box is ticked and nothing drives `Evaluate`, so
  // the node re-tests whenever a value arrives on `condition` and fires exactly one arm. That is
  // a re-run keyed on the condition — a useEffect, not a handler. The Evaluate-only twin (§3) is
  // a `branch` inside whatever handler pulses it, and the two are mutually exclusive by
  // construction: the same literal read decides which, and a node with both defers.
  //
  // Runs before the session sweep below so a session read inside an arm is seen as surviving,
  // and before the wire sweep so the arms it consumes are not reported as dropped.
  for (const node of component.nodes) {
    if (node.type !== 'Condition' || dispositions[node.id] !== undefined) continue;
    if (literalParam(node, 'runOnChange-condition') === false) continue;
    if (wiredPorts.has(`${node.id}:eval`)) continue;
    const arms = component.connections.filter(
      (c) => c.fromId === node.id && (c.fromProperty === 'ontrue' || c.fromProperty === 'onfalse')
    );
    // No arm is the pure-comparator shape `conditionValueExprOf` owns — leave it to that pass.
    if (arms.length === 0) continue;
    if (!plan.file) {
      reactiveConditionDefers.set(node.id, 'component emits no file to host the effect');
      continue;
    }
    const compiled = compileConditionBranch(node);
    if ('defer' in compiled) {
      reactiveConditionDefers.set(node.id, compiled.defer);
      continue;
    }
    // An effect body reads the render closure, so anything that only exists inside a specific
    // DOM handler (an input's text, an event's value, a receiver's payload) cannot appear here.
    if (!actionsValidIn([compiled.action], { kind: 'render' })) {
      reactiveConditionDefers.set(node.id, 'its arms read values that only exist inside a handler');
      continue;
    }
    // The effect body is a chain like any other: a later read of something the chain just set
    // must see the set value, not the render closure's.
    const snapped = snapAction(compiled.action, chainSnapshotFor(`effect:${node.id}`));
    if ('defer' in snapped) {
      reactiveConditionDefers.set(node.id, snapped.defer);
      continue;
    }
    const into = `src/${plan.file.dir}/${plan.file.fileBase}.tsx`;
    plan.branchEffects.push({
      nodeId: node.id,
      action: snapped,
      comment: `${node.authoredLabel ?? 'Condition'} — re-tested whenever its condition changes (LOGIC-TARGET §10).`
    });
    dispositions[node.id] = { kind: 'collapsed', into };
    for (const id of compiled.collapses ?? []) dispositions[id] = { kind: 'collapsed', into };
    for (const key of compiled.consumes) consumed.add(key);
    for (const id of compiled.subscribes ?? []) boundSubscribers.add(id);
  }

  // The session read is earned by a surviving expression (USER-FAMILY-TARGET §4c), the same
  // discipline the popup slots and the api-stub mutations take: `resolveExpr` runs
  // speculatively, so a `User` node whose every read was dropped by a later pass must leave no
  // `useSession` in the module and no collapsed disposition behind. This runs after the 4x
  // passes because that is where bindings are written.
  {
    const readNodeIds = new Set<string>();
    const walkExpr = (expr: ValueExpr): void => {
      if (expr.kind === 'session-get') readNodeIds.add(expr.nodeId);
      else if (expr.kind === 'format') {
        for (const p of expr.parts) if (typeof p !== 'string') walkExpr(p);
      } else if (expr.kind === 'logical') expr.operands.forEach(walkExpr);
      else if (expr.kind === 'not' || expr.kind === 'truthy') walkExpr(expr.operand);
    };
    const walkActions = (actions: HandlerAction[]): void => {
      for (const action of actions) {
        switch (action.kind) {
          case 'api-call':
            for (const arg of action.args) {
              if (arg.kind === 'expr') walkExpr(arg.expr);
              else for (const p of arg.props) walkExpr(p.expr);
            }
            walkActions(action.then);
            break;
          case 'branch':
            walkExpr(action.cond);
            walkActions(action.whenTrue);
            walkActions(action.whenFalse);
            break;
          case 'popup-show':
          case 'popup-close':
          case 'jsfun-run':
            walkActions(action.then);
            break;
          case 'state-set':
            if (action.expr !== undefined) walkExpr(action.expr);
            break;
          default:
            break;
        }
      }
    };
    for (const byNode of Object.values(plan.bindings)) {
      for (const binding of Object.values(byNode)) if (binding.kind === 'computed') walkExpr(binding.expr);
    }
    for (const byPort of Object.values(plan.handlers)) for (const actions of Object.values(byPort)) walkActions(actions);
    for (const actions of Object.values(plan.changeHandlers)) walkActions(actions);
    for (const receiver of plan.receivers) walkActions(receiver.actions);
    // A reactive Condition's own test is the commonest session read there is (the auth-gate
    // idiom), and it lives in neither a binding nor a handler. Without this the `User` node
    // reads as unread: no `useSession` in `src/api/session.ts`, and the page imports a symbol
    // the module does not export.
    for (const effect of plan.branchEffects) walkActions([effect.action]);
    for (const nodeId of readNodeIds) {
      plan.sessionCalls.push({ nodeId, verb: 'read', fnName: 'useSession' });
    }
    // A `User` node no surviving expression reads is not collapsed — the sweeps below name it.
    for (const node of component.nodes) {
      if (node.type !== 'net.noodl.user.User') continue;
      if (readNodeIds.has(node.id)) continue;
      if (dispositions[node.id]?.kind === 'collapsed') delete dispositions[node.id];
    }
  }

  // Pass 6: report every wire nothing translated.
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    // EXP-010 AC3: a wire whose end is a kit port the kit no longer declares is not "not yet
    // translated" — it is a wire the running app already delivers nothing through, which is a
    // different thing to tell an author and the only one they can act on. (The `rename-kit`
    // fixture is exactly this: `caption` was removed from the definition while a live connection
    // was using it.) Named here rather than earlier because a wire that *did* translate never
    // reaches this pass, so this cannot mask a working one.
    const kitEndpoint = undeclaredKitPortOf(connection, nodeById, kits);
    notes.push(
      kitEndpoint !== null
        ? `wire ${connection.key} dropped: ${kitEndpoint}`
        : `wire ${connection.key} has no deterministic translation in step 5 (deferred to EXP-003)`
    );
  }

  // Variables collapse into the stores module — the node is the module's provenance.
  for (const node of component.nodes) {
    if (node.type !== 'Variable2' || dispositions[node.id] !== undefined) continue;
    if (variableNameOf(node) !== undefined) {
      dispositions[node.id] = { kind: 'collapsed', into: 'src/stores/variables.ts' };
    } else {
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: 'variable name is not a literal' };
      notes.push(`node ${node.id} (Variable2) deferred: variable name is not a literal`);
    }
  }

  // Global Store declarers collapse into their store module; Subscribes into the component file
  // that hosts their selector hook. Anything the passes above did not translate defers.
  for (const node of component.nodes) {
    if (dispositions[node.id] !== undefined) continue;
    if (node.type === GLOBAL_STORE || node.type === GLOBAL_STORE_SUBSCRIBE) {
      const store = storePlanOf(node);
      if (store === undefined) {
        dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: 'store name is not a literal' };
        notes.push(`node ${node.id} (${node.type}) deferred: store name is not a literal`);
        continue;
      }
      if (store.deferred !== undefined) {
        dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: store.deferred };
        notes.push(`node ${node.id} (${node.type}) deferred: ${store.deferred}`);
        continue;
      }
      if (node.type === GLOBAL_STORE) {
        if (initialStateOf(node, wiredPorts).kind === 'bad') {
          dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: 'initialState is not a literal JSON object' };
          notes.push(`node ${node.id} (${node.type}) deferred: initialState is not a literal JSON object`);
        } else {
          dispositions[node.id] = { kind: 'collapsed', into: `src/stores/${store.exportName}.ts` };
        }
        continue;
      }
      if (boundSubscribers.has(node.id) && plan.file) {
        dispositions[node.id] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
      } else {
        dispositions[node.id] = {
          kind: 'deferred',
          to: 'EXP-003',
          reason: 'subscription drives nothing statically translatable'
        };
      }
    }
  }

  // Array readers collapse into the component file that hosts their useCollection hook,
  // exactly as bound Subscribes do; anything else about a Collection2 defers.
  for (const node of component.nodes) {
    if (node.type !== 'Collection2' || dispositions[node.id] !== undefined) continue;
    if (boundCollectionReaders.has(node.id) && plan.file) {
      dispositions[node.id] = { kind: 'collapsed', into: `src/${plan.file.dir}/${plan.file.fileBase}.tsx` };
    } else {
      const reason =
        collectionNameOf(node, wiredPorts) === undefined
          ? 'array id is not a literal'
          : 'array feeds nothing statically translatable';
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
    }
  }

  // Logic nodes the passes above translated are already collapsed; the rest defer with the
  // most specific reason available (LOGIC-TARGET §4).
  for (const node of component.nodes) {
    if (dispositions[node.id] !== undefined) continue;
    if (node.type === 'Condition') {
      const compiled = compiledSinks.get(`${node.id}:eval`);
      const reactive = reactiveConditionDefers.get(node.id);
      const reason =
        reactive ??
        (compiled !== undefined && 'defer' in compiled
          ? compiled.defer
          : 'no Evaluate wire attaches this condition to a handler');
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
      notes.push(`node ${node.id} (Condition) deferred: ${reason}`);
    } else if (node.type === 'String Format') {
      const reason = 'format output drives nothing statically translatable';
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
      notes.push(`node ${node.id} (String Format) deferred: ${reason}`);
    } else if (node.type === 'And' || node.type === 'Or' || node.type === 'Inverter') {
      const reason = 'logic output drives nothing statically translatable';
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
      notes.push(`node ${node.id} (${node.type}) deferred: ${reason}`);
    }
  }

  // Queries: a DbCollection2 consumed by a rendered repeater becomes state + effect + typed
  // stub (TARGET-OUTPUT §2); anything else about it defers.
  const usedStateNames = new Set<string>();
  for (const node of component.nodes) {
    if (node.type !== 'DbCollection2') continue;
    const consumedByRepeater = Object.values(plan.repeaters).some((r) => r.itemsQueryId === node.id);
    if (!consumedByRepeater) {
      dispositions[node.id] = {
        kind: 'deferred',
        to: 'EXP-003',
        reason: 'query result is not consumed by a rendered repeater'
      };
      continue;
    }
    const collectionName = String(literalParam(node, 'collectionName') ?? 'Record');
    const { typeName, plural, moduleBase, fetchName } = collectionModuleNames(collectionName);
    const stateName = dedupe(plural, usedStateNames);
    plan.queries.push({
      nodeId: node.id,
      collectionName,
      stateName,
      setterName: `set${stateName.charAt(0).toUpperCase()}${stateName.slice(1)}`,
      itemName: typeName.charAt(0).toLowerCase() + typeName.slice(1),
      fetchName,
      typeName,
      moduleBase
    });
    dispositions[node.id] = { kind: 'stubbed', reason: 'DbCollection2 → typed api stub + useState/useEffect' };
  }

  // Static Data (STATIC-DATA-TARGET §3): a node whose rows reached a rendered repeater is
  // collapsed into the hosting file as a module constant. One that passed its own gates but
  // that no repeater consumes is dropped from the plan rather than emitted as a dead constant —
  // the DbCollection2 precedent above, and the reason is named either way.
  for (const node of component.nodes) {
    if (node.type !== 'Static Data') continue;
    const planned = plan.staticData.find((s) => s.nodeId === node.id);
    if (planned === undefined) {
      // Its §4 gate already filed the reason; record the disposition to match.
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason: 'the authored rows are not statically translatable' };
      continue;
    }
    const consumedByRepeater = Object.values(plan.repeaters).some((r) => r.itemsStaticId === node.id);
    if (!consumedByRepeater) {
      const reason = 'the authored rows are not consumed by a rendered repeater';
      plan.staticData = plan.staticData.filter((s) => s.nodeId !== node.id);
      dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
      notes.push(`${plan.path}: node ${node.id} (Static Data) deferred: ${reason}`);
      continue;
    }
    dispositions[node.id] = {
      kind: 'collapsed',
      into: plan.file ? `src/${plan.file.dir}/${plan.file.fileBase}.tsx` : plan.path
    };
  }

  /**
   * The record-neighbour sweep runs **here**, immediately before the catch-all, and not beside
   * the popup and record-verb sweeps above — deliberately.
   *
   * Those two fire right after the attachment pass because they report a *compiled* verdict
   * that pass produced. These three types are value sources, and pass 4c (a logic node's value
   * output into a rendered sink) runs later than the attachment pass — so claiming them early
   * would pre-empt a pass that may yet translate them. Sitting here, the sweep can only ever
   * replace `logic node (…)` with a named reason, which is the whole of its job.
   */
  for (const node of component.nodes) {
    if (dispositions[node.id] !== undefined) continue;
    const reason = recordNeighbourDefer(node, component, nodeById, pageFileByPath.has(component.path), (fromNode, fromProperty) => {
      const ctx = newCtx();
      if (resolveExpr(fromNode, fromProperty, ctx) !== null) return null;
      return ctx.defer ?? `its Id is fed by ${fromNode?.type ?? 'nothing'}, which has no statically known source`;
    });
    if (reason === undefined) continue;
    dispositions[node.id] = { kind: 'deferred', to: 'EXP-003', reason };
    notes.push(`node ${node.id} (${node.type}) deferred: ${reason}`);
  }

  // Whatever analysis has not classified yet is logic: EXP-003's, or unknown-type debris.
  for (const node of component.nodes) {
    if (dispositions[node.id] === undefined) {
      const disposition = dispositionForLogic(node, kits);
      dispositions[node.id] = disposition;
      if (disposition.kind === 'unknown-type') {
        notes.push(`node ${node.id} has no resolvable type — exported nowhere, reported here`);
      } else if (kits.has(node.type)) {
        // A custom node reaching here is named, not left to the silent `deferred` majority. Every
        // other node on this path is a built-in the export has an established position on; this
        // one is the author's own, and "it is not in the output" is the fact this task exists to
        // stop the export leaving unsaid.
        notes.push(`node ${node.id} (${node.type}) deferred: ${disposition.kind === 'deferred' ? disposition.reason : ''}`);
      }
    }
  }

  return plan;
}

/**
 * A component's output interface, from its Component Outputs nodes' declarations — the union
 * across nodes, first declaration of a name winning (the runtime merges the port sets the same
 * way). Signal ports become callback props (COMPONENT-OUTPUTS-TARGET §2): a name that is
 * already an `onX` identifier is kept verbatim, anything else becomes `on` + PascalCase. A
 * port that cannot become a prop — no identifier material, or a collision with an input prop
 * or another output — fails with a reason rather than being silently renamed. Deterministic
 * over the ComponentIR alone, so the child's plan and every parent's plan agree.
 */
export interface OutputInterface {
  props: Array<{ port: string; prop: string }>;
  failed: Array<{ port: string; reason: string }>;
  /** Declared value-kind output ports — the lifted-state candidates (CONTROLLED-STATE §4d). */
  valuePorts: string[];
  /**
   * Value ports named as lifted callback props (`on` + PascalCase + `Changed` — the s10 name
   * source; collisions fail the port, never silently rename). Whether a port actually lifts is
   * the owning component's plan's to decide (its feed must resolve); the name is decided here,
   * off the ComponentIR alone, so the child's plan and every parent's plan agree.
   */
  valueProps: Array<{ port: string; prop: string; tsType: string }>;
}

export function componentOutputInterface(component: ComponentIR): OutputInterface {
  const takenProps = new Set<string>();
  for (const node of component.nodes) {
    if (node.type !== 'Component Inputs') continue;
    for (const port of node.declaredPorts) if (port.plug === 'output') takenProps.add(port.name);
  }
  const result: OutputInterface = { props: [], failed: [], valuePorts: [], valueProps: [] };
  const seen = new Set<string>();
  for (const node of component.nodes) {
    if (node.type !== 'Component Outputs') continue;
    for (const port of node.declaredPorts) {
      if (port.plug !== 'input' || seen.has(port.name)) continue;
      seen.add(port.name);
      if (!/[A-Za-z0-9]/.test(port.name)) {
        result.failed.push({ port: port.name, reason: `output "${port.name}" has no identifier material for a prop name` });
        if (port.kind !== 'signal') result.valuePorts.push(port.name);
        continue;
      }
      const prop =
        port.kind === 'signal'
          ? /^on[A-Z][A-Za-z0-9_$]*$/.test(port.name)
            ? port.name
            : `on${pascalCase(port.name)}`
          : /^on[A-Z][A-Za-z0-9_$]*Changed$/.test(port.name)
            ? port.name
            : `on${pascalCase(port.name)}Changed`;
      if (takenProps.has(prop)) {
        result.failed.push({
          port: port.name,
          reason: `output "${port.name}" would collide with prop "${prop}" — rename the port`
        });
        if (port.kind !== 'signal') result.valuePorts.push(port.name);
        continue;
      }
      takenProps.add(prop);
      if (port.kind === 'signal') {
        result.props.push({ port: port.name, prop });
      } else {
        result.valuePorts.push(port.name);
        result.valueProps.push({ port: port.name, prop, tsType: valueTsTypeOf(port.type) });
      }
    }
  }
  return result;
}

/** A lifted value port's payload type: the declared type when authored, `any` otherwise (§10). */
function valueTsTypeOf(portType: string | undefined): string {
  switch (portType) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    default:
      return 'any';
  }
}

function setterNameOf(name: string): string {
  return `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** Every identifier a plan already claims at module/component scope — the one-space rule. */
function takenNamesOf(plan: ComponentPlan): Set<string> {
  const taken = new Set<string>(['Inputs', 'Outputs', 'event', 'navigate', 'payload', 'styles']);
  plan.props.forEach((p) => taken.add(p.name));
  plan.outputProps.forEach((o) => taken.add(o.prop));
  plan.liftedOutputProps.forEach((l) => taken.add(l.prop));
  if (plan.file) taken.add(plan.file.symbol);
  for (const def of Object.values(plan.jsFunctions)) taken.add(def.fnName);
  for (const v of plan.stateVars) {
    taken.add(v.name);
    taken.add(v.setterName);
  }
  plan.queries.forEach((q) =>
    [q.stateName, q.setterName, q.itemName, q.fetchName, q.typeName].forEach((n) => taken.add(n))
  );
  return taken;
}

/**
 * Can a value land on this sink port, and if not, why — phrased to complete
 * `custom node output "x" …`.
 *
 * The built-in half is `CONTENT_PARAMS`'s, unchanged: a value binds where the emitter renders one
 * (`children`, an `attr:`) or into a truthiness port. The custom half is new and answers from the
 * *kit's own definition*, because a kit port's bindability is a fact about the kit — an input the
 * definition declares is a prop the wrapper passes, and one it does not declare is a wire the
 * running app already drops.
 */
function customSinkIsBindable(
  toNode: NodeIR,
  toProperty: string,
  toRole: RenderRole | undefined,
  kits: KitIndex
): true | string {
  if (toRole === 'custom') {
    const def = kits.get(toNode.type)?.def;
    if (def && def.inputs.some((i) => i.name === toProperty)) return true;
    return `feeds ${toNode.type}.${toProperty}, which the kit declares no input port for — the running app delivers nothing there either`;
  }
  if (toProperty === 'visible' || toProperty === 'mounted') return true;
  const contentRole = (CONTENT_PARAMS[toNode.type] ?? {})[toProperty];
  if (contentRole === 'children' || contentRole === 'attr-not:disabled') return true;
  if (contentRole !== undefined && contentRole.startsWith('attr:')) return true;
  return `feeds ${toNode.type}.${toProperty}, which has no static binding in this slice`;
}

/**
 * Does either end of this wire name a kit port the kit does not declare? If so, say which.
 *
 * 🔴 **This is a statement about the *running app*, not about the export.** A port a kit's
 * definition does not carry is one the runtime never delivers: the wire is in `connections.json`,
 * the editor may still draw it, and nothing arrives. Reporting it as "not translated yet" would
 * send an author waiting for a slice that will never make it work.
 */
function undeclaredKitPortOf(
  connection: ConnectionIR,
  nodeById: Map<string, NodeIR>,
  kits: KitIndex
): string | null {
  const fromDef = kits.get(nodeById.get(connection.fromId)?.type ?? '')?.def;
  if (fromDef && !fromDef.outputs.some((o) => o.name === connection.fromProperty)) {
    return `${fromDef.type} declares no output "${connection.fromProperty}" — the kit's definition has no such port, so the running app delivers nothing through this wire either`;
  }
  const toDef = kits.get(nodeById.get(connection.toId)?.type ?? '')?.def;
  if (toDef && !toDef.inputs.some((i) => i.name === connection.toProperty)) {
    return `${toDef.type} declares no input "${connection.toProperty}" — the kit's definition has no such port, so the running app delivers nothing through this wire either`;
  }
  return null;
}

/** node type → the kit node that registers it, and which module folder that kit is. */
export type KitIndex = Map<string, { moduleDir: string; def: KitNodeIR }>;

/**
 * Every node type the project's kits register (EXP-010).
 *
 * ⚠️ **First registration wins, and a duplicate is not silently discarded** — the running app has
 * the same collision (`registerModule` refuses the second) so the export must agree with it rather
 * than pick the later one and render a different node than the app does. The caller reports it.
 */
export function indexKitNodes(modules: ModuleIR[]): { index: KitIndex; duplicates: string[] } {
  const index: KitIndex = new Map();
  const duplicates: string[] = [];
  for (const module of modules) {
    for (const def of module.nodes) {
      if (index.has(def.type)) {
        duplicates.push(`${def.type} (${module.displayName})`);
        continue;
      }
      index.set(def.type, { moduleDir: module.dirName, def });
    }
  }
  return { index, duplicates };
}

function renderRole(node: NodeIR, catalog: CatalogIndex, kits: KitIndex): RenderRole | 'unsupported' | null {
  if (node.type.startsWith('/')) return 'instance';
  // EXP-010. Checked before the switch so a kit can never shadow a built-in: `registerModule`
  // refuses a node type the library already has, and an export that let one through would emit a
  // different app than the one the author is looking at.
  const kit = kits.get(node.type);
  if (kit !== undefined && catalog.get(node.type) === undefined) {
    // A logic node from a kit (`nodes:` rather than `reactNodes:`) has no React component to
    // render. It is not "unsupported" — it draws nothing in the running app either — so it takes
    // the same null a Variable takes, and the sweep at the bottom of planComponent names it.
    return kit.def.visual ? 'custom' : null;
  }
  switch (node.type) {
    case 'Group':
      return 'group';
    case 'Text':
    case 'Label':
      return 'text';
    case 'Image':
      return 'image';
    case 'net.noodl.controls.button':
    case 'Button':
      return 'button';
    case 'net.noodl.controls.textinput':
    case 'Text Input':
      return 'input';
    case 'net.noodl.visual.columns':
      return 'columns';
    case 'net.noodl.visual.icon':
      return 'icon';
    case 'net.noodl.controls.checkbox':
    case 'Checkbox':
      return 'checkbox';
    case 'net.noodl.controls.radiobutton':
    case 'Radio Button':
      return 'radio';
    case 'Radio Button Group':
      return 'radiogroup';
    case 'net.noodl.controls.range':
    case 'Range':
      return 'range';
    case 'net.noodl.controls.options':
    case 'Options':
      return 'select';
    case 'Video':
      return 'video';
    case 'Circle':
      return 'circle';
    case 'Page':
      return 'page';
    case 'For Each':
      return 'repeater';
    case 'Router':
      return null;
    default:
      return catalog.isVisual(node.type) ? 'unsupported' : null;
  }
}

/**
 * Ports whose value shapes the emitted *structure* (tracks, options, marks, initial state) —
 * a wire into one means the node's static translation would lie, so the node defers whole
 * (VISUALS-TARGET). Ports that merely carry content (src, label text) stay bindable.
 */
const STRUCTURE_PORTS: Partial<Record<RenderRole, string[]>> = {
  columns: [
    'layoutString',
    'sizing',
    'packing',
    'direction',
    'minWidth',
    'marginX',
    'marginY',
    'justifyContent',
    'mediumBreakpoint',
    'mediumLayout',
    'smallBreakpoint',
    'smallLayout'
  ],
  icon: ['iconSourceType', 'iconIconSource', 'iconImageSource'],
  // A wired `checked`/`value` no longer defers the control whole: it is the controlled-state
  // slice's local-state + sync-effect shape (CONTROLLED-STATE-TARGET §4c). The ports that
  // stay here still shape structure a static render cannot follow (tracks, options, marks).
  //
  // `useLabel`/`useIcon` decide whether the `<label>` wrapper and the mark exist at all
  // (Checkbox.tsx:70,170); a radio's `value` and a group's `value` decide which child prints
  // `defaultChecked` (component.ts:1343,1373). Those are structure. `label`, `min`, `max` and
  // `step` are NOT — see CONTENT_BOUND_PORTS below.
  checkbox: ['useLabel', 'useIcon'],
  radio: ['useLabel', 'useIcon', 'value'],
  radiogroup: ['value'],
  select: ['items', 'placeholder', 'useLabel'],
  circle: [
    'size',
    'fillEnabled',
    'fillColor',
    'strokeEnabled',
    'strokeWidth',
    'strokeColor',
    'strokeLineCap',
    'startAngle',
    'endAngle'
  ]
};

/**
 * Ports that carry *content* into a control — text, bounds, increments. A wire into one does
 * not move the rendered structure: `label` is the single text child of `<label>`
 * (Checkbox.tsx:191, RadioButton.tsx:200) and `min`/`max`/`step` are plain attributes the
 * emitter already orders (CONTENT_ATTR_ORDER), with nothing in the emitted CSS derived from
 * them (style.ts's `range` rule reads `thumbColor` and `width` only).
 *
 * They still defer, because omitting an unknown bound renders a 0–100 slider where the running
 * app renders the row's — wrong output, confidently emitted. But the wall is the *source*, not
 * the port, and every one of them in the corpus resolves to one of the two walls already on the
 * list: a `Model2` row property, or a component-record property only a runtime script writes.
 * Naming the source is what lets the census group them there instead of inventing a third wall
 * (RECORD-VERBS §19).
 */
const CONTENT_BOUND_PORTS: Partial<Record<RenderRole, string[]>> = {
  checkbox: ['label'],
  radio: ['label'],
  range: ['min', 'max', 'step']
};

/**
 * Why a node of a supported visual type still cannot render statically, or null when it can.
 * The checks mirror the target doc's defers: JS-measured layouts, wire-fed structure, custom
 * control marks, and the inline icon kind.
 */
function visualDeferReason(
  node: NodeIR,
  role: RenderRole,
  wiredIn: ReadonlyMap<string, string>,
  catalog: CatalogIndex
): string | null {
  const wired = (STRUCTURE_PORTS[role] ?? []).find((port) => wiredIn.has(`${node.id}:${port}`));
  if (wired !== undefined) return `its ${wired} arrives over a wire, so the rendered structure is not static`;
  const contentPort = (CONTENT_BOUND_PORTS[role] ?? []).find((port) => wiredIn.has(`${node.id}:${port}`));
  if (contentPort !== undefined) {
    return `its ${contentPort} is fed by ${wiredIn.get(`${node.id}:${contentPort}`)} — the structure renders, the value is not statically known`;
  }
  const literal = (name: string) => {
    const value = node.parameters.find((p) => p.name === name)?.value;
    return value?.kind === 'literal' ? value.value : undefined;
  };
  if (role === 'columns') {
    if (literal('packing') === 'masonry') return 'masonry packing is measured at runtime — not translated in this slice';
    if (literal('direction') === 'column') return 'vertical layout direction is not translated in this slice';
  }
  if (role === 'icon' && iconSourceOf(node, catalog).kind === 'inline') {
    return 'inline SVG icon sources pass a sanitizer at render time — not translated in this slice';
  }
  if (role === 'checkbox' || role === 'radio') {
    const customMark = node.parameters.some((p) => p.name === 'iconIconSource' || p.name === 'iconImageSource');
    if (customMark) return 'a custom mark icon on a control is not translated in this slice';
  }
  if (role === 'select' && literal('useLabel') === true) {
    return 'a labelled dropdown is not translated in this slice';
  }
  return null;
}

/**
 * The record-neighbour verdicts (RECORD-VERBS-TARGET §17) — the named reason a node in the
 * record family's graph defers with, instead of the catch-all `logic node (…)`.
 *
 * Four types sit in that graph without being fired from a handler chain the popup or record-verb
 * sweeps walk: the two relation verbs, the `Record` node, and — because it is the corpus's only
 * feeder for a `Record`'s Id — `PageInputs`.
 *
 * 🔴 The relation gates are ordered as the runtime's `validateInputs` orders them, which is the
 * order the author meets them. The first one the corpus reaches is the second: its only Add
 * Record Relation names **no relation property**, so `validateInputs` answers *"No relation
 * property specified"*, `setError` fires and the backend is never called — the node fails on
 * every pulse, for the life of the graph. Translating it into a working `addRelation` call would
 * be a hole shaped exactly like the defect, which is gate 1's rule (§5.1) reaching a second node
 * type rather than a new rule of its own.
 *
 * Module-level, and taking `resolveIdFeeder` as a parameter, for one reason: a component with no
 * visual root dispositions every node and **returns before** the sweep runs, so a relation verb
 * there used to fall to the catch-all anyway — a hole the sweep's own mutation check found. That
 * path has no expression vocabulary to hand, and passing `null` says so honestly: in a component
 * that translates nothing, a wired Id has no statically known source by construction.
 */
function recordNeighbourDefer(
  node: NodeIR,
  component: ComponentIR,
  nodeById: Map<string, NodeIR>,
  isRoutedPage: boolean,
  resolveIdFeeder: ((fromNode: NodeIR | undefined, fromProperty: string) => string | null) | null
): string | undefined {
  const wiredIn = (name: string) => component.connections.some((c) => c.toId === node.id && c.toProperty === name);
  const authoredOrWired = (name: string) => node.parameters.some((p) => p.name === name) || wiredIn(name);

  if (RELATION_VERBS[node.type] !== undefined) {
    if (!authoredOrWired('collectionName')) {
      return 'no class is named, so the runtime answers Failure with "No class specified" and never calls the backend';
    }
    if (!authoredOrWired('relationProperty')) {
      return 'no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend';
    }
    const targetWire = component.connections.find((c) => c.toId === node.id && c.toProperty === 'targetId');
    if (targetWire === undefined) {
      return 'no Target Record Id is wired, so the runtime answers Failure with "No target record Id ... specified" and never calls the backend';
    }
    if (!authoredOrWired('modelId')) {
      return 'it names no record to put the relation on, so the runtime answers Failure with "No record Id specified" and never calls the backend';
    }
    const targetSource = nodeById.get(targetWire.fromId);
    if (targetSource === undefined || !LOADED_RECORD_SOURCES.has(targetSource.type)) {
      return `its Target Record Id comes from ${targetSource?.type ?? 'nothing'} rather than a Record or Query Records output, so the target's class is unknown and the runtime refuses the write`;
    }
    return 'a relation write has no shape in the api stub — RECORD-VERBS-TARGET §4c designs it, and the corpus holds no well-formed instance to build it against';
  }

  if (node.type === 'DbModel2') {
    const collectionName = literalParam(node, 'collectionName');
    if (typeof collectionName !== 'string' || collectionName === '') {
      return 'no class is named, so the node has no collection to read a record from';
    }
    if (literalParam(node, 'idSource') === 'foreach' || authoredOrWired('repeaterComponent')) {
      return "its Id Source is the enclosing repeater's row — row identity is not statically knowable in this slice";
    }
    const idWires = component.connections.filter((c) => c.toId === node.id && c.toProperty === 'modelId');
    if (idWires.length > 1) return 'two wires feed its Id — last-writer-wins is not statically ordered';
    if (idWires.length === 0) {
      const literal = literalParam(node, 'modelId');
      if (typeof literal !== 'string' || literal === '') {
        return 'it names no record, so the runtime binds to nothing and never reads one';
      }
    } else {
      const source = nodeById.get(idWires[0].fromId);
      const unresolved = resolveIdFeeder
        ? resolveIdFeeder(source, idWires[0].fromProperty)
        : `its Id is fed by ${source?.type ?? 'nothing'}, which has no statically known source`;
      if (unresolved !== null) return unresolved;
    }
    return 'a single-record read by Id has no shape in the api stub — a collection query is the only read this slice emits';
  }

  if (node.type === 'PageInputs') {
    const declared = literalParam(node, 'pathParams');
    if (typeof declared === 'string' && declared !== '' && !isRoutedPage) {
      return `it reads the path parameters "${declared}", but no Router routes this component, so there is no URL to read them from`;
    }
    return 'a page path parameter is not translated in this slice';
  }

  /**
   * EXP-011 Tier 1.1's four deliberate deferrals.
   *
   * 🔴 Each names the *mechanism* that blocks it, not "not translated in this slice". Three of
   * the four are blocked by something outside themselves, and saying so is the difference
   * between a decision and a to-do: an author reading "Remove Object From Array is not
   * supported" goes looking for a missing feature, while one reading that a repeater's row
   * cannot reach the page knows what shape of app to build instead — and knows which other slice
   * would unblock it.
   */
  if (node.type === 'CollectionNew') {
    return 'it mints an array with a generated Id, and the only thing that Id can feed is another node’s Array Id — which, being a wire rather than a literal name, is exactly what has no emitted module';
  }
  if (node.type === 'CollectionRemove') {
    return 'it needs an Object Id, and in a list an author actually builds that comes from inside the repeater row — which cannot reach the page at all yet ("which row fired is not statically expressible")';
  }
  if (node.type === 'SetModelProperties') {
    return 'it writes properties onto a record; a row written from inside the row is state the list owns, which is the collection-state slice rather than this one (EXP-002-MODEL2-TARGET-OUTPUT §4)';
  }
  if (node.type === 'For Each Actions') {
    return 'its Item Id is the runtime record id of a repeater row, which the emitted app has no counterpart for, and its other ports are the Repeater’s removal handshake — lifecycle signals, which are effect() work';
  }

  return undefined;
}

function dispositionForLogic(node: NodeIR, kits: KitIndex): Disposition {
  // 🔴 EXP-010. A kit node's `catalogRef` is null by construction — there is no catalog entry for a
  // node type a project's own `noodl_modules` registered — so before this the whole custom-node
  // vocabulary landed on `type X is not in the catalog`, which reads as "we do not know what this
  // is". We do know: the kit said. The distinction that matters is between a node this export
  // renders and one it does not, and for a kit logic node the answer is a fact about the export's
  // scope rather than about the node.
  const kit = kits.get(node.type);
  if (kit !== undefined) {
    return {
      kind: 'deferred',
      to: 'EXP-003',
      reason: kit.def.visual
        ? `custom visual node (${node.type}) that nothing in this component's render tree reaches`
        : `custom logic node (${node.type}) from the kit in noodl_modules/${kit.moduleDir} — this export renders a kit's visual nodes and does not run its logic nodes`
    };
  }
  if (node.type === '' || (node.catalogRef === null && !node.type.startsWith('/'))) {
    return { kind: 'unknown-type', reason: node.type === '' ? 'node has no type (editor debris)' : `type ${node.type} is not in the catalog` };
  }
  return { kind: 'deferred', to: 'EXP-003', reason: `logic node (${node.type})` };
}

function literalParam(node: NodeIR, name: string): string | number | boolean | undefined {
  const value = node.parameters.find((p) => p.name === name)?.value;
  return value?.kind === 'literal' ? value.value : undefined;
}

/**
 * Parses a For Each mapping script as far as "is this a static object literal of
 * string→string" (TARGET-OUTPUT §2). Anything cleverer returns null and defers to EXP-003.
 */
export function parseIdentityMapping(script: string): Array<{ input: string; field: string }> | null {
  const withoutComments = script.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = withoutComments.match(/^\s*map\(\{([\s\S]*)\}\)\s*$/);
  if (!match) return null;
  const body = match[1];
  const entries: Array<{ input: string; field: string }> = [];
  /**
   * The key may be quoted or a bare identifier; the value must be a **string**.
   *
   * ⚠️ The bare-identifier alternative is EXP-011 Tier 1.1's addition, and it is not cosmetic:
   * `Array Map`'s own declared default script (`mapcollectionnode.ts`) writes
   * `myOutputProp: 'inputProp'` unquoted, so a quoted-only parser answers null for the shape the
   * editor puts in front of every author. `For Each`'s mapping script goes through the same
   * function and gains the same shape — a widening, since an unquoted script deferred before.
   *
   * A **function**-valued mapping stays unparseable on purpose: it is arbitrary JavaScript over
   * a live `Model`, which is EXP-003's, and the leftover check below is what refuses it.
   */
  const entryPattern = /(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))\s*:\s*['"]([^'"]+)['"]\s*,?/g;
  let entry: RegExpExecArray | null;
  while ((entry = entryPattern.exec(body)) !== null) {
    entries.push({ input: entry[1] ?? entry[2], field: entry[3] });
  }
  // Static only if the entries account for the whole body — a function value, computed key or
  // trailing expression means the script does real work.
  const leftover = body.replace(entryPattern, '').trim();
  if (leftover.length > 0) return null;
  return entries;
}

/**
 * §15 — a component prop's type is what the port *declares*, and `any` when it declares nothing.
 *
 * A port type is **free text** (`AiAssistant/authoring/plan.ts`: *"names are what bind"*), so
 * there is no closed vocabulary to fall through to a default with. The editor's own PortEditor
 * panel opens a new Component Inputs port as `type: { name: '*' }` (`componentinputs.ts`), and
 * `*` is normatively the untyped wildcard — the Port Type Contract describes "an untyped Function
 * output defaulted to `*` and connected anywhere". It is two thirds of the corpus's component
 * ports (471 of 714).
 *
 * Mapping that to `string` was the emitter claiming a type the graph refused to make, and it is
 * the same disagreement §12 refused in the other direction: the declared type is a claim about
 * the port, not a check on what reaches it. Nothing coerces on delivery — `componentinputs.ts`
 * registers each output as a bare getter over `_internal.inputValues`, and the one cast on a
 * connection (`node.ts` `_setValueFromConnection`) is `object`/`array` → `string` only.
 *
 * `any` rather than `unknown` for the reason the `array` case already gives, and the reason the
 * two sibling mappers in this file — `jsOutputTsType` and `valueTsTypeOf` — both already default
 * to `any`: strict tsc rejects an `unknown` read at the sites that consume these values.
 *
 * ⚠️ `string` must stay an explicit case. It is 224 ports, and it reached its type through the
 * old default — folding it into this one would widen every genuinely-typed prop in the corpus.
 */
function tsTypeOf(portType: string | undefined, kind: 'value' | 'signal'): string {
  if (kind === 'signal') return '() => void';
  switch (portType) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    // Fields read off an untyped list must be `any` — strict tsc rejects them under unknown
    // (the §10 ruling); the list itself is the §4e repeater feed.
    case 'array':
      return 'any[]';
    default:
      return 'any';
  }
}

function pluralize(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/**
 * The api module's names for one class, a pure function of the class name (RECORD-VERBS-TARGET
 * §4d). Queries and mutations both derive from this, so a project that reads *and* writes one
 * collection lands both in a single module rather than two that disagree about the type name.
 */
export function collectionModuleNames(collectionName: string): {
  typeName: string;
  plural: string;
  moduleBase: string;
  fetchName: string;
} {
  const typeName = pascalCase(collectionName);
  const plural = pluralize(typeName.charAt(0).toLowerCase() + typeName.slice(1));
  return {
    typeName,
    plural,
    moduleBase: plural.toLowerCase(),
    fetchName: `fetch${plural.charAt(0).toUpperCase()}${plural.slice(1)}`
  };
}

function lastSegment(componentPath: string): string {
  const segments = componentPath.split('/');
  return segments[segments.length - 1];
}

function dedupe(base: string, used: Set<string>): string {
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) candidate = `${base}${counter++}`;
  used.add(candidate);
  return candidate;
}
