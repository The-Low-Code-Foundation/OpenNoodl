import type { Meta, StoryObj } from '@storybook/react';

import { PrimaryButton, PrimaryButtonVariant } from './PrimaryButton';

const meta: Meta<typeof PrimaryButton> = {
  title: 'Inputs/Primary Button',
  component: PrimaryButton,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};

export const Primary: Story = {
  args: {
    label: 'Click me',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Click me',
    isDisabled: true,
  },
};

export const Muted: Story = {
  args: {
    label: 'Click me',
    variant: PrimaryButtonVariant.Muted,
  },
};

export const Ghost: Story = {
  args: {
    label: 'Click me',
    variant: PrimaryButtonVariant.Ghost,
  },
};

export const Danger: Story = {
  args: {
    label: 'Click me',
    variant: PrimaryButtonVariant.Danger,
  },
};
