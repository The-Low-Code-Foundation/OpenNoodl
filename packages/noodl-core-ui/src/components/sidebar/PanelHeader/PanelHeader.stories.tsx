import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { PanelHeader } from './PanelHeader';

const meta: Meta<typeof PanelHeader> = {
  title: 'Sidebar/Panel Header',
  component: PanelHeader,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PanelHeader {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};

export const Example: Story = {
  args: {
  title: 'Hello World'
},
};
