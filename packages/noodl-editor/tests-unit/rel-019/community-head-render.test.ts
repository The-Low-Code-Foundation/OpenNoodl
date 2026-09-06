/**
 * REL-019 §1 — the community page's head is an identity card with a door, the readout is
 * tiles that still say D21's words, and the media rows carry a drawn poster.
 *
 * 🔴 The sign-in arm is paired with a signed-in control and with a signed-out host that wired
 * no `onSignIn`: a button that appeared has to be a button that appeared FOR THE RIGHT REASON.
 *
 * @module noodl-editor/tests-unit/rel-019/community-head-render
 */
import { CommunityTab, type CommunityMirrorView, type LauncherCommunityHostState } from '@noodl-core-ui/preview/launcher/Launcher/views/Community';

import { byClass, render, text, walk } from '../support/renderElements';
import { benchFrom, forumOf, threadOf } from '../support/benchFixture';

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function shown(overrides: Partial<Extract<CommunityMirrorView, { surface: 'shown' }>> = {}): CommunityMirrorView {
  return {
    surface: 'shown',
    viewer: { handle: 'rosborne' },
    standing: { points: 120, badges: 2 },
    bench: benchFrom(forumOf([threadOf({ id: 't1', title: 'A thread', createdAt: ago(3 * HOUR), firstReplyMinutes: 41 })])),
    articles: {
      state: 'items',
      items: [
        { slug: 'a1', title: 'Wiring a repeater', summary: 'Static Data into a For Each.', kind: 'tutorial' },
        { slug: 'a2', title: 'First look at the editor', summary: 'A recording.', kind: 'tutorial', videoUrl: 'https://www.youtube.com/watch?v=fqmHH36ndc0' }
      ]
    },
    replays: {
      state: 'items',
      items: [
        { slug: 'r1', title: 'Meet-up #1', heldOn: ago(200 * HOUR), videoUrl: 'https://www.youtube.com/watch?v=k_dPltcIGrU', description: 'The alpha.' },
        { slug: 'r2', title: 'Meet-up #2', heldOn: ago(2 * HOUR), videoUrl: null, description: null }
      ]
    },
    health: {
      threads: { value: 4, required: 30 },
      weeksWithCall: { value: 1, required: 3 },
      reply: { medianHours: 5.25, requiredBelowHours: 24, n: 3, unreplied: 1 }
    },
    ...overrides
  };
}

function draw(extra: Partial<LauncherCommunityHostState> = {}, view: CommunityMirrorView = shown()) {
  return render(CommunityTab({ view, isRefreshing: false, onRefresh: () => undefined, ...extra }) as React.ReactNode);
}

const byTest = (tree: ReturnType<typeof draw>, id: string) => walk(tree).filter((n) => n.props['data-test'] === id);

describe('the head', () => {
  it('is an identity card: initials, handle, standing', () => {
    const tree = draw();
    const head = byTest(tree, 'community-head')[0];
    expect(byClass(head, 'HeadAvatar').map((n) => n.ownText)).toEqual(['RO']);
    expect(text(head)).toContain('@rosborne');
    expect(text(head)).toContain('120 points · 2 badges');
  });

  it('carries Refresh and the browser door, which left the page foot', () => {
    const tree = draw();
    const head = byTest(tree, 'community-head')[0];
    expect(text(head)).toContain('Refresh');
    expect(text(head)).toContain('Open community.nodegx.io');
  });

  it('🔴 signed out, offers Sign in — and says the state, not "sign in below"', () => {
    const tree = draw({ onSignIn: () => undefined }, shown({ viewer: false, standing: null }));
    expect(byTest(tree, 'community-sign-in')).toHaveLength(1);
    const head = byTest(tree, 'community-head')[0];
    expect(text(head)).toContain('Reading as a guest');
    expect(text(head)).not.toContain('below');
    // No handle, no invented initials — the neutral glyph.
    expect(byClass(head, 'HeadAvatar')[0].ownText).toBe('');
  });

  it('signed IN, offers no Sign in (the paired control)', () => {
    const tree = draw({ onSignIn: () => undefined });
    expect(byTest(tree, 'community-sign-in')).toHaveLength(0);
  });

  it('signed out with no door wired draws no button rather than a dead one', () => {
    const tree = draw({}, shown({ viewer: false, standing: null }));
    expect(byTest(tree, 'community-sign-in')).toHaveLength(0);
    expect(text(byTest(tree, 'community-head')[0])).toContain('Reading as a guest');
  });

  it('pressing Sign in reaches the host', () => {
    let pressed = 0;
    const tree = draw({ onSignIn: () => void pressed++ }, shown({ viewer: false, standing: null }));
    (byTest(tree, 'community-sign-in')[0].props.onClick as () => void)();
    expect(pressed).toBe(1);
  });
});

describe('the readout as tiles', () => {
  it('still says D21’s words, value and required together', () => {
    const all = text(draw());
    expect(all).toContain('4 of 30 threads');
    expect(all).toContain('1 of 3 consecutive weeks with a call');
    expect(all).toContain('5.3h median first reply (n=3, 1 unreplied), target under 24h');
  });

  it('draws three tiles, one number each', () => {
    const tree = draw();
    expect(byClass(tree, 'HealthTile')).toHaveLength(3);
    expect(byClass(tree, 'HealthValue').map((n) => n.ownText)).toEqual(['4', '1', '5.3h']);
  });

  it('says "no replies yet" as the value when there is no median', () => {
    const tree = draw({}, shown({ health: { threads: { value: 0, required: 30 }, weeksWithCall: { value: 0, required: 3 }, reply: { medianHours: null, requiredBelowHours: 24, n: 0, unreplied: 2 } } }));
    expect(byClass(tree, 'HealthValue').map((n) => n.ownText)).toEqual(['0', '0', 'no replies yet']);
    expect(text(tree)).toContain('no replies yet (n=0, 2 unreplied), target under 24h');
  });
});

describe('the media rows', () => {
  it('a replay with a recording gets a play poster; one without gets a pending poster', () => {
    const tree = draw({ activeTab: 'replays' });
    const rows = byClass(tree, 'Row');
    expect(rows.map((r) => text(r).includes('Meet-up #1'))).toEqual([true, false]);
    expect(rows.map((r) => byClass(r, 'is-poster-video').length)).toEqual([1, 0]);
    expect(rows.map((r) => byClass(r, 'is-poster-pending').length)).toEqual([0, 1]);
    // 🔴 Drawn, never fetched: no image element anywhere on the page.
    expect(walk(tree).some((n) => n.type === 'img')).toBe(false);
  });

  it('a tutorial with a recording is a video row, a written one is a guide row', () => {
    const tree = draw({ activeTab: 'tutorials' });
    const rows = byClass(tree, 'Row');
    expect(rows.map((r) => byClass(r, 'is-poster-guide').length)).toEqual([1, 0]);
    expect(rows.map((r) => byClass(r, 'is-poster-video').length)).toEqual([0, 1]);
    expect(text(rows[1])).toContain('Video');
    expect(text(rows[0])).not.toContain('Video');
  });

  it('rows stay buttons with the words in one span, so the Bench’s rows are unchanged', () => {
    const tree = draw({ activeTab: 'bench' });
    const rows = byClass(tree, 'Row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.type === 'button')).toBe(true);
    expect(rows.every((r) => byClass(r, 'Poster').length === 0)).toBe(true);
  });
});
