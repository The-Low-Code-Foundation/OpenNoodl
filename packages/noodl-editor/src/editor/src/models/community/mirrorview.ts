/**
 * UNI-011 — what the community panel shows, as data.
 *
 * ## Why this is a module and not a component
 *
 * 🔴 **There is no DOM and no React in this repo's jest run.** Every decision worth grading here
 * — whether a section is empty or unreachable, whether the surface exists at all, whether a
 * threshold reading may be quoted — is a decision about *data*, so it lives where a spec can
 * reach it. `CommunityPanel.tsx` walks the result of {@link composeMirror} and does nothing else
 * a test would want to assert.
 *
 * ## D21 (2026-08-19) is the reason this file renders emptiness as a first-class state
 *
 * D16 gated this surface on 30 threads, three weeks of calls and a median first reply under 24
 * hours. **Reversed by D21**: the panel ships now, with whatever exists including none of it.
 *
 * ⚠️ **That is a licence to be empty, NOT a licence to be blank**, and the distinction is the
 * whole design of this module. D16's surviving obligation — the one D21 explicitly keeps — is
 * that the home is composed of things that exist whether or not anybody posted this week. So a
 * section with nothing in it says what it is *for*, and the panel never collapses to a single
 * "nothing here yet". Four independent sections, four independent empties.
 *
 * ## 🔴 The three outcomes that must NOT be flattened into two
 *
 * `Read<T>` has `ok | absent | unreachable`, and this module keeps all three apart because they
 * want opposite renderings:
 *
 * | outcome | means | drawn as |
 * |---|---|---|
 * | `ok` with an empty list | the community is quiet | the section, with its empty line |
 * | `unreachable` | our fetch failed | the section, saying so, retryable |
 * | `absent` | **D15 says this surface does not exist for you** | 🔴 **nothing at all** |
 *
 * The last row is the load-bearing one. `absent` is how the platform answers an org-minor whose
 * school has the community switched off, and `apiviewer.ts` returns it deliberately so that *"a
 * pupil is not told a door exists."* A panel that rendered "the community is unavailable" would
 * narrate the door in the act of closing it — so {@link composeMirror} returns `hidden`, and the
 * view returns `null`.
 *
 * ## 🔴 The TYPES are core-ui's, and this file only computes them
 *
 * D21 gave the community TWO surfaces — the launcher tab and the editor's rail panel — and
 * `noodl-core-ui` cannot import `noodl-editor` (it renders in Storybook). So the view model is
 * declared in `views/Community.tsx` over there and imported here, exactly as
 * `CommunityAccountState` already is. ⚠️ **Two surfaces over one model is worth something only if
 * it is literally one model**; a copy on each side is the arrangement where a fix lands on one.
 *
 * @module noodl-editor/models/community/mirrorview
 */

import type {
  CommunityMirrorView as MirrorView,
  CommunitySectionState as SectionState,
  CommunityHealthReading as HealthReading,
  CommunityArticleRow,
  CommunityReplayRow
} from '@noodl-core-ui/preview/launcher/Launcher/views/Community';
import type {
  CommunityBenchRow,
  CommunityBenchViewModel,
  CommunityFilterPill
} from '@noodl-core-ui/components/community';

import { MIRROR_THREAD_WINDOW } from './communityapi';
import type { CommunityHome, ForumState, MeResponse, Read, ThresholdResponse } from './communityapi';

export type { MirrorView, SectionState, HealthReading };

/** What {@link composeMirror} is handed. `undefined` means "not asked yet". */
export type MirrorInputs = {
  me: Read<MeResponse> | undefined;
  home: Read<CommunityHome> | undefined;
  forum: Read<ForumState> | undefined;
  /**
   * From `readCommunitySession()`: `undefined` = store silent, `null` = signed out.
   *
   * 🔴 **The token is accepted and never read.** The hook holds a whole `CommunitySession`
   * because it needs the token to build a client, and narrowing it at the call site would put a
   * second shape in play for one fact. What this module takes from it is the handle. ⚠️ The
   * consequence is worth a spec rather than a comment — the composed view is handed to a React
   * tree in a `nodeIntegration: true` renderer, so "the token is not in the view model" is a
   * property somebody should be able to fail a test on, and `mirrorview.test.ts` does.
   */
  session: { handle?: string; token?: string } | null | undefined;
  /**
   * FB-002 — which Bench pill is on. `undefined` means nobody has chosen, which is
   * {@link BENCH_DEFAULT_STATE} and is **not** "show everything".
   *
   * ⚠️ Held by the surface, like `useCommunityPeople`'s query and filters, so this stays a pure
   * function a spec can call with a value instead of a rendered click.
   */
  benchState?: BenchState;
};

