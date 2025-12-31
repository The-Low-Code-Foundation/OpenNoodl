/**
 * TabBar - Storybook Stories
 */

import { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import { TabBar, TabBarItem } from './TabBar';

const meta: Meta<typeof TabBar> = {
  title: 'Layout/TabBar',
  component: TabBar,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof TabBar>;

// Basic tabs without icons
const basicItems: TabBarItem[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'learn', label: 'Learn' },
  { id: 'templates', label: 'Templates' }
];

// Tabs with icons
const iconItems: TabBarItem[] = [
  { id: 'projects', label: 'Projects', icon: IconName.Folder },
  { id: 'learn', label: 'Learn', icon: IconName.Book },
  { id: 'templates', label: 'Templates', icon: IconName.Components }
];

// Tabs with disabled state
const disabledItems: TabBarItem[] = [
  { id: 'projects', label: 'Projects', icon: IconName.Folder },
  { id: 'learn', label: 'Learn', icon: IconName.Book },
  { id: 'templates', label: 'Templates', icon: IconName.Components, disabled: true },
  { id: 'marketplace', label: 'Marketplace', icon: IconName.Package, disabled: true }
];

// Interactive wrapper for stories
function TabBarDemo({ items, size }: { items: TabBarItem[]; size?: 'small' | 'medium' | 'large' }) {
  const [activeId, setActiveId] = useState(items[0].id);

  return (
    <div>
      <TabBar items={items} activeItemId={activeId} onChange={setActiveId} size={size} />
      <div style={{ padding: '20px', color: 'var(--theme-color-fg-default)' }}>
        <strong>Active Tab:</strong> {activeId}
      </div>
    </div>
  );
}

export const Basic: Story = {
  render: () => <TabBarDemo items={basicItems} />
};

export const WithIcons: Story = {
  render: () => <TabBarDemo items={iconItems} />
};

export const WithDisabled: Story = {
  render: () => <TabBarDemo items={disabledItems} />
};

export const SmallSize: Story = {
  render: () => <TabBarDemo items={iconItems} size="small" />
};

export const MediumSize: Story = {
  render: () => <TabBarDemo items={iconItems} size="medium" />
};

export const LargeSize: Story = {
  render: () => <TabBarDemo items={iconItems} size="large" />
};

export const ManyTabs: Story = {
  render: () => {
    const manyItems: TabBarItem[] = [
      { id: '1', label: 'Projects', icon: IconName.Folder },
      { id: '2', label: 'Learn', icon: IconName.Book },
      { id: '3', label: 'Templates', icon: IconName.Components },
      { id: '4', label: 'Marketplace', icon: IconName.Package },
      { id: '5', label: 'Settings', icon: IconName.Settings },
      { id: '6', label: 'Help', icon: IconName.Question }
    ];
    return <TabBarDemo items={manyItems} />;
  }
};

export const KeyboardNavigation: Story = {
  render: () => (
    <div>
      <TabBarDemo items={iconItems} />
      <div style={{ padding: '20px', color: 'var(--theme-color-fg-default-shy)', fontSize: '13px' }}>
        <p>
          <strong>Keyboard shortcuts:</strong>
        </p>
        <ul>
          <li>Arrow Left/Right: Navigate between tabs</li>
          <li>Home: Go to first tab</li>
          <li>End: Go to last tab</li>
          <li>Tab: Focus next element</li>
        </ul>
      </div>
    </div>
  )
};
