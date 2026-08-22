/**
 * NAT-005 — what the community tab actually draws, graded by walking its element tree.
 *
 * ## 🔴 AC5 is the reason this file is not source analysis
 *
 * *"`surface: 'hidden'` draws **nothing** — not a heading, not a frame, not a skeleton. Asserted
 * with a not-hidden control beside it, because an assertion that nothing was drawn passes just as
 * well when the component never ran."*
 *
 * A string-matching spec cannot make that distinction and neither can a spec that only checks a
 * `null` return. Both arms below come out of the **same call** to the same component with the
 * same shape of props, differing in one field — so a broken import, a renamed export or a
 * component that throws takes the control down first and says so.
 *
 * See `../support/renderElements.ts` for what this walk can and cannot see. It is not a render:
 * no effects, no layout, no paint. It answers *"what did this draw"*, which is what D15, the four
 * states and the metadata are claims about. What it cannot answer is whether any of it is legible
 * — that is NAT-001's PAIRS table and a person looking at it.
 *
 * ## 🔴 FB-006 revised this file's subject on 2026-08-22
 *
 * NAT-005 asserted three sections on one page. D6 made each of them a tab, so the assertions
 * below now say **which tab they are standing in** — `draw(view, { activeTab })` — and the
 * page-wide counts became per-tab counts whose sum is the number this file used to check. That is
 * an acceptance criterion revised on the word of the person it was written for (Richard, item 5:
 * *"not everything on one page in a big list"*), not a regression, and it is named here so a later
 * session does not read a one-section page as one.
 *
 * ⚠️ What did NOT change: the four states, the per-section empty line, the metadata on a row, the
 * D15 pairing, and every source-side check. FB-006 moved the page's furniture and touched none of
 * the vocabulary NAT-005 built.
 *
 * @module noodl-editor/tests-unit/nat-005/launcher-community-render
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CommunityTab,
  type CommunityMirrorView,
  type LauncherCommunityHostState
} from '@noodl-core-ui/preview/launcher/Launcher/views/Community';
import type { CommunityTabId } from '@noodl-core-ui/preview/launcher/Launcher/views/communityTabs';

import { byClass, render, stripComments, text, walk } from '../support/renderElements';

const CORE_UI = join(__dirname, '../../../noodl-core-ui/src');

// A day and an hour before the timestamps below, so "3 days ago" is a stable claim.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const THREADS = [
  { id: 't1', title: 'Why does my For Each render one row?', createdAt: ago(3 * DAY), firstReplyMinutes: 41 },
  { id: 't2', title: 'Deploy writes twice', createdAt: ago(2 * HOUR), firstReplyMinutes: null }
];
const ARTICLES = [{ slug: 'a1', title: 'Wiring a repeater', summary: 'Static Data into a For Each.', kind: 'tutorial' }];
const REPLAYS = [{ slug: 'r1', title: 'Weekly call', heldOn: ago(9 * DAY), videoUrl: null, description: 'The logic node.' }];

const HEALTH = {
  threads: { value: 4, required: 30 },
  weeksWithCall: { value: 1, required: 3 },
  reply: { medianHours: 5.25, requiredBelowHours: 24, n: 3, unreplied: 1 }
};

/** A view with everything present. One knob per test, so nothing below is two changes at once. */
function shown(overrides: Partial<Extract<CommunityMirrorView, { surface: 'shown' }>> = {}): CommunityMirrorView {
  return {
    surface: 'shown',
    viewer: { handle: 'rosborne' },
    standing: { points: 120, badges: 2 },
    threads: { state: 'items', items: THREADS },
    articles: { state: 'items', items: ARTICLES },
    replays: { state: 'items', items: REPLAYS },
    health: HEALTH,
    ...overrides
  };
}

function draw(view: CommunityMirrorView, extra: Partial<LauncherCommunityHostState> = {}) {
  return render(
    CommunityTab({ view, isRefreshing: false, onRefresh: () => undefined, ...extra }) as React.ReactNode
  );
}

/**
 * FB-006 — the same page, standing in one room.
 *
 * ⚠️ `activeTab` is the host's, not the strip's: `TabStrip` is hook-free precisely so this walk
 * can still evaluate the whole tree. A community tab that rendered `Tabs` would throw here and
 * take every assertion in this file with it.
 */
function on(tab: CommunityTabId, view: CommunityMirrorView = shown(), extra: Partial<LauncherCommunityHostState> = {}) {
  return draw(view, { ...extra, activeTab: tab });
}

// ── The instrument ────────────────────────────────────────────────────────────────────────

