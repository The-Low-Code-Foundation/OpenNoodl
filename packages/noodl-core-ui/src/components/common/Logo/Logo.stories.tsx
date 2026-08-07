import type { Meta, StoryObj } from '@storybook/react';

import { Logo, LogoVariant } from "./Logo";

const meta: Meta<typeof Logo> = {
  title: "Common/Logo",
  component: Logo,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ padding: '10px' }}>
    <Logo {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};

export const Inverted: Story = {
  args: {
  variant: LogoVariant.Inverted
},
};

export const Grayscale: Story = {
  args: {
  variant: LogoVariant.Grayscale
},
};
