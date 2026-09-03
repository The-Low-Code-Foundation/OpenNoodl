export * from './ir/types';
export { Catalog, CatalogIndex, CatalogNode, CatalogPort } from './catalog';
export { parseProject, EXPORTER_VERSION } from './parse/parseProject';
export { emitScaffold, routedPages, ScaffoldPage } from './emit/scaffold';
export { planProject, parseIdentityMapping, ComponentPlan, ProjectPlan } from './analyze/plan';
export { computeNodeStyle, cssValue, CONTENT_PARAMS } from './emit/style';
export { assignClassNames, camelCase, pascalCase } from './emit/naming';
export { emitComponent } from './emit/component';
export { emitApp, EmittedApp } from './emit/emitApp';
export {
  preflight,
  summarizePreflight,
  renderPreflight,
  PreflightSummary,
  PreflightAttention,
  PreflightNoFile
} from './emit/preflight';
export {
  ExportReportData,
  ReportComponent,
  REPORT_PATH,
  renderReport,
  backendMode,
  BackendMode,
  NextStep,
  nextSteps,
  renderSteps,
  cascadeOf,
  CascadeRoot,
  ExportCascade,
  describeNode,
  pathwayVerdict,
  plainReason,
  refusedNodeLines
} from './emit/report';
export { isPathwayType } from './analyze/plan';
export { exportBadgeOf, ledgerEntryOf, exportCoverage, alphaNotice, ExportBadge, ExportCoverage, ExportStatus, LedgerEntry } from './ledger';
export { README_PATH, renderReadme, ReadmeBackend } from './emit/readme';
export { emitKits, EmittedCopy, EmittedKits, KitBinding } from './emit/kits';
export { parseModules } from './parse/parseModules';
export { runKitSource, KitRunResult, KitRunOutcome } from './parse/kitSource';
