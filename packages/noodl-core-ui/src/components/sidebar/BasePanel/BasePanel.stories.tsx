import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { BasePanel } from './BasePanel';

const meta: Meta<typeof BasePanel> = {
  title: 'Sidebar/Base Panel',
  component: BasePanel,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <BasePanel {...args} />
  </div>
);

export const Common: Story = {
  args: {
  title: 'Common'
},
};

export const WithFooter: Story = {
  args: {
  title: 'Common',
  children: 'Children',
  footerSlot: 'Footer'
},
};
