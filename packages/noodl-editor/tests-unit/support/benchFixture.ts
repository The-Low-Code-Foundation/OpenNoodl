/**
 * FB-002 — one Bench view model for the render suites, built by the REAL composer.
 *
 * 🔴 **Hand-built fixtures are how a view model and its producer drift.** `composeBench` decides
 * the pill counts, the summary, the bound line and which of three empty sentences applies; a
 * literal typed as `CommunityBenchViewModel` satisfies the compiler while asserting nothing about
 * any of that, and would keep passing after the composer stopped agreeing with it.
 *
 * So the suites hand this a `Read<ForumState>` — which is what the editor actually holds — and it
 * returns what the surfaces are actually given. The four section states are the four values of
 * that read, which is the second reason this is the honest input: `loading` is genuinely
 * "undefined", not a state anybody chose.
 *
 * @module noodl-editor/tests-unit/support/benchFixture
 */
import type { ForumState, ForumThread, Read } from '@noodl-models/community/communityapi';
import { BENCH_DEFAULT_STATE, composeBench, type BenchState } from '@noodl-models/community/mirrorview';

import type { CommunityBenchViewModel } from '@noodl-core-ui/components/community';

/** `undefined` is `loading` — see the module note. */
export function benchFrom(
  read: Read<ForumState> | undefined,
  state: BenchState = BENCH_DEFAULT_STATE
): CommunityBenchViewModel {
  return composeBench(read, state);
}

/** The `ok` read for a list of threads. */
export function forumOf(threads: ForumThread[]): Read<ForumState> {
  return { outcome: 'ok', value: { threads } };
}

/**
 * A thread that is **waiting** and that **nobody has replied to**, unless a caller says otherwise.
 *
 * ⚠️ The default is `accepted: false` on purpose: the surfaces open on the waiting list, so a
 * fixture that defaulted the other way would make every unrelated suite's rows disappear and the
 * failure would read as a broken renderer.
 *
 * ⚠️ `replyCount: 0` is defaulted on the same reasoning and is the value that agrees with the
 * other default — an unaccepted, unreplied question. FIX-025 bug 7 made this field load-bearing
 * for the sentence a row draws, so a suite that wants the *asker answered themselves* case has
 * to say `replyCount` out loud, which is what makes those rows readable as the case they are.
 */
export function threadOf(
  thread: Omit<ForumThread, 'accepted' | 'replyCount'> & { accepted?: boolean; replyCount?: number }
): ForumThread {
  return { accepted: false, replyCount: 0, ...thread };
}
