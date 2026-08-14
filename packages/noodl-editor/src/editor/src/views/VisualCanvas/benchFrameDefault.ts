/**
 * FIX-011 — the size a component opens on the bench at, and the second knowing
 * exception to R5.
 *
 * R5 is "preview state, never project state": the frame is ephemeral, and
 * reopening a project into a bench nobody asked for is the disorientation the
 * bench phase was written against. BEN-005's scenarios were the first exception
 * and the argument was that *a set of input values is authored intent*. This is
 * the second, on the same argument: **a default size is authored intent too**.
 * "This card is designed for 360" is a fact about the component, not about the
 * session someone happened to look at it in.
 *
 * ## The rule that makes it safe
 *
 * ⚠️ **A drag never writes.** Only the deliberate "Set as default size" gesture
 * reaches {@link benchFrameStore}, exactly as only Save reaches
 * `benchScenarioStore`. That is not tidiness — `ComponentModel.setMetaData`
 * raises `Model.metadataChanged`, which is in `projectSaveTriggers`
 * (`projectmodel.ts`), so **one** write arms the 1s autosave and lands on disk.
 * A resize handle that wrote through would dirty the project on every stray
 * pixel of every drag, and FIX-011's fourth acceptance criterion is the control
 * that proves it does not.
 *
 * The rules live here rather than in the surface for the reason
 * `benchScenarios.ts` and `previewScope.ts` give: a rule only a live driver can
 * check is a rule that does not get checked, and this one decides what reaches
 * `project.json`.
 *
 * @module noodl-editor/views/VisualCanvas/benchFrameDefault
 */

import type { BenchFrame } from './previewScope';
import { MAX_BENCH_HEIGHT, MAX_BENCH_WIDTH, MIN_BENCH_HEIGHT, MIN_BENCH_WIDTH } from './previewScope';

/**
 * The component-metadata key the default size is stored under.
 *
 * Namespaced beside `bench.scenarios` for the same reason: component metadata
 * is a flat bag shared with everything that has ever wanted to hang something
 * off a component, and the runtime is handed every key verbatim.
 */
export const BENCH_FRAME_KEY = 'bench.frame';

/** What is stored under {@link BENCH_FRAME_KEY}. */
export interface BenchFrameStore {
  width: number;
  /** Absent means "fill the stage" — the same absence rule a scenario's height uses. */
  height?: number;
  /** Absent means false. */
  stretch?: boolean;
}

/**
 * The stored default, or `undefined` when the component has no usable one.
 *
 * Tolerant in one direction only, like `readBenchScenarios`: this reads JSON a
 * human can edit, version control can merge and an MCP write path can rewrite,
 * and the failure mode of a throw is a preview surface that will not open at
 * all. Anything that is not a usable frame is simply not a default.
 *
 * ⚠️ **The width is what makes a default exist**, and a stored height alone is
 * not enough. Every frame has a width — there is no "unset" for it, unlike the
 * height — so a record without one is a record this cannot honour, and half a
 * frame is not better than none.
 */
export function readBenchFrameDefault(stored: unknown): BenchFrame | undefined {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return undefined;
  const candidate = stored as Partial<BenchFrameStore>;

  const width = candidate.width;
  if (typeof width !== 'number' || !Number.isFinite(width)) return undefined;

  const height = candidate.height;
  const usableHeight = typeof height === 'number' && Number.isFinite(height);

  // Clamped on the way *in*, not merely on the way out. A hand-edited `40` would
  // otherwise reach the surface as a frame the control itself refuses to
  // produce, and the field would then read a number it cannot get back to.
  return {
    width: Math.min(MAX_BENCH_WIDTH, Math.max(MIN_BENCH_WIDTH, Math.round(width))),
    height: usableHeight ? Math.min(MAX_BENCH_HEIGHT, Math.max(MIN_BENCH_HEIGHT, Math.round(height))) : null,
    stretch: candidate.stretch === true
  };
}

/**
 * The value handed to `setMetaData`, and the only one this module produces.
 *
 * `undefined` for "no default" clears the key entirely rather than storing an
 * empty record, so a component that has never had a default size — or has had
 * one removed — is byte-identical to one nobody ever benched. Same courtesy
 * `benchScenarioStore` pays a component whose last scenario was deleted: no
 * key, no diff, nothing for a reviewer to wonder about.
 */
export function benchFrameStore(frame: BenchFrame | undefined): BenchFrameStore | undefined {
  if (!frame) return undefined;

  const stored: BenchFrameStore = { width: frame.width };
  // Only the non-default halves are written. "Fill the stage" and "not
  // stretched" are what a component gets with no record at all, so writing them
  // would put keys in `project.json` that change nothing.
  if (frame.height !== null) stored.height = frame.height;
  if (frame.stretch) stored.stretch = true;
  return stored;
}
