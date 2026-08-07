import type { Meta, StoryObj } from '@storybook/react';

import { TagButton } from './TagButton';

const meta: Meta<typeof TagButton> = {
  title: 'Inputs/Tag Button',
  component: TagButton,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
    label: 'Hello World',
  },
};
