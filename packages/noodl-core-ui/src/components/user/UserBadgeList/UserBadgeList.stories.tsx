import type { Meta, StoryObj } from '@storybook/react';

import { UserBadgeList } from './UserBadgeList';

const meta: Meta<typeof UserBadgeList> = {
  title: 'User/UserBadgeList',
  component: UserBadgeList,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {
  badges: [
    {
      email: 'kotte@noodl.net',
      id: 'kotte',
      name: 'Kotte Aistre'
    },
    {
      email: 'eric@noodl.net',
      id: 'eric',
      name: 'Eric Tuvesson'
    },
    {
      email: 'michael@noodl.net',
      id: 'michael',
      name: 'Michael Cartner'
    }
  ]
},
};
