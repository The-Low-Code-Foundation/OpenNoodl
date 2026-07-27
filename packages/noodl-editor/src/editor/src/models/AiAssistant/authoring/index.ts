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
  stagedLegacyName,
  StagingError,
  updateAuthoredComponent,
  updateAuthoredComponentInGroup
} from './staging';
export type { AcceptOptions } from './staging';
// AIX-011 — project-scope authoring: one plan model (shared with noodl-mcp),
// the planning session, the fan-out orchestrator, and the all-or-nothing apply.
export {
  componentRefTargets,
  graphComponentFromFiles,
  orderPlanOperations,
  planExcludedWith,
  planOperationRequires,
  planRequiredWith,
  renderPlanContext,
  validatePlan
} from './plan';
export type { AuthoringPlan, PlanOperation, PlanOperationKind, StagedOperationLike } from './plan';
export { PlanningSession } from './PlanningSession';
export type { PlanningOptions, PlanningOutcome, PlanningStatus } from './PlanningSession';
export { PlanRun } from './PlanRun';
export type { PlanOperationState, PlanOperationStatus, PlanRunOptions, PlanRunState } from './PlanRun';
export { applyAuthoredPlan } from './planStaging';
export type {
  AppliedPlanComponentOperation,
  AppliedPlanDocOperation,
  AppliedPlanOperation,
  AppliedPlanResult,
  ApplyPlanOptions,
  PlanDocWriter
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
export { buildSandboxDataset, discoverDataShape } from './sandboxData';
export type { BuildSandboxDatasetOptions } from './sandboxData';
export { buildSandboxExport, candidateComponent, componentClosure } from './sandboxExport';
export type { SandboxExport, SandboxExportOptions } from './sandboxExport';
