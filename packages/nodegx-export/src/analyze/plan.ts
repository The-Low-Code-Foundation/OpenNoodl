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
import { StyleRole } from '../emit/style';
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
 */
export type ValueExpr =
  | { kind: 'prop'; name: string }
  | { kind: 'input-text'; inputId: string }
  | { kind: 'store-get'; variableName: string }
  | { kind: 'store-key-get'; storeName: string; key: string }
  | { kind: 'payload'; key: string; receiverId: string }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'format'; parts: Array<string | ValueExpr> };

export type HandlerAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'emit'; channelName: string; payload: Array<{ key: string; expr: ValueExpr }> }
  | { kind: 'store-set'; variableName: string; expr: ValueExpr }
  | { kind: 'globalstore-set'; storeName: string; key: string; expr: ValueExpr }
  | { kind: 'collection-add'; collectionName: string; entries: Array<{ key: string; expr: ValueExpr }> }
  /** A Condition in a handler chain: `if (cond) whenTrue; else whenFalse;` (LOGIC-TARGET §3). */
  | { kind: 'branch'; cond: ValueExpr; whenTrue: HandlerAction[]; whenFalse: HandlerAction[] };

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
    childrenOf: {},
    roleOf: {},
    bindings: {},
    handlers: {},
    changeHandlers: {},
    receivers: [],
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

  const roleOf = (node: NodeIR): RenderRole | 'unsupported' | null => renderRole(node, catalog);

  // Visual roots: parentless nodes that render. Order is source order (D2), which matches the
  // file's visualRoots in every observed project.
  const roots = component.nodes.filter((n) => n.parent === undefined && roleOf(n) !== null && roleOf(n) !== 'unsupported');
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

  // Walk the visual tree: roles, render children, the page collapse.
  const walk = (node: NodeIR) => {
    const role = roleOf(node);
    if (role === null || role === 'unsupported') return;
    rendered.add(node.id);
    plan.roleOf[node.id] = role;
    dispositions[node.id] = { kind: 'static' };
    const children = (node.children ?? [])
      .map((id) => nodeById.get(id))
      .filter((c): c is NodeIR => c !== undefined);
    plan.childrenOf[node.id] = [];
    for (const child of children) {
      const childRole = roleOf(child);
      if (childRole === null || childRole === 'unsupported') {
        dispositions[child.id] = {
          kind: 'deferred',
          to: 'EXP-003',
          reason: `visual child of ${node.id} with no deterministic generator (${child.type || 'untyped'})`
        };
        notes.push(`node ${child.id} (${child.type || 'untyped'}) is in the visual tree but has no generator yet`);
        continue;
      }
      plan.childrenOf[node.id].push(child.id);
      walk(child);
    }
  };
  walk(root);

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

  const resolveExpr = (fromNode: NodeIR | undefined, fromProperty: string, ctx: ResolveCtx): ValueExpr | null => {
    if (!fromNode) return null;
    if (fromNode.type === 'Component Inputs') return { kind: 'prop', name: fromProperty };
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
    return null;
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

  const compileSink = (node: NodeIR): CompiledSink => {
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
        if (!target || TRIGGER_PORTS[target.type] !== wire.toProperty) {
          return { defer: `its ${port} wire drives no translatable action` };
        }
        if (target.type === 'Condition') {
          return { defer: `its ${port} arm drives another Condition — nesting is not translated in this slice` };
        }
        const compiled = compiledOf(target);
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

  const compiledSinks = new Map<string, CompiledSink>();
  const compiledOf = (node: NodeIR): CompiledSink => {
    const cached = compiledSinks.get(node.id);
    if (cached !== undefined) return cached;
    const result = compileSink(node);
    compiledSinks.set(node.id, result);
    return result;
  };
  for (const node of component.nodes) {
    if (TRIGGER_PORTS[node.type] !== undefined) compiledOf(node);
  }

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
      case 'navigate':
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
        return true;
      case 'format':
        return expr.parts.every((p) => typeof p === 'string' || exprValidIn(p, context));
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

  // Pass 2: attach compiled actions to handler owners, trigger wires in source order. A wire
  // from a Condition's arm into a trigger port is chain-internal: the branch consumes it when
  // it attaches, and the Condition sweep reports it when it does not.
  const receiverActions = new Map<string, HandlerAction[]>();
  const boundSubscribers = new Set<string>();
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode || TRIGGER_PORTS[toNode.type] !== connection.toProperty) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (fromNode?.type === 'Condition' && (connection.fromProperty === 'ontrue' || connection.fromProperty === 'onfalse')) {
      continue;
    }
    consumed.add(connection.key);
    const compiled = compiledSinks.get(toNode.id)!;
    if ('defer' in compiled) {
      dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: compiled.defer };
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
        dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: 'the action reads values that only exist in another handler' };
        notes.push(`wire ${connection.key} dropped: the action reads values that only exist in another handler`);
        continue;
      }
      const list = (plan.changeHandlers[fromNode.id] = plan.changeHandlers[fromNode.id] ?? []);
      list.push(compiled.action);
      dispositions[toNode.id] = { kind: 'collapsed', into: fromNode.id };
      for (const id of compiled.collapses ?? []) dispositions[id] = { kind: 'collapsed', into: fromNode.id };
      for (const key of compiled.consumes) consumed.add(key);
      for (const id of compiled.subscribes ?? []) boundSubscribers.add(id);
      continue;
    }
    if (fromNode && rendered.has(fromNode.id) && connection.kind === 'signal') {
      if (!actionExprs(compiled.action).every((e) => exprValidIn(e, { kind: 'dom', nodeId: fromNode.id }))) {
        dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: 'the action reads values that only exist in another handler' };
        notes.push(`wire ${connection.key} dropped: the action reads values that only exist in another handler`);
        continue;
      }
      plan.handlers[fromNode.id] = plan.handlers[fromNode.id] ?? {};
      const list = (plan.handlers[fromNode.id][connection.fromProperty] =
        plan.handlers[fromNode.id][connection.fromProperty] ?? []);
      list.push(compiled.action);
      dispositions[toNode.id] = { kind: 'collapsed', into: fromNode.id };
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
        dispositions[toNode.id] = { kind: 'deferred', to: 'EXP-003', reason: 'the action reads values that only exist in another handler' };
        notes.push(`wire ${connection.key} dropped: the action reads values that only exist in another handler`);
        continue;
      }
      receiverActions.set(fromNode.id, [...(receiverActions.get(fromNode.id) ?? []), compiled.action]);
      dispositions[toNode.id] = { kind: 'collapsed', into: fromNode.id };
      for (const id of compiled.collapses ?? []) dispositions[id] = { kind: 'collapsed', into: fromNode.id };
      for (const key of compiled.consumes) consumed.add(key);
      for (const id of compiled.subscribes ?? []) boundSubscribers.add(id);
      continue;
    }
    dispositions[toNode.id] = {
      kind: 'deferred',
      to: 'EXP-003',
      reason: `trigger ${connection.fromId}.${connection.fromProperty} is not a rendered element event or a receiver`
    };
    notes.push(`wire ${connection.key} dropped: the trigger is not a rendered element event or a receiver`);
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

  // Pass 4c: a String Format's output into a rendered sink becomes a computed binding — the
  // expression tree rendered inline at the sink, its hooks earned exactly as direct bindings
  // earn them (LOGIC-TARGET §2). The whole tree's wires are consumed together; a tree that
  // fails to resolve defers whole, never as a half-filled literal.
  for (const connection of component.connections) {
    if (consumed.has(connection.key)) continue;
    const fromNode = nodeById.get(connection.fromId);
    if (fromNode?.type !== 'String Format' || connection.fromProperty !== 'formatted') continue;
    const toNode = nodeById.get(connection.toId);
    if (!toNode || !rendered.has(toNode.id)) continue; // leave for the catch-all
    consumed.add(connection.key);
    const ctx = newCtx();
    const expr = resolveExpr(fromNode, 'formatted', ctx);
    if (expr === null) {
      notes.push(`wire ${connection.key} dropped: ${ctx.defer ?? 'the format has no statically known source'}`);
      continue;
    }
    if (!exprValidIn(expr, { kind: 'render' })) {
      notes.push(`wire ${connection.key} dropped: the format reads values that only exist inside a handler`);
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
      const compiled = compiledSinks.get(node.id);
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
