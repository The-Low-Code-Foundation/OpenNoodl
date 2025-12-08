import type { Meta, StoryObj } from '@storybook/react';

import { TitleBar, TitleBarState } from './TitleBar';

const meta: Meta<typeof TitleBar> = {
  title: 'App/Title Bar',
  component: TitleBar,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ position: 'relative', width: 950, height: 40 }}>
    <TitleBar {...args}></TitleBar>
  </div>
);

export const Common: Story = {
  args: {
  title: 'Noodl Storybook',
  version: '2.6.5',
  isWindows: false
},
};

export const IsWindows: Story = {
  args: {
  title: 'Noodl Storybook',
  version: '2.6.5',
  isWindows: true
},
};

export const UpdateAvailable: Story = {
  args: {
  title: 'Noodl Storybook',
  version: '2.6.5',
  versionAvailable: '2.6.6',
  state: TitleBarState.UpdateAvailable,
  isWindows: true
},
};

export const Updated: Story = {
  args: {
  title: 'Noodl Storybook',
  version: '2.6.5',
  state: TitleBarState.Updated,
  isWindows: true
},
};
