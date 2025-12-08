import type { Meta, StoryObj } from '@storybook/react';

import { ActivityIndicator } from './ActivityIndicator';

const meta: Meta<typeof ActivityIndicator> = {
  title: 'Common/Activity Indicator',
  component: ActivityIndicator,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <ActivityIndicator {...args} />
);

export const Common: Story = {
  args: {},
};
