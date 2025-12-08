import type { Meta, StoryObj } from '@storybook/react';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import { MenuDialog, MenuDialogWidth } from './MenuDialog';

const meta: Meta<typeof MenuDialog> = {
  title: 'Popups/Menu Dialog',
  component: MenuDialog,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div>
    <MenuDialog {...args} />
  </div>
);

export const Common: Story = {
  args: {
  title: 'Preview layout',
  width: MenuDialogWidth.Small,
  isVisible: true,
  // triggerRef: null,
  onClose: () => {},
  items: [
    {
      icon: IconName.Logo,
      label: 'Hello',
      onClick: () => {}
    },
    {
      label: 'Hello',
      onClick: () => {}
    },
    {
      label: 'Hello with normal tooltip',
      onClick: () => {},
      tooltip: 'Hej'
    },
    {
      label: 'Disabled with tooltip',
      isDisabled: true,
      onClick: () => {},
      tooltip: 'Hej',
      tooltipShowAfterMs: 300
    }
  ]
},
};
