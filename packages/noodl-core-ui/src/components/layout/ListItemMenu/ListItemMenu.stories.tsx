import type { Meta, StoryObj } from '@storybook/react';

import { ListItemMenu } from './ListItemMenu';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { ListItemVariant } from '@noodl-core-ui/components/layout/ListItem/ListItem';

const meta: Meta<typeof ListItemMenu> = {
  title: 'Layout/List Item Menu',
  component: ListItemMenu,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <ListItemMenu {...args} />
  </div>
);

export const Common: Story = {
  args: {
  icon: IconName.Home,
  text: 'Home',
  menuItems: [
    {
      label: `Compare with main`
    },
    {
      label: `Merge into menu`
    },
    {
      label: 'Delete'
    }
  ]
},
};

export const ShyWithIcon: Story = {
  args: {
  variant: ListItemVariant.Shy,
  icon: IconName.Home,
  text: 'Home',
  menuIcon: IconName.ImportDown,
  menuItems: []
},
};
