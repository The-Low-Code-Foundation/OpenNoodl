/**
 * ProjectCreationWizard — Unit tests for wizard state management
 *
 * Tests the step-sequencing logic and validation rules defined in WizardContext.
 * These are pure logic tests — no DOM or React renderer required.
 *
 * The functions below mirror the private helpers in WizardContext.tsx.
 * If the context logic changes, update both files.
 */


// ---- Step sequencing (mirrors WizardContext.getStepSequence) ---------------

function getStepSequence(mode) {
  switch (mode) {
    case 'quick':
      return ['basics'];
    case 'guided':
      return ['basics', 'preset', 'review'];
    case 'ai':
      return ['basics', 'preset', 'review'];
    default:
      return ['basics'];
  }
}

// ---- Validation (mirrors WizardContext.isStepValid) ------------------------

function isStepValid(step, state) {
  switch (step) {
    case 'entry':
      return true;
    case 'basics':
      return state.projectName.trim().length > 0 && state.location.length > 0;
    case 'preset':
      return state.selectedPresetId.length > 0;
    case 'review':
      return true;
    default:
      return false;
  }
}

// ---- Step navigation (mirrors WizardContext goNext/goBack logic) -----------

function goNext(state) {
  if (state.currentStep === 'entry') {
    const seq = getStepSequence(state.mode);
    return seq[0];
  }
  const seq = getStepSequence(state.mode);
  const idx = seq.indexOf(state.currentStep);
  if (idx === -1 || idx >= seq.length - 1) return state.currentStep;
  return seq[idx + 1];
}

function goBack(state) {
  if (state.currentStep === 'entry') return 'entry';
  const seq = getStepSequence(state.mode);
  const idx = seq.indexOf(state.currentStep);
  if (idx <= 0) return 'entry';
  return seq[idx - 1];
}

// ---- Whether the current step is the last one before creation --------------

function isLastStep(mode, step) {
  return step === 'review' || (mode === 'quick' && step === 'basics');
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
  const baseState = {
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
  const baseState = {
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
  const baseState = {
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
