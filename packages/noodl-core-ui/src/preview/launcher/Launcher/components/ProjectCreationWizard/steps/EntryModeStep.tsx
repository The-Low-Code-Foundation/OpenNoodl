/**
 * EntryModeStep - First screen of the Project Creation Wizard
 *
 * Lets the user choose between Quick Start, Guided Setup, or AI Builder.
 *
 * AIX-012: the AI card used to be hardcoded `isDisabled` with a "Coming soon"
 * badge, which is the same failure as `size={IconSize.*}` being a no-op at 130
 * call sites — present, offered, inert. It is now gated on one thing only, the
 * availability the host reports, and when that is false the card says *why* and
 * offers the way to fix it instead of a badge that cannot be acted on.
 */
import React from 'react';

import { WizardMode, useWizardContext } from '../WizardContext';
import css from './EntryModeStep.module.scss';

/**
 * What the host knows about whether an AI-scoped project is possible right now.
 * `reason` is shown to the user verbatim, so it has to be a sentence, not a
 * code — "AI is turned off in Editor Settings", not "not-configured".
 */
export interface AiAvailability {
  available: boolean;
  reason?: string;
  /** Label for the route out of the dead end. Omitted = no route offered. */
  actionLabel?: string;
  onAction?: () => void;
}

interface ModeCardProps {
  mode: WizardMode;
  title: string;
  description: string;
  isDisabled?: boolean;
  badge?: string;
  /** Shown under the description when the card is disabled. */
  reason?: string;
  action?: { label: string; onClick: () => void };
  onSelect: (mode: WizardMode) => void;
}

function ModeCard({ mode, title, description, isDisabled, badge, reason, action, onSelect }: ModeCardProps) {
  return (
    <div className={`${css['ModeCard']} ${isDisabled ? css['ModeCard--disabled'] : ''}`}>
      {/* The clickable surface is its own button so the "configure" action
          below can stay reachable while the card itself is disabled. */}
      <button
        className={css['ModeCard-hit']}
        onClick={() => !isDisabled && onSelect(mode)}
        disabled={isDisabled}
        type="button"
      >
        <span className={css['ModeCard-title']}>{title}</span>
        <span className={css['ModeCard-description']}>{description}</span>
      </button>

      {badge && <span className={css['ModeCard-badge']}>{badge}</span>}

      {isDisabled && reason && (
        <div className={css['ModeCard-reason']}>
          <span>{reason}</span>
          {action && (
            <button className={css['ModeCard-action']} type="button" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface EntryModeStepProps {
  /**
   * Omitted means "the host has not told us" — treated as unavailable with a
   * generic reason rather than as available, because offering a path that then
   * fails on the next screen is exactly what this prop exists to prevent.
   */
  aiAvailability?: AiAvailability;
}

export function EntryModeStep({ aiAvailability }: EntryModeStepProps) {
  const { update, goNext } = useWizardContext();

  const handleSelect = (mode: WizardMode) => {
    update({ mode });
    goNext();
  };

  const ai: AiAvailability = aiAvailability ?? {
    available: false,
    reason: 'This build of the launcher cannot reach the AI settings.'
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
        {/* FB-005 T3. 🔴 Always offered, and the reason is a fact rather than optimism:
            `EmbeddedTemplateProvider` is compiled into this editor, so the shelf has at least
            one row with no network at all. This card is not gated the way "Start with AI" is
            because there is nothing to gate it on. */}
        <ModeCard
          mode="template"
          title="Start from a Template"
          description="Begin with a project that is already built — a starter, a dashboard, a form — and change it from there."
          onSelect={handleSelect}
        />
        <ModeCard
          mode="ai"
          title="Start with AI"
          description="Describe the app you want, talk the scope through, and get a documented project with a plan to review. Nothing is built until you say so."
          isDisabled={!ai.available}
          reason={ai.reason}
          action={ai.actionLabel && ai.onAction ? { label: ai.actionLabel, onClick: ai.onAction } : undefined}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
