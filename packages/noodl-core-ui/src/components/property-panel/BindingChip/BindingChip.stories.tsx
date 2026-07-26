import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { BindingChip } from './BindingChip';

const meta: Meta<typeof BindingChip> = {
  title: 'Property Panel/Binding Chip',
  component: BindingChip,
  argTypes: {}
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
    source: 'CallCF · Result'
  }
};

export const Generic: Story = {
  args: {}
};

export const Interactive: Story = {
  args: {
    source: 'CallCF · Result',
    onClick: () => alert('navigate to source')
  }
};
