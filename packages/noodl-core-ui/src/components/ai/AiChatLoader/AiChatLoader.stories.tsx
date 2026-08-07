import type { Meta, StoryObj } from '@storybook/react';

import { AiChatLoader } from './AiChatLoader';

const meta: Meta<typeof AiChatLoader> = {
  title: 'Ai/Ai Chat Loader',
  component: AiChatLoader,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: '337px' }}>
    <AiChatLoader {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};

export const LongText: Story = {
  args: {
  text: 'Making sense of the universe... one moment please!'
},
};
