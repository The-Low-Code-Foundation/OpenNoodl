/**
 * ProjectCreationWizard — Unit tests for wizard state management
 *
 * Tests the step-sequencing logic and validation rules in WizardContext.
 * These are pure logic tests — no DOM or React renderer required.
 *
 * This spec used to define its own copies of getStepSequence and isStepValid
 * and assert against those, with a note saying "if the context logic changes,
 * update both files". It could not have caught a regression: it never imported
 * the implementation. REV-008 exported the two real helpers and deleted the
 * copies. goNext/goBack below still mirror the provider's useCallbacks, which
 * cannot be imported without rendering the component — but they now walk the
 * real step sequence, so a change to the ordering is caught here.
 */

import {
  getStepSequence,
  isStepValid,
  WizardMode,
  WizardState,
  WizardStep
} from '../../../noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/WizardContext';

// ---- Step navigation (mirrors the WizardProvider goNext/goBack callbacks) ---

function goNext(state: WizardState): WizardStep {
  const seq = getStepSequence(state.mode);
  if (state.currentStep === 'entry') {
    return seq[0];
  }
  const idx = seq.indexOf(state.currentStep);
  if (idx === -1 || idx >= seq.length - 1) return state.currentStep;
  return seq[idx + 1];
}

function goBack(state: WizardState): WizardStep {
  if (state.currentStep === 'entry') return 'entry';
  const seq = getStepSequence(state.mode);
  const idx = seq.indexOf(state.currentStep);
  if (idx <= 0) return 'entry';
  return seq[idx - 1];
}

// ---- Whether the current step is the last one before creation --------------

function isLastStep(mode: WizardMode, step: WizardStep): boolean {
  const seq = getStepSequence(mode);
  return step === seq[seq.length - 1];
}

// ============================================================================
// Tests
// ============================================================================

describe('WizardContext: step sequences', () => {
  it('quick mode only visits basics', () => {
    expect(getStepSequence('quick')).toEqual(['basics']);
  });

  it('guided mode visits basics, preset, review', () => {
    expect(getStepSequence('guided')).toEqual(['basics', 'preset', 'review']);
  });

  it('ai mode uses same sequence as guided (V1 stub)', () => {
    expect(getStepSequence('ai')).toEqual(['basics', 'preset', 'review']);
  });
});

describe('WizardContext: validation', () => {
  const baseState: WizardState = {
    mode: 'quick',
    currentStep: 'basics',
    projectName: '',
    description: '',
    location: '',
    selectedPresetId: 'modern'
  };

  it('entry step is always valid', () => {
    expect(isStepValid('entry', { ...baseState, currentStep: 'entry' })).toBe(true);
  });

  it('review step is always valid', () => {
    expect(isStepValid('review', { ...baseState, currentStep: 'review' })).toBe(true);
  });

  it('basics step requires projectName and location', () => {
    expect(isStepValid('basics', baseState)).toBe(false);
  });

  it('basics step passes with name and location', () => {
    expect(isStepValid('basics', { ...baseState, projectName: 'My Project', location: '/tmp' })).toBe(true);
  });

  it('basics step trims whitespace on projectName', () => {
    expect(isStepValid('basics', { ...baseState, projectName: '   ', location: '/tmp' })).toBe(false);
  });

  it('preset step requires selectedPresetId', () => {
    expect(isStepValid('preset', { ...baseState, selectedPresetId: '' })).toBe(false);
  });

  it('preset step passes with a preset id', () => {
    expect(isStepValid('preset', { ...baseState, selectedPresetId: 'minimal' })).toBe(true);
  });
});

describe('WizardContext: goNext navigation', () => {
  const baseState: WizardState = {
    mode: 'quick',
    currentStep: 'entry',
    projectName: 'Test',
    description: '',
    location: '/tmp',
    selectedPresetId: 'modern'
  };

  it('quick: entry advances to basics', () => {
    expect(goNext({ ...baseState, mode: 'quick', currentStep: 'entry' })).toBe('basics');
  });

  it('quick: basics stays (is the last step)', () => {
    expect(goNext({ ...baseState, mode: 'quick', currentStep: 'basics' })).toBe('basics');
  });

  it('guided: entry advances to basics', () => {
    expect(goNext({ ...baseState, mode: 'guided', currentStep: 'entry' })).toBe('basics');
  });

  it('guided: basics advances to preset', () => {
    expect(goNext({ ...baseState, mode: 'guided', currentStep: 'basics' })).toBe('preset');
  });

  it('guided: preset advances to review', () => {
    expect(goNext({ ...baseState, mode: 'guided', currentStep: 'preset' })).toBe('review');
  });

  it('guided: review stays (is the last step)', () => {
    expect(goNext({ ...baseState, mode: 'guided', currentStep: 'review' })).toBe('review');
  });
});

describe('WizardContext: goBack navigation', () => {
  const baseState: WizardState = {
    mode: 'guided',
    currentStep: 'review',
    projectName: 'Test',
    description: '',
    location: '/tmp',
    selectedPresetId: 'modern'
  };

  it('entry stays on entry when going back', () => {
    expect(goBack({ ...baseState, currentStep: 'entry' })).toBe('entry');
  });

  it('guided: basics goes back to entry', () => {
    expect(goBack({ ...baseState, currentStep: 'basics' })).toBe('entry');
  });

  it('guided: preset goes back to basics', () => {
    expect(goBack({ ...baseState, currentStep: 'preset' })).toBe('basics');
  });

  it('guided: review goes back to preset', () => {
    expect(goBack({ ...baseState, currentStep: 'review' })).toBe('preset');
  });

  it('quick: basics goes back to entry', () => {
    expect(goBack({ ...baseState, mode: 'quick', currentStep: 'basics' })).toBe('entry');
  });
});

describe('isLastStep: determines when to show Create Project button', () => {
  it('quick mode: basics is the last step', () => {
    expect(isLastStep('quick', 'basics')).toBe(true);
  });

  it('quick mode: entry is not the last step', () => {
    expect(isLastStep('quick', 'entry')).toBe(false);
  });

  it('guided mode: review is the last step', () => {
    expect(isLastStep('guided', 'review')).toBe(true);
  });

  it('guided mode: basics is not the last step', () => {
    expect(isLastStep('guided', 'basics')).toBe(false);
  });

  it('guided mode: preset is not the last step', () => {
    expect(isLastStep('guided', 'preset')).toBe(false);
  });
});
