import type { Meta, StoryObj } from '@storybook/react';

import { LegacyIconButton } from './LegacyIconButton';

const meta: Meta<typeof LegacyIconButton> = {
  title: 'Inputs/Legacy Icon Button',
  component: LegacyIconButton,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <>
    DONT USE THIS COMPONENT
    <LegacyIconButton {...args} />
  </>
);

export const Common: Story = {
  args: {},
};
