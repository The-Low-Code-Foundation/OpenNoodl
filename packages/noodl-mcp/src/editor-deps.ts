/**
 * Single import point for the pure format engines that live in noodl-editor.
 *
 * SUB-008 code-sharing decision (see docs/DESIGN.md): rather than duplicating
 * the format logic or prematurely extracting a shared package, this package
 * imports the editor's pure modules by relative path — the same pattern the
 * repo's CLIs use (scripts/validate-project.ts) — and esbuild bundles them into
 * the standalone artifact. One source of truth, zero duplication.
 *
 * Everything re-exported here is Electron-free by construction (verified: the
 * io/, schemas/ and validation/ modules import only each other and @noodl/types;
 * loadV2Project additionally uses fs/path, which is fine — this server is
 * Node-only).
 */

// ─── Validation (SUB-006) ─────────────────────────────────────────────────────
export {
  SemanticValidator,
  CatalogIndex,
  loadDefaultCatalog,
  formatDiagnosticLine,
  sortDiagnostics,
  buildComponentRefs,
  isComponentRef,
  refToPath,
  DiagnosticCode
} from '../../noodl-editor/src/editor/src/validation';

// ─── The authored-candidate gate (AAQ-005) ────────────────────────────────────
// The precondition checks and the blocking policy, shared rather than twinned.
//
// ⚠️ Until AAQ-005 these were absent from this package entirely — not applied
// laxly, absent. The write gate ran the SUB-006 semantic validator and nothing
// else, so every parameter-value diagnostic (about fifteen error-severity ones,
// `ConnectionOnlyParameter` among them), every unresolved navigation and every
// backend precondition was invisible to an agent driving Claude Code, while the
// same submission was rejected in the editor. AAQ-005 recorded this as a policy
// difference over shared rules; it was a missing import.
export {
  AUTHORED_BLOCKING_WARNINGS,
  authoredNodes,
  authoredPreconditionDiagnostics,
  componentInterfaces,
  // LAS-012 — which input ports carry a wire. The one thing this layer needs
  // that is not a value: a `template` fed by a connection is a working list.
  connectedInputs,
  declaredUrlPaths,
  diagnosticKey,
  isBlockingForAuthoredOutput,
  looksLikePageComponent
} from '../../noodl-editor/src/editor/src/validation';
export type {
  AuthoredNode,
  AuthoredPortLike,
  AuthoredPreconditionOptions,
  ComponentNodesView,
  ProjectBackendFacts,
  StoredConnectionLike,
  StoredNodeLike
} from '../../noodl-editor/src/editor/src/validation';
// AAQ-005 — the fifth precondition check. A declared instance port with no
// `plug` is inert (`getPorts` filters on it), so a Component Inputs node authored
// without one yields a component with no such input, silently. This package's
// port schema did not even declare the field until AAQ-005.
export { checkInstancePorts } from '../../noodl-editor/src/editor/src/validation';
// AWP-006 — the same reviewed table, used for a second decision. `Record` nodes
// in a graph already produce a backend precondition diagnostic; they now also
// reveal the backend tool group, so an agent is never in the position of having
// been told it needs a backend by a server that is not advertising the tool that
// makes one. One classification, both consequences.
export { backendRequirementFor } from '../../noodl-editor/src/editor/src/validation';

// ─── LAS-007: retrieval into the failure moment ───────────────────────────────
// The DiagnosticCode → example table, beside the checks that produce the
// diagnostics rather than in this client. Haiku never retrieved a recipe in 42
// turns; what is pushed gets read, what is offered does not.
export { citationFor, DIAGNOSTIC_EXAMPLES, exampleAttachments } from '../../noodl-editor/src/editor/src/validation';
export type {
  AttachedExample,
  CatalogExampleLike,
  ExampleCitation
} from '../../noodl-editor/src/editor/src/validation';

