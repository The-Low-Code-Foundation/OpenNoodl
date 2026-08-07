import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { BaseDialog } from './BaseDialog';

const meta: Meta<typeof BaseDialog> = {
  title: 'Layout/Base Dialog',
  component: BaseDialog,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => {
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [reload, setReload] = useState(Date.now());
  return (
    <>
      <BaseDialog {...args} isVisible={isDialogVisible} onClose={() => setIsDialogVisible(false)}>
        I am a dialog
      </BaseDialog>

      <p
        onMouseEnter={() => setIsDialogVisible(true)}
        onMouseLeave={() => setIsDialogVisible(false)}
      >
        Hover to show
      </p>
      <button onClick={() => setIsDialogVisible(true)}>Show dialog</button>
      <br />
      <button onClick={() => setReload(Date.now())}>Trigger reload</button>
    </>
  );
};

export const Common: Story = {
  args: {},
};
