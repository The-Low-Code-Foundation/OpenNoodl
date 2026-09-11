/**
 * The launcher's persisted-tab guard, after the Learning section moved out of
 * the Projects view and into its own tab (Richard, 2026-08-17).
 *
 * 🔴 What is actually at risk here is a name collision, not a list. There are
 * now two page ids one letter apart:
 *
 *   'learn'    — POL-002's retired catalogue of hosted lessons. No tab, no deep
 *                link, and it must stay rejected: a stored `'learn'` from before
 *                POL-002 would otherwise land someone on a dead page.
 *   'learning' — the installed-lessons section, which is the new tab.
 *
 * `isValidPageId` is the one place a *stored string* decides which of those you
 * land on, so both directions are asserted. A spec that only checked
 * `'learning'` is accepted would pass just as happily with `'learn'` accepted
 * too, which is the mistake worth catching.
 *
 * noodl-core-ui has no test runner of its own — same reason the deep-link guard
 * is covered from this package.
 */

import { isValidPageId } from '@noodl-core-ui/preview/launcher/Launcher/hooks/usePersistentTab';

describe('launcher persisted-tab guard', () => {
  it('accepts every tab the header renders', () => {
    expect(isValidPageId('projects')).toBe(true);
    expect(isValidPageId('learning')).toBe(true);
    expect(isValidPageId('templates')).toBe(true);
    expect(isValidPageId('github')).toBe(true);
  });

  it("still rejects POL-002's retired 'learn' — one letter from the live tab", () => {
    expect(isValidPageId('learn')).toBe(false);
  });

  it('rejects anything else, including near-misses on the new id', () => {
    expect(isValidPageId('Learning')).toBe(false);
    expect(isValidPageId('learnings')).toBe(false);
    expect(isValidPageId('')).toBe(false);
    expect(isValidPageId('dashboard/learning')).toBe(false);
  });
});
