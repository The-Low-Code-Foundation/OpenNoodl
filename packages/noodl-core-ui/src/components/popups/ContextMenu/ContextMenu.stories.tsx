import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  ContextMenu,
  ContextMenuProps
} from '@noodl-core-ui/components/popups/ContextMenu/ContextMenu';
import { IconName } from '@noodl-core-ui/components/common/Icon';

const meta: Meta<typeof ContextMenu> = {
  title: 'Popups/Context Menu',
  component: ContextMenu,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args: ContextMenuProps) => (
  <div style={{ width: '100vw', height: '100vh' }}>
    <ContextMenu {...args} />
  </div>
);

export const Common: Story = {
  args: {
  menuItems: [
    {
      label: 'Action',
      icon: IconName.Plus
    },
    {
      label: 'Another Action'
    },
    'divider',
    {
      label: 'Success'
    },
    {
      label: 'Danger',
      isDangerous: true
    },
    {
      label: 'Copy Me',
      icon: IconName.Copy
    },
    {
      label: 'With subtitle',
      endSlot: 'Subtitle goes here'
    }
  ]
},
};
