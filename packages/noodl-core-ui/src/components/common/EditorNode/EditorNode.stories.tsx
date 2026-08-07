import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { EditorNode } from './EditorNode';

const meta: Meta<typeof EditorNode> = {
  title: 'Common/EditorNode',
  component: EditorNode,
  argTypes: {
    item: {
      defaultValue: {
        name: 'Group',
        displayName: 'Group'
      }
    },
    colors: {
      defaultValue: {
        base: '#315272',
        baseHighlighted: '#4d6784',
        header: '#173E5D',
        headerHighlighted: '#315272',
        outline: '#173E5D',
        outlineHighlighted: '#b58900',
        text: '#cfd5de'
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;



export const Common: Story = {
  args: {},
};
