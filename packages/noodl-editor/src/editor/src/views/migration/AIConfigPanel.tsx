/**
 * AI Configuration Panel
 *
 * First-time setup UI for configuring Anthropic API key,
 * budget controls, and migration preferences.
 */

import React, { useState } from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { testAnthropicKey } from '../../utils/migration/keyStorage';
import css from './AIConfigPanel.module.scss';

export interface AIConfig {
  apiKey: string;
  enabled: boolean;
  budget: {
    maxPerSession: number;
    pauseIncrement: number;
    showEstimates: boolean;
  };
  preferences: {
    preferFunctional: boolean;
    preserveComments: boolean;
    verboseOutput: boolean;
  };
}

interface AIConfigPanelProps {
  existingConfig?: AIConfig;
  onSave: (config: AIConfig) => void;
  onCancel: () => void;
}

export function AIConfigPanel({ existingConfig, onSave, onCancel }: AIConfigPanelProps) {
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey || '');
  const [maxBudget, setMaxBudget] = useState(existingConfig?.budget.maxPerSession || 5);
  const [pauseIncrement, setPauseIncrement] = useState(existingConfig?.budget.pauseIncrement || 1);
  const [showEstimates, setShowEstimates] = useState(existingConfig?.budget.showEstimates ?? true);
  const [preferFunctional, setPreferFunctional] = useState(existingConfig?.preferences.preferFunctional ?? true);

  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);

  const validateApiKey = async () => {
    setValidating(true);
    setValidationError(null);
    setValidationSuccess(false);

    try {
      await testAnthropicKey(apiKey);
      setValidationSuccess(true);
      return true;
    } catch (error: unknown) {
      const err = error as { message?: string };
      setValidationError(err.message || 'Validation failed');
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (await validateApiKey()) {
      onSave({
        apiKey,
        enabled: true, // Enable AI when config is saved
        budget: {
          maxPerSession: maxBudget,
          pauseIncrement,
          showEstimates
        },
        preferences: {
          preferFunctional,
          preserveComments: true,
          verboseOutput: true
        }
      });
    }
  };

  return (
    <div className={css['AIConfigPanel']}>
      <div className={css['Header']}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 2.18l8 3.64v9.18c0 4.52-3.13 8.78-7 9.82-3.87-1.04-7-5.3-7-9.82V7.82l6-2.64z"
            fill="currentColor"
          />
          <path d="M10.5 13.5l-2-2-1.5 1.5 3.5 3.5 6-6-1.5-1.5-4.5 4.5z" fill="currentColor" />
        </svg>
        <div className={css['HeaderText']}>
          <h3>Configure AI Migration Assistant</h3>
          <Text textType={TextType.Shy}>
            OpenNoodl uses Claude (by Anthropic) to intelligently migrate complex code patterns.
          </Text>
        </div>
      </div>

      {/* API Key Section */}
      <section className={css['Section']}>
        <h4>Anthropic API Key</h4>
        <Text textType={TextType.Shy}>
          You&apos;ll need an API key from Anthropic.{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
            Get one here →
          </a>
        </Text>

        <div className={css['InputGroup']}>
          <TextInput
            type="password"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <PrimaryButton
            variant={PrimaryButtonVariant.Muted}
            label={validating ? 'Validating...' : 'Validate'}
            onClick={validateApiKey}
            isDisabled={!apiKey || validating}
          />
        </div>

        {validationSuccess && (
          <div className={css['ValidationSuccess']}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <Text textType={TextType.Shy}>API key validated successfully!</Text>
          </div>
        )}

        {validationError && (
          <div className={css['ValidationError']}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <Text textType={TextType.Shy}>{validationError}</Text>
          </div>
        )}

        <div className={css['SecurityNote']}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
          <Text textType={TextType.Shy}>
            Your API key is stored locally and encrypted. It&apos;s never sent to OpenNoodl servers - all API calls go
            directly to Anthropic.
          </Text>
        </div>
      </section>

      {/* Budget Section */}
      <section className={css['Section']}>
        <h4>Budget Controls</h4>

        <div className={css['Field']}>
          <label>Maximum spend per migration session</label>
          <div className={css['BudgetRow']}>
            <span>$</span>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
              className={css['BudgetInput']}
            />
          </div>
          <Text textType={TextType.Shy}>Typical migration: $0.10 - $2.00</Text>
        </div>

        <div className={css['Field']}>
          <label className={css['Checkbox']}>
            <input
              type="checkbox"
              checked={pauseIncrement > 0}
              onChange={(e) => setPauseIncrement(e.target.checked ? 1 : 0)}
            />
            <span>Pause and ask before each ${pauseIncrement} increment</span>
          </label>
        </div>

        <div className={css['Field']}>
          <label className={css['Checkbox']}>
            <input type="checkbox" checked={showEstimates} onChange={(e) => setShowEstimates(e.target.checked)} />
            <span>Show cost estimate before each component</span>
          </label>
        </div>
      </section>

      {/* Preferences Section */}
      <section className={css['Section']}>
        <h4>Migration Preferences</h4>

        <div className={css['Field']}>
          <label className={css['Checkbox']}>
            <input type="checkbox" checked={preferFunctional} onChange={(e) => setPreferFunctional(e.target.checked)} />
            <span>Prefer converting to functional components with hooks</span>
          </label>
          <Text textType={TextType.Shy}>
            When possible, Claude will convert class components to modern functional components
          </Text>
        </div>
      </section>

      <div className={css['Actions']}>
        <PrimaryButton variant={PrimaryButtonVariant.Muted} label="Cancel" onClick={onCancel} />
        <PrimaryButton
          variant={PrimaryButtonVariant.Cta}
          label="Save & Continue"
          onClick={handleSave}
          isDisabled={!apiKey || validating}
        />
      </div>
    </div>
  );
}
