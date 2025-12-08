import type { Meta, StoryObj } from '@storybook/react';

import { Modal } from '@noodl-core-ui/components/layout/Modal/Modal';

const meta: Meta<typeof Modal> = {
  title: 'Layout/Modal',
  component: Modal,
  argTypes: {},
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
    isVisible: true,
    children: 'Content in a Modal',
  },
};

export const Header: Story = {
  args: {
    isVisible: true,
    children: 'Content in a Modal',
    strapline: 'strapline',
    title: 'title',
    subtitle: 'subtitle',
    hasHeaderDivider: true,
  },
};

export const Footer: Story = {
  args: {
    isVisible: true,
    children: 'Content in a Modal',
    footerSlot: <>Content in Footer</>,
    hasFooterDivider: true,
  },
};

export const Full: Story = {
  args: {
    isVisible: true,
    children: 'Content in a Modal',
    strapline: 'strapline',
    title: 'title',
    subtitle: 'subtitle',
    hasHeaderDivider: true,
    footerSlot: <>Content in Footer</>,
    hasFooterDivider: true,
  },
};
