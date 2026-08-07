/**
 * Budget Approval Dialog
 *
 * Pause-and-approve dialog shown when reaching spending increments
 * during AI-assisted migration.
 */

import React from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import type { BudgetState } from '../../models/migration/BudgetController';
import css from './BudgetApprovalDialog.module.scss';

interface BudgetApprovalDialogProps {
  state: BudgetState;
  onApprove: () => void;
  onDeny: () => void;
}

export function BudgetApprovalDialog({ state, onApprove, onDeny }: BudgetApprovalDialogProps) {
  const progressPercent = (state.spent / state.maxPerSession) * 100;
  const pendingPercent = (state.pauseIncrement / state.maxPerSession) * 100;

  return (
    <div className={css['BudgetApprovalDialog']}>
      <div className={css['Icon']}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      </div>

      <div className={css['Content']}>
        <h3>Budget Check</h3>

        <Text textType={TextType.Secondary}>
          You&apos;ve spent <strong>${state.spent.toFixed(2)}</strong> of your{' '}
          <strong>${state.maxPerSession.toFixed(2)}</strong> budget.
        </Text>

        <Text textType={TextType.Secondary}>
          Continue with another <strong>${state.pauseIncrement.toFixed(2)}</strong> allowance?
        </Text>

        <div className={css['BudgetBar']}>
          <div className={css['BudgetBar__Track']}>
            <div className={css['BudgetBar__Spent']} style={{ width: `${progressPercent}%` }} />
            <div
              className={css['BudgetBar__Pending']}
              style={{
                left: `${progressPercent}%`,
                width: `${pendingPercent}%`
              }}
            />
          </div>
        </div>

        <div className={css['BudgetLabels']}>
          <span>$0</span>
          <span className={css['Current']}>${state.spent.toFixed(2)}</span>
          <span>${state.maxPerSession.toFixed(2)}</span>
        </div>
      </div>

      <div className={css['Actions']}>
        <PrimaryButton variant={PrimaryButtonVariant.Muted} label="Stop Here" onClick={onDeny} />
        <PrimaryButton
          variant={PrimaryButtonVariant.Cta}
          label={`Continue (+$${state.pauseIncrement.toFixed(2)})`}
          onClick={onApprove}
        />
      </div>
    </div>
  );
}
