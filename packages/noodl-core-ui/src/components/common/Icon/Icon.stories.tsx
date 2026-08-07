import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Icon, IconName } from './Icon';

const meta: Meta<typeof Icon> = {
  title: 'Common/Icon',
  component: Icon,
  argTypes: {
    icon: { control: 'select', options: IconName }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;



export const Common: Story = {
  args: {},
};
