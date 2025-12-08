import type { Meta, StoryObj } from '@storybook/react';

import { InputNotificationDisplayMode } from '@noodl-types/globalInputTypes';
import { FeedbackType } from '@noodl-constants/FeedbackType';

import { TextArea } from './TextArea';

const meta: Meta<typeof TextArea> = {
  title: 'Inputs/Text Area',
  component: TextArea,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <TextArea {...args} />
  </div>
);

export const Common: Story = {
  args: {},
};

export const ErrorMessage: Story = {
  args: {
  value: 'I got the error',
  notification: {
    type: FeedbackType.Danger,
    message: 'I am error!',
    displayMode: InputNotificationDisplayMode.Stay
  }
},
};

export const BigMessage: Story = {
  args: {
  value: 'Hello\nHello\nHello\nHello\n',
  isResizeDisabled: true
},
};
