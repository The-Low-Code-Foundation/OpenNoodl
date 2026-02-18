/**
 * StylePresetStep - Style preset selection for guided mode
 *
 * Reuses the existing PresetSelector component built in STYLE-003.
 */
import React from 'react';

import { PresetDisplayInfo, PresetSelector } from '@noodl-core-ui/components/StylePresets';

import { useWizardContext } from '../WizardContext';
import css from './StylePresetStep.module.scss';

export interface StylePresetStepProps {
  /** Preset data passed in from the editor (avoid circular dep) */
  presets: PresetDisplayInfo[];
}

export function StylePresetStep({ presets }: StylePresetStepProps) {
  const { state, update } = useWizardContext();

  return (
    <div className={css['StylePresetStep']}>
      <p className={css['StylePresetStep-hint']}>
        Choose a visual style for your project. You can customise colors and fonts later.
      </p>
      <PresetSelector
        presets={presets}
        selectedId={state.selectedPresetId}
        onChange={(id) => update({ selectedPresetId: id })}
      />
    </div>
  );
}
