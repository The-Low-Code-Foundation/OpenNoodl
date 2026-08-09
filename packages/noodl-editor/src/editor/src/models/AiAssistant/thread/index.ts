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

export { classifyPlan, decideIntent, summarisePlan } from './intent';
export type { IntentDecision } from './intent';
export {
  acceptedTurn,
  componentTurns,
  composeThread,
  docsTurns,
  freezeTurns,
  planTurns,
  sessionNote
} from './turns';
export type { ComponentTurnOptions, DocsTurnOptions, PlanTurnOptions } from './turns';
export type { BuildIntent, Turn, TurnActivity, TurnOutcome, TurnPlanSummary } from './types';