// ─── The authoring vocabulary (AAQ-005) ───────────────────────────────────────
// What an agent may say about a node, a port, a connection and a submission —
// one table, rendered into this package's zod schemas by `src/vocabulary.ts` and
// into the editor's JSON Schema by `authoring/tools.ts`.
//
// ⚠️ Grep before believing the next claim of this shape. Slice 1's lesson was
// that "shares the rules via a barrel" is a claim about a specific export list;
// this is the third time the two doors turned out to disagree about something the
// task file assumed was shared. Here it was `children` and `variant` (accepted
// only by this package) and `plug` on an instance port — never declared here at
// all, and the field that decides whether the port exists: `getPorts(filter)`
// selects on `p.plug`, so a port without one is inert and the component silently
// has no such input or output.
export {
  AUTHORED_COMMENT_FIELD,
  AUTHORED_CONNECTION_FIELDS,
  AUTHORED_NODE_FIELDS,
  AUTHORED_PAYLOAD_FIELDS,
  AUTHORED_PORT_FIELDS,
  AUTHORING_SURFACES,
  STORED_COMMENT_KEY,
  SURFACE_DIVERGENCES,
  VOCAB_CLIENTS,
  declaredDivergences,
  describeFor,
  fieldsFor,
  // LEG-001 — the fold/unfold pair for the one authored field whose storage name
  // is not its authored one (`comment` ⇄ `metadata.comment`). Shared rather than
  // reimplemented here for the same reason the table is: two doors, one mapping,
  // or the flat field means something different depending which door you came
  // through.
  foldNodeComment,
  isRequiredIn,
  jsonSchemaForSurface,
  jsonSchemasFor,
  metadataWithComment,
  undeclaredDivergences,
  unfoldNodeComment
} from '../../noodl-editor/src/editor/src/validation';
export type {
  DeclaredDivergence,
  JsonSchemaNode,
  VocabClient,
  VocabField,
  VocabKind,
  VocabSurface
} from '../../noodl-editor/src/editor/src/validation';

// The editor's own binding of the gate, exported for the parity spec rather than
// for production use — `gateParity.test.ts` runs both bindings over one candidate
// and fails if they disagree, which is what makes "one gate" a checked claim
// instead of a comment. It is pure (v2 files in, diagnostics out; the project
// arrives as an `ExplainGraph`), so importing it here costs nothing at runtime.
export { validateCandidateComponent } from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/validate';
export type {
  CandidateValidation,
  ComponentFiles as EditorComponentFiles
} from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/types';
export type {
  Diagnostic,
  ValidationReport,
  ValidatorOptions,
  NormProject,
  NormComponent,
  NodeCatalog,
  CatalogNode,
  CatalogPort
} from '../../noodl-editor/src/editor/src/validation';
export { normalizeV2Component } from '../../noodl-editor/src/editor/src/validation/loadV2Project';

// ─── Page registration (AAQ-001, shared by AAQ-005) ───────────────────────────
// Which router a new page belongs in, whether the app should now open on it, and
// what to tell the user it did. Pure by construction — `pageRegistration.ts`
// imports nothing but the `validation` barrel it re-exports two names from.
//
// ⚠️ This was the other half of the AAQ-005 gap, and the sharper half. Slice 1
// gave this package the gate's `checkNavigation`, which resolves a Navigate
// target against the project's **component names** — sound in the editor only
// because the editor's apply then registers the page in a Router. Bound to a
// client whose apply did not, the check passed a page that no router listed:
// `create_component` wrote it, the gate approved it, and the app could not reach
// it. Finding #5 verbatim, surviving in the external door after Layer 1 closed
// it in the editor. That module's own header still says "`noodl-mcp` has no plan
// transaction at all" — stale since AIX-011; what it lacked was this.
export {
  chooseRouter,
  describePageRegistration,
  findRoutersInComponents,
  isPlaceholderPageGraph,
  isSamePage,
  PAGE_NODE_TYPE,
  pageDisplayName,
  planPageRegistration,
  readRouterPagesValue,
  resolvePageRegistration,
  ROUTER_NODE_TYPES
} from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/pageRegistration';
export type {
  PageRegistration,
  RegistrationComponent,
  RegistrationNode,
  RouterLocation,
  RouterPagesValue
} from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/pageRegistration';

