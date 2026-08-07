import type { Meta, StoryObj } from '@storybook/react';

import { TestView } from './TestView';

const meta: Meta<typeof TestView> = {
  title: 'Layout/TestView',
  component: TestView,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
