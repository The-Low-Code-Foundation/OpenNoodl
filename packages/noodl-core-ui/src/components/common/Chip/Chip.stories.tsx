import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Chip, ChipVariant } from './Chip';

const meta: Meta<typeof Chip> = {
  title: 'Common/Chip',
  component: Chip,
  argTypes: {
    variant: {
      control: 'select',
      options: Object.values(ChipVariant)
    }
  }
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
    label: 'Local only',
    variant: ChipVariant.Neutral
  }
};

export const AllVariants = () => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    <Chip label="Local only" variant={ChipVariant.Neutral} />
    <Chip label="Connected" variant={ChipVariant.Accent} />
    <Chip label="React 17 runtime" variant={ChipVariant.Warning} />
    <Chip label="Failed" variant={ChipVariant.Danger} />
    <Chip label="Deployed" variant={ChipVariant.Success} />
  </div>
);
