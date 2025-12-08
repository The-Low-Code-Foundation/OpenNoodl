import type { Meta, StoryObj } from '@storybook/react';

import { PropertyPanelSelectInput } from './PropertyPanelSelectInput';

const meta: Meta<typeof PropertyPanelSelectInput> = {
  title: 'Property Panel/Select',
  component: PropertyPanelSelectInput,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <PropertyPanelSelectInput {...args} />
  </div>
);

export const Common: Story = {
  args: {
  value: 'disabled',
  properties: {
    options: [
      { label: 'Disabled', value: 'disabled' },
      { label: 'Limited Beta (gpt-3)', value: 'limited-beta' },
      { label: 'Full Beta (gpt-4)', value: 'full-beta' }
    ]
  }
},
};

export const hasSmallText: Story = {
  args: {
  value: 'disabled',
  properties: {
    options: [
      { label: 'Disabled', value: 'disabled' },
      { label: 'Limited Beta (gpt-3)', value: 'limited-beta' },
      { label: 'Full Beta (gpt-4)', value: 'full-beta' }
    ]
  },
  hasSmallText: true
},
};
