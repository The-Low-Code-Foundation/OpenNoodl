import type { Meta, StoryObj } from '@storybook/react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PopupToolbar, PopupToolbarProps } from '@noodl-core-ui/components/popups/PopupToolbar/PopupToolbar';

const meta: Meta<typeof PopupToolbar> = {
  title: 'Popups/PopupToolbar',
  component: PopupToolbar,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args: PopupToolbarProps) => (
  <div style={{ width: '100vw', height: '100vh' }}>
    <PopupToolbar {...args} />
  </div>
);

export const Common: Story = {
  args: {
  menuItems: [
    {
      tooltip: 'Action',
      icon: IconName.Plus
    },
    {
      tooltip: 'Action',
      icon: IconName.Plus
    }
  ],
  contextMenuItems: [
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

export const NoContextMenu: Story = {
  args: {
  menuItems: [
    {
      tooltip: 'Action',
      icon: IconName.Plus
    },
    {
      tooltip: 'Action',
      icon: IconName.Plus
    }
  ]
},
};
