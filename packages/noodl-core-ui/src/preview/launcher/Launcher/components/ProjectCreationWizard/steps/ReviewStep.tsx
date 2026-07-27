/**
 * ReviewStep - Final summary before project creation
 *
 * Shows the chosen settings and lets the user go back to edit any step.
 */
import React from 'react';

import { PresetDisplayInfo } from '@noodl-core-ui/components/StylePresets';

import { useWizardContext } from '../WizardContext';
import css from './ReviewStep.module.scss';

/** One planned operation, flattened for display. AIX-012. */
export interface ReviewPlanRow {
  kind: string;
  target: string;
  intent: string;
}

export interface ReviewStepProps {
  presets: PresetDisplayInfo[];
  /**
   * AIX-012 — what the scoping conversation agreed, and the plan it produced.
   * Both absent in quick/guided mode. The plan is shown here, before creation,
   * because it is the thing the user is being handed: it is created but never
   * executed, so this is the moment they see what would be built.
   */
  scopeOutline?: readonly string[];
  planRows?: readonly ReviewPlanRow[];
}

export function ReviewStep({ presets, scopeOutline, planRows }: ReviewStepProps) {
  const { state, update } = useWizardContext();

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

        {/* AIX-012 — the agreed scope. */}
        {scopeOutline && scopeOutline.length > 0 && (
          <div className={css['SummaryRow']}>
            <div className={css['SummaryRow-label']}>Scope</div>
            <div className={css['SummaryRow-value']}>
              {scopeOutline.map((line, index) => (
                <span key={index} className={index === 0 ? css['ScopeLine'] : css['ScopeLine--secondary']}>
                  {line}
                </span>
              ))}
            </div>
            <button className={css['SummaryRow-edit']} onClick={() => update({ currentStep: 'scoping' })} type="button">
              Edit
            </button>
          </div>
        )}
      </div>

      {/* AIX-012 — the plan, shown but not run. */}
      {planRows && (
        <div className={css['Plan']}>
          <span className={css['Plan-title']}>Build plan — {planRows.length} step(s), not started</span>
          {planRows.length > 0 ? (
            <ol className={css['Plan-list']}>
              {planRows.map((row, index) => (
                <li key={index}>
                  <strong>
                    {row.kind} {row.target}
                  </strong>
                  <span className={css['Plan-intent']}>{row.intent}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={css['Plan-empty']}>
              No pages were agreed, so there is nothing to plan yet. The project and its docs are still created.
            </p>
          )}
          <p className={css['Plan-note']}>
            Creating the project writes the brief, the architecture notes, the conventions and the full scoping
            record into <code>docs/</code>. The plan is saved with them and waits for you — nothing is built now.
          </p>
        </div>
      )}
    </div>
  );
}
