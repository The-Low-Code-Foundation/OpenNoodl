/**
 * Enriched node-catalog access (SUB-004 structural + SUB-005 semantics).
 *
 * The enriched catalog is ~1.45 MB; no tool ever returns it whole. This module
 * provides the two projections the tool surface needs:
 *   - compact listing rows for discovery (list_node_types)
 *   - full per-type entries with semantics for named types (get_node_type)
 * plus the validated example library (list_examples / get_example).
 */

import { CatalogIndex, noBoxExit } from './editor-deps';
import type { CatalogNode, CatalogPort, NodeCatalog } from './editor-deps';

// CN-003 — the shared mapping, called by this server *and* by the editor over
// the payload the viewer already sent it. See `@nodegx/kit-catalog`'s header for
// why there is one mapping and not two.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { KIT_PROVENANCE, mergeOverlay } = require('@nodegx/kit-catalog');
import type { NodeCatalogLike, OverlayCatalogNode } from '@nodegx/kit-catalog';

// require() instead of import: keeps TypeScript from inferring a 1.45 MB
// literal type, while esbuild still inlines the JSON into the bundle.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const enrichedJson = require('../../noodl-types/src/node-catalog-enriched.json');

// BCN-010: the capability tables, read rather than restated.
import { BACKEND_TYPES, capabilitiesForNode, gateFor } from '@noodl/backend-contract';

// FLD-013 (#37) — the export's own two answers, read rather than restated. `ledgerEntryOf` says
// whether this product has a translation for the TYPE; `structurePortsOf` says which of its ports
// refuse a wire even when it does. Both come from `@nodegx/export`, which `exportReact.ts` already
// pulls into this bundle, so the surface below is a projection and never a second table.
import { contentPortsOf, exportBadgeOf, ledgerEntryOf, structurePortsOf } from '@nodegx/export';
import type { ExportBadge, ExportStatus } from '@nodegx/export';

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
  antiPatterns?: string[];
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

const shippedCatalog = enrichedJson as EnrichedCatalogFile;

// ─── CN-003 — the project overlay ─────────────────────────────────────────────

/**
 * The bound project's own kit node types, merged over the shipped catalog.
 *
 * ✅ **D3 / CN-003.** `node-catalog-enriched.json` is generated from the live
 * register of **built-ins only**, at repo-build time; a project's kits exist per
 * project and per machine, so they cannot be in it. Everything downstream —
 * validation, `visualRoots`, `get_node_type`, the write gate — reads this module,
 * which is why one merge here is the whole of "custom nodes stop being
 * second-class" for this server. `src/kitOverlay.ts` produces the list; this
 * file only knows it has one.
 *
 * ⚠️ **Every derived structure below is a cache and must be dropped with it.**
 * `catalogIndex()`, `byType()` and the merged document are all memoised, and a
 * `SemanticValidator` built over a stale index is a validator that has never
 * heard of the project's nodes — silently, and only for the checks it skips. See
 * {@link catalogGeneration}.
 */
let overlayNodes: OverlayCatalogNode[] = [];
let generation = 0;

let cachedIndex: CatalogIndex | undefined;
let cachedByType: Map<string, EnrichedCatalogNode> | undefined;
let cachedMerged: EnrichedCatalogFile | undefined;

/**
 * Install (or clear, with `[]`) the project overlay.
 *
 * 🔴 Never mutates the shipped document — `mergeOverlay` returns a new one. The
 * shipped `nodes` array is a module singleton and one project's kits leaking
 * into it is exactly what CN-003's acceptance criterion 1 tests for with its
 * "and false for a project without the kit" half.
 */
export function setCatalogOverlay(nodes: OverlayCatalogNode[]): void {
  overlayNodes = nodes ?? [];
  cachedIndex = undefined;
  cachedByType = undefined;
  cachedMerged = undefined;
  generation++;
}

/**
 * Bumped whenever the overlay changes.
 *
 * Callers that build something *over* the index — `SemanticValidator`, of which
 * there are two cached instances in this package — memoise it against this
 * number rather than forever. Without it the overlay would be installed
 * correctly and then read by a validator constructed before it existed, and
 * nothing about that failure is visible: it looks exactly like a project whose
 * kits are unknown, which is the state we are trying to leave.
 */
