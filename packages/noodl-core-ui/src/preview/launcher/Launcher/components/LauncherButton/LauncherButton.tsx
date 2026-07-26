/**
 * LauncherButton - the launcher mock's `.btn` (PAR-001)
 *
 * 13px/500, padding 7px 13px, radius 7, gap 7. Three variants straight from the
 * mock: primary (accent), secondary (bg-2 + border-2), ghost (borderless).
 * Launcher-local on purpose — the editor-wide PrimaryButton keeps its own scale.
 *
 * @module noodl-core-ui/preview/launcher
 */

import classNames from 'classnames';
import React from 'react';

import css from './LauncherButton.module.scss';

export enum LauncherButtonVariant {
  Primary = 'is-primary',
  Secondary = 'is-secondary',
  Ghost = 'is-ghost'
}

export interface LauncherButtonProps {
  label: string;
  variant?: LauncherButtonVariant;
  /** Rendered before the label (e.g. a 14-15px inline SVG). */
  icon?: React.ReactNode;
  isDisabled?: boolean;
  onClick?: () => void;
  testId?: string;
}

export function LauncherButton({
  label,
  variant = LauncherButtonVariant.Primary,
  icon,
  isDisabled,
  onClick,
  testId
}: LauncherButtonProps) {
  return (
    <button
      type="button"
      className={classNames(css['Root'], css[variant])}
      disabled={isDisabled}
      onClick={onClick}
      data-test={testId}
    >
      {icon}
      {label}
    </button>
  );
}
