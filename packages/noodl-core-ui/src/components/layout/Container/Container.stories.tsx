import type { Meta, StoryObj } from '@storybook/react';

import { Container, ContainerDirection } from './Container';
import { Text } from '@noodl-core-ui/components/typography/Text';

const meta: Meta<typeof Container> = {
  title: 'Layout/Container', // Layout scaffolding ?
  component: Container,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = (args) => (
  <div style={{ width: 280 }}>
    <Container {...args}></Container>
  </div>
);

export const Common: Story = {
  args: {},
};

export const SpaceBetweenHorizontal = () => (
  /* Showcase how it is when the size is set on the parent */
  <div style={{ width: 500, height: 500 }}>
    <Container direction={ContainerDirection.Horizontal} hasSpaceBetween>
      <Container>
        <Text>Left content</Text>
      </Container>
      <Container>
        <Text>Right content</Text>
      </Container>
    </Container>
  </div>
);

export const SpaceBetweenVertical = () => (
  /* Showcase how it is when the size is set on the parent */
  <div style={{ width: 500, height: 500 }}>
    <Container direction={ContainerDirection.Vertical} hasSpaceBetween>
      <Container>
        <Text>Top content</Text>
      </Container>
      <Container>
        <Text>Bottom content</Text>
      </Container>
    </Container>
  </div>
);
