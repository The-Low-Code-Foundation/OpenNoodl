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
      options: ['projects', 'learn', 'templates'],
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
