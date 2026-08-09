/**
 * BLD-001 — the Build panel's thread model.
 *
 * Pure: no React, no `ProjectModel`, no editor singleton. The React half lives
 * in `views/panels/AiAuthoringPanel/thread/`, and the boundary is what lets the
 * mapping be pinned in `tests-unit/bld-001/` rather than only inside a real
 * Electron renderer.
 *
 * ⚠️ BLD-006 adds `ThreadStore`, which is a `Model` and therefore not a pure
 * function — but it keeps the property that matters: no filesystem, no
 * Electron, no `ProjectModel`, so it runs in the same plain-Node runner.
 * `ThreadSidecar` and `installThreadPersistence` are the two modules that reach
 * a disk and an open project, and they are deliberately **not** exported here —
 * importing this barrel must never drag Electron in.
 *
 * @module AiAssistant/thread
 */

export {
  acceptLabel,
  decisionOwner,
  DISCARD_LABEL,
  ON_CANVAS_NOTE,
  ON_REVIEW_NOTE,
  REVIEW_LABEL
} from './decisions';
export type { DecisionOwner } from './decisions';
export { classifyPlan, decideIntent, summarisePlan } from './intent';
export type { IntentDecision } from './intent';
export {
  ALIVE_MS,
  DEFAULT_QUIET_MS,
  liveness,
  QUIET_FRACTION,
  quietThreshold,
  silenceNote
} from './liveness';
export type { Liveness, LivenessInput, LivenessState } from './liveness';
export { collapseActivities, isCollapsible, MIN_RUN_LENGTH, runDuration, summariseRun } from './messages';
export type { MessageKind, ThreadItem } from './messages';
export { outcomeSentence, stagedComponentCard } from './outcomeCard';
export type { OutcomeCardText } from './outcomeCard';
export {
  authoringDetail,
  completedDurations,
  estimateRemaining,
  formatCost,
  formatDuration,
  formatEstimate,
  MIN_ESTIMATE_SAMPLES,
  operationRole,
  runHeadline,
  runPosition,
  runTrack,
  stopCost
} from './runProgress';
export type { OperationRole, RunTrack } from './runProgress';
export {
  byRecency,
  emptyThread,
  isWorthWriting,
  parseThreadFile,
  serialiseThread,
  THREAD_FILE_VERSION,
  threadLabel,
  threadTitle,
  threadWhen,
  TITLE_MAX,
  UNTITLED
} from './threadRecord';
export type { ThreadRecord } from './threadRecord';
export { THREADS_CHANGED, ThreadStore } from './ThreadStore';
export type { ThreadPersistence, ThreadsState } from './ThreadStore';
export {
  acceptedTurn,
  componentTurns,
  composeThread,
  docsTurns,
  freezeTurns,
  liveTurns,
  planTurns,
  retiredTurns,
  retireLive,
  sessionNote
} from './turns';
export type { ComponentTurnOptions, DocsTurnOptions, LiveSources, PlanTurnOptions } from './turns';
export type { BuildIntent, Turn, TurnActivity, TurnOutcome, TurnPlanSummary } from './types';
