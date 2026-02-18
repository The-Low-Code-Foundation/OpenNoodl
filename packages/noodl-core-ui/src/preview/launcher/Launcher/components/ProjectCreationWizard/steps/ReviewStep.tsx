/**
 * ReviewStep - Final summary before project creation
 *
 * Shows the chosen settings and lets the user go back to edit any step.
 */
import React from 'react';

import { PresetDisplayInfo } from '@noodl-core-ui/components/StylePresets';

import { useWizardContext } from '../WizardContext';
import css from './ReviewStep.module.scss';

export interface ReviewStepProps {
  presets: PresetDisplayInfo[];
}

export function ReviewStep({ presets }: ReviewStepProps) {
  const { state, update, goBack } = useWizardContext();

  const selectedPreset = presets.find((p) => p.id === state.selectedPresetId);

  const handleEditBasics = () => {
    // Navigate back to basics by jumping steps
    update({ currentStep: 'basics' });
  };

  const handleEditPreset = () => {
    update({ currentStep: 'preset' });
  };

  return (
    <div className={css['ReviewStep']}>
      <p className={css['ReviewStep-subtitle']}>Review your settings before creating.</p>

      <div className={css['Summary']}>
        {/* Basics row */}
        <div className={css['SummaryRow']}>
          <div className={css['SummaryRow-label']}>Project</div>
          <div className={css['SummaryRow-value']}>
            <span className={css['SummaryRow-main']}>{state.projectName || '—'}</span>
            {state.description && <span className={css['SummaryRow-secondary']}>{state.description}</span>}
          </div>
          <button className={css['SummaryRow-edit']} onClick={handleEditBasics} type="button">
            Edit
          </button>
        </div>

        {/* Location row */}
        <div className={css['SummaryRow']}>
          <div className={css['SummaryRow-label']}>Location</div>
          <div className={css['SummaryRow-value']}>
            <span className={css['SummaryRow-main']} title={state.location}>
              {state.location || '—'}
            </span>
            {state.projectName && state.location && (
              <span className={css['SummaryRow-secondary']}>
                Full path: {state.location}/{state.projectName}/
              </span>
            )}
          </div>
          <button className={css['SummaryRow-edit']} onClick={handleEditBasics} type="button">
            Edit
          </button>
        </div>

        {/* Style preset row */}
        <div className={css['SummaryRow']}>
          <div className={css['SummaryRow-label']}>Style</div>
          <div className={css['SummaryRow-value']}>
            <span className={css['SummaryRow-main']}>{selectedPreset?.name ?? state.selectedPresetId}</span>
            {selectedPreset?.description && (
              <span className={css['SummaryRow-secondary']}>{selectedPreset.description}</span>
            )}
          </div>
          <button className={css['SummaryRow-edit']} onClick={handleEditPreset} type="button">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
