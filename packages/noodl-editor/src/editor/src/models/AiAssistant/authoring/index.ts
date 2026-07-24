/**
 * AIX-002 — The Authoring Loop: public surface
 *
 * Headless loop only (spec step 1): context assembly, the agent loop, the
 * validation gate, and staged files in the outcome. Staging into the live
 * project, accept/refine/reject, and the conversation UI build on this.
 *
 * @module AiAssistant/authoring
 */

export * from './types';
export { buildCandidate, newId, pathToLegacyName } from './candidate';
export type { CandidateResult } from './candidate';
export { validateCandidateComponent } from './validate';
export { AuthoringContextBuilder, DEFAULT_BUDGET } from './ContextBuilder';
export { AUTHORING_TOOLS, GET_COMPONENT, GET_NODE_TYPES, SUBMIT_COMPONENT } from './tools';
export { AuthoringSession, AuthoringSetupError } from './AuthoringSession';
export type { AuthoringChatFn, AuthoringSessionOptions } from './AuthoringSession';
export { initialUserMessage, systemPrompt } from './prompts/authoring';
