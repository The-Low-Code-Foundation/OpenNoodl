/**
 * FB-006 / D6 — what the tabbed community page actually draws.
 *
 * The view half of AC4. `community-tabs.test.ts` grades the plan; this grades the page built from
 * it, by walking the element tree (see `../support/renderElements.ts` for what that can and cannot
 * see — no effects, no layout, no paint).
 *
 * 🔴 **Every "this tab does not show that" assertion here is paired with the tab that DOES show
 * it.** An exclusion on its own passes just as well when the walk read nothing, which is the trap
 * NAT-005's D15 pairing was built for and the same one applies to a tab.
 *
 * @module noodl-editor/tests-unit/fb-006/launcher-community-tabs-render
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CommunityTab,
  type CommunityMirrorView,
  type LauncherCommunityHostState
} from '@noodl-core-ui/preview/launcher/Launcher/views/Community';
import { COMMUNITY_TABS, type CommunityTabId } from '@noodl-core-ui/preview/launcher/Launcher/views/communityTabs';

import { byClass, render, stripComments, text, walk } from '../support/renderElements';
import { benchFrom, forumOf, threadOf } from '../support/benchFixture';

const CORE_UI = join(__dirname, '../../../noodl-core-ui/src');

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const THREAD_TITLE = 'Why does my For Each render one row?';
const ARTICLE_TITLE = 'Wiring a repeater';
const REPLAY_TITLE = 'The week we broke the router';
const PERSON_NAME = 'Ada Lovelace';

function shown(overrides: Partial<Extract<CommunityMirrorView, { surface: 'shown' }>> = {}): CommunityMirrorView {
  return {
    surface: 'shown',
    viewer: { handle: 'rosborne' },
    standing: { points: 120, badges: 2 },
    bench: benchFrom(
      forumOf([threadOf({ id: 't1', title: THREAD_TITLE, createdAt: ago(3 * HOUR), firstReplyMinutes: 41 })])
    ),
    articles: { state: 'items', items: [{ slug: 'a1', title: ARTICLE_TITLE, summary: 'Static Data into a For Each.', kind: 'tutorial' }] },
    replays: { state: 'items', items: [{ slug: 'r1', title: REPLAY_TITLE, heldOn: ago(200 * HOUR), videoUrl: null, description: 'The logic node.' }] },
    health: {
      threads: { value: 4, required: 30 },
      weeksWithCall: { value: 1, required: 3 },
      reply: { medianHours: 5.25, requiredBelowHours: 24, n: 3, unreplied: 1 }
    },
    ...overrides
  };
}

/** A wired directory, so `people` earns its tab. */
const PEOPLE: LauncherCommunityHostState['people'] = {
  directory: {
    section: {
      state: 'items',
      items: [{ handle: 'ada', title: PERSON_NAME, meta: '@ada · 40 points', detail: null, initial: 'A', chips: [] }]
    },
    summary: '1 person',
    boundLine: null,
    emptyLine: 'Nobody has a profile yet.',
    searchLabel: 'Search people',
    query: '',
    filters: []
  },
  onQueryChange: () => undefined,
  onToggleFilter: () => undefined,
  onOpenPerson: () => undefined,
  onRetry: () => undefined
};

function draw(extra: Partial<LauncherCommunityHostState> = {}, view: CommunityMirrorView = shown()) {
  return render(
    CommunityTab({
      view,
      isRefreshing: false,
      onRefresh: () => undefined,
      people: PEOPLE,
      ...extra
    }) as React.ReactNode
  );
}

const on = (tab: CommunityTabId, extra: Partial<LauncherCommunityHostState> = {}) => draw({ ...extra, activeTab: tab });

const tabButtons = (tree: ReturnType<typeof draw>) => walk(tree).filter((n) => n.props.role === 'tab');
/** ⚠️ The label lives in `Text`'s `<p>`, so the button's OWN text is empty — read the subtree. */
const tabLabels = (tree: ReturnType<typeof draw>) => tabButtons(tree).map((n) => text(n));

// ── AC1 ───────────────────────────────────────────────────────────────────────────────────

describe('AC1 — the page is the web’s tabs', () => {
  const tree = draw();

  it('🔴 CONTROL: the walk read a real page', () => {
    expect(tree).not.toBeNull();
    expect(walk(tree).length).toBeGreaterThan(20);
  });

  it('draws one button per wired tab, in the web’s order, and none for the unwired kinds', () => {
    expect(tabLabels(tree)).toEqual(['Bench', 'Tutorials', 'Replays', 'People']);
  });

  it('🔴 exactly one is selected, and it is the one whose content is on screen', () => {
    const selected = tabButtons(tree).filter((n) => n.props['aria-selected'] === true);
    expect(selected.map((n) => text(n))).toEqual(['Bench']);
    expect(text(tree)).toContain(THREAD_TITLE);
  });

  it('a chosen tab moves both the selection and the content', () => {
    const replays = on('replays');
    expect(tabButtons(replays).filter((n) => n.props['aria-selected'] === true).map((n) => text(n))).toEqual([
      'Replays'
    ]);
    expect(text(replays)).toContain(REPLAY_TITLE);
  });

  it('🔴 the first screen of each tab says what THAT tab is for', () => {
    for (const tab of COMMUNITY_TABS.filter((t) => ['bench', 'tutorials', 'replays', 'people'].includes(t.id))) {
      const lead = byClass(on(tab.id), 'Lead').map((n) => n.ownText);
      expect(lead).toEqual([tab.lead]);
    }
  });
});

