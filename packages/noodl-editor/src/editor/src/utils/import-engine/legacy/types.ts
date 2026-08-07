/**
 * LIB-006: Legacy import assessment — the outcome taxonomy and report schema.
 *
 * One schema, two audiences. {@link ImportReport} is written into the imported
 * project as JSON and rendered to Markdown from the *same* object (see
 * `report.ts`) — an agent parses the JSON, a person reads the Markdown, and
 * neither is scraping the other's rendering.
 *
 * The taxonomy is defined by tests, not adjectives, so two converters classify
 * the same construct identically. The definitions, and the evidence behind the
 * classification of every legacy construct, are committed in
 * `dev-docs/tasks/phase-21-library-and-import/LIB-006-LEGACY-CONSTRUCT-INVENTORY.md`,
 * which is the scope boundary for this task. **That table is normative; this
 * file is its machine form.**
 *
 * @module noodl-editor/utils/import-engine/legacy/types
 */

// ─── Outcomes ────────────────────────────────────────────────────────────────

/**
 * What happened to one legacy construct.
 *
 * - `converted` — carried across unchanged. The type resolves in the target and
 *   no parameter, port name or wire was rewritten.
 * - `converted-with-changes` — carried across, but rewritten: a different type
 *   name, or renamed/dropped parameters or ports. Behaviour may differ.
 * - `placeholder` — could not be converted. Left in the project *exactly as
 *   authored* — original type name, original parameters, original wiring — and
 *   marked (see {@link LEGACY_IMPORT_METADATA_KEY}) so the editor and SUB-006
 *   show it as an error. It does not run.
 * - `dropped` — deliberately not carried into the target at all.
 *
 * **Tie-break:** evaluate in the order above and take the FIRST outcome the
 * construct qualifies for. That ordering is what makes the classification
 * reproducible across converters.
 */
export type LegacyOutcome = 'converted' | 'converted-with-changes' | 'placeholder' | 'dropped';

/** Evaluation order for the tie-break rule. Index 0 wins. */
export const OUTCOME_ORDER: readonly LegacyOutcome[] = [
  'converted',
  'converted-with-changes',
  'placeholder',
  'dropped'
];

/** What kind of thing the finding is about. */
export type LegacyConstructKind = 'node' | 'project-field' | 'module' | 'backend' | 'user-code';

/**
 * Why the construct got the outcome it did. A closed set, because an assistant
 * branches on it — prose in `message` is for the human, this is for the machine.
 */
export type LegacyReason =
  /** The type is registered and current. Reported as a count, not an entry. */
  | 'type-current'
  /** The type is registered but deprecated. Works; a modern replacement exists. */
  | 'type-deprecated'
  /** The type was removed from the runtime. Nothing will ever provide it. */
  | 'type-removed'
  /** The type resolves nowhere and no module is coming that could provide it. */
  | 'type-unresolved'
  /** The type is not in the catalog, but a module imported alongside should register it. */
  | 'type-module-provided'
  /** REST2 rewritten to net.noodl.HTTP — declarative subset only. */
  | 'rest-to-http'
  /** REST2 left alone because its request/response scripts carry user code. */
  | 'rest-has-scripts'
  /** `rootComponent` (a name) became `rootNodeId`. */
  | 'root-component-to-node-id'
  /** The project.json `version` chain ran on load. */
  | 'project-version-upgraded'
  /** A project field nothing reads or writes. Lost on the first save. */
  | 'field-not-carried'
  /** User code matches a React 18→19 removal (ProjectScanner's patterns). */
  | 'react19-user-code'
  /** The project points at an external backend whose liveness we cannot check. */
  | 'external-backend-unverified';

// ─── Findings ────────────────────────────────────────────────────────────────

/** Where a finding is, precisely enough for an agent to open it. */
export interface LegacyLocation {
  /** Component full name, e.g. `/#Home`. */
  component?: string;
  /** Node id in the SOURCE project. Node ids are re-keyed on import; see
   *  {@link ImportReport.nodeIdMap}. */
  nodeId?: string;
  /** Node label, when the source had one — survives re-keying, unlike the id. */
  nodeLabel?: string;
  /** Project field path, for `project-field` findings, e.g. `deviceSettings`. */
  field?: string;
  /** Parameter name, for `user-code` findings. */
  parameter?: string;
}

/** A port or parameter that changed name, so an assistant knows what to re-point. */
export interface PortChange {
  from: string;
  to: string;
  /** Absent `to` means the port has no equivalent and its wire is lost. */
  note?: string;
}

/** One legacy construct and what became of it. */
export interface LegacyFinding {
  /**
   * Stable within a report, so a repair can be addressed by id and two reports
   * of the same project can be diffed. Derived from kind + location + original,
   * never from an array index.
   */
  id: string;
  kind: LegacyConstructKind;
  outcome: LegacyOutcome;
  reason: LegacyReason;
  /** What it was in the source, verbatim. For a node, its type name. */
  original: string;
  /** What it became, when the outcome changed it. */
  converted?: string;
  /** One sentence, addressed to a person. */
  message: string;
  /**
   * Where it is. Present on per-instance findings (every `placeholder` and every
   * `converted-with-changes` gets one, because each is a place someone has to
   * go). Absent on findings aggregated across a whole type — see
   * {@link occurrences}.
   */
  location?: LegacyLocation;
  /**
   * How many instances this finding covers. `1` (or absent) for a per-instance
   * finding. Deprecated-type notes are aggregated per type instead of per node:
   * 47 identical "this node is deprecated" entries is noise, and the note is
   * about the *type*, not about any one instance.
   */
  occurrences?: number;
  /** Up to a handful of places an aggregated finding was seen. */
  sampleLocations?: LegacyLocation[];
  /**
   * Catalog type names an assistant should consider, best first. Read from the
   * enriched catalog's `enrichment.relatedNodes` — LIB-006 does not maintain a
   * second copy of that mapping. Empty when the catalog knows of none.
   */
  equivalents: string[];
  /** Ports whose names differ between `original` and `equivalents[0]`. */
  portChanges?: PortChange[];
  /**
   * What to do. `'rebuild'` is a legitimate value — for a small construct with
   * no equivalent, rebuilding is genuinely cheaper than repairing.
   */
  recommendation?: string;
  /**
   * The outcome looks like it needs attention but does not.
   *
   * `thumbnailURI` is the case this exists for: it is genuinely `dropped` — the
   * taxonomy's test says so, and hiding it would be the silent drop this task
   * removes — but the launcher regenerates it, so nothing is lost. Listing it to
   * an assistant under "these are rebuilds, not repairs" would be false, and an
   * assistant that spends a turn on it is an assistant that stops being trusted.
   *
   * It still appears in the report and in the counts. It is only excluded from
   * the hand-off's action lists.
   */
  benign?: true;
}

