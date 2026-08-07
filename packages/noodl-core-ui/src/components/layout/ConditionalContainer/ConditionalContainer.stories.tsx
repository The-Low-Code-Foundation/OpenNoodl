import type { Meta, StoryObj } from '@storybook/react';

import { ConditionalContainer } from './ConditionalContainer';

const meta: Meta<typeof ConditionalContainer> = {
  title: 'Layout/Conditional Container',
  component: ConditionalContainer,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  render: () => <div style={{ width: 280 }}>TODO: component exists, write stories</div>,
};
