import type { Meta, StoryObj } from '@storybook/react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';

import { AiChatMessage } from './AiChatMessage';

const meta: Meta<typeof AiChatMessage> = {
  title: 'Ai/Ai Chat Message',
  component: AiChatMessage,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ maxWidth: '280px' }}>
    <AiChatMessage {...args} />
  </div>
);

export const Common: Story = {
  args: {
  user: {
    role: 'user',
    name: 'Tore K'
  },
  content: 'Get the current weather at my location.'
},
};

export const User_BigContent: Story = {
  args: {
  user: {
    role: 'user',
    name: 'Tore K'
  },
  content: `This Function node fetches a location's address using its latitude and longitude from Google's Geocoding API. It requires an API key, latitude, and longitude as inputs and outputs the formatted address and success or failure signals.`
},
};

export const Assistant_BigContent: Story = {
  args: {
  user: {
    role: 'assistant'
  },
  content: `This Function node fetches a location's address using its latitude and longitude from Google's Geocoding API. It requires an API key, latitude, and longitude as inputs and outputs the formatted address and success or failure signals.`
},
};

export const Assistant_BigContentAffix: Story = {
  args: {
  user: {
    role: 'assistant'
  },
  content: `This Function node fetches a location's address using its latitude and longitude from Google's Geocoding API. It requires an API key, latitude, and longitude as inputs and outputs the formatted address and success or failure signals.`,
  affix: (
    <PrimaryButton
      size={PrimaryButtonSize.Small}
      variant={PrimaryButtonVariant.MutedOnLowBg}
      icon={IconName.ImportSlanted}
      label="Open code editor"
      isGrowing
    />
  )
},
};

export const None_BigContent: Story = {
  args: {
  user: null,
  content: `This Function node fetches a location's address using its latitude and longitude from Google's Geocoding API. It requires an API key, latitude, and longitude as inputs and outputs the formatted address and success or failure signals.`
},
};
