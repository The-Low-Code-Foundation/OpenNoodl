/**
 * UNI-011 / D21 — the launcher's Community tab, and the three lists that must agree about it.
 *
 * 🔴 **A tab id lives in FOUR places and nothing joins them up.** `LauncherPageId` (the type),
 * `HEADER_TABS` (what the nav draws), the `switch` in `Launcher.tsx` (what renders), and
 * `isValidPageId` (what a deep link and the persisted tab are allowed to be).
 *
 * ⚠️ **Every disagreement between them FAILS SILENTLY, and two of them fail as *the wrong page*
 * rather than as an error:**
 *
 * | missing from | symptom |
 * |---|---|
 * | the `switch` | the tab highlights and renders **Projects** — `default:` swallows it |
 * | `isValidPageId` | the tab works, then silently resets to Projects on the next launch |
 * | `HEADER_TABS` | reachable only by deep link; nobody finds it |
 *
 * 🔴 The first row is the one that matters here: `default: return <Projects />` means a community
 * tab with no case is **indistinguishable from a working tab that happens to show projects**, and
 * a human clicking it would report "the community tab shows my projects" rather than a crash.
 *
 * Source analysis, because this checkout's jest has no DOM and no React — `session-readers.test.ts`
 * is the precedent, and like that file the controls are derived from the REAL CURRENT SOURCE so a
 * rename cannot leave the instrument sweeping for a string nobody writes any more.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const CORE_UI = join(__dirname, '../../../noodl-core-ui/src/preview/launcher/Launcher');

const launcher = readFileSync(join(CORE_UI, 'Launcher.tsx'), 'utf8');
const header = readFileSync(join(CORE_UI, 'components/LauncherHeader/LauncherHeader.tsx'), 'utf8');
const context = readFileSync(join(CORE_UI, 'LauncherContext.tsx'), 'utf8');
const persist = readFileSync(join(CORE_UI, 'hooks/usePersistentTab.ts'), 'utf8');

/** Tab ids the nav actually draws, read off `HEADER_TABS`. */
function headerTabIds(): string[] {
  const block = header.slice(header.indexOf('HEADER_TABS'), header.indexOf('];', header.indexOf('HEADER_TABS')));
  return [...block.matchAll(/id:\s*'([a-z]+)'/g)].map((m) => m[1]);
}

/** Ids the render switch has a case for. */
function switchCaseIds(): string[] {
  const block = launcher.slice(launcher.indexOf('const renderActiveView'), launcher.indexOf('return (\n    <LauncherProvider'));
  return [...block.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]);
}

describe('the instrument — controls before any claim', () => {
  it('read four real files, not four empty strings', () => {
    // 🔴 A bad path returns nothing and then every assertion below passes vacuously.
    expect([launcher.length, header.length, context.length, persist.length].every((n) => n > 500)).toBe(true);
  });

  it('finds tabs it is looking for — a known-firing signal', () => {
    // If the parser breaks, this is what says so BEFORE an absence is claimed about `community`.
    expect(headerTabIds()).toContain('projects');
    expect(switchCaseIds()).toContain('projects');
  });

  it('does NOT find a tab that was never added — the negative control', () => {
    expect(headerTabIds()).not.toContain('marketplace');
  });
});

describe('UNI-011 / D21 — the Community tab is wired in all four places', () => {
  it('is in the LauncherPageId union', () => {
    const line = context.split('\n').find((l) => l.startsWith('export type LauncherPageId'));
    expect(line).toContain("'community'");
  });

  it('is drawn by the nav', () => {
    expect(headerTabIds()).toContain('community');
  });

  it('🔴 has its own case in the render switch, so it cannot fall through to Projects', () => {
    expect(switchCaseIds()).toContain('community');
  });

  it('survives a relaunch and a deep link — isValidPageId accepts it', () => {
    const block = persist.slice(persist.indexOf('export function isValidPageId'));
    expect(block).toContain("value === 'community'");
  });

  it('is second in the nav, after Projects', () => {
    // Richard, 2026-08-19: visible without going looking for it. A tab in fourth place beside
    // GitHub is a tab nobody clicks. Projects stays first because it stays the default.
    expect(headerTabIds()[1]).toBe('community');
  });
});

describe('every drawn tab renders itself — the general rule this tab is one case of', () => {
  it('no tab in the nav falls through to the default branch', () => {
    const cases = switchCaseIds();
    const orphans = headerTabIds().filter((id) => !cases.includes(id));
    // 🔴 If this is red, the named tab draws PROJECTS while looking selected. Add the case;
    // do not add the id to an exclusion list.
    expect(orphans).toEqual([]);
  });

  it('and every drawn tab survives a relaunch', () => {
    const block = persist.slice(persist.indexOf('export function isValidPageId'));
    const orphans = headerTabIds().filter((id) => !block.includes(`value === '${id}'`));
    expect(orphans).toEqual([]);
  });
});
