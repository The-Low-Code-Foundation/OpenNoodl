/**
 * FIX-027 §17 — when a step's own instructions open themselves.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEFECT, IN RICHARD'S WORDS (2026-08-21):
 *
 * *"The first 'task' step doesn't show its tooltip, so I have to manually click it to know what
 * to do next… initially it should show up automatically when you enter the tutorial, or when you
 * have just completed a previous step, so the user always sees what they should do next.
 * You should be able to dismiss the tooltip, but initially it should show up automatically."*
 *
 * ## The mechanism existed and was pointed the wrong way
 *
 * `LessonLayerView` passed `showPopupWhenSelected={hasConditions === false}` — so a step opened
 * its own instructions **only when it had nothing to grade**. Every *task* has conditions, so
 * the steps that tell a learner what to do were exactly the steps that stayed silent.
 *
 * ## 🔴 Why inverting that flag is not the fix
 *
 * `LessonItem`'s effect runs on `[isSelected, popupContent]`, and `loadSteps` builds a **fresh**
 * `popupContent` element on every lesson reload — which `refresh()` triggers on every `Model.*`
 * event. So an unconditional flag re-opens the popup *while the learner is working in the graph
 * it is covering*, over and over. A popup that reopens on top of you is worse than one that
 * never opens, and it is the failure a naive fix produces.
 *
 * ✅ **The trigger is a step TRANSITION, not a render.** This function is given the previous
 * answer and the current facts, and it opens the instructions on the edge where the step becomes
 * selected — not on the renders that follow it.
 *
 * ✅ **And a dismissal sticks.** `manualClose` is false for a task step (`LessonItem.jsx`), so an
 * outside click already closes the popout; what was missing is that the closing had to be
 * *remembered*, or the next re-render would simply undo it. `dismissed` is carried per step, so
 * "shown once, dismissed, stays dismissed" holds across every later render of the same step —
 * and re-entering the step later does not re-open something the learner has put away.
 *
 * ⚠️ **A pure function in its own module, on purpose**, exactly as `lessonstepflow.ts` is:
 * `LessonItem.jsx` reaches `PopupLayer`, `ipcRenderer` and the DOM, so nothing there is
 * gradeable in the jest runner, while the rule that was wrong is a decision over four booleans.
 * See `tests-unit/fix-027/instructions-open-on-entry.test.ts`.
 *
 * @module views/lessons/lessoninstructionopen
 */

/** What one step remembers between renders. Owned by the item, decided here. */
export interface InstructionOpenState {
  /** Whether this step was the selected one the last time the decision ran. */
  wasSelected: boolean;
  /** Whether the learner has closed this step's instructions. Sticky, per step. */
  dismissed: boolean;
}

export interface InstructionOpenInput {
  /** Is this step the current one right now? */
  isSelected: boolean;
  /** Does this step have instructions to show at all? A step without them can never open one. */
  hasPopupContent: boolean;
  /**
   * FIX-027 §19 — is the lesson over?
   *
   * 🔴 **An open popout is not merely stale here, it is a BLOCKER.** `PopupLayer` puts a
   * full-screen dimmer behind every popout, so a step's instructions left open over the
   * completion banner make its *Start again* and *Exit lesson* buttons unclickable — measured
   * with `document.elementFromPoint`, which returned `popup-layer-blocker` at the middle of the
   * banner. The layer closes an already-open one on the edge into completion; this stops the
   * *other* path, where the learner **enters a lesson they have already finished** and the
   * entry edge would open instructions over the banner a moment after it was drawn.
   *
   * ⚠️ Two paths, because they are two different orderings and neither covers the other: the
   * close cannot reach a popout that does not exist yet, and this cannot close one that is
   * already open.
   */
  lessonFinished?: boolean;
}

export interface InstructionOpenDecision {
  /** Open this step's instructions now. */
  open: boolean;
  /** What to remember for the next render of this step. */
  next: InstructionOpenState;
}

/** What a step remembers before it has ever been rendered. */
export const INITIAL_INSTRUCTION_STATE: InstructionOpenState = { wasSelected: false, dismissed: false };

/**
 * Should this step open its own instructions on this render?
 *
 * Exactly one edge does it: **not selected → selected**, on a step that has instructions, that
 * the learner has not dismissed, and in a lesson that is not already over. Every other render —
 * including the many that arrive with a rebuilt `popupContent` while the step stays selected —
 * answers `false`.
 *
 * ⚠️ `lessonFinished` suppresses the open but is deliberately **not** recorded as a dismissal:
 * the learner has not put anything away, and treating it as though they had would leave the
 * step silent if they undid their work and returned to it.
 */
export function instructionOpenDecision(
  prev: InstructionOpenState,
  input: InstructionOpenInput
): InstructionOpenDecision {
  const entered = input.isSelected && !prev.wasSelected;
  const open = entered && input.hasPopupContent && !prev.dismissed && !input.lessonFinished;

  return { open, next: { wasSelected: input.isSelected, dismissed: prev.dismissed } };
}

/**
 * The learner closed this step's instructions.
 *
 * ⚠️ Deliberately does not clear `wasSelected`: dismissing is not leaving the step, and treating
 * it as though it were would let the very next render read as a fresh entry and re-open the thing
 * that was just closed.
 */
export function instructionDismissed(prev: InstructionOpenState): InstructionOpenState {
  return { wasSelected: prev.wasSelected, dismissed: true };
}
