import type { Meta, StoryObj } from '@storybook/react';

import { DocumentTopToolbar } from './DocumentTopToolbar';

const meta: Meta<typeof DocumentTopToolbar> = {
  title: 'Layout/DocumentTopToolbar',
  component: DocumentTopToolbar,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
