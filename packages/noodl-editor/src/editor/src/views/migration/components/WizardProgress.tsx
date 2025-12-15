/**
 * WizardProgress
 *
 * A visual progress indicator showing the current step in the migration wizard.
 *
 * @module noodl-editor/views/migration/components
 * @since 1.2.0
 */

import classNames from 'classnames';
import React from 'react';

import css from './WizardProgress.module.scss';

export interface WizardProgressProps {
  /** Current step index (1-indexed) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Labels for each step */
  stepLabels: string[];
}

export function WizardProgress({ currentStep, totalSteps, stepLabels }: WizardProgressProps) {
  return (
    <div className={css['Root']}>
      <div className={css['Steps']}>
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div
              key={label}
              className={classNames(
                css['Step'],
                isActive && css['is-active'],
                isCompleted && css['is-completed']
              )}
            >
              <div className={css['StepIndicator']}>
                {isCompleted ? (
                  <svg viewBox="0 0 16 16" className={css['CheckIcon']}>
                    <path
                      d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <span>{stepNumber}</span>
                )}
              </div>
              <span className={css['StepLabel']}>{label}</span>
              {index < stepLabels.length - 1 && (
                <div
                  className={classNames(
                    css['StepConnector'],
                    isCompleted && css['is-completed']
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className={css['ProgressBar']}>
        <div
          className={css['ProgressFill']}
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default WizardProgress;
