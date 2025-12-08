import type { Meta, StoryObj } from '@storybook/react';

import { UserListingCard } from './UserListingCard';

const meta: Meta<typeof UserListingCard> = {
  title: 'User/User Listing Card',
  component: UserListingCard,
  argTypes: {
    name: { control: 'text' },
    email: { control: 'text' },
    id: { control: 'text' },
    metaText: { control: 'slot' },
    metaType: {
      control: {
        type: 'select',
        options: [
          'default',
          'disabled',
          'shy',
          'proud',
        ],
      },
    },
    interactionSlot: { control: 'slot' },
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
  name: 'John Doe',
  email: 'john@noodl.net',
  id: '20',
},
};