// ─── The rebuild verdict ─────────────────────────────────────────────────────

export type VerdictRecommendation = 'proceed' | 'repair' | 'rebuild';

export interface RebuildVerdict {
  recommendation: VerdictRecommendation;
  /** Share of assessed constructs that converted (with or without changes), 0–1. */
  fidelity: number;
  /** Nodes in the imported set — the size term in the rebuild calculus. */
  nodeCount: number;
  /** Constructs that need a human or an assistant: placeholders + drops. */
  unconvertedCount: number;
  /** The specific facts that produced the recommendation. */
  reasons: string[];
  /** The verdict as one paragraph, addressed to the user. */
  message: string;
}

// ─── The assistant hand-off ──────────────────────────────────────────────────

/**
 * The report addressed to an AI assistant. Deliberately explicit about which
 * capabilities it may assume, because `COMPATIBILITY-POLICY.md` says "the
 * assistant will fix it" is only an acceptable answer *because* these exist.
 */
export interface AssistantHandoff {
  /** Findings an assistant can plausibly repair, by id. */
  repairable: string[];
  /** Findings nothing can repair — the honest list. */
  unrepairable: string[];
  /** Catalog type names the assistant will need details for, deduplicated. */
  catalogTypes: string[];
  /** How to attempt a repair, in this editor. Rendered into the Markdown too. */
  instructions: string[];
}

// ─── The report ──────────────────────────────────────────────────────────────

export const IMPORT_REPORT_FORMAT_VERSION = '1' as const;

/** Where the report is written inside the imported project. */
export const IMPORT_REPORT_JSON_PATH = 'import-report.json';
export const IMPORT_REPORT_MARKDOWN_PATH = 'IMPORT-REPORT.md';

/**
 * The node metadata key an import writes onto every construct it could not
 * convert. Its presence is what promotes a node from SUB-006's `unknown-node-type`
 * *warning* to LIB-006's `legacy-import-placeholder` **error** — "the importer
 * knows this one could not be converted" is a stronger statement than "this type
 * is not in the catalog right now".
 */
export const LEGACY_IMPORT_METADATA_KEY = 'legacyImport';

/** What the import writes into `node.metadata[LEGACY_IMPORT_METADATA_KEY]`. */
export interface LegacyImportMarker {
  /** The finding id in the report, so the node and the entry cross-reference. */
  findingId: string;
  /** The node's type as authored. Redundant with `node.type` on purpose: the
   *  type is what makes the node unresolvable, and a future repair that rewrites
   *  the type must still be able to say what it was. */
  originalType: string;
  reason: LegacyReason;
  /** ISO timestamp of the import that placed the marker. */
  importedAt: string;
}

export interface ImportReport {
  reportFormatVersion: typeof IMPORT_REPORT_FORMAT_VERSION;
  generatedBy: 'LIB-006';
  generatedAt: string;
  source: {
    dir: string;
    projectName?: string;
    /** The source's `project.json` `version`, before the upgrader chain. */
    projectVersion?: string;
  };
  target: {
    projectName?: string;
  };
  counts: Record<LegacyOutcome, number>;
  /**
   * The no-silent-drops proof, as arithmetic rather than as a promise.
   * `constructsAssessed === counts.converted + counts['converted-with-changes']
   * + counts.placeholder + counts.dropped` must hold, and a test asserts it:
   * every construct the importer looked at landed in exactly one outcome.
   *
   * `silentlyConverted` is the difference between constructs assessed and
   * findings emitted — nodes whose type is current and which therefore earn a
   * tally rather than an entry. It is named, not implied, so a reader can see
   * that the missing entries are accounted for.
   */
  coverage: {
    constructsAssessed: number;
    findingsEmitted: number;
    silentlyConverted: number;
  };
  findings: LegacyFinding[];
  verdict: RebuildVerdict;
  handoff: AssistantHandoff;
  /**
   * Source node id → target node id, for the placeholders. `apply` re-keys every
   * imported node, so a finding's `location.nodeId` (a source id) does not
   * address anything in the target without this. Absent when the report was
   * produced by `analyze` alone, before any re-keying happened.
   */
  nodeIdMap?: Record<string, string>;
}

// ─── Catalog access (injected, so the assessment core stays pure) ────────────

/**
 * The three questions the assessment asks the catalog. Injected rather than
 * imported so `assess()` is unit-testable without loading the real catalog —
 * and so a test can construct a catalog state that does not exist today.
 */
export interface CatalogTypeQuery {
  hasType(typeName: string): boolean;
  isDeprecated(typeName: string): boolean;
  /** `enrichment.relatedNodes` for the type, best first; `[]` when unknown. */
  relatedNodes(typeName: string): string[];
}
