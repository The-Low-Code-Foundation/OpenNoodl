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
  // Initialize state from localStorage or default
  const [activeTab, setActiveTab] = useState<LauncherPageId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidPageId(stored)) {
        return stored as LauncherPageId;
      }
    } catch (error) {
      console.warn('Failed to load active tab from localStorage:', error);
    }
    return defaultTab;
  });

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
 * Type guard to validate stored values
 */
function isValidPageId(value: string): value is LauncherPageId {
  return value === 'projects' || value === 'learn' || value === 'templates';
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
