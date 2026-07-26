/**
 * Launcher - Main dashboard for OpenNoodl
 *
 * Modern, clean tabbed interface for managing projects, learning resources,
 * and project templates.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { useEffect, useState } from 'react';

import { LauncherFooter } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherFooter';
import { LauncherHeader } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherHeader';
import {
  CloudSyncType,
  LauncherProjectData
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherProjectCard';
import { NoodlGitHubRepo, UseGitHubReposReturn } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useGitHubRepos';
import { usePersistentTab } from '@noodl-core-ui/preview/launcher/Launcher/hooks/usePersistentTab';
import {
  GitHubUser,
  LauncherLessonData,
  LauncherPageId,
  LauncherProvider
} from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';
import { GitHubRepos } from '@noodl-core-ui/preview/launcher/Launcher/views/GitHubRepos';
import { LearningCenter } from '@noodl-core-ui/preview/launcher/Launcher/views/LearningCenter';
import { Projects } from '@noodl-core-ui/preview/launcher/Launcher/views/Projects';
import { Templates } from '@noodl-core-ui/preview/launcher/Launcher/views/Templates';

import css from './Launcher.module.scss';

export interface LauncherProps {
  /**
   * Initial tab to open (for deep linking support)
   */
  initialTab?: LauncherPageId;
  /**
   * Optional real project data. If provided, user can toggle between mock and real data.
   */
  projects?: LauncherProjectData[];

  /** App version string for the footer wordmark (e.g. "0.1.0"). */
  appVersion?: string;

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

  // Project organization service (optional - for Storybook compatibility)
  projectOrganizationService?: any;

  // GitHub OAuth integration (optional - for Storybook compatibility)
  githubUser?: GitHubUser | null;
  githubIsAuthenticated?: boolean;
  githubIsConnecting?: boolean;
  onGitHubConnect?: () => void;
  onGitHubDisconnect?: () => void;

  // GitHub repos for clone feature (optional - for Storybook compatibility)
  githubRepos?: UseGitHubReposReturn | null;
  onCloneRepo?: (repo: NoodlGitHubRepo) => Promise<void>;
}

// FIXME: make the mock data real
export const MOCK_PROJECTS: LauncherProjectData[] = [
  {
    id: '1',
    title: 'My first project',
    imageSrc: 'http://placekitten.com/g/200/300',
    localPath: '/User/Desktop/dev/my-first-project',
    lastOpened: '2023-10-26T12:22:13.462Z',
    cloudSyncMeta: {
      type: CloudSyncType.None,
      source: undefined
    },
    uncommittedChangesAmount: undefined,
    pullAmount: undefined,
    pushAmount: undefined
  },
  {
    id: '2',
    title: 'External git project with push but no pull',
    imageSrc: 'http://placekitten.com/g/400/800',
    localPath: '/User/Desktop/dev/area-51-employee-portal/top-secret-version',
    lastOpened: '2023-10-23T12:42:13.462Z',
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://TESTHUB.com/org/testcompany/my-repo-project'
    },
    uncommittedChangesAmount: undefined,
    pullAmount: undefined,
    pushAmount: 666,
    contributors: [
      { email: 'tore@noodl.net', name: 'Tore Knudsen', id: 'Tore' },
      { email: 'eric@noodl.net', name: 'Eric Tuvesson', id: 'Eric' }
    ]
  },
  {
    id: '3',
    title: 'External git project with local changes',
    imageSrc: 'http://placekitten.com/g/500/500',
    localPath: '/User/Desktop/projects/my-git-repo',
    lastOpened: '2023-08-26T12:42:13.462Z',
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://TESTHUB.com/org/testcompany/my-repo-project'
    },
    uncommittedChangesAmount: 4,
    pullAmount: undefined,
    pushAmount: undefined,
    contributors: [
      { email: 'tore@noodl.net', name: 'Tore Knudsen', id: 'Tore' },
      { email: 'eric@noodl.net', name: 'Eric Tuvesson', id: 'Eric' },
      { email: 'michael@noodl.net', name: 'Michael Cartner', id: 'Michael' },
      { email: 'mikael@noodl.net', name: 'Mikael Tellhed', id: 'Mikael' },
      { email: 'anders@noodl.net', name: 'Anders Larsson', id: 'Anders' },
      { email: 'johan@noodl.net', name: 'Johan Olsson', id: 'Johan' },
      { email: 'victor@noodl.net', name: 'Victor Permild', id: 'Victor' },
      { email: 'kotte@noodl.net', name: 'Kotte Aistre', id: 'Kotte' }
    ]
  },
  {
    id: '4',
    title: 'Git project with all notifications',
    imageSrc: 'http://placekitten.com/g/100/100',
    localPath: '/User/Desktop/projects/forgotten-project',
    lastOpened: '2023-06-26T12:42:13.462Z',
    cloudSyncMeta: {
      type: CloudSyncType.Git
    },
    uncommittedChangesAmount: 10,
    pullAmount: 10,
    pushAmount: 4,
    contributors: [
      { email: 'tore@noodl.net', name: 'Tore Knudsen', id: 'Tore' },
      { email: 'eric@noodl.net', name: 'Eric Tuvesson', id: 'Eric' },
      { email: 'michael@noodl.net', name: 'Michael Cartner', id: 'Michael' },
      { email: 'victor@noodl.net', name: 'Victor Permild', id: 'Victor' }
    ]
  }
];

