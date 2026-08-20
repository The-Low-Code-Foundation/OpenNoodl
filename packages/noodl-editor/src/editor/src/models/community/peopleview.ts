/**
 * NAT-008 — what the directory and a profile look like, as data.
 *
 * ## Why this is a module and not a component
 *
 * The same reason `threadview.ts` and `mirrorview.ts` are: **every decision with a word in it —
 * which sentence an empty directory gets, what a search that matches nothing says, whether the
 * surface exists at all — lives where a spec can reach it.** The components place what this
 * returns and interpret nothing.
 *
 * ## 🔴 D15 is read off `me`, BEFORE anybody is fetched
 *
 * Identical to `threadview.ts`, and the directory is the sharpest case in the phase. The platform
 * answers **404** for a private profile, a hidden profile, a handle that never existed **and** a
 * viewer D15 refuses — deliberately the same bytes, so that a pupil cannot tell them apart. A
 * client that decided "hidden" from a profile's 404 would be right sometimes and would show a
 * blank screen to everybody who followed a dead handle; a client that decided "not available"
 * would narrate the door. The refusal is a fact about the **viewer** and that is where it is read.
 *
 * ## 🔴 The search narrows HERE, and the reason is a measurement
 *
 * `GET /api/v1/community/people` has no `q` at all — measured 2026-08-20 against the route on a
 * real database, with a control beside it. See `communityapi.readDirectory` for the table. So a
 * client that "searched" by sending a keyword would draw the unfiltered directory and call it a
 * result, which is precisely the failure this task's traps name.
 *
 * ⚠️ **This is also what the web does**, which matters more than the convenience: `facets.ts`
 * filters `listDirectory`'s whole list in memory with one function that both the rows and the
 * facet counts call. {@link searchable} is `PEOPLE_SPEC.searchable` field-for-field, so a person
 * findable on the web page is findable here by the same words.
 *
 * @module noodl-editor/models/community/peopleview
 */

import {
  metaLine,
  relativeTime,
  type CommunityBadgeView,
  type CommunityChip,
  type CommunityDirectoryView,
  type CommunityFilterPill,
  type CommunityPersonRowView,
  type CommunityProfileDetailView,
  type CommunityProfileState,
  type CommunitySectionState
} from '@noodl-core-ui/components/community';
import { badgeMark } from '@noodl-core-ui/components/community/badgeMarks';

import type { Directory, MeResponse, PersonBadge, PersonProfile, PersonSummary, Read } from './communityapi';

export type { CommunityDirectoryView, CommunityProfileState };

// ── The words ─────────────────────────────────────────────────────────────────

/**
 * D4's taxonomy size, and it is the denominator the web profile states in its own sentence.
 *
 * ⚠️ A constant rather than `badges.length` of something: the twelve exist whether or not
 * anybody holds one, and "2 of 2 badges" for somebody with two would be a compliment the
 * platform never paid them.
 */
export const BADGE_TAXONOMY_SIZE = 12;

