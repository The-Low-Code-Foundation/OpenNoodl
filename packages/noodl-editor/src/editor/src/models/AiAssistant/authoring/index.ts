/**
 * AIX-002 — The Authoring Loop: public surface
 *
 * The loop (spec step 1): context assembly, the agent loop, the validation
 * gate, and staged files in the outcome. Plus staging (spec step 3): accept
 * applies the staged candidate to the live project undoably; refine continues
 * the session's conversation; reject is the absence of an accept call.
 * The conversation UI builds on this.
 *
 * @module AiAssistant/authoring
 */

export * from './types';
export { buildCandidate, newId, pathToLegacyName } from './candidate';
export type { CandidateResult } from './candidate';
export { validateCandidateComponent } from './validate';
export { AuthoringContextBuilder, DEFAULT_BUDGET } from './ContextBuilder';
export { AUTHORING_TOOLS, GET_COMPONENT, GET_NODE_TYPES, SUBMIT_COMPONENT } from './tools';
export { AuthoringSession, AuthoringSetupError, AuthoringStateError } from './AuthoringSession';
export type {
  AuthoringActivity,
  AuthoringChatFn,
  AuthoringPhase,
  AuthoringSessionOptions,
  AuthoringSessionState,
  BuildingPreview,
  StagedSummary
} from './AuthoringSession';
export { PartialPayloadScanner } from './partial';
export type { PartialPayload } from './partial';
export { PreviewGraphBuilder, RevealQueue } from './preview';
export type { RevealItem } from './preview';
export {
  acceptAuthoredComponent,
  addAuthoredComponentToGroup,
  findProjectRouters,
  isPlaceholderPage,
  prospectivePageRegistration,
  registerAuthoredPagesInGroup,
  stagedComponentIsPage,
  stagedLegacyName,
  StagingError,
  updateAuthoredComponent,
  updateAuthoredComponentInGroup
} from './staging';
export type { AcceptOptions } from './staging';
// AAQ-001 — a page component is not a page until a Router lists it.
export {
  chooseRouter,
  describePageRegistration,
  looksLikePageComponent,
  PAGE_NODE_TYPE,
  pageDisplayName,
  planPageRegistration,
  ROUTER_NODE_TYPES
} from './pageRegistration';
export type {
  PageRegistration,
  PageRegistrationOptions,
  RouterLocation,
  RouterPagesValue
} from './pageRegistration';
// AIX-011 — project-scope authoring: one plan model (shared with noodl-mcp),
// the planning session, the fan-out orchestrator, and the all-or-nothing apply.
export {
  componentRefTargets,
  graphComponentFromFiles,
  orderPlanOperations,
  planExcludedWith,
  planOperationRequires,
  planRequiredWith,
  provisionSummary,
  renderPlanContext,
  renderPlanOutcome,
  validatePlan
} from './plan';
export type {
  AuthoringPlan,
  PlanOperation,
  PlanOperationKind,
  PlanOutcomeEntry,
  PlanProvisionCollection,
  PlanProvisionColumn,
  PlanProvisionSpec,
  StagedOperationLike
} from './plan';
export { PlanningSession } from './PlanningSession';
export type { PlanningOptions, PlanningOutcome, PlanningStatus } from './PlanningSession';
export { PlanRun } from './PlanRun';
export type { PlanOperationState, PlanOperationStatus, PlanRunOptions, PlanRunState, StagedDoc } from './PlanRun';
// AIB-003 — the plan, the run and every staged candidate outlive the view that
// renders them, because the Build panel unmounts it on a scope-tab click.
export { PlanSessionStore, PLAN_SESSION_CHANGED } from './PlanSessionStore';
export type { PlanApplyFailure, PlanSession, PlanSessionNote, PlanSessionPersistence } from './PlanSessionStore';
// AIB-003 slice 4 — the saved build. `PlanSessionSidecar` is the only piece here
// that touches a filesystem; the rules it writes through are pure.
export { PlanSessionSidecar } from './PlanSessionSidecar';
export {
  describeRestore,
  isWorthPersisting,
  parsePlanSessionSnapshot,
  PLAN_SNAPSHOT_VERSION,
  restoreOperations,
  snapshotSession
} from './planSessionSnapshot';
export type { PlanRunSnapshot, PlanSessionSnapshot } from './planSessionSnapshot';
// AIX-011 criterion 7 — the doc-authoring turn and its graph-restatement lint.
export { DocSession, MAX_DOC_CHARS } from './DocSession';
export type { DocSessionOptions, DocSessionOutcome, DocSessionRequest, DocSessionStatus } from './DocSession';
export { docLint } from './docLint';
export type { DocLint, DocLintFinding, DocLintOptions } from './docLint';
export {
  DOC_TOOLS,
  docAdvisoryMessage,
  docRepairMessage,
  docSystemPrompt,
  docUserMessage,
  SUBMIT_DOC
} from './prompts/docAuthoring';
export type { DocTurnInput } from './prompts/docAuthoring';
export { applyAuthoredPlan } from './planStaging';
export type {
  AppliedPlanComponentOperation,
  AppliedPlanDocOperation,
  AppliedPlanOperation,
  AppliedPlanProvisionOperation,
  AppliedPlanResult,
  ApplyPlanOptions,
  PlanBackendProvisioner,
  PlanDocWriter,
  ProvisionedBackend
} from './planStaging';
export { PLANNING_TOOLS, planningSystemPrompt, planningUserMessage, planRepairMessage, SUBMIT_PLAN } from './prompts/planning';
export { buildChangeSet, requiredWith, excludedWith } from './ChangeSet';
export type { AuthoringChangeSet, ReviewChange } from './ChangeSet';
export { buildReviewComponent } from './reviewComponent';
export { materializeSelection } from './applyChangeSet';
export type { MaterializedSelection } from './applyChangeSet';
export { initialUserMessage, refineMessage, styleAdvisoryMessage, systemPrompt, updateUserMessage } from './prompts/authoring';
export type { PromptProjectDocs } from './prompts/authoring';
// AIX-009: the pull-only project-doc read.
export { dispatchProjectDocTool, GET_PROJECT_DOC, projectDocToolLabel, projectDocTools } from './projectDocsTool';
export { countStyleValues, formatStyleFindings, styleLintCandidate } from './styleLint';
export type { StyleLint, StyleLintOptions } from './styleLint';
export { buildSandboxDataset, codeFields, discoverDataShape, unknownShapeNotice } from './sandboxData';
export type { BuildSandboxDatasetOptions } from './sandboxData';
export { buildSandboxExport, candidateComponent, candidateIsRenderable, componentClosure } from './sandboxExport';
export type { SandboxExport, SandboxExportOptions } from './sandboxExport';
