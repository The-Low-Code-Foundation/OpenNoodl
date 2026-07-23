/**
 * SUB-006 — Semantic Validator: normalized project model
 *
 * The validator runs over a single flat, catalog-agnostic shape regardless of
 * where the project came from — the editor's in-memory model, a legacy
 * monolithic project.json, or a v2 decomposed directory. Adapters (./normalize,
 * ./loadV2Project) convert each source into this model; the rules only ever see
 * this.
 *
 * @module noodl-editor/validation/model
 */

export interface NormNode {
  id: string;
  /** Node type string exactly as authored (built-in name or component ref). */
  type: string;
  label?: string;
  /** Parent node id, when this node sits inside another (visual hierarchy). */
  parent?: string;
  /** Child node ids. */
  children: string[];
  /**
   * Port names declared on the node *instance* (node.ports + node.dynamicports).
   * These are valid regardless of the catalog — component instances and dynamic
   * nodes serialise their live ports here.
   */
  instancePorts: string[];
}

export interface NormConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

export interface NormComponent {
  /** Component identifier — the legacy path/name, e.g. "/#Home" or "/Pages/About". */
  name: string;
  nodes: NormNode[];
  connections: NormConnection[];
}

export interface NormProject {
  components: NormComponent[];
  /**
   * Every string that can legally appear as a component-instance node type.
   * Contains both the legacy names (e.g. "/#Home") and their normalised paths
   * (e.g. "Home"), so a reference resolves whichever form it uses.
   */
  componentRefs: Set<string>;
}

/** True when a node type denotes a project component instance, not a library node. */
export function isComponentRef(type: string): boolean {
  return type.startsWith('/') || type.startsWith('#');
}

/**
 * Normalise a component identifier to its path form: strip a leading '/' and a
 * leading '#' (root-component marker). Mirrors ProjectExporter.legacyNameToPath
 * so component references resolve against v2 registry keys.
 */
export function refToPath(ref: string): string {
  let p = ref.startsWith('/') ? ref.slice(1) : ref;
  if (p.startsWith('#')) p = p.slice(1);
  return p;
}

/** Build the resolvable-reference set from a list of component identifiers. */
export function buildComponentRefs(componentNames: string[]): Set<string> {
  const set = new Set<string>();
  for (const name of componentNames) {
    set.add(name);
    set.add(refToPath(name));
  }
  return set;
}
