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

/**
 * FIX-023 — why a node object could not be normalised into a well-formed
 * `NormNode`, and the normaliser substituted a placeholder for the missing
 * field rather than propagating `undefined` into every rule.
 *
 * A list, not a single value, because the next such field (a missing `id`) has
 * the same shape of failure and should join this rather than grow a second
 * mechanism.
 */
export type MalformedNodeReason = 'missing-type';

/**
 * FIX-023 — what `NormNode.type` carries when the source node had none.
 *
 * Empty string, deliberately: it is a `string`, so `isComponentRef`,
 * `catalog.hasType` and every other consumer behave normally instead of
 * throwing; it is falsy, so a `if (!node.type)` guard anywhere downstream reads
 * correctly; and it can never collide with a real type name.
 */
export const MALFORMED_NODE_TYPE = '';

export interface NormNode {
  id: string;
  /**
   * Node type string exactly as authored (built-in name or component ref).
   *
   * FIX-023: guaranteed to be a `string` — the normalisers substitute
   * `MALFORMED_NODE_TYPE` and set `malformed` when the source node has none.
   * This declaration was previously a lie for such nodes, and because it is
   * `string` no `tsc` gate could see it.
   */
  type: string;
  /**
   * FIX-023 — set only when a required field was absent on the source node and
   * a placeholder stands in its place. Absent on every well-formed node, so a
   * rule reads `if (node.malformed)` and existing rules that do not care are
   * unaffected. The `malformed-node` rule owns reporting these.
   */
  malformed?: MalformedNodeReason[];
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
  /**
   * Node metadata, carried verbatim from the source.
   *
   * Added by LIB-006, and deliberately narrow in purpose: a legacy import writes
   * `metadata.legacyImport` onto every construct it could not convert, and the
   * `legacy-import-placeholder` rule keys off it. Without this field, that rule
   * cannot distinguish "the importer knows this could not be converted" (an
   * error the user must resolve) from "this type is not in the catalog right
   * now" (a warning, because a module may yet provide it) — and the two deserve
   * different severities.
   *
   * Rules should read specific keys, never enumerate it. Absent when the node
   * carries no metadata.
   */
  metadata?: Record<string, unknown>;
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

/**
 * True when a node type denotes a project component instance, not a library node.
 *
 * FIX-023 (fix C, defence in depth) — the parameter admits `undefined`/`null`
 * and returns `false` for them. It was `type: string`, which is why the
 * unguarded call sites type-checked while a typeless node on disk threw
 * `Cannot read properties of undefined (reading 'startsWith')` at runtime.
 *
 * ⚠️ This is the backstop, not the fix. Callers reading a **normalised** graph
 * are already safe (the normalisers substitute `MALFORMED_NODE_TYPE` and the
 * `malformed-node` rule reports it). This guard exists for the callers that
 * walk **raw v2 files** and never pass through normalisation —
 * `noodl-mcp`'s `planTools`, `read` and `describe` — where returning `false`
 * silently is the correct behaviour but says nothing. Do not treat a quiet
 * `false` here as the project being well-formed; that is what the rule is for.
 */
export function isComponentRef(type: string | undefined | null): boolean {
  if (typeof type !== 'string') return false;
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
