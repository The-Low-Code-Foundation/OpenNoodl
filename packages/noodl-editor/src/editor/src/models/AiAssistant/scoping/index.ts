/**
 * AIX-012 — AI project creation: describe an app at the launcher, agree its
 * scope in conversation, and get a documented project with a plan you have not
 * run yet.
 *
 * NOTE for headless consumers (and for `noodl-mcp`): import `./scope` directly
 * rather than this barrel. `scope.ts` is pure — no `AiClient`, no filesystem,
 * no `ProjectModel` — while `ScopingSession` pulls the AI client and
 * `scopeDocs` pulls the platform filesystem. Same rule as the `ProjectDocs`
 * barrel and the `StyleTokensModel/StyleVocabulary` submodule.
 *
 * @module AiAssistant/scoping
 */

export {
  DEFAULT_PROVISIONED_BACKEND_NAME,
  DOC_INITIAL_SCOPE,
  PLAN_FENCE_TAG,
  TODO_MARKER,
  backendNameForProject,
  emptyScope,
  mergeScope,
  normalizeScopeBackend,
  pageComponentPath,
  pageLegacyCandidates,
  planFromScope,
  provisionFromScope,
  renderArchitecture,
  renderBrief,
  renderConventions,
  renderScopeRecord,
  scopeBackendDescription,
  scopeDocuments,
  scopeHasContent,
  scopeOutline
} from './scope';
export type {
  PlanFromScopeOptions,
  ProjectScope,
  ScopeBackend,
  ScopeCollection,
  ScopeDocument,
  ScopeObject,
  ScopePage,
  ScopeRecordInput,
  ScopeRejection,
  ScopeTranscriptEntry
} from './scope';

export { RECORD_SCOPE, SCOPING_TOOLS, scopingOpeningMessage, scopingSystemPrompt } from './prompts';

export { SCOPING_EFFORT, ScopingSession, toScopePatch } from './ScopingSession';
export type { ScopingChatFn, ScopingOptions, ScopingTurn, ScopingTurnStatus } from './ScopingSession';

export { writeScopeDocs } from './scopeDocs';
export type { WriteScopeDocsInput, WriteScopeDocsResult } from './scopeDocs';

export { peekPendingScopePlan, setPendingScopePlan, takePendingScopePlan } from './pendingPlan';
export type { PendingScopePlan } from './pendingPlan';

// AIB-003 — the slow path behind the destructive `take`: the plan is durable in
// `docs/decisions/000-initial-scope.md` and, until this, nothing read it back.
export { parseRecordedPlan, parseRecordedTranscript, recoverScopePlan } from './recoverPlan';
export type { RecoveredScopePlan, RecoverScopePlanOptions } from './recoverPlan';