// ─────────────────────────────────────────────────────────────────────────────
// FB-002 — the Bench, with the answered questions out of the default list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two pills, spelled exactly as the web Bench spells them.
 *
 * 🔴 **There is no third value, and its absence is the feature.** `lists.ts`'s `state` dimension
 * is `multi: false` with **no `all`**, so the web has no "everything" pill either; the archive is
 * one click away rather than mixed into the queue. AC4 asks the two surfaces to agree and this is
 * the narrow reading of that: same vocabulary, same default, same absence.
 */
export type BenchState = 'waiting' | 'solved';

/**
 * 🔴 Richard, 2026-08-22: *"The ones that are marked as answer accepted still appear in the list
 * of questions on the bench, instead of being relegated to an 'answered' filter."* The Bench
 * exists to get unanswered questions answered, so the list it opens on is the work.
 *
 * ⚠️ This is the same constant as the web's `fallback: 'waiting'`, in a second codebase. They
 * cannot import each other; AC4's mirror-agreement rule is what a spec on each side is for.
 */
export const BENCH_DEFAULT_STATE: BenchState = 'waiting';

const BENCH_LABELS: Record<BenchState, string> = {
  waiting: 'Waiting for an answer',
  solved: 'Solved'
};

/** Pill order, and it is the web's: `solved` then `waiting` (`BENCH_SPEC.values`). */
const BENCH_ORDER: BenchState[] = ['solved', 'waiting'];

/**
 * ⚠️ `=== true` rather than a truthiness test, on a field the type already calls a `boolean`.
 *
 * `threads()` hands the payload straight back — it is a cast, not a validation, like `me()` and
 * `home()` — so a platform that stopped sending `accepted` would put `undefined` here. Truthiness
 * would quietly file every thread as *waiting*, which is the arm this filter defaults to: the
 * defect would look exactly like a community nobody has answered. This costs nothing and cannot
 * be read the wrong way round.
 */
function isSolved(thread: { accepted?: boolean }): boolean {
  return thread.accepted === true;
}

function questions(n: number): string {
  return `${n} ${n === 1 ? 'question' : 'questions'}`;
}

/**
 * The whole Bench list, as data — **rows and both counts from one call**.
 *
 * 🔴 This is `facets.ts`'s rule carried across: *"the number on a pill is not related to what
 * clicking it gives you, it IS what clicking it gives you."* Both pills' counts and the visible
 * rows are all derived from `held` here, in this function, so a count that disagrees with its
 * click is not a bug that can be introduced by editing one of two places.
 *
 * ⚠️ **The denominator is what we HOLD, not what the Bench contains.** See
 * {@link MIRROR_THREAD_WINDOW}: this client is given the 100 newest threads and no total, so
 * "3 of 12 questions" is a true statement about the window and {@link benchBoundLine} is the
 * honest statement of the gap.
 */
export function composeBench(forum: Read<ForumState> | undefined, state: BenchState): CommunityBenchViewModel {
  const held: CommunityBenchRow[] = forum?.outcome === 'ok' ? forum.value.threads : [];
  const solved = held.filter(isSolved);
  const waiting = held.filter((thread) => !isSolved(thread));
  const shown = state === 'solved' ? solved : waiting;

  const counts: Record<BenchState, number> = { solved: solved.length, waiting: waiting.length };
  const filters: CommunityFilterPill[] =
    held.length === 0
      ? // ⚠️ No pills over nothing. Two zeroes above an empty list is a control that cannot do
        // anything, drawn as though it could — and it would hide the sentence that says what the
        // Bench is FOR, which is D21's surviving obligation.
        []
      : BENCH_ORDER.map((key) => ({
          key,
          label: BENCH_LABELS[key],
          count: counts[key],
          active: key === state
        }));

  return {
    section: sectionFrom<CommunityBenchRow>(forum, shown),
    summary: held.length === 0 ? null : `${shown.length} of ${questions(held.length)}`,
    boundLine: benchBoundLine(held.length),
    emptyLine: benchEmptyLine(held.length, state),
    filters
  };
}

/**
 * 🔴 A bounded list reports its bound. See {@link MIRROR_THREAD_WINDOW} for why this client
 * cannot do what `readDirectory` does and walk to the end.
 *
 * ⚠️ Hitting the window and finishing on it are indistinguishable from here — a Bench with
 * exactly 100 threads gets this sentence too. That is the safe direction: over-stating the
 * limit tells a reader something true and slightly cautious, while under-stating it tells them
 * a filtered list is the whole Bench when it is not.
 */
export function benchBoundLine(held: number): string | null {
  if (held < MIRROR_THREAD_WINDOW) return null;
  return `Showing the ${MIRROR_THREAD_WINDOW} newest questions — these filters and counts cover only these.`;
}

/**
 * 🔴 Three different silences, and they are not interchangeable.
 *
 * *Nobody has asked anything* is the section saying what it is for. *Everything in view is
 * answered* is good news about a queue. *Nothing has been accepted yet* is the archive being
 * empty. A shared "nothing here" would read as a broken filter in two of the three cases — and
 * in the middle one it would hide the fact that there is an archive to click through to.
 */
