import type { Meta, StoryObj } from '@storybook/react';

import { Portal } from './Portal';

const meta: Meta<typeof Portal> = {
  title: 'Layout/Portal',
  component: Portal,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
  portalRoot: document.querySelector('.dialog-layer-portal-target')
},
};
