import type { Meta, StoryObj } from '@storybook/react';

import { Checkbox, CheckboxSize } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Inputs/Checkbox',
  component: Checkbox,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};

export const Selected: Story = {
  args: {
    label: 'I want cookies',
    isChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'I want cookies',
    isDisabled: true,
  },
};

export const HiddenCheckbox: Story = {
  args: {
    label: 'I want cookies',
    hasHiddenCheckbox: true,
  },
};

export const SizeSmall: Story = {
  args: {
    label: 'I want cookies',
    isChecked: true,
    checkboxSize: CheckboxSize.Small,
  },
};

export const SizeLarge: Story = {
  args: {
    label: 'I want cookies',
    isChecked: true,
    checkboxSize: CheckboxSize.Large,
  },
};
