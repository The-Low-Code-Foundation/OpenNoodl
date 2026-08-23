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
  CommunityReplayRow,
  CommunityThreadRow
} from '@noodl-core-ui/preview/launcher/Launcher/views/Community';

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
};

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
  const { me, home, forum, session } = inputs;

  if (refusesCommunitySurface(me)) {
    return { surface: 'hidden' };
  }

  const homeValue = home?.outcome === 'ok' ? home.value : null;

  // ⚠️ No `forum === 'present'` check: D19 removed that discriminant from the platform and this
  // client stopped declaring it on 2026-08-19. A branch nothing can produce is a check that
  // cannot fail — the platform deleted its own for that reason, and so does this.
  const forumThreads = forum?.outcome === 'ok' ? forum.value.threads : null;

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
    threads: sectionFrom<CommunityThreadRow>(forum, forumThreads),
    health: healthFrom(homeValue?.threshold ?? null)
  };
}
