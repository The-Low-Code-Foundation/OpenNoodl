import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Inputs/Select',
  component: Select,
  argTypes: {
    options: {
      defaultValue: [
        {
          label: 'Volvo',
          value: 'volvo'
        },
        {
          label: 'Saab',
          value: 'saab'
        },
        {
          label: 'Mercedes',
          value: 'mercedes'
        },
        {
          label: 'Audi',
          value: 'audi'
        }
      ]
    }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => {
  const [value, setValue] = useState(null);

  return <Select {...args} value={value} onChange={setValue} />;
};

export const Common: Story = {
  args: {},
};

export const InFlexColumn: Story = {
  render: (args) => (
  <div
    style={{
      display: 'flex',
      height: 500,
      backgroundColor: '#000',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 20
    }}
  >
    <Template {...args} />
  </div>
);

export const AtBottom: Story = {
  render: (args) => (
  <div
    style={{
      display: 'flex',
      height: 500,
      backgroundColor: '#000',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: 20
    }}
  >
    <div>
      <Template {...args} />
    </div>
  </div>
);
