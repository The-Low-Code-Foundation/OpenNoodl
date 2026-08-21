/**
 * usePersistentTab - Hook for persisting active tab state
 *
 * Saves and restores the active tab choice across application restarts
 * using localStorage.
 *
 * @module noodl-core-ui/preview/launcher
 */

import { useState, useEffect } from 'react';

import { LauncherPageId } from '../LauncherContext';

const STORAGE_KEY = 'noodl-launcher-active-tab';

/**
 * Hook that manages tab state with localStorage persistence
 *
 * @param defaultTab - The default tab if no stored value exists
 * @returns Tuple of [activeTab, setActiveTab]
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = usePersistentTab('projects');
 * ```
 */
export function usePersistentTab(defaultTab: LauncherPageId): [LauncherPageId, (tab: LauncherPageId) => void] {
  /**
   * 🔴 FIX-025 — THE LAUNCHER OPENS ON `defaultTab`. THE STORED TAB IS NO LONGER RESTORED.
   *
   * Richard, 2026-08-20: *"Opening the launcher opens at the community page by default, it
   * should be the projects page."*
   *
   * ⚠️ **This reverses FIX-024's fifth acceptance criterion**, which drove and recorded *"It
   * persists. localStorage holds `learning` and a full reload comes back on the Learning tab."*
   * That was built as a feature and it is being removed on purpose, so the reasoning is here
   * rather than in a commit message nobody will find:
   *
   * FIX-024's own title is *"the launcher opens on the Learning section, not on your projects"*
   * — the same complaint, from the same person, about a different tab. It was answered by moving
   * the section behind a tab while leaving restore in place, which meant the launcher could
   * still open on any tab you happened to visit last. Community shipped in the header (UNI-011 /
   * D21) and the same defect reappeared immediately, pointing at a different page. Restoring the
   * last tab is what makes the opening screen unpredictable, and the opening screen is the one
   * Richard has now asked to be Projects twice.
   *
   * ⚠️ **The write is kept.** The key still records where you were, so nothing else that reads
   * it breaks and restoring is a one-line change if this is ever wanted back — and `isValidPageId`
   * keeps its meaning and its specs. What changed is only that the launcher does not *consult*
   * the key when deciding where to open.
   */
  const [activeTab, setActiveTab] = useState<LauncherPageId>(defaultTab);

  // Save to localStorage whenever tab changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, activeTab);
    } catch (error) {
      console.warn('Failed to save active tab to localStorage:', error);
    }
  }, [activeTab]);

  return [activeTab, setActiveTab];
}

/**
 * Type guard to validate stored values.
 *
 * POL-002 dropped `'learn'`: the tab is gone, and anyone whose last session
 * ended on it has `'learn'` sitting in localStorage. Rejecting it here is what
 * lands them on the default tab rather than on a page with no way back to it.
 *
 * 🔴 `'learning'` is accepted and `'learn'` is still rejected. They are two
 * different pages (see `LauncherPageId`) and this is the one place a *stored*
 * string decides which you land on, so getting the near-identical names the
 * wrong way round here would silently park people on the retired catalogue.
 *
 * The list is spelled out rather than derived from the tab table because a
 * derived guard would accept whatever the header happens to render, and the
 * whole point of POL-002's entry is a page id the header does *not* render.
 *
 * Exported for the editor's suite: noodl-core-ui has no test runner of its own,
 * the same reason `shouldWriteDeepLinkUrl` and `isMacPlatform` are exported.
 */
export function isValidPageId(value: string): value is LauncherPageId {
  return (
    value === 'projects' ||
    value === 'community' ||
    value === 'learning' ||
    value === 'templates' ||
    value === 'github'
  );
}

/**
 * Utility to manually clear stored tab preference
 * Useful for testing or reset functionality
 */
export function clearStoredTab(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear stored tab:', error);
  }
}