/** `40 points` / `1 point`, without a second copy of the plural rule per surface. */
export function countOf(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The name a person is drawn under.
 *
 * ⚠️ `@handle` when there is no display name, rather than a bare handle or a placeholder. D8's
 * bar requires a name to be *listed*, so a nameless row is a profile reached directly — and
 * "Unnamed" would be a word about somebody that they did not write.
 */
export function personTitle(person: { handle: string; displayName: string | null }): string {
  const name = person.displayName?.trim();
  return name && name !== '' ? name : `@${person.handle}`;
}

/**
 * The letter in the avatar disc.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THIS IS WHERE `avatarUrl` IS DECLINED, AND IT IS A DECISION RATHER THAN AN OMISSION.**
 *
 * `PersonProfile.avatarUrl` arrives from the platform and `/u/[handle]` renders it as an
 * `<img>`. This editor does not, and the task's own trap says the answer is decided here rather
 * than copied: *"remote images in the main window are a fingerprinting and a mixed-content
 * surface."* The window is `nodeIntegration: true, contextIsolation: false`; the URL is a string
 * a stranger put on their profile; and every image fetched from it tells whoever hosts it that
 * this editor opened this profile at this moment, from this IP.
 *
 * ⚠️ The cost, stated rather than hidden: somebody who uploaded a picture does not see it here.
 * The initial is what the web already draws for everybody who has not, so nothing is invented —
 * and the same ruling is why `badgeMarks.ts` bundles twelve marks instead of fetching them.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export function avatarInitial(person: { handle: string; displayName: string | null }): string {
  const source = (person.displayName ?? person.handle).trim();
  // ⚠️ `[...source]` rather than `charAt(0)`: a name beginning with an emoji or an astral
  // character has a first *code unit* that is half a character, and half a surrogate pair draws
  // as a replacement glyph.
  return ([...source][0] ?? '?').toUpperCase();
}

/**
 * The row's meta line.
 *
 * ⚠️ The web row's own three facts — handle, points, badge progress — plus how recently they were
 * around, which is the web's *sort* and is worth reading on the row itself. `metaLine` drops the
 * nulls, so somebody with no recorded activity simply has a shorter line rather than an
 * "active never".
 */
export function personMeta(person: PersonSummary, now: number): string | null {
  return metaLine([
    `@${person.handle}`,
    countOf(person.points, 'point', 'points'),
    `${person.badgeCount} of ${BADGE_TAXONOMY_SIZE} badges`,
    person.lastActiveAt ? `active ${relativeTime(person.lastActiveAt, now) ?? 'recently'}` : null
  ]);
}

/**
 * The chips on a row.
 *
 * ⚠️ **A blank rate band draws NOTHING**, which is the web page's own decision and its reason is
 * worth keeping: *"a blank band is a person who did not answer, and printing a placeholder would
 * make not answering look like a fact about them."*
 *
 * 🔴 `rateBand` reaches this editor as the database's **key** (`day_400_600`), not the web's
 * label — `personSummary` renames nothing, on purpose, so the API cannot drift from the query.
 * {@link rateBandLabel} is this client's copy of the vocabulary and an unknown key draws no chip
 * at all rather than the raw key: a column's spelling in a sentence somebody is trying to read is
 * the same defect `attachmentHeading` refuses.
 */
export function personChips(person: PersonSummary): CommunityChip[] {
  const chips: CommunityChip[] = [];
  if (person.availableForWork) chips.push({ label: 'Available for work', tone: 'good' });
  if (person.offersCoaching) chips.push({ label: 'Offers coaching', tone: 'accent' });
  const rate = rateBandLabel(person.rateBand);
  if (rate) chips.push({ label: rate, tone: 'neutral' });
  for (const skill of person.skills) chips.push({ label: skill, tone: 'accent' });
  return chips;
}

/**
 * The day-rate vocabulary, mirroring the platform's `RATE_BANDS` (`lib/profiles.ts:449`).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THE FIRST DRAFT OF THIS MAP HAD FOUR PLAUSIBLE KEYS AND ALL FOUR WERE WRONG**, and it
 * was found by curling the endpoint rather than by any test in this repository.
 *
 * It said `day_400_600` and `day_600_plus`, in the house style of every other enum on the
 * platform. The real keys are `under-400`, `400-700`, `700-plus` and `not-for-hire`. The failure
 * is silent **by design of the surrounding code**: an unknown key draws no chip, so every rate
 * band in the seeded directory would simply have vanished, on a surface where a blank band is
 * *also* the correct rendering for somebody who did not answer. Nothing would have looked broken.
 *
 * ⚠️ **The containment worked and the vocabulary still has to be right.** `badgeMark`'s
 * unknown-key-draws-nothing rule is what keeps a mistake here from becoming a WRONG label — and
 * it is also what would have kept this mistake invisible for as long as nobody looked. A safe
 * failure mode is not a substitute for reading the source, and a copied list is a copy whether or
 * not it is guarded.
 *
 * ⚠️ **`not-for-hire` is a real band and it draws a chip**, which is a fact worth not tidying
 * away: somebody who has answered *"no"* has answered, and that is different from a blank.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export function rateBandLabel(band: string | null): string | null {
  if (!band) return null;
  const labels: Record<string, string> = {
    'under-400': 'Under £400/day',
    '400-700': '£400–700/day',
    '700-plus': '£700+/day',
    'not-for-hire': 'Not for hire'
  };
  return labels[band] ?? null;
}

export function personRow(person: PersonSummary, now: number): CommunityPersonRowView {
  return {
    handle: person.handle,
    title: personTitle(person),
    meta: personMeta(person, now),
    detail: person.bio,
    initial: avatarInitial(person),
    chips: personChips(person)
  };
}

// ── The narrowing ─────────────────────────────────────────────────────────────

/**
 * Everything the search box looks in — `PEOPLE_SPEC.searchable`, field for field.
 *
 * 🔴 Kept identical to the web's on purpose. A person findable on `/people` by typing a skill and
 * not findable here would be the two clients disagreeing about who exists, which is the one thing
 * D15 says a mirror may not do — and it would look like an editor bug to the person who cannot
 * find their colleague.
 */
export function searchable(person: PersonSummary): (string | null)[] {
  return [person.displayName, person.handle, person.bio, ...person.skills];
}

/**
 * ⚠️ `includes`, case-insensitive, deliberately dumb — UNI-023's own words: *"no fuzzy matching
 * and no ranking; when that stops being enough the answer is a search index, not a cleverer
 * where."* Matching the web's semantics matters more than matching better than it.
 */
export function matchesQuery(person: PersonSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return searchable(person)
    .filter((field): field is string => typeof field === 'string')
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

/** The two filters the directory offers, which are the two flags the platform's own row carries. */
export const DIRECTORY_FILTERS = [
  { key: 'work', label: 'Available for work' },
  { key: 'coaching', label: 'Offers coaching' }
] as const;

export function matchesFilters(person: PersonSummary, active: readonly string[]): boolean {
  // ⚠️ AND across the two, which is what a filter bar means everywhere else: somebody who ticks
  // both is asking for people who do both, not for the union.
  if (active.includes('work') && !person.availableForWork) return false;
  if (active.includes('coaching') && !person.offersCoaching) return false;
  return true;
}

/**
 * 🔴 **THE ONLY PLACE A PERSON IS INCLUDED OR EXCLUDED**, and both the rows and every filter
 * count call it. That is `facets.ts`'s rule carried over: a pill's number is not *related to*
 * what clicking it gives you, it **is** what clicking it gives you, computed by one function.
 * Two producers of one number is exactly where they drift, and nothing in a "does it render?"
 * test can see it.
 */
export function selectPeople(
  people: PersonSummary[],
  query: string,
  active: readonly string[]
): PersonSummary[] {
  return people.filter((person) => matchesQuery(person, query) && matchesFilters(person, active));
}

// ── The directory ─────────────────────────────────────────────────────────────

export type DirectoryInputs = {
  /** 🔴 D15's source. Never a profile's or the list's 404 — see the header. */
  me: Read<MeResponse> | undefined;
  /** `undefined` = not asked yet. */
  read: Read<Directory> | undefined;
  query: string;
  activeFilters: readonly string[];
  now?: number;
};

/**
 * The sentence a partial directory has to say.
 *
 * 🔴 **A bounded query reports its bound.** `readDirectory` follows `nextOffset` to the end and
 * stops at a stated cap; when it stopped early, the reader is searching part of the directory and
 * has to be told, because a search over 100 of 340 people that finds nobody looks exactly like a
 * community with nobody in it.
 */
export function boundLine(directory: Directory): string | null {
  if (directory.complete) return null;
  return `Showing the first ${countOf(directory.people.length, 'person', 'people')} of ${
    directory.total
  } — search covers only these.`;
}

/**
 * `11 people`, or `2 of 11 people` when something is narrowing.
 *
 * ⚠️ The denominator is what we HOLD, not `page.total`. Saying "2 of 340" beside a search that
 * only looked at 100 of them would be a number computed over one population and printed against
 * another — and {@link boundLine} is already the honest statement of that gap.
 */
export function directorySummary(shown: number, held: number, narrowed: boolean): string {
  if (!narrowed) return countOf(held, 'person', 'people');
  return `${shown} of ${countOf(held, 'person', 'people')}`;
}

export function composeDirectory(inputs: DirectoryInputs): { surface: 'hidden' } | { surface: 'shown'; view: CommunityDirectoryView } {
  const { me, read, query, activeFilters } = inputs;
  const now = inputs.now ?? Date.now();

  // 1. D15, off `me` alone and before anything else is read.
  if (me?.outcome === 'ok' && me.value.community.surface === 'absent') {
    return { surface: 'hidden' };
  }

  const narrowed = query.trim() !== '' || activeFilters.length > 0;

  const shell = (section: CommunitySectionState<CommunityPersonRowView>, extra: Partial<CommunityDirectoryView> = {}) => ({
    surface: 'shown' as const,
    view: {
      section,
      summary: null,
      boundLine: null,
      // ⚠️ The two empties are different sentences and neither is "nothing here". One says what
      // the directory is FOR; the other says a search matched nobody and is a state the reader
      // caused and can undo.
      emptyLine: narrowed
        ? 'Nobody here matches that yet — try fewer words, or clear the filters.'
        : 'Builders who have published or finished something, and chose to be listed, appear here.',
      // The web page's own label, which NAMES the fields so the box does not promise more than
      // it does.
      searchLabel: 'Search names, handles, bios and skills',
      query,
      filters: [] as CommunityFilterPill[],
      ...extra
    }
  });

  // 2. Not asked yet.
  if (read === undefined) return shell({ state: 'loading' });

  // 3. 🔴 A failed read is `unreachable` and NEVER an empty directory. "Nobody is here" and "we
  //    could not ask" are opposite facts, and the first is the one that makes somebody stop
  //    looking for help in this editor.
  if (read.outcome === 'unreachable') return shell({ state: 'unreachable', detail: read.detail });

  // 4. ⚠️ A 404 on the LIST is `absent` too, and it is drawn as `hidden` for the same reason the
  //    profile's is: the route is D15-gated, so the only viewer who gets one is a refused one —
  //    reached here only when `me` did not say so first, which is the case where the two
  //    disagree and the safer reading is the refusal.
  if (read.outcome === 'absent') return { surface: 'hidden' };

  // 5. ⚠️ **`unauthenticated` CANNOT HAPPEN ON THIS ROUTE TODAY, and it is still branched.**
  //    `/api/v1/community/people` answers 200 for a null viewer on purpose — D15's refusal is
  //    the 404 above, and a signed-out pull has to be indistinguishable from a member's. So
  //    this is the shape of a state that only appears if that route is ever re-scoped, and it
  //    gets a sentence rather than a cast. 🔴 If it ever DOES fire, this view needs a state of
  //    its own: "sign in" and "could not reach" are different offers and this union has one.
  if (read.outcome === 'unauthenticated') {
    return shell({ state: 'unreachable', detail: 'Sign in to see who is here.' });
  }

  const directory = read.value;
  const rows = selectPeople(directory.people, query, activeFilters);

  const filters: CommunityFilterPill[] = DIRECTORY_FILTERS.map((filter) => {
    // 🔴 The count is what CLICKING this pill gives you — computed by `selectPeople`, from the
    // same rows, in the same call. See its note.
    const next = activeFilters.includes(filter.key)
      ? activeFilters.filter((key) => key !== filter.key)
      : [...activeFilters, filter.key];
    return {
      key: filter.key,
      label: filter.label,
      count: selectPeople(directory.people, query, next).length,
      active: activeFilters.includes(filter.key)
    };
  });

  const view = shell(
    rows.length === 0
      ? { state: 'empty' }
      : { state: 'items', items: rows.map((person) => personRow(person, now)) },
    {
      summary: directorySummary(rows.length, directory.people.length, narrowed),
      boundLine: boundLine(directory),
      filters
    }
  );
  return view;
}

// ── The profile ───────────────────────────────────────────────────────────────

/** `learning · bronze · earned 4 months ago`. */
export function badgeMeta(badge: PersonBadge, now: number): string {
  return (
    metaLine([
      badge.family || null,
      badge.tier || null,
      badge.earnedAt ? `earned ${relativeTime(badge.earnedAt, now) ?? 'a while ago'}` : null
    ]) ?? ''
  );
}

export function badgeView(badge: PersonBadge, now: number): CommunityBadgeView {
  return {
    title: badge.title,
    meta: badgeMeta(badge, now),
    // 🔴 Keyed on family + tier, NOT on `artwork`. The path is the platform's filesystem and this
    // editor has no business resolving one; the two fields are the badge's identity and a key
    // with no mark here draws the no-artwork branch. See `badgeMarks.ts`.
    mark: badgeMark(badge.family, badge.tier)
  };
}

/**
 * What listing would require, when this profile does not meet D8's bar.
 *
 * ⚠️ The platform sends `bar` **because a public-but-unlisted profile can say what listing would
 * need**, and dropping it here would make the editor's profile quieter than the web's. Phrased
 * about the profile rather than about the person: "they have not written a blurb" is a sentence
 * about somebody, and this is a sentence about a page.
 */
export function barLine(profile: PersonProfile): string | null {
  if (profile.bar.meets) return null;
  const missing = [
    profile.bar.hasName ? null : 'a name',
    profile.bar.hasBlurb ? null : 'a blurb',
    profile.bar.hasPublishedThingOrLesson ? null : 'one published prefab or finished lesson'
  ].filter((item): item is string => item !== null);
  if (missing.length === 0) return null;
  const list =
    missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return `This profile is not listed in the directory yet — listing needs ${list}.`;
}

export type ProfileInputs = {
  me: Read<MeResponse> | undefined;
  read: Read<PersonProfile> | undefined;
  cached?: { profile: PersonProfile; at: number } | null;
  now?: number;
  /**
   * AC6 — how to reach this person, decided by the host.
   *
   * 🔴 A function rather than a flag, because the answer is per profile and per viewer, and
   * because *"nothing labelled 'message' that opens Chrome"* is a promise about the verb and the
   * action **together**. Returning `null` draws no contact affordance, which is the honest answer
   * when the platform offers no route to somebody.
   */
  contactFor?: (profile: PersonProfile) => CommunityProfileDetailView['contact'];
};

export function profileDetailView(
  profile: PersonProfile,
  now: number,
  contactFor?: ProfileInputs['contactFor']
): CommunityProfileDetailView {
  const chips: CommunityChip[] = [];
  if (profile.availableForWork) chips.push({ label: 'Available for work', tone: 'good' });
  if (profile.offersCoaching) chips.push({ label: 'Offers coaching', tone: 'accent' });

  return {
    title: personTitle(profile),
    handle: `@${profile.handle}`,
    initial: avatarInitial(profile),
    // The web profile's eyebrow, and the same two facts in the same order.
    eyebrow:
      metaLine([profile.offersCoaching ? 'Coach' : null, profile.availableForWork ? 'Available for work' : null]) ??
      null,
    bio: profile.bio,
    stat: `${countOf(profile.points, 'point', 'points')} · ${profile.badges.length} of ${BADGE_TAXONOMY_SIZE} badges`,
    chips,
    badges: profile.badges.map((badge) => badgeView(badge, now)),
    badgesEmptyLine: 'Badges are earned by publishing, answering and finishing lessons. None yet.',
    links: profile.links.map((link) => ({ label: link.label, url: link.url })),
    barLine: barLine(profile),
    contact: contactFor ? contactFor(profile) : null
  };
}

/**
 * The whole screen, as data. The order of the branches is the argument, and it is
 * `composeThreadView`'s with one addition:
 *
 * 1. **`me` says absent → `hidden`.** D15, read off the viewer.
 * 2. **A live read → `ready`.** No cache banner: this is the profile as it is right now.
 * 3. **404 → `gone`.** 🔴 Reachable only once (1) has said the surface exists for this viewer,
 *    which is what stops a dead handle from being drawn as a school policy — and what stops a
 *    refusal from being drawn as a typo.
 * 4. **A failed read with a copy → `ready`, saying how old it is.**
 * 5. **Not asked yet → `loading`.** ⚠️ Ahead of the cache deliberately: `cachedSince` means *the
 *    live read failed*, and showing it while a request is in flight puts a sentence on screen
 *    that is not true yet.
 * 6. **A failed read with no copy → `unreachable`.**
 */
export function composeProfileView(inputs: ProfileInputs): CommunityProfileState {
  const { me, read, cached, contactFor } = inputs;
  const now = inputs.now ?? Date.now();

  if (me?.outcome === 'ok' && me.value.community.surface === 'absent') {
    return { state: 'hidden' };
  }

  if (read?.outcome === 'ok') {
    return { state: 'ready', profile: profileDetailView(read.value, now, contactFor), cachedSince: null };
  }

  if (read?.outcome === 'absent') {
    return { state: 'gone' };
  }

  if (read !== undefined && cached) {
    return {
      state: 'ready',
      profile: profileDetailView(cached.profile, now, contactFor),
      cachedSince: relativeTime(new Date(cached.at).toISOString(), now) ?? 'a moment ago'
    };
  }

  if (read === undefined) return { state: 'loading' };
  // ⚠️ See `communityPeopleView`'s branch 5 — unreachable on this route today, branched rather
  // than cast, and a sign to add a real state if the profile route ever answers 401.
  if (read.outcome === 'unauthenticated') return { state: 'unreachable', detail: 'Sign in to see this profile.' };

  return { state: 'unreachable', detail: read.detail };
}
