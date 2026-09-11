/**
 * UNI-011 / D21 — what the community panel shows, and the one thing it must not show.
 *
 * 🔴 THE CENTRAL ASSERTION IS AGAIN A NEGATIVE ONE, and it is a different negative from
 * `communityapi.test.ts`. That file proves the client *decides nothing*. This one proves the
 * panel *renders nothing* in exactly one case — D15's `absent` — while rendering something in
 * every other case including the ones that look like failure.
 *
 * ⚠️ **The trap this file is built around: an "is the surface hidden?" test passes trivially if
 * the surface is hidden too often.** A `composeMirror` that returned `hidden` for anything that
 * was not a perfect `ok` would satisfy the D15 assertion and destroy the panel. So every hidden
 * assertion below is paired with a NOT-hidden assertion over a payload that is failing in some
 * other way — unreachable, absent-forum, empty, signed-out — and those pairs are the point. A
 * known-firing signal beside every claimed absence.
 */
import {
  BENCH_DEFAULT_STATE,
  benchBoundLine,
  composeBench,
  composeMirror,
  type MirrorInputs,
  type MirrorView
} from '../../src/editor/src/models/community/mirrorview';
import { MIRROR_THREAD_WINDOW } from '@noodl-models/community/communityapi';
import type { CommunityHome, ForumState, MeResponse, ThresholdResponse } from '@noodl-models/community/communityapi';

const THRESHOLD: ThresholdResponse = {
  met: false,
  entryPoint: 'browser',
  threads: { value: 2, required: 30, met: false },
  consecutiveWeeksWithCall: { value: 1, required: 3, met: false },
  medianFirstReply: {
    medianHours: 5.5,
    requiredBelowHours: 24,
    n: 3,
    unreplied: 1,
    minimumSample: 10,
    met: false
  }
};

const EMPTY_HOME: CommunityHome = { replays: [], articles: [], threshold: THRESHOLD, standing: null };

function shown(view: MirrorView) {
  if (view.surface !== 'shown') throw new Error(`expected a shown surface, got "${view.surface}"`);
  return view;
}

function inputs(overrides: Partial<MirrorInputs> = {}): MirrorInputs {
  return {
    me: { outcome: 'ok', value: { viewer: null, community: { surface: 'present', capabilities: {} } } },
    home: { outcome: 'ok', value: EMPTY_HOME },
    forum: { outcome: 'ok', value: { threads: [] } },
    session: null,
    ...overrides
  };
}

