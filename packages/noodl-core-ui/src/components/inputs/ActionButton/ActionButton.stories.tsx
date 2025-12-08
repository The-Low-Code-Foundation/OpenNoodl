import type { Meta, StoryObj } from '@storybook/react';

import { ActionButton, ActionButtonVariant } from './ActionButton';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { Container } from '@noodl-core-ui/components/layout/Container';

const meta: Meta<typeof ActionButton> = {
  title: 'Inputs/Action Button',
  component: ActionButton,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <ActionButton {...args}></ActionButton>
  </div>
);

export const Common: Story = {
  args: {},
};

export const UpToDate: Story = {
  args: {
  variant: ActionButtonVariant.Default,
  label: 'Up to date',
  value: 'Last updated 14:39'
},
};

export const ReceivingUpdates: Story = {
  args: {
  variant: ActionButtonVariant.BackgroundAction,
  label: 'Receiving updates',
  affixText: '75%'
},
};

export const CheckingForUpdates: Story = {
  args: {
  variant: ActionButtonVariant.BackgroundAction,
  label: 'Checking for updates...',
  affixText: 'Last updated 14:39'
},
};

export const PullChanges: Story = {
  args: {
  variant: ActionButtonVariant.CallToAction,
  icon: IconName.ArrowDown,
  label: 'Pull changes',
  affixText: 'Last updates just now'
},
};

export const PushChanges: Story = {
  args: {
  variant: ActionButtonVariant.CallToAction,
  icon: IconName.ArrowUp,
  label: 'Push changes',
  affixText: 'Last updates just now'
},
};

export const Back: Story = {
  args: {
  variant: ActionButtonVariant.Default,
  icon: IconName.ArrowLeft,
  label: 'Back',
  affixText: undefined
},
};

export const ComparingBranches: Story = {
  args: {
  variant: ActionButtonVariant.Proud,
  icon: IconName.ArrowLeft,
  prefixText: 'Comparing',
  label: (
    <Container>
      <Text textType={TextType.Proud} isSpan>
        Branch v2
      </Text>
      <Text textType={TextType.Default} isSpan style={{ padding: '0 4px' }}>
        with
      </Text>
      <Text textType={TextType.Proud} isSpan>
        Main
      </Text>
    </Container>
  ),
  affixText: undefined
},
};
