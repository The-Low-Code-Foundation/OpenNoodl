import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Popups/Tooltip',
  component: Tooltip,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

function HoverTarget() {
  return <div style={{ padding: 10, backgroundColor: 'lightcoral' }}>HOVER ME</div>;
}

const Template: Story = (args) => (
  <div
    style={{
      height: 'calc(100vh - 35px)',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}
  >
    <section style={{ display: 'flex', justifyContent: 'space-between' }}>
      <Tooltip content="Hello! This is a long tooltip" {...args} isInline>
        <HoverTarget />
      </Tooltip>

      <Tooltip
        content="Hello! This is another long tooltip. Its very long to demonstrate how good the dialog and arrow is at placing itself relative to the window and trigger."
        {...args}
        isInline
      >
        <HoverTarget />
      </Tooltip>
    </section>

    <section style={{ display: 'flex', justifyContent: 'center' }}>
      <Tooltip
        content="I render y:below+x:center or x:right+y:center if not clipping the viewport"
        {...args}
        isInline
      >
        <HoverTarget />
      </Tooltip>
    </section>

    <section style={{ display: 'flex', justifyContent: 'space-between' }}>
      <Tooltip
        content="Hello! This is the bottom right tooltip with a lot of text. Its very long to demonstrate how good the dialog and arrow is at placing itself relative to the window and trigger."
        {...args}
        isInline
      >
        <HoverTarget />
      </Tooltip>

      <Tooltip content="Hello! This is the last tooltip on this page" {...args} isInline>
        <HoverTarget />
      </Tooltip>
    </section>
  </div>
);

export const Common: Story = {
  args: {},
};
