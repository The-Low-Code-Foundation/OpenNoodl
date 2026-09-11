/**
 * BLD-004 — the difference between thinking hard and a dead socket.
 *
 * ## Why this is pure, and here
 *
 * Same boundary as `runProgress.ts`, and for a sharper version of the same
 * reason. **A spinner that spins while the stream is dead is the defect**, and
 * it is invisible to every check that does not involve waiting: a screenshot of
 * a pulsing dot is identical whether the last event arrived 200ms ago or four
 * minutes ago. `tsc` cannot see it, a pure spec of the *component* cannot see
 * it, and a person watching for five seconds cannot see it either. So the rule
 * about **when motion is allowed at all** is a total function of one timestamp
 * and the clock, graded in a runner, and the components below it animate only
 * what this returns.
 *
 * ## The rule the stylesheet must not re-invent
 *
 * Motion is licensed by an *event*, never by `busy`. `busy` stays true for the
 * whole three-minute stall window — so a pulse keyed off it animates hardest at
 * exactly the moment nothing is happening. That is the failure BLD-005's
 * correction 2 exists to fix, restated as an animation, and it is why
 * `RunHeader.module.scss` shipped with accent and weight and deliberately no
 * movement until this module existed.
 *
 * ## Why the quiet threshold is derived, not chosen
 *
 * The words appear at a fraction of the *caller's own* stall window rather than
 * at a constant. A session with a short deadline is one whose author already
 * decided that silence means something sooner, and a fixed "45s" would tell a
 * user "no response for 45s" one second before the turn was killed at 46. The
 * warning has to lead the deadline it is warning about.
 *
 * @module AiAssistant/thread/liveness
 */

import { formatDuration } from './runProgress';

/**
 * How recently an event must have landed for motion to be honest.
 *
 * Two seconds, because that is roughly the longest gap a *healthy* stream
 * produces: Anthropic pings while it thinks, and OpenAI and Ollama send chunks.
 * Longer and the pulse keeps running through short stalls it should report;
 * much shorter and it strobes between tokens.
 */
export const ALIVE_MS = 2_000;

/**
 * The share of the stall window that may pass before the panel says so.
 *
 * A quarter: late enough that ordinary gaps (a slow first token, a tool call
 * being executed) pass in silence, early enough that the user learns "slow" and
 * "stuck" are different *before* the deadline resolves it for them.
 */
export const QUIET_FRACTION = 0.25;

/** Used when the caller disabled the deadline, so there is no window to take a share of. */
export const DEFAULT_QUIET_MS = 45_000;

export type LivenessState =
  /** Nothing is running. */
  | 'idle'
  /** An event landed within {@link ALIVE_MS}. **The only state that may move.** */
  | 'alive'
  /** Running, but nothing has arrived recently enough to claim otherwise. */
  | 'waiting'
  /** Silent long enough to be worth saying in words. */
  | 'silent';

export interface Liveness {
  state: LivenessState;
  /** Milliseconds since the last event, or `undefined` when nothing has been heard yet. */
  silentMs?: number;
  /** Present only for `silent` — the sentence the panel shows. */
  note?: string;
}

export interface LivenessInput {
  /** Whether anything is running at all. */
  busy: boolean;
  /** When the last provider event landed. Undefined until the first one does. */
  lastActivityAt?: number;
  now: number;
  /** The caller's silence deadline. `0` or less means there is none. */
  stallMs?: number;
}

/** When the panel starts saying it in words, for a given stall window. */
export function quietThreshold(stallMs: number | undefined): number {
  return stallMs !== undefined && stallMs > 0 ? stallMs * QUIET_FRACTION : DEFAULT_QUIET_MS;
}

/**
 * What the stream is doing, as one of four states.
 *
 * ⚠️ `lastActivityAt` being absent while busy resolves to **`waiting`, not
 * `alive`** — a turn that has been opened but has not yet heard anything is the
 * single most likely moment for a provider to never answer, and it is the one
 * case where the optimistic reading is both convenient and wrong. Rule 5: never
 * claim progress you cannot evidence, and an event that has not arrived is not
 * evidence.
 */
export function liveness({ busy, lastActivityAt, now, stallMs }: LivenessInput): Liveness {
  if (!busy) return { state: 'idle' };
  if (lastActivityAt === undefined) return { state: 'waiting' };

  // Clamped at zero: a `lastActivityAt` in the future means the clock moved
  // (a publish raced a render, a spec injected one), and "negative silence"
  // would read as alive forever rather than as the momentary skew it is.
  const silentMs = Math.max(0, now - lastActivityAt);
  if (silentMs < ALIVE_MS) return { state: 'alive', silentMs };

  const quiet = quietThreshold(stallMs);
  if (silentMs < quiet) return { state: 'waiting', silentMs };

  return { state: 'silent', silentMs, note: silenceNote(silentMs, stallMs) };
}

/**
 * The sentence a silent stream shows.
 *
 * It names the deadline because "no response for 50s" alone is a fact with no
 * consequence attached, and the question the user is actually asking — should I
 * press Stop — is answered by knowing that something else will.
 */
export function silenceNote(silentMs: number, stallMs: number | undefined): string {
  const elapsed = `No response for ${formatDuration(silentMs)}`;
  if (!(stallMs !== undefined && stallMs > 0)) return `${elapsed}.`;
  return `${elapsed} — this turn ends by itself at ${formatDuration(stallMs)} of silence.`;
}
