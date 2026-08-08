/**
 * Enriched node-catalog access (SUB-004 structural + SUB-005 semantics).
 *
 * The enriched catalog is ~1.45 MB; no tool ever returns it whole. This module
 * provides the two projections the tool surface needs:
 *   - compact listing rows for discovery (list_node_types)
 *   - full per-type entries with semantics for named types (get_node_type)
 * plus the validated example library (list_examples / get_example).
 */

import { CatalogIndex } from './editor-deps';
import type { CatalogNode, CatalogPort, NodeCatalog } from './editor-deps';

// require() instead of import: keeps TypeScript from inferring a 1.45 MB
// literal type, while esbuild still inlines the JSON into the bundle.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const enrichedJson = require('../../noodl-types/src/node-catalog-enriched.json');

// BCN-010: the capability tables, read rather than restated.
import { BACKEND_TYPES, capabilitiesForNode, gateFor } from '@noodl/backend-contract';

// ─── Enrichment shapes (authored by SUB-005; all fields optional in practice) ──

export interface NodeEnrichment {
  typeName: string;
  summary?: string;
  description?: string;
  whenToUse?: string;
  runtimeBehavior?: string;
  /** Per-port human semantics, keyed by port name. */
  ports?: Record<string, string>;
  examples?: string[];
  patterns?: string[];
  relatedNodes?: string[];
}

export interface EnrichedCatalogNode extends CatalogNode {
  enrichment?: NodeEnrichment;
}

export interface CatalogExample {
  id: string;
  title: string;
  description?: string;
  /** Node type names the example demonstrates. */
  demonstrates: string[];
  /** v2-shaped component fragments: { name, nodes, connections }. */
  components: Array<{
    name: string;
    nodes: unknown[];
    connections?: unknown[];
  }>;
}

interface EnrichedCatalogFile {
  catalogFormatVersion: string;
  portTypeNames: string[];
  typecasts: Array<{ from: string; to: string[] }>;
  nodes: EnrichedCatalogNode[];
  enrichment?: { version?: string; coverage?: { documented: number; total: number } };
  compatibility?: Record<string, unknown>;
  examples?: CatalogExample[];
}

// ─── Loading ──────────────────────────────────────────────────────────────────

const catalogFile = enrichedJson as EnrichedCatalogFile;

let cachedIndex: CatalogIndex | undefined;
let cachedByType: Map<string, EnrichedCatalogNode> | undefined;

/** CatalogIndex over the *enriched* catalog — used for validation too, so the
 * validator and the documentation tools can never disagree about a type. */
export function catalogIndex(): CatalogIndex {
  if (!cachedIndex) cachedIndex = new CatalogIndex(catalogFile as unknown as NodeCatalog);
  return cachedIndex;
}

function byType(): Map<string, EnrichedCatalogNode> {
  if (!cachedByType) {
    cachedByType = new Map();
    for (const n of catalogFile.nodes) cachedByType.set(n.typeName, n);
  }
  return cachedByType;
}

export function allExamples(): CatalogExample[] {
  return catalogFile.examples ?? [];
}

// ─── Compact listing ──────────────────────────────────────────────────────────

export interface NodeTypeRow {
  typeName: string;
  displayName: string;
  category?: string;
  summary?: string;
  isVisual: boolean;
  availableIn: string[];
  deprecated?: boolean;
  /** false ⇒ superseded/specialised type hidden from the editor's picker. */
  inNodePicker?: boolean;
}

export interface ListNodeTypesFilter {
  category?: string;
  query?: string;
  visualOnly?: boolean;
  /** Include deprecated and non-picker types (default false). */
  includeHidden?: boolean;
}

