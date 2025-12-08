import type { Meta, StoryObj } from '@storybook/react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { Container } from '@noodl-core-ui/components/layout/Container';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text } from '@noodl-core-ui/components/typography/Text';

import { Section, SectionVariant } from './Section';

const meta: Meta<typeof Section> = {
  title: 'Layout/Section',
  component: Section,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <Section {...args}>
      <Container hasYSpacing>
        <Text>Hello World</Text>
      </Container>
    </Section>
  </div>
);

export const Common: Story = {
  args: {},
};

export const VariantPanel: Story = {
  args: {
  title: 'Title',
  variant: SectionVariant.Panel
},
};

export const CollapsableVariantPanel: Story = {
  args: {
  title: 'Title',
  variant: SectionVariant.Panel,
  isCollapsable: true
},
};

export const VariantPanelShy: Story = {
  args: {
  title: 'Title',
  variant: SectionVariant.PanelShy
},
};

export const VariantInModal: Story = {
  args: {
  title: 'Title',
  variant: SectionVariant.InModal
},
};

export const WithAction: Story = {
  args: {
  title: 'Title',
  actions: <IconButton icon={IconName.Plus} />
},
};

// Boring, but it should be content size and not handle scrollbars
export const ContentSize = () => (
  <div style={{ width: 280, height: 400, overflow: 'hidden' }}>
    <Section title="I do not have a scrollbar">
      <VStack hasSpacing>
        {[...new Array(100)].map((_, i) => (
          <Text>Hello World {i}</Text>
        ))}
      </VStack>
    </Section>
  </div>
);
