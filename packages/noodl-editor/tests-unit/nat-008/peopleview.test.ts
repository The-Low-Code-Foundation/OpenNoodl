/**
 * NAT-008 — who the directory shows, what the search does, and which state a profile is in.
 *
 * ## 🔴 The search is control-tested, and the control is the point
 *
 * *"A search box that returns the unfiltered list looks like a working search box"* — this task's
 * trap, and a measured failure mode in this codebase four times over. So the narrowing is graded
 * in three directions and **never** by "does the result contain the person I asked for":
 *
 * 1. a query that must return **exactly one known row**;
 * 2. a query that must return **nothing** — the one a broken filter cannot pass;
 * 3. an empty query that must return **everything** — without which (1) and (2) are also passed by
 *    a filter that returns nothing at all.
 *
 * All three are needed. Any two of them are passed by some implementation that is wrong.
 *
 * @module noodl-editor/tests-unit/nat-008/peopleview
 */
import type { Directory, MeResponse, PersonProfile, PersonSummary, Read } from '@noodl-models/community/communityapi';
import {
  avatarInitial,
  barLine,
  boundLine,
  composeDirectory,
  composeProfileView,
  directorySummary,
  matchesQuery,
  personChips,
  personMeta,
  personTitle,
  rateBandLabel,
  selectPeople
} from '@noodl-models/community/peopleview';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const DAY = 86_400_000;

function person(over: Partial<PersonSummary> = {}): PersonSummary {
  return {
    handle: 'ada',
    displayName: 'Ada Lovelace',
    bio: 'Builds compilers.',
    availableForWork: true,
    offersCoaching: false,
    points: 40,
    rateBand: null,
    skills: [],
    badgeCount: 2,
    lastActiveAt: new Date(NOW - 3 * DAY).toISOString(),
    ...over
  };
}

const PEOPLE: PersonSummary[] = [
  person(),
  person({ handle: 'grace', displayName: 'Grace Hopper', bio: 'Builds ships.', skills: ['COBOL'] }),
  person({
    handle: 'linus',
    displayName: 'Linus',
    bio: 'Builds kernels.',
    availableForWork: false,
    offersCoaching: true,
    skills: ['C']
  })
];

function directoryRead(over: Partial<Directory> = {}): Read<Directory> {
  return { outcome: 'ok', value: { people: PEOPLE, total: PEOPLE.length, complete: true, ...over } };
}

const PERMITTED: Read<MeResponse> = {
  outcome: 'ok',
  value: { viewer: { handle: 'ada', kind: 'individual' }, community: { surface: 'present', capabilities: {} } }
};

const REFUSED: Read<MeResponse> = {
  outcome: 'ok',
  value: { viewer: { handle: 'pupil', kind: 'org_minor' }, community: { surface: 'absent', reason: 'org policy' } }
};

function shown(view: ReturnType<typeof composeDirectory>) {
  if (view.surface !== 'shown') throw new Error('expected the directory to be shown');
  return view.view;
}

function rowHandles(view: ReturnType<typeof composeDirectory>): string[] {
  const section = shown(view).section;
  if (section.state !== 'items') return [];
  return section.items.map((item) => item.handle);
}

