import type { Meta, StoryObj } from '@storybook/react';

import { UserBadge, UserBadgeSize } from './UserBadge';

const meta: Meta<typeof UserBadge> = {
  title: 'User/User Badge',
  component: UserBadge,
  argTypes: {
    name: { control: 'text' },
    email: { control: 'text' },
    id: { control: 'text' }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
  name: 'John Doe',
  email: 'john@noodl.net',
  id: '20'
},
};

export const SizeMedium: Story = {
  args: {
  name: 'John Doe',
  email: 'john@noodl.net',
  id: '20',
  size: UserBadgeSize.Medium
},
};

export const SizeSmall: Story = {
  args: {
  name: 'John Doe',
  email: 'john@noodl.net',
  id: '20',
  size: UserBadgeSize.Small
},
};

export const TinySmall: Story = {
  args: {
  name: 'John Doe',
  email: 'john@noodl.net',
  id: '20',
  size: UserBadgeSize.Tiny
},
};
