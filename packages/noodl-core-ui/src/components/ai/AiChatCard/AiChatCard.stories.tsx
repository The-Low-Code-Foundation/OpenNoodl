import type { Meta, StoryObj } from '@storybook/react';

import { AiChatCard } from './AiChatCard';

const meta: Meta<typeof AiChatCard> = {
  title: 'Ai/Ai Chat Card',
  component: AiChatCard,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
  title: 'Home page',
  subtitle: 'Landing page for the app'
},
};
