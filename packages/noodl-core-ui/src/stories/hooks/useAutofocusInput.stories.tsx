import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { useAutofocusInput } from '@noodl-core-ui/hooks/useAutofocusInput';

const meta: Meta<typeof TextInput> = {
  title: 'Hooks/useAutofocusInput',
  component: TextInput,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

const Template: Story = () => {
  const setRef = useAutofocusInput();
  const [secondInputState, setSecondInputState] = useState('Focus me manually');

  return (
    <>
      <TextInput onRefChange={setRef} value="Unmutable value makes this story cleaner" />
      <TextInput value={secondInputState} onChange={(e) => setSecondInputState(e.target.value)} />
    </>
  );
};

export const Common: Story = {
  args: {},
};
