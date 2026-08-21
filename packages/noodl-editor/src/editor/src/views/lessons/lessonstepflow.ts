/**
 * FIX-025 — what `LessonLayer.refresh()` does once it knows how the current step is doing.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THIS EXISTS BECAUSE THE DECISION HAD A STATE IT COULD NOT EXPRESS, AND THAT STATE BLANKED
 * THE LESSON BAR PERMANENTLY.
 *
 * `refresh()` had two outcomes written as one `if`: a complete step advances, anything else
 * renders. On the **final** step that is wrong in a way nothing catches, because
 * `LessonModel.next()` returns without doing anything when `index >= numberOfLessons - 1`
 * (`models/lessonmodel.ts`). So the layer took the advance branch, advanced nothing, fired no
 * `instructionsChanged` — and, because advancing is the branch that does *not* render, never
 * called `_renderReact`. Every later `refresh()` made the same choice. The learner finishes the
 * lesson and the lesson vanishes: an empty `<div class="lessonlayerview">` and no way back.
 *
 * ⚠️ **Latent since the code was written; only reachable after 11a.** Found by driving the
 * installed *State on a page* lesson, 2026-08-21. While `findNodeWithPath` could not resolve a
 * `#label` segment below a graph root, none of that lesson's graded steps could complete, so
 * `isComplete` was never true on a last step and this branch was unreachable. Repairing the
 * grading is what exposed it — the argument for driving a fix rather than reading it.
 *
 * ⚠️ **A pure function, and in its own module, ON PURPOSE.** `lessonlayer2.ts` reaches
 * `PopupLayer`, `EventDispatcher` and the node graph, so nothing there is gradeable in the
 * jest runner. The rule that was wrong is arithmetic over three numbers; putting it where a
 * spec can call it is the difference between a regression guard and a comment saying there
 * ought to be one. See `tests-unit/fix-025/last-step-renders.test.ts`.
 *
 * @module views/lessons/lessonstepflow
 */

/** What `refresh()` should do next. */
export type StepFlowAction = 'advance' | 'render';

export interface StepFlowInput {
  /** Whether there is a current step at all. `false` once the index runs past the steps. */
  hasCurrentStep: boolean;
  /** Whether that step grades anything. A narrative step never advances itself. */
  hasConditions: boolean;
  /** Whether its conditions are satisfied right now. */
  isComplete: boolean;
  /** The step the learner is on. */
  index: number;
  /**
   * How many steps the *model* holds — `numberOfLessons`, not the layer's filtered `steps`
   * array. 🔴 They can differ: `loadSteps` drops steps with no renderable content, so counting
   * the filtered array would let the layer believe there is a step to advance to that
   * `LessonModel.next()` will refuse to move to, which is the original bug wearing a new hat.
   */
  stepCount: number;
}

/**
 * `'advance'` only when a satisfied, graded step has somewhere to advance *to*.
 *
 * 🔴 The last clause is the fix. Everything else returns `'render'`, including the case this
 * function exists for — a complete final step, which is shown in its completed state rather
 * than swapped for nothing.
 */
export function stepFlowAction(input: StepFlowInput): StepFlowAction {
  const { hasCurrentStep, hasConditions, isComplete, index, stepCount } = input;
  if (!hasCurrentStep || !hasConditions || !isComplete) return 'render';
  return index < stepCount - 1 ? 'advance' : 'render';
}
