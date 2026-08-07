import type { Meta, StoryObj } from '@storybook/react';

import { Text } from '@noodl-core-ui/components/typography/Text';

import { VStack } from '../Stack/Stack';

const meta: Meta<typeof VStack> = {
  title: 'Layout/VStack',
  component: VStack,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <VStack {...args}></VStack>
  </div>
);

export const Common: Story = {
  args: {},
};

const ListTemplate: Story = (args) => (
  /* Showcase how it is when the size is set on the parent */
  <div style={{ width: 500, height: 500 }}>
    <VStack {...args}>
      {[...Array(10)].map((_, i) => (
        <Text>Item {i}</Text>
      ))}
    </VStack>
  </div>
);

export const List = ListTemplate.bind({});

export const ListSpacing = ListTemplate.bind({});
ListSpacing.args = {
  hasSpacing: true
};