// ─── The layout pass (FIX-014) ────────────────────────────────────────────────
// Fills the position gaps a model left and separates exact collisions — never
// moving a node the model positioned, never touching a human's arrangement
// (ruled 2026-08-14: model-supplied x/y is authoritative). Pure by
// construction: `layout.ts` imports only types from the editor's schemas.
// Shared rather than twinned for the same reason as everything above — two
// producers of the project format, one rule for where an unpositioned node
// lands, or "the AI piles nodes in one column" gets fixed in one client and
// survives in the other.
export {
  layoutAuthoredNodes,
  positionsUnchangedFrom,
  COLLISION_STEP,
  HIERARCHY_INDENT_X,
  LOGIC_COLUMN_GUTTER,
  ROW_SPACING,
  VISUAL_COLUMN_TOP,
  VISUAL_COLUMN_X
} from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/layout';
export type {
  LayoutAuthoredNodesOptions,
  LayoutConnectionLike
} from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/layout';

// ─── Schemas + structural validator (STRUCT-001) ──────────────────────────────
export { SchemaValidator, SCHEMA_IDS, formatValidationErrors } from '../../noodl-editor/src/editor/src/schemas';
export type {
  ProjectV2File,
  ComponentV2File,
  NodesV2File,
  ConnectionsV2File,
  NodeV2,
  NodePort,
  ConnectionV2,
  RegistryV2File,
  RegistryComponentEntry,
  RoutesV2File,
  StylesV2File,
  PortDefinition,
  ValidationError
} from '../../noodl-editor/src/editor/src/schemas';

// ─── io helpers (STRUCT-002) ──────────────────────────────────────────────────
export { legacyNameToPath, inferComponentType } from '../../noodl-editor/src/editor/src/io/ProjectExporter';

// ─── The round trip itself (AWP-002) ──────────────────────────────────────────
// The editor's own reader and writer for a component's three v2 files. Both are
// pure — they import *types* from `../schemas` and nothing else — so the
// conformance gate can run the editor's real reconstruct-and-re-export in a node
// process rather than paraphrasing it, which is the whole point: `render-from-disk`
// paraphrased this contract by hand and its own header records that doing so cost
// two phases of certifying a page the editor cannot render.
//
// ⚠️ These two are *not* the editor's full pipeline, and the gap is load-bearing.
// A real editor save runs the legacy component through `NodeGraphModel`, whose
// `toJSON()` derives `visualRoots` via `getVisualRootIds()`. That model imports
// NodeLibrary, UndoQueue, WarningsModel and EventDispatcher, so it cannot be
// reached from here — which means `reconstructLegacyComponent → buildComponentV2Files`
// is a **fixed point for `visualRoots`** (absent in, absent out) and the structural
// diff alone is blind to F43. Verified by running it, 2026-08-08. That is why
// AWP-002 §2's reader-agreement check exists and is not optional.
export { reconstructLegacyComponent, unflattenNodes } from '../../noodl-editor/src/editor/src/io/ProjectImporter';
export { buildComponentV2Files } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
export type { ComponentV2Files } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
export type { LegacyComponent, LegacyNode } from '../../noodl-editor/src/editor/src/io/ProjectExporter';

// ─── Style vocabulary (AIX-006) ───────────────────────────────────────────────
// Pure submodules only (StyleVocabulary/ProjectTokenCss/DefaultTokens/
// ElementConfigs) — never the StyleTokensModel barrel, which pulls ProjectModel
// and Electron. Verified Electron-free: these import only each other + the
// element config data.
export {
  buildStyleVocabulary,
  renderStyleVocabulary,
  listVocabularyPresets
} from '../../noodl-editor/src/editor/src/models/StyleTokensModel/StyleVocabulary';
export type {
  StyleVocabulary,
  VocabComposition,
  VocabCompositionGroup,
  VocabElement,
  VocabParamValue,
  VocabPreset,
  VocabToken,
  VocabTokenCategory
} from '../../noodl-editor/src/editor/src/models/StyleTokensModel/StyleVocabulary';
// DSG-005 — the compositions themselves, so a tool can name one without
// rebuilding the vocabulary. Same containment rule: StyleCompositions imports
// nothing at all.
export { STYLE_COMPOSITIONS } from '../../noodl-editor/src/editor/src/models/StyleTokensModel/StyleCompositions';
export {
  buildEffectiveTokens,
  readStoredTokens,
  STYLE_TOKENS_METADATA_KEY
} from '../../noodl-editor/src/editor/src/models/StyleTokensModel/ProjectTokenCss';
export type { MetaDataSource } from '../../noodl-editor/src/editor/src/models/StyleTokensModel/ProjectTokenCss';
export type {
  StyleTokenRecord,
  StyleTokensData,
  TokenCategory
} from '../../noodl-editor/src/editor/src/models/StyleTokensModel/TokenCategories';
export { getPreset, getAllPresets } from '../../noodl-editor/src/editor/src/models/StylePresets/StylePresetsModel';
export type { StylePreset } from '../../noodl-editor/src/editor/src/models/StylePresets/StylePresetTypes';

