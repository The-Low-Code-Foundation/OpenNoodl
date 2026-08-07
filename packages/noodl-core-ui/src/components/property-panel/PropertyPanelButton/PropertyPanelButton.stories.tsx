import type { Meta, StoryObj } from '@storybook/react';

import { PropertyPanelButton } from '@noodl-core-ui/components/property-panel/PropertyPanelButton';

const meta: Meta<typeof PropertyPanelButton> = {
  title: 'Property Panel/Button',
  component: PropertyPanelButton,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PropertyPanelButton {...args} />
  </div>
);

export const Common: Story = {
  args: {
  properties: {
    buttonLabel: 'Verify API Key'
  }
},
};

export const Primary: Story = {
  args: {
  properties: {
    isPrimary: true,
    buttonLabel: 'Verify API Key'
  }
},
};
