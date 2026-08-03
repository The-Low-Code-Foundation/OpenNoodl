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
import { AiAvailability, EntryModeStep } from './steps/EntryModeStep';
import { ProjectBasicsStep } from './steps/ProjectBasicsStep';
import { ReviewPlanRow, ReviewStep } from './steps/ReviewStep';
import { ScopingMessage, ScopingStep } from './steps/ScopingStep';
import { StylePresetStep } from './steps/StylePresetStep';
import { WizardProvider, useWizardContext, WizardMode, WizardStep } from './WizardContext';

// ----- Public API -----------------------------------------------------------

/**
 * AIX-012 — everything the host tells the wizard about the scoping
 * conversation. The wizard renders it; the editor owns the session, because
 * core-ui cannot import editor models.
 */
export interface ScopingState {
  messages: readonly ScopingMessage[];
  isBusy: boolean;
  /** Short lines describing what has been agreed so far. */
  outline: readonly string[];
  isAgreed: boolean;
  /**
   * AIB-009 F7 — the assistant's reply as it arrives, before the turn is over.
   * Empty (or absent) while the model has produced no prose yet, which is when
   * the thinking row is the honest thing to show.
   */
  streamingReply?: string;
  error?: string;
  /** The plan derived from the agreed scope, for the review step. */
  planRows: readonly ReviewPlanRow[];
  onSend: (text: string) => void;
}

export interface ProjectCreationWizardProps {
  isVisible: boolean;
  onClose: () => void;
  /**
   * Called when the user confirms project creation.
   *
   * The first three arguments are unchanged from the legacy
   * CreateProjectModal.onConfirm. `mode` is appended (AIX-012) so the host can
   * tell an AI-scoped creation — which also writes docs and stashes a plan —
   * from a blank one; existing callers that ignore it behave exactly as before.
   */
  onConfirm: (name: string, location: string, presetId: string, mode: WizardMode) => void;
  /** Open a native folder picker; returns the chosen path or null if cancelled */
  onChooseLocation?: () => Promise<string | null>;
  /** Style presets to show in the preset picker step */
  presets?: PresetDisplayInfo[];
  /**
   * AIX-012 — whether "Start with AI" can be offered, and if not, why and what
   * to do about it. Omitted means unavailable: never offer a path the host has
   * not confirmed it can serve.
   */
  aiAvailability?: AiAvailability;
  /** AIX-012 — the live scoping conversation. Required for the 'ai' mode. */
  scoping?: ScopingState;
}

// ----- Step metadata --------------------------------------------------------

const STEP_TITLES: Record<WizardStep, string> = {
  entry: 'Create New Project',
  basics: 'Project Basics',
  preset: 'Style Preset',
  scoping: 'What are we building?',
  review: 'Review'
};

const MODE_LABELS: Record<WizardMode, string> = {
  quick: 'Quick Start',
  guided: 'Guided Setup',
  ai: 'Start with AI'
};

/** Steps where the Back button should be hidden (entry has no "back") */
const STEPS_WITHOUT_BACK: WizardStep[] = ['entry'];

// ----- Inner wizard (has access to context) ---------------------------------

interface WizardInnerProps extends Omit<ProjectCreationWizardProps, 'isVisible'> {
  presets: PresetDisplayInfo[];
}

function WizardInner({ onClose, onConfirm, onChooseLocation, presets, aiAvailability, scoping }: WizardInnerProps) {
  const { state, goNext, goBack, canProceed } = useWizardContext();

  const { currentStep, mode, projectName, location, selectedPresetId } = state;

  // Determine if this is the final step before creation
  const isLastStep = currentStep === 'review' || (mode === 'quick' && currentStep === 'basics');

  /**
   * AIB-005 slice 3 — the last screen has to land the expectation the editor
   * then has to meet. "Create Project" beside a list of three agreed pages reads
   * as "build them"; it does not, and the gap between those two readings is
   * where Richard's *"it took me into the hello world app"* lives. Naming the
   * panel the plan will be waiting in costs four words.
   */
  const hasPlan = mode === 'ai' && (scoping?.planRows?.length ?? 0) > 0;
  const nextLabel = isLastStep ? (hasPlan ? 'Create project — the plan waits in Build' : 'Create Project') : 'Next';
  const showBack = !STEPS_WITHOUT_BACK.includes(currentStep);

  // A turn in flight must not be walked out from under: the reply would land
  // on an unmounted step and the scope it recorded would be lost.
  const isBlocked = currentStep === 'scoping' && Boolean(scoping?.isBusy);

  const handleNext = () => {
    if (isLastStep) {
      // Fire creation with the wizard state values
      onConfirm(projectName.trim(), location, selectedPresetId, mode);
    } else {
      goNext();
    }
  };

  // Render the active step body
  const renderStep = () => {
    switch (currentStep) {
      case 'entry':
        return <EntryModeStep aiAvailability={aiAvailability} />;
      case 'basics':
        return <ProjectBasicsStep onChooseLocation={onChooseLocation ?? (() => Promise.resolve(null))} />;
      case 'preset':
        return <StylePresetStep presets={presets} />;
      case 'scoping':
        return scoping ? (
          <ScopingStep
            messages={scoping.messages}
            isBusy={scoping.isBusy}
            streamingReply={scoping.streamingReply}
            outline={scoping.outline}
            isAgreed={scoping.isAgreed}
            error={scoping.error}
            onSend={scoping.onSend}
          />
        ) : null;
      case 'review':
        return (
          <ReviewStep
            presets={presets}
            scopeOutline={mode === 'ai' ? scoping?.outline : undefined}
            planRows={mode === 'ai' ? scoping?.planRows ?? [] : undefined}
          />
        );
    }
  };

  return (
    <div className={css['Backdrop']} onClick={onClose}>
      <div className={css['Modal']} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css['Header']}>
          <h3 className={css['Title']}>{STEP_TITLES[currentStep]}</h3>

          {/* Step indicator (not shown on entry screen) */}
          {currentStep !== 'entry' && <span className={css['StepLabel']}>{MODE_LABELS[mode]}</span>}
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
                isDisabled={isBlocked}
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
              label={currentStep === 'scoping' ? 'Continue' : nextLabel}
              size={PrimaryButtonSize.Default}
              onClick={handleNext}
              isDisabled={!canProceed || isBlocked}
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
  presets,
  aiAvailability,
  scoping
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
        aiAvailability={aiAvailability}
        scoping={scoping}
      />
    </WizardProvider>
  );
}
