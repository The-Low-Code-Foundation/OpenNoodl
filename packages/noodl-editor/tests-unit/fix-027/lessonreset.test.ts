/**
 * FIX-027 §20 — 🔴 THE ROUTE THAT WAS NEVER TAKEN.
 *
 * `lessonplatforminstall.resetLessonFromPlatform` shipped with UNI-007, was specced in two files
 * — `tut-004/installing-from-the-platform.test.ts` and `tut-004/the-real-bundle-installs.test.ts`
 * — and had **no caller in `src/`**. Every one of those specs passed. None of them could fail
 * for the thing that was actually wrong, because the thing that was wrong was that nobody called
 * it: `LearningFolderModel.canReset` refused every platform lesson, `tutorialsview.ts` said
 * resetting was "the Learning section's business", and the Learning section called the method
 * that refused. Two surfaces pointing at each other, and a re-pull that never happened.
 *
 * ✅ **So these rows grade the CHOICE, which is the part that was missing.** A spec that only
 * exercised `resetLessonFromPlatform` would have gone green throughout the entire period the
 * feature did not exist — and did, twice over, for months.
 *
 * ⚠️ What this file does **not** prove: that the launcher's real client fetches a real bundle,
 * and that the fresh copy lands on disk. Those are `tut-004`'s specs and a drive. What it proves
 * is that the arm exists, is reached for exactly the lessons that need it, and is *not* reached
 * for the ones that do not.
 */

import type { ResetAvailability, ResetLessonOutcome } from '../../src/editor/src/models/learningfolder';
import { resetLesson } from '../../src/editor/src/models/lessonreset';

/**
 * A register that answers whatever the row is about, and records what was asked of it.
 *
 * ⚠️ `reset` returns a *distinguishable* outcome rather than a generic success, so a row cannot
 * pass by accident when the wrong arm ran and happened to succeed.
 */
function fakeRegister(availability: ResetAvailability) {
  const calls: string[] = [];
  return {
    calls,
    canReset(): ResetAvailability {
      calls.push('canReset');
      return availability;
    },
    /*
     * ⚠️ Honours the availability it was built with, because the real one does:
     * `LearningFolderModel.reset` re-asks `canReset` and refuses with its sentence. A fake that
     * always succeeded made the refusal row below pass for the wrong reason — it reported
     * `'reset'` where the real register would have refused, which is a fake asserting its own
     * convenience rather than the contract.
     */
    reset(): ResetLessonOutcome {
      calls.push('reset');
      if (availability.result === 'unavailable') {
        return { result: 'unavailable', reason: availability.reason };
      }
      if (availability.result === 'needs-network') {
        return { result: 'unavailable', reason: 'This lesson came from NodeGX Community.' };
      }
      return { result: 'reset' } as ResetLessonOutcome;
    }
  };
}

/** A re-pull that records it was reached, and is distinguishable from the local reset. */
function fakeRepull(outcome: ResetLessonOutcome = { result: 'reset' } as ResetLessonOutcome) {
  const seen: string[] = [];
  return {
    seen,
    repull: (id: string) => {
      seen.push(id);
      return Promise.resolve(outcome);
    }
  };
}

describe('FIX-027 §20 — resetLesson routes a platform lesson to the network and a local one to disk', () => {
  it('🔴 re-pulls a platform lesson — the arm that had no caller for a whole phase', async () => {
    const register = fakeRegister({ result: 'needs-network' });
    const puller = fakeRepull();

    const outcome = await resetLesson('state-on-a-page', { register, repull: puller.repull });

    // The whole point: something asked for the fresh copy.
    expect(puller.seen).toEqual(['state-on-a-page']);
    expect(outcome.result).toBe('reset');
    // 🔴 And the synchronous reset — which has no network and would have refused — was NOT used.
    // This is the assertion that fails if the routing is ever reverted to `register.reset(id)`.
    expect(register.calls).not.toContain('reset');
  });

  it('🔴 does not touch the network for a local lesson', async () => {
    // The other half, and the one a fake client would hide: a lesson installed from a directory
    // on this machine must not wait on a request, and must not fail when there is no session.
    const register = fakeRegister({ result: 'available' });
    const puller = fakeRepull();

    const outcome = await resetLesson('make-a-group', { register, repull: puller.repull });

    expect(register.calls).toContain('reset');
    expect(puller.seen).toEqual([]);
    expect(outcome.result).toBe('reset');
  });

  it('🔴 sends a genuine refusal back through the register, so the learner reads its sentence', async () => {
    /*
     * FIX-026's case: a local lesson whose bundle has gone. Dispatching on "not available"
     * instead of on `'needs-network'` would send this to the platform, and the learner would be
     * told about a network they never used — about a lesson that never came from one.
     */
    const reason = 'The lesson can\'t be re-pulled: its bundle is no longer at /tmp/bundle.';
    const register = fakeRegister({ result: 'unavailable', reason });
    const puller = fakeRepull();

    const outcome = await resetLesson('state-on-a-page', { register, repull: puller.repull });

    expect(puller.seen).toEqual([]);
    expect(outcome.result).toBe('unavailable');
    if (outcome.result !== 'unavailable') return;
    // The register's own words, not a second wording of them.
    expect(outcome.reason).toBe(reason);
  });

  it('reports a failed re-pull rather than claiming the lesson was reset', async () => {
    // `resetLessonFromPlatform` guarantees nothing was deleted when the fetch fails. The route
    // must carry that sentence out intact — this is the moment a learner is already stuck.
    const register = fakeRegister({ result: 'needs-network' });
    const puller = fakeRepull({
      result: 'unavailable',
      reason: 'NodeGX Community could not be reached. Nothing was changed.'
    } as ResetLessonOutcome);

    const outcome = await resetLesson('state-on-a-page', { register, repull: puller.repull });

    expect(outcome.result).toBe('unavailable');
    if (outcome.result !== 'unavailable') return;
    expect(outcome.reason).toMatch(/Nothing was changed/);
  });
});