export function listNodeTypes(filter: ListNodeTypesFilter = {}): NodeTypeRow[] {
  const q = filter.query?.toLowerCase();
  const rows: NodeTypeRow[] = [];
  for (const n of catalogFile.nodes) {
    if (!filter.includeHidden && (n.isDeprecated || n.inNodePicker === false)) continue;
    if (filter.category && (n.category ?? '').toLowerCase() !== filter.category.toLowerCase()) continue;
    if (filter.visualOnly && !n.isVisual) continue;
    if (q) {
      const hay = [
        n.typeName,
        n.displayName,
        n.category ?? '',
        n.enrichment?.summary ?? '',
        ...((n as { searchTags?: string[] }).searchTags ?? [])
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const row: NodeTypeRow = {
      typeName: n.typeName,
      displayName: n.displayName,
      category: n.category,
      summary: n.enrichment?.summary,
      isVisual: n.isVisual,
      availableIn: n.availableIn as unknown as string[]
    };
    if (n.isDeprecated) row.deprecated = true;
    if (n.inNodePicker === false) row.inNodePicker = false;
    rows.push(row);
  }
  rows.sort((a, b) => (a.typeName < b.typeName ? -1 : 1));
  return rows;
}

/**
 * Does a node of this type draw anything? — the catalog's half of the
 * `visualRoots` derivation (AWP-001). Returns `false` for a component instance,
 * whose type is a project legacyName the catalog has never heard of; see
 * `deriveVisualRootIdsInProject` for the recursive answer.
 */
export function isVisualNodeType(typeName: string): boolean {
  return byType().get(typeName)?.isVisual === true;
}

export function listCategories(): string[] {
  const set = new Set<string>();
  for (const n of catalogFile.nodes) if (n.category) set.add(n.category);
  return [...set].sort();
}

// ─── Full per-type entry ──────────────────────────────────────────────────────

export interface PortDetail {
  name: string;
  displayName?: string;
  type: unknown;
  isSignal: boolean;
  group?: string;
  default?: unknown;
  /** Authored semantics from SUB-005, when available. */
  description?: string;
}

export interface NodeTypeDetail {
  typeName: string;
  displayName: string;
  category?: string;
  isVisual: boolean;
  deprecated?: boolean;
  availableIn: string[];
  /** Server-side-rendering compatibility (RUN-002); absent for cloud-only types. */
  ssr?: { compat: 'safe' | 'partial' | 'client-only'; note?: string };
  summary?: string;
  description?: string;
  whenToUse?: string;
  runtimeBehavior?: string;
  relatedNodes?: string[];
  inputs: PortDetail[];
  outputs: PortDetail[];
  /** Present when the node creates ports at runtime — the validator skips
   * unknown-port errors for such nodes; ports listed here are the static ones. */
  dynamicPorts?: { mechanisms: string[]; note?: string };
  /**
   * LAS-007 §2 — validated examples demonstrating this type, with their titles.
   *
   * This was `exampleIds: string[]` — a bare list like
   * `["repeater-query-records", "ui-card-grid-repeater"]`. The audit verified
   * the citation existed and did NOT verify it was actionable, and haiku fetched
   * node types without ever following one: an id says nothing about which of
   * four to spend a call on, so the rational move is to spend none. The title
   * costs ~60 bytes and turns the list into a choice.
   */
  examples: ExampleCitationRow[];
  /** Hints for children rules of visual containment, when declared. */
  allowAsChild?: unknown;
  allowChildrenWithCategory?: unknown;
  /**
   * BCN-010 — what this node needs from the project's backend, and which
   * backends refuse it.
   *
   * The editor shows this as a disabled port or a marked node with a sentence
   * on it. An agent authoring a graph through MCP has no property panel to read,
   * so it gets the same facts here — otherwise the one surface that cannot see
   * the gate is the one most likely to write a graph that quietly does not work.
   *
   * `notOn` is written as prose per backend rather than as states, because the
   * sentence *is* the deliverable and an agent relaying "PocketBase can't total
   * or average records on the server" to a user is worth more than relaying
   * `unsupported`.
   */
  capability?: {
    /** The contract capability key the node as a whole needs. */
    key?: string;
    /** Per-port requirements, keyed by port name. */
    ports?: Record<string, string>;
    /** Backend type → the reason it cannot (or only partly can) serve this. */
    notOn?: Record<string, string>;
  };
}

export interface NodeTypeLookupMiss {
  typeName: string;
  error: string;
  suggestion?: string;
}

function portDetail(p: CatalogPort, enrichmentPorts?: Record<string, string>): PortDetail {
  const d: PortDetail = {
    name: p.name,
    type: p.type,
    isSignal: (p as { isSignal?: boolean }).isSignal ?? false
  };
  if (p.displayName) d.displayName = p.displayName;
  if (p.group) d.group = p.group;
  if (p.default !== undefined) d.default = p.default;
  const desc = enrichmentPorts?.[p.name];
  if (desc) d.description = desc;
  return d;
}

/**
 * Compact per-type shape for breadth-first exploration (DEBT-009): ports as
 * one-line strings instead of objects, prose fields capped. A full
 * `get_node_type` response for 7 enriched types ran ~126 KB and blew MCP
 * hosts' tool-result caps; this stays orders of magnitude under them.
 */
export interface NodeTypeSummary {
  typeName: string;
  displayName: string;
  category?: string;
  isVisual: boolean;
  deprecated?: boolean;
  summary?: string;
  /** `"in name: type"` / `"out name: type (signal)"` one-liners. */
  ports: string[];
  hasDynamicPorts?: boolean;
  examples: ExampleCitationRow[];
}

/** LAS-007 §2 — an example the caller can decide about without fetching it. */
export interface ExampleCitationRow {
  id: string;
  title: string;
}

/**
 * Longest inline enum list, in characters of joined values. Above it the line
 * carries a count instead. 96 keeps every port on one readable line while still
 * spelling out the enums a model actually sets (`flexDirection`, `alignItems`,
 * `sizeMode`); only the long editor-facing pickers collapse to a count.
 */
const MAX_INLINE_ENUM_CHARS = 96;

/**
 * AWP-005 §1 — a port's `type` is an object (`{name, enums?, units?, …}`), never
 * a string. `String()` on it rendered `[object Object]` for **3,217 of 3,217**
 * ports across all 175 catalog types, so `detail: "summary"` conveyed port names
 * and no types at all — which is why no model used the mode the tool description
 * recommends, and every model paid full price for `detail: "full"`.
 *
 * Renders the type `name`, plus the discriminating detail a caller needs to set
 * the port: enum values inline while they are short, and a number's units.
 */
export function portTypeLabel(type: unknown): string {
  if (type === null || type === undefined) return 'unknown';
  if (typeof type === 'string') return type;
  if (typeof type !== 'object') return String(type);

  const t = type as { name?: unknown; enums?: unknown; units?: unknown; defaultUnit?: unknown };
  const base = typeof t.name === 'string' && t.name ? t.name : 'unknown';

  if (Array.isArray(t.enums) && t.enums.length) {
    const values = t.enums
      .map((e) => (e !== null && typeof e === 'object' ? (e as { value?: unknown }).value : e))
      .filter((v) => v !== undefined && v !== null)
      .map(String);
    if (!values.length) return base;
    const inline = values.join('|');
    return inline.length <= MAX_INLINE_ENUM_CHARS ? `${base}(${inline})` : `${base}(${values.length} options)`;
  }

  if (Array.isArray(t.units) && t.units.length) {
    // Default unit first — a units port writes a STRING ("10px"), so which unit
    // is implied when the model writes a bare number is the load-bearing fact.
    const units = t.units.map(String);
    const def = typeof t.defaultUnit === 'string' ? t.defaultUnit : undefined;
    const ordered = def && units.includes(def) ? [def, ...units.filter((u) => u !== def)] : units;
    return `${base}(${ordered.join('|')})`;
  }

  return base;
}

export function getNodeTypeSummary(typeName: string): NodeTypeSummary | NodeTypeLookupMiss {
  const full = getNodeTypeDetail(typeName);
  if ('error' in full) return full;
  const portLine = (p: PortDetail, dir: 'in' | 'out') =>
    `${dir} ${p.name}: ${portTypeLabel(p.type)}${p.isSignal ? ' (signal)' : ''}`;
  const s: NodeTypeSummary = {
    typeName: full.typeName,
    displayName: full.displayName,
    isVisual: full.isVisual,
    ports: [...full.inputs.map((p) => portLine(p, 'in')), ...full.outputs.map((p) => portLine(p, 'out'))],
    examples: full.examples
  };
  if (full.category) s.category = full.category;
  if (full.deprecated) s.deprecated = true;
  if (full.summary) s.summary = full.summary;
  if (full.dynamicPorts) s.hasDynamicPorts = true;
  return s;
}

export function getNodeTypeDetail(typeName: string): NodeTypeDetail | NodeTypeLookupMiss {
  const n = byType().get(typeName);
  if (!n) {
    const suggestion = catalogIndex().suggestType(typeName);
    return {
      typeName,
      error: `Unknown node type "${typeName}".`,
      ...(suggestion ? { suggestion } : {})
    };
  }
  const e = n.enrichment;
  const examples: ExampleCitationRow[] = allExamples()
    .filter((ex) => ex.demonstrates.includes(typeName))
    .map((ex) => ({ id: ex.id, title: ex.title }));
  const detail: NodeTypeDetail = {
    typeName: n.typeName,
    displayName: n.displayName,
    category: n.category,
    isVisual: n.isVisual,
    availableIn: n.availableIn as unknown as string[],
    inputs: (n.inputs ?? []).map((p) => portDetail(p, e?.ports)),
    outputs: (n.outputs ?? []).map((p) => portDetail(p, e?.ports)),
    examples
  };
  if (n.isDeprecated) detail.deprecated = true;
  if (n.ssr) detail.ssr = n.ssr;
  if (e?.summary) detail.summary = e.summary;
  if (e?.description) detail.description = e.description;
  if (e?.whenToUse) detail.whenToUse = e.whenToUse;
  if (e?.runtimeBehavior) detail.runtimeBehavior = e.runtimeBehavior;
  if (e?.relatedNodes?.length) detail.relatedNodes = e.relatedNodes;
  if (n.dynamicPorts) {
    const dp = n.dynamicPorts as { mechanisms?: string[]; note?: string };
    detail.dynamicPorts = {
      mechanisms: dp.mechanisms ?? [],
      ...(dp.note ? { note: dp.note } : {})
    };
  }
  const anyN = n as unknown as Record<string, unknown>;
  if (anyN.allowAsChild !== undefined) detail.allowAsChild = anyN.allowAsChild;
  if (anyN.allowChildrenWithCategory !== undefined) detail.allowChildrenWithCategory = anyN.allowChildrenWithCategory;
  const capability = capabilityFor(typeName);
  if (capability) detail.capability = capability;
  return detail;
}

/**
 * The capability facts for one type, or `undefined` when it binds nothing.
 *
 * Reads the same two tables the editor's gate does — `NODE_CAPABILITIES` for
 * what the node asks and `BACKEND_DESCRIPTORS` for what each backend answers —
 * so there is no third statement of either anywhere.
 */
function capabilityFor(typeName: string): NodeTypeDetail['capability'] {
  const binding = capabilitiesForNode(typeName);
  if (!binding) return undefined;

  const out: NonNullable<NodeTypeDetail['capability']> = {};
  if (binding.node) out.key = binding.node;
  if (binding.ports && Object.keys(binding.ports).length) out.ports = { ...binding.ports };

  if (binding.node) {
    const notOn: Record<string, string> = {};
    for (const type of BACKEND_TYPES) {
      // `custom` is declared by the user, so shipping its floor as a fact about
      // a real backend would be misinformation rather than a gap.
      if (type === 'custom') continue;
      const gate = gateFor(type, binding.node);
      if (gate.reason) notOn[type] = gate.reason;
    }
    if (Object.keys(notOn).length) out.notOn = notOn;
  }

  return Object.keys(out).length ? out : undefined;
}

// ─── Examples ─────────────────────────────────────────────────────────────────

export interface ExampleRow {
  id: string;
  title: string;
  description?: string;
  demonstrates: string[];
}

export function listExamples(filter: { nodeType?: string; query?: string } = {}): ExampleRow[] {
  const q = filter.query?.toLowerCase();
  return allExamples()
    .filter((ex) => {
      if (filter.nodeType && !ex.demonstrates.includes(filter.nodeType)) return false;
      if (q) {
        const hay = [ex.id, ex.title, ex.description ?? '', ...ex.demonstrates].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((ex) => ({
      id: ex.id,
      title: ex.title,
      ...(ex.description ? { description: ex.description } : {}),
      demonstrates: ex.demonstrates
    }));
}

export function getExample(id: string): CatalogExample | undefined {
  return allExamples().find((ex) => ex.id === id);
}
