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
  VocabElement,
  VocabPreset,
  VocabToken,
  VocabTokenCategory
} from '../../noodl-editor/src/editor/src/models/StyleTokensModel/StyleVocabulary';
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
  DocPathError,
  DOCS_DIR,
  DOC_ARCHITECTURE,
  DOC_BRIEF,
  DOC_CONVENTIONS,
  DOC_DECISIONS_DIR,
  KNOWN_DOCS,
  normalizeDocPath
} from '../../noodl-editor/src/editor/src/models/ProjectDocs/docsText';
export type { KnownDoc, KnownDocKind } from '../../noodl-editor/src/editor/src/models/ProjectDocs/docsText';
export { DOC_TEMPLATES } from '../../noodl-editor/src/editor/src/models/ProjectDocs/templates';

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
