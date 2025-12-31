import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { CloudSyncType, LauncherProjectData } from '../LauncherProjectCard';
import { ProjectList } from './ProjectList';

const meta: Meta<typeof ProjectList> = {
  title: 'Preview/Launcher/ProjectList',
  component: ProjectList,
  parameters: {
    layout: 'padded'
  }
};

export default meta;
type Story = StoryObj<typeof ProjectList>;

// Mock project data
const mockProjects: LauncherProjectData[] = [
  {
    id: '1',
    title: 'E-commerce Platform',
    localPath: '/Users/developer/projects/ecommerce-app',
    lastOpened: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://github.com/company/ecommerce'
    },
    pushAmount: 3,
    pullAmount: 0,
    uncommittedChangesAmount: 2,
    imageSrc: 'https://via.placeholder.com/100x80'
  },
  {
    id: '2',
    title: 'Mobile Dashboard',
    localPath: '/Users/developer/projects/mobile-dashboard',
    lastOpened: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://github.com/company/dashboard'
    },
    pushAmount: 0,
    pullAmount: 5,
    uncommittedChangesAmount: 0,
    imageSrc: 'https://via.placeholder.com/100x80'
  },
  {
    id: '3',
    title: 'Marketing Website',
    localPath: '/Users/developer/projects/marketing-site',
    lastOpened: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://github.com/company/marketing'
    },
    pushAmount: 0,
    pullAmount: 0,
    uncommittedChangesAmount: 0,
    imageSrc: 'https://via.placeholder.com/100x80'
  },
  {
    id: '4',
    title: 'Local Prototype',
    localPath: '/Users/developer/projects/prototype',
    lastOpened: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    cloudSyncMeta: {
      type: CloudSyncType.None
    },
    imageSrc: 'https://via.placeholder.com/100x80'
  },
  {
    id: '5',
    title: 'Admin Panel',
    localPath: '/Users/developer/projects/admin-panel',
    lastOpened: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    cloudSyncMeta: {
      type: CloudSyncType.Git,
      source: 'https://github.com/company/admin'
    },
    pushAmount: 2,
    pullAmount: 1,
    uncommittedChangesAmount: 0,
    imageSrc: 'https://via.placeholder.com/100x80'
  }
];

export const Default: Story = {
  args: {
    projects: mockProjects,
    sortField: 'lastModified',
    sortDirection: 'desc',
    onSort: (field) => console.log('Sort by:', field),
    onProjectClick: (project) => console.log('Open project:', project.title),
    onOpenFolder: (project) => console.log('Open folder:', project.localPath),
    onSettings: (project) => console.log('Settings for:', project.title),
    onDelete: (project) => console.log('Delete:', project.title)
  }
};

export const SortedByName: Story = {
  args: {
    ...Default.args,
    sortField: 'name',
    sortDirection: 'asc'
  }
};

export const SortedByGitStatus: Story = {
  args: {
    ...Default.args,
    sortField: 'gitStatus',
    sortDirection: 'asc'
  }
};

export const Empty: Story = {
  args: {
    ...Default.args,
    projects: []
  }
};

export const SingleProject: Story = {
  args: {
    ...Default.args,
    projects: [mockProjects[0]]
  }
};
