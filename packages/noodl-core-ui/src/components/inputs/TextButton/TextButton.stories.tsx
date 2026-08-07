import type { Meta, StoryObj } from '@storybook/react';

import { TextButton } from './TextButton';
import { FeedbackType } from '@noodl-constants/FeedbackType';
import { TextType } from '@noodl-core-ui/components/typography/Text';

const meta: Meta<typeof TextButton> = {
  title: 'Inputs/Text Button',
  component: TextButton,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <TextButton {...args} />
);

export const Common: Story = {
  args: {},
};

export const Submit: Story = {
  args: {
  label: 'Submit',
},
};

//
// variant: FeedbackType
//

export const Danger: Story = {
  args: {
  label: 'Submit',
  variant: FeedbackType.Danger,
},
};

export const Notice: Story = {
  args: {
  label: 'Submit',
  variant: FeedbackType.Notice,
},
};

export const Success: Story = {
  args: {
  label: 'Submit',
  variant: FeedbackType.Success,
},
};

//
// variant: TextType
//

export const DefaultContrast: Story = {
  args: {
  label: 'Submit',
  variant: TextType.DefaultContrast,
},
};

export const Disabled: Story = {
  args: {
  label: 'Submit',
  variant: TextType.Disabled,
},
};

export const Proud: Story = {
  args: {},
};
Disabled.args = {
  label: 'Submit',
  variant: TextType.Proud,
};

export const Shy: Story = {
  args: {},
};
Disabled.args = {
  label: 'Submit',
  variant: TextType.Shy,
};