export function catalogGeneration(): number {
  return generation;
}

/** The shipped catalog, with the bound project's kit entries merged in. */
function catalog(): EnrichedCatalogFile {
  if (!cachedMerged) {
    cachedMerged =
      overlayNodes.length === 0
        ? shippedCatalog
        : (mergeOverlay(shippedCatalog as unknown as NodeCatalogLike, overlayNodes) as unknown as EnrichedCatalogFile);
  }
  return cachedMerged;
}

/** CatalogIndex over the *enriched* catalog — used for validation too, so the
 * validator and the documentation tools can never disagree about a type. */
export function catalogIndex(): CatalogIndex {
  if (!cachedIndex) cachedIndex = new CatalogIndex(catalog() as unknown as NodeCatalog);
  return cachedIndex;
}

function byType(): Map<string, EnrichedCatalogNode> {
  if (!cachedByType) {
    cachedByType = new Map();
    for (const n of catalog().nodes) cachedByType.set(n.typeName, n);
  }
  return cachedByType;
}

export function allExamples(): CatalogExample[] {
  return shippedCatalog.examples ?? [];
}

// ─── CN-009 — the two facts a kit node carries and a built-in does not ────────

/**
 * Where this node came from, when the answer is "a kit in the bound project".
 *
 * ✅ **D1** makes provenance a first-class fact — *"when a node misbehaves you
 * need to know who wrote it"* — and an agent needs it for the same reason the
 * property panel shows it to a human: it is the difference between a bug to file
 * against NodeGX and one to file against the kit sitting in `noodl_modules/`.
 *
 * ⚠️ **Emitted only for kit nodes, and that is a deliberate asymmetry rather
 * than a reduced-fidelity path.** Every shipped node also carries `providedBy`
 * (`noodl-runtime` | `noodl-viewer-react` | `noodl-editor` | `noodl-viewer-cloud`
 * — measured, all 175), but which of the four a built-in came from changes
 * nothing an agent does, and stamping it on all 147 listing rows costs ~4 KB of
 * response on every `list_node_types` call to say the same uninformative thing
 * 147 times. **P1** forbids a kit node reaching *less* than a built-in; these two
 * fields give it *more*, which is exactly what D1 asked for.
 *
 * Presence is therefore self-describing — `providedBy: "project-kit"` in a
 * payload needs no tool-description sentence to explain it, which is why this
 * whole change costs **zero** of CN-009's 57 resident tokens.
 */
function kitOrigin(n: EnrichedCatalogNode): { providedBy: string; kitModule: string } | undefined {
  const anyN = n as unknown as { providedBy?: unknown; kitModule?: unknown };
  if (anyN.providedBy !== KIT_PROVENANCE) return undefined;
  return {
    providedBy: KIT_PROVENANCE as string,
    kitModule: typeof anyN.kitModule === 'string' ? anyN.kitModule : ''
  };
}

/**
 * The one-line statement of what a node is for — from enrichment, or from a kit
 * author's own `docs` string.
 *
 * 🔴 **`docs` is one field name over two vocabularies, and reading it without
 * splitting them is a defect rather than a nicety.** On a **shipped** catalog
 * node `docs` is a *URL*: 158 of the 175 built-ins carry one and 158 of 158 of
 * those are `https://docs.noodl.net/…` — zero are prose (measured against
 * `node-catalog-enriched.json`, 2026-08-17). On a **kit** node it is the
 * sentence the author wrote about their node. An ungated `enrichment.summary ??
 * docs` fallback would therefore put a documentation link where a summary goes,
 * so the fallback is gated on provenance and **a project with no kits gets a
 * byte-identical answer**.
 *
 * Without this, a kit node reached `get_node_type` with a heading, a port list
 * and **no statement of what it is for at all** — the author's `docs` was
 * carried faithfully into the overlay by `@nodegx/kit-catalog` and then dropped
 * here, because `enrichment` is generated at repo-build time and keyed by type
 * name, so a kit type can never be in it. It also cost the kit its only
 * free-text handle: `list_node_types`' `query` searches the summary, so
 * `query: "draggable"` matched **nothing** on a kit whose `docs` opens with the
 * word "draggable" (measured before the fix).
 *
 * ⚠️ **The same rule exists once more, editor-side**, as `kitDocs` in
 * `AuthoringContextBuilder` (CN-008). The duplication is forced rather than
 * sloppy: the two consumers read *different* enrichment sources — this one the
 * merged catalog document, that one the repo-build `enrichedNode()` table — so
 * there is no single place upstream that could hold it. Change one, change both.
 */
