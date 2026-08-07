import type { Meta, StoryObj } from '@storybook/react';

import { Center } from './Center';

const meta: Meta<typeof Center> = {
  title: 'Layout/Center',
  component: Center,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