describe('NAT-008 — the search narrows, and the control says so', () => {
  it('an empty query returns everybody', () => {
    // 🔴 The control that (2) needs. Without it, `() => []` passes the must-return-nothing case.
    expect(selectPeople(PEOPLE, '', []).map((p) => p.handle)).toEqual(['ada', 'grace', 'linus']);
  });

  it('a query that matches one person returns exactly that person', () => {
    expect(selectPeople(PEOPLE, 'ada', []).map((p) => p.handle)).toEqual(['ada']);
  });

  it('a query that matches nobody returns nobody', () => {
    // 🔴 THE ONE A BROKEN FILTER CANNOT PASS. The endpoint itself fails exactly here: measured
    // 2026-08-20, `?q=zzzzzzzz` returns the whole directory. See `communityapi.readDirectory`.
    expect(selectPeople(PEOPLE, 'zzzzzzzz', [])).toEqual([]);
  });

  it('searches the same four fields the web page searches', () => {
    // `PEOPLE_SPEC.searchable` is `[displayName, handle, bio, ...skills]`. A person findable on
    // /people and not findable here is the two clients disagreeing about who exists.
    expect(matchesQuery(person(), 'Lovelace')).toBe(true); // displayName
    expect(matchesQuery(person(), 'ada')).toBe(true); // handle
    expect(matchesQuery(person(), 'compilers')).toBe(true); // bio
    expect(matchesQuery(person({ skills: ['GraphQL'] }), 'graphql')).toBe(true); // skills, folded
    expect(matchesQuery(person(), '40')).toBe(false); // points are NOT searchable, on either client
  });

  it('a filter narrows, and two filters are ANDed', () => {
    expect(selectPeople(PEOPLE, '', ['work']).map((p) => p.handle)).toEqual(['ada', 'grace']);
    expect(selectPeople(PEOPLE, '', ['coaching']).map((p) => p.handle)).toEqual(['linus']);
    // Nobody is both, and the answer is empty rather than the union.
    expect(selectPeople(PEOPLE, '', ['work', 'coaching'])).toEqual([]);
  });

  it('a filter pill\'s count IS the number of rows clicking it gives you', () => {
    // 🔴 `facets.ts`'s rule, carried over: two producers of one number is where they drift, and
    // nothing in a "does it render?" test can see it. Asserted by clicking.
    const before = shown(composeDirectory({ me: PERMITTED, read: directoryRead(), query: '', activeFilters: [], now: NOW }));
    const coaching = before.filters.find((f) => f.key === 'coaching');
    expect(coaching?.count).toBe(1);

    const after = composeDirectory({ me: PERMITTED, read: directoryRead(), query: '', activeFilters: ['coaching'], now: NOW });
    expect(rowHandles(after)).toHaveLength(coaching!.count);
  });

  it('an ACTIVE pill counts what turning it OFF would give', () => {
    // ⚠️ The pill is a toggle, so its count has to be the state after clicking — which for an
    // active pill is the wider list. A count of "what it currently shows" would be a number that
    // never changes and a control whose label contradicts its effect.
    const view = shown(
      composeDirectory({ me: PERMITTED, read: directoryRead(), query: '', activeFilters: ['coaching'], now: NOW })
    );
    expect(view.filters.find((f) => f.key === 'coaching')?.count).toBe(3);
  });
});

describe('NAT-008 — D15, and the states that are not each other', () => {
  it('a refused viewer gets NOTHING, read off `me` and not off a 404', () => {
    expect(composeDirectory({ me: REFUSED, read: directoryRead(), query: '', activeFilters: [], now: NOW })).toEqual({
      surface: 'hidden'
    });
  });

  it('the permitted control is shown — otherwise "hidden" is unfalsifiable', () => {
    // 🔴 Beside every absence: a component that never ran also draws nothing. This is the row
    // that proves the refusal above is about the refusal.
    const view = composeDirectory({ me: PERMITTED, read: directoryRead(), query: '', activeFilters: [], now: NOW });
    expect(view.surface).toBe('shown');
    expect(rowHandles(view)).toEqual(['ada', 'grace', 'linus']);
  });

  it('a failed read is `unreachable` and NEVER an empty directory', () => {
    // "Nobody is here" and "we could not ask" are opposite facts, and the first is the one that
    // makes somebody stop looking for help in this editor.
    const view = shown(
      composeDirectory({
        me: PERMITTED,
        read: { outcome: 'unreachable', status: 500, detail: 'HTTP 500' },
        query: '',
        activeFilters: [],
        now: NOW
      })
    );
    expect(view.section.state).toBe('unreachable');
  });

  it('not asked yet is `loading`, which is not `empty` either', () => {
    expect(shown(composeDirectory({ me: PERMITTED, read: undefined, query: '', activeFilters: [], now: NOW })).section.state).toBe(
      'loading'
    );
  });

  it('the two empty lines are different sentences', () => {
    const quiet = shown(
      composeDirectory({ me: PERMITTED, read: directoryRead({ people: [], total: 0 }), query: '', activeFilters: [], now: NOW })
    );
    const filtered = shown(
      composeDirectory({ me: PERMITTED, read: directoryRead(), query: 'zzzzzzzz', activeFilters: [], now: NOW })
    );

    expect(quiet.section.state).toBe('empty');
    expect(filtered.section.state).toBe('empty');
    // ⚠️ One says what the directory is FOR; the other says a search matched nobody and is a
    // state the reader caused and can undo. A shared default would collapse them.
    expect(quiet.emptyLine).not.toBe(filtered.emptyLine);
    expect(filtered.emptyLine).toMatch(/clear the filters/);
  });
});

