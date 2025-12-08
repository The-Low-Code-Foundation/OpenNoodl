import type { Meta, StoryObj } from '@storybook/react';

import { Launcher } from './Launcher';

const meta: Meta<typeof Launcher> = {
  title: 'Preview/Launcher/[WIP] Launcher',
  component: Launcher,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

</Launcher>;

export const Primary: Story = {
  args: {},
};
