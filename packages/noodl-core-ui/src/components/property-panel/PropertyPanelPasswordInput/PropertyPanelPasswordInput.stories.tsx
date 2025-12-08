import type { Meta, StoryObj } from '@storybook/react';

import { PropertyPanelPasswordInput } from './PropertyPanelPasswordInput';

const meta: Meta<typeof PropertyPanelPasswordInput> = {
  title: 'Property Panel/Password',
  component: PropertyPanelPasswordInput,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PropertyPanelPasswordInput {...args} />
  </div>
);

export const Common: Story = {
  args: {
  value: 'Hello World'
},
};