describe('NAT-008 — a bounded read reports its bound', () => {
  it('a complete directory says nothing about being partial', () => {
    expect(boundLine({ people: PEOPLE, total: 3, complete: true })).toBeNull();
  });

  it('an incomplete one says how many it holds AND that search only covers those', () => {
    // 🔴 A search over 100 of 340 people that finds nobody looks exactly like a community with
    // nobody in it. This sentence is the difference.
    const line = boundLine({ people: PEOPLE, total: 340, complete: false });
    expect(line).toContain('3 people');
    expect(line).toContain('340');
    expect(line).toMatch(/search covers only these/);
  });

  it('the summary counts against what we HOLD, not against the platform total', () => {
    // ⚠️ "2 of 340" beside a search that only looked at 100 of them would be a number computed
    // over one population and printed against another.
    expect(directorySummary(3, 3, false)).toBe('3 people');
    expect(directorySummary(1, 3, true)).toBe('1 of 3 people');
    expect(directorySummary(1, 1, false)).toBe('1 person');
  });
});

describe('NAT-008 — the words on a row', () => {
  it('somebody with no display name is drawn as their handle, not as "Unnamed"', () => {
    expect(personTitle({ handle: 'ada', displayName: null })).toBe('@ada');
    expect(personTitle({ handle: 'ada', displayName: '  ' })).toBe('@ada');
  });

  it('the avatar letter survives an astral first character', () => {
    // 🔴 `charAt(0)` on "🌟Nova" is half a surrogate pair and draws a replacement glyph.
    expect(avatarInitial({ handle: 'nova', displayName: '🌟Nova' })).toBe('🌟');
    expect(avatarInitial({ handle: 'ada', displayName: 'ada lovelace' })).toBe('A');
    expect(avatarInitial({ handle: '', displayName: null })).toBe('?');
  });

  it('the meta line carries the web row\'s three facts plus how recently they were around', () => {
    const meta = personMeta(person(), NOW);
    expect(meta).toContain('@ada');
    expect(meta).toContain('40 points');
    expect(meta).toContain('2 of 12 badges');
    expect(meta).toContain('active 3 days ago');
  });

  it('somebody with no recorded activity gets a shorter line, not "active never"', () => {
    expect(personMeta(person({ lastActiveAt: null }), NOW)).not.toContain('active');
  });

  it('a blank rate band draws NO chip, and an unknown key draws no chip either', () => {
    // ⚠️ The web page's own decision: "a blank band is a person who did not answer, and printing
    // a placeholder would make not answering look like a fact about them."
    expect(rateBandLabel(null)).toBeNull();
    // 🔴 And a key this client does not know draws nothing rather than the raw `day_9000_plus` —
    // a database column's spelling in a sentence somebody is trying to read.
    expect(rateBandLabel('day_9000_plus')).toBeNull();

    // 🔴 THE FOUR KEYS, AS THE PLATFORM ACTUALLY SPELLS THEM. The first draft of this map guessed
    // `day_400_600` in the house style of every other enum over there, and the real key is
    // `400-700` — found by curling the endpoint, because the guarded failure draws NO chip and a
    // missing chip is also what a person who did not answer correctly gets. A safe failure mode
    // is not a substitute for reading the source.
    expect(rateBandLabel('under-400')).toBe('Under £400/day');
    expect(rateBandLabel('400-700')).toBe('£400–700/day');
    expect(rateBandLabel('700-plus')).toBe('£700+/day');
    // ⚠️ A real band, not a blank: somebody who answered "no" has answered.
    expect(rateBandLabel('not-for-hire')).toBe('Not for hire');

    const labels = personChips(person({ rateBand: 'day_9000_plus' })).map((c) => c.label);
    expect(labels).not.toContain('day_9000_plus');
  });

  it('the two flags are toned chips and the skills come after them', () => {
    const chips = personChips(person({ offersCoaching: true, rateBand: '400-700', skills: ['C'] }));
    expect(chips.map((c) => c.label)).toEqual(['Available for work', 'Offers coaching', '£400–700/day', 'C']);
    expect(chips[0].tone).toBe('good');
    expect(chips[2].tone).toBe('neutral');
  });
});

