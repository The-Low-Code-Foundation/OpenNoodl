import type { Meta, StoryObj } from '@storybook/react';

import { PropertyPanelTextInput } from './PropertyPanelTextInput';

const meta: Meta<typeof PropertyPanelTextInput> = {
  title: 'Property Panel/Text',
  component: PropertyPanelTextInput,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PropertyPanelTextInput {...args} />
  </div>
);

export const Common: Story = {
  args: {
  value: 'Hello World'
},
};
