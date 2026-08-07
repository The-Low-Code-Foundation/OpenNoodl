import type { Meta, StoryObj } from '@storybook/react';

import { ToggleSwitch } from './ToggleSwitch';

const meta: Meta<typeof ToggleSwitch> = {
  title: 'Inputs/Toggle Switch',
  component: ToggleSwitch,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
