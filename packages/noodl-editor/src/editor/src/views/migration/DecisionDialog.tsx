/**
 * Decision Dialog
 *
 * Dialog shown when AI migration fails after max retries.
 * Allows user to choose how to proceed with the component.
 */

import React, { useState } from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import type { AIDecisionRequest } from '../../models/migration/types';
import css from './DecisionDialog.module.scss';

interface DecisionDialogProps {
  request: AIDecisionRequest;
  onDecision: (action: 'retry' | 'skip' | 'manual' | 'getHelp') => void;
}

export function DecisionDialog({ request, onDecision }: DecisionDialogProps) {
  const [showingHelp, setShowingHelp] = useState(false);

  const handleGetHelp = () => {
    setShowingHelp(true);
  };

  const handleBack = () => {
    setShowingHelp(false);
  };

  if (showingHelp) {
    return (
      <div className={css['DecisionDialog']}>
        <div className={css['Icon']} data-type="help">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
          </svg>
        </div>

        <div className={css['Content']}>
          <h3>AI Migration Suggestions</h3>

          <Text textType={TextType.Secondary}>
            The AI couldn&apos;t automatically migrate <strong>{request.componentName}</strong> after {request.attempts}{' '}
            attempts. Here&apos;s what to look for:
          </Text>

          <div className={css['HelpContent']}>
            <div className={css['HelpSection']}>
              <h4>Common Issues</h4>
              <ul>
                <li>
                  <strong>Legacy Lifecycle Methods:</strong> Replace componentWillMount, componentWillReceiveProps,
                  componentWillUpdate with modern alternatives
                </li>
                <li>
                  <strong>String Refs:</strong> Convert ref="myRef" to ref={'{'} (el) =&gt; this.myRef = el {'}'}
                </li>
                <li>
                  <strong>findDOMNode:</strong> Use ref callbacks to access DOM nodes directly
                </li>
                <li>
                  <strong>Legacy Context:</strong> Migrate to modern Context API (createContext/useContext)
                </li>
              </ul>
            </div>

            {request.attemptHistory.length > 0 && (
              <div className={css['HelpSection']}>
                <h4>What the AI Tried</h4>
                {request.attemptHistory.map((attempt, index) => (
                  <div key={index} className={css['AttemptSummary']}>
                    <strong>Attempt {index + 1}:</strong>
                    <Text textType={TextType.Shy}>{attempt.error}</Text>
                  </div>
                ))}
              </div>
            )}

            <div className={css['HelpSection']}>
              <h4>Recommended Actions</h4>
              <ol>
                <li>Open the component in the code editor</li>
                <li>Check the console for specific error messages</li>
                <li>Refer to the React 19 upgrade guide</li>
                <li>Make changes incrementally and test after each change</li>
              </ol>
            </div>
          </div>
        </div>

        <div className={css['Actions']}>
          <PrimaryButton variant={PrimaryButtonVariant.Muted} label="Back" onClick={handleBack} />
          <PrimaryButton
            variant={PrimaryButtonVariant.Cta}
            label="Mark for Manual Review"
            onClick={() => onDecision('skip')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={css['DecisionDialog']}>
      <div className={css['Icon']} data-type="warning">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
      </div>

      <div className={css['Content']}>
        <h3>Migration Needs Your Help</h3>

        <Text textType={TextType.Secondary}>
          The AI couldn&apos;t automatically migrate <strong>{request.componentName}</strong> after {request.attempts}{' '}
          attempts.
        </Text>

        <div className={css['CostInfo']}>
          <Text textType={TextType.Shy}>
            Spent so far: <strong>${request.costSpent.toFixed(2)}</strong>
            {request.retryCost > 0 && (
              <>
                {' '}
                · Retry cost: <strong>${request.retryCost.toFixed(2)}</strong>
              </>
            )}
          </Text>
        </div>

        <div className={css['AttemptHistory']}>
          <h4>Previous Attempts</h4>
          <div className={css['Attempts']}>
            {request.attemptHistory.map((attempt, index) => (
              <div key={index} className={css['Attempt']}>
                <div className={css['Attempt__Header']}>
                  <span className={css['Attempt__Number']}>Attempt {index + 1}</span>
                  <span className={css['Attempt__Cost']}>${attempt.cost.toFixed(3)}</span>
                </div>
                <Text textType={TextType.Shy} className={css['Attempt__Error']}>
                  {attempt.error}
                </Text>
              </div>
            ))}
          </div>
        </div>

        <div className={css['Options']}>
          <Text textType={TextType.Secondary}>What would you like to do?</Text>
        </div>
      </div>

      <div className={css['Actions']}>
        <div className={css['Actions__Row']}>
          <PrimaryButton variant={PrimaryButtonVariant.Muted} label="Try Again" onClick={() => onDecision('retry')} />
          <PrimaryButton variant={PrimaryButtonVariant.Muted} label="Skip for Now" onClick={() => onDecision('skip')} />
        </div>
        <div className={css['Actions__Row']}>
          <PrimaryButton variant={PrimaryButtonVariant.Ghost} label="Get Help" onClick={handleGetHelp} />
          <PrimaryButton
            variant={PrimaryButtonVariant.Danger}
            label="Accept Last Attempt"
            onClick={() => onDecision('manual')}
          />
        </div>
      </div>
    </div>
  );
}
