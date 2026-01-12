import { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';

import { ExpressionInput, ExpressionInputProps } from './ExpressionInput';

export default {
  title: 'Property Panel/Expression Input',
  component: ExpressionInput,
  argTypes: {
    hasError: {
      control: 'boolean'
    },
    placeholder: {
      control: 'text'
    },
    debounceMs: {
      control: 'number'
    }
  }
} as Meta<typeof ExpressionInput>;

const Template: StoryFn<ExpressionInputProps> = (args) => {
  const [expression, setExpression] = useState(args.expression);

  return (
    <div style={{ padding: '20px', maxWidth: '400px' }}>
      <ExpressionInput {...args} expression={expression} onChange={setExpression} />
      <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.6 }}>
        Current value: <code>{expression}</code>
      </div>
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {
  expression: 'Variables.x * 2',
  hasError: false,
  placeholder: 'Enter expression...'
};

export const Empty = Template.bind({});
Empty.args = {
  expression: '',
  hasError: false,
  placeholder: 'Enter expression...'
};

export const WithError = Template.bind({});
WithError.args = {
  expression: 'invalid syntax +',
  hasError: true,
  errorMessage: 'Syntax error: Unexpected token +',
  placeholder: 'Enter expression...'
};

export const LongExpression = Template.bind({});
LongExpression.args = {
  expression: 'Variables.isAdmin ? "Administrator Panel" : Variables.isModerator ? "Moderator Panel" : "User Panel"',
  hasError: false,
  placeholder: 'Enter expression...'
};

export const InteractiveDemo: StoryFn<ExpressionInputProps> = () => {
  const [expression, setExpression] = useState('Variables.count');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (newExpression: string) => {
    setExpression(newExpression);

    // Simple validation: check for unmatched parentheses
    const openParens = (newExpression.match(/\(/g) || []).length;
    const closeParens = (newExpression.match(/\)/g) || []).length;

    if (openParens !== closeParens) {
      setHasError(true);
      setErrorMessage('Unmatched parentheses');
    } else if (newExpression.includes('++') || newExpression.includes('--')) {
      setHasError(true);
      setErrorMessage('Increment/decrement operators not supported');
    } else {
      setHasError(false);
      setErrorMessage('');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3 style={{ marginTop: 0 }}>Expression Input with Validation</h3>
      <p style={{ fontSize: '14px', opacity: 0.8 }}>Try typing expressions. The input validates in real-time.</p>

      <div style={{ marginTop: '20px' }}>
        <ExpressionInput
          expression={expression}
          onChange={handleChange}
          hasError={hasError}
          errorMessage={errorMessage}
        />
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: hasError ? '#fee' : '#efe',
          borderRadius: '4px',
          fontSize: '13px'
        }}
      >
        {hasError ? (
          <>
            <strong style={{ color: '#c00' }}>Error:</strong> {errorMessage}
          </>
        ) : (
          <>
            <strong style={{ color: '#080' }}>Valid expression</strong>
          </>
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px' }}>
        <h4>Try these examples:</h4>
        <ul style={{ lineHeight: '1.8' }}>
          <li>
            <code
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => handleChange('Variables.x + Variables.y')}
            >
              Variables.x + Variables.y
            </code>
          </li>
          <li>
            <code
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => handleChange('Variables.count * 2')}
            >
              Variables.count * 2
            </code>
          </li>
          <li>
            <code
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => handleChange('Math.max(Variables.a, Variables.b)')}
            >
              Math.max(Variables.a, Variables.b)
            </code>
          </li>
          <li>
            <code
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => handleChange('Variables.items.filter(x => x.active).length')}
            >
              Variables.items.filter(x =&gt; x.active).length
            </code>
          </li>
          <li>
            <code
              style={{ cursor: 'pointer', textDecoration: 'underline', color: '#c00' }}
              onClick={() => handleChange('invalid syntax (')}
            >
              invalid syntax (
            </code>{' '}
            <em>(causes error)</em>
          </li>
        </ul>
      </div>
    </div>
  );
};
