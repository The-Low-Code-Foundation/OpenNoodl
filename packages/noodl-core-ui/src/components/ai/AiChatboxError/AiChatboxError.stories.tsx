import type { Meta, StoryObj } from '@storybook/react';

import { AiChatboxError } from './AiChatboxError';

const meta: Meta<typeof AiChatboxError> = {
  title: 'Ai/Ai Chatbox Error',
  component: AiChatboxError,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ maxWidth: '380px', height: '800px', border: '1px solid black' }}>
    <AiChatboxError {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};

export const NotFound: Story = {
  args: {
  content:
    'Cannot find the chat history for this node. Could it be that the chat history is missing in Version Control? :('
},
};
