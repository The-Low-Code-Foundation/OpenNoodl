/**
 * P79 J2 — pressing CHECK MY WORK while the instructions are open.
 *
 * The recorded row said the check "removes the instructions and says nothing
 * new". Re-derived from source, that is not what happens: the press never
 * reached the button at all. `.popup-layer` is fixed, 100vw x 100vh, z-index 10,
 * and carries a blocker with `pointer-events: all` whenever a popout is open;
 * `.lesson-bottombar` carries no z-index. So the press landed on the blocker,
 * which dismissed the popout (and `LessonItem.onClose` REMEMBERS the dismissal,
 * so it never reopened) while the button received nothing and no grading pass
 * ran. "Says nothing new" is what a check that never ran looks like.
 *
 * ⚠️ These rows grade the DECISIONS, in `views/PopupLayer/popoutdismissal.ts`.
 * They do not grade layout: that the blocker actually covers the button is a
 * claim about a running editor and is measured by driving it, not here.
 */
import {
  PopoutDismissalFacts,
  blockerIsNeeded,
  popoutBlocksOutsideClicks,
  pressIsInsideKeptRegion
} from '../../src/editor/src/views/PopupLayer/popoutdismissal';

/** What `LessonItem` asks for. */
const LESSON_POPOUT: PopoutDismissalFacts = {
  blockOutsideClicks: false,
  keepOpenWithin: '.lesson-bottombar'
};

/** What every call site that predates this option asks for: nothing. */
const ORDINARY_POPOUT: PopoutDismissalFacts = {};

describe('P79 J2 — a popout that does not own the screen', () => {
  describe('the blocker', () => {
    it('is raised for an ordinary popout', () => {
      // 🔴 The control that makes the rest mean anything. ~20 call sites across
      // the property panel, the colour picker and the connection popups were
      // written against a blocker they never asked for; if the default flipped,
      // this row is the one that would say so.
      expect(popoutBlocksOutsideClicks(ORDINARY_POPOUT)).toBe(true);
    });

    it('is raised for a popout that asks for it explicitly', () => {
      expect(popoutBlocksOutsideClicks({ blockOutsideClicks: true })).toBe(true);
    });

    it('is NOT raised for the lesson instructions', () => {
      expect(popoutBlocksOutsideClicks(LESSON_POPOUT)).toBe(false);
    });

    it('stays up while any remaining popout still wants it', () => {
      // 🔴 The test this replaces was `popouts.length === 0`. Closing the
      // blocking popout here leaves a non-blocking one, so `length !== 0` and
      // the blocker would have been stranded over a live editor — J2 again,
      // with nothing visible to explain it.
      expect(blockerIsNeeded([ORDINARY_POPOUT, LESSON_POPOUT])).toBe(true);
    });

    it('comes down when only non-blocking popouts remain', () => {
      expect(blockerIsNeeded([LESSON_POPOUT])).toBe(false);
    });

    it('comes down when nothing is open', () => {
      expect(blockerIsNeeded([])).toBe(false);
    });
  });

  describe('what counts as a press inside', () => {
    it('treats a press in the lesson bar as inside, so the instructions stay', () => {
      expect(pressIsInsideKeptRegion([LESSON_POPOUT], pressOn('.lesson-bottombar'))).toBe(true);
    });

    it('treats a press anywhere else as outside, so dismissal still works', () => {
      // Without this the fix would have replaced a popout you could not use
      // with one you could not put away.
      expect(pressIsInsideKeptRegion([LESSON_POPOUT], pressOn('.canvas'))).toBe(false);
    });

    it('claims nothing for a popout that named no region', () => {
      // An ordinary popout must not become undismissable by accident.
      expect(pressIsInsideKeptRegion([ORDINARY_POPOUT], () => true)).toBe(false);
    });

    it('claims nothing when no popout is open', () => {
      expect(pressIsInsideKeptRegion([], () => true)).toBe(false);
    });

    it('asks each live popout, not just the first', () => {
      expect(pressIsInsideKeptRegion([ORDINARY_POPOUT, LESSON_POPOUT], pressOn('.lesson-bottombar'))).toBe(true);
    });
  });

  describe('the two halves are independent, and J2 needed both', () => {
    it('a blocker opt-out alone would still throw the instructions away', () => {
      // The press reaches the button, the check runs — and the body listeners
      // still read it as outside, so the instructions close and stay closed.
      const blockerOnly: PopoutDismissalFacts = { blockOutsideClicks: false };
      expect(popoutBlocksOutsideClicks(blockerOnly)).toBe(false);
      expect(pressIsInsideKeptRegion([blockerOnly], pressOn('.lesson-bottombar'))).toBe(false);
    });

    it('a kept region alone would keep instructions the learner still cannot press through', () => {
      // The instructions survive, but the blocker is still over the button, so
      // the check still never runs — the half that made the row look cosmetic.
      const regionOnly: PopoutDismissalFacts = { keepOpenWithin: '.lesson-bottombar' };
      expect(popoutBlocksOutsideClicks(regionOnly)).toBe(true);
      expect(pressIsInsideKeptRegion([regionOnly], pressOn('.lesson-bottombar'))).toBe(true);
    });

    it('the lesson popout asks for both', () => {
      expect(popoutBlocksOutsideClicks(LESSON_POPOUT)).toBe(false);
      expect(pressIsInsideKeptRegion([LESSON_POPOUT], pressOn('.lesson-bottombar'))).toBe(true);
    });
  });
});

/**
 * Stands in for `Element.closest` — the renderer's own answer to "does the press
 * target, or an ancestor, match this selector?". Hoisted so both describes use
 * one definition.
 */
function pressOn(...selectorsThatMatch: string[]) {
  return (selector: string) => selectorsThatMatch.includes(selector);
}