describe('NAT-008 — a profile, and the order of its branches', () => {
  function profile(over: Partial<PersonProfile> = {}): PersonProfile {
    return {
      handle: 'ada',
      displayName: 'Ada Lovelace',
      bio: 'Builds compilers.',
      availableForWork: true,
      offersCoaching: false,
      points: 40,
      avatarUrl: null,
      links: [],
      badges: [],
      bar: { hasName: true, hasBlurb: true, hasPublishedThingOrLesson: true, meets: true },
      ...over
    };
  }

  it('D15 wins over a successful read', () => {
    expect(
      composeProfileView({ me: REFUSED, read: { outcome: 'ok', value: profile() }, now: NOW }).state
    ).toBe('hidden');
  });

  it('a 404 is `gone` — for all four things it can mean, and only for a permitted viewer', () => {
    // 🔴 Private, hidden, never existed, and D15-refused are ONE answer on the wire, on purpose.
    // Reaching this arm at all requires `me` to have said the surface exists.
    expect(composeProfileView({ me: PERMITTED, read: { outcome: 'absent' }, now: NOW }).state).toBe('gone');
  });

  it('a live read beats a cached copy, and says nothing about a cache', () => {
    const state = composeProfileView({
      me: PERMITTED,
      read: { outcome: 'ok', value: profile() },
      cached: { profile: profile({ displayName: 'STALE' }), at: NOW - DAY },
      now: NOW
    });
    if (state.state !== 'ready') throw new Error('expected ready');
    expect(state.profile.title).toBe('Ada Lovelace');
    expect(state.cachedSince).toBeNull();
  });

  it('`loading` comes AHEAD of the cache', () => {
    // ⚠️ `cachedSince` means the live read FAILED. Showing it while a request is in flight puts a
    // sentence on screen that is not true yet.
    const state = composeProfileView({
      me: PERMITTED,
      read: undefined,
      cached: { profile: profile(), at: NOW - DAY },
      now: NOW
    });
    expect(state.state).toBe('loading');
  });

  it('a failed read WITH a copy is ready and says how old it is', () => {
    const state = composeProfileView({
      me: PERMITTED,
      read: { outcome: 'unreachable', status: null, detail: 'offline' },
      cached: { profile: profile(), at: NOW - DAY },
      now: NOW
    });
    if (state.state !== 'ready') throw new Error('expected ready');
    // ⚠️ `relativeTime`'s own word for one day. Asserted as the string it produces rather than
    // as "1 day ago", because this spec is about WHICH branch ran, not about that formatter —
    // which `communityMeta`'s own suite already grades.
    expect(state.cachedSince).toBe('yesterday');
  });

  it('a failed read with NO copy is unreachable', () => {
    expect(
      composeProfileView({
        me: PERMITTED,
        read: { outcome: 'unreachable', status: null, detail: 'offline' },
        now: NOW
      }).state
    ).toBe('unreachable');
  });

  it('says what listing would require, and only when it would not', () => {
    expect(barLine(profile())).toBeNull();
    const line = barLine(profile({ bar: { hasName: true, hasBlurb: false, hasPublishedThingOrLesson: false, meets: false } }));
    expect(line).toContain('a blurb');
    expect(line).toContain('one published prefab or finished lesson');
    // ⚠️ A sentence about a page, not about a person.
    expect(line).toMatch(/^This profile/);
  });

  it('the badge denominator is D4\'s twelve, not the number they hold', () => {
    const state = composeProfileView({ me: PERMITTED, read: { outcome: 'ok', value: profile() }, now: NOW });
    if (state.state !== 'ready') throw new Error('expected ready');
    expect(state.profile.stat).toBe('40 points · 0 of 12 badges');
  });

  it('draws no contact affordance when the host offers none', () => {
    // 🔴 AC6 — "nothing labelled 'message' that opens Chrome". No route today, so no button.
    const state = composeProfileView({ me: PERMITTED, read: { outcome: 'ok', value: profile() }, now: NOW });
    if (state.state !== 'ready') throw new Error('expected ready');
    expect(state.profile.contact).toBeNull();
  });
});
