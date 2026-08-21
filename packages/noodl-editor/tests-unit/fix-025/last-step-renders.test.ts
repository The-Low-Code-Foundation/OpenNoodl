/**
 * FIX-025 — finishing a lesson must not make the lesson disappear.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEFECT THIS GUARDS, FOUND BY DRIVING THE INSTALLED LESSON ON 2026-08-21.
 *
 * `LessonLayer.refresh()` chose between "advance to the next step" and "render", and the
 * advance branch does not render. `LessonModel.next()` is a no-op once
 * `index >= numberOfLessons - 1`, so a **complete final step** advanced nothing and rendered
 * nothing — permanently, because every subsequent `refresh()` made the same choice. Observed in
 * the editor as an empty `<div class="lessonlayerview">` with the whole lesson bar gone.
 *
 * ⚠️ **The reason no test caught it is worth more than the test.** The state needs a graded
 * step that is BOTH last AND satisfied, and until 11a repaired `findNodeWithPath` no graded step
 * in the shipped *State on a page* lesson could be satisfied at all — so the state was
 * unreachable in the product and absent from every fixture. Fixing the grading is what created
 * the failure. A fix that is only read cannot find that; this one was driven.
 *
 * The rows below are named for the shipped lessons, so a change to either is checked against
 * what a learner actually meets rather than against invented numbers.
 */
import { stepFlowAction, type StepFlowInput } from '../../src/editor/src/views/lessons/lessonstepflow';

/** A graded step that is satisfied — the only shape that can ever advance. */
function completeGradedStep(overrides: Partial<StepFlowInput> = {}): StepFlowInput {
  return { hasCurrentStep: true, hasConditions: true, isComplete: true, index: 0, stepCount: 4, ...overrides };
}

describe('the last step renders instead of advancing into nothing', () => {
  it('🔴 renders the FINAL step of "State on a page" when it completes, rather than advancing', () => {
    // 4 steps, learner on the last one (index 3), its `#Caption` condition now satisfied.
    // This is the exact state Richard's project was in, and the state that blanked the bar.
    expect(stepFlowAction(completeGradedStep({ index: 3, stepCount: 4 }))).toBe('render');
  });

  it('🔴 renders the FINAL step of "Log a thing" too — eight steps, not four', () => {
    expect(stepFlowAction(completeGradedStep({ index: 7, stepCount: 8 }))).toBe('render');
  });

  it('still advances from every step that HAS a next one — the known-firing control', () => {
    // Without this row the fix could be "never advance", which passes the two rows above and
    // breaks the lesson in the opposite direction: no step would ever tick over on its own.
    for (const index of [0, 1, 2]) {
      expect(stepFlowAction(completeGradedStep({ index, stepCount: 4 }))).toBe('advance');
    }
  });

  it('renders an incomplete step, last or not', () => {
    expect(stepFlowAction(completeGradedStep({ isComplete: false, index: 1, stepCount: 4 }))).toBe('render');
    expect(stepFlowAction(completeGradedStep({ isComplete: false, index: 3, stepCount: 4 }))).toBe('render');
  });

  it('renders a narrative step — a step with nothing to grade never advances itself', () => {
    // The welcome popup of "State on a page" and the closing popup of "Log a thing".
    expect(stepFlowAction(completeGradedStep({ hasConditions: false, index: 0, stepCount: 4 }))).toBe('render');
    expect(stepFlowAction(completeGradedStep({ hasConditions: false, index: 7, stepCount: 8 }))).toBe('render');
  });

  it('renders when the index has run past the steps, rather than reading off the end', () => {
    expect(stepFlowAction(completeGradedStep({ hasCurrentStep: false, index: 4, stepCount: 4 }))).toBe('render');
  });

  it('🔴 never advances a single-step lesson, whose only step is also its last', () => {
    expect(stepFlowAction(completeGradedStep({ index: 0, stepCount: 1 }))).toBe('render');
  });

  it('🔴 refuses to advance when the model has not counted its steps yet', () => {
    // `numberOfLessons` is undefined until the manifest is read; `lessonlayer2` passes 0 for
    // that. Advancing on a count of zero would call a `next()` that cannot move, which is the
    // original bug reached by a different road.
    expect(stepFlowAction(completeGradedStep({ index: 0, stepCount: 0 }))).toBe('render');
  });
});
