/**
 * LauncherContext - State management for the launcher dashboard
 *
 * Provides global state for active tab navigation and other launcher-wide concerns.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { createContext, useContext, ReactNode } from 'react';

import type { ConnectAgentResult, ConnectAgentState } from './components/ConnectAgentCard';
import type { LauncherLearningData } from './components/LearningSection';
import { LauncherProjectData } from './components/LauncherProjectCard';
import { NoodlGitHubRepo, UseGitHubReposReturn } from './hooks/useGitHubRepos';

// ⚠️ `'learn'` and `'learning'` are two different pages and the near-identical
// names are load-bearing, not sloppiness:
//
//  - `'learn'`  — POL-002's retired catalogue of hosted lessons (`LearningCenter`).
//                 Unreachable: no tab, no deep link, rejected by `isValidPageId`.
//  - `'learning'` — UNI-007 / D5's Learning section, the lessons actually
//                 installed on this machine (`LearningSection`). This is the tab.
//
// Renaming `'learn'` out of existence would delete the retired catalogue, which
// POL-002 deliberately kept compiled; reusing it would put the dead catalogue
// behind the live tab. So both ids stay, and only one of them is reachable.
export type LauncherPageId = 'projects' | 'learn' | 'learning' | 'templates' | 'github';

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

  /**
   * UNI-007 / D5 — the Learning section beside recent projects.
   *
   * ⚠️ Not the same thing as `lessons` above, and the two must not be merged.
   * `lessons` is the hosted *catalogue* the removed Learn tab browsed: things
   * you could start. This is the set of lessons **installed on this machine**,
   * each with its own progress, grade and feedback, written by the editor
   * process into its own register (`models/learningfolder.ts`). One is a shop
   * window and the other is a shelf.
   *
   * Absent in Storybook. An empty list still renders the section when
   * `onInstallLearningLesson` is supplied, because that is where the
   * account-free install route is discoverable; with neither, nothing renders.
   */
  learning?: LauncherLearningData[];
  onOpenLearningLesson?: (lessonId: string) => void;
  onResetLearningLesson?: (lessonId: string) => void;
  /** Install a bundle from a folder — the account-free route D5 and UNI-010 both rely on. */
  onInstallLearningLesson?: () => void;

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

  /**
   * Window controls for the frameless window. macOS draws its own traffic
   * lights (`titleBarStyle: 'hidden'` in main.js keeps them); Windows and Linux
   * get nothing from `frame: false`, so the launcher header must draw them —
   * the editor's `TitleBar` already does the same for the in-project chrome.
   *
   * Supplied by the host, like `onOpenSettings`: the launcher lives in
   * noodl-core-ui and has no business requiring `@electron/remote`. Absent in
   * Storybook, where the buttons then do not render.
   */
  onMinimizeWindow?: () => void;
  onMaximizeWindow?: () => void;
  onCloseWindow?: () => void;

  /**
   * BST-003 — the connect-an-agent card, and the host's answer about it.
   *
   * Supplied by the host for the same reason as `onOpenSettings`: registering an MCP server means
   * probing PATH, spawning a CLI and possibly writing `~/.claude.json`, none of which
   * `noodl-core-ui` has any business doing. Absent in Storybook, where the card then does not
   * render at all rather than rendering a button that cannot work.
   */
  connectAgent?: ConnectAgentHostState;
}

/** What the host tells the launcher about connecting an agent. */
export interface ConnectAgentHostState {
  state: ConnectAgentState;
  result?: ConnectAgentResult | null;
  isCopied?: boolean;
  onConnect: () => void;
  onCopyCommand: () => void;
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
