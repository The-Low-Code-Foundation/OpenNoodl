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
  composeMirror,
  type MirrorInputs,
  type MirrorView
} from '../../src/editor/src/models/community/mirrorview';
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
            value: { threads: [{ id: '1', title: 'A thread', createdAt: '', firstReplyMinutes: null }] }
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
      expect(view.threads.state).toBe('empty');
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
      expect(view.threads.state).toBe('empty');
    });

    it('distinguishes NOT YET ASKED from EMPTY', () => {
      // ⚠️ The `useCommunityAccount` bug in a new place: a panel that renders "no discussions
      // yet" before the first response tells every user the community is dead on every open.
      const view = shown(composeMirror(inputs({ home: undefined, forum: undefined })));
      expect(view.threads.state).toBe('loading');
      expect(view.articles.state).toBe('loading');
      expect(view.health).toBeNull();
    });

    it('distinguishes UNREACHABLE from EMPTY, and carries the detail', () => {
      const view = shown(composeMirror(inputs({ forum: { outcome: 'unreachable', status: null, detail: 'ECONNREFUSED' } })));
      expect(view.threads).toEqual({ state: 'unreachable', detail: 'ECONNREFUSED' });
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
                threads: [{ id: '1', title: 'Why is my repeater empty?', createdAt: '', firstReplyMinutes: 12 }]
              }
            }
          })
        )
      );
      expect(view.threads).toEqual({
        state: 'items',
        items: [{ id: '1', title: 'Why is my repeater empty?', createdAt: '', firstReplyMinutes: 12 }]
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
