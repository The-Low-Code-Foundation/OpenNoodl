/**
 * Compose a media fragment (`#t=start,end`) onto a video source.
 *
 * §2 of `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/NOTES-UNOWNED-NODE-WORK.md`:
 * Start Time and End Time for the mp4 path.
 *
 * ## Why this is a module rather than four lines in `Video.tsx`
 *
 * 🔴 **There was already a media fragment in that file, and it is the whole difficulty.** `#t=0.01`
 * is appended to every source to force Android to render a first frame, guarded by
 * `src.indexOf('#t=') === -1`. So the mechanism the ports need is the mechanism the hack occupies,
 * and the two have to be resolved rather than stacked: an author-set start must not be silently
 * overwritten by the workaround, and the workaround must not stop working when no start is set.
 *
 * ## How the collision resolves
 *
 * The hack's purpose is to make the browser seek somewhere, anywhere, so a frame paints. **A start
 * time does that too** — `#t=30` renders the frame at 30s exactly as `#t=0.01` renders the one at
 * 0.01s. So the hack is not overridden; it is the *default value of the start*, and an author who
 * sets Start Time replaces it rather than fighting it. That is why an unset pair produces
 * `#t=0.01` byte-for-byte, and why setting only End Time still keeps the Android behaviour.
 *
 * ⚠️ **What a media fragment cannot promise.** `end` bounds the initial playback range, which
 * browsers implement with varying enthusiasm and which interacts with `loop` differently across
 * them. It is the honest mechanism for an mp4 and it needs no script; a *dependable* end on a
 * third-party player needs that player's API, which is §2's open question and not this module's.
 *
 * @module media-fragment
 */

/**
 * The value that has always been appended, and now the default start.
 *
 * ⚠️ Not zero. `#t=0` is treated by some browsers as "no seek", which is the state the hack exists
 * to escape, so the smallest non-zero offset is load-bearing rather than arbitrary.
 */
export const ANDROID_FIRST_FRAME_SECONDS = 0.01;

/** A number a person actually typed: finite, and not the empty value a port delivers when unset. */
function seconds(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!isFinite(n)) return undefined;
  // Negative time is not a position in a video. Clamped rather than refused: the port should draw
  // the first frame, not stop rendering because somebody dragged a spinner below zero.
  return Math.max(0, n);
}

/**
 * Add or replace the `#t=` fragment on `src` according to the two ports.
 *
 * @param src the resolved source URL, or `undefined`/empty for a node with no source yet
 * @param startTime seconds, or any empty value for "not set"
 * @param endTime seconds, or any empty value for "not set"
 */
export function withMediaFragment(src: string | undefined, startTime?: unknown, endTime?: unknown): string | undefined {
  if (typeof src !== 'string' || src === '') return src;

  const start = seconds(startTime);
  let end = seconds(endTime);

  // 🔴 An end at or before the start is a range that plays nothing. Dropped rather than honoured,
  // for the reason the star's inner-radius clamp gives: a control that can make the node render
  // nothing at all teaches the author it is broken. The start still applies.
  const effectiveStart = start ?? ANDROID_FIRST_FRAME_SECONDS;
  if (end !== undefined && end <= effectiveStart) end = undefined;

  const authored = start !== undefined || end !== undefined;
  const existing = src.indexOf('#t=');

  // Nothing authored: today's behaviour exactly, including leaving a hand-written fragment alone.
  if (!authored) {
    return existing === -1 ? `${src}#t=${ANDROID_FIRST_FRAME_SECONDS}` : src;
  }

  // ⚠️ **The ports beat a hand-written `#t=` in the URL, and only then.** A fragment typed into
  // the Source field used to be the only way to do this, so it keeps working untouched while the
  // ports are unset — but once an author has set a port, the control they can see must win over
  // the one buried in a string.
  const base = existing === -1 ? src : src.substring(0, existing);
  return end === undefined ? `${base}#t=${effectiveStart}` : `${base}#t=${effectiveStart},${end}`;
}
