import type { Meta, StoryObj } from '@storybook/react';

import { ToolbarButton } from './ToolbarButton';

const meta: Meta<typeof ToolbarButton> = {
  title: 'Toolbar/Toolbar Button',
  component: ToolbarButton,
  argTypes: {
    label: { control: 'text' },
    prefix: { control: 'slot' }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
  label: 'PRESS ME',
},
};
