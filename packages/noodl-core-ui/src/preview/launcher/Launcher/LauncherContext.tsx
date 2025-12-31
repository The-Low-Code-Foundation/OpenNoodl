/**
 * LauncherContext - State management for the launcher dashboard
 *
 * Provides global state for active tab navigation and other launcher-wide concerns.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { createContext, useContext, ReactNode } from 'react';

import { LauncherProjectData } from './components/LauncherProjectCard';
import { ViewMode } from './components/ViewModeToggle';

// Re-export ViewMode for convenience
export { ViewMode };

export type LauncherPageId = 'projects' | 'learn' | 'templates';

export interface LauncherContextValue {
  activePageId: LauncherPageId;
  setActivePageId: (pageId: LauncherPageId) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  useMockData: boolean;
  setUseMockData: (value: boolean) => void;
  projects: LauncherProjectData[];
  hasRealProjects: boolean; // Indicates if real projects were provided to Launcher

  // Project management callbacks
  onCreateProject?: () => void;
  onOpenProject?: () => void;
  onLaunchProject?: (projectId: string) => void;
  onOpenProjectFolder?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
}

const LauncherContext = createContext<LauncherContextValue | null>(null);

export interface LauncherProviderProps {
  children: ReactNode;
  value: LauncherContextValue;
}

export function LauncherProvider({ children, value }: LauncherProviderProps) {
  return <LauncherContext.Provider value={value}>{children}</LauncherContext.Provider>;
}

/**
 * Hook to access launcher context
 * @throws Error if used outside of LauncherProvider
 */
export function useLauncherContext(): LauncherContextValue {
  const context = useContext(LauncherContext);

  if (!context) {
    throw new Error('useLauncherContext must be used within a LauncherProvider');
  }

  return context;
}
