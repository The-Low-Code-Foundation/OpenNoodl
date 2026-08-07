import type { Meta, StoryObj } from '@storybook/react';

import { Text } from './Text';

const meta: Meta<typeof Text> = {
  title: 'Typography/Text',
  component: Text,
  argTypes: {
    children: { control: 'text' },
    textType: {
      control: {
        type: 'select',
        options: [
          // TextType
          'default',
          'disabled',
          'shy',
          'proud',

          // FeedbackType
          'success',
          'notice',
          'danger'
        ],
      },
    },
    className: { control: 'text' },
    size: {
      control: {
        type: 'select',
        options: [
          'default',
          'small',
        ],
      },
    },
    style: { control: 'object' },

    hasBottomSpacing: { control: 'boolean' },
    isSpan: { control: 'boolean' },
    isCentered: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

{args.children}</Text>;

export const Common: Story = {
  args: {
  children: "Typography",
},
};
