/**
 * LauncherContext - State management for the launcher dashboard
 *
 * Provides global state for active tab navigation and other launcher-wide concerns.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { createContext, useContext, ReactNode } from 'react';

import { LauncherProjectData } from './components/LauncherProjectCard';

export type LauncherPageId = 'projects' | 'learn' | 'templates';

// GitHub user info (matches GitHubOAuthService interface)
export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

export interface LauncherContextValue {
  activePageId: LauncherPageId;
  setActivePageId: (pageId: LauncherPageId) => void;
  useMockData: boolean;
  setUseMockData: (value: boolean) => void;
  projects: LauncherProjectData[];
  hasRealProjects: boolean; // Indicates if real projects were provided to Launcher

  // Folder organization
  selectedFolderId: string | null;
  setSelectedFolderId: (folderId: string | null) => void;

  // Project organization service (optional for Storybook compatibility)
  projectOrganizationService?: any; // Use 'any' to avoid circular deps

  // Project management callbacks
  onCreateProject?: () => void;
  onOpenProject?: () => void;
  onLaunchProject?: (projectId: string) => void;
  onOpenProjectFolder?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onMigrateProject?: (projectId: string) => void;
  onOpenReadOnly?: (projectId: string) => void;

  // GitHub OAuth integration (optional - for Storybook compatibility)
  githubUser?: GitHubUser | null;
  githubIsAuthenticated?: boolean;
  githubIsConnecting?: boolean;
  onGitHubConnect?: () => void;
  onGitHubDisconnect?: () => void;
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
