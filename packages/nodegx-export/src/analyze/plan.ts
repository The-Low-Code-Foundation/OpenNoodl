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
import { ComponentIR, Disposition, ExportIR, NodeIR } from '../ir/types';
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

/** How a node participates in the render, or null for pure logic nodes. */
export type RenderRole = StyleRole | 'instance' | 'repeater';

/** The per-component-instance record node (COMPONENT-OBJECT-TARGET; componentobject.ts). */
const COMPONENT_OBJECT = 'net.noodl.ComponentObject';

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
  | { kind: 'control-event'; controlId: string; form: 'string' | 'checked' | 'number' };

export type HandlerAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'emit'; channelName: string; payload: Array<{ key: string; expr: ValueExpr }> }
  | { kind: 'store-set'; variableName: string; expr: ValueExpr }
  | { kind: 'globalstore-set'; storeName: string; key: string; expr: ValueExpr }
  | { kind: 'collection-add'; collectionName: string; entries: Array<{ key: string; expr: ValueExpr }> }
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
  | { kind: 'state-set'; name: string; expr?: ValueExpr; op?: 'toggle' | 'inc' | 'dec' };

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
  origin: 'switch' | 'counter' | 'control' | 'lifted' | 'jsfun';
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
  coerce: 'checkbox' | 'slider' | 'dropdown' | 'textinput';
  /** Slider only: the literal clamp bounds (a wired min/max defers the node before this). */
  min?: number;
  max?: number;
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
   * Declared signal outputs as callback props (`onWaved?: () => void`), declaration order —
   * the parent side reads the same list off the target's plan (COMPONENT-OUTPUTS-TARGET §2).
   */
  outputProps: Array<{ port: string; prop: string }>;
  /** Render children per node, collapse applied, logic nodes filtered out. */
  childrenOf: Record<string, string[]>;
  roleOf: Record<string, RenderRole>;
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
}

