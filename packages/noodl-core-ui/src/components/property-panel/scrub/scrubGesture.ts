/**
 * FB-022 — the arithmetic and the state machine behind drag-to-scrub, with no React in it.
 *
 * ## Why this is a module and not just the body of the hook
 *
 * Everything worth grading about a scrub is a decision about numbers: when a press becomes a
 * drag rather than a click, how far one pixel moves the value, what a modifier does to that,
 * and what the value reads as afterwards. None of it needs a DOM, a pointer, or a render — so
 * none of it lives anywhere a runner cannot reach. `packages/noodl-editor/tests-unit` is
 * `testEnvironment: 'node'` and a component calling a hook throws there, so a `useDragToScrub`
 * with the arithmetic inside it would be a feature whose every rule was ungradeable.
 * {@link useDragToScrub} is the thin half: listeners, refs, cleanup.
 *
 * ## Two decisions that are easy to get subtly wrong
 *
 * 🔴 **The value is absolute in the gesture, never accumulated.** `value = start + dx * step`
 * where `dx` is the total displacement from the press, not the delta since the last mousemove.
 * Accumulating deltas drifts: every intermediate value gets rounded, the roundings add up, and
 * a drag out-and-back lands somewhere other than where it started. Absolute does not, and it
 * makes "drag back to where you pressed" restore the original value exactly.
 *
 * 🔴 **Modifiers compose multiplicatively.** Shift is x10 and alt is x0.1, so both together
 * are x1 — the ordinary step. That is the only composition rule that is associative and that
 * cannot produce a surprise: the alternative ("shift wins") makes the same two keys mean
 * different things depending on which the user happened to press first.
 */

/**
 * How far the pointer must travel before a press counts as a drag rather than a click.
 *
 * Measured in pixels of *horizontal* travel. Below it nothing is written and the press is
 * still on its way to being a focus-the-field click (AC2); at or above it the gesture is a
 * scrub and cannot go back to being a click.
 *
 * ⚠️ Three, not zero and not ten. Zero makes every click a one-pixel scrub — the field
 * commits a value nobody asked for and the undo stack grows on a click. Ten is past the
 * distance a hand moves while pressing a mouse button, so short deliberate nudges would be
 * eaten. Devtools and Figma both sit in this range.
 */
export const SCRUB_THRESHOLD_PX = 3;

/** x10 — the coarse ramp. */
export const SCRUB_SHIFT_SCALE = 10;
/** x0.1 — the fine ramp. Composes with shift to x1, see the module note. */
export const SCRUB_ALT_SCALE = 0.1;

/**
 * Units of value per pixel of travel, by the unit the field is showing.
 *
 * Every unit in the shipped catalog is here — `px`, `%`, `vw`, `vh`, `deg`, `em` and the
 * empty string (a unitless number-with-units port, which `flex-grow` declares) — measured
 * from `units: [...]` across `noodl-viewer-react`. A unit that is not in this table falls
 * back to 1 rather than throwing, because a kit can declare its own.
 *
 * ⚠️ `em` is the only one that is not 1. An em is a whole line of text: one-per-pixel makes
 * a 200px drag span 200 ems, which is not an edit anyone is trying to make. The others are
 * all "roughly a pixel on screen" or "a degree", where one-per-pixel is the identity the
 * gesture is trying to feel like.
 */
export const SCRUB_STEP_BY_UNIT: Readonly<Record<string, number>> = {
  '': 1,
  px: 1,
  '%': 1,
  vw: 1,
  vh: 1,
  deg: 1,
  em: 0.1,
  rem: 0.1
};

/** The per-pixel step for a unit, defaulting to 1 for anything the table does not name. */
export function scrubStepForUnit(unit?: string | null): number {
  if (unit === undefined || unit === null) return 1;
  const step = SCRUB_STEP_BY_UNIT[unit];
  return typeof step === 'number' ? step : 1;
}

export interface ScrubModifiers {
  shiftKey?: boolean;
  altKey?: boolean;
}

/** The multiplier a modifier combination applies to the step. See the module note. */
export function scrubModifierScale(modifiers?: ScrubModifiers): number {
  let scale = 1;
  if (modifiers?.shiftKey) scale *= SCRUB_SHIFT_SCALE;
  if (modifiers?.altKey) scale *= SCRUB_ALT_SCALE;
  return scale;
}

/**
 * How many decimals a step implies, so 50 + 3 * 0.1 reads as `50.3` and not
 * `50.300000000000004`.
 *
 * ⚠️ Read off the decimal *string*, not by counting divisions — `0.1` in binary is not
 * one tenth, and any loop that divides until the remainder is zero either never terminates
 * or terminates on the wrong count. Exponential notation (`1e-7`) is clamped rather than
 * parsed: nothing in the catalog is anywhere near it, and a step that small is not a step.
 */
export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step === 0) return 0;
  const text = String(Math.abs(step));
  if (text.includes('e') || text.includes('E')) return 6;
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : Math.min(text.length - dot - 1, 6);
}

/** Float cleanup: the value a step of this size is allowed to produce. */
export function quantizeToStep(value: number, step: number): number {
  const decimals = decimalsForStep(step);
  return decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));
}

/** One in-flight gesture. Created on press, discarded on release; never held across gestures. */
export interface ScrubGesture {
  /** The value the field held when the press landed — every emitted value is relative to it. */
  readonly startValue: number;
  /** Pointer x at the press. */
  readonly originX: number;
  /** Units per pixel before modifiers. */
  readonly step: number;
  /** Whether the threshold has been crossed. Latches true: a drag never becomes a click again. */
  moved: boolean;
}

export function beginScrubGesture(args: { startValue: number; originX: number; step: number }): ScrubGesture {
  return {
    startValue: Number.isFinite(args.startValue) ? args.startValue : 0,
    originX: args.originX,
    step: Number.isFinite(args.step) && args.step > 0 ? args.step : 1,
    moved: false
  };
}

export interface ScrubSample {
  /** True once the gesture has passed the threshold — the caller writes only when this is true. */
  moved: boolean;
  /** The value the field should now show. Meaningless while `moved` is false. */
  value: number;
}

/**
 * Where a pointer position puts the value.
 *
 * ⚠️ **Mutates `gesture.moved`** — the latch is the one piece of state a sample carries
 * forward, and threading it back through the caller was the version that let a mouseup
 * decide the gesture was a click because the last sample happened to be near the origin.
 */
export function scrubAt(gesture: ScrubGesture, clientX: number, modifiers?: ScrubModifiers): ScrubSample {
  const dx = clientX - gesture.originX;
  if (Math.abs(dx) >= SCRUB_THRESHOLD_PX) gesture.moved = true;

  const effectiveStep = gesture.step * scrubModifierScale(modifiers);
  // Absolute, not accumulated — see the module note. `dx` is an integer number of pixels, so
  // `dx * effectiveStep` is an exact multiple of the step and the only float noise to clean
  // up is the addition itself.
  return { moved: gesture.moved, value: quantizeToStep(gesture.startValue + dx * effectiveStep, effectiveStep) };
}
