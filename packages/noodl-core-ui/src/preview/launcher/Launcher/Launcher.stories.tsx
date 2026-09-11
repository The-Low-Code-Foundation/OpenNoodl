/**
 * Launcher - Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { CloudSyncType, LauncherProjectData } from './components/LauncherProjectCard';
import { Launcher } from './Launcher';

const meta: Meta<typeof Launcher> = {
  title: 'Preview/Launcher/Launcher',
  component: Launcher,
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    initialTab: {
      control: 'select',
      // ⚠️ `learn` and `learning` are different pages — see `LauncherPageId`.
      options: ['projects', 'learning', 'learn', 'templates'],
      description: 'Initial tab to display'
    }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

// Sample real projects for testing the data source toggle
const REAL_PROJECTS: LauncherProjectData[] = [
  {
    id: 'real-1',
    title: 'Production Dashboard',
    imageSrc: 'http://placekitten.com/g/300/300',
    localPath: '/Users/dev/production-dashboard',
    lastOpened: new Date().toISOString(),
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://github.com/myorg/production-dashboard'
    },
    uncommittedChangesAmount: undefined,
    pullAmount: undefined,
    pushAmount: undefined
  },
  {
    id: 'real-2',
    title: 'Customer Portal',
    imageSrc: 'http://placekitten.com/g/350/350',
    localPath: '/Users/dev/customer-portal',
    lastOpened: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://github.com/myorg/customer-portal'
    },
    uncommittedChangesAmount: 2,
    pullAmount: undefined,
    pushAmount: 1
  }
];

export const Default: Story = {
  args: {}
};

export const ProjectsTab: Story = {
  args: {
    initialTab: 'projects'
  }
};

/**
 * The Learning tab — UNI-007 / D5's installed lessons, which used to render
 * above the project grid and now has the header tab to itself.
 */
export const LearningTab: Story = {
  args: {
    initialTab: 'learning',
    learning: [
      {
        id: 'first-app',
        title: 'Build your first app',
        description: 'Pages, a router and a list, from an empty project.',
        provenance: 'curated',
        progressPercent: 60,
        state: 'in-progress'
      },
      {
        id: 'data-basics',
        title: 'Working with data',
        description: 'Static data, For Each, and a record you can edit.',
        provenance: 'local',
        progressPercent: 100,
        state: 'completed',
        score: 82,
        gradedBy: 'runner'
      }
    ],
    onInstallLearningLesson: () => undefined
  }
};

/** The empty Learning tab: the install route is the only thing to do in it. */
export const LearningTabEmpty: Story = {
  args: {
    initialTab: 'learning',
    learning: [],
    onInstallLearningLesson: () => undefined
  }
};

/** POL-002's retired lesson catalogue. Page id `'learn'`, reachable from no tab. */
export const LearnTab: Story = {
  args: {
    initialTab: 'learn'
  }
};

export const TemplatesTab: Story = {
  args: {
    initialTab: 'templates'
  }
};

/**
 * With Real Projects - Shows the data source toggle button
 *
 * When real projects are provided, a toggle button appears in the header
 * allowing users to switch between mock data and real project data.
 */
export const WithDataSourceToggle: Story = {
  args: {
    initialTab: 'projects',
    projects: REAL_PROJECTS
  }
};
