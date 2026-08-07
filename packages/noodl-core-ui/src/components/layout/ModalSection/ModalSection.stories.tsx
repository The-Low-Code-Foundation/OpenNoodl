import type { Meta, StoryObj } from '@storybook/react';

import { ModalSection } from './ModalSection';

const meta: Meta<typeof ModalSection> = {
  title: 'Layout/Modal Section',
  component: ModalSection,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
