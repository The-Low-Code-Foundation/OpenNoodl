import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { HtmlRenderer } from './HtmlRenderer';
import { Text } from '@noodl-core-ui/components/typography/Text';

const meta: Meta<typeof HtmlRenderer> = {
  title: 'Common/HtmlRenderer',
  component: HtmlRenderer,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <>
    <Text>Pass an HTML string to the html-prop</Text>
    <HtmlRenderer {...args} />;
  </>
);

export const Common: Story = {
  args: {},
};
