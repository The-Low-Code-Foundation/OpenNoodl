/**
 * ProjectCreationWizard - Multi-step project creation flow
 *
 * Replaces CreateProjectModal with a guided experience that supports:
 *   - Quick Start (name + location → create)
 *   - Guided Setup (name/description → style preset → review → create)
 *   - AI Builder stub (coming in V2)
 *
 * The onConfirm signature is identical to CreateProjectModal so ProjectsPage
 * requires only an import-name swap.
 *
 * @module noodl-core-ui/preview/launcher
 */
import React from 'react';

import { PrimaryButton, PrimaryButtonVariant, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { PresetDisplayInfo } from '@noodl-core-ui/components/StylePresets';

import css from './ProjectCreationWizard.module.scss';
import { EntryModeStep } from './steps/EntryModeStep';
import { ProjectBasicsStep } from './steps/ProjectBasicsStep';
import { ReviewStep } from './steps/ReviewStep';
import { StylePresetStep } from './steps/StylePresetStep';
import { WizardProvider, useWizardContext, DEFAULT_PRESET_ID, WizardStep } from './WizardContext';

// ----- Public API -----------------------------------------------------------

export interface ProjectCreationWizardProps {
  isVisible: boolean;
  onClose: () => void;
  /**
   * Called when the user confirms project creation.
   * Signature is identical to the legacy CreateProjectModal.onConfirm so
   * callers need no changes beyond swapping the import.
   */
  onConfirm: (name: string, location: string, presetId: string) => void;
  /** Open a native folder picker; returns the chosen path or null if cancelled */
  onChooseLocation?: () => Promise<string | null>;
  /** Style presets to show in the preset picker step */
  presets?: PresetDisplayInfo[];
}

// ----- Step metadata --------------------------------------------------------

const STEP_TITLES: Record<WizardStep, string> = {
  entry: 'Create New Project',
  basics: 'Project Basics',
  preset: 'Style Preset',
  review: 'Review'
};

/** Steps where the Back button should be hidden (entry has no "back") */
const STEPS_WITHOUT_BACK: WizardStep[] = ['entry'];

// ----- Inner wizard (has access to context) ---------------------------------

interface WizardInnerProps extends Omit<ProjectCreationWizardProps, 'isVisible'> {
  presets: PresetDisplayInfo[];
}

function WizardInner({ onClose, onConfirm, onChooseLocation, presets }: WizardInnerProps) {
  const { state, goNext, goBack, canProceed } = useWizardContext();

  const { currentStep, mode, projectName, location, selectedPresetId } = state;

  // Determine if this is the final step before creation
  const isLastStep = currentStep === 'review' || (mode === 'quick' && currentStep === 'basics');

  const nextLabel = isLastStep ? 'Create Project' : 'Next';
  const showBack = !STEPS_WITHOUT_BACK.includes(currentStep);

  const handleNext = () => {
    if (isLastStep) {
      // Fire creation with the wizard state values
      onConfirm(projectName.trim(), location, selectedPresetId);
    } else {
      goNext();
    }
  };

  // Render the active step body
  const renderStep = () => {
    switch (currentStep) {
      case 'entry':
        return <EntryModeStep />;
      case 'basics':
        return <ProjectBasicsStep onChooseLocation={onChooseLocation ?? (() => Promise.resolve(null))} />;
      case 'preset':
        return <StylePresetStep presets={presets} />;
      case 'review':
        return <ReviewStep presets={presets} />;
    }
  };

  return (
    <div className={css['Backdrop']} onClick={onClose}>
      <div className={css['Modal']} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css['Header']}>
          <h3 className={css['Title']}>{STEP_TITLES[currentStep]}</h3>

          {/* Step indicator (not shown on entry screen) */}
          {currentStep !== 'entry' && (
            <span className={css['StepLabel']}>{mode === 'quick' ? 'Quick Start' : 'Guided Setup'}</span>
          )}
        </div>

        {/* Content */}
        <div className={css['Content']}>{renderStep()}</div>

        {/* Footer — hidden on entry (entry step uses card clicks to advance) */}
        {currentStep !== 'entry' && (
          <div className={css['Footer']}>
            {showBack && (
              <PrimaryButton
                label="Back"
                size={PrimaryButtonSize.Default}
                variant={PrimaryButtonVariant.Muted}
                onClick={goBack}
                UNSAFE_style={{ marginRight: 'auto' }}
              />
            )}

            <PrimaryButton
              label="Cancel"
              size={PrimaryButtonSize.Default}
              variant={PrimaryButtonVariant.Muted}
              onClick={onClose}
              UNSAFE_style={{ marginRight: 'var(--spacing-2)' }}
            />

            <PrimaryButton
              label={nextLabel}
              size={PrimaryButtonSize.Default}
              onClick={handleNext}
              isDisabled={!canProceed}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ----- Public component (manages provider lifecycle) ------------------------

/**
 * ProjectCreationWizard — Drop-in replacement for CreateProjectModal.
 *
 * @example
 * // ProjectsPage.tsx — only change the import, nothing else
 * import { ProjectCreationWizard } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard';
 *
 * <ProjectCreationWizard
 *   isVisible={isCreateModalVisible}
 *   onClose={handleCreateModalClose}
 *   onConfirm={handleCreateProjectConfirm}
 *   onChooseLocation={handleChooseLocation}
 *   presets={STYLE_PRESETS}
 * />
 */
export function ProjectCreationWizard({
  isVisible,
  onClose,
  onConfirm,
  onChooseLocation,
  presets
}: ProjectCreationWizardProps) {
  if (!isVisible) return null;

  // Key the provider on `isVisible` so state fully resets each time the
  // modal opens — no stale name/location from the previous session.
  return (
    <WizardProvider key="project-creation-wizard">
      <WizardInner
        onClose={onClose}
        onConfirm={onConfirm}
        onChooseLocation={onChooseLocation}
        presets={presets ?? []}
      />
    </WizardProvider>
  );
}
