/**
 * LIB-006: legacy import assessment — best effort, honest report, AI repair.
 *
 * The counterpart obligation to `dev-docs/reference/COMPATIBILITY-POLICY.md`:
 * NodeGX is a fresh start, legacy projects import on a best-effort basis, and
 * what the importer cannot convert becomes a **visible marked node plus a report
 * entry addressed to the user's AI assistant** — never a shim, never a silent
 * drop.
 *
 * Layering, deliberately mirroring LIB-004's:
 *
 *   assess()             pure     ProjectData + catalog → findings
 *   applyLegacyTransforms() pure  report + live source → markers + the REST retype
 *   buildReport()        pure     findings → the one report object
 *   renderReportMarkdown() pure   that object → the human rendering
 *   computeVerdict()     pure     counts + size → proceed / repair / rebuild
 *   defaultCatalogQuery() shell   the bundled catalogs
 *   reactRemovalPatterns() shell  ProjectScanner's React 18→19 set
 *
 * The scope boundary is the committed inventory table,
 * `dev-docs/tasks/phase-21-library-and-import/LIB-006-LEGACY-CONSTRUCT-INVENTORY.md`.
 *
 * @module noodl-editor/utils/import-engine/legacy
 */

export * from './types';
export { assess } from './assess';
export type { AssessInput, AssessResult, LegacyCodePattern } from './assess';
export { buildReport, renderReportMarkdown, reportSummaryLine } from './report';
export type { BuildReportInput } from './report';
export {
  computeVerdict,
  tallyOutcomes,
  findingWeight,
  REBUILD_MAX_NODES,
  REBUILD_UNCONVERTED_SHARE
} from './verdict';
export type { VerdictInput } from './verdict';
export { applyLegacyTransforms } from './transforms';
export type { TransformResult, LiveNode, LiveComponent, LiveProject } from './transforms';
export { assessImport, writeImportReport } from './importAssessment';
export type { WriteReportResult } from './importAssessment';
export { defaultCatalogQuery } from './catalogQuery';
export { reactRemovalPatterns } from './codePatterns';
export {
  REMOVED_TYPES,
  removedType,
  DROPPED_PROJECT_FIELDS,
  REST_TYPE,
  HTTP_TYPE,
  REST_SCRIPT_PARAMETERS,
  REST_TO_HTTP_PORTS,
  REST_UNCARRIED_PARAMETERS
} from './constructs';
export type { RemovedType, DroppedProjectField } from './constructs';
