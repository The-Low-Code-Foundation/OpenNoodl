import type { Meta, StoryObj } from '@storybook/react';

import { InputNotificationDisplayMode } from '@noodl-types/globalInputTypes';
import { FeedbackType } from '@noodl-constants/FeedbackType';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';

import { TextInput } from './TextInput';

const meta: Meta<typeof TextInput> = {
  title: 'Inputs/Text Input',
  component: TextInput,
  argTypes: {
    value: { summary: 'string' }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};

export const CopyMe: Story = {
  args: {
  value: 'Copy Me',
  isCopyable: true
},
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

export const SuffixText: Story = {
  render: (args) => (
  <div>
    <Box hasBottomSpacing>
      <TextInput placeholder="placeholder" value="" suffix=".noodl.net" />
    </Box>
    <Box hasBottomSpacing>
      <TextInput value="example" suffix=".noodl.net" />
    </Box>
  </div>
);

export const SuffixSlotAfter: Story = {
  args: {
  value: 'example',
  suffix: '.noodl.net',
  isCopyable: true,
  slotAfterInput: <IconButton icon={IconName.Bug} />
},
};

const StyleTestTemplate: Story = (args) => (
  <div>
    <Box hasBottomSpacing>
      <TextInput {...args} />
    </Box>

    <VStack hasSpacing UNSAFE_style={{ maxWidth: '200px' }}>
      <TextInput {...args} />

      <TextInput {...args} isCopyable />

      <TextInput
        {...args}
        slotAfterInput={
          <Box hasLeftSpacing={1}>
            <IconButton icon={IconName.Bug} size={IconSize.Small} />
          </Box>
        }
      />

      <TextInput
        {...args}
        slotAfterInput={
          <Box hasLeftSpacing={1}>
            <IconButton icon={IconName.Bug} size={IconSize.Small} />
          </Box>
        }
        isCopyable
      />
    </VStack>
  </div>
);

export const StyleTestCommon = StyleTestTemplate.bind({});
StyleTestCommon.args = {
  value: 'How does my scrollbar look? How does my scrollbar look?'
};

export const StyleTestReadOnly = StyleTestTemplate.bind({});
StyleTestReadOnly.args = {
  isReadonly: true,
  value: 'You cannot change me! How does my scrollbar look?'
};

export const StyleTestDisabled = StyleTestTemplate.bind({});
StyleTestDisabled.args = {
  isDisabled: true,
  value: 'You cannot change me! How does my scrollbar look?'
};
