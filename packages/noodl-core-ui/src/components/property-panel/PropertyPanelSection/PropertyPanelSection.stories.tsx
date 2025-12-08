import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { PropertyPanelSection } from './PropertyPanelSection';

const meta: Meta<typeof PropertyPanelSection> = {
  title: 'Property Panel/Property Panel Section',
  component: PropertyPanelSection,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;



export const Common: Story = {
  args: { title: 'Section title' },
};