describe('UNI-011 / D21 — the community panel view model', () => {
  describe('🔴 D15: absent means the surface does not exist for this viewer', () => {
    it('hides everything when me() reports an absent surface', () => {
      const view = composeMirror(
        inputs({
          me: {
            outcome: 'ok',
            value: { viewer: { handle: 'pupil', kind: 'org_minor' }, community: { surface: 'absent', reason: 'off' } }
          }
        })
      );
      expect(view.surface).toBe('hidden');
    });

    it('🔴 hides on the refusal EVEN WHEN the home and the forum answered fine', () => {
      // The control that makes the assertion above mean something: identical rich payloads,
      // one field different. If `composeMirror` read anything but `me` for this decision, this
      // case would render a surface a pupil is not allowed to know exists.
      const view = composeMirror(
        inputs({
          me: {
            outcome: 'ok',
            value: { viewer: { handle: 'pupil', kind: 'org_minor' }, community: { surface: 'absent', reason: 'off' } }
          },
          home: {
            outcome: 'ok',
            value: { ...EMPTY_HOME, articles: [{ slug: 'a', title: 'A guide', summary: null, kind: 'guide' }] }
          },
          forum: {
            outcome: 'ok',
            value: { threads: [{ id: '1', title: 'A thread', createdAt: '', firstReplyMinutes: null, replyCount: 0, accepted: false }] }
          }
        })
      );
      expect(view.surface).toBe('hidden');
    });
  });

  describe('⚠️ and the paired positives — everything else stays visible', () => {
    it('an UNREACHABLE me() is not a refusal: the panel still renders', () => {
      // 🔴 The distinction D15 cannot afford to lose. Hiding here would make a flaky network
      // indistinguishable from a school policy.
      const view = composeMirror(inputs({ me: { outcome: 'unreachable', status: 503, detail: 'HTTP 503' } }));
      expect(view.surface).toBe('shown');
    });

    it('an ABSENT me() — a 404 from an editor pointed at nothing — still renders', () => {
      const view = composeMirror(inputs({ me: { outcome: 'absent' } }));
      expect(view.surface).toBe('shown');
    });
  });

  describe('🔴 D21: empty is a first-class state, and it is FOUR empties not one', () => {
    it('renders every section as empty rather than collapsing the panel', () => {
      const view = shown(composeMirror(inputs()));
      expect(view.bench.section.state).toBe('empty');
      expect(view.articles.state).toBe('empty');
      expect(view.replays.state).toBe('empty');
      // D16's surviving obligation: the health reading exists whether or not anyone posted.
      expect(view.health).not.toBeNull();
    });

    it('the live platform shape — a bare `{threads: []}` — reads as empty', () => {
      // 🔴 CURLED FROM community.nodegx.io ON 2026-08-19, not invented. The `{forum:'absent'}`
      // arm this file used to assert here was removed from the platform by D19, and this editor
      // declared it for a day afterwards. A fixture copied from a type is a fixture that agrees
      // with the type by construction; this one is a payload.
      const forum: ForumState = { threads: [] };
      const view = shown(composeMirror(inputs({ forum: { outcome: 'ok', value: forum } })));
      expect(view.bench.section.state).toBe('empty');
    });

    it('distinguishes NOT YET ASKED from EMPTY', () => {
      // ⚠️ The `useCommunityAccount` bug in a new place: a panel that renders "no discussions
      // yet" before the first response tells every user the community is dead on every open.
      const view = shown(composeMirror(inputs({ home: undefined, forum: undefined })));
      expect(view.bench.section.state).toBe('loading');
      expect(view.articles.state).toBe('loading');
      expect(view.health).toBeNull();
    });

    it('distinguishes UNREACHABLE from EMPTY, and carries the detail', () => {
      const view = shown(composeMirror(inputs({ forum: { outcome: 'unreachable', status: null, detail: 'ECONNREFUSED' } })));
      expect(view.bench.section).toEqual({ state: 'unreachable', detail: 'ECONNREFUSED' });
      // The control: the OTHER sections are unaffected by one failing read.
      expect(view.articles.state).toBe('empty');
    });
  });

  describe('the sections carry what they were given', () => {
    it('passes threads, articles and replays through', () => {
      const view = shown(
        composeMirror(
          inputs({
            home: {
              outcome: 'ok',
              value: {
                ...EMPTY_HOME,
                articles: [{ slug: 'g', title: 'Getting started', summary: null, kind: 'guide' }],
                replays: [{ slug: 'r', title: 'Week 1', heldOn: '2026-08-12', videoUrl: null, description: null }],
                standing: { points: 40, badges: [{}, {}] }
              }
            },
            forum: {
              outcome: 'ok',
              value: {
                threads: [
                  { id: '1', title: 'Why is my repeater empty?', createdAt: '', firstReplyMinutes: 12, replyCount: 1, accepted: false }
                ]
              }
            }
          })
        )
      );
      expect(view.bench.section).toEqual({
        state: 'items',
        items: [{ id: '1', title: 'Why is my repeater empty?', createdAt: '', firstReplyMinutes: 12, replyCount: 1, accepted: false }]
      });
      expect(view.articles.state).toBe('items');
      expect(view.replays.state).toBe('items');
      expect(view.standing).toEqual({ points: 40, badges: 2 });
    });
  });

  describe('🔴 the threshold survives as a READOUT, with its n', () => {
    it('reports every component with its requirement and the median with its sample size', () => {
      const view = shown(composeMirror(inputs()));
      expect(view.health).toEqual({
        threads: { value: 2, required: 30 },
        weeksWithCall: { value: 1, required: 3 },
        reply: { medianHours: 5.5, requiredBelowHours: 24, n: 3, unreplied: 1 }
      });
    });

    it('🔴 does NOT branch on `met` — a failing threshold still renders the whole surface', () => {
      // The reversal, asserted where it can fail. `THRESHOLD` is `met: false` with
      // `entryPoint: 'browser'` — the exact payload D16 said must send the user to a browser —
      // and the panel renders regardless. A re-introduced gate fails here.
      const view = composeMirror(inputs());
      expect(view.surface).toBe('shown');
      expect(THRESHOLD.met).toBe(false);
      expect(THRESHOLD.entryPoint).toBe('browser');
    });

    it('carries a null median rather than inventing a number', () => {
      const home: CommunityHome = {
        ...EMPTY_HOME,
        threshold: { ...THRESHOLD, medianFirstReply: { ...THRESHOLD.medianFirstReply, medianHours: null, n: 0 } }
      };
      const view = shown(composeMirror(inputs({ home: { outcome: 'ok', value: home } })));
      expect(view.health?.reply.medianHours).toBeNull();
      expect(view.health?.reply.n).toBe(0);
    });
  });

  describe('the viewer, in three states', () => {
    it('null while the store is silent, false when signed out, a handle when signed in', () => {
      expect(shown(composeMirror(inputs({ session: undefined }))).viewer).toBeNull();
      expect(shown(composeMirror(inputs({ session: null }))).viewer).toBe(false);
      expect(shown(composeMirror(inputs({ session: { token: 't', handle: 'nia' } }))).viewer).toEqual({ handle: 'nia' });
    });

    it('signed in with no handle is a real state, not a missing one', () => {
      expect(shown(composeMirror(inputs({ session: { token: 't' } }))).viewer).toEqual({ handle: null });
    });

    it('standing is null when the platform sent none', () => {
      expect(shown(composeMirror(inputs({ session: { token: 't', handle: 'nia' } }))).standing).toBeNull();
    });

    it('🔴 the token never reaches the view model', () => {
      // The view model is handed to a React tree in a `nodeIntegration: true` renderer. Asserted
      // over the SERIALISED view rather than by inspecting `viewer`, because the point is that
      // the token is nowhere in it — a field-by-field check only covers the fields someone
      // thought of, and a future section added over `session` would slip past one.
      const view = composeMirror(inputs({ session: { token: 'secret-token-value', handle: 'nia' } }));
      expect(JSON.stringify(view)).not.toContain('secret-token-value');
      // The known-firing control: the same sweep DOES find the handle, so a pass is not the
      // stringifier quietly dropping everything.
      expect(JSON.stringify(view)).toContain('nia');
    });
  });
});

