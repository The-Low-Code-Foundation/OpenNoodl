import type { Meta, StoryObj } from '@storybook/react';

import { ErrorBoundary } from './ErrorBoundary';
import { Text } from '@noodl-core-ui/components/typography/Text';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Common/Error Boundary',
  component: ErrorBoundary,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Common = (args) => (
  <ErrorBoundary {...args}>
    <Text>Everything working fine</Text>
  </ErrorBoundary>
);

function CauseError(): React.JSX.Element {
  let invalid_object = {};

  // @ts-ignore
  invalid_object.value.toThrowError();

  return <Text>Everything working fine</Text>;
}

export const OnError = (args) => (
  <ErrorBoundary {...args}>
    <CauseError />
  </ErrorBoundary>
);
