/**
 * LauncherContext - State management for the launcher dashboard
 *
 * Provides global state for active tab navigation and other launcher-wide concerns.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { createContext, useContext, ReactNode } from 'react';

import type { CommunityAccountState } from './components/CommunityAccountCard';
import type { ConnectAgentResult, ConnectAgentState } from './components/ConnectAgentCard';
import type { LauncherCommunityHostState } from './views/Community';
// The leaf module, not the wizard's index — see the note in `views/Templates.tsx`.
import type { TemplateGalleryState } from './components/ProjectCreationWizard/steps/TemplateStep';
import type { LauncherLearnerPath } from './components/LearnerPathSection';
import type { LauncherLearningData } from './components/LearningSection';
import { LauncherProjectData } from './components/LauncherProjectCard';
import type { ShareTemplateModalProps } from './components/ShareTemplateModal';
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
//  - `'community'` — UNI-011 / D21's community tab. Added 2026-08-19 when Richard reversed D16:
//                 the surface ships now, with whatever data exists including none.
export type LauncherPageId = 'projects' | 'learn' | 'learning' | 'templates' | 'github' | 'community';

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

  /**
   * FB-005 T5 — "Share as template" on a project's kebab, and the dialog it opens.
   *
   * ⚠️ **Two fields, not one.** `onShareAsTemplate` is the launcher asking the host to begin;
   * `shareTemplateModal` is the host's whole dialog state, already turned into props. The host
   * owns it because every decision behind it (what may be sent, what each outcome says) lives in
   * `noodl-editor`, which this package may not import — the split `useProjectTemplates` uses.
   *
   * Absent in Storybook, where the menu entry simply does not appear.
   */
  onShareAsTemplate?: (projectId: string) => void;
  shareTemplateModal?: ShareTemplateModalProps | null;

  /**
   * REL-013 — the template shelf the **Templates tab** draws.
   *
   * 🔴 **THE SAME `TemplateGalleryState` THE CREATE WIZARD IS HANDED, FROM THE SAME
   * `useProjectTemplates` INSTANCE.** One shelf, two surfaces. A second instance in the host
   * would double every community request and let the tab and the wizard show two different
   * lists — which is why this is a value passed down rather than a hook the tab could call.
   *
   * ⚠️ `undefined` means *nobody wired this* (Storybook, or a host with no hook), which is not
   * one of the shelf's own states — an empty shelf is a claim, and the tab cannot make it on no
   * evidence. `communityMirror` above draws the same line for the same reason.
   */
  templates?: TemplateGalleryState;

  /**
   * REL-013 — start a project from a row on the Templates tab.
   *
   * 🔴 **The host opens the CREATE WIZARD on that template; it does not create anything here.**
   * `handleCreateProjectConfirm` is the one creation route, and it is the route that reads
   * `needsBackend` off the chosen row (SBR-001). A second route from this tab that forgot it
   * would produce a backend-less project from a template that needs one.
   */
  onUseTemplate?: (templateUrl: string) => void;

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

  /**
   * UNI-007 AC1 — the intake, and the path it produces.
   *
   * ⚠️ **A different thing again from both fields above, and the three are easy to blur.**
   * `lessons` is a catalogue, `learning` is the shelf of what is installed here, and this is
   * the *plan*: which lessons this learner should meet, in what order, and — today — the
   * platform's own sentence saying none of them can be installed yet. A path is not a shelf,
   * and merging them would let a path step look like something you could open.
   *
   * 🔴 Absent in Storybook and in any build with no host hook, and the section then renders
   * NOTHING rather than an empty path. `undefined` here means *nobody wired this*, which is
   * not one of the surface's own states — `hidden` (D15 refused you) is, and it is a different
   * fact that must not be folded into this one.
   */
  learnerPath?: LauncherLearnerPath;
  onChooseIntakeAnswer?: (questionKey: string, value: string) => void;
  onSubmitIntake?: () => void;
  onRetakeIntake?: () => void;
  /** 🔴 Spends money, once per (learner, concept), for ever. See the client's `projectConcept`. */
  onProjectConcept?: (concept: string) => void;
  /** The concept a projection is in flight for, so only that row says so. */
  projectingConcept?: string | null;
  /** What to say about the last projection attempt. D10's refusal arrives here, as a setting. */
  learnerPathProjectionNote?: string | null;

  /**
   * UNI-011 / D21 — the community tab's data, supplied by the editor.
   *
   * ⚠️ Absent in Storybook and in any build without the host hook, and the view says so rather
   * than rendering an empty community. `undefined` here means *nobody wired this*, which is a
   * different fact from every state inside `CommunityMirrorView` and must not be folded into it.
   *
   * ⚠️ **NOT `community`** — that key is UNI-001's sign-in card state. Caught by tsc.
   */
  communityMirror?: LauncherCommunityHostState;

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

  /**
   * UNI-001 AC2 — the NodeGX account: the sign-in card, and the chip once there is one.
   *
   * Supplied by the host for the same reason as `connectAgent`: the device flow, the token store
   * and `platform.openExternal` all live in `noodl-editor`, and this package renders in Storybook
   * where none of them exists. Absent there, and the card then does not render at all.
   *
   * 🔴 **Unlike `connectAgent`, the host supplies this even when the platform is unreachable.** A
   * connect button with no bundle to point at cannot work; a community that is down right now is
   * one that is up in ten minutes, and hiding the account on a failed fetch would make signing in
   * look like a feature that comes and goes.
   */
  community?: CommunityAccountHostState;
}

/** What the host tells the launcher about the NodeGX account. */
export interface CommunityAccountHostState {
  state: CommunityAccountState;
  /** The last failure, in a sentence a person can act on. `null` when there is nothing to say. */
  error?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
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
