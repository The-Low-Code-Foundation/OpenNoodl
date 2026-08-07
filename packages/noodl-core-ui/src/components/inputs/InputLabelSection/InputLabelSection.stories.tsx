import type { Meta, StoryObj } from '@storybook/react';

import { InputLabelSection } from './InputLabelSection';

const meta: Meta<typeof InputLabelSection> = {
  title: 'Inputs/Input Label Section',
  component: InputLabelSection,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
  label: 'Hello World',
},
};
