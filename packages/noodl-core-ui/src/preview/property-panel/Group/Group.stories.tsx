import type { Meta, StoryObj } from '@storybook/react';

import { Group } from './Group';

const meta: Meta<typeof Group> = {
  title: 'Preview/Property Panel/[WIP] Group',
  component: Group,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => <Group></Group>;

export const Primary: Story = {
  args: {},
};
