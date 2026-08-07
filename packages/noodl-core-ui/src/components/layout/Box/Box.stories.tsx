import type { Meta, StoryObj } from '@storybook/react';

import { Box } from './Box';
import { Text } from '@noodl-core-ui/components/typography/Text';

const meta: Meta<typeof Box> = {
  title: 'Layout/Box',
  component: Box,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <Box {...args}>
      <Text>Text</Text>
    </Box>
  </div>
);

export const Common: Story = {
  args: {},
};