// ─── Project docs (AIX-009) ───────────────────────────────────────────────────
// The pure `docsText` submodule only — never the ProjectDocs barrel, which
// pulls ProjectModel, the platform filesystem and the undo queue. `docsText`
// imports nothing at all, so the containment rules the editor enforces and the
// ones the MCP write tool enforces are literally the same function.
export {
  assertInsideDocs,
  describeDoc,
  docBody,
  DocPathError,
  DOCS_DIR,
  DOC_ARCHITECTURE,
  DOC_BRIEF,
  DOC_CONVENTIONS,
  DOC_DECISIONS_DIR,
  KNOWN_DOCS,
  normalizeDocPath,
  parseDocFrontMatter
} from '../../noodl-editor/src/editor/src/models/ProjectDocs/docsText';
export type {
  DocDescriptor,
  DocInjection,
  KnownDoc,
  KnownDocKind
} from '../../noodl-editor/src/editor/src/models/ProjectDocs/docsText';
export { DOC_TEMPLATES } from '../../noodl-editor/src/editor/src/models/ProjectDocs/templates';

// ─── Decomposition doctrine (AAQ-008) ─────────────────────────────────────────
// `prompts/decomposition` imports NOTHING, same containment rule as docsText —
// so the doctrine an external agent reads out of `get_project_info` and the one
// the in-editor planner is prompted with are literally the same bytes. AAQ-005's
// rule applied to a text rather than a schema: one substrate, two clients, and
// no second dialect of "prefer components".
export {
  DECOMPOSITION_AUTHORING,
  DECOMPOSITION_DOCTRINE_MD,
  DECOMPOSITION_PLANNING
} from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/decomposition';

// Phase 54, same containment rule and the same reason: the design doctrine an
// external agent reads out of `get_project_info` must be the same bytes the
// in-editor prompts carry, or "make it look designed" becomes two dialects.
export {
  DESIGN_AUTHORING,
  DESIGN_DOCTRINE_MD,
  DESIGN_PLANNING
} from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design';

// LAS-007 §3 — the traps, ahead of the doctrine, in the one channel a mid-tier
// model measurably reads. Same containment rule: `prompts/traps` imports nothing.
export { AUTHORING_TRAPS } from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/traps';

// ─── Project review (AIX-010) ─────────────────────────────────────────────────
// The pure half of the docs retrofit only. `review/assembleProject`,
// `review/pageMap`, `review/selection` and `review/prompts` import nothing
// beyond the catalog, the explain graph and `ProjectDocs/docsText` — never the
// `review` barrel, which re-exports `collectSources` and `startProjectReview`
// and would drag `ProjectModel`, `BackendServices` and the platform filesystem
// in. Same rule as StyleVocabulary and docsText above.
//
// `reviewSystemPrompt` is exported deliberately: `review_project` returns the
// EDITOR's per-document guidance rather than a second copy of it, so the "never
// describe the graph" line cannot drift between the two consumers.
export {
  assembleProjectReview,
  renderCoverageForPrompt,
  renderProjectReviewContext,
  REVIEW_BUDGET,
  summariseCoverage
} from '../../noodl-editor/src/editor/src/models/AiAssistant/review/assembleProject';
export { buildPageMap, renderPageMap } from '../../noodl-editor/src/editor/src/models/AiAssistant/review/pageMap';
export {
  inboundReferenceCounts,
  rankComponents
} from '../../noodl-editor/src/editor/src/models/AiAssistant/review/selection';
export {
  countTodoMarkers,
  REVIEW_DOC_PATHS,
  reviewSystemPrompt,
  reviewUserMessage,
  TODO_MARKER
} from '../../noodl-editor/src/editor/src/models/AiAssistant/review/prompts';
export { REVIEW_DOC_ORDER } from '../../noodl-editor/src/editor/src/models/AiAssistant/review/types';
export type {
  BackendSummary,
  CoverageRead,
  CoverageSkipped,
  CoverageSource,
  DeclaredRoute,
  PageMap,
  PageMapEntry,
  ProjectReviewContext,
  ProjectReviewCoverage,
  ProjectReviewSources,
  RankedComponent,
  ReviewDocKind,
  SchemaCollection,
  SchemaField
} from '../../noodl-editor/src/editor/src/models/AiAssistant/review/types';
// `graphComponentFromFiles` adapts stored component files into the graph shape
// the assembler reads. AIX-011 imports it by relative path from `planTools`;
// naming it here too would give one module two import spellings, so this is now
// the one place it is exported from.
export { graphComponentFromFiles } from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/plan';
export type {
  ExplainGraph,
  GraphComponent,
  GraphConnection,
  GraphNode
} from '../../noodl-editor/src/editor/src/models/AiAssistant/explain/types';

