/**
 * Component analysis — EXP-002 step 4's decision stage. Parsing recorded what the project says;
 * this walks each component's visual tree and decides what the generator will do about it:
 * which nodes render (and as what), which collapse, which become stubs, and which defer to
 * EXP-003. Dispositions are analysis output about the graph, never facts of it (IR design).
 *
 * Everything here is pure decision-making over the IR; no text is generated. The emit layer
 * (emit/component.ts) turns a ComponentPlan into TSX/CSS.
 */

import { CatalogIndex } from '../catalog';
import { ComponentIR, Disposition, ExportIR, NodeIR } from '../ir/types';
import { routedPages } from '../emit/scaffold';
import { pascalCase } from '../emit/naming';
import { StyleRole } from '../emit/style';

/** How a node participates in the render, or null for pure logic nodes. */
export type RenderRole = StyleRole | 'instance' | 'repeater';

export type BindingSource =
  | { kind: 'prop'; name: string }
  | { kind: 'unresolved'; fromId: string; fromProperty: string };

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
  /**
   * The identity mapping parsed from the effective mapping script (authored parameter, else the
   * declared port's default — the fixture's trap). Null when the script is anything beyond a
   * static string→string `map({...})` literal; that repeater defers to EXP-003.
   */
  mapping: Array<{ input: string; field: string }> | null;
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
  /** nodeId → source port → navigation url, for signal wires resolved to RouterNavigate. */
  handlers: Record<string, Record<string, { navigateTo: string }>>;
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
}

export function planProject(ir: ExportIR, catalog: CatalogIndex): ProjectPlan {
  const pages = routedPages(ir);
  const urlPathByLegacy = new Map(pages.map((p) => [`/${p.componentPath}`, p.urlPath]));
  const pageFileByPath = new Map(pages.map((p) => [p.componentPath, { fileBase: p.fileBase, symbol: p.symbol }]));

  const usedPageNames = new Set(pages.map((p) => p.fileBase));
  const usedComponentNames = new Set<string>();

  const plans = ir.components.map((component) =>
    planComponent(component, ir, catalog, urlPathByLegacy, pageFileByPath, usedPageNames, usedComponentNames)
  );

  const byLegacyPath = new Map(plans.map((p) => [p.legacyPath, p]));
  const stubCollections: string[] = [];
  for (const plan of plans) {
    for (const query of plan.queries) {
      if (!stubCollections.includes(query.collectionName)) stubCollections.push(query.collectionName);
    }
  }
  return { plans, byLegacyPath, urlPathByLegacy, stubCollections };
}

function planComponent(
  component: ComponentIR,
  ir: ExportIR,
  catalog: CatalogIndex,
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
  // component is a page whatever its component.json says — the editor's home page
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
  const rendered = new Set<string>();
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
      mapping: script !== undefined ? parseIdentityMapping(script) : []
    };
  }

  // Wires. Value wires from Component Inputs become prop bindings; the query→repeater items
  // wire feeds the repeater; signal wires into RouterNavigate become navigate handlers.
  // Everything else is recorded, not guessed (EXP-003's territory).
  for (const connection of component.connections) {
    const fromNode = nodeById.get(connection.fromId);
    const toNode = nodeById.get(connection.toId);

    if (fromNode?.type === 'Component Inputs' && toNode && rendered.has(toNode.id)) {
      plan.bindings[toNode.id] = plan.bindings[toNode.id] ?? {};
      plan.bindings[toNode.id][connection.toProperty] = { kind: 'prop', name: connection.fromProperty };
      continue;
    }
    if (
      toNode?.type === 'For Each' &&
      connection.toProperty === 'items' &&
      fromNode?.type === 'DbCollection2' &&
      plan.repeaters[toNode.id]
    ) {
      plan.repeaters[toNode.id].itemsQueryId = fromNode.id;
      continue;
    }
    if (toNode?.type === 'RouterNavigate' && connection.toProperty === 'navigate') {
      const target = toNode ? literalParam(toNode, 'target') : undefined;
      const url = typeof target === 'string' ? urlPathByLegacy.get(target) : undefined;
      if (url !== undefined && fromNode && rendered.has(fromNode.id) && connection.kind === 'signal') {
        plan.handlers[fromNode.id] = plan.handlers[fromNode.id] ?? {};
        plan.handlers[fromNode.id][connection.fromProperty] = { navigateTo: url };
        dispositions[toNode.id] = { kind: 'collapsed', into: fromNode.id };
      } else {
        dispositions[toNode.id] = {
          kind: 'deferred',
          to: 'EXP-003',
          reason: `navigation target ${String(target)} is not a routed page or the trigger is not a rendered node`
        };
        notes.push(`wire ${connection.key} dropped: unresolvable navigation`);
      }
      continue;
    }
    notes.push(`wire ${connection.key} has no deterministic translation in step 4 (deferred to EXP-003)`);
  }

  // Queries: a DbCollection2 consumed by a rendered repeater becomes state + effect + typed
  // stub (TARGET-OUTPUT §2); anything else about it defers.
  const usedStateNames = new Set<string>();
  for (const node of component.nodes) {
    if (node.type !== 'DbCollection2') continue;
    const consumed = Object.values(plan.repeaters).some((r) => r.itemsQueryId === node.id);
    if (!consumed) {
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
