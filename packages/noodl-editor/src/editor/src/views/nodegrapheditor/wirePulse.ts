/**
 * The travelling mark on a wire (SIG-005).
 *
 * One implementation, two triggers. Today the trigger is the running app: the
 * runtime reports which connections carried something in the last ~100 ms and
 * the connection painter draws a mark on each. SIG-006 wants the same mark on
 * *hover*, at design time, to answer "which way does this wire go" for a wire
 * whose ends are both off screen. Both go through here so that there is never
 * more than one animation path on one wire.
 *
 * Import-free on purpose, like `portCopy.ts` and `docsPopupPlacement.ts`: the
 * arithmetic is graded in `tests-unit/` without starting Electron, and the
 * painter keeps the canvas calls.
 *
 * ## Why the mark is weight and shape, and not a colour
 *
 * The mechanism has been built and enabled by default since before this phase.
 * What it was not, was visible. Measured on composited canvas pixels in the
 * running editor (2026-08-11, `lib21-qa`, four dash phases, peak opacity):
 *
 * | theme | wire | pulse over it | contrast |
 * |---|---|---|---|
 * | dark  | `#35c3e8` signal | `#b6e4f2` | **1.48:1** (max 1.69) |
 * | dark  | `#45d08a` value  | `#a7e2c9` | **1.43:1** (max 1.57) |
 * | light | `#0e9cc4` signal | `#145269` | 3.25:1 |
 * | light | `#1e9e63` value  | `#1a463b` | 3.09:1 |
 *
 * The dark column is the default theme, and it is the one that fails. The cause
 * is that `wirePulse` resolves to `--theme-color-fg-highlight`, which is
 * near-white in dark — and a wire is already a bright saturated colour sitting
 * at 9.3:1 against the ground, so moving it 70% of the way to white barely
 * moves its luminance at all. In light the same token is near-black and the
 * same operation moves a great deal.
 *
 * ⚠️ **A luminance step against the wire cannot be won in dark.** To reach 3:1
 * against a wire at that luminance the mark has to be *darker* than the wire,
 * and in a dark theme a dark mark on a bright wire is indistinguishable from a
 * gap in the wire — which is what `getHealth()` already uses dashes to mean.
 * So the mark carries its meaning in **weight** (it is wider than the wire it
 * runs on) and in **shape** (see below), and its legibility is measured against
 * the *ground* on its flanks, where it is well clear in both themes. Wire
 * colour already carries type, health, pulse and diff annotation, and
 * `NodeGraphEditorConnection` refused to make selection a fifth; this does not
 * make it a sixth.
 *
 * ## Why a signal and a value do not look the same
 *
 * They used to. `NodeContext.prototype.connectionSentSignal` is a four-line
 * wrapper that calls `connectionSentValue` with a string, so the runtime
 * reports both through one channel and the editor drew both as the same
 * marching dashes. The one mechanism that could teach the distinction this
 * whole phase is named for was rendering the confusion instead.
 *
 * Nothing on the wire needs to change to fix that: the editor already knows the
 * source port's type, one line above where the pulse is painted. So —
 *
 * - **a signal gets one mark that runs source → target.** A signal is a
 *   *moment*, and a moment has a position.
 * - **a value gets the repeating overlay along the whole wire.** A value
 *   connection is a standing state that is live everywhere at once; there is no
 *   one place on it for a mark to be.
 *
 * That is the difference in a still frame, which is what the acceptance asks
 * for — one round-capped bead versus a repeating dash — and it is the same
 * distinction in motion.
 */

export type WirePulseKind = 'signal' | 'value';

export const WIRE_PULSE = {
  /**
   * How long the signal mark takes to run source → target, in ms.
   *
   * A pulse entry lives ~100 ms in the runtime's map and then fades out over
   * 500 ms in the editor, so the mark has roughly 600 ms of visible life and
   * this fits inside it with the fade to spare. It is deliberately *not* the
   * old `offset = life / 20` (50 px/s), which could not cross a 300 px wire in
   * anything like the time the pulse existed for — the mark used to leave the
   * source and be deleted before it arrived anywhere.
   */
  travelMs: 420,

  /** The mark's length, as a fraction of the curve. */
  headSpan: 0.22,

  /** How many points the head is sampled at. Enough for a smooth short arc. */
  headSamples: 10,

  /** Added to the wire's own stroke width for a signal mark. */
  signalWeightBoost: 2.5,

  /** Added to the wire's own stroke width for the value overlay. */
  valueWeightBoost: 1.5,

  /**
   * The value overlay's dash. Shorter and tighter than the old `[5, 15]` so it
   * reads as a texture on the wire rather than four isolated ticks, and
   * distinct from `Deleted`'s `[6, 4]` annotation and the `[5]` of an unhealthy
   * wire.
   */
  valueDash: [4, 10],

  /** Pixels per ms the value overlay's dashes advance. Matches the old feel. */
  valueDriftPerMs: 1 / 20
} as const;

/**
 * Which mark a wire gets, from the source port's resolved type name.
 *
 * The same string `CanvasTheme.connectionColors` branches on, so the mark and
 * the colour can never disagree about what kind of wire this is.
 */
export function wirePulseKind(portTypeName: string | undefined): WirePulseKind {
  return portTypeName === 'signal' ? 'signal' : 'value';
}

/**
 * Where the signal mark is on the curve, as a `[from, to]` pair in bezier `t`.
 *
 * The head leaves the source at `t = 0` and stops at the target; the tail
 * follows `headSpan` behind it, so the mark grows out of the source rather than
 * appearing at full length, and comes to rest *on* the target rather than
 * sliding off it. Ages before the pulse existed clamp to a zero-length mark at
 * the source rather than reading as negative progress.
 */
export function travellingHeadRange(
  ageMs: number,
  travelMs: number = WIRE_PULSE.travelMs,
  headSpan: number = WIRE_PULSE.headSpan
): { from: number; to: number } {
  const progress = Math.max(0, Math.min(1, travelMs > 0 ? ageMs / travelMs : 1));
  return { from: Math.max(0, progress - headSpan), to: progress };
}

/**
 * How far the value overlay's dashes have drifted, in px, for a pulse of this
 * age. Positive; the painter negates it, which is what makes the dashes travel
 * *along* the path rather than back down it.
 */
export function valueDashOffset(ageMs: number): number {
  return Math.max(0, ageMs) * WIRE_PULSE.valueDriftPerMs;
}

/**
 * The signal mark as a polyline, sampled off whatever curve the caller has.
 *
 * Takes the point function rather than the curve so that this module stays
 * ignorant of how a connection is shaped — SIG-006's hover runs on the same
 * bezier, and SIG-007 may not.
 */
export function samplePolyline(
  pointAt: (t: number) => { x: number; y: number } | undefined,
  from: number,
  to: number,
  samples: number = WIRE_PULSE.headSamples
): { x: number; y: number }[] {
  const n = Math.max(2, Math.floor(samples));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = from + ((to - from) * i) / (n - 1);
    const p = pointAt(t);
    if (p) out.push(p);
  }
  return out;
}
