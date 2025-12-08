import type { Meta, StoryObj } from '@storybook/react';

import { CarouselIndicatorDot } from './CarouselIndicatorDot';

const meta: Meta<typeof CarouselIndicatorDot> = {
  title: 'Layout/Carousel Indicator Dot',
  component: CarouselIndicatorDot,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common: Story = {
  args: {},
};
