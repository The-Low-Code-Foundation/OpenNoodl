/**
 * ProjectsPage - Entry point for the launcher dashboard
 *
 * This page displays the new React-based Launcher component
 * with horizontal tab navigation.
 */

import { ipcRenderer, shell } from 'electron';
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { clone } from '@noodl/git/src/core/clone';
import { filesystem, platform } from '@noodl/platform';

import {
  CloudSyncType,
  LauncherProjectData
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherProjectCard';
import {
  AiAvailability,
  ProjectCreationWizard,
  ReviewPlanRow,
  ScopingMessage,
  ScopingState,
  WizardMode
} from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard';
import {
  useGitHubRepos,
  NoodlGitHubRepo,
  GitHubClientInterface
} from '@noodl-core-ui/preview/launcher/Launcher/hooks/useGitHubRepos';
import type { LauncherLearningData } from '@noodl-core-ui/preview/launcher/Launcher/components/LearningSection';
import { Launcher } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';
import { LauncherLessonData } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import { useEventListener } from '../../hooks/useEventListener';
import type { AuthoringPlan } from '../../models/AiAssistant/authoring/plan';
import { provisionSummary } from '../../models/AiAssistant/authoring/plan';
import {
  DOC_INITIAL_SCOPE,
  ProjectScope,
  ScopingSession,
  backendNameForProject,
  emptyScope,
  planFromScope,
  scopeHasContent,
  scopeOutline,
  setPendingScopePlan,
  writeScopeDocs
} from '../../models/AiAssistant/scoping';
import { App } from '../../models/app';
import { DialogLayerModel } from '../../models/DialogLayerModel';
import { LearningFolderModel } from '../../models/learningfolder';
import { formatBundleScorecard } from '../../models/lessonbundleverify';
import { describeInstallCheck } from '../../models/lessoninstallpolicy';
import { attachLearningLesson } from '../../models/learninglesson';
import { LessonsProjectsModel } from '../../models/LessonsProjectModel';
import LessonTemplatesModel from '../../models/lessontemplatesmodel';
import { projectFromDirectory } from '../../models/projectmodel.editor';
import { ProjectDocsModel } from '../../models/ProjectDocs/ProjectDocsModel';
import type { ProjectModel } from '../../models/projectmodel';
import { upgradeProjectAgentConfigForDocs } from '../../models/template/installAgentConfig';
import { getAllPresets, setPendingPresetId } from '../../models/StylePresets';
import { IRouteProps } from '../../pages/AppRoute';
// Relative, not the `@noodl-store` alias: this file is inside noodl-core-ui's
// typecheck include glob (it imports the launcher preview), and that project
// does not carry the editor's path aliases.
import { AiConfigStore } from '../../store/AiAssistantStore';
import { GitHubOAuthService, GitHubClient } from '../../services/github';
import { ProjectOrganizationService } from '../../services/ProjectOrganizationService';
// Relative for the same reason `AiConfigStore` above is.
import { EditorSettings } from '../../utils/editorsettings';
import getContentEndpoint from '../../utils/getContentEndpoint';
import { LocalProjectsModel, ProjectItemWithRuntime } from '../../utils/LocalProjectsModel';
import { tracker } from '../../utils/tracker';
import { toLearningCards } from '../../views/projectsview.learningstate';
import { getLessonsState } from '../../views/projectsview.lessonstate';
import { MigrationWizard } from '../../views/migration/MigrationWizard';
import { ToastLayer } from '../../views/ToastLayer/ToastLayer';
import { UpdateManager } from '../../views/UpdateManager';
import { LauncherSettingsDialog, LauncherSettingsSection } from './LauncherSettingsDialog';
import { LAST_PROJECT_LOCATION_KEY, pickProjectLocation } from './projectLocationMemory';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';

import { useCommunityMirror } from '@noodl-hooks/useCommunityMirror';
import { useLearnerPath } from '../../hooks/useLearnerPath';
import { useCommunityPeople } from '@noodl-hooks/useCommunityPeople';
import { useCommunityThread } from '@noodl-hooks/useCommunityThread';

import { takeLauncherLanding } from '@noodl-utils/launcher/launcherHandoff';

import { useCommunityAccount } from './useCommunityAccount';
import { useConnectAgent } from './useConnectAgent';

export interface ProjectsPageProps extends IRouteProps {
  from: TSFixme;
}

/** Built-in presets computed once at module level — never changes at runtime. */
const STYLE_PRESETS = getAllPresets();

/**
 * AIX-012 — the components a brand-new project has before anything is built,
 * from `EmbeddedTemplateProvider`'s hello-world template.
 *
 * Used ONLY to preview the plan on the review step, which renders before the
 * project exists. The plan that is actually written to disk and handed over is
 * re-derived from the created project's real component list, so a template
 * change can make the preview and the record disagree about create-vs-update on
 * a page named "Home" — and the record, not the preview, is the one that counts.
 */
const NEW_PROJECT_COMPONENTS: ReadonlySet<string> = new Set(['/App', '/#__page__/Home']);

/** The plan as the review step lists it. */
function toPlanRows(plan: AuthoringPlan): ReviewPlanRow[] {
  return plan.operations.map((op) => ({
    kind: op.kind,
    target: op.target,
    intent: op.intent,
    // AIB-007 slice 4 — "provision App backend (3 collections, sign-in)".
    ...(op.provision ? { detail: provisionSummary(op.provision) } : {})
  }));
}

/**
 * Why "Start with AI" can or cannot be offered right now.
 *
 * The launcher genuinely does not host AI settings — the settings panel is part
 * of the editor's panel system and there is no project open here — so the route
 * out is a dialog carrying the real `AiSettingsSection`. That is the same
 * component the editor shows and it writes the same `EditorSettings`, so
 * configuring here configures everywhere; a launcher-only copy of the settings
 * form would be a second source of truth for credentials, which is the last
 * thing that should have two.
 */
function readAiAvailability(onConfigure: () => void): AiAvailability {
  const provider = AiConfigStore.getProvider();
  if (provider === 'disabled') {
    return {
      available: false,
      reason: 'AI is turned off. Pick a provider and add a key to use it.',
      actionLabel: 'Set up AI…',
      onAction: onConfigure
    };
  }
  if (!AiConfigStore.isConfigured()) {
    return {
      available: false,
      reason:
        provider === 'openai-compatible'
          ? 'No endpoint is set for the custom AI provider.'
          : `No API key is saved for ${AiConfigStore.getPrettyProvider() ?? provider}.`,
      actionLabel: 'Finish setup…',
      onAction: onConfigure
    };
  }
  return { available: true };
}

/**
 * Map LocalProjectsModel ProjectItemWithRuntime to LauncherProjectData format
 */
function mapProjectToLauncherData(project: ProjectItemWithRuntime): LauncherProjectData {
  return {
    id: project.id,
    title: project.name || 'Untitled',
    localPath: project.retainedProjectDirectory,
    lastOpened: new Date(project.latestAccessed).toISOString(),
    // No empty-SVG fallback: an unusable value makes the card render its
    // deterministic placeholder (UIX-006) instead of a blank white thumbnail.
    imageSrc: project.thumbURI || '',
    cloudSyncMeta: {
      type: CloudSyncType.None // TODO: Detect git repos in future
    },
    // Include runtime info for legacy detection
    runtimeInfo: project.runtimeInfo
    // Git-related fields will be populated in future tasks
  };
}

/**
 * Map hosted lesson templates + saved progress to the launcher's lesson cards.
 * Reuses getLessonsState (LEARN-001: previously orphaned) to derive state and
 * percent from the per-lesson progress the LessonsProjectsModel persists.
 */
function mapLessonsToLauncherData(
  templates: TSFixme[],
  lessonsModel: LessonsProjectsModel
): LauncherLessonData[] {
  const endpoint = getContentEndpoint();
  const progressList = templates.map(
    (t) => lessonsModel.getLessonProjectProgress(t.name) || { index: 0, end: 0 }
  );
  const states = getLessonsState(progressList);

  return templates.map((t, i) => ({
    id: t.name,
    title: t.title || t.name,
    description: t.header,
    imageSrc: t.thumb ? `${endpoint}/${t.thumb}` : undefined,
    category: t.category,
    progressPercent: states[i].progressPercent,
    state: (states[i].name as LauncherLessonData['state']) || 'not-started'
  }));
}

/**
 * Load-failure toast per the UIX-006 mock: named title, the actual reason, a
 * Show-details action (reveals the folder so the user can fix project.json), and
 * the always-present quiet Dismiss. Sticky until dismissed; red only here.
 */
function showLoadFailureToast(projectName: string | undefined, projectDir?: string) {
  const actions = projectDir
    ? [
        {
          label: 'Show details',
          onClick: () => {
            try {
              shell.showItemInFolder(projectDir);
            } catch (error) {
              console.error('Failed to reveal project folder:', error);
            }
          }
        }
      ]
    : undefined;

  ToastLayer.showError('Its project.json is missing or unreadable. The project stays in your list — fix the file and try again.', {
    title: `Couldn't load "${projectName || 'project'}"`,
    actions
  });
}

export function ProjectsPage(props: ProjectsPageProps) {
  /**
   * NAT-012 AC3. `useState`'s initialiser rather than a bare call, so a re-render does not read
   * the stash a second time and get `undefined` — which would send the launcher back to Projects
   * the first time anything above it re-rendered.
   */
  const [launcherLanding] = useState(takeLauncherLanding);

  // Real projects from LocalProjectsModel
  const [realProjects, setRealProjects] = useState<LauncherProjectData[]>([]);

  // Lessons for the Learn tab (LEARN-001 entry/discovery UI)
  const [lessons, setLessons] = useState<LauncherLessonData[]>([]);
  const [lessonsProjectsModel] = useState(() => new LessonsProjectsModel());

  // UNI-007 / D5 — lessons installed in the Learning folder. Not the same list
  // as `lessons` above: that one is the hosted catalogue, this one is the shelf.
  const [learning, setLearning] = useState<LauncherLearningData[]>([]);

  // Create project modal state
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  // AIX-012 — the scoping conversation. The session lives in a ref because it
  // is a long-lived object with an in-flight request, not render state; what
  // React re-renders on is the transcript and the recorded scope it produces.
  const scopingSessionRef = useRef<ScopingSession | null>(null);
  const [scopingMessages, setScopingMessages] = useState<ScopingMessage[]>([]);
  const [scopingScope, setScopingScope] = useState<ProjectScope>(() => emptyScope());
  const [isScopingBusy, setIsScopingBusy] = useState(false);
  const [scopingError, setScopingError] = useState<string | undefined>(undefined);
  /** AIB-009 F7 — the reply of the turn in flight, as it streams in. */
  const [scopingStreaming, setScopingStreaming] = useState('');
  /**
   * AAQ-002/F4 — the project name as typed in the wizard's first step, so the
   * plan preview can name the backend the same thing the apply will.
   */
  const [draftProjectName, setDraftProjectName] = useState('');
  const [aiConfigVersion, setAiConfigVersion] = useState(0);

  /** BST-003 — the connect-an-agent card's state, or `undefined` when there is nothing to offer. */
  const connectAgent = useConnectAgent();

  /**
   * UNI-001 AC2 — the NodeGX account. 🔴 Always present, unlike `connectAgent`: the card draws
   * nothing until the store has answered, and a community that cannot be reached right now is
   * still an account a person can have.
   */
  const community = useCommunityAccount();
  // UNI-011 / D21 — the community TAB's data. ⚠️ A different fact from `community` above:
  // that one is who you are, this one is what the community contains.
  const communityMirror = useCommunityMirror();
  /**
   * UNI-007 AC1 — the intake and the path it produces. ⚠️ A third distinct community fact
   * beside the two above: `community` is who you are, `communityMirror` is what the community
   * contains, and this is what YOU should learn next. It is always present for the same reason
   * `community` is — the questions load without a session, so there is something to draw before
   * anybody has signed in.
   */
  const learnerPath = useLearnerPath();
  // NAT-007 — which thread is open, and its data. The same hook the editor's rail panel calls;
  // see `useCommunityThread` on why one hook rather than one per surface.
  const communityThread = useCommunityThread();
  // NAT-008 — the directory and whichever profile is open. A third hook rather than a field on
  // the second, for the reason the second gives: each owns one question, and the surface that
  // mounts them is where they meet.
  const communityPeople = useCommunityPeople();

  // GitHub OAuth state
  const [githubIsAuthenticated, setGithubIsAuthenticated] = useState(false);
  const [githubIsConnecting, setGithubIsConnecting] = useState(false);
  const [githubUser, setGithubUser] = useState<ReturnType<typeof GitHubOAuthService.instance.getCurrentUser>>(null);
  const oauthService = GitHubOAuthService.instance;

  // Initialize GitHub OAuth state on mount
  useEffect(() => {
    console.log('🔧 [ProjectsPage] Initializing GitHub OAuth...');
    oauthService.initialize().then(() => {
      const isAuth = oauthService.isAuthenticated();
      const user = oauthService.getCurrentUser();
      console.log('🔧 [ProjectsPage] GitHub auth state:', isAuth, user?.login);
      setGithubIsAuthenticated(isAuth);
      setGithubUser(user);
    });
  }, [oauthService]);

  // Load the lesson catalogue for the Learn tab, and keep it in sync with
  // saved progress. LessonTemplatesModel.instance.fetch() is already kicked off
  // at app start (router.tsx); we consume its result here rather than into the
  // void, which is what left the whole discovery UI orphaned.
  useEffect(() => {
    const templatesModel = LessonTemplatesModel.instance;
    const lessonsModel = lessonsProjectsModel;
    const group = {}; // listener group token for clean teardown

    const rebuild = () => {
      const templates = templatesModel.getTemplates();
      if (templates && templates.length) {
        setLessons(mapLessonsToLauncherData(templates, lessonsModel));
      }
    };

    templatesModel.on('templatesChanged', rebuild, group);
    lessonsModel.on('lessonProgressChanged', rebuild, group);

    if (templatesModel.getTemplates()?.length) rebuild();
    else templatesModel.fetch();

    return () => {
      templatesModel.off(group);
      lessonsModel.off(group);
    };
  }, []);

  /**
   * UNI-007 / D5 — read the Learning register, and keep reading it.
   *
   * 🔴 The **editor process** owns this state. The register is an
   * editor-process store and nothing outside this process writes it, so there
   * is nothing to poll and no platform to ask: one read on mount, and one more
   * every time this process changes it.
   */
  useEffect(() => {
    const group = {};
    const model = LearningFolderModel.instance;

    const rebuild = () => setLearning(toLearningCards(model.list()));

    model.on('learningFolderChanged', rebuild, group);
    rebuild();

    return () => {
      model.off(group);
    };
  }, []);

  /**
   * Open an installed lesson.
   *
   * 🔴 Deliberately **not** `LocalProjectsModel.openProjectFromFolder`. That
   * would add the lesson to the recents list, where rename and delete already
   * exist — undoing D5's "cannot rename, detach or delete" and the whole reason
   * the Learning folder is a separate register. The lesson is loaded straight
   * from its directory, exactly as `LessonsProjectsModel` loads the hosted ones.
   */
  const handleOpenLearningLesson = useCallback(
    (lessonId: string) => {
      const entry = LearningFolderModel.instance.get(lessonId);
      if (!entry) return;
      if (entry.missing) {
        ToastLayer.showError('That lesson’s folder is no longer on disk. Reset it to pull a fresh copy.');
        return;
      }

      const activityId = 'opening-lesson';
      ToastLayer.showActivity('Opening lesson', activityId);

      projectFromDirectory(entry.projectDirectory, (project: TSFixme) => {
        ToastLayer.hideActivity(activityId);
        if (!project) {
          ToastLayer.showError('Could not open that lesson. Reset it to pull a fresh copy.');
          return;
        }
        // The id is the register's, not a minted one: it is what the runner
        // records progress and grades against when the lesson is graded.
        project.id = entry.id;
        if (!project.name) project.name = entry.title;
        /*
         * 🔴 **Without this the lesson opens as an ordinary project.**
         * `EditorPage` attaches the lesson layer only when
         * `ProjectModel.instance.isLesson()`, i.e. `project.lesson` is set, and
         * the only code that had ever set it is the hosted-zip path — which
         * points a `LessonModel` at an HTTP base URL this lesson does not have.
         * So slice 3 shipped a Learning section whose lessons opened with no
         * steps, no instructions and nothing to grade against. Found by
         * building slice 4's caller; see `models/learninglesson.ts`.
         */
        attachLearningLesson(project, entry);
        props.route.router.route({ to: 'editor', project });
      });
    },
    [props.route]
  );

  /**
   * Install a lesson from a folder on this machine.
   *
   * 🔴 **This is the account-free route, and it is the point.** D5 makes the
   * Learning section platform-managed but not platform-*dependent*: a lesson the
   * user's own Claude writes locally (UNI-010) lands in the same section through
   * the same editor-owned writer, with no sign-in anywhere in the story. Today
   * the user points at the folder; when UNI-010's MCP hand-off exists it will
   * call the same `install`, and pass `local-ai` because it will know who wrote
   * the bundle.
   *
   * ⚠️ Provenance passed here is `'local'`, not `'local-ai'`. Picking a directory
   * says nothing about who authored what is in it.
   *
   * 🔴 **The bundle may still make itself `local-ai`, and only in that
   * direction** (UNI-010 slice 2). A manifest declaring `curated` would be a
   * claim that buys trust and is ignored; a manifest declaring `authoredBy: "ai"`
   * *spends* trust — it moves the bundle from a one-class install gate to a
   * three-class one — so the register honours it. That is what lets the MCP route
   * work through this very dialog with no new plumbing: the sidecar writes a
   * folder, the learner points at it, and the stricter gate still applies.
   *
   * A refusal is reported in full: the verifier's first message is the useful
   * half — "this lesson would never have been completable, and here is the line".
   */
  const handleInstallLearningLesson = useCallback(async () => {
    const bundleDir = await filesystem.openDialog({ allowCreateDirectory: false });
    if (!bundleDir) return;

    const outcome = await LearningFolderModel.instance.install({ bundleDir, provenance: 'local' });

    if (outcome.result === 'installed') {
      const warnings = outcome.verification.findings.filter((f) => f.severity === 'warning');
      ToastLayer.showSuccess(
        warnings.length
          ? `"${outcome.entry.title}" installed, with ${warnings.length} warning(s) — see the console`
          : `"${outcome.entry.title}" is in your Learning section`
      );
      console.log('[Learning]', describeInstallCheck(outcome.scorecard, outcome.entry.provenance));
      if (warnings.length) console.warn('[Learning] lesson installed with warnings:', warnings);
      return;
    }

    if (outcome.scorecard) console.error('[Learning] lesson refused:', formatBundleScorecard(outcome.scorecard));
    ToastLayer.showError(outcome.reason);
  }, []);

  /**
   * D5's whole recovery story. Destructive to the learner's work, so it asks —
   * and the register still refuses to delete anything if the source cannot be
   * re-pulled, so a "yes" here cannot leave them with less than they had.
   */
  const handleResetLearningLesson = useCallback((lessonId: string) => {
    const entry = LearningFolderModel.instance.get(lessonId);
    if (!entry) return;

    if (
      !confirm(
        `Reset "${entry.title}"?\n\nThis throws away your copy of the lesson project and pulls a fresh one. ` +
          `Anything you have built inside it is lost.`
      )
    ) {
      return;
    }

    const outcome = LearningFolderModel.instance.reset(lessonId);
    if (outcome.result === 'reset') ToastLayer.showSuccess(`"${entry.title}" is back to its starting state`);
    else ToastLayer.showError(outcome.reason);
  }, []);

  // Listen for GitHub auth state changes
  useEventListener(oauthService, 'auth-state-changed', (event: { authenticated: boolean }) => {
    console.log('🔔 [ProjectsPage] GitHub auth state changed:', event.authenticated);
    setGithubIsAuthenticated(event.authenticated);
    if (event.authenticated) {
      setGithubUser(oauthService.getCurrentUser());
    } else {
      setGithubUser(null);
    }
  });

  // Listen for OAuth success
  useEventListener(oauthService, 'oauth-success', () => {
    setGithubIsConnecting(false);
  });

  useEventListener(oauthService, 'oauth-error', () => {
    setGithubIsConnecting(false);
    ToastLayer.showError('GitHub authentication failed');
  });

  // GitHub OAuth handlers
  const handleGitHubConnect = useCallback(async () => {
    console.log('🔘 [ProjectsPage] handleGitHubConnect called');
    setGithubIsConnecting(true);
    try {
      await oauthService.initiateOAuth();
      console.log('✅ [ProjectsPage] OAuth initiated');
    } catch (error) {
      console.error('❌ [ProjectsPage] OAuth error:', error);
      setGithubIsConnecting(false);
      ToastLayer.showError('Failed to connect GitHub');
    }
  }, [oauthService]);

  const handleGitHubDisconnect = useCallback(async () => {
    console.log('🔘 [ProjectsPage] handleGitHubDisconnect called');
    await oauthService.disconnect();
    ToastLayer.showSuccess('GitHub account disconnected');
  }, [oauthService]);

  // Create GitHubClient adapter for useGitHubRepos hook
  const githubClient = useMemo((): GitHubClientInterface | null => {
    if (!githubIsAuthenticated) return null;

    const client = GitHubClient.instance;
    return {
      listRepositories: async (options?: { per_page?: number; sort?: string }) => {
        const result = await client.listRepositories(options as TSFixme);
        return result;
      },
      listOrganizations: async () => {
        const result = await client.listOrganizations();
        return result;
      },
      listOrganizationRepositories: async (org, options) => {
        const result = await client.listOrganizationRepositories(org, options);
        return result;
      },
      isNoodlProject: async (owner, repo) => {
        return client.isNoodlProject(owner, repo);
      }
    };
  }, [githubIsAuthenticated]);

  // Use the GitHub repos hook
  const githubRepos = useGitHubRepos(githubClient, githubIsAuthenticated);

  /**
   * Handle cloning a GitHub repository
   * Follows the same legacy detection flow as handleOpenProject
   */
  const handleCloneRepo = useCallback(
    async (repo: NoodlGitHubRepo) => {
      console.log('🔵 [handleCloneRepo] Starting clone for:', repo.full_name);

      // Ask user where to clone
      try {
        const targetDir = await filesystem.openDialog({
          allowCreateDirectory: true
        });

        if (!targetDir) {
          console.log('🔵 [handleCloneRepo] User cancelled');
          return;
        }

        // Create path with repo name
        const clonePath = filesystem.join(targetDir, repo.name);

        // Check if directory already exists
        if (await filesystem.exists(clonePath)) {
          ToastLayer.showError(`A folder named "${repo.name}" already exists at that location`);
          return;
        }

        const activityId = 'cloning-repo';
        ToastLayer.showActivity(`Cloning ${repo.name}...`, activityId);

        // Get clone URL (prefer HTTPS with token for authenticated access)
        const token = await oauthService.getToken();
        const cloneUrl = repo.html_url.replace('https://', `https://x-access-token:${token}@`) + '.git';

        await clone(cloneUrl, clonePath, {
          singleBranch: false,
          defaultBranch: repo.default_branch
        });

        ToastLayer.hideActivity(activityId);
        ToastLayer.showSuccess(`Cloned "${repo.name}" successfully!`);

        tracker.track('GitHub Repository Cloned', {
          repoName: repo.name,
          isPrivate: repo.private
        });

        // Any project the editor can open runs on the default (React 18.3)
        // runtime unless it explicitly opts into React 19 — there is no
        // compatibility gate to pass. Add it to the list and ask to open.
        const project = await LocalProjectsModel.instance.openProjectFromFolder(clonePath);

        if (project) {
          if (!project.name) {
            project.name = repo.name;
          }

          await LocalProjectsModel.instance.fetch();
          LocalProjectsModel.instance.detectAllProjectRuntimes();

          const shouldOpen = confirm(`Project "${repo.name}" cloned successfully!\n\nWould you like to open it now?`);

          if (shouldOpen) {
            const projects = LocalProjectsModel.instance.getProjects();
            const projectEntry = projects.find((p) => p.id === project.id);

            if (projectEntry) {
              const loaded = await LocalProjectsModel.instance.loadProject(projectEntry);
              if (loaded) {
                props.route.router.route({ to: 'editor', project: loaded });
              }
            }
          }
        }
      } catch (error) {
        ToastLayer.hideActivity('cloning-repo');
        console.error('Failed to clone repository:', error);
        ToastLayer.showError(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [oauthService, props.route]
  );

  // Initialize and fetch projects on mount
  useEffect(() => {
    // Switch main window size to editor size
    ipcRenderer.send('main-window-resize', { size: 'editor', center: true });

    // Load projects with runtime detection
    const loadProjects = async () => {
      await LocalProjectsModel.instance.fetch();

      // Trigger background runtime detection for all projects
      LocalProjectsModel.instance.detectAllProjectRuntimes();

      // Get projects (detection runs in background, will update via events)
      const projects = LocalProjectsModel.instance.getProjectsWithRuntime();
      console.log('🔵 Projects loaded, triggering runtime detection for:', projects.length);
      setRealProjects(projects.map(mapProjectToLauncherData));
    };

    loadProjects();
  }, []);

  // Subscribe to project list changes
  useEventListener(LocalProjectsModel.instance, 'myProjectsChanged', () => {
    console.log('🔔 Projects list changed, updating dashboard with runtime detection');
    const projects = LocalProjectsModel.instance.getProjectsWithRuntime();
    setRealProjects(projects.map(mapProjectToLauncherData));
  });

  // Subscribe to runtime detection completion to update UI
  useEventListener(LocalProjectsModel.instance, 'runtimeDetectionComplete', (projectPath: string, runtimeInfo) => {
    console.log('🎯 Runtime detection complete for:', projectPath, runtimeInfo);
    const projects = LocalProjectsModel.instance.getProjectsWithRuntime();
    setRealProjects(projects.map(mapProjectToLauncherData));
  });

  const handleCreateProject = useCallback(() => {
    // Every open starts a fresh conversation. Reusing the previous one would
    // scope a new project against the last one's answers.
    scopingSessionRef.current = null;
    setScopingMessages([]);
    setScopingScope(emptyScope());
    setScopingError(undefined);
    setIsScopingBusy(false);
    setIsCreateModalVisible(true);
  }, []);

  /**
   * AIX-012 — the route out of "AI is not configured". The launcher has no
   * settings panel, so the real settings section is shown in a dialog; when it
   * closes, availability is recomputed so the entry card reflects what the user
   * just did without needing the modal reopened.
   */
  const openSettingsDialog = useCallback((initialSection?: LauncherSettingsSection) => {
    DialogLayerModel.instance.showDialog(
      (close) => <LauncherSettingsDialog onClose={close} initialSection={initialSection} />,
      {
        // One dialog, whichever door was used: the gear and the entry card's
        // setup action must not be able to stack two of these.
        id: 'launcher-settings',
        onClose: () => setAiConfigVersion((n) => n + 1)
      }
    );
  }, []);

  /** The gear in the launcher header — settings with nothing pre-selected. */
  const handleOpenSettings = useCallback(() => openSettingsDialog(), [openSettingsDialog]);

  /** The route out of "AI is not configured", from the entry card. */
  const handleConfigureAi = useCallback(() => openSettingsDialog('ai'), [openSettingsDialog]);

  /**
   * AIB-009 F12 — read it again once the settings exist.
   *
   * `EditorSettings` loads from disk asynchronously and `get()` returns
   * `undefined` until it lands, so `AiConfigStore.getProvider()` answers
   * `'disabled'` for the first moments of a launch. This memo runs in the first
   * render and its only other trigger is the settings dialog closing — so a
   * launcher that lost that race told the user **"AI is turned off"** on the
   * first screen of the product, over a perfectly good API key, for the rest of
   * the session. Found live: the card was disabled while
   * `AiConfigStore.getProvider()` returned `anthropic` in the same renderer, and
   * opening and closing Settings — changing nothing — enabled it.
   *
   * `ready` is the seam `EditorSettings` documents for exactly this. Bumping the
   * version once it resolves costs one re-read and is a no-op when the race was
   * won.
   */
  useEffect(() => {
    let cancelled = false;
    void EditorSettings.instance.ready.then(() => {
      if (!cancelled) setAiConfigVersion((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const aiAvailability = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aiConfigVersion is the re-read trigger
    () => readAiAvailability(handleConfigureAi),
    [handleConfigureAi, aiConfigVersion]
  );

  /** One user turn of the scoping conversation. */
  const handleScopingSend = useCallback(async (text: string) => {
    if (!scopingSessionRef.current) scopingSessionRef.current = new ScopingSession();
    const session = scopingSessionRef.current;

    setScopingError(undefined);
    setIsScopingBusy(true);
    setScopingStreaming('');
    // Show the user's own words immediately; a chat that waits for the model
    // before echoing what you typed reads as dropped input.
    setScopingMessages((prev) => [...prev, { role: 'user', text }]);

    try {
      // AIB-009 F7. `send` has always taken stream callbacks and passed them to
      // every round; nothing here passed any, so the launcher's wizard was the
      // one AI surface in the product that showed a static `Thinking…` for the
      // whole turn. `onText` hands back the accumulated text of the round in
      // flight, which is exactly what a bubble wants.
      const turn = await session.send(text, { onText: (fullText) => setScopingStreaming(fullText) });
      setScopingScope(turn.scope);
      if (turn.status === 'ok' || turn.status === 'cancelled') {
        if (turn.reply) setScopingMessages([...session.transcript]);
      } else {
        setScopingError(turn.note ?? 'The assistant could not answer.');
      }
    } catch (error) {
      setScopingError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsScopingBusy(false);
      // The streamed copy is only ever the turn in flight; the transcript is
      // what stands afterwards. Leaving it set would double the last reply.
      setScopingStreaming('');
    }
  }, []);

  /**
   * The plan the review step previews. Derived from the agreed scope, so it
   * cannot contain a page nobody agreed to.
   */
  const previewPlan = useMemo(
    () =>
      planFromScope(scopingScope, {
        existingComponents: NEW_PROJECT_COMPONENTS,
        // AAQ-002/F4. The same derivation `finishScopedProject` uses, from the
        // same string — `newProject` is called with this name verbatim, so the
        // row the user approves names the backend the apply will create.
        backendName: backendNameForProject(draftProjectName)
      }),
    [scopingScope, draftProjectName]
  );

  const scopingState: ScopingState = useMemo(
    () => ({
      messages: scopingMessages,
      isBusy: isScopingBusy,
      streamingReply: scopingStreaming,
      outline: scopeOutline(scopingScope),
      isAgreed: scopingScope.agreed,
      error: scopingError,
      planRows: toPlanRows(previewPlan),
      onSend: (text: string) => {
        void handleScopingSend(text);
      },
      onDraftNameChange: setDraftProjectName
    }),
    [
      scopingMessages,
      isScopingBusy,
      scopingStreaming,
      scopingScope,
      scopingError,
      previewPlan,
      handleScopingSend
    ]
  );

  const handleChooseLocation = useCallback(async (): Promise<string | null> => {
    try {
      const direntry = await filesystem.openDialog({
        allowCreateDirectory: true
      });
      if (direntry) {
        // FIX-021 — the write half of the seeded Location. Recorded here rather
        // than on Create, because this is the moment the user chose a folder:
        // abandoning the wizard afterwards does not make the choice less real,
        // and a creation that fails is exactly when they will be back.
        EditorSettings.instance.set(LAST_PROJECT_LOCATION_KEY, direntry);
      }
      return direntry || null;
    } catch (error) {
      console.error('Failed to choose location:', error);
      return null;
    }
  }, []);

  /**
   * FIX-021 — the folder the wizard's Location field opens on.
   *
   * Re-read every time the modal opens, which is what `isCreateModalVisible` is
   * doing in the dependency list: the wizard is unmounted while closed, so this
   * is the value it mounts with, and a folder chosen in one pass is the seed for
   * the next without any of it living in wizard state.
   */
  const initialWizardLocation = useMemo(
    () =>
      pickProjectLocation({
        remembered: EditorSettings.instance.get(LAST_PROJECT_LOCATION_KEY),
        documentsPath: platform.getDocumentsPath(),
        exists: (path) => filesystem.exists(path)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isCreateModalVisible is the re-read trigger
    [isCreateModalVisible]
  );

  /**
   * AIX-012 — everything that happens to an AI-scoped project *after* it has
   * been created by the ordinary path, and nothing that happens before.
   *
   * The spec's third criterion exists because new projects once shipped with no
   * Home component, and the fix lives inside `newProject` /
   * `EmbeddedTemplateProvider`. So there is no second creation path here: the
   * project is created exactly as a blank one is, and this only writes files
   * into the folder afterwards. A failure here costs the docs, never the
   * project.
   */
  const finishScopedProject = useCallback(async (project: ProjectModel, scope: ProjectScope) => {
    const docs = ProjectDocsModel.forProject(project);
    if (!docs) {
      ToastLayer.showError('The project was created, but its folder could not be found to write docs/ into.');
      return;
    }

    // Re-derived against what the project actually has, not against the
    // template we assume it came from.
    const existingComponents = new Set<string>(project.getComponents().map((c) => c.name));
    // AAQ-002/F4 — named from the project, because the provision reuses by name
    // and "App backend" is a constant. Read from the project rather than from
    // the wizard's draft so it is the name the project actually has.
    const plan = planFromScope(scope, {
      existingComponents,
      backendName: backendNameForProject(project.name)
    });

    const session = scopingSessionRef.current;
    const result = await writeScopeDocs(docs, {
      scope,
      transcript: session ? [...session.transcript] : [],
      plan,
      // "Abandoned" is a statement about agreement, not about effort: a user who
      // talked for ten minutes and never said yes still gets a record that says
      // nothing here was inferred to fill the gaps.
      abandoned: !scope.agreed
    });

    /**
     * FIX-021 slice 0 — the `CLAUDE.md` written during creation predates everything above.
     *
     * `newProject` writes it before this function runs, so it went out with `hasDocs: false`
     * and no summary: no "Where the decisions are" section, no sentence saying what the app
     * is. The `create_project` twin gets both, and BST-005's acceptance asks for *"the same
     * two files, same content shape"* from either path. Re-rendered here rather than
     * reordered because the ordering is deliberate — a docs failure must never cost the
     * project — and the re-render is guarded so it can only replace a file we authored.
     *
     * Only when at least one doc actually landed: `hasDocs` would otherwise point the reader
     * at a `docs/` that is not there.
     */
    if (result.written.length > 0) {
      const projectDirectory = project._retainedProjectDirectory;
      if (projectDirectory) {
        await upgradeProjectAgentConfigForDocs({
          projectDirectory,
          projectName: project.name || 'Untitled',
          summary: scope.summary
        });
      }
    }

    if (plan.operations.length > 0) {
      setPendingScopePlan({ projectId: project.id, plan, recordPath: DOC_INITIAL_SCOPE });
    }

    if (result.failed.length > 0) {
      console.error('[AIX-012] Some scoping documents could not be written:', result.failed);
      ToastLayer.showError(
        `The project was created, but ${result.failed.length} of ${
          result.failed.length + result.written.length
        } scoping documents could not be written. See the console for details.`
      );
    }
  }, []);

  const handleCreateProjectConfirm = useCallback(
    async (name: string, location: string, presetId: string, mode: WizardMode) => {
      setIsCreateModalVisible(false);

      // Store the chosen preset — StyleTokensModel will consume it on editor startup.
      setPendingPresetId(presetId);

      // Snapshot the scope now: the modal is closing and its state is about to
      // be reset, and the docs must record what was agreed, not what is left.
      const scope = scopingScope;
      const withScope = mode === 'ai' && (scopeHasContent(scope) || Boolean(scope.request));

      try {
        const path = filesystem.makeUniquePath(filesystem.join(location, name));

        const activityId = 'creating-project';
        ToastLayer.showActivity('Creating new project', activityId);

        LocalProjectsModel.instance.newProject(
          (project) => {
            if (!project) {
              ToastLayer.hideActivity(activityId);
              // Clear pending preset if project creation failed
              setPendingPresetId(null);
              setPendingScopePlan(null);
              ToastLayer.showError('Could not create project');
              return;
            }

            if (!withScope) {
              ToastLayer.hideActivity(activityId);
              // Navigate to editor — StyleTokensModel will apply preset on load
              props.route.router.route({ to: 'editor', project });
              return;
            }

            // The docs are written before the editor opens so the authoring
            // loop's very first turn already sees CONVENTIONS.md — a rule the
            // assistant has to be told about later is a rule it has already
            // broken once.
            finishScopedProject(project, scope)
              .catch((error) => {
                console.error('[AIX-012] Failed to write scoping documents:', error);
                ToastLayer.showError('The project was created, but its docs/ could not be written.');
              })
              .finally(() => {
                ToastLayer.hideActivity(activityId);
                props.route.router.route({ to: 'editor', project });
              });
          },
          { name, path, projectTemplate: '' }
        );
      } catch (error) {
        setPendingPresetId(null);
        console.error('Failed to create project:', error);
        ToastLayer.showError('Failed to create project');
      }
    },
    [props.route, scopingScope, finishScopedProject]
  );

  const handleCreateModalClose = useCallback(() => {
    // Cancel is cancel: an in-flight scoping turn is aborted rather than left
    // to resolve into a closed modal.
    scopingSessionRef.current?.cancel();
    setIsCreateModalVisible(false);
  }, []);

  const handleOpenProject = useCallback(async () => {
    console.log('🔵 [handleOpenProject] Starting...');
    try {
      console.log('🔵 [handleOpenProject] Opening file dialog...');
      const direntry = await filesystem.openDialog({
        allowCreateDirectory: false
      });
      console.log('🔵 [handleOpenProject] Selected folder:', direntry);

      if (!direntry) {
        console.log('🔵 [handleOpenProject] User cancelled');
        return;
      }

      // Any project the editor can open runs on the default (React 18.3)
      // runtime unless it explicitly opts into React 19 — there is no
      // compatibility gate to pass, so open it like any other project.
      const activityId = 'opening-project';
      ToastLayer.showActivity('Opening project', activityId);

      const project = await LocalProjectsModel.instance.openProjectFromFolder(direntry);

      if (!project) {
        ToastLayer.hideActivity(activityId);
        ToastLayer.showError('Could not open project');
        return;
      }

      if (!project.name) {
        project.name = filesystem.basename(direntry);
      }

      const projects = LocalProjectsModel.instance.getProjects();
      const projectEntry = projects.find((p) => p.id === project.id);

      if (!projectEntry) {
        ToastLayer.hideActivity(activityId);
        ToastLayer.showError('Could not find project in recent list');
        console.error('Project was added but not found in list:', project.id);
        return;
      }

      const loaded = await LocalProjectsModel.instance.loadProject(projectEntry);
      ToastLayer.hideActivity(activityId);

      if (!loaded) {
        showLoadFailureToast(project.name, projectEntry.retainedProjectDirectory);
      } else {
        props.route.router.route({ to: 'editor', project: loaded });
      }
    } catch (error) {
      ToastLayer.hideActivity('opening-project');
      console.error('Failed to open project:', error);
      ToastLayer.showError('Could not open project');
    }
  }, [props.route]);

  /**
   * Clone (or resume) a lesson project and open it. Routing sets
   * ProjectModel.instance = project (router.tsx), and the cloned project
   * carries the synthesised `lesson` field, so EditorPage's isLesson() check
   * lights up the lesson layer.
   */
  const openLesson = useCallback(
    (lessonId: string, restart: boolean) => {
      const template = LessonTemplatesModel.instance.getTemplates().find((t: TSFixme) => t.name === lessonId);
      if (!template) {
        ToastLayer.showError('Could not find that lesson');
        return;
      }

      const activityId = 'loading-lesson';
      ToastLayer.showActivity(restart ? 'Restarting lesson' : 'Loading lesson', activityId);

      const onLoaded = (project?: TSFixme) => {
        ToastLayer.hideActivity(activityId);
        if (!project) {
          ToastLayer.showError('Could not load lesson');
          return;
        }
        tracker.track('Lesson Opened', { lesson: template.name, restart });
        props.route.router.route({ to: 'editor', project });
      };

      const lessonsModel = lessonsProjectsModel;
      if (restart) lessonsModel.restartLessonProject(template, onLoaded, undefined);
      else lessonsModel.loadLessonProject(template, onLoaded, undefined);
    },
    [props.route]
  );

  const handleStartLesson = useCallback((lessonId: string) => openLesson(lessonId, false), [openLesson]);
  const handleRestartLesson = useCallback((lessonId: string) => openLesson(lessonId, true), [openLesson]);

  const handleLaunchProject = useCallback(
    async (projectId: string) => {
      const projects = LocalProjectsModel.instance.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const activityId = 'launching-project';
      ToastLayer.showActivity('Opening project', activityId);

      try {
        const loaded = await LocalProjectsModel.instance.loadProject(project);
        ToastLayer.hideActivity(activityId);

        if (!loaded) {
          showLoadFailureToast(project.name, project.retainedProjectDirectory);
        } else {
          // Navigate to editor with the loaded project
          props.route.router.route({ to: 'editor', project: loaded });
        }
      } catch (error) {
        ToastLayer.hideActivity(activityId);
        console.error('Failed to launch project:', error);
        ToastLayer.showError('Could not load project');
      }
    },
    [props.route]
  );

  const handleOpenProjectFolder = useCallback(async (projectId: string) => {
    const projects = LocalProjectsModel.instance.getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project || !project.retainedProjectDirectory) {
      ToastLayer.showError('Project folder not found');
      return;
    }

    try {
      shell.showItemInFolder(project.retainedProjectDirectory);
    } catch (error) {
      console.error('Failed to open project folder:', error);
      ToastLayer.showError('Could not open project folder');
    }
  }, []);

  const handleDeleteProject = useCallback((projectId: string) => {
    const projects = LocalProjectsModel.instance.getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    // Confirm deletion
    if (
      confirm(
        `Remove project "${project.name}" from the list?\n\nNote: The project folder will remain on disk and can be opened again later.`
      )
    ) {
      LocalProjectsModel.instance.removeProject(projectId);
      ToastLayer.showSuccess('Project removed from list');
    }
  }, []);

  /**
   * Handle "Migrate Project" button click - opens the migration wizard
   */
  const handleMigrateProject = useCallback(
    (projectId: string) => {
      const projects = LocalProjectsModel.instance.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project || !project.retainedProjectDirectory) {
        ToastLayer.showError('Cannot migrate project: path not found');
        return;
      }

      const projectPath = project.retainedProjectDirectory;

      // Show the migration wizard as a dialog
      DialogLayerModel.instance.showDialog(
        (close) =>
          React.createElement(MigrationWizard, {
            sourcePath: projectPath,
            projectName: project.name,
            onComplete: async (targetPath: string) => {
              close();
              // Clear runtime cache for the source project
              LocalProjectsModel.instance.clearRuntimeCache(projectPath);

              // Show activity indicator
              const activityId = 'adding-migrated-project';
              ToastLayer.showActivity('Adding migrated project to list', activityId);

              try {
                // Add the migrated project to the projects list
                const migratedProject = await LocalProjectsModel.instance.openProjectFromFolder(targetPath);

                if (!migratedProject.name) {
                  migratedProject.name = project.name + ' (React 19)';
                }

                // Refresh the projects list to show both projects
                await LocalProjectsModel.instance.fetch();

                // Trigger runtime detection for both projects to update UI immediately
                await LocalProjectsModel.instance.detectProjectRuntime(projectPath);
                await LocalProjectsModel.instance.detectProjectRuntime(targetPath);

                // Force a full re-detection to update the UI with correct runtime info
                LocalProjectsModel.instance.detectAllProjectRuntimes();

                ToastLayer.hideActivity(activityId);

                // Ask user if they want to archive the original
                const shouldArchive = confirm(
                  `Migration successful!\n\n` +
                    `Would you like to move the original project to a "Legacy Projects" folder?\n\n` +
                    `The original will be preserved but organized separately. You can access it anytime from the Legacy Projects category.`
                );

                if (shouldArchive) {
                  // Get or create "Legacy Projects" folder
                  let legacyFolder = ProjectOrganizationService.instance
                    .getFolders()
                    .find((f) => f.name === 'Legacy Projects');

                  if (!legacyFolder) {
                    legacyFolder = ProjectOrganizationService.instance.createFolder('Legacy Projects');
                  }

                  // Move original project to Legacy folder
                  ProjectOrganizationService.instance.moveProjectToFolder(projectPath, legacyFolder.id);

                  ToastLayer.showSuccess(
                    `"${migratedProject.name}" is ready! Original moved to Legacy Projects folder.`
                  );

                  tracker.track('Legacy Project Archived', {
                    projectName: project.name
                  });
                } else {
                  ToastLayer.showSuccess(`"${migratedProject.name}" is now in your projects list!`);
                }

                // Stay in launcher - user can now see both projects and choose which to open
                tracker.track('Migration Completed', {
                  projectName: project.name,
                  archivedOriginal: shouldArchive
                });
              } catch (error) {
                ToastLayer.hideActivity(activityId);
                ToastLayer.showError('Project migrated but could not be added to list. Try opening it manually.');
                console.error('Failed to add migrated project:', error);
                // Refresh project list anyway
                LocalProjectsModel.instance.fetch();
              }
            },
            onCancel: () => {
              close();
            }
          }),
        {
          onClose: () => {
            // Refresh project list when dialog closes
            LocalProjectsModel.instance.fetch();
          }
        }
      );

      tracker.track('Migration Wizard Opened', {
        projectName: project.name
      });
    },
    [props.route]
  );

  /**
   * Handle "Open Read-Only" button click - opens legacy project without migration
   */
  const handleOpenReadOnly = useCallback(
    async (projectId: string) => {
      const projects = LocalProjectsModel.instance.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const activityId = 'opening-project-readonly';
      ToastLayer.showActivity('Opening project in read-only mode', activityId);

      try {
        const loaded = await LocalProjectsModel.instance.loadProject(project);
        ToastLayer.hideActivity(activityId);

        if (!loaded) {
          ToastLayer.showError("Couldn't load project.");
          return;
        }

        tracker.track('Legacy Project Opened Read-Only', {
          projectName: project.name
        });

        // Show persistent warning about read-only mode (stays forever with Infinity default)
        ToastLayer.showError('⚠️  READ-ONLY MODE - No changes will be saved to this project');

        // Open the project in read-only mode
        props.route.router.route({ to: 'editor', project: loaded, readOnly: true });
      } catch (error) {
        ToastLayer.hideActivity(activityId);
        ToastLayer.showError('Could not open project');
        console.error('Failed to open legacy project:', error);
      }
    },
    [props.route]
  );

  return (
    <>
      <Launcher
        /**
         * 🔴 NAT-012 AC3 — a door in the editor asked for a page, and this is where it is
         * honoured. `takeLauncherLanding` is **consumed on read**, so this is the one mount that
         * lands anywhere but Projects: close a second project afterwards and nothing is stashed,
         * so FIX-025's *"the launcher opens on Projects"* holds for every open nobody asked to
         * redirect. ⚠️ Read during render on purpose — `initialTab` is only consulted on the
         * `Launcher`'s first render, so claiming it in an effect would claim it too late.
         */
        initialTab={launcherLanding}
        projects={realProjects}
        appVersion={platform.getVersion()}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onLaunchProject={handleLaunchProject}
        onOpenProjectFolder={handleOpenProjectFolder}
        onDeleteProject={handleDeleteProject}
        onMigrateProject={handleMigrateProject}
        onOpenReadOnly={handleOpenReadOnly}
        lessons={lessons}
        onStartLesson={handleStartLesson}
        onRestartLesson={handleRestartLesson}
        // UNI-007 / D5 — the Learning section. Empty until something installs
        // into the register, and the section renders nothing when it is empty.
        learning={learning}
        onOpenLearningLesson={handleOpenLearningLesson}
        onResetLearningLesson={handleResetLearningLesson}
        onInstallLearningLesson={handleInstallLearningLesson}
        // UNI-007 AC1 — the path above the shelf. 🔴 The `surface` is the whole decision;
        // this page passes it through and adds nothing, which is what keeps the mirror a
        // mirror (`learnerpathview.ts`, and D15's argument one surface along).
        learnerPath={learnerPath.surface}
        onChooseIntakeAnswer={learnerPath.onChoose}
        onSubmitIntake={learnerPath.onSubmit}
        onRetakeIntake={learnerPath.onRetake}
        onProjectConcept={learnerPath.onProject}
        projectingConcept={learnerPath.projecting}
        learnerPathProjectionNote={learnerPath.projectionNote}
        projectOrganizationService={ProjectOrganizationService.instance}
        githubUser={githubUser}
        githubIsAuthenticated={githubIsAuthenticated}
        githubIsConnecting={githubIsConnecting}
        onGitHubConnect={handleGitHubConnect}
        onGitHubDisconnect={handleGitHubDisconnect}
        githubRepos={githubRepos}
        onCloneRepo={handleCloneRepo}
        onOpenSettings={handleOpenSettings}
        // The window is frameless on every platform, and only macOS keeps
        // native buttons — so on Windows and Linux the launcher had no
        // minimise/maximise/close. `App` already owns these for the editor's
        // own titlebar; the launcher just had nobody passing them in.
        onMinimizeWindow={() => App.instance.minimize()}
        onMaximizeWindow={() => App.instance.maximize()}
        onCloseWindow={() => App.instance.close()}
        // BST-003 — the on-ramp before there is a project. `undefined` when there is no server
        // bundle to point at, in which case the card does not render at all.
        connectAgent={connectAgent}
        // UNI-001 AC2 — the sign-in card, and the chip plus sign-out once there is a session.
        // The editor is fully functional signed out; this adds a surface and gates nothing.
        community={community}
        communityMirror={{
          view: communityMirror.view,
          isRefreshing: communityMirror.isRefreshing,
          onRefresh: communityMirror.refresh,
          // 🔴 NAT-007 AC1 — this was `platform.openExternal(`${COMMUNITY_URL}/bench/${externalId}`)`,
          // and `externalId` was a field the platform has never sent, so every thread anybody
          // clicked opened `/bench/undefined`. It opens in place now; see `communityapi.ts`.
          thread: communityThread.pane
            ? // 🔴 NAT-008 AC4 — a post's author line opens their profile, and this is the join.
              { ...communityThread.pane, onOpenPerson: communityPeople.openPerson }
            : null,
          onOpenThread: communityThread.openThread,
          // FB-002 AC3 — the Bench pills. The default is the hook's, so this tab and the editor's
          // rail panel open on the same list for the same account (AC4).
          onSelectBenchFilter: communityMirror.selectBenchFilter,
          // NAT-008 AC1/AC2. ⚠️ `people` is `null` when D15 refused this viewer, which the tab
          // draws as nothing at all — see `LauncherCommunityHostState.people`.
          people: communityPeople.people,
          profile: communityPeople.profile,
          onOpenArticle: (slug) => platform.openExternal(`${COMMUNITY_URL}/articles/${slug}`),
          onOpenReplay: (slug) => platform.openExternal(`${COMMUNITY_URL}/replays/${slug}`),
          onOpenCommunity: () => platform.openExternal(COMMUNITY_URL)
        }}
      />

      <ProjectCreationWizard
        isVisible={isCreateModalVisible}
        onClose={handleCreateModalClose}
        onConfirm={handleCreateProjectConfirm}
        onChooseLocation={handleChooseLocation}
        presets={STYLE_PRESETS}
        aiAvailability={aiAvailability}
        scoping={scopingState}
        initialLocation={initialWizardLocation}
      />

      {/* The launcher had no update surface at all: `BaseWindow`, which owned
          the old popup, wraps only `EditorPage`. So an update could be offered
          only to someone already inside a project — the one place a restart
          costs the most. */}
      <UpdateManager />
    </>
  );
}
