import type { Meta, StoryObj } from '@storybook/react';

import { AiIcon } from './AiIcon';

const meta: Meta<typeof AiIcon> = {
  title: 'Ai/Ai Icon',
  component: AiIcon,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
