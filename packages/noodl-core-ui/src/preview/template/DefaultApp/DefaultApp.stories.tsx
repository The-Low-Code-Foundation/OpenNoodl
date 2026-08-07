import type { Meta, StoryObj } from '@storybook/react';

import { DefaultApp } from "./DefaultApp";

const meta: Meta<typeof DefaultApp> = {
  title: "Preview/Template/App",
  component: DefaultApp,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <DefaultApp {...args}></DefaultApp>
);

export const Common: Story = {
  args: {},
};
