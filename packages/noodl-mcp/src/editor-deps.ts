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
  // DEF-003 (b) — see the editor-side note: one sentence, two doors.
  noBoxExit,
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
  dedupeDiagnostics,
  // DEF-002 §1(b)/§1(c) — the adapter-minted `in-…`/`out-…`/`pm-…` names, from
  // the same views the interface index is built from.
  derivedPortIndices,
  diagnosticKey,
  isBlockingForAuthoredOutput,
  looksLikePageComponent
} from '../../noodl-editor/src/editor/src/validation';
export type {
  AuthoredNode,
  AuthoredPortLike,
  AuthoredPreconditionOptions,
  ComponentNodesView,
  DerivedPortIndex,
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
// DEF-009 — the shape of `nodegx.security.json`'s `functions` block, as the
// shared `checkPublicWriteDoor` precondition reads it.
export type { FunctionSecurityPolicy } from '../../noodl-editor/src/editor/src/validation';

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

// ─── Creation defaults (DEF-025) ──────────────────────────────────────────────
// Richard's ruling of 2026-08-30 is "flip at creation, in BOTH doors", and this
// import is what makes that one decision rather than two. The module is
// deliberately import-free — it is the editor's own node-seed decision layer —
// so it costs this package nothing to pull in, and the alternative (a second
// copy of the toggle list on the MCP side) is precisely the drift that would
// have the door emit graphs its own validator warns about.
export { planCreationDefaults, LABEL_TARGET_CONTROLS } from '../../noodl-editor/src/editor/src/models/nodeSeed/newNodeSeed';
export type { NewNodeSeed, SeedableNode } from '../../noodl-editor/src/editor/src/models/nodeSeed/newNodeSeed';

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
export {
  reconstructLegacyComponent,
  toLegacyName,
  unflattenNodes
} from '../../noodl-editor/src/editor/src/io/ProjectImporter';
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

// ─── The user profile (FIX-021 slice B) ───────────────────────────────────────
// The pure `profileText` submodule only — never `UserProfile/index`, which pulls
// `install` and with it `@noodl/platform`. `profileText` imports exactly one
// thing, `docsText`'s truncator, which is already vetted above as importing
// nothing at all.
//
// Same argument as the doctrine blocks: the profile an external agent is handed
// and the profile the in-editor authoring turn is given are rendered by the SAME
// function, so the empty-file rule, the comment stripping, the dropped-heading
// rule and the 2,000-character cap cannot become two dialects. A second renderer
// here is how "NodeGX read my preferences" would start meaning two things.
export {
  PROFILE_CAP,
  PROFILE_FILE,
  PROFILE_TEMPLATE,
  profileSections,
  renderProfileForPrompt
} from '../../noodl-editor/src/editor/src/models/UserProfile/profileText';
export type { ProfileSection } from '../../noodl-editor/src/editor/src/models/UserProfile/profileText';

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

// SB-002, same containment rule again: the backend idiom the prefab library
// already practices, taught nowhere until phase 76. A result field rather than
// `instructions` prose — the surface budget gate measures instructions, and a
// result rides free (see the module header).
export { BACKEND_DOCTRINE_MD } from '../../noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/backend';

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
  renderMcpJson,
  upgradeAgentConfigForDocs
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
// FIX-008 D — `quoteArg` joins them for the same reason and on the same
// evidence. `open_project`'s already-bound refusal emits a registration command
// the user pastes into a terminal, and the default project location on this
// machine has a space in it: unquoted, the command silently points the runtime
// at the first word of the path. The Windows-vs-POSIX escaping in there is a
// rule nobody should discover twice.
export {
  authoringServerName,
  projectSlug,
  quoteArg
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

// 🔴 The one **value** in this section, and it is deliberate. Engine 2 has two
// adapters — this package's (spawns the render CLI over a project on disk) and
// the editor's (drives a hidden Electron window over the running viewer) — and
// they must not disagree about what "it drew something" means: the `min`-not-
// `sum` aggregation across viewports is the safety property engine 2 exists for,
// not a detail of either machinery. `lessondrawncount.ts` imports **nothing at
// all**, so sharing it costs this bundle a dozen lines and no transitive weight.
export {
  BLANK_RENDER,
  countDrawnElements,
  renderDefectCodes,
  reportsBlankRender
} from '../../noodl-editor/src/editor/src/models/lessondrawncount';
export type {
  MeasuredViewportLike,
  RenderFindingLike
} from '../../noodl-editor/src/editor/src/models/lessondrawncount';

// ─── UNI-010's lesson harness (phase 67, slice 2) ────────────────────────────
// The F1–F4 gate, shared rather than forked — which is UNI-007's own requirement
// ("the same verifier, not a fork") finally collected by a second caller. The
// `create_lesson` tool runs the identical scorecard the editor's install runs,
// and adds the one class the editor cannot answer: F4 needs a render, and only
// this package has the harness.
//
// 🔴 **These are bundle-clean, and that took a change to make true.** Every
// module here is a pure function of files-in / findings-out, but
// `lessonbundleverify` reaches the condition evaluator, and until slice 2 that
// evaluator built its live-editor context behind a `require` *inside a function*
// — a trick that makes a module loadable in plain Node and does nothing whatever
// for a bundler, which resolves the literal path regardless. Importing this from
// here dragged in `projectmodel`, the node graph, React and `.scss`, and esbuild
// failed outright. The live half now lives in `lessonevalconditions.live.ts` and
// nothing on this path can reach a renderer.
//
// ⚠️ The rule generalises to every future entry in this file: "it only requires
// Electron lazily" is not a purity argument here. Build it and see.
export {
  formatBundleScorecard,
  verifyLessonBundle
} from '../../noodl-editor/src/editor/src/models/lessonbundleverify';
export type {
  FailureClassResult,
  LessonBundleFinding,
  LessonBundleScorecard
} from '../../noodl-editor/src/editor/src/models/lessonbundleverify';
// UNI-010 — the starter derived from the solution by subtraction. Pure, and
// bundle-clean by the same route `lessonbundleverify` is: it reaches the
// evaluator and `pageRegistration`, both of which this path already pulls in.
//
// ✅ **Measured, not asserted** — the fifth amendment in RULINGS.md is precisely
// about a purity claim in a module header that nobody could falsify. Two builds
// on 2026-08-16, the control produced by neutralising this export and the tool
// registration so esbuild tree-shakes both modules away:
//
//   without  5,917,637 bytes    `deriveLessonStarter` absent — a real control
//   with     5,936,471 bytes    +18,834, and that is this slice's own two modules
//
// `readRouterPagesValue` and `ROUTER_NODE_TYPES` are already in the **control**
// bundle (3 occurrences each), so nothing new is dragged in — the delta is source
// and comments, not a dependency.
export {
  danglingReferences,
  deriveLessonStarter
} from '../../noodl-editor/src/editor/src/models/lessonstarter';
export type {
  DeriveStarterResult,
  RetractionKind,
  StarterRetraction
} from '../../noodl-editor/src/editor/src/models/lessonstarter';
// CN-003 slice 4 — the bundle vocabulary. Nothing new is dragged in: this
// module's `lessonverify` export already pulls the catalog and `@nodegx/kit-catalog`
// is already on this path via `kitExtract`. ✅ Re-measured after adding these,
// by the rule the note above sets: build it and see.
export { bundleLessonVocabulary, verifyLessonManifest } from '../../noodl-editor/src/editor/src/models/lessonverify';
export type {
  LessonVerificationReport,
  LessonVocabulary,
  UnresolvedKits
} from '../../noodl-editor/src/editor/src/models/lessonverify';
export { catalogWithOverlay } from '../../noodl-editor/src/editor/src/validation/catalog';
export { buildLessonEvalContext } from '../../noodl-editor/src/editor/src/models/lessonprojectcontext';
export type { LessonProjectSource } from '../../noodl-editor/src/editor/src/models/lessonprojectcontext';
// TUT-002 AC3 — the database snapshot, shared rather than twinned. This is the arc's "one
// evaluator, never forked" claim extended to the data side: the editor and this server read the
// *same two routes* through the same narrowing, and the decisions that matter — a count that is
// not a number leaves `rowCount` absent, an unmatched binding is refused by name — are made in
// one file. Only the transport differs (Electron IPC there, `BackendClient` here).
//
// ✅ Bundle-clean, and by construction rather than by claim: `lessondatabase.ts` imports the
// evaluator's types and `lessonformat`, both of which this path already carries, and nothing
// else. The half that reaches `ipcRenderer` and `ProjectModel` is `lessondatabase.live.ts`,
// which nothing here names.
export {
  classifyLessonBackend,
  collectionNamesInComponents,
  columnNamesFrom,
  lessonObservesDatabase,
  readLessonDatabaseSnapshot,
  rowCountFromQueryResponse,
  tablesFromSchemaResponse
} from '../../noodl-editor/src/editor/src/models/lessondatabase';
export type {
  LessonBackendBinding,
  LessonBackendTarget,
  LessonDatabaseReader
} from '../../noodl-editor/src/editor/src/models/lessondatabase';
export type {
  LessonCollection,
  LessonDatabaseSnapshot
} from '../../noodl-editor/src/editor/src/views/lessons/lessonevalconditions';
export {
  MANIFEST_FILE,
  readLessonBundle,
  readLessonProject,
  SOLUTION_DIR
} from '../../noodl-editor/src/editor/src/models/lessonbundleread';
export type { LessonBundleFs } from '../../noodl-editor/src/editor/src/models/lessonbundleread';
// `LESSON_CONDITION_VERBS` is the whole author-facing vocabulary, declared rather than described.
// It is what lets a spec here prove the authoring brief documents every verb that exists — the
// surface a model reads had been two verbs behind the compiler with nothing to notice, and a verb
// nobody was told about is a verb nobody can use.
export { compileConditions, LESSON_CONDITION_VERBS } from '../../noodl-editor/src/editor/src/models/lessonformat';
export type {
  LessonConditionDef,
  LessonManifest,
  LessonStepDef
} from '../../noodl-editor/src/editor/src/models/lessonformat';
// The install gate's policy table, so the producer and the installer cannot
// disagree about what an AI-authored bundle owes. `create_lesson` refuses to
// *write* a bundle the editor would refuse to install.
export {
  decideInstall,
  REQUIRED_CLASSES,
  resolveProvenance
} from '../../noodl-editor/src/editor/src/models/lessoninstallpolicy';

// ── CN-017: the kit provenance store ─────────────────────────────────────────
// 🔴 Shared rather than twinned, because there are TWO scaffold routes — the
// editor's Kits section and this server's `create_node_kit` — and a kit written
// by one of them showing "origin not recorded" while the other says "written
// here" would be a difference in the record with no difference in the fact.
// `projectmodules` is fs/vm/http only; no Electron reaches this file.
export { recordKitProvenance } from '../../noodl-editor/src/shared/utils/projectmodules';
export type { KitProvenance } from '../../noodl-editor/src/shared/utils/projectmodules';

// ── DEF-011 (SB-010): the script-port derivation the door was missing ────────
// `cloudDynamicPorts.ts` is the editor's import-free clone of the runtime's
// `JavascriptNodeParser` grammar, pinned against the real runtime modules by
// `tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts`. Re-exported
// so the authored write path can persist the ports a `JavaScriptFunction`'s
// script declares — the same derivation the exporter's `withScriptPorts`
// backstop and the editor's `CloudDynamicPortsAdapter` already use, so three
// consumers cannot drift.
export { scriptPortsForNode } from '../../noodl-editor/src/editor/src/models/nodelibrary/cloudDynamicPorts';
export type { GeneratedPort } from '../../noodl-editor/src/editor/src/models/nodelibrary/cloudDynamicPorts';

// ── VIB-003: the installed icon sets, and the ONE function that builds a value ─
// 🔴 Shared rather than restated, and this is the sharpest case in this file.
// `iconValueForGlyph` is where a chosen glyph becomes a stored parameter — two
// of its three fields come from the set's manifest, and FB-019 measured what
// happens when something guesses them instead (a blank glyph, having reported
// success). The door now advertises icon values to authoring models; if it built
// them itself, the door and the picker would be two functions that agree until
// somebody installs a set with the opposite `codeAsClass`. `iconsets.ts` imports
// only `projectmodules`' types, and `scanModuleManifestsSync` is fs-only.
export { toIconSets, iconValueForGlyph } from '../../noodl-editor/src/shared/utils/iconsets';
export type { IconSetDescriptor, IconSetValue } from '../../noodl-editor/src/shared/utils/iconsets';
export { scanModuleManifestsSync } from '@nodegx/module-inject';