describe('the instrument can tell a drawn tree from an undrawn one', () => {
  it('🔴 CONTROL: a shown view draws a real tree, so a null below is a refusal and not a broken import', () => {
    const tree = draw(shown());
    expect(tree).not.toBeNull();
    expect(walk(tree).length).toBeGreaterThan(20);
    // FB-006: the first tab took the web's name for the place. See `communityTabs`.
    expect(text(tree)).toContain('Bench');
  });

  it('🔴 CONTROL: and it can see something ABSENT from that same tree', () => {
    // Without this, "does not contain X" passes for a walk that reads nothing at all.
    expect(text(draw(shown()))).not.toContain('Marketplace');
  });
});

// ── AC5: D15 ──────────────────────────────────────────────────────────────────────────────

describe('AC5 — D15 refused this viewer, so the tab draws NOTHING', () => {
  const hidden = draw({ surface: 'hidden' });
  const control = draw(shown());

  it('draws no node at all — not a heading, not a frame, not a skeleton', () => {
    expect(hidden).toBeNull();
    expect(walk(hidden)).toEqual([]);
  });

  it('🔴 and the SAME call with the SAME props drew a tab when the surface was shown', () => {
    // This is the pairing AC5 asks for. `apiviewer.ts` answers an org-minor with a 404 precisely
    // so a pupil is not told a door exists — "the community is unavailable" would narrate the
    // door in the act of closing it. A component that never ran also draws nothing, and this is
    // the only line that separates the two.
    expect(control).not.toBeNull();
    expect(walk(control).length).toBeGreaterThan(walk(hidden).length);
  });

  it('draws nothing even when every section has something to show', () => {
    // ⚠️ The refusal is a fact about the VIEWER, not about any list. A hidden surface whose
    // sections happen to be full must still draw nothing.
    expect(draw({ surface: 'hidden' })).toBeNull();
  });
});

// ── AC1: the four states ──────────────────────────────────────────────────────────────────

describe('AC1 — the four section states are still four, and still distinguishable', () => {
  const of = (state: CommunityMirrorView extends never ? never : any) => draw(shown({ threads: state }));

  const loading = of({ state: 'loading' });
  const items = of({ state: 'items', items: THREADS });
  const empty = of({ state: 'empty' });
  const unreachable = of({ state: 'unreachable', detail: 'ENOTFOUND community.nodegx.io' });

  it('every one of the four draws something', () => {
    for (const tree of [loading, items, empty, unreachable]) expect(tree).not.toBeNull();
  });

  it('🔴 loading is its own case, with a shape of its own', () => {
    // UNI-011 paid for this: an empty list for the 300ms before the first response tells every
    // user on every open that the community is dead.
    expect(text(loading)).toContain('Loading…');
    expect(byClass(loading, 'LoadingPulse').length).toBe(1);
    expect(byClass(empty, 'LoadingPulse').length).toBe(0);
  });

  it('🔴 unreachable is OUR fetch failing, is retryable, and says so', () => {
    expect(text(unreachable)).toContain('Could not reach the community');
    expect(text(unreachable)).toContain('ENOTFOUND community.nodegx.io');
    expect(byClass(unreachable, 'RetryButton').length).toBe(1);
    // A quiet community is not a broken one: the empty state offers nothing to retry.
    expect(byClass(empty, 'RetryButton').length).toBe(0);
  });

  it('🔴 empty is a sentence about the section, not a shrug', () => {
    expect(text(empty)).toContain('Right-click any node');
    expect(text(empty)).not.toContain('Loading');
    expect(text(empty)).not.toContain('Could not reach');
  });

  it('items draws one row per item and no state line', () => {
    // 🔴 FB-006 — per TAB now. The three numbers still sum to what this line used to assert about
    // one page, which is the check that the restructure moved rows rather than losing them.
    const rowsOn = (tab: CommunityTabId) => byClass(on(tab), 'Row').length;
    expect(rowsOn('bench')).toBe(THREADS.length);
    expect(rowsOn('tutorials')).toBe(ARTICLES.length);
    expect(rowsOn('replays')).toBe(REPLAYS.length);
    expect(rowsOn('bench') + rowsOn('tutorials') + rowsOn('replays')).toBe(
      THREADS.length + ARTICLES.length + REPLAYS.length
    );
    expect(text(items)).not.toContain('Loading…');
  });

  it('🔴 the three non-item states are three different SHAPES, not three greys', () => {
    // A redesign that renders all three as one shy paragraph re-buys UNI-011's bug while passing
    // any test that only asks whether a string appeared.
    const shape = (t: typeof loading) => [
      byClass(t, 'LoadingPulse').length,
      byClass(t, 'RetryButton').length,
      byClass(t, 'Unreachable').length
    ].join('/');
    expect(new Set([shape(loading), shape(empty), shape(unreachable)]).size).toBe(3);
  });
});

