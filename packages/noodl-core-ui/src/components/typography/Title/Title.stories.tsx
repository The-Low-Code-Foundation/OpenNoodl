import type { Meta, StoryObj } from '@storybook/react';

import { Title } from './Title';

const meta: Meta<typeof Title> = {
  title: 'Typography/Title',
  component: Title,
  argTypes: {
    children: { control: 'text' },
    size: {
      control: {
        type: 'select',
        options: [
          'default',
          'large',
          'small',
        ],
      },
    },
    variant: {
      control: {
        type: 'select',
        options: [
          'default',
          'highlighted',
          'danger',
          'success',
        ],
      },
    },
  
    hasBottomSpacing: { control: 'boolean' },
    isCentered: { control: 'boolean' },
    isInline: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

{args.children}</Title>;

export const Common: Story = {
  args: {
  children: "Typography",
},
};
