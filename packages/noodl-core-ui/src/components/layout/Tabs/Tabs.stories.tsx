import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Tabs, TabsVariant } from './Tabs';
import { Text } from '@noodl-core-ui/components/typography/Text';

const meta: Meta<typeof Tabs> = {
  title: 'Layout/Tabs',
  component: Tabs,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <Tabs {...args}></Tabs>
  </div>
);

export const Common: Story = {
  args: {
  tabs: [
    {
      label: 'First tab',
      content: 'Some content for the first tab'
    },
    {
      label: 'Second tab',
      content: 'Second tab content!'
    }
  ]
},
};

export const VariantText: Story = {
  args: {
  variant: TabsVariant.Text,
  tabs: [
    {
      label: 'First tab',
      content: <Text>Some content for the first tab</Text>
    },
    {
      label: 'Second tab',
      content: <Text>Second tab content!</Text>
    }
  ]
},
};

export const VariantSidebar: Story = {
  args: {
  variant: TabsVariant.Sidebar,
  tabs: [
    {
      label: 'First tab',
      content: <Text>Some content for the first tab</Text>
    },
    {
      label: 'Second tab',
      content: <Text>Second tab content!</Text>
    }
  ]
},
};

export const SettingTabsWithId: Story = {
  args: {
  tabs: [
    {
      label: 'Same label',
      content: <Text>I am the first tab with the same name</Text>,
      id: 'tab-1'
    },
    {
      label: 'Same label',
      content: <Text>I am the second tab with the same label</Text>,
      id: 2
    }
  ]
},
};
