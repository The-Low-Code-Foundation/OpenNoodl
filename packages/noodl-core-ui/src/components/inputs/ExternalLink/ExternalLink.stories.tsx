import type { Meta, StoryObj } from '@storybook/react';

import { ExternalLink } from './ExternalLink';

const meta: Meta<typeof ExternalLink> = {
  title: 'Inputs/External Link',
  component: ExternalLink,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: { children: 'I am a link' },
};
