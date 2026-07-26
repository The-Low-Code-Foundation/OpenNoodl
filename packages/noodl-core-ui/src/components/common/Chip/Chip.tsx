import classNames from 'classnames';
import React from 'react';

import { Slot } from '@noodl-core-ui/types/global';

import css from './Chip.module.scss';

export enum ChipVariant {
  Neutral = 'neutral',
  Accent = 'accent',
  Warning = 'warning',
  Danger = 'danger',
  Success = 'success'
}

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  /** Optional leading icon (e.g. a warning triangle). */
  icon?: Slot;
  testId?: string;
}

/**
 * One canonical soft-bg / strong-fg chip. Replaces the ad-hoc badges scattered
 * across panels (mock reference uses: "Local only", "React 17 runtime").
 * Per phase law, `danger` is the only red variant.
 */
export function Chip({ label, variant = ChipVariant.Neutral, icon, testId }: ChipProps) {
  return (
    <span className={classNames(css['Root'], css[`is-variant-${variant}`])} data-test={testId}>
      {icon && <span className={css['Icon']}>{icon}</span>}
      {label}
    </span>
  );
}
