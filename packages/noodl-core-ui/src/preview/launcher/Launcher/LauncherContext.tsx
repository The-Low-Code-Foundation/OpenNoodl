/**
 * LauncherContext - State management for the launcher dashboard
 *
 * Provides global state for active tab navigation and other launcher-wide concerns.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { createContext, useContext, ReactNode } from 'react';

import { LauncherProjectData } from './components/LauncherProjectCard';
import { NoodlGitHubRepo, UseGitHubReposReturn } from './hooks/useGitHubRepos';

export type LauncherPageId = 'projects' | 'learn' | 'templates' | 'github';

export type LauncherLessonState = 'not-started' | 'in-progress' | 'completed';

/** A lesson shown in the Learn tab. Supplied by the editor from the hosted lesson index. */
export interface LauncherLessonData {
  id: string;
  title: string;
  description?: string;
  imageSrc?: string;
  category?: string;
  /** Completion 0–100. */
  progressPercent: number;
  state: LauncherLessonState;
}

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

  /** App version string for the footer wordmark (e.g. "0.1.0"). */
  appVersion?: string;

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

  // Lessons (Learn tab)
  lessons?: LauncherLessonData[];
  onStartLesson?: (lessonId: string) => void;
  onRestartLesson?: (lessonId: string) => void;

  // GitHub OAuth integration (optional - for Storybook compatibility)
  githubUser?: GitHubUser | null;
  githubIsAuthenticated?: boolean;
  githubIsConnecting?: boolean;
  onGitHubConnect?: () => void;
  onGitHubDisconnect?: () => void;

  // GitHub repos for clone feature (optional - for Storybook compatibility)
  githubRepos?: UseGitHubReposReturn | null;
  onCloneRepo?: (repo: NoodlGitHubRepo) => Promise<void>;

  /**
   * Open the app-wide settings (theme, AI provider and key). The launcher owns
   * the entry point; the host owns the dialog, because the real settings
   * components live in the editor and writing a launcher-local copy of the
   * credentials form would be a second source of truth for a secret.
   *
   * Omitted in Storybook, where there is no host — the gear is then absent
   * rather than present and inert.
   */
  onOpenSettings?: () => void;
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