export function planProject(ir: ExportIR, catalog: CatalogIndex): ProjectPlan {
  const pages = routedPages(ir);
  const urlPathByLegacy = new Map(pages.map((p) => [`/${p.componentPath}`, p.urlPath]));
  const pageFileByPath = new Map(pages.map((p) => [p.componentPath, { fileBase: p.fileBase, symbol: p.symbol }]));
  const registry = collectAppState(ir);

  const usedPageNames = new Set(pages.map((p) => p.fileBase));
  const usedComponentNames = new Set<string>();

  const plans = ir.components.map((component) =>
    planComponent(component, ir, catalog, registry, urlPathByLegacy, pageFileByPath, usedPageNames, usedComponentNames)
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
    collections: [...registry.collections.values()]
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
  usedComponentNames: Set<string>
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
    outputProps: [],
    childrenOf: {},
    roleOf: {},
    bindings: {},
    handlers: {},
    changeHandlers: {},
    receivers: [],
    popups: [],
    closesPopup: false,
    queries: [],
    repeaters: {},
    staticData: [],
    jsFunctions: {},
    stateVars: [],
    syncEffects: [],
    pushEffects: [],
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
  const wiredIn = new Set(component.connections.map((c) => `${c.toId}:${c.toProperty}`));
  const deferReasons = new Map<string, string>();
  const roleOf = (node: NodeIR): RenderRole | 'unsupported' | null => {
    const role = renderRole(node, catalog);
    if (role === null || role === 'unsupported' || role === 'instance' || role === 'repeater') return role;
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
  const roots = component.nodes.filter(
    (n) => n.parent === undefined && roleOf(n) !== null && roleOf(n) !== 'unsupported' && roleOf(n) !== 'radio'
  );
  const rendered = new Set<string>();
  if (roots.length === 0) {
    for (const node of component.nodes) {
      dispositions[node.id] = dispositionForLogic(node);
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
        continue;
      }
      plan.childrenOf[node.id].push(child.id);
      walk(child, childInGroup);
    }
  };
  walk(root, false);

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
      dispositions[groupId] = { kind: 'collapsed', into: root.id };
    }
  }

  // Props: every Component Inputs port is a typed optional prop, source order.
  for (const node of component.nodes) {
    if (node.type !== 'Component Inputs') continue;
    dispositions[node.id] = { kind: 'static' };
    for (const port of node.declaredPorts) {
      if (port.plug !== 'output') continue;
      plan.props.push({ name: port.name, tsType: tsTypeOf(port.type, port.kind) });
    }
  }

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
  const wiredPorts = new Set(component.connections.map((c) => `${c.toId}:${c.toProperty}`));

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
        for (const port of visualIo!.outputs) {
          if (signals.includes(port.name)) continue;
          outputs.push({ name: port.name, tsType: jsOutputTsType(port.type === '*' ? undefined : port.type) });
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

  const resolveExpr = (fromNode: NodeIR | undefined, fromProperty: string, ctx: ResolveCtx): ValueExpr | null => {
    if (!fromNode) return null;
    if (fromNode.type === 'Component Inputs') return { kind: 'prop', name: fromProperty };
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
      case 'undefined':
        return true;
      // An output the body might not write reads undefined, exactly like the runtime getter
      // (§4); the typed Expression folds never answer undefined. A materialized read is
      // undefined until the first invocation (CONTROLLED-STATE §4f).
      case 'jsfun-out':
        return expr.viaState !== undefined || expr.fold === undefined;
      case 'state-get':
        return expr.maybeUndefined === true;
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
    Condition: 'eval'
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
  const doneChainOf = (node: NodeIR): DoneChain | { defer: string } => {
    const then: HandlerAction[] = [];
    const consumes: string[] = [];
    const collapses: string[] = [];
    const subscribes: string[] = [];
    for (const wire of component.connections.filter((c) => c.fromId === node.id && c.fromProperty === 'done')) {
      if (wire.toId === node.id) return { defer: 'its done output drives itself' };
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
        return { defer: 'its done output drives no translatable action' };
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
      const role = renderRole(n, catalog);
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

  const compileSink = (node: NodeIR, port: string): CompiledSink => {
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
      return {
        defer: 'Condition re-tests on every change of its input (Run On Value Change is ticked) — only an Evaluate-only condition translates in this slice'
      };
    }
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
        return true;
      case 'format':
        return expr.parts.every((p) => typeof p === 'string' || exprValidIn(p, context, invokedScope));
      case 'logical':
        return expr.operands.every((o) => exprValidIn(o, context, invokedScope));
      case 'not':
      case 'truthy':
        return exprValidIn(expr.operand, context, invokedScope);
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
      case 'popup-show':
      case 'popup-close': {
        const then = snapActionList(action.then, snap);
        if (!Array.isArray(then)) return then;
        return { ...action, then };
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
    if (fromNode && rendered.has(fromNode.id) && (connection.kind === 'signal' || instanceSignal)) {
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
  {
    const attachedSlotKeys = new Set<string>();
    let closeAttached = false;
    const scanActions = (actions: HandlerAction[]) => {
      for (const action of actions) {
        if (action.kind === 'popup-show') {
          attachedSlotKeys.add(action.slotKey);
          scanActions(action.then);
        } else if (action.kind === 'popup-close') {
          closeAttached = true;
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
    if (!isLatchRead && !isControlRead && !isStaticCountRead) continue;
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

  // Pass 5: Component Inputs bindings and the query/array→repeater feeds (step 4's rules,
  // plus the Collection2 read side — COLLECTIONS-TARGET §2).
  const boundCollectionReaders = new Set<string>();
  const collectionReadEligible = (node: NodeIR): true | string => {
    if (component.connections.some((c) => c.toId === node.id)) {
      return 'the array node has wired inputs (seeding or fetch) — not translated in this slice';
    }
    const stray = component.connections.find(
      (c) =>
        c.fromId === node.id &&
        !(c.fromProperty === 'items' && c.toProperty === 'items' && nodeById.get(c.toId)?.type === 'For Each')
    );
    if (stray) return `its ${stray.fromProperty} output drives logic this slice does not translate`;
    return true;
  };
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

  // Pass 6: report every wire nothing translated.
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    notes.push(`wire ${connection.key} has no deterministic translation in step 5 (deferred to EXP-003)`);
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
      const reason =
        compiled !== undefined && 'defer' in compiled
          ? compiled.defer
          : 'no Evaluate wire attaches this condition to a handler';
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
    const typeName = pascalCase(collectionName);
    const plural = pluralize(typeName.charAt(0).toLowerCase() + typeName.slice(1));
    const stateName = dedupe(plural, usedStateNames);
    plan.queries.push({
      nodeId: node.id,
      collectionName,
      stateName,
      setterName: `set${stateName.charAt(0).toUpperCase()}${stateName.slice(1)}`,
      itemName: typeName.charAt(0).toLowerCase() + typeName.slice(1),
      fetchName: `fetch${plural.charAt(0).toUpperCase()}${plural.slice(1)}`,
      typeName,
      moduleBase: plural.toLowerCase()
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

  // Whatever analysis has not classified yet is logic: EXP-003's, or unknown-type debris.
  for (const node of component.nodes) {
    if (dispositions[node.id] === undefined) {
      dispositions[node.id] = dispositionForLogic(node);
      if (dispositions[node.id].kind === 'unknown-type') {
        notes.push(`node ${node.id} has no resolvable type — exported nowhere, reported here`);
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

function renderRole(node: NodeIR, catalog: CatalogIndex): RenderRole | 'unsupported' | null {
  if (node.type.startsWith('/')) return 'instance';
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
  checkbox: ['useLabel', 'useIcon', 'label'],
  radio: ['useLabel', 'useIcon', 'label', 'value'],
  radiogroup: ['value'],
  select: ['items', 'placeholder', 'useLabel'],
  range: ['min', 'max', 'step'],
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
 * Why a node of a supported visual type still cannot render statically, or null when it can.
 * The checks mirror the target doc's defers: JS-measured layouts, wire-fed structure, custom
 * control marks, and the inline icon kind.
 */
function visualDeferReason(node: NodeIR, role: RenderRole, wiredIn: Set<string>, catalog: CatalogIndex): string | null {
  const wired = (STRUCTURE_PORTS[role] ?? []).find((port) => wiredIn.has(`${node.id}:${port}`));
  if (wired !== undefined) return `its ${wired} arrives over a wire, so the rendered structure is not static`;
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

function dispositionForLogic(node: NodeIR): Disposition {
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
  const entryPattern = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]\s*,?/g;
  let consumed = '';
  let entry: RegExpExecArray | null;
  while ((entry = entryPattern.exec(body)) !== null) {
    entries.push({ input: entry[1], field: entry[2] });
    consumed += entry[0];
  }
  // Static only if the entries account for the whole body — a function value, computed key or
  // trailing expression means the script does real work.
  const leftover = body.replace(entryPattern, '').trim();
  if (leftover.length > 0) return null;
  return entries;
}

function tsTypeOf(portType: string | undefined, kind: 'value' | 'signal'): string {
  if (kind === 'signal') return '() => void';
  switch (portType) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    // Fields read off an untyped list must be `any` — strict tsc rejects them under unknown
    // (the §10 ruling); the list itself is the §4e repeater feed.
    case 'array':
      return 'any[]';
    default:
      return 'string';
  }
}

function pluralize(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
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
