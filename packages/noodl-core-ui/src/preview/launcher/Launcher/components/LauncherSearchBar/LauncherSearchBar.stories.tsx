import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { LauncherSearchBar } from './LauncherSearchBar';

const meta: Meta<typeof LauncherSearchBar> = {
  title: 'CATEGORY_HERE/LauncherSearchBar',
  component: LauncherSearchBar,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;



export const Common: Story = {
  args: {},
};
