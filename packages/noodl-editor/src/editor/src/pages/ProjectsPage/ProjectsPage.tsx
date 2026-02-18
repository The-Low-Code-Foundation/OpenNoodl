/**
 * ProjectsPage - Entry point for the launcher dashboard
 *
 * This page displays the new React-based Launcher component
 * with horizontal tab navigation.
 */

import { ipcRenderer, shell } from 'electron';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { clone } from '@noodl/git/src/core/clone';
import { filesystem } from '@noodl/platform';

import { CreateProjectModal } from '@noodl-core-ui/preview/launcher/Launcher/components/CreateProjectModal';
import {
  CloudSyncType,
  LauncherProjectData
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherProjectCard';
import {
  useGitHubRepos,
  NoodlGitHubRepo,
  GitHubClientInterface
} from '@noodl-core-ui/preview/launcher/Launcher/hooks/useGitHubRepos';
import { Launcher } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';

import { useEventListener } from '../../hooks/useEventListener';
import { DialogLayerModel } from '../../models/DialogLayerModel';
import { detectRuntimeVersion } from '../../models/migration/ProjectScanner';
import { getAllPresets, setPendingPresetId } from '../../models/StylePresets';
import { IRouteProps } from '../../pages/AppRoute';
import { GitHubOAuthService, GitHubClient } from '../../services/github';
import { ProjectOrganizationService } from '../../services/ProjectOrganizationService';
import { LocalProjectsModel, ProjectItemWithRuntime } from '../../utils/LocalProjectsModel';
import { tracker } from '../../utils/tracker';
import { MigrationWizard } from '../../views/migration/MigrationWizard';
import { ToastLayer } from '../../views/ToastLayer/ToastLayer';

export interface ProjectsPageProps extends IRouteProps {
  from: TSFixme;
}

/** Built-in presets computed once at module level — never changes at runtime. */
const STYLE_PRESETS = getAllPresets();

/**
 * Map LocalProjectsModel ProjectItemWithRuntime to LauncherProjectData format
 */
function mapProjectToLauncherData(project: ProjectItemWithRuntime): LauncherProjectData {
  return {
    id: project.id,
    title: project.name || 'Untitled',
    localPath: project.retainedProjectDirectory,
    lastOpened: new Date(project.latestAccessed).toISOString(),
    imageSrc: project.thumbURI || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E',
    cloudSyncMeta: {
      type: CloudSyncType.None // TODO: Detect git repos in future
    },
    // Include runtime info for legacy detection
    runtimeInfo: project.runtimeInfo
    // Git-related fields will be populated in future tasks
  };
}

export function ProjectsPage(props: ProjectsPageProps) {
  // Real projects from LocalProjectsModel
  const [realProjects, setRealProjects] = useState<LauncherProjectData[]>([]);

  // Create project modal state
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

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

        // Now detect runtime and follow the same flow as handleOpenProject
        const runtimeActivityId = 'checking-compatibility';
        ToastLayer.showActivity('Checking project compatibility...', runtimeActivityId);

        try {
          const runtimeInfo = await detectRuntimeVersion(clonePath);
          ToastLayer.hideActivity(runtimeActivityId);

          console.log('🔵 [handleCloneRepo] Runtime detected:', runtimeInfo);

          // If legacy or unknown, show warning dialog
          if (runtimeInfo.version === 'react17' || runtimeInfo.version === 'unknown') {
            const projectName = repo.name;

            // Show legacy project warning dialog
            const userChoice = await new Promise<'migrate' | 'readonly' | 'cancel'>((resolve) => {
              const confirmed = confirm(
                `⚠️  Legacy Project Detected\n\n` +
                  `This project "${projectName}" was created with an earlier version of Noodl (React 17).\n\n` +
                  `OpenNoodl uses React 19, which requires migrating your project to ensure compatibility.\n\n` +
                  `What would you like to do?\n\n` +
                  `OK - Migrate Project (Recommended)\n` +
                  `Cancel - View options`
              );

              if (confirmed) {
                resolve('migrate');
              } else {
                // Show second dialog for Read-Only or Cancel
                const openReadOnly = confirm(
                  `Would you like to open this project in Read-Only mode?\n\n` +
                    `You can inspect the project safely without making changes.\n\n` +
                    `OK - Open Read-Only\n` +
                    `Cancel - Return to launcher`
                );

                if (openReadOnly) {
                  resolve('readonly');
                } else {
                  resolve('cancel');
                }
              }
            });

            console.log('🔵 [handleCloneRepo] User choice:', userChoice);

            if (userChoice === 'cancel') {
              // Add to projects list but don't open
              await LocalProjectsModel.instance.openProjectFromFolder(clonePath);
              await LocalProjectsModel.instance.fetch();
              LocalProjectsModel.instance.detectAllProjectRuntimes();
              ToastLayer.showSuccess(`Project "${repo.name}" added to your projects.`);
              return;
            }

            if (userChoice === 'migrate') {
              // Launch migration wizard
              tracker.track('Legacy Project Migration Started from Clone', { projectName });

              DialogLayerModel.instance.showDialog(
                (close) =>
                  React.createElement(MigrationWizard, {
                    sourcePath: clonePath,
                    projectName,
                    onComplete: async (targetPath: string) => {
                      close();

                      const migrateActivityId = 'opening-migrated';
                      ToastLayer.showActivity('Opening migrated project', migrateActivityId);

                      try {
                        const migratedProject = await LocalProjectsModel.instance.openProjectFromFolder(targetPath);

                        if (!migratedProject.name) {
                          migratedProject.name = projectName + ' (React 19)';
                        }

                        await LocalProjectsModel.instance.fetch();
                        await LocalProjectsModel.instance.detectProjectRuntime(targetPath);
                        LocalProjectsModel.instance.detectAllProjectRuntimes();

                        const projects = LocalProjectsModel.instance.getProjects();
                        const projectEntry = projects.find((p) => p.id === migratedProject.id);

                        if (projectEntry) {
                          const loaded = await LocalProjectsModel.instance.loadProject(projectEntry);
                          ToastLayer.hideActivity(migrateActivityId);

                          if (loaded) {
                            ToastLayer.showSuccess('Project migrated and opened successfully!');
                            props.route.router.route({ to: 'editor', project: loaded });
                          }
                        }
                      } catch (error) {
                        ToastLayer.hideActivity(migrateActivityId);
                        ToastLayer.showError('Could not open migrated project');
                        console.error(error);
                      }
                    },
                    onCancel: () => {
                      close();
                    }
                  }),
                {
                  onClose: () => {
                    LocalProjectsModel.instance.fetch();
                  }
                }
              );

              return;
            }

            // Read-only mode
            tracker.track('Legacy Project Opened Read-Only from Clone', { projectName });

            const readOnlyActivityId = 'opening-project-readonly';
            ToastLayer.showActivity('Opening project in read-only mode', readOnlyActivityId);

            const readOnlyProject = await LocalProjectsModel.instance.openProjectFromFolder(clonePath);

            if (!readOnlyProject) {
              ToastLayer.hideActivity(readOnlyActivityId);
              ToastLayer.showError('Could not open project');
              return;
            }

            if (!readOnlyProject.name) {
              readOnlyProject.name = repo.name;
            }

            const readOnlyProjects = LocalProjectsModel.instance.getProjects();
            const readOnlyProjectEntry = readOnlyProjects.find((p) => p.id === readOnlyProject.id);

            if (!readOnlyProjectEntry) {
              ToastLayer.hideActivity(readOnlyActivityId);
              ToastLayer.showError('Could not find project in recent list');
              return;
            }

            const loadedReadOnly = await LocalProjectsModel.instance.loadProject(readOnlyProjectEntry);
            ToastLayer.hideActivity(readOnlyActivityId);

            if (!loadedReadOnly) {
              ToastLayer.showError('Could not load project');
              return;
            }

            ToastLayer.showError('⚠️  READ-ONLY MODE - No changes will be saved to this legacy project');
            props.route.router.route({ to: 'editor', project: loadedReadOnly, readOnly: true });
            return;
          }
        } catch (error) {
          ToastLayer.hideActivity(runtimeActivityId);
          console.error('Failed to detect runtime:', error);
          // Continue with normal flow if detection fails
        }

        // Modern project - add to list and ask to open
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
    setIsCreateModalVisible(true);
  }, []);

  const handleChooseLocation = useCallback(async (): Promise<string | null> => {
    try {
      const direntry = await filesystem.openDialog({
        allowCreateDirectory: true
      });
      return direntry || null;
    } catch (error) {
      console.error('Failed to choose location:', error);
      return null;
    }
  }, []);

  const handleCreateProjectConfirm = useCallback(
    async (name: string, location: string, presetId: string) => {
      setIsCreateModalVisible(false);

      // Store the chosen preset — StyleTokensModel will consume it on editor startup.
      setPendingPresetId(presetId);

      try {
        const path = filesystem.makeUniquePath(filesystem.join(location, name));

        const activityId = 'creating-project';
        ToastLayer.showActivity('Creating new project', activityId);

        LocalProjectsModel.instance.newProject(
          (project) => {
            ToastLayer.hideActivity(activityId);
            if (!project) {
              // Clear pending preset if project creation failed
              setPendingPresetId(null);
              ToastLayer.showError('Could not create project');
              return;
            }
            // Navigate to editor — StyleTokensModel will apply preset on load
            props.route.router.route({ to: 'editor', project });
          },
          { name, path, projectTemplate: '' }
        );
      } catch (error) {
        setPendingPresetId(null);
        console.error('Failed to create project:', error);
        ToastLayer.showError('Failed to create project');
      }
    },
    [props.route]
  );

  const handleCreateModalClose = useCallback(() => {
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

      // Check if this project is already in the list
      const existingProjects = LocalProjectsModel.instance.getProjects();
      const isExisting = existingProjects.some((p) => p.retainedProjectDirectory === direntry);

      // If project is new, check for legacy runtime before opening
      if (!isExisting) {
        console.log('🔵 [handleOpenProject] New project detected, checking runtime...');
        const activityId = 'checking-compatibility';
        ToastLayer.showActivity('Checking project compatibility...', activityId);

        try {
          const runtimeInfo = await detectRuntimeVersion(direntry);
          ToastLayer.hideActivity(activityId);

          console.log('🔵 [handleOpenProject] Runtime detected:', runtimeInfo);

          // If legacy or unknown, show warning dialog
          if (runtimeInfo.version === 'react17' || runtimeInfo.version === 'unknown') {
            const projectName = filesystem.basename(direntry);

            // Show legacy project warning dialog
            const userChoice = await new Promise<'migrate' | 'readonly' | 'cancel'>((resolve) => {
              const confirmed = confirm(
                `⚠️  Legacy Project Detected\n\n` +
                  `This project "${projectName}" was created with an earlier version of Noodl (React 17).\n\n` +
                  `OpenNoodl uses React 19, which requires migrating your project to ensure compatibility.\n\n` +
                  `What would you like to do?\n\n` +
                  `OK - Migrate Project (Recommended)\n` +
                  `Cancel - View options`
              );

              if (confirmed) {
                resolve('migrate');
              } else {
                // Show second dialog for Read-Only or Cancel
                const openReadOnly = confirm(
                  `Would you like to open this project in Read-Only mode?\n\n` +
                    `You can inspect the project safely without making changes.\n\n` +
                    `OK - Open Read-Only\n` +
                    `Cancel - Return to launcher`
                );

                if (openReadOnly) {
                  resolve('readonly');
                } else {
                  resolve('cancel');
                }
              }
            });

            console.log('🔵 [handleOpenProject] User choice:', userChoice);

            if (userChoice === 'cancel') {
              console.log('🔵 [handleOpenProject] User cancelled');
              return;
            }

            if (userChoice === 'migrate') {
              // Launch migration wizard
              tracker.track('Legacy Project Migration Started from Open', {
                projectName
              });

              DialogLayerModel.instance.showDialog(
                (close) =>
                  React.createElement(MigrationWizard, {
                    sourcePath: direntry,
                    projectName,
                    onComplete: async (targetPath: string) => {
                      close();

                      const migrateActivityId = 'opening-migrated';
                      ToastLayer.showActivity('Opening migrated project', migrateActivityId);

                      try {
                        // Add migrated project and open it
                        const migratedProject = await LocalProjectsModel.instance.openProjectFromFolder(targetPath);

                        if (!migratedProject.name) {
                          migratedProject.name = projectName + ' (React 19)';
                        }

                        // Refresh and detect runtimes
                        await LocalProjectsModel.instance.fetch();
                        await LocalProjectsModel.instance.detectProjectRuntime(targetPath);
                        LocalProjectsModel.instance.detectAllProjectRuntimes();

                        const projects = LocalProjectsModel.instance.getProjects();
                        const projectEntry = projects.find((p) => p.id === migratedProject.id);

                        if (projectEntry) {
                          const loaded = await LocalProjectsModel.instance.loadProject(projectEntry);
                          ToastLayer.hideActivity(migrateActivityId);

                          if (loaded) {
                            ToastLayer.showSuccess('Project migrated and opened successfully!');
                            props.route.router.route({ to: 'editor', project: loaded });
                          }
                        }
                      } catch (error) {
                        ToastLayer.hideActivity(migrateActivityId);
                        ToastLayer.showError('Could not open migrated project');
                        console.error(error);
                      }
                    },
                    onCancel: () => {
                      close();
                    }
                  }),
                {
                  onClose: () => {
                    LocalProjectsModel.instance.fetch();
                  }
                }
              );

              return;
            }

            // If read-only, continue to open normally (will add to list with legacy badge)
            tracker.track('Legacy Project Opened Read-Only from Open', {
              projectName
            });

            // CRITICAL: Open the project in read-only mode
            const readOnlyActivityId = 'opening-project-readonly';
            ToastLayer.showActivity('Opening project in read-only mode', readOnlyActivityId);

            const readOnlyProject = await LocalProjectsModel.instance.openProjectFromFolder(direntry);

            if (!readOnlyProject) {
              ToastLayer.hideActivity(readOnlyActivityId);
              ToastLayer.showError('Could not open project');
              return;
            }

            if (!readOnlyProject.name) {
              readOnlyProject.name = filesystem.basename(direntry);
            }

            const readOnlyProjects = LocalProjectsModel.instance.getProjects();
            const readOnlyProjectEntry = readOnlyProjects.find((p) => p.id === readOnlyProject.id);

            if (!readOnlyProjectEntry) {
              ToastLayer.hideActivity(readOnlyActivityId);
              ToastLayer.showError('Could not find project in recent list');
              return;
            }

            const loadedReadOnly = await LocalProjectsModel.instance.loadProject(readOnlyProjectEntry);
            ToastLayer.hideActivity(readOnlyActivityId);

            if (!loadedReadOnly) {
              ToastLayer.showError('Could not load project');
              return;
            }

            // Show persistent warning toast (stays forever with Infinity default)
            ToastLayer.showError('⚠️  READ-ONLY MODE - No changes will be saved to this legacy project');

            // Route to editor with read-only flag
            props.route.router.route({ to: 'editor', project: loadedReadOnly, readOnly: true });
            return; // Exit early - don't continue to normal flow
          }
        } catch (error) {
          ToastLayer.hideActivity(activityId);
          console.error('Failed to detect runtime:', error);
          // Continue opening anyway if detection fails
        }
      }

      // Proceed with normal opening flow (non-legacy or legacy with migrate choice)
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
        ToastLayer.showError('Could not load project');
      } else {
        props.route.router.route({ to: 'editor', project: loaded });
      }
    } catch (error) {
      ToastLayer.hideActivity('opening-project');
      console.error('Failed to open project:', error);
      ToastLayer.showError('Could not open project');
    }
  }, [props.route]);

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
          ToastLayer.showError('Could not load project');
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
        ToastLayer.showError('⚠️  READ-ONLY MODE - No changes will be saved to this legacy project');

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
        projects={realProjects}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onLaunchProject={handleLaunchProject}
        onOpenProjectFolder={handleOpenProjectFolder}
        onDeleteProject={handleDeleteProject}
        onMigrateProject={handleMigrateProject}
        onOpenReadOnly={handleOpenReadOnly}
        projectOrganizationService={ProjectOrganizationService.instance}
        githubUser={githubUser}
        githubIsAuthenticated={githubIsAuthenticated}
        githubIsConnecting={githubIsConnecting}
        onGitHubConnect={handleGitHubConnect}
        onGitHubDisconnect={handleGitHubDisconnect}
        githubRepos={githubRepos}
        onCloneRepo={handleCloneRepo}
      />

      <CreateProjectModal
        isVisible={isCreateModalVisible}
        onClose={handleCreateModalClose}
        onConfirm={handleCreateProjectConfirm}
        onChooseLocation={handleChooseLocation}
        presets={STYLE_PRESETS}
      />
    </>
  );
}
