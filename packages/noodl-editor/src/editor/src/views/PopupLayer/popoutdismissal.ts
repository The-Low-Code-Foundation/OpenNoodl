/**
 * P79 J2 — who a press belongs to, and whether the blocker should be up.
 *
 * 🔴 **This module exists because `popuplayer.ts` cannot be graded.** It imports
 * `electron` and React's DOM client, so the plain-Node jest runner in
 * `tests-unit/` fails to load it, and the only suite that can reach it is the
 * webpack+Electron jasmine bundle (`test:ci`) — a gate that needs the whole box
 * to itself and has gone unrun for several sessions at a stretch. The rules that
 * were wrong are decisions, not rendering, so they live here where a cheap
 * runner can hold them. Same reasoning as `lessons/lessonstepflow.ts`.
 *
 * ⚠️ **Deliberately DOM-free.** `tests-unit` runs `testEnvironment: 'node'`:
 * there is no `Element`, so there is no `closest`. {@link pressIsInsideKeptRegion}
 * therefore takes a `matches` predicate rather than an event target — the
 * renderer hands it `Element.closest`, a spec hands it a plain function, and the
 * decision being graded is the same one in both.
 *
 * ## What was wrong
 *
 * `showPopout` raised a full-screen blocker unconditionally. The blocker does
 * NOT dismiss anything — dismissal is the `pointerdown`/`pointerup` pair on
 * `document.body`, which fires wherever the press lands — and it is not what
 * makes the popout clickable either, since `.popup-layer-popout` sets its own
 * `pointer-events: all`. Its only effect is to EAT the press so the control
 * underneath never receives it.
 *
 * For the lesson instructions that was doubly wrong. `.popup-layer` is fixed,
 * 100vw x 100vh, z-index 10; `.lesson-bottombar` carries no z-index at all. So
 * while the instructions were open, CHECK MY WORK sat under the blocker:
 * pressing it dismissed the instructions and never reached the button, so no
 * grading pass ran. The learner lost the instructions and got no answer.
 */

export interface PopoutDismissalFacts {
  /**
   * Whether this popout puts the blocker over the editor.
   * `undefined` means it does — every caller that predates this option.
   */
  blockOutsideClicks?: boolean;
  /**
   * A CSS selector for a region that belongs to this popout without being
   * inside it. A press there is part of using the popout, not a gesture away
   * from it.
   */
  keepOpenWithin?: string;
}

/**
 * Does this popout put the blocker over the editor?
 *
 * 🔴 The default is `true`, and it has to be: ~20 call sites across the property
 * panel, the colour picker and the connection popups were written against a
 * blocker they never asked for, and flipping the default would change the first
 * click in all of them. Only a popout that says so opts out.
 */
export function popoutBlocksOutsideClicks(popout: PopoutDismissalFacts): boolean {
  return popout.blockOutsideClicks !== false;
}

/**
 * Should the blocker be up, given every popout still open?
 *
 * 🔴 The test this replaces was `popouts.length === 0`, which was the same
 * question only while every popout blocked. With one that does not, closing a
 * blocking popout while a non-blocking one remains would leave `length !== 0`
 * and strand the blocker over a live editor — the original defect, now with no
 * popout visible to explain it.
 */
export function blockerIsNeeded(popouts: readonly PopoutDismissalFacts[]): boolean {
  return popouts.some(popoutBlocksOutsideClicks);
}

/**
 * Is a press inside a region some live popout claims as its own?
 *
 * `matches(selector)` answers "does the press target, or an ancestor, match this
 * selector?" — `Element.closest` in the renderer.
 *
 * ⚠️ Read against the LIVE popout list on every press, never captured when the
 * listeners were bound: the popout owning the region opens and closes many times
 * over a lesson, and a captured list would keep answering for a popout that has
 * gone.
 */
export function pressIsInsideKeptRegion(
  popouts: readonly PopoutDismissalFacts[],
  matches: (selector: string) => boolean
): boolean {
  return popouts.some((popout) => !!popout.keepOpenWithin && matches(popout.keepOpenWithin));
}
