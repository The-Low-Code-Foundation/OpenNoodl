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
  authoredNodes,
  authoredPreconditionDiagnostics,
  componentInterfaces,
  connectedInputs,
  declaredUrlPaths,
  diagnosticKey,
  isBlockingForAuthoredOutput
} from './authoredCandidate';
export type {
  AuthoredNode,
  AuthoredPreconditionOptions,
  ComponentNodesView,
  StoredConnectionLike,
  StoredNodeLike
} from './authoredCandidate';
// AAQ-005 — an instance port with no `plug` is inert, and nothing checked it.
export { checkInstancePorts } from './instancePorts';
export type { AuthoredPortLike, CheckInstancePortsOptions, PortDeclaringNode } from './instancePorts';
// LAS-001 — an instance parameter that reaches a port that exists.
export {
  checkComponentPortDirection,
  checkInstanceInterfaces,
  componentInterfaceIndex,
  COMPONENT_PORT_TYPES
} from './componentInterface';
export type {
  CheckComponentPortDirectionOptions,
  CheckInstanceInterfacesOptions,
  ComponentInterface,
  ComponentInterfaceIndex,
  ComponentInterfaceView
} from './componentInterface';
// LAS-007 — the recipe that fixes a rejection, attached to the rejection. Lives
// beside the checks that produce the diagnostics so both clients read one table.
export { citationFor, DIAGNOSTIC_EXAMPLES, exampleAttachments } from './diagnosticExamples';
export type { AttachedExample, CatalogExampleLike, ExampleCitation } from './diagnosticExamples';
// AAQ-005 — the one authoring vocabulary, rendered into both clients' schemas.
export {
  AUTHORED_CONNECTION_FIELDS,
  AUTHORED_NODE_FIELDS,
  AUTHORED_PAYLOAD_FIELDS,
  AUTHORED_PORT_FIELDS,
  AUTHORING_SURFACES,
  SURFACE_DIVERGENCES,
  VOCAB_CLIENTS,
  declaredDivergences,
  describeFor,
  fieldsFor,
  isRequiredIn,
  jsonSchemaForSurface,
  jsonSchemasFor,
  undeclaredDivergences
} from './authoringVocabulary';
export type {
  DeclaredDivergence,
  JsonSchemaNode,
  VocabClient,
  VocabField,
  VocabKind,
  VocabSurface
} from './authoringVocabulary';
export {
  checkParameterValues,
  portTypeShape,
  wireFormatFor,
  wireFormatHint,
  WIRE_FORMAT_LEGEND
} from './parameterValues';
export type { ParameterizedNode, PortTypeShape, WireFormat } from './parameterValues';
// LAS-012 — a Repeater that names a template component, and holds no children.
export { checkRepeaterTemplate, REPEATER_TYPE } from './repeaterTemplate';
export type { CheckRepeaterTemplateOptions, RepeaterNode } from './repeaterTemplate';
export { SemanticValidator, validateProject } from './SemanticValidator';
export { ALL_RULES } from './rules';
export type { Rule, RuleContext, ValidatorOptions } from './rules';
