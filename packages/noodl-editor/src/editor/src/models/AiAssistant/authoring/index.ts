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
export { acceptAuthoredComponent, StagingError, updateAuthoredComponent } from './staging';
export type { AcceptOptions } from './staging';
export { buildChangeSet, requiredWith, excludedWith } from './ChangeSet';
export type { AuthoringChangeSet, ReviewChange } from './ChangeSet';
export { buildReviewComponent } from './reviewComponent';
export { materializeSelection } from './applyChangeSet';
export type { MaterializedSelection } from './applyChangeSet';
export { initialUserMessage, refineMessage, styleAdvisoryMessage, systemPrompt, updateUserMessage } from './prompts/authoring';
export { countStyleValues, formatStyleFindings, styleLintCandidate } from './styleLint';
export type { StyleLint, StyleLintOptions } from './styleLint';
