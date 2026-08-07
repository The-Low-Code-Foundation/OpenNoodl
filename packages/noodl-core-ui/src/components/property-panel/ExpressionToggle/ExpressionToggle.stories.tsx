import { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';

import { ExpressionToggle, ExpressionToggleProps } from './ExpressionToggle';

export default {
  title: 'Property Panel/Expression Toggle',
  component: ExpressionToggle,
  argTypes: {
    mode: {
      control: { type: 'radio' },
      options: ['fixed', 'expression']
    },
    isConnected: {
      control: 'boolean'
    },
    isDisabled: {
      control: 'boolean'
    }
  }
} as Meta<typeof ExpressionToggle>;

const Template: StoryFn<ExpressionToggleProps> = (args) => {
  const [mode, setMode] = useState<'fixed' | 'expression'>(args.mode);

  const handleToggle = () => {
    setMode((prevMode) => (prevMode === 'fixed' ? 'expression' : 'fixed'));
  };

  return <ExpressionToggle {...args} mode={mode} onToggle={handleToggle} />;
};

export const FixedMode = Template.bind({});
FixedMode.args = {
  mode: 'fixed',
  isConnected: false,
  isDisabled: false
};

export const ExpressionMode = Template.bind({});
ExpressionMode.args = {
  mode: 'expression',
  isConnected: false,
  isDisabled: false
};

export const Connected = Template.bind({});
Connected.args = {
  mode: 'fixed',
  isConnected: true,
  isDisabled: false
};

export const Disabled = Template.bind({});
Disabled.args = {
  mode: 'fixed',
  isConnected: false,
  isDisabled: true
};

export const InteractiveDemo: StoryFn<ExpressionToggleProps> = () => {
  const [mode, setMode] = useState<'fixed' | 'expression'>('fixed');
  const [isConnected, setIsConnected] = useState(false);

  const handleToggle = () => {
    setMode((prevMode) => (prevMode === 'fixed' ? 'expression' : 'fixed'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ width: '120px' }}>Normal Toggle:</span>
        <ExpressionToggle mode={mode} isConnected={false} onToggle={handleToggle} />
        <span style={{ opacity: 0.6, fontSize: '12px' }}>
          Current mode: <strong>{mode}</strong>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ width: '120px' }}>Connected:</span>
        <ExpressionToggle mode={mode} isConnected={true} onToggle={handleToggle} />
        <span style={{ opacity: 0.6, fontSize: '12px' }}>Shows connection indicator</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ width: '120px' }}>Disabled:</span>
        <ExpressionToggle mode={mode} isConnected={false} isDisabled={true} onToggle={handleToggle} />
        <span style={{ opacity: 0.6, fontSize: '12px' }}>Cannot be clicked</span>
      </div>

      <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Simulate Connection:</h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={isConnected} onChange={(e) => setIsConnected(e.target.checked)} />
          <span>Port is connected via cable</span>
        </label>
      </div>
    </div>
  );
};
