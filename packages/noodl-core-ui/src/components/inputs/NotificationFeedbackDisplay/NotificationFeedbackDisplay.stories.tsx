import type { Meta, StoryObj } from '@storybook/react';

import { NotificationFeedbackDisplay } from './NotificationFeedbackDisplay';

const meta: Meta<typeof NotificationFeedbackDisplay> = {
  title: 'Inputs/Notification Feedback Display',
  component: NotificationFeedbackDisplay,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
