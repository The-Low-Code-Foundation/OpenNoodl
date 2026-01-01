/**
 * ProjectsPage - Entry point for the launcher dashboard
 *
 * This page displays the new React-based Launcher component
 * with horizontal tab navigation.
 */

import { ipcRenderer, shell } from 'electron';
import React, { useCallback, useEffect, useState } from 'react';
import { filesystem } from '@noodl/platform';

import {
  CloudSyncType,
  LauncherProjectData
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherProjectCard';
import { Launcher } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';
import { GitHubUser } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import { useEventListener } from '../../hooks/useEventListener';
import { IRouteProps } from '../../pages/AppRoute';
import { GitHubOAuthService } from '../../services/GitHubOAuthService';
import { LocalProjectsModel, ProjectItem } from '../../utils/LocalProjectsModel';
import { ToastLayer } from '../../views/ToastLayer/ToastLayer';

export interface ProjectsPageProps extends IRouteProps {
  from: TSFixme;
}

/**
 * Map LocalProjectsModel ProjectItem to LauncherProjectData format
 */
function mapProjectToLauncherData(project: ProjectItem): LauncherProjectData {
  return {
    id: project.id,
    title: project.name || 'Untitled',
    localPath: project.retainedProjectDirectory,
    lastOpened: new Date(project.latestAccessed).toISOString(),
    imageSrc: project.thumbURI || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E',
    cloudSyncMeta: {
      type: CloudSyncType.None // TODO: Detect git repos in future
    }
    // Git-related fields will be populated in future tasks
  };
}

export function ProjectsPage(props: ProjectsPageProps) {
  // Real projects from LocalProjectsModel
  const [realProjects, setRealProjects] = useState<LauncherProjectData[]>([]);

  // GitHub OAuth state
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubIsAuthenticated, setGithubIsAuthenticated] = useState<boolean>(false);
  const [githubIsConnecting, setGithubIsConnecting] = useState<boolean>(false);

  // Initialize and fetch projects on mount
  useEffect(() => {
    // Switch main window size to editor size
    ipcRenderer.send('main-window-resize', { size: 'editor', center: true });

    // Initialize GitHub OAuth service
    const initGitHub = async () => {
      console.log('🔧 Initializing GitHub OAuth service...');
      await GitHubOAuthService.instance.initialize();
      const user = GitHubOAuthService.instance.getCurrentUser();
      const isAuth = GitHubOAuthService.instance.isAuthenticated();
      setGithubUser(user);
      setGithubIsAuthenticated(isAuth);
      console.log('✅ GitHub OAuth initialized. Authenticated:', isAuth);
    };

    // Load projects
    const loadProjects = async () => {
      await LocalProjectsModel.instance.fetch();
      const projects = LocalProjectsModel.instance.getProjects();
      setRealProjects(projects.map(mapProjectToLauncherData));
    };

    initGitHub();
    loadProjects();

    // Set up IPC listener for OAuth callback
    const handleOAuthCallback = (_event: any, { code, state }: { code: string; state: string }) => {
      console.log('🔄 Received GitHub OAuth callback from main process');
      setGithubIsConnecting(true);
      GitHubOAuthService.instance
        .handleCallback(code, state)
        .then(() => {
          console.log('✅ OAuth callback handled successfully');
          setGithubIsConnecting(false);
        })
        .catch((error) => {
          console.error('❌ OAuth callback failed:', error);
          setGithubIsConnecting(false);
          ToastLayer.showError('GitHub authentication failed');
        });
    };

    ipcRenderer.on('github-oauth-callback', handleOAuthCallback);

    return () => {
      ipcRenderer.removeListener('github-oauth-callback', handleOAuthCallback);
    };
  }, []);

  // Subscribe to project list changes
  useEventListener(LocalProjectsModel.instance, 'myProjectsChanged', () => {
    console.log('🔔 Projects list changed, updating dashboard');
    const projects = LocalProjectsModel.instance.getProjects();
    setRealProjects(projects.map(mapProjectToLauncherData));
  });

  // Subscribe to GitHub OAuth state changes
  useEventListener(GitHubOAuthService.instance, 'oauth-success', (data: { user: GitHubUser }) => {
    console.log('🎉 GitHub OAuth success:', data.user.login);
    setGithubUser(data.user);
    setGithubIsAuthenticated(true);
    setGithubIsConnecting(false);
    ToastLayer.showSuccess(`Connected to GitHub as ${data.user.login}`);
  });

  useEventListener(GitHubOAuthService.instance, 'auth-state-changed', (data: { authenticated: boolean }) => {
    console.log('🔐 GitHub auth state changed:', data.authenticated);
    setGithubIsAuthenticated(data.authenticated);
    if (data.authenticated) {
      const user = GitHubOAuthService.instance.getCurrentUser();
      setGithubUser(user);
    } else {
      setGithubUser(null);
    }
  });

  useEventListener(GitHubOAuthService.instance, 'oauth-started', () => {
    console.log('🚀 GitHub OAuth flow started');
    setGithubIsConnecting(true);
  });

  useEventListener(GitHubOAuthService.instance, 'oauth-error', (data: { error: string }) => {
    console.error('❌ GitHub OAuth error:', data.error);
    setGithubIsConnecting(false);
    ToastLayer.showError(`GitHub authentication failed: ${data.error}`);
  });

  useEventListener(GitHubOAuthService.instance, 'disconnected', () => {
    console.log('👋 GitHub disconnected');
    setGithubUser(null);
    setGithubIsAuthenticated(false);
    ToastLayer.showSuccess('Disconnected from GitHub');
  });

  const handleCreateProject = useCallback(async () => {
    try {
      const direntry = await filesystem.openDialog({
        allowCreateDirectory: true
      });
      if (!direntry) return;

      // For now, use a simple prompt for project name
      // TODO: Replace with a proper React dialog in future
      const name = prompt('Project name:');
      if (!name) return;

      const path = filesystem.makeUniquePath(filesystem.join(direntry, name));

      const activityId = 'creating-project';
      ToastLayer.showActivity('Creating new project', activityId);

      LocalProjectsModel.instance.newProject(
        (project) => {
          ToastLayer.hideActivity(activityId);
          if (!project) {
            ToastLayer.showError('Could not create project');
            return;
          }
          // Navigate to editor with the newly created project
          props.route.router.route({ to: 'editor', project });
        },
        { name, path, projectTemplate: '' }
      );
    } catch (error) {
      console.error('Failed to create project:', error);
      ToastLayer.showError('Failed to create project');
    }
  }, [props.route]);

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

      const activityId = 'opening-project';
      console.log('🔵 [handleOpenProject] Showing activity toast');
      ToastLayer.showActivity('Opening project', activityId);

      console.log('🔵 [handleOpenProject] Calling openProjectFromFolder...');
      // openProjectFromFolder adds the project to recent list and returns ProjectModel
      const project = await LocalProjectsModel.instance.openProjectFromFolder(direntry);
      console.log('🔵 [handleOpenProject] Got project:', project);

      if (!project) {
        console.log('🔴 [handleOpenProject] Project is null/undefined');
        ToastLayer.hideActivity(activityId);
        ToastLayer.showError('Could not open project');
        return;
      }

      if (!project.name) {
        console.log('🔵 [handleOpenProject] Setting project name from folder');
        project.name = filesystem.basename(direntry);
      }

      console.log('🔵 [handleOpenProject] Getting projects list...');
      // Now we need to find the project entry that was just added and load it
      const projects = LocalProjectsModel.instance.getProjects();
      console.log('🔵 [handleOpenProject] Projects in list:', projects.length);

      const projectEntry = projects.find((p) => p.id === project.id);
      console.log('🔵 [handleOpenProject] Found project entry:', projectEntry);

      if (!projectEntry) {
        console.log('🔴 [handleOpenProject] Project entry not found in list');
        ToastLayer.hideActivity(activityId);
        ToastLayer.showError('Could not find project in recent list');
        console.error('Project was added but not found in list:', project.id);
        return;
      }

      console.log('🔵 [handleOpenProject] Loading project...');
      // Actually load/open the project
      const loaded = await LocalProjectsModel.instance.loadProject(projectEntry);
      console.log('🔵 [handleOpenProject] Project loaded:', loaded);

      ToastLayer.hideActivity(activityId);

      if (!loaded) {
        console.log('🔴 [handleOpenProject] Load result is falsy');
        ToastLayer.showError('Could not load project');
      } else {
        console.log('✅ [handleOpenProject] Success! Navigating to editor...');
        // Navigate to editor with the loaded project
        props.route.router.route({ to: 'editor', project: loaded });
      }
    } catch (error) {
      console.error('🔴 [handleOpenProject] EXCEPTION:', error);
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

  // GitHub OAuth handlers
  const handleGitHubConnect = useCallback(() => {
    console.log('🔗 Initiating GitHub OAuth...');
    GitHubOAuthService.instance.initiateOAuth();
  }, []);

  const handleGitHubDisconnect = useCallback(() => {
    console.log('🔌 Disconnecting GitHub...');
    GitHubOAuthService.instance.disconnect();
  }, []);

  return (
    <Launcher
      projects={realProjects}
      onCreateProject={handleCreateProject}
      onOpenProject={handleOpenProject}
      onLaunchProject={handleLaunchProject}
      onOpenProjectFolder={handleOpenProjectFolder}
      onDeleteProject={handleDeleteProject}
      githubUser={githubUser}
      githubIsAuthenticated={githubIsAuthenticated}
      githubIsConnecting={githubIsConnecting}
      onGitHubConnect={handleGitHubConnect}
      onGitHubDisconnect={handleGitHubDisconnect}
    />
  );
}
