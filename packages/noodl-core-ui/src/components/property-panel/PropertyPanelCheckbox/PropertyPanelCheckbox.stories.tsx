import type { Meta, StoryObj } from '@storybook/react';

import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';

const meta: Meta<typeof PropertyPanelCheckbox> = {
  title: 'Property Panel/Checkbox',
  component: PropertyPanelCheckbox,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PropertyPanelCheckbox {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};
