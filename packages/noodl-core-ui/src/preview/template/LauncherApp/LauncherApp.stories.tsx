import type { Meta, StoryObj } from '@storybook/react';

import { LauncherApp, LauncherSidebarExample } from "./LauncherApp";

const meta: Meta<typeof LauncherApp> = {
  title: "Preview/Template/Launcher",
  component: LauncherApp,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <LauncherApp {...args}></LauncherApp>
);

export const Common: Story = {
  args: {},
};

export const WithSidebar: Story = {
  args: {
  sidePanel: <LauncherSidebarExample />
},
};
