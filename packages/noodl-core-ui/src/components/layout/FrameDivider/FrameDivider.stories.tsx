import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { FrameDivider, FrameDividerOwner } from './FrameDivider';
import { TestView } from '@noodl-core-ui/components/layout/TestView/TestView';

const meta: Meta<typeof FrameDivider> = {
  title: 'Layout/Frame Divider',
  component: FrameDivider,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 1280, height: 800, background: 'lightgray' }}>
    <FrameDivider
      {...args}
      first={<TestView backgroundColor="#ff3f34" />}
      second={<TestView backgroundColor="#05c46b" />}
    ></FrameDivider>
  </div>
);

export const Horizontal: Story = {
  args: {
  horizontal: true
},
};

export const Vertical: Story = {
  args: {
  horizontal: false
},
};

export const Editor3Horizontal: Story = () => {
  const [firstSize, setFirstSize] = useState(343);
  const [secondSize, setSecondSize] = useState(343);

  return (
    <div style={{ width: 1280, height: 800, background: 'lightgray' }}>
      <FrameDivider
        sizeMin={200}
        size={firstSize}
        onSizeChanged={setFirstSize}
        first={<TestView backgroundColor="#ff3f34" />}
        second={
          <FrameDivider
            onSizeChanged={setSecondSize}
            size={secondSize}
            splitOwner={FrameDividerOwner.Second}
            sizeMin={200}
            first={<TestView backgroundColor="#0fbcf9" />}
            second={<TestView backgroundColor="#05c46b" />}
            horizontal
          />
        }
        horizontal
      />
    </div>
  );
};
export const Editor3Vertical: Story = () => {
  const [firstSize, setFirstSize] = useState(300);
  const [secondSize, setSecondSize] = useState(300);

  return (
    <div style={{ width: 1280, height: 800, background: 'lightgray' }}>
      <FrameDivider
        sizeMin={200}
        sizeMax={300}
        size={firstSize}
        onSizeChanged={setFirstSize}
        first={<TestView backgroundColor="#ff3f34" />}
        second={
          <FrameDivider
            onSizeChanged={setSecondSize}
            size={secondSize}
            splitOwner={FrameDividerOwner.Second}
            sizeMin={200}
            first={<TestView backgroundColor="#0fbcf9" />}
            second={<TestView backgroundColor="#05c46b" />}
          />
        }
      />
    </div>
  );
};

export const Editor2Horizontal1Vertical: Story = () => {
  const [firstSize, setFirstSize] = useState(300);
  const [secondSize, setSecondSize] = useState(300);

  return (
    <div style={{ width: 1280, height: 800, background: 'lightgray' }}>
      <FrameDivider
        size={firstSize}
        onSizeChanged={setFirstSize}
        first={<TestView backgroundColor="#ff3f34" />}
        second={
          <FrameDivider
            onSizeChanged={setSecondSize}
            size={secondSize}
            first={<TestView backgroundColor="#0fbcf9" />}
            second={<TestView backgroundColor="#05c46b" />}
          ></FrameDivider>
        }
        horizontal
      ></FrameDivider>
    </div>
  );
};
