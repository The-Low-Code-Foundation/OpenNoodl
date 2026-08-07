import type { Meta, StoryObj } from '@storybook/react';

import { AiIconAnimated } from './AiIconAnimated';

const meta: Meta<typeof AiIconAnimated> = {
  title: 'Ai/Ai Icon Animated',
  component: AiIconAnimated,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div
    style={{
      // A background is required for the mask to work
      backgroundColor: 'var(--theme-color-bg-3)'
    }}
  >
    <AiIconAnimated {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};

export const Listening: Story = {
  args: {
  isListening: true
},
};