// ─── Legacy import report (LIB-006) ──────────────────────────────────────────
// Pure: `report.ts` builds and renders, `types.ts` is types only. The fs-backed
// reader (`loadReport.ts`) is deliberately NOT re-exported — it pulls the
// editor's Electron filesystem wrapper, and this server reads the file itself.
export { renderReportForAssistant, renderReportMarkdown } from '../../noodl-editor/src/editor/src/utils/import-engine/legacy/report';
export { IMPORT_REPORT_FORMAT_VERSION, IMPORT_REPORT_JSON_PATH } from '../../noodl-editor/src/editor/src/utils/import-engine/legacy/types';
export type { ImportReport, LegacyFinding, LegacyOutcome } from '../../noodl-editor/src/editor/src/utils/import-engine/legacy/types';

// ─── What a new project tells the next agent (BST-005) ───────────────────────
// Pure: `agentConfig.ts` imports nothing at all, deliberately, because it is
// reached from here. It renders the two files and owns the never-overwrite rule;
// the filesystem arrives as a three-method host, so this server writes with `fs`
// and the editor writes with `@noodl/platform` over one implementation.
export {
  AGENT_CONFIG_PATHS,
  backfillAgentConfig,
  installAgentConfig,
  renderClaudeMd,
  renderMcpJson
} from '../../noodl-editor/src/editor/src/models/template/agentConfig';
export type {
  AgentConfigFileResult,
  AgentConfigHost,
  AgentConfigOptions,
  AgentConfigReport,
  AgentServerRegistration
} from '../../noodl-editor/src/editor/src/models/template/agentConfig';
// ⚠️ The registration NAME, from the module that owns the rule and its tests.
// `mcpCommands.ts` lives under the renderer's settings panel but imports nothing
// whatsoever, which is what makes it reachable from here — and the alternative,
// a second slugger, is exactly the drift TALK-004 decision 4 exists to prevent.
// 🔴 F94: the per-project name is load-bearing in project scope too — a
// user-scope `nodegx` shadows a project-scope `nodegx` silently.
export {
  authoringServerName,
  projectSlug
} from '../../noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands';

// ─── UNI-007's engine-2 port (phase 67) ──────────────────────────────────────
// The lesson grading runner asks two questions, and keeps them in two engines.
// Engine 1 — "has the learner done step 4?" — is a pure evaluator that stays in
// the editor and is never reimplemented here; that is the whole point of the
// separation, so it is deliberately *not* re-exported. Engine 2 — "is what they
// built a working app, and does it draw?" — is an injected port, and this
// package holds the only thing that can answer it: `validate_project`'s
// validator and the render harness.
//
// 🔴 **Types only, and that is load-bearing.** `export type` erases at compile
// time, so nothing from `lessongrading.ts` reaches the bundle and the
// Electron-free-by-construction rule above is untouched. The dependency runs the
// other way at runtime: the editor (or a sidecar) constructs the adapter from
// `lessons/wholeSolutionGrader` and hands it *in*.
export type {
  WholeSolutionGrader,
  WholeSolutionResult
} from '../../noodl-editor/src/editor/src/models/lessongrading';
