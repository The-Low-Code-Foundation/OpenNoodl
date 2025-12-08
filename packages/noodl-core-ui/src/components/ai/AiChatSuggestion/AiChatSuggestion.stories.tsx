import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';

import { AiChatSuggestion } from './AiChatSuggestion';

const meta: Meta<typeof AiChatSuggestion> = {
  title: 'Ai/Ai Chat Suggestion',
  component: AiChatSuggestion,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ maxWidth: '280px' }}>
    <AiChatSuggestion {...args} />
  </div>
);

export const Common: Story = {
  args: {
  text: 'What are the required inputs for this node to work correctly?'
},
};

export const IsLoading: Story = {
  args: {
  isLoading: true
},
};

export const OnUpdate = () => {
  const [count, setCount] = useState(1);
  return (
    <div style={{ maxWidth: '280px' }}>
      <AiChatSuggestion text={`Count: ${count}`} />
      <Box hasTopSpacing>
        <PrimaryButton
          label="Increment"
          variant={PrimaryButtonVariant.Muted}
          isGrowing
          onClick={() => setCount((prev) => prev + 1)}
        />
      </Box>
    </div>
  );
};
