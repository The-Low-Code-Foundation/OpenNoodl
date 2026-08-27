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
  | { kind: 'undefined' };

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
  | { kind: 'popup-close'; action?: string; then: HandlerAction[] };

export interface ReceiverPlan {
  nodeId: string;
  channelName: string;
  /** Actions in trigger-wire source order — statement order in the useSignal handler. */
  actions: HandlerAction[];
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
  for (const port of outputInterface.valuePorts) {
    notes.push(
      `output "${port}" is a value output — a value output lifts state into the parent (the component-state slice), not translated here`
    );
  }
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
  type ResolveCtx = { consumes: string[]; logicNodeIds: string[]; subscriberIds: string[]; visited: Set<string>; defer?: string };
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

  const resolveExpr = (fromNode: NodeIR | undefined, fromProperty: string, ctx: ResolveCtx): ValueExpr | null => {
    if (!fromNode) return null;
    if (fromNode.type === 'Component Inputs') return { kind: 'prop', name: fromProperty };
    if (fromNode.type === COMPONENT_OBJECT && fromProperty.startsWith('value-')) {
      return componentObjectReadExpr(fromNode, fromProperty, ctx);
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
      case 'input-text':
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
    (type === 'NavigationClosePopup' && (toProperty === 'close' || toProperty.startsWith('closeAction-')));

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

  const compileSink = (node: NodeIR, port: string): CompiledSink => {
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
                ? `its ${port} arm fires value output "${wire.toProperty}" — lifted state belongs to the component-state slice`
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

  const actionExprs = (action: HandlerAction): ValueExpr[] => {
    switch (action.kind) {
      case 'emit':
        return action.payload.map((p) => p.expr);
      case 'collection-add':
        return action.entries.map((e) => e.expr);
      case 'store-set':
      case 'globalstore-set':
        return [action.expr];
      case 'branch':
        return [action.cond, ...action.whenTrue.flatMap(actionExprs), ...action.whenFalse.flatMap(actionExprs)];
      case 'popup-show':
      case 'popup-close':
        return action.then.flatMap(actionExprs);
      case 'navigate':
      case 'output-signal':
        return [];
    }
  };

  type ExprContext = { kind: 'dom'; nodeId: string } | { kind: 'receiver'; receiverId: string } | { kind: 'render' };

  const exprValidIn = (expr: ValueExpr, context: ExprContext): boolean => {
    switch (expr.kind) {
      case 'prop':
      case 'store-get':
      case 'store-key-get':
      case 'literal':
      case 'undefined':
        return true;
      case 'format':
        return expr.parts.every((p) => typeof p === 'string' || exprValidIn(p, context));
      case 'logical':
        return expr.operands.every((o) => exprValidIn(o, context));
      case 'not':
      case 'truthy':
        return exprValidIn(expr.operand, context);
      case 'input-text':
        return context.kind === 'dom' && context.nodeId === expr.inputId;
      case 'payload':
        return context.kind === 'receiver' && context.receiverId === expr.receiverId;
    }
  };

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
      return { defer: `output "${port}" is a value output — lifted state belongs to the component-state slice` };
    }
    const failedReason = failedOutputPorts.get(port);
    if (failedReason !== undefined) return { defer: failedReason };
    return { drop: `no Component Outputs declaration names port "${port}" — the runtime's hasOutput guard drops the write too` };
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
  const boundSubscribers = new Set<string>();
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
      if (!actionExprs(compiled.action).every((e) => exprValidIn(e, { kind: 'dom', nodeId: fromNode.id }))) {
        const reason = 'the action reads values that only exist in another handler';
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, reason);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason };
        }
        notes.push(`wire ${connection.key} dropped: ${reason}`);
        continue;
      }
      const list = (plan.changeHandlers[fromNode.id] = plan.changeHandlers[fromNode.id] ?? []);
      list.push(compiled.action);
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
      if (!actionExprs(compiled.action).every((e) => exprValidIn(e, { kind: 'dom', nodeId: fromNode.id }))) {
        const reason = 'the action reads values that only exist in another handler';
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, reason);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason };
        }
        notes.push(`wire ${connection.key} dropped: ${reason}`);
        continue;
      }
      plan.handlers[fromNode.id] = plan.handlers[fromNode.id] ?? {};
      const list = (plan.handlers[fromNode.id][connection.fromProperty] =
        plan.handlers[fromNode.id][connection.fromProperty] ?? []);
      list.push(compiled.action);
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
      if (!actionExprs(compiled.action).every((e) => exprValidIn(e, { kind: 'receiver', receiverId: fromNode.id }))) {
        const reason = 'the action reads values that only exist in another handler';
        if (outputsSink) {
          if (!failedOutputsNodes.has(toNode.id)) failedOutputsNodes.set(toNode.id, reason);
        } else {
          dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason };
        }
        notes.push(`wire ${connection.key} dropped: ${reason}`);
        continue;
      }
      receiverActions.set(fromNode.id, [...(receiverActions.get(fromNode.id) ?? []), compiled.action]);
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
    if (isBooleanExpr(expr) && !enabledSink) {
      notes.push(
        `wire ${connection.key} dropped: a logic truth value lands only in a truthiness sink (a control's enabled) in this slice`
      );
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
    const bindable =
      contentRole === 'children' || contentRole === 'attr-not:disabled' || (contentRole !== undefined && contentRole.startsWith('attr:'));
    if (!bindable) continue; // the sweep names the reason
    const ctx = newCtx();
    const expr = resolveExpr(fromNode, connection.fromProperty, ctx);
    if (expr === null) continue; // the sweep defers the node with this reason
    if (!exprValidIn(expr, { kind: 'render' })) continue;
    if (isBooleanExpr(expr) && contentRole !== 'attr-not:disabled') continue;
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
    if (fromNode?.type === 'Component Inputs' && toNode && rendered.has(toNode.id)) {
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
        if (coBoundReadKeys.has(read.key)) continue;
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
  /** Declared value-kind output ports — lifted state, the component-state slice's work. */
  valuePorts: string[];
}

export function componentOutputInterface(component: ComponentIR): OutputInterface {
  const takenProps = new Set<string>();
  for (const node of component.nodes) {
    if (node.type !== 'Component Inputs') continue;
    for (const port of node.declaredPorts) if (port.plug === 'output') takenProps.add(port.name);
  }
  const result: OutputInterface = { props: [], failed: [], valuePorts: [] };
  const seen = new Set<string>();
  for (const node of component.nodes) {
    if (node.type !== 'Component Outputs') continue;
    for (const port of node.declaredPorts) {
      if (port.plug !== 'input' || seen.has(port.name)) continue;
      seen.add(port.name);
      if (port.kind !== 'signal') {
        result.valuePorts.push(port.name);
        continue;
      }
      if (!/[A-Za-z0-9]/.test(port.name)) {
        result.failed.push({ port: port.name, reason: `output "${port.name}" has no identifier material for a prop name` });
        continue;
      }
      const prop = /^on[A-Z][A-Za-z0-9_$]*$/.test(port.name) ? port.name : `on${pascalCase(port.name)}`;
      if (takenProps.has(prop)) {
        result.failed.push({
          port: port.name,
          reason: `output "${port.name}" would collide with prop "${prop}" — rename the port`
        });
        continue;
      }
      takenProps.add(prop);
      result.props.push({ port: port.name, prop });
    }
  }
  return result;
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
  checkbox: ['checked', 'useLabel', 'useIcon', 'label'],
  radio: ['useLabel', 'useIcon', 'label', 'value'],
  radiogroup: ['value'],
  select: ['items', 'value', 'placeholder', 'useLabel'],
  range: ['value', 'min', 'max', 'step'],
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
