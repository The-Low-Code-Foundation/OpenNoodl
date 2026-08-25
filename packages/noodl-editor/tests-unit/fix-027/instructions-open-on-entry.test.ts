import {
  INITIAL_INSTRUCTION_STATE,
  instructionDismissed,
  instructionOpenDecision
} from '../../src/editor/src/views/lessons/lessoninstructionopen';

/**
 * FIX-027 §17 — a task step must tell the learner what to do without being clicked.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEFECT: `LessonLayerView` passed `showPopupWhenSelected={hasConditions === false}`, so
 * a step opened its own instructions **only when it had nothing to grade** — which excludes
 * every task. Richard had to click each step to find out what it wanted.
 *
 * 🔴 AND THE FIX THAT LOOKS OBVIOUS IS WORSE THAN THE BUG. `LessonItem`'s effect depends on
 * `[isSelected, popupContent]`, and `loadSteps` rebuilds `popupContent` on every lesson reload —
 * which `refresh()` fires on every `Model.*` event, i.e. constantly while the learner works.
 * A flag that is simply inverted re-opens the popup on top of the graph the learner is editing.
 *
 * So the rows below are not "does it open" — they are **which of the many renders opens it**.
 * The re-render rows are the ones that matter; the first row would pass under the naive fix too.
 */

/** Every step in these rows has instructions unless a row says otherwise. */
const WITH_CONTENT = { isSelected: true, hasPopupContent: true };

describe('the instructions open on the way IN to a step', () => {
  it('opens when a step becomes the current one', () => {
    expect(instructionOpenDecision(INITIAL_INSTRUCTION_STATE, WITH_CONTENT).open).toBe(true);
  });

  it('🔴 does NOT re-open on the re-renders that follow, which is the whole point', () => {
    const entered = instructionOpenDecision(INITIAL_INSTRUCTION_STATE, WITH_CONTENT);
    expect(entered.open).toBe(true);

    // `refresh()` fires these on every Model event, each with a freshly built popupContent.
    let state = entered.next;
    for (let i = 0; i < 5; i++) {
      const again = instructionOpenDecision(state, WITH_CONTENT);
      expect(again.open).toBe(false);
      state = again.next;
    }
  });

  it('opens again for the NEXT step, so completing one shows the one after it', () => {
    // The step the learner leaves.
    const left = instructionOpenDecision({ wasSelected: true, dismissed: false }, {
      isSelected: false,
      hasPopupContent: true
    });
    expect(left.open).toBe(false);

    // A different step, with its own remembered state, becomes current.
    expect(instructionOpenDecision(INITIAL_INSTRUCTION_STATE, WITH_CONTENT).open).toBe(true);
  });

  it('never opens a step that has no instructions to show', () => {
    expect(
      instructionOpenDecision(INITIAL_INSTRUCTION_STATE, { isSelected: true, hasPopupContent: false }).open
    ).toBe(false);
  });

  it('never opens a step that is not the current one', () => {
    expect(
      instructionOpenDecision(INITIAL_INSTRUCTION_STATE, { isSelected: false, hasPopupContent: true }).open
    ).toBe(false);
  });
});

describe('a dismissal sticks', () => {
  it('stays shut for every later render of the same step', () => {
    const entered = instructionOpenDecision(INITIAL_INSTRUCTION_STATE, WITH_CONTENT);
    const dismissed = instructionDismissed(entered.next);

    let state = dismissed;
    for (let i = 0; i < 5; i++) {
      const again = instructionOpenDecision(state, WITH_CONTENT);
      expect(again.open).toBe(false);
      state = again.next;
    }
  });

  it('stays shut when the learner comes BACK to the step', () => {
    const dismissed = instructionDismissed({ wasSelected: true, dismissed: false });
    const leftIt = instructionOpenDecision(dismissed, { isSelected: false, hasPopupContent: true });
    const returned = instructionOpenDecision(leftIt.next, WITH_CONTENT);

    expect(returned.open).toBe(false);
  });

  /**
   * 🔴 The control for the row above. Re-entry must open an *undismissed* step, or "stays shut
   * on return" would be indistinguishable from "never opens on return at all" — and the second
   * would silently undo the fix for a learner who steps backwards through a lesson.
   */
  it('CONTROL: re-entry DOES open a step that was never dismissed', () => {
    const leftIt = instructionOpenDecision({ wasSelected: true, dismissed: false }, {
      isSelected: false,
      hasPopupContent: true
    });
    expect(instructionOpenDecision(leftIt.next, WITH_CONTENT).open).toBe(true);
  });

  it('dismissing does not read as leaving the step', () => {
    // If `instructionDismissed` cleared `wasSelected`, the very next render would look like a
    // fresh entry — and re-open what was just closed, on a step flagged dismissed.
    expect(instructionDismissed({ wasSelected: true, dismissed: false }).wasSelected).toBe(true);
  });
});
