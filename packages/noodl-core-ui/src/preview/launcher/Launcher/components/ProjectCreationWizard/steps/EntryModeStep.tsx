/**
 * EntryModeStep - First screen of the Project Creation Wizard
 *
 * Lets the user choose between Quick Start, Guided Setup, or AI Builder (stub).
 */
import React from 'react';

import { WizardMode, useWizardContext } from '../WizardContext';
import css from './EntryModeStep.module.scss';

interface ModeCardProps {
  mode: WizardMode;
  title: string;
  description: string;
  isDisabled?: boolean;
  onSelect: (mode: WizardMode) => void;
}

function ModeCard({ mode, title, description, isDisabled, onSelect }: ModeCardProps) {
  return (
    <button
      className={`${css['ModeCard']} ${isDisabled ? css['ModeCard--disabled'] : ''}`}
      onClick={() => !isDisabled && onSelect(mode)}
      disabled={isDisabled}
      type="button"
    >
      <span className={css['ModeCard-title']}>{title}</span>
      <span className={css['ModeCard-description']}>{description}</span>
      {isDisabled && <span className={css['ModeCard-badge']}>Coming soon</span>}
    </button>
  );
}

export function EntryModeStep() {
  const { update, goNext } = useWizardContext();

  const handleSelect = (mode: WizardMode) => {
    update({ mode });
    goNext();
  };

  return (
    <div className={css['EntryModeStep']}>
      <p className={css['EntryModeStep-prompt']}>How would you like to start?</p>

      <div className={css['EntryModeStep-cards']}>
        <ModeCard
          mode="quick"
          title="Quick Start"
          description="Blank project with Modern preset. Name it, pick a folder, and build."
          onSelect={handleSelect}
        />
        <ModeCard
          mode="guided"
          title="Guided Setup"
          description="Walk through name, description, and style preset step by step."
          onSelect={handleSelect}
        />
        <ModeCard
          mode="ai"
          title="AI Project Builder"
          description="Describe what you want to build and AI sets up the scaffolding."
          isDisabled
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
