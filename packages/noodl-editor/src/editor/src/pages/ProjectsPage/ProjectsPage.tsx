/**
 * ProjectsPage - Entry point for the launcher dashboard
 *
 * This page displays the new React-based Launcher component
 * with horizontal tab navigation.
 */

import { ipcRenderer, shell } from 'electron';
import React, { useCallback, useEffect } from 'react';
import { filesystem } from '@noodl/platform';

import { Launcher } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';

import { IRouteProps } from '../../pages/AppRoute';
import { LocalProjectsModel } from '../../utils/LocalProjectsModel';
import { ToastLayer } from '../../views/ToastLayer/ToastLayer';

export interface ProjectsPageProps extends IRouteProps {
  from: TSFixme;
}

export function ProjectsPage(props: ProjectsPageProps) {
  useEffect(() => {
    // Switch main window size to editor size
    ipcRenderer.send('main-window-resize', { size: 'editor', center: true });
  }, []);

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

  return (
    <Launcher
      onCreateProject={handleCreateProject}
      onOpenProject={handleOpenProject}
      onLaunchProject={handleLaunchProject}
      onOpenProjectFolder={handleOpenProjectFolder}
      onDeleteProject={handleDeleteProject}
    />
  );
}