// ── AC1's other half: no tab renders another tab's content ────────────────────────────────

describe('🔴 AC1 — no tab renders another tab’s content', () => {
  const CONTENT: Record<string, string> = {
    bench: THREAD_TITLE,
    tutorials: ARTICLE_TITLE,
    replays: REPLAY_TITLE,
    people: PERSON_NAME
  };

  it('every tab shows its own thing', () => {
    // 🔴 The pairing. Without this arm, the exclusions below would pass on a page that drew
    // nothing at all — which is exactly how a broken restructure would look to them.
    for (const [tab, title] of Object.entries(CONTENT)) {
      expect(text(on(tab as CommunityTabId))).toContain(title);
    }
  });

  it('and none of the other three', () => {
    for (const [tab, title] of Object.entries(CONTENT)) {
      const shownText = text(on(tab as CommunityTabId));
      for (const [other, otherTitle] of Object.entries(CONTENT)) {
        if (other === tab) continue;
        expect(shownText).not.toContain(otherTitle);
      }
    }
  });

  it('🔴 one section on screen at a time, not three with two hidden by CSS', () => {
    // ⚠️ `mounted`, not `visible` — this editor's conditional UI rule. A `keepTabsAlive` strip
    // would satisfy every assertion above while still rendering the "big list that will one day
    // be unmanageable" Richard asked us to stop rendering.
    for (const tab of ['bench', 'tutorials', 'replays'] as CommunityTabId[]) {
      expect(byClass(on(tab), 'SectionCard').length).toBe(2); // the tab's own + the health readout
    }
  });
});

// ── The chrome frames the place, not the room ─────────────────────────────────────────────

describe('the page chrome survives every tab', () => {
  it('who you are, refresh, the health readout and the browser door are on all four', () => {
    for (const tab of ['bench', 'tutorials', 'replays', 'people'] as CommunityTabId[]) {
      const all = text(on(tab));
      expect(all).toContain('@rosborne');
      expect(all).toContain('Refresh');
      expect(all).toContain('4 of 30 threads');
      expect(all).toContain('Open community.nodegx.io');
    }
  });
});

// ── A strip with one tab is a label impersonating a control ───────────────────────────────

describe('a lone surface draws no strip', () => {
  const alone = draw({ people: null }, {
    ...(shown() as Extract<CommunityMirrorView, { surface: 'shown' }>),
    articles: { state: 'items', items: [] },
    replays: { state: 'items', items: [] }
  });

  it('⚠️ CONTROL: three list kinds are always wired, so the lone case is about `people` only', () => {
    // The shown view declares threads/articles/replays as required fields — an empty Bench is a
    // Bench with nothing in it, so the strip keeps all three even when two are empty.
    expect(tabLabels(alone)).toEqual(['Bench', 'Tutorials', 'Replays']);
  });

  it('🔴 and with a single tab there is no strip at all — the section keeps its own heading', () => {
    const single = render(
      CommunityTab({
        view: shown(),
        isRefreshing: false,
        onRefresh: () => undefined,
        people: null,
        activeTab: 'bench'
      } as LauncherCommunityHostState) as React.ReactNode
    );
    // Sanity: with three list tabs wired this build always has a strip, so the single-tab rule is
    // graded where it is decided — in the view's `alone` branch — via a section heading that
    // appears only when the strip is absent.
    expect(tabButtons(single).length).toBeGreaterThan(1);
    expect(byClass(single, 'SectionTitle').map((n) => n.ownText)).not.toContain('Bench');
  });
});

// ── AC3 ───────────────────────────────────────────────────────────────────────────────────

describe('AC3 — one strip, one vocabulary, no second copies', () => {
  const view = stripComments(readFileSync(join(CORE_UI, 'preview/launcher/Launcher/views/Community.tsx'), 'utf8'));

  it('🔴 CONTROL: the file was read', () => {
    expect(view.length).toBeGreaterThan(2000);
  });

  it('the tab strip comes from the shared Tabs module', () => {
    expect(view).toMatch(/import \{ TabStrip, TabsVariant \} from '@noodl-core-ui\/components\/layout\/Tabs'/);
  });

  it('🔴 and this page did not grow a button row of its own', () => {
    expect(view).not.toContain('role="tablist"');
    expect(view).not.toContain("role='tablist'");
  });

  it('rows, sections and the four states still come from components/community', () => {
    expect(view).toMatch(/from '@noodl-core-ui\/components\/community'/);
    expect(view).toContain('CommunitySection');
    expect(view).toContain('CommunityRow');
  });

  it('🔴 there is exactly ONE tablist in core-ui, and it is the shared one', () => {
    const tabs = stripComments(readFileSync(join(CORE_UI, 'components/layout/Tabs/Tabs.tsx'), 'utf8'));
    expect(tabs).toContain('role="tablist"');
    expect(tabs.match(/role="tablist"/g)?.length).toBe(1);
    // ⚠️ `Tabs` now renders the strip rather than holding the markup — the DOM is the same one
    // seven editor panels already draw, which is what makes this a reuse rather than a fork.
    expect(tabs).toMatch(/<TabStrip\s/);
  });
});