/**
 * Parse deep link URL to extract initial tab
 * Supports formats like: noodl://dashboard/learn, noodl://dashboard/templates
 */
function parseDeepLink(): LauncherPageId | null {
  try {
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split('/');
    const tabPart = pathParts[pathParts.length - 1];

    if (tabPart === 'projects' || tabPart === 'learn' || tabPart === 'templates') {
      return tabPart as LauncherPageId;
    }
  } catch (error) {
    // Ignore parsing errors
  }
  return null;
}

export function Launcher({
  initialTab,
  projects,
  appVersion,
  onCreateProject,
  onOpenProject,
  onLaunchProject,
  onOpenProjectFolder,
  onDeleteProject,
  onMigrateProject,
  onOpenReadOnly,
  lessons,
  onStartLesson,
  onRestartLesson,
  projectOrganizationService,
  githubUser,
  githubIsAuthenticated,
  githubIsConnecting,
  onGitHubConnect,
  onGitHubDisconnect,
  githubRepos,
  onCloneRepo
}: LauncherProps) {
  // Determine initial tab: props > deep link > persisted > default
  const deepLinkTab = parseDeepLink();
  const defaultTab: LauncherPageId = initialTab || deepLinkTab || 'projects';

  const [activePageId, setActivePageId] = usePersistentTab(defaultTab);

  // Mock data toggle state with localStorage persistence
  const [useMockData, setUseMockData] = useState<boolean>(() => {
    // Default to mock if no projects provided, otherwise check localStorage
    if (!projects) return true;

    try {
      const stored = localStorage.getItem('launcher:useMockData');
      return stored === 'true';
    } catch {
      return false; // Default to real data if provided
    }
  });

  // Folder selection state with localStorage persistence
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('launcher:selectedFolderId');
      return stored === 'null' ? null : stored;
    } catch {
      return null; // Default to "All Projects"
    }
  });

  // Persist mock data toggle
  useEffect(() => {
    if (projects) {
      try {
        localStorage.setItem('launcher:useMockData', String(useMockData));
      } catch (error) {
        console.warn('Failed to persist mock data preference:', error);
      }
    }
  }, [useMockData, projects]);

  // Persist folder selection
  useEffect(() => {
    try {
      localStorage.setItem('launcher:selectedFolderId', selectedFolderId === null ? 'null' : selectedFolderId);
    } catch (error) {
      console.warn('Failed to persist folder selection:', error);
    }
  }, [selectedFolderId]);

  // Determine which projects to use and if toggle should be available
  const hasRealProjects = Boolean(projects && projects.length > 0);
  const activeProjects = useMockData ? MOCK_PROJECTS : projects || MOCK_PROJECTS;

  // Update URL when tab changes (for deep linking support)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.pathname = `/dashboard/${activePageId}`;
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
      // Ignore URL update errors
    }
  }, [activePageId]);

  // Render active view
  const renderActiveView = () => {
    switch (activePageId) {
      case 'projects':
        return <Projects />;
      case 'github':
        return <GitHubRepos />;
      case 'learn':
        return <LearningCenter />;
      case 'templates':
        return <Templates />;
      default:
        return <Projects />;
    }
  };

  return (
    <LauncherProvider
      value={{
        activePageId,
        setActivePageId,
        useMockData,
        setUseMockData,
        projects: activeProjects,
        hasRealProjects,
        appVersion,
        selectedFolderId,
        setSelectedFolderId,
        projectOrganizationService,
        onCreateProject,
        onOpenProject,
        onLaunchProject,
        onOpenProjectFolder,
        onDeleteProject,
        onMigrateProject,
        onOpenReadOnly,
        lessons,
        onStartLesson,
        onRestartLesson,
        githubUser,
        githubIsAuthenticated,
        githubIsConnecting,
        onGitHubConnect,
        onGitHubDisconnect,
        githubRepos,
        onCloneRepo
      }}
    >
      <div className={css['Root']}>
        <LauncherHeader />

        <div className={css['ContentArea']}>{renderActiveView()}</div>

        <LauncherFooter />
      </div>
    </LauncherProvider>
  );
}
