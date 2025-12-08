import type { Meta, StoryObj } from '@storybook/react';

import { PropertyPanelTextRadioInput } from './PropertyPanelTextRadioInput';

const meta: Meta<typeof PropertyPanelTextRadioInput> = {
  title: 'Property Panel/Radio',
  component: PropertyPanelTextRadioInput,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PropertyPanelTextRadioInput {...args} />
  </div>
);

export const Common: Story = {
  args: {
  value: 'one',
  properties: {
    options: [
      {
        label: 'One',
        value: 'one'
      },
      {
        label: 'Two',
        value: 'two'
      },
      {
        label: 'Disabled',
        value: 'three',
        isDisabled: true
      }
    ]
  }
},
};
