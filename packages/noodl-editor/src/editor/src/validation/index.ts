/**
 * SUB-006 — Semantic Validator: public surface
 *
 * Editor/MCP-safe barrel: exports the rule engine, catalog index, diagnostics
 * model, and the in-memory adapter. It deliberately does NOT re-export
 * ./loadV2Project (which pulls in `fs`) — the CLI imports that module directly.
 *
 * @module noodl-editor/validation
 */

export * from './diagnostics';
export * from './model';
export { CatalogIndex, levenshtein, nearest } from './CatalogIndex';
export type { NodeCatalog, CatalogNode, CatalogPort, Plug } from './CatalogIndex';
export { defaultCatalog, loadDefaultCatalog } from './catalog';
export { fromLegacyProject, normalizeV2Component } from './normalize';
export type { LegacyProjectLike } from './normalize';
export {
  DELIBERATELY_BACKEND_FREE,
  NODES_REQUIRING_BACKEND,
  backendRequirementFor,
  checkBackendRequirements
} from './backendRequirement';
export type {
  BackendRequirement,
  BackendRequiringNode,
  CheckBackendRequirementsOptions,
  ProjectBackendFacts
} from './backendRequirement';
// AAQ-001 — a navigation that lands somewhere.
export { checkNavigation, checkPageShape, looksLikePageComponent, PAGE_NODE_TYPE } from './navigation';
export type { CheckNavigationOptions, CheckPageShapeOptions, NavigatingNode } from './navigation';
// AAQ-005 — the one authored-candidate gate, shared with noodl-mcp.
export {
  AUTHORED_BLOCKING_WARNINGS,
  authoredPreconditionDiagnostics,
  declaredUrlPaths,
  diagnosticKey,
  isBlockingForAuthoredOutput
} from './authoredCandidate';
export type { AuthoredNode, AuthoredPreconditionOptions, ComponentNodesView } from './authoredCandidate';
export {
  checkParameterValues,
  portTypeShape,
  wireFormatFor,
  wireFormatHint,
  WIRE_FORMAT_LEGEND
} from './parameterValues';
export type { ParameterizedNode, PortTypeShape, WireFormat } from './parameterValues';
export { SemanticValidator, validateProject } from './SemanticValidator';
export { ALL_RULES } from './rules';
export type { Rule, RuleContext, ValidatorOptions } from './rules';
