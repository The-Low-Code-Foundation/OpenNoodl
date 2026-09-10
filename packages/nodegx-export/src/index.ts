export * from './ir/types';
export { type Catalog, CatalogIndex, type CatalogNode, type CatalogPort, catalogPath, loadCatalog } from './catalog';
export { parseProject, EXPORTER_VERSION } from './parse/parseProject';
export { emitScaffold, routedPages, type ScaffoldPage } from './emit/scaffold';
export { planProject, parseIdentityMapping, type ComponentPlan, type ProjectPlan } from './analyze/plan';
export { computeNodeStyle, cssValue, CONTENT_PARAMS } from './emit/style';
export { assignClassNames, camelCase, pascalCase } from './emit/naming';
export { emitComponent } from './emit/component';
export { emitApp, type EmittedApp } from './emit/emitApp';
export {
  preflight,
  summarizePreflight,
  renderPreflight,
  type PreflightSummary,
  type PreflightAttention,
  type PreflightNoFile
} from './emit/preflight';
export {
  type ExportReportData,
  type ReportComponent,
  REPORT_PATH,
  renderReport,
  backendMode,
  type BackendMode,
  type NextStep,
  nextSteps,
  renderSteps,
  cascadeOf,
  type CascadeRoot,
  type ExportCascade,
  describeNode,
  pathwayVerdict,
  plainReason,
  refusedNodeLines
} from './emit/report';
export { isPathwayType } from './analyze/plan';
export { exportBadgeOf, ledgerEntryOf, exportCoverage, alphaNotice, type ExportBadge, type ExportCoverage, type ExportStatus, type LedgerEntry } from './ledger';
export { README_PATH, renderReadme, type ReadmeBackend } from './emit/readme';
export { emitKits, type EmittedCopy, type EmittedKits, type KitBinding } from './emit/kits';
export { parseModules } from './parse/parseModules';
export { runKitSource, type KitRunResult, type KitRunOutcome } from './parse/kitSource';
export {
  checkTarget,
  writeExport,
  type ExportOutput,
  type FsLike,
  type TargetVerdict,
  type WriteResult
} from './write/writeExport';
export { errorMessage } from './errorMessage';

/**
 * HLS-008 — the command itself, not the pieces it is made of.
 *
 * `export_react` over MCP is a third door onto the sequence `nodegx export` performs, and its
 * acceptance criterion is that the pre-flight it returns is **byte-identical** to the one the CLI
 * prints. Re-assembling the sequence from `parseProject` / `emitApp` / `summarizePreflight` /
 * `renderPreflight` above would satisfy that on the day it was written and drift the first time
 * either door grew a step — which is the failure AC2 exists to prevent, not a risk it tolerates.
 *
 * So the MCP tool calls **this**, with `argv` it builds and a {@link CliIO} that captures instead
 * of printing. Byte-identity is then structural rather than asserted: there is one sequence and it
 * is spelled once. The specs still drive each door separately, for the reason `cli/run.ts`'s
 * header gives about HLS-002.
 */
export { runCli, readableProject, lastWritten, PROJECT_FILE, type CliIO } from './cli/run';
export { EXIT, type ExitCode } from './cli/exitCodes';
export { parseArgs, type ParsedArgs, USAGE } from './cli/args';
