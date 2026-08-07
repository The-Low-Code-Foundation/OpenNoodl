import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { PopupSection } from './PopupSection';
import { Text } from '@noodl-core-ui/components/typography/Text';

const meta: Meta<typeof PopupSection> = {
  title: 'Popups/Popup Section',
  component: PopupSection,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PopupSection {...args}>
      <Text>
        {
          // @ts-ignore
          args.content
        }
      </Text>
    </PopupSection>
  </div>
);

export const Common: Story = {
  args: {
  title: 'Cloud services'
},
};

export const WithContent: Story = {
  args: {
  content:
    'Create a new backend. Each backend is isolated so you can create one for development, testing and production, or for different locales.'
},
};
