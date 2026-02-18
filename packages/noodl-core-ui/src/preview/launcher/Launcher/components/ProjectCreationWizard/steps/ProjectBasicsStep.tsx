/**
 * ProjectBasicsStep - Name, optional description, and folder location
 *
 * Shown in both Quick Start and Guided modes.
 * Description field is only shown in Guided mode.
 */
import React, { useCallback } from 'react';

import { PrimaryButton, PrimaryButtonVariant, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Label } from '@noodl-core-ui/components/typography/Label';

import { useWizardContext } from '../WizardContext';
import css from './ProjectBasicsStep.module.scss';

export interface ProjectBasicsStepProps {
  /** Called when the user clicks "Browse..." to pick a folder */
  onChooseLocation: () => Promise<string | null>;
}

export function ProjectBasicsStep({ onChooseLocation }: ProjectBasicsStepProps) {
  const { state, update } = useWizardContext();
  const isGuided = state.mode === 'guided' || state.mode === 'ai';

  const handleChooseLocation = useCallback(async () => {
    const chosen = await onChooseLocation();
    if (chosen) {
      update({ location: chosen });
    }
  }, [onChooseLocation, update]);

  return (
    <div className={css['ProjectBasicsStep']}>
      {/* Project Name */}
      <div className={css['Field']}>
        <Label>Project Name</Label>
        <TextInput
          value={state.projectName}
          onChange={(e) => update({ projectName: e.target.value })}
          placeholder="My New Project"
          isAutoFocus
          UNSAFE_style={{ marginTop: 'var(--spacing-2)' }}
        />
      </div>

      {/* Description — guided mode only */}
      {isGuided && (
        <div className={css['Field']}>
          <Label>Description (optional)</Label>
          <TextInput
            value={state.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="A brief description of your project..."
            UNSAFE_style={{ marginTop: 'var(--spacing-2)' }}
          />
        </div>
      )}

      {/* Location */}
      <div className={css['Field']}>
        <Label>Location</Label>
        <div className={css['LocationRow']}>
          <TextInput
            value={state.location}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="Choose folder..."
            isReadonly
            UNSAFE_style={{ flex: 1 }}
          />
          <PrimaryButton
            label="Browse..."
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={handleChooseLocation}
            UNSAFE_style={{ marginLeft: 'var(--spacing-2)' }}
          />
        </div>
      </div>

      {/* Path preview */}
      {state.projectName && state.location && (
        <div className={css['PathPreview']}>
          <span className={css['PathText']}>
            Full path: {state.location}/{state.projectName}/
          </span>
        </div>
      )}
    </div>
  );
}
