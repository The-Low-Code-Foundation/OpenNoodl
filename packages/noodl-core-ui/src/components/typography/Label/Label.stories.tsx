import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Label } from './Label';

const meta: Meta<typeof Label> = {
  title: 'Typography/Label',
  component: Label,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <>
    <p>
      This component is a work in progress and will be rolled out in the future to replace Title and
      Text in a few instances
    </p>
    <Label {...args} />
  </>
);

export const Common: Story = {
  args: {},
};
