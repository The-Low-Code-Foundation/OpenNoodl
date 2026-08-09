/**
 * BLD-001 — the Build panel's thread model.
 *
 * Pure: no React, no `ProjectModel`, no editor singleton. The React half lives
 * in `views/panels/AiAuthoringPanel/thread/`, and the boundary is what lets the
 * mapping be pinned in `tests-unit/bld-001/` rather than only inside a real
 * Electron renderer.
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
export { collapseActivities, isCollapsible, MIN_RUN_LENGTH, summariseRun } from './messages';
export type { MessageKind, ThreadItem } from './messages';
export {
  acceptedTurn,
  componentTurns,
  composeThread,
  docsTurns,
  freezeTurns,
  liveTurns,
  planTurns,
  retireLive,
  sessionNote
} from './turns';
export type { ComponentTurnOptions, DocsTurnOptions, LiveSources, PlanTurnOptions } from './turns';
export type { BuildIntent, Turn, TurnActivity, TurnOutcome, TurnPlanSummary } from './types';