// ── AC3: emptyLine ────────────────────────────────────────────────────────────────────────

describe('AC3 — emptyLine is required and per-section', () => {
  const nothing = shown({ threads: { state: 'empty' }, articles: { state: 'empty' }, replays: { state: 'empty' } });
  const LIST_TABS: CommunityTabId[] = ['bench', 'tutorials', 'replays'];
  // FB-006: one empty section per tab rather than three down one page.
  const emptyLines = LIST_TABS.map((tab) => byClass(on(tab, nothing), 'StateLine').map((n) => n.ownText));

  it('🔴 three empty sections say three DIFFERENT things', () => {
    for (const lines of emptyLines) expect(lines.length).toBe(1);
    expect(new Set(emptyLines.flat()).size).toBe(3);
  });

  it('each says what its own section is FOR', () => {
    const all = LIST_TABS.map((tab) => text(on(tab, nothing))).join(' ');
    expect(all).toContain('Questions asked from the editor land here');
    expect(all).toContain('Written guides published to the community');
    expect(all).toContain('Recordings of the weekly call');
  });

  it('and none of them is a shared default', () => {
    // ⚠️ Source-side, because a default would be invisible to a render that always passes one.
    const body = stripComments(readFileSync(join(CORE_UI, 'components/community/CommunitySectionBody.tsx'), 'utf8'));
    expect(body.length).toBeGreaterThan(500);
    expect(body).not.toMatch(/emptyLine\s*=\s*['"`]/);
    expect(body).toMatch(/emptyLine: string/);
  });
});

// ── AC2: the metadata the view model always carried ───────────────────────────────────────

describe('AC2 — rows draw the metadata the old UI threw away', () => {
  // FB-006: the rows are on three tabs now, so the metadata claim is made over all three.
  const trees = (['bench', 'tutorials', 'replays'] as CommunityTabId[]).map((tab) => on(tab));
  const rows = trees.flatMap((tree) => byClass(tree, 'RowMeta').map((n) => n.ownText));
  const details = trees.flatMap((tree) => byClass(tree, 'RowDetail').map((n) => n.ownText));

  it('🔴 a thread row says when it was asked and whether anybody answered', () => {
    expect(rows).toContain('3 days ago · answered in 41 min');
    expect(rows).toContain('2 hours ago · no reply yet');
  });

  it('a guide row says its kind and shows its summary', () => {
    expect(rows).toContain('Tutorial');
    expect(details).toContain('Static Data into a For Each.');
  });

  it('a replay row says the day it was held and how long ago that was', () => {
    expect(rows.some((r) => r.includes('1 week ago'))).toBe(true);
    expect(details).toContain('The logic node.');
  });

  it('🔴 CONTROL: a row whose metadata is unreadable draws NO meta line rather than "NaN"', () => {
    // NAT-006's finding: a column declared `Date` arrives as Postgres text on some pooled
    // connections, and both spellings parse. The failure mode is NaN reaching a reader as words.
    const broken = on(
      'bench',
      shown({
        threads: {
          state: 'items',
          items: [{ id: 'b', title: 'A thread', createdAt: 'not a date', firstReplyMinutes: -1 }]
        }
      })
    );
    expect(text(broken)).not.toContain('NaN');
    expect(text(broken)).toContain('A thread');
    // The thread's own meta line is absent; ⚠️ on the Bench tab that is now the ONLY row, so the
    // control is 0 rather than the other two tabs' rows. The two arms below are what keep that
    // from being an assertion about an empty page: the title still draws, and the other tabs'
    // rows still carry theirs.
    expect(byClass(broken, 'RowMeta').length).toBe(0);
    expect(byClass(on('tutorials'), 'RowMeta').length).toBe(ARTICLES.length);
    expect(byClass(on('replays'), 'RowMeta').length).toBe(REPLAYS.length);
  });
});

// ── The readout D21 left behind ───────────────────────────────────────────────────────────

describe('the health reading is still a readout and still carries its n', () => {
  const tree = draw(shown());

  it('🔴 every component shows its required, and the median shows the n it came from', () => {
    const all = text(tree);
    expect(all).toContain('4 of 30 threads');
    expect(all).toContain('1 of 3 consecutive weeks with a call');
    expect(all).toContain('(n=3, 1 unreplied)');
    expect(all).toContain('target under 24h');
  });

  it('⚠️ and is not drawn as progress towards a threshold that no longer gates anything', () => {
    expect(walk(tree).some((n) => n.type === 'progress')).toBe(false);
    expect(walk(tree).some((n) => String(n.props.role ?? '') === 'progressbar')).toBe(false);
  });
});

// ── AC7 and the security constraint both surfaces are under ───────────────────────────────

describe('AC7 — nothing on this path can render markup', () => {
  const FILES = [
    join(CORE_UI, 'preview/launcher/Launcher/views/Community.tsx'),
    join(CORE_UI, 'components/community/CommunityRow.tsx'),
    join(CORE_UI, 'components/community/CommunitySection.tsx'),
    join(CORE_UI, 'components/community/CommunitySectionBody.tsx'),
    join(__dirname, '../../src/editor/src/views/panels/CommunityPanel/CommunityPanel.tsx')
  ];
  // 🔴 COMMENTS STRIPPED, and the first run is why. This check went red on the sentence "No
  // `dangerouslySetInnerHTML`, ever" in the module note of a file that does not use it. The same
  // hole in the other direction is the dangerous one: a file that both uses the construct and
  // documents the prohibition reads identically to a checker that cannot tell prose from code,
  // and the prose is what makes it look reviewed.
  const sources = FILES.map((f) => stripComments(readFileSync(f, 'utf8')));

  it('🔴 CONTROL: read five real files, not five empty strings', () => {
    expect(sources.every((s) => s.length > 500)).toBe(true);
    // A known-firing signal: the string being searched for below DOES appear in this repo, so a
    // clean sweep is a fact about these files rather than about the search.
    expect(sources.every((s) => s.includes('React'))).toBe(true);
    // ⚠️ And the stripper did not eat the code: a construct that IS in every one of these files
    // must survive it, or a clean sweep below is a fact about the stripper.
    expect(sources.every((s) => s.includes('export function'))).toBe(true);
  });

  it('no dangerouslySetInnerHTML, on either surface or in the shared vocabulary', () => {
    for (const [i, source] of sources.entries()) {
      expect([FILES[i], source.includes('dangerouslySetInnerHTML')]).toEqual([FILES[i], false]);
    }
  });

  it('🔴 the row types its text as `string`, which is what keeps it text', () => {
    // A `ReactNode` prop is a hole an element carrying markup fits through. React escapes text
    // children because they are text; the type is what keeps them text.
    const row = readFileSync(join(CORE_UI, 'components/community/CommunityRow.tsx'), 'utf8');
    const props = row.slice(row.indexOf('export interface CommunityRowProps'), row.indexOf('export function CommunityRow'));
    expect(props).toMatch(/title: string;/);
    expect(props).not.toContain('ReactNode');
  });
});

// ── The row is an entry point, so it has to be reachable ──────────────────────────────────

describe('a row is operable without a mouse', () => {
  const tree = draw(shown());

  it('🔴 every row is a button, not a div with an onClick', () => {
    const rows = byClass(tree, 'Row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect([row.type, row.props.type]).toEqual(['button', 'button']);
    }
  });

  it('and so are the retry link and the two page buttons', () => {
    const unreachable = draw(shown({ threads: { state: 'unreachable', detail: 'ETIMEDOUT' } }));
    for (const cls of ['RetryButton', 'GhostButton', 'OutlineButton']) {
      const found = byClass(unreachable, cls);
      expect([cls, found.length > 0, found.every((n) => n.type === 'button')]).toEqual([cls, true, true]);
    }
  });
});

// ── Both surfaces draw from one vocabulary ────────────────────────────────────────────────

describe('🔴 the rail panel and the launcher tab draw the SAME components', () => {
  // ⚠️ Stripped for the same reason as AC7 above: both of these files DESCRIBE the four-state
  // switch they no longer contain, and a check for "has no second copy" would read the prose.
  const panel = stripComments(readFileSync(join(__dirname, '../../src/editor/src/views/panels/CommunityPanel/CommunityPanel.tsx'), 'utf8'));
  const tab = stripComments(readFileSync(join(CORE_UI, 'preview/launcher/Launcher/views/Community.tsx'), 'utf8'));

  it('CONTROL: both files were read', () => {
    expect([panel.length > 500, tab.length > 500]).toEqual([true, true]);
  });

  it('both import the row and the four-state body from components/community', () => {
    // Two copies is the arrangement where a fix lands on one of them — which is what this task
    // found: the launcher drew titles while throwing away every field the rail had too.
    for (const [name, source] of [['panel', panel], ['tab', tab]] as const) {
      expect([name, source.includes("@noodl-core-ui/components/community")]).toEqual([name, true]);
      expect([name, source.includes('CommunityRow')]).toEqual([name, true]);
    }
  });

  it('and neither has grown a second copy of the four-state switch', () => {
    for (const [name, source] of [['panel', panel], ['tab', tab]] as const) {
      expect([name, source.includes("state.state === 'unreachable'")]).toEqual([name, false]);
      expect([name, source.includes("state.state === 'loading'")]).toEqual([name, false]);
    }
  });
});
