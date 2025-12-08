import type { Meta, StoryObj } from '@storybook/react';

import { ListItem } from './ListItem';
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

const meta: Meta<typeof ListItem> = {
  title: 'Layout/List Item',
  component: ListItem,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <ListItem {...args} />
  </div>
);

export const Common: Story = {
  args: {
  icon: IconName.Home,
  text: 'Home'
},
};

export const isDisabled: Story = {
  args: {
  icon: IconName.Home,
  text: 'Home',
  isDisabled: true
},
};

export const withAffix: Story = {
  args: {
  icon: IconName.Home,
  text: 'Home',
  affix: <Icon icon={IconName.ImportDown} />
},
};
