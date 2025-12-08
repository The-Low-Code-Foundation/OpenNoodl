import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'Inputs/Icon Button',
  component: IconButton,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <>
    <IconButton {...args} />
  </>
);

export const Common: Story = {
  args: {},
};
