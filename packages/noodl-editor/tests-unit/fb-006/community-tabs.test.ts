/**
 * FB-006 / D6 — the launcher community page's tab plan.
 *
 * This is the view-model half of AC4: *"the pure view-model half specced separately"*. What it
 * grades is the part that is a decision rather than a drawing — the order, the absences, and the
 * rule that a `chosen` tab which no longer exists cannot be left selected.
 *
 * ⚠️ The other half — that the page actually draws one of these and only one — is
 * `launcher-community-tabs-render.test.ts`, because *a spec that builds a view model cannot grade
 * its builder*.
 *
 * @module noodl-editor/tests-unit/fb-006/community-tabs
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  COMMUNITY_TABS,
  communityTabs,
  type CommunityTabId
} from '@noodl-core-ui/preview/launcher/Launcher/views/communityTabs';

const CORE_UI = join(__dirname, '../../../noodl-core-ui/src');

/** What this build can actually draw today. The other four are catalogued and unwired. */
const WIRED = { bench: true, tutorials: true, replays: true, people: true };

describe("AC1 — the launcher has the web's tabs, in the web's order", () => {
  it('🔴 the catalogue is the web nav, name for name', () => {
    // `nodegx-community/src/app/layout.tsx`, read 2026-08-22. ⚠️ A copy, not a derivation: the web
    // is a different repository and nothing in this checkout can read it. This assertion is the
    // place a drift is caught, so the quoted list is the whole point of it.
    expect(COMMUNITY_TABS.map((tab) => tab.label)).toEqual([
      'Bench',
      'Tutorials',
      'Replays',
      'University',
      'People',
      'Work',
      'Coaching',
      'Orgs'
    ]);
  });

  it('draws the wired ones in that order, whatever order the host mentions them in', () => {
    const plan = communityTabs({ wired: { people: true, replays: true, bench: true, tutorials: true } });
    expect(plan.tabs.map((tab) => tab.id)).toEqual(['bench', 'tutorials', 'replays', 'people']);
  });

  it('🔴 every tab says what IT is for, and no two say the same thing', () => {
    const leads = COMMUNITY_TABS.map((tab) => tab.lead);
    for (const lead of leads) expect(lead.length).toBeGreaterThan(30);
    expect(new Set(leads).size).toBe(COMMUNITY_TABS.length);
  });

  it('opens on the first tab — a fixed front door, not a data-dependent guess', () => {
    expect(communityTabs({ wired: WIRED }).active?.id).toBe('bench');
    // ⚠️ CONTROL: the same call with the front door unwired opens on the next one, so the line
    // above is about the ORDER and not about the string 'bench' appearing somewhere.
    expect(communityTabs({ wired: { tutorials: true, people: true } }).active?.id).toBe('tutorials');
  });

  it('a click sticks', () => {
    expect(communityTabs({ wired: WIRED, chosen: 'replays' }).active?.id).toBe('replays');
  });
});

describe('AC2 — a new content kind is a new TAB, not a longer page', () => {
  it('🔴 a kind nobody wired draws no tab at all', () => {
    const plan = communityTabs({ wired: { bench: true, tutorials: true, replays: true } });
    expect(plan.tabs.map((tab) => tab.id)).not.toContain('people');
    // ⚠️ And the catalogue still knows about it — an unwired kind is absent from the STRIP, not
    // from the model. This is the pair that makes the line above a claim about wiring rather than
    // about a shorter list.
    expect(COMMUNITY_TABS.map((tab) => tab.id)).toContain('people');
  });

  it("wiring one is one flag, and it lands in the web's position rather than at the end", () => {
    const plan = communityTabs({ wired: { ...WIRED, university: true } });
    expect(plan.tabs.map((tab) => tab.id)).toEqual(['bench', 'tutorials', 'replays', 'university', 'people']);
  });

  it('🔴 the four unbuilt kinds are already catalogued, so none of them can arrive as more page', () => {
    const catalogued = COMMUNITY_TABS.map((tab) => tab.id);
    for (const id of ['university', 'work', 'coaching', 'orgs'] as CommunityTabId[]) {
      expect(catalogued).toContain(id);
    }
  });
});

describe('🔴 D15 and an unwired surface are the same ABSENCE here, and that is deliberate', () => {
  it('a refused directory (`people: null` at the host) draws no tab', () => {
    expect(communityTabs({ wired: { bench: true, people: false } }).tabs.map((t) => t.id)).toEqual(['bench']);
  });

  it('⚠️ and the host is where the two meanings still differ', () => {
    // `null` is D15's refusal, `undefined` is nobody wired it — `Community.tsx` collapses them
    // with `Boolean(people)` at the point of drawing, and the pane type documents which is which.
    // If this ever stops being true, the tab type is not where the fix goes.
    const view = readFileSync(join(CORE_UI, 'preview/launcher/Launcher/views/Community.tsx'), 'utf8');
    expect(view.length).toBeGreaterThan(1000);
    expect(view).toContain('people: Boolean(people)');
  });
});

describe('🔴 a chosen tab that no longer exists cannot stay selected', () => {
  it('falls back to the front door rather than leaving the content area blank', () => {
    // A refresh can retire a surface — D15 arriving late, a host dropping `people` — and a
    // `chosen` left pointing at it would draw a strip with nothing selected over an empty page.
    const plan = communityTabs({ wired: { bench: true, tutorials: true }, chosen: 'people' });
    expect(plan.active?.id).toBe('bench');
    expect(plan.tabs.map((t) => t.id)).toEqual(['bench', 'tutorials']);
  });

  it('and a host that wired nothing at all has no active tab, rather than a phantom one', () => {
    const plan = communityTabs({ wired: {} });
    expect(plan.tabs).toEqual([]);
    expect(plan.active).toBeNull();
  });
});
