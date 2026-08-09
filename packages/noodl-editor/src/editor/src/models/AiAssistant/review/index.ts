/**
 * AIX-010 — Project review & docs retrofit.
 *
 * Read a project that was built by hand, and draft the AIX-009 `docs/` set from
 * what is already on the canvas — for review, never for a blind write.
 *
 * NOTE for headless consumers (`noodl-mcp`, the measurement harness): import
 * `./assembleProject`, `./pageMap`, `./selection`, `./prompts` and `./types`
 * directly. This barrel re-exports `./collectSources` and `./startProjectReview`
 * as well, and those pull `ProjectModel`, `BackendServices` and the platform
 * filesystem. Same rule as the `ProjectDocs` and `StyleVocabulary` barrels.
 *
 * @module AiAssistant/review
 */

export {
  assembleProjectReview,
  renderBackend,
  renderCoverageForPrompt,
  renderProjectReviewContext,
  REVIEW_BUDGET,
  summariseCoverage
} from './assembleProject';
export type { AssembleProjectReviewOptions } from './assembleProject';

export { buildPageMap, renderPageMap } from './pageMap';
export { inboundReferenceCounts, rankComponents } from './selection';

export {
  countTodoMarkers,
  REVIEW_DOC_PATHS,
  reviewSystemPrompt,
  reviewUserMessage,
  TODO_MARKER,
  todoAdvisoryMessage
} from './prompts';
export type { ReviewTurnInput } from './prompts';

export { MAX_REVIEW_DOC_CHARS, ReviewDocSession } from './ReviewDocSession';
export type { ReviewDocOptions, ReviewDocOutcome, ReviewDocRequest } from './ReviewDocSession';

export { authoredDrafts, ProjectReviewRun } from './ProjectReviewRun';
export type { ProjectReviewPhase, ProjectReviewRunOptions, ProjectReviewState } from './ProjectReviewRun';

export { PROJECT_REVIEW_CHANGED, ProjectReviewStore, REVIEW_SOURCE } from './ProjectReviewStore';

// ── BLD-008, the interview ────────────────────────────────────────────────────
//
// Pure: `interviewQuestions`, `interviewState` and `interviewPrompts` touch
// nothing but the templates. `InterviewSidecar` is Electron-side — it is under
// the note above with `collectSources`.
export { interviewQuestions, QUESTION_RULES, templateHeadingKeys, templateHeadings } from './interviewQuestions';
export type { InterviewQuestionSpec, QuestionRule } from './interviewQuestions';
export {
  answerOf,
  answeredFor,
  currentQuestion,
  decideProposal,
  emptyInterview,
  insertSkipTodos,
  interviewActivities,
  interviewFrom,
  interviewProgress,
  isInterviewComplete,
  nothingSkipped,
  recordAnswer,
  recordSkip,
  renderAnswersForPrompt,
  renderSkipsForPrompt,
  reopen,
  skipTodoLines,
  skippedFor
} from './interviewState';
export type {
  InterviewAnswer,
  InterviewAnswerStatus,
  InterviewQuestion,
  InterviewState,
  ProposedDoc
} from './interviewState';
export { answersBlock, INTERVIEW_TOOLS, interviewSystemPrompt, interviewUserMessage, SUBMIT_INTERVIEW } from './interviewPrompts';
export { InterviewSession, proposedDocPath } from './InterviewSession';
export type { InterviewOutcome, InterviewSessionOptions } from './InterviewSession';
export { INTERVIEW_FILE_VERSION, InterviewSidecar, parseInterviewFile, serialiseInterview } from './InterviewSidecar';

export { dismissReviewBanner, isReviewBannerDismissed, REVIEW_BANNER_DISMISSED_KEY } from './bannerDismissal';

// Electron-side only — see the note above.
export { collectBackendSummary, collectProjectReviewSources, readDeclaredRoutes } from './collectSources';
export { buildBackendSummary, collectionsFromCachedSchema } from './backendSummary';
export { ProjectReviewSetupError, resumableInterview, stageReviewDrafts, startProjectReview } from './startProjectReview';
export type { StagedReviewDraft, StartProjectReviewOptions } from './startProjectReview';

export { REVIEW_DOC_ORDER } from './types';
export type {
  BackendSummary,
  ComponentKind,
  CoverageRead,
  CoverageSkipped,
  CoverageSource,
  DeclaredRoute,
  NavigationEntry,
  PageMap,
  PageMapEntry,
  PageSource,
  ProjectReviewBlock,
  ProjectReviewContext,
  ProjectReviewCoverage,
  ProjectReviewDraft,
  ProjectReviewSources,
  RankedComponent,
  ReviewDocKind,
  ReviewDraftStatus,
  RouterEntry,
  SchemaCollection,
  SchemaField
} from './types';