export function benchEmptyLine(held: number, state: BenchState): string {
  if (held === 0) {
    return 'Questions asked from the editor land here. Right-click any node and choose \u201CAsk about this node\u201D.';
  }
  return state === 'solved'
    ? 'No question here has an accepted answer yet.'
    : 'Every question here has an accepted answer. Choose \u201CSolved\u201D to read them.';
}

function sectionFrom<T>(read: Read<unknown> | undefined, items: T[] | null): SectionState<T> {
  if (read === undefined) return { state: 'loading' };
  if (read.outcome === 'unreachable') return { state: 'unreachable', detail: read.detail };
  // ⚠️ `absent` reaching here is not possible for a section — a whole-surface `absent` is caught
  // by `composeMirror` before any section is built — but a section-shaped fallback is `empty`
  // rather than an error, because the alternative narrates a door. See the header table.
  if (read.outcome !== 'ok' || !items) return { state: 'empty' };
  return items.length === 0 ? { state: 'empty' } : { state: 'items', items };
}

function healthFrom(threshold: ThresholdResponse | null): HealthReading | null {
  if (!threshold) return null;
  return {
    threads: { value: threshold.threads.value, required: threshold.threads.required },
    weeksWithCall: {
      value: threshold.consecutiveWeeksWithCall.value,
      required: threshold.consecutiveWeeksWithCall.required
    },
    reply: {
      medianHours: threshold.medianFirstReply.medianHours,
      requiredBelowHours: threshold.medianFirstReply.requiredBelowHours,
      n: threshold.medianFirstReply.n,
      unreplied: threshold.medianFirstReply.unreplied
    }
  };
}

/**
 * 🔴 **D15's refusal, in one place, because there are now TWO things that have to obey it.**
 *
 * {@link composeMirror} asks this to decide whether the panel draws anything, and NAT-012 AC7's
 * rail gate asks it to decide whether the panel is on the rail at all. ⚠️ Those are the same
 * fact and they must not become two readings of it — the header's own warning about `home` ("two
 * sources for one refusal is the arrangement where a fix lands on one of them") applies with
 * more force here, because the two consumers live in different layers and a drift between them
 * is exactly a surface with no icon, or an icon with no surface.
 *
 * ⚠️ **`me` must be `ok` for this to be true**, and that is the whole of the signed-out case:
 * `/api/v1/me` answers **401 → `unauthenticated`** when there is no token, never `absent`, so a
 * signed-out viewer is never refused and keeps the panel D21 promised them. (`absent` here is
 * reserved for the platform *saying* the surface does not exist for this account — the org-minor
 * whose school switched the community off.)
 */
export function refusesCommunitySurface(me: Read<MeResponse> | undefined): boolean {
  return me?.outcome === 'ok' && me.value.community.surface === 'absent';
}

/**
 * The whole panel, as data.
 *
 * 🔴 **`absent` is checked FIRST and on `me` alone.** D15's refusal is a fact about the viewer,
 * not about any one list, and checking it per-section would let a home that happened to answer
 * `ok` draw a surface the viewer is not allowed to know about. ⚠️ It is deliberately NOT derived
 * from `home`'s outcome as well: two sources for one refusal is the arrangement where a fix lands
 * on one of them.
 *
 * ⚠️ `me` being `unreachable` is NOT `absent`. An editor that cannot reach the platform shows the
 * panel with unreachable sections — hiding it would make a flaky network look like a school
 * policy, which is the one confusion D15 cannot afford.
 */
export function composeMirror(inputs: MirrorInputs): MirrorView {
  const { me, home, forum, session, benchState } = inputs;

  if (refusesCommunitySurface(me)) {
    return { surface: 'hidden' };
  }

  const homeValue = home?.outcome === 'ok' ? home.value : null;


  return {
    surface: 'shown',
    viewer: session === undefined ? null : session === null ? false : { handle: session.handle ?? null },
    // ⚠️ `standing` is null both when signed out and when the platform sent none. The panel draws
    // nothing either way, so a third state would be a distinction with no rendering behind it.
    standing: homeValue?.standing
      ? { points: homeValue.standing.points, badges: homeValue.standing.badges.length }
      : null,
    replays: sectionFrom<CommunityReplayRow>(home, homeValue?.replays ?? null),
    articles: sectionFrom<CommunityArticleRow>(home, homeValue?.articles ?? null),
    /**
     * FB-002 — the Bench is no longer a bare section state.
     *
     * ⚠️ No `forum === 'present'` check here either: D19 removed that discriminant from the
     * platform and this client stopped declaring it on 2026-08-19. A branch nothing can produce
     * is a check that cannot fail — the platform deleted its own for that reason, and so does
     * this. {@link composeBench} reads `outcome === 'ok'` and nothing else.
     */
    bench: composeBench(forum, benchState ?? BENCH_DEFAULT_STATE),
    health: healthFrom(homeValue?.threshold ?? null)
  };
}