// ── FB-002 — the answered question that won't leave ───────────────────────────────────────

/**
 * 🔴 Richard, 2026-08-22: *"The ones that are marked as answer accepted still appear in the list
 * of questions on the bench, instead of being relegated to an 'answered' filter (still
 * searchable)."* AC1/AC2 shipped that on the web on the same day; this is AC3/AC4, the mirror.
 *
 * ⚠️ **The trap this block is built around is the one `readDirectory` was built around.** A
 * filter that returns everything and a filter that is never called are the same screen, and a
 * filter that returns nothing and a community with nothing in it are the same screen too. So
 * every claim below is made beside a control that must read the other way — and the corpus is
 * deliberately mixed, because a partition tested on a corpus of one arm proves nothing about
 * the other.
 */
describe('FB-002 — the Bench defaults to the questions that still need work', () => {
  const thread = (id: string, accepted: boolean) => ({
    id,
    title: `Question ${id}`,
    createdAt: '2026-08-20T10:00:00.000Z',
    firstReplyMinutes: accepted ? 30 : null,
    // ⚠️ FIX-025 bug 7 made this load-bearing for the sentence a row draws. An accepted thread
    // here is one somebody ELSE answered, which is why its minutes are non-null.
    replyCount: accepted ? 1 : 0,
    accepted
  });

  /** Two waiting, one solved — so "everything" and "either arm" are three different answers. */
  const MIXED = [thread('w1', false), thread('s1', true), thread('w2', false)];
  const forumOf = (threads: typeof MIXED) => ({ outcome: 'ok' as const, value: { threads } });
  const titles = (view: ReturnType<typeof composeBench>) =>
    view.section.state === 'items' ? view.section.items.map((t) => t.id) : [];

  describe('AC4 — the default is the web Bench’s default', () => {
    it('🔴 opens on WAITING, not on everything', () => {
      expect(BENCH_DEFAULT_STATE).toBe('waiting');
      const view = shown(composeMirror(inputs({ forum: forumOf(MIXED) })));
      expect(titles(view.bench)).toEqual(['w1', 'w2']);
    });

    it('⚠️ and `composeMirror` really applies it rather than passing the read through', () => {
      // The mutation this kills: `bench: composeBench(forum, 'solved')`, or dropping the
      // `benchState` argument so the caller's choice is ignored. Both leave a list on screen.
      const solved = shown(composeMirror(inputs({ forum: forumOf(MIXED), benchState: 'solved' })));
      expect(titles(solved.bench)).toEqual(['s1']);
    });
  });

  describe('🔴 the three-way control: one, none, and the other arm', () => {
    it('must-return-a-subset: the solved thread is NOT in the default list', () => {
      expect(titles(composeBench(forumOf(MIXED), 'waiting'))).not.toContain('s1');
    });

    it('must-return-NOTHING: an all-solved Bench defaults to an empty list', () => {
      const allSolved = [thread('s1', true), thread('s2', true)];
      expect(titles(composeBench(forumOf(allSolved), 'waiting'))).toEqual([]);
    });

    it('⚠️ …with the known-firing control beside it: the SAME corpus fills the other arm', () => {
      // 🔴 Without this row, "the filter works" and "the filter drops everything" read alike.
      const allSolved = [thread('s1', true), thread('s2', true)];
      expect(titles(composeBench(forumOf(allSolved), 'solved'))).toEqual(['s1', 's2']);
    });

    it('and the two arms PARTITION the window — nothing is in both, nothing is in neither', () => {
      const waiting = titles(composeBench(forumOf(MIXED), 'waiting'));
      const solved = titles(composeBench(forumOf(MIXED), 'solved'));
      expect([...waiting, ...solved].sort()).toEqual(['s1', 'w1', 'w2']);
      expect(waiting.filter((id) => solved.includes(id))).toEqual([]);
    });
  });

  describe('🔴 a pill’s count IS what clicking it gives you', () => {
    it('each count equals the rows that pill returns', () => {
      const pills = composeBench(forumOf(MIXED), 'waiting').filters;
      expect(pills.map((p) => p.key)).toEqual(['solved', 'waiting']);
      for (const pill of pills) {
        const clicked = composeBench(forumOf(MIXED), pill.key as 'solved' | 'waiting');
        expect([pill.key, pill.count]).toEqual([pill.key, titles(clicked).length]);
      }
    });

    it('⚠️ the counts do NOT move when the selection does', () => {
      // Both pills always count the whole window. A count computed over the *filtered* rows
      // would read `Solved 0` while standing on Waiting, which is the bug that makes a reader
      // believe the archive is empty and never click.
      const fromWaiting = composeBench(forumOf(MIXED), 'waiting').filters.map((p) => [p.key, p.count]);
      const fromSolved = composeBench(forumOf(MIXED), 'solved').filters.map((p) => [p.key, p.count]);
      expect(fromWaiting).toEqual(fromSolved);
      expect(fromWaiting).toEqual([['solved', 1], ['waiting', 2]]);
    });

    it('exactly one pill is active, and it is the one that was asked for', () => {
      const pills = composeBench(forumOf(MIXED), 'solved').filters;
      expect(pills.filter((p) => p.active).map((p) => p.key)).toEqual(['solved']);
    });

    it('🔴 there is no "All" pill — AC4’s absence, mirrored from `BENCH_SPEC`', () => {
      const keys = composeBench(forumOf(MIXED), 'waiting').filters.map((p) => p.key);
      expect(keys).not.toContain('all');
      expect(keys.length).toBe(2);
    });

    it('⚠️ no pills over a list nobody has, in any of the three non-`items` states', () => {
      // Two zeroes above an empty section is a control that cannot do anything, drawn as though
      // it could — and it would push out the sentence saying what the Bench is FOR.
      expect(composeBench(undefined, 'waiting').filters).toEqual([]);
      expect(composeBench(forumOf([]), 'waiting').filters).toEqual([]);
      expect(composeBench({ outcome: 'unreachable', status: null, detail: 'x' }, 'waiting').filters).toEqual([]);
    });
  });

  describe('🔴 `accepted` is read as `=== true`, never as truthy', () => {
    /**
     * ⚠️ **`undefined` would NOT catch this** — it is falsy, so a truthiness test agrees with
     * `=== true` about a missing field and the mutant survives. The case that separates them is
     * the one this codebase has already met: **Postgres boolean TEXT**. NAT-006 found a `Date`
     * column arriving as text on some pooled connections and FB-023 is that defect's own task;
     * the same pool sends `false` as the string `'f'`, which is **truthy**. So a truthiness test
     * files an UNANSWERED question as solved and hides it behind a pill nobody clicks.
     */
    it('🔴 a `false` that arrived as Postgres text is not read as solved', () => {
      const asText = [{ ...thread('p1', false), accepted: 'f' }] as never;
      expect(titles(composeBench(forumOf(asText), 'solved'))).toEqual([]);
      expect(titles(composeBench(forumOf(asText), 'waiting'))).toEqual(['p1']);
    });

    it('⚠️ CONTROL: a real `true` still reads as solved, so the row above is not "reject everything"', () => {
      expect(titles(composeBench(forumOf([thread('s1', true)]), 'solved'))).toEqual(['s1']);
    });

    it('and a thread the platform sent NO `accepted` for files as waiting rather than throwing', () => {
      const noField = [{ id: 'n1', title: 'No field', createdAt: '', firstReplyMinutes: null }] as never;
      expect(titles(composeBench(forumOf(noField), 'waiting'))).toEqual(['n1']);
      expect(titles(composeBench(forumOf(noField), 'solved'))).toEqual([]);
    });
  });

  describe('🔴 a bounded list reports its bound', () => {
    const fill = (n: number, accepted = false) =>
      Array.from({ length: n }, (_unused, i) => thread(`t${i}`, accepted));

    it('says nothing while it holds the whole Bench', () => {
      expect(composeBench(forumOf(fill(MIRROR_THREAD_WINDOW - 1)), 'waiting').boundLine).toBeNull();
    });

    it('⚠️ and says so the moment it may not — the control pair, one thread apart', () => {
      const line = composeBench(forumOf(fill(MIRROR_THREAD_WINDOW)), 'waiting').boundLine;
      expect(line).not.toBeNull();
      // 🔴 It names the number. A sentence that said "some questions" would be a bound nobody
      // can act on, and the number is the only part that changes if the window does.
      expect(line).toContain(String(MIRROR_THREAD_WINDOW));
    });

    it('the boundary is the window itself, not one either side of it', () => {
      expect(benchBoundLine(MIRROR_THREAD_WINDOW - 1)).toBeNull();
      expect(benchBoundLine(MIRROR_THREAD_WINDOW)).not.toBeNull();
      expect(benchBoundLine(0)).toBeNull();
    });
  });

  describe('⚠️ the summary counts over what we HOLD, not over what we show', () => {
    it('says "2 of 3 questions" on the default list', () => {
      expect(composeBench(forumOf(MIXED), 'waiting').summary).toBe('2 of 3 questions');
    });

    it('and singularises, because "1 questions" is how a reader learns not to trust a number', () => {
      expect(composeBench(forumOf([thread('w1', false)]), 'waiting').summary).toBe('1 of 1 question');
    });

    it('draws no summary at all when there is nothing to count', () => {
      expect(composeBench(forumOf([]), 'waiting').summary).toBeNull();
      expect(composeBench(undefined, 'waiting').summary).toBeNull();
    });
  });

  describe('🔴 three silences, three sentences', () => {
    const nobodyAsked = composeBench(forumOf([]), 'waiting').emptyLine;
    const allAnswered = composeBench(forumOf([thread('s1', true)]), 'waiting').emptyLine;
    const noneAccepted = composeBench(forumOf([thread('w1', false)]), 'solved').emptyLine;

    it('they are three DIFFERENT sentences', () => {
      expect(new Set([nobodyAsked, allAnswered, noneAccepted]).size).toBe(3);
    });

    it('⚠️ the "nobody asked" one still says what the Bench is FOR', () => {
      // D21's surviving obligation. A shared "nothing here" would lose it.
      expect(nobodyAsked).toContain('Ask about this node');
    });

    it('🔴 the "everything is answered" one points at the archive rather than stopping', () => {
      // This is the half of Richard's sentence that the default alone would break: a reader who
      // lands on an empty waiting list must be told the solved questions exist.
      expect(allAnswered).toContain('Solved');
      expect(allAnswered).not.toContain('Ask about this node');
    });

    it('and each of those three really is the section’s state', () => {
      // The control: `emptyLine` is only ever drawn on `empty`, so a sentence computed for a
      // state that cannot happen is a sentence nobody reads.
      expect(composeBench(forumOf([]), 'waiting').section.state).toBe('empty');
      expect(composeBench(forumOf([thread('s1', true)]), 'waiting').section.state).toBe('empty');
      expect(composeBench(forumOf([thread('w1', false)]), 'solved').section.state).toBe('empty');
    });
  });
});
