import type { Meta, StoryObj } from '@storybook/react';

import { ToolbarGrip } from './ToolbarGrip';

const meta: Meta<typeof ToolbarGrip> = {
  title: 'Toolbar/Toolbar Grip',
  component: ToolbarGrip,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
