/**
 * Storybook Stories for JavaScriptEditor
 *
 * Demonstrates all validation modes and features
 */

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { JavaScriptEditor } from './JavaScriptEditor';

const meta: Meta<typeof JavaScriptEditor> = {
  title: 'Code Editor/JavaScriptEditor',
  component: JavaScriptEditor,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof JavaScriptEditor>;

/**
 * Interactive wrapper for stories
 */
function InteractiveEditor(props: React.ComponentProps<typeof JavaScriptEditor>) {
  const [value, setValue] = useState(props.value || '');

  return (
    <div style={{ width: '800px', height: '500px' }}>
      <JavaScriptEditor {...props} value={value} onChange={setValue} />
    </div>
  );
}

/**
 * Expression validation mode
 * Used for Expression nodes - validates as a JavaScript expression
 */
export const ExpressionMode: Story = {
  render: () => (
    <InteractiveEditor value="a + b" validationType="expression" placeholder="Enter a JavaScript expression..." />
  )
};

/**
 * Function validation mode
 * Used for Function nodes - validates as a function body
 */
export const FunctionMode: Story = {
  render: () => (
    <InteractiveEditor
      value={`// Calculate sum
const sum = inputs.a + inputs.b;
outputs.result = sum;`}
      validationType="function"
      placeholder="Enter JavaScript function code..."
    />
  )
};

/**
 * Script validation mode
 * Used for Script nodes - validates as JavaScript statements
 */
export const ScriptMode: Story = {
  render: () => (
    <InteractiveEditor
      value={`console.log('Script running');
const value = 42;
return value;`}
      validationType="script"
      placeholder="Enter JavaScript script code..."
    />
  )
};

/**
 * Invalid expression
 * Shows error display and validation
 */
export const InvalidExpression: Story = {
  render: () => <InteractiveEditor value="a + + b" validationType="expression" />
};

/**
 * Invalid function
 * Missing closing brace
 */
export const InvalidFunction: Story = {
  render: () => (
    <InteractiveEditor
      value={`function test() {
  console.log('missing closing brace');
// Missing }`}
      validationType="function"
    />
  )
};

/**
 * With onSave callback
 * Shows Save button and handles Ctrl+S
 */
export const WithSaveCallback: Story = {
  render: () => {
    const [savedValue, setSavedValue] = useState('');

    return (
      <div>
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Last saved:</strong> {savedValue || '(not saved yet)'}
        </div>
        <InteractiveEditor
          value="a + b"
          validationType="expression"
          onSave={(code) => {
            setSavedValue(code);
            alert(`Saved: ${code}`);
          }}
        />
      </div>
    );
  }
};

/**
 * Disabled state
 */
export const Disabled: Story = {
  render: () => <InteractiveEditor value="a + b" validationType="expression" disabled={true} />
};

/**
 * Custom height
 */
export const CustomHeight: Story = {
  render: () => (
    <div style={{ width: '800px' }}>
      <JavaScriptEditor
        value={`// Small editor
const x = 1;`}
        onChange={() => {}}
        validationType="function"
        height={200}
      />
    </div>
  )
};

/**
 * Complex function example
 * Real-world usage scenario
 */
export const ComplexFunction: Story = {
  render: () => (
    <InteractiveEditor
      value={`// Process user data
const name = inputs.firstName + ' ' + inputs.lastName;
const age = inputs.age;

if (age >= 18) {
  outputs.category = 'adult';
  outputs.message = 'Welcome, ' + name;
} else {
  outputs.category = 'minor';
  outputs.message = 'Hello, ' + name;
}

outputs.displayName = name;
outputs.isValid = true;`}
      validationType="function"
    />
  )
};
