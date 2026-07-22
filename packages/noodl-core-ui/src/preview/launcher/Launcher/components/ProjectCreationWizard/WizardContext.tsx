/**
 * WizardContext - Shared state for the Project Creation Wizard
 *
 * Manages wizard step flow, form values, and mode selection.
 * Passed via React context so all step components can read/write without prop drilling.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';

// ----- Types ----------------------------------------------------------------

/** The entry-mode choice the user makes on the first screen */
export type WizardMode = 'quick' | 'guided' | 'ai';

/**
 * Step identifiers in the guided flow.
 * Quick mode only visits 'basics' (no preset or review step).
 */
export type WizardStep = 'entry' | 'basics' | 'preset' | 'review';

export const DEFAULT_PRESET_ID = 'modern';

export interface WizardState {
  /** Active wizard mode chosen by the user */
  mode: WizardMode;
  /** Current step being displayed */
  currentStep: WizardStep;
  /** Project name entered by the user */
  projectName: string;
  /** Optional project description (guided mode only) */
  description: string;
  /** Folder path chosen via native dialog */
  location: string;
  /** ID of the selected style preset */
  selectedPresetId: string;
}

export interface WizardContextValue {
  state: WizardState;
  /** Update one or more fields of the wizard state */
  update: (partial: Partial<WizardState>) => void;
  /** Move forward to the next logical step (mode-aware) */
  goNext: () => void;
  /** Move back to the previous step */
  goBack: () => void;
  /** Whether the current step has all required data to proceed */
  canProceed: boolean;
}

// ----- Context --------------------------------------------------------------

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizardContext(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizardContext must be used within WizardProvider');
  return ctx;
}

// ----- Step ordering --------------------------------------------------------

/**
 * Returns the ordered list of steps for the given mode.
 * Exported so the editor suite can test the real thing — the spec used to carry
 * its own copy of this function and assert against that (REV-008).
 */
export function getStepSequence(mode: WizardMode): WizardStep[] {
  switch (mode) {
    case 'quick':
      // Quick Start: just fill in name/location, no preset picker or review
      return ['basics'];
    case 'guided':
      return ['basics', 'preset', 'review'];
    case 'ai':
      // AI mode is a stub for V1 — same as guided until AI is wired
      return ['basics', 'preset', 'review'];
  }
}

// ----- Validation -----------------------------------------------------------

/** Exported for the same reason as getStepSequence — see above. */
export function isStepValid(step: WizardStep, state: WizardState): boolean {
  switch (step) {
    case 'entry':
      // Entry screen has no data — user just picks a mode
      return true;
    case 'basics':
      return state.projectName.trim().length > 0 && state.location.length > 0;
    case 'preset':
      return state.selectedPresetId.length > 0;
    case 'review':
      return true;
  }
}

// ----- Provider -------------------------------------------------------------

export interface WizardProviderProps {
  children: React.ReactNode;
  initialState?: Partial<WizardState>;
}

export function WizardProvider({ children, initialState }: WizardProviderProps) {
  const [state, setStateRaw] = useState<WizardState>({
    mode: 'quick',
    currentStep: 'entry',
    projectName: '',
    description: '',
    location: '',
    selectedPresetId: DEFAULT_PRESET_ID,
    ...initialState
  });

  const update = useCallback((partial: Partial<WizardState>) => {
    setStateRaw((prev) => ({ ...prev, ...partial }));
  }, []);

  const goNext = useCallback(() => {
    setStateRaw((prev) => {
      if (prev.currentStep === 'entry') {
        // Entry → first step of the chosen mode sequence
        const seq = getStepSequence(prev.mode);
        return { ...prev, currentStep: seq[0] };
      }
      const seq = getStepSequence(prev.mode);
      const idx = seq.indexOf(prev.currentStep);
      if (idx === -1 || idx >= seq.length - 1) return prev;
      return { ...prev, currentStep: seq[idx + 1] };
    });
  }, []);

  const goBack = useCallback(() => {
    setStateRaw((prev) => {
      if (prev.currentStep === 'entry') return prev;
      const seq = getStepSequence(prev.mode);
      const idx = seq.indexOf(prev.currentStep);
      if (idx <= 0) {
        // Back from the first real step → return to entry screen
        return { ...prev, currentStep: 'entry' };
      }
      return { ...prev, currentStep: seq[idx - 1] };
    });
  }, []);

  const canProceed = isStepValid(state.currentStep, state);

  return (
    <WizardContext.Provider value={{ state, update, goNext, goBack, canProceed }}>{children}</WizardContext.Provider>
  );
}