function summaryOf(n: EnrichedCatalogNode): string | undefined {
  const enriched = n.enrichment?.summary;
  if (enriched) return enriched;
  if (!kitOrigin(n)) return undefined;
  const docs = (n as unknown as { docs?: unknown }).docs;
  if (typeof docs !== 'string') return undefined;
  const trimmed = docs.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ─── Export reach (FLD-013) ───────────────────────────────────────────────────

/**
 * What an agent needs to know about a type *before* it designs an app it intends to export.
 *
 * 🔴 **`status` alone is the answer #37 asked for, and it would not have prevented #37.** The
 * dashboard that produced twenty-three refusals was built on `Circle`, whose ledger status is
 * `translated`. The refusal is per **parameter source**: a wire into any of `structurePorts`
 * leaves the node out. A field that says only "translated" on that type is a green light on the
 * exact node that failed, which is why the two lists travel with the status and not instead of it.
 */
export interface NodeTypeExportInfo {
  /**
   * The coverage ledger's classification of the **type** — never of a node in a graph.
   *
   * `translated` means this exporter has a translation for the type, *not* that any given node of
   * it will export: see `structurePorts`.
   */
  status: ExportStatus;
  /** Present only when the type never exports (`deferred`). Absent is not "exports" — read `status`. */
  badge?: ExportBadge;
  /**
   * Ports whose value arriving over a **wire** makes a node of this type refuse: what it shapes
   * (tracks, options, marks, the outline itself) cannot be rendered statically, so the node is
   * left out of the export rather than drawn wrongly. Set the port as a literal parameter and it
   * exports.
   *
   * Always present, empty for most types — an empty list and a missing field are different answers.
   */
  structurePorts: string[];
  /**
   * Ports that carry *content* into a control and still refuse a wire, for a different reason:
   * the value is not statically known and the wrong one is worse than none (`Range.min` fed by a
   * record would emit a 0–100 slider). Reported apart from `structurePorts` because calling these
   * structure would be untrue of this product.
   */
  contentPorts: string[];
}

/**
 * The export reading for a named type, or `undefined` when the ledger does not classify it.
 *
 * 🔴 **`undefined` is a real answer and is not "will not export".** A kit node's export is decided
 * by its kit (EXP-010) and a component instance's by its component; the ledger has never heard of
 * either. Emitting `{ structurePorts: [] }` for one would tell an agent it refuses on no port,
 * which nothing here has measured.
 */
export function exportInfoOf(typeName: string): NodeTypeExportInfo | undefined {
  const entry = ledgerEntryOf(typeName);
  if (entry === undefined) return undefined;
  const info: NodeTypeExportInfo = {
    status: entry.status,
    structurePorts: structurePortsOf(typeName),
    contentPorts: contentPortsOf(typeName)
  };
  const badge = exportBadgeOf(typeName);
  if (badge) info.badge = badge;
  return info;
}

/**
 * Is there anything to say about this type's export on a **listing** row?
 *
 * A row with nothing to say is silent, and `list_node_types`' payload-level `exportCoverage.note`
 * is what makes the silence readable. 27 of the 143 picker rows are non-translated and a further
 * handful are translated types that refuse on a wire — `Circle` is the reason this is an `or` and
 * not `status !== "translated"`.
 */
function worthListing(info: NodeTypeExportInfo): boolean {
  return info.status !== 'translated' || info.structurePorts.length > 0 || info.contentPorts.length > 0;
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
  /** CN-009 — `"project-kit"` on a node one of this project's kits declares; absent on a built-in. */
  providedBy?: string;
  /** CN-009 — the kit that declared it. Present exactly when `providedBy` is. */
  kitModule?: string;
  /**
   * FLD-013 — present only when there is something to say: the type does not export, or it does
   * and refuses on a wire into one of its ports. Silence means translated with no refusing port;
   * the payload's `exportCoverage.note` says so, because silence a caller cannot read is not an
   * answer. Full detail (`get_node_type`) carries this for every classified type.
   */
  export?: NodeTypeExportInfo;
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
  // CN-003 — the merged document, so a project's own node types are listed
  // beside the built-ins. ✅ **P1**: there is no capability difference between a
  // kit node and a shipped one, and a picker an author's own node is missing
  // from is a capability difference.
  for (const n of catalog().nodes) {
    if (!filter.includeHidden && (n.isDeprecated || n.inNodePicker === false)) continue;
    if (filter.category && (n.category ?? '').toLowerCase() !== filter.category.toLowerCase()) continue;
    if (filter.visualOnly && !n.isVisual) continue;
    // CN-009 — the resolved summary, so a kit's own `docs` sentence is
    // searchable. Computed before the filter rather than after it: searching the
    // row's summary and *displaying* a different one is the shape where a query
    // matches a node the caller then cannot see the reason for.
    const summary = summaryOf(n);
    const origin = kitOrigin(n);
    if (q) {
      const hay = [
        n.typeName,
        n.displayName,
        n.category ?? '',
        summary ?? '',
        // The kit's name is a handle a caller has and the type name may not
        // carry — `nodegx.cashflow.Pill` does not contain "Cashflow Kit".
        origin?.kitModule ?? '',
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
      summary,
      isVisual: n.isVisual,
      availableIn: n.availableIn as unknown as string[]
    };
    if (n.isDeprecated) row.deprecated = true;
    if (n.inNodePicker === false) row.inNodePicker = false;
    if (origin) {
      row.providedBy = origin.providedBy;
      row.kitModule = origin.kitModule;
    }
    const exportInfo = exportInfoOf(n.typeName);
    if (exportInfo && worthListing(exportInfo)) row.export = exportInfo;
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
  for (const n of catalog().nodes) if (n.category) set.add(n.category);
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

/**
 * One conditionally-declared port group, as an agent needs it (CN-010).
 *
 * Every member is *also* a statically declared port — checked across the whole
 * shipped catalog, no type declares a port only conditionally — so these names
 * are already in `inputs`/`outputs`. What the group adds is the `condition`: the
 * only place the catalog records that a port is read at all only when a sibling
 * parameter holds a particular value. Setting `cubicBezierP1X` on an `Animation`
 * whose `easingCurve` is not `cubicBezier` is well-formed, statically valid, and
 * silently never read.
 */
export interface DeclaredPortGroupDetail {
  /** e.g. `"mode = list"`, `"idSource = explicit OR idSource NOT SET"`. */
  condition?: string;
  inputs?: string[];
  outputs?: string[];
}

export interface NodeTypeDetail {
  typeName: string;
  displayName: string;
  category?: string;
  isVisual: boolean;
  deprecated?: boolean;
  availableIn: string[];
  /** CN-009 — `"project-kit"` on a node one of this project's kits declares; absent on a built-in. */
  providedBy?: string;
  /** CN-009 — the kit that declared it. Present exactly when `providedBy` is. */
  kitModule?: string;
  /** Server-side-rendering compatibility (RUN-002); absent for cloud-only types. */
  ssr?: { compat: 'safe' | 'partial' | 'client-only'; note?: string };
  /**
   * FLD-013 — the code-export reading, unconditional for every type the ledger classifies, so an
   * agent choosing between types learns which of them refuse and on which ports before it designs.
   * Absent only for a kit node or a component instance, whose export their kit and their component
   * decide; see {@link exportInfoOf}.
   */
  export?: NodeTypeExportInfo;
  summary?: string;
  description?: string;
  whenToUse?: string;
  runtimeBehavior?: string;
  /**
   * CMP-006 — the authored shapes to reach for, and the ones to avoid.
   *
   * Both fields have been in the enrichment corpus since SUB-005 and reached
   * exactly one reader: the EDITOR's node-docs panel
   * (`noodl-editor/src/editor/src/utils/nodeDocs.ts:161`, "Watch out for"),
   * which is a person. `getNodeTypeDetail` copied five enrichment fields and
   * stopped, so every anti-pattern authored for an agent was invisible to the
   * agent doing the authoring — 130 types carry `patterns` and 113 carry
   * `antiPatterns` out of 176.
   *
   * Full detail only, deliberately. `getNodeTypeSummary` is the default and its
   * cheapness is a measured contract (AWP-005 §2); `antiPatterns` alone is a
   * median 36% of a summary payload and up to 151% of one on a small logic node
   * (`noodl.cloud.request`: 528 chars of anti-pattern against ~349 of summary),
   * so carrying them by default would overturn that measurement rather than
   * extend it. See the phase 85 README §7 for the open question.
   */
  patterns?: string[];
  antiPatterns?: string[];
  relatedNodes?: string[];
  inputs: PortDetail[];
  outputs: PortDetail[];
  /** Present when the node creates ports at runtime — the validator skips
   * unknown-port errors for such nodes; ports listed here are the static ones. */
  dynamicPorts?: {
    mechanisms: string[];
    /**
     * CN-010 — the sentence that says *how* the port list is not exhaustive.
     *
     * 🔴 This field was `note` and read `dp.note`, which **exists on no node**:
     * the catalog's field is `description` on all 88 shipped types that declare
     * dynamic ports (`DynamicPortInfo.description`, non-optional) and on every
     * kit node (`OverlayDynamicPortInfo.description`, non-optional). So the
     * projection compiled, typechecked and shipped `{ mechanisms: [...] }` and
     * nothing else — an agent was told the list was incomplete and given no
     * statement of what was missing, for every dynamic type in the product.
     * The editor's `CatalogIndex.dynamicPortNote()` reads `description` and was
     * right all along; this was one consumer of two getting the name wrong.
     */
    description?: string;
    /**
     * CN-010 / AC3 — the enumerable half, which was dropped entirely.
     *
     * `declared-port-groups` is not "ports we cannot name": it is a fixed set
     * switched on by a sibling parameter's value, and the catalog records both
     * the names and the condition (34 shipped types, 165 groups, 158 of them
     * with a condition). Withholding it left `mechanisms` as a bare flag on the
     * one mechanism that could have been answered in full.
     *
     * Projected to `{condition, inputs, outputs}` rather than passed through:
     * the raw entries also carry exporter internals (`name:
     * "conditionalports/extended"`, `template`, `indexStep`) that mean nothing
     * outside `nodelibraryexport.ts`.
     */
    declaredPortGroups?: DeclaredPortGroupDetail[];
  };
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
  /**
   * CN-009 — `"project-kit"` on a node one of this project's kits declares.
   *
   * 🔴 Carried here and not only in full detail because `summary` is
   * `get_node_type`'s **default** (AWP-005 §2). Provenance that only survives
   * `detail: "full"` is provenance the overwhelming majority of calls never see,
   * which would make D1 true of a mode nobody uses.
   */
  providedBy?: string;
  /** CN-009 — the kit that declared it. Present exactly when `providedBy` is. */
  kitModule?: string;
  /**
   * FLD-013 — carried here for the same reason `providedBy` is: `summary` is `get_node_type`'s
   * **default** (AWP-005 §2), and an export reading that only survives `detail: "full"` is one the
   * overwhelming majority of calls never see. AC1 is a `get_node_type` call on `Circle`, and it is
   * a summary call.
   */
  export?: NodeTypeExportInfo;
  summary?: string;
  /** `"in name: type"` / `"out name: type (signal)"` one-liners. */
  ports: string[];
  hasDynamicPorts?: boolean;
  /**
   * AWP-005 §2 — the one prose field a summary may not drop.
   *
   * Present only for types with `dynamicPorts`, and it is the reason the default
   * could be flipped at all. Measured against the four phase-55 replays: of the
   * 117 (type, port) pairs those models actually set, the summary carried 113
   * with a usable type and every one of the 26 enum ports with its options
   * inline. Of the four it missed, three (`For Each.itemId`,
   * `RouterNavigate.target`, `RouterNavigate.router`) are absent from **full**
   * detail too — runtime-pushed ports the static catalog never had.
   *
   * The fourth was real: `Page.urlPath` is in full detail and was in no summary,
   * because `Page`'s settable `title` and `urlPath` are registered per instance
   * and exist in the catalog **only inside `runtimeBehavior`'s prose**. A summary
   * that drops prose therefore dropped the only statement that two of the most
   * commonly set ports on a page exist — silently, which is the same shape of
   * defect as `[object Object]` and would have been shipped as the new default.
   */
  runtimeBehavior?: string;
  examples: ExampleCitationRow[];
  /**
   * How many further examples cite this type but were not listed, because a
   * summary caps the citation list at {@link MAX_SUMMARY_EXAMPLES}. Absent when
   * nothing was dropped. `list_examples({node_type})` returns the full set.
   */
  examplesOmitted?: number;
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

/**
 * Citation rows a *summary* lists before it starts counting instead.
 *
 * 🔴 The citation list is the one part of a summary that grows with the
 * **corpus** rather than with the node. DSG-003 added eleven `ui-*` composition
 * recipes and every one of them cites `Group` or `Text`, so those two types went
 * from a couple of citations to 13 and 14 — and the eight-type ceiling response
 * crossed the compactness bar it is held to (30,365 bytes against 30,000)
 * without a single node gaining a port. The next recipe would have done it
 * again.
 *
 * Three keeps LAS-007 §2's intent — you can tell *that* worked examples exist
 * and decide about the first few without fetching — while making the cost of a
 * summary a function of the library, which is bounded, instead of the recipe
 * corpus, which is meant to keep growing. The remainder is not hidden: the count
 * ships as `examplesOmitted` and `list_examples({node_type})` returns all of it.
 *
 * Full detail is untouched and still carries every citation.
 */
export const MAX_SUMMARY_EXAMPLES = 3;

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
    examples: full.examples.slice(0, MAX_SUMMARY_EXAMPLES)
  };
  if (full.examples.length > MAX_SUMMARY_EXAMPLES) {
    s.examplesOmitted = full.examples.length - MAX_SUMMARY_EXAMPLES;
  }
  if (full.category) s.category = full.category;
  if (full.deprecated) s.deprecated = true;
  if (full.providedBy) {
    s.providedBy = full.providedBy;
    s.kitModule = full.kitModule;
  }
  if (full.export) s.export = full.export;
  if (full.summary) s.summary = full.summary;
  if (full.dynamicPorts) {
    s.hasDynamicPorts = true;
    // Only these types pay for it. `hasDynamicPorts: true` on its own says a
    // node has ports the list does not show and gives no way to learn what they
    // are, which is a flag rather than an answer.
    if (full.runtimeBehavior) s.runtimeBehavior = full.runtimeBehavior;
    // CN-010 — and for a **kit** node there is never a `runtimeBehavior`, so the
    // sentence above never fires and the flag stays a flag. `runtimeBehavior`
    // comes from `enrichment`, which is generated at repo-build time and keyed
    // by type name: a kit type cannot be in it, by construction, on any machine.
    // Measured on the shipped catalog: 88 of 88 dynamic types carry one, so the
    // gap is not a coverage hole to be filled later — it is 100% of kits and 0%
    // of built-ins, permanently. The catalog's own `description` is the fallback,
    // and it is the same field full detail now carries.
    //
    // ⚠️ Same shape as CN-009's `summary`: one field, sourced from a table no kit
    // can appear in, degrading silently rather than visibly. That was the third
    // such field found in this phase; when a fourth turns up, look here first.
    else if (full.dynamicPorts.description) s.runtimeBehavior = full.dynamicPorts.description;
  }
  return s;
}

/**
 * AWP-005 §2 — full detail for named ports of one type, and nothing else.
 *
 * The expensive half of a node doc is per-port: `Group` costs 11,018 tokens for
 * 111 ports, and a caller setting `width` needs one of them. This is the shape
 * that makes `summary` viable as a default — survey cheaply, then pay for the
 * two ports being set rather than for the type.
 *
 * Unmatched names are returned in `notFound` rather than dropped: silently
 * answering three of four asked-for ports is how a model concludes a port does
 * not exist.
 */
export function getNodeTypePorts(
  typeName: string,
  portNames: readonly string[]
): (Pick<NodeTypeDetail, 'typeName' | 'displayName' | 'runtimeBehavior'> & {
  inputs: PortDetail[];
  outputs: PortDetail[];
  notFound?: string[];
  notFoundNotes?: Record<string, string>;
}) | NodeTypeLookupMiss {
  const full = getNodeTypeDetail(typeName);
  if ('error' in full) return full;
  const wanted = new Set(portNames);
  const inputs = full.inputs.filter((p) => wanted.has(p.name));
  const outputs = full.outputs.filter((p) => wanted.has(p.name));
  const found = new Set([...inputs, ...outputs].map((p) => p.name));
  const notFound = [...wanted].filter((n) => !found.has(n));
  /**
   * DEF-003 (b) — a reason, for the misses that have one.
   *
   * `notFound: ["paddingLeft"]` is a true answer and a dead end: an author told a port does not
   * exist looks for a differently-named one, and on a `Text` there isn't one — padding, fill,
   * border and radius all live on a wrapping `Group`. Phase 76 F16 and phase 77 D7 are both
   * authors who went round that loop. The sentence is `noBoxExit`'s, the same one the write gate
   * uses, so the two doors cannot come to disagree about it.
   */
  const notFoundNotes: Record<string, string> = {};
  for (const name of notFound) {
    const note = noBoxExit(catalogIndex(), typeName, name);
    if (note) notFoundNotes[name] = note;
  }
  return {
    typeName: full.typeName,
    displayName: full.displayName,
    inputs,
    outputs,
    // Carried whenever it exists here, not only for misses: a port this call
    // could not find may be one `runtimeBehavior` is the only record of.
    ...(full.runtimeBehavior ? { runtimeBehavior: full.runtimeBehavior } : {}),
    ...(notFound.length > 0 ? { notFound } : {}),
    ...(Object.keys(notFoundNotes).length > 0 ? { notFoundNotes } : {})
  };
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
  const origin = kitOrigin(n);
  if (origin) {
    detail.providedBy = origin.providedBy;
    detail.kitModule = origin.kitModule;
  }
  const exportInfo = exportInfoOf(n.typeName);
  if (exportInfo) detail.export = exportInfo;
  if (n.ssr) detail.ssr = n.ssr;
  // CN-009 — `summaryOf`, not `e?.summary`: a kit type is never in the
  // repo-build enrichment table, so this is the only route its author's own
  // sentence has into the answer. See `summaryOf` for why it is gated.
  const summary = summaryOf(n);
  if (summary) detail.summary = summary;
  if (e?.description) detail.description = e.description;
  if (e?.whenToUse) detail.whenToUse = e.whenToUse;
  if (e?.runtimeBehavior) detail.runtimeBehavior = e.runtimeBehavior;
  if (e?.patterns?.length) detail.patterns = e.patterns;
  if (e?.antiPatterns?.length) detail.antiPatterns = e.antiPatterns;
  if (e?.relatedNodes?.length) detail.relatedNodes = e.relatedNodes;
  if (n.dynamicPorts) {
    const dp = n.dynamicPorts as {
      mechanisms?: string[];
      description?: string;
      declaredPortGroups?: unknown[];
    };
    const groups = declaredPortGroupDetails(dp.declaredPortGroups);
    detail.dynamicPorts = {
      mechanisms: dp.mechanisms ?? [],
      ...(dp.description ? { description: dp.description } : {}),
      ...(groups.length ? { declaredPortGroups: groups } : {})
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
 * The agent-facing projection of the catalog's declared port groups (CN-010).
 *
 * Drops every entry that would say nothing: a group with neither `inputs` nor
 * `outputs` carries no port names, and a group is only worth its bytes for the
 * names plus the condition. Returns `[]` — never `undefined` — so the one caller
 * decides whether the field appears.
 */
function declaredPortGroupDetails(raw: unknown[] | undefined): DeclaredPortGroupDetail[] {
  if (!Array.isArray(raw)) return [];
  const out: DeclaredPortGroupDetail[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const g = entry as { condition?: unknown; inputs?: unknown; outputs?: unknown };
    const inputs = Array.isArray(g.inputs) ? g.inputs.filter((n): n is string => typeof n === 'string') : [];
    const outputs = Array.isArray(g.outputs) ? g.outputs.filter((n): n is string => typeof n === 'string') : [];
    if (inputs.length === 0 && outputs.length === 0) continue;
    out.push({
      ...(typeof g.condition === 'string' && g.condition ? { condition: g.condition } : {}),
      ...(inputs.length ? { inputs } : {}),
      ...(outputs.length ? { outputs } : {})
    });
  }
  return out;
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
