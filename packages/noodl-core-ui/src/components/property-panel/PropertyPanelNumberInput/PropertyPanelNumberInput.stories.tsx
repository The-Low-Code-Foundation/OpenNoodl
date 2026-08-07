import type { Meta, StoryObj } from '@storybook/react';

import { PropertyPanelNumberInput } from './PropertyPanelNumberInput';

const meta: Meta<typeof PropertyPanelNumberInput> = {
  title: 'Property Panel/Number',
  component: PropertyPanelNumberInput,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PropertyPanelNumberInput {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};
