/**
 * BLD-004 — the check, written before the fix.
 *
 * The task's own instruction, and the reason it is worth obeying here more than
 * anywhere else in the phase: **the mechanism is trivial to build and easy to
 * have lie on screen.** A pulsing dot is the same pixels whether the last event
 * landed 200ms ago or four minutes ago. There is nothing for a screenshot, a
 * reviewer, or `tsc` to notice — the only way to find out that a spinner is
 * spinning against a dead socket is to sit and watch one, which is exactly what
 * nobody does during review.
 *
 * So both directions are pinned here, and the second one is the one a naive
 * implementation gets wrong:
 *
 * 1. The provider dies mid-stream → motion stops, and the panel says so in
 *    words before the deadline resolves it.
 * 2. The provider holds the stream open with keepalives and no content → motion
 *    **keeps going**. An implementation keyed on `onText` rather than
 *    `onActivity` passes (1) and fails this, and it fails it as "the model has
 *    stopped responding" during the exact turns worth waiting for.
 */

import {
  ALIVE_MS,
  DEFAULT_QUIET_MS,
  liveness,
  QUIET_FRACTION,
  quietThreshold,
  silenceNote
} from '@noodl-models/AiAssistant/thread';

const T0 = 1_700_000_000_000;
const STALL = 180_000;

describe('liveness', () => {
  it('is idle when nothing is running, whatever the clock says', () => {
    // `busy` is the only thing that can license any of the other three states,
    // and a stale `lastActivityAt` from a finished turn must not resurrect one.
    expect(liveness({ busy: false, lastActivityAt: T0, now: T0, stallMs: STALL })).toEqual({ state: 'idle' });
  });

  it('is alive only while an event landed inside the window', () => {
    const at = (ms: number) => liveness({ busy: true, lastActivityAt: T0, now: T0 + ms, stallMs: STALL }).state;

    expect(at(0)).toBe('alive');
    expect(at(ALIVE_MS - 1)).toBe('alive');
    // The boundary is exclusive, and this assertion is the whole point of the
    // constant existing: motion is licensed by an event, and at exactly
    // ALIVE_MS the event's licence has run out.
    expect(at(ALIVE_MS)).toBe('waiting');
  });

  describe('the provider dies mid-stream', () => {
    // Acceptance criterion 1. Nothing further arrives after T0.
    const dead = (ms: number) => liveness({ busy: true, lastActivityAt: T0, now: T0 + ms, stallMs: STALL });

    it('stops claiming to be alive within ALIVE_MS', () => {
      expect(dead(ALIVE_MS + 1).state).toBe('waiting');
    });

    it('says so in words, and says it before the deadline fires', () => {
      const quiet = quietThreshold(STALL);
      expect(quiet).toBeLessThan(STALL); // the warning must lead what it warns about
      expect(dead(quiet - 1).note).toBeUndefined();

      const spoken = dead(quiet);
      expect(spoken.state).toBe('silent');
      expect(spoken.note).toContain('No response for');
      // ⚠️ The sentence names the deadline. "No response for 45s" alone is a
      // fact with no consequence attached, and the question the user is
      // actually asking — do I press Stop — is answered by knowing that
      // something else will.
      expect(spoken.note).toContain('3m 0s');
    });

    it('never stops reporting once it has started, however long it goes on', () => {
      // A note that vanished at some later threshold would leave the panel
      // looking healthy again while the socket was still dead.
      expect(dead(STALL * 4).state).toBe('silent');
    });
  });

  describe('the stream is held open with keepalives and no content', () => {
    /**
     * Acceptance criterion 2, and the direction a naive build gets wrong.
     *
     * `onActivity` fires for pings and keepalives — events that carry nothing a
     * user would see. A heartbeat wired to `onText` would see nothing at all
     * here and report a hung provider through a turn that is working perfectly.
     */
    it('stays alive across a long silent reasoning phase', () => {
      // Four minutes of pings at two-second intervals: past the stall window,
      // with no text ever produced.
      let last = T0;
      for (let elapsed = 0; elapsed <= 240_000; elapsed += 1_500) {
        const now = T0 + elapsed;
        last = now; // a ping landed
        expect(liveness({ busy: true, lastActivityAt: last, now, stallMs: STALL }).state).toBe('alive');
      }
    });

    it('and the two cases differ at the same instant, on the same input but for the timestamp', () => {
      // Run it both ways and diff — the task's instruction, at spec size. Same
      // clock, same stall window; the only difference is whether an event
      // landed, which is the entire claim the pulse makes.
      const now = T0 + 100_000;
      const pinged = liveness({ busy: true, lastActivityAt: now - 500, now, stallMs: STALL });
      const dead = liveness({ busy: true, lastActivityAt: T0, now, stallMs: STALL });

      expect(pinged.state).toBe('alive');
      expect(dead.state).toBe('silent');
      expect(pinged.note).toBeUndefined();
      expect(dead.note).toBeDefined();
    });
  });

  it('does not claim to be alive before the first event of a turn', () => {
    // ⚠️ The optimistic reading is both convenient and wrong: a turn that has
    // been opened but has heard nothing is the single most likely moment for a
    // provider to never answer. An event that has not arrived is not evidence.
    expect(liveness({ busy: true, lastActivityAt: undefined, now: T0, stallMs: STALL }).state).toBe('waiting');
  });

  it('reads a future timestamp as "just now" rather than as alive forever', () => {
    // A publish racing a render, or a spec injecting one. Negative silence would
    // otherwise compare below every threshold for as long as the skew lasted.
    const skewed = liveness({ busy: true, lastActivityAt: T0 + 5_000, now: T0, stallMs: STALL });
    expect(skewed.silentMs).toBe(0);
    expect(skewed.state).toBe('alive');
  });

  describe('the quiet threshold follows the caller, not a constant', () => {
    it('takes its share of whatever stall window the session was given', () => {
      expect(quietThreshold(STALL)).toBe(STALL * QUIET_FRACTION);
      // A session with a short deadline is one whose author already decided
      // that silence means something sooner. A fixed 45s would announce "no
      // response for 45s" one second before the turn was killed at 46.
      expect(quietThreshold(20_000)).toBe(5_000);
      expect(quietThreshold(20_000)).toBeLessThan(20_000);
    });

    it('falls back to a constant only when there is no deadline to take a share of', () => {
      expect(quietThreshold(undefined)).toBe(DEFAULT_QUIET_MS);
      expect(quietThreshold(0)).toBe(DEFAULT_QUIET_MS);
    });

    it('does not promise a deadline that was disabled', () => {
      // The sentence would otherwise tell the user to wait for a rescue that is
      // never coming — worse than saying nothing, because they would stop
      // watching.
      const note = silenceNote(60_000, 0);
      expect(note).toBe('No response for 1m 0s.');
      expect(note).not.toContain('ends by itself');
    });
  });
});
