import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import {
  PropertyPanelInput,
  PropertyPanelInputType,
} from './PropertyPanelInput';
import { PropertyPanelSection } from '@noodl-core-ui/components/property-panel/PropertyPanelSection';
import { ReactComponent as AlignLeftIcon } from '../../../assets/icons/align-left.svg';
import { ReactComponent as AlignCenterIcon } from '../../../assets/icons/align-center.svg';
import { ReactComponent as AlignRightcon } from '../../../assets/icons/align-right.svg';

const meta: Meta<typeof PropertyPanelInput> = {
  title: 'Property Panel/# Generic',
  component: PropertyPanelInput,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => {
  const [value, setValue] = useState(args.value || '');

  return (
    <div style={{ width: 280 }}>
      <PropertyPanelSection title="Input demo">
        <PropertyPanelInput {...args} value={value} onChange={setValue} />
      </PropertyPanelSection>

      <div style={{ paddingTop: 30 }}>
        Stored value:{' '}
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    </div>
  );
};

export const Common: Story = {
  args: { label: 'Label' },
};

export const Text: Story = {
  args: {
  inputType: PropertyPanelInputType.Text,
  label: 'Text',
},
};

export const Number: Story = {
  args: {
  inputType: PropertyPanelInputType.Number,
  label: 'Number',
},
};

export const LengthUnit: Story = {
  args: {
  inputType: PropertyPanelInputType.LengthUnit,
  label: 'Length unit',
  value: '200px',
},
};

export const Slider: Story = {
  args: {
  inputType: PropertyPanelInputType.Slider,
  label: 'Slider',
  value: 50,
  properties: {
    min: 10,
    max: 90,
    step: 5,
  },
},
};

export const Select: Story = {
  args: {
  inputType: PropertyPanelInputType.Select,
  label: 'Select',
  value: 'first',
  properties: {
    options: [
      {
        label: 'First option',
        value: 'first',
      },
      {
        label: 'Second option',
        value: 'second',
      },
      {
        label: 'Disabled option',
        value: 'third',
        isDisabled: true,
      },
    ],
  },
},
};

export const TextRadio: Story = {
  args: {
  inputType: PropertyPanelInputType.TextRadio,
  label: 'Text radio',
  value: 'one',
  properties: {
    options: [
      {
        label: 'One',
        value: 'one',
      },
      {
        label: 'Two',
        value: 'two',
      },
      {
        label: 'Disabled',
        value: 'three',
        isDisabled: true,
      },
    ],
  },
},
};

export const IconRadio: Story = {
  args: {
  inputType: PropertyPanelInputType.IconRadio,
  label: 'Icon radio',
  value: 'left',
  properties: {
    options: [
      {
        icon: <AlignLeftIcon />,
        value: 'left',
      },
      {
        icon: <AlignCenterIcon />,
        value: 'center',
      },
      {
        icon: <AlignRightcon />,
        value: 'right',
        isDisabled: true,
      },
    ],
  },
},
};

export const Checkbox: Story = {
  args: {
  inputType: PropertyPanelInputType.Checkbox,
  label: 'Checkbox',
  value: true,
},
};

export const Button: Story = {
  args: {
  inputType: PropertyPanelInputType.Button,
  label: 'Button',
  properties: {
    buttonLabel: 'Click me',
    onClick: () => alert('hello'),
  },
},
};
