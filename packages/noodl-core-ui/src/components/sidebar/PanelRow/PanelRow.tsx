import classNames from 'classnames';
import React from 'react';

import { Slot, UnsafeStyleProps } from '@noodl-core-ui/types/global';

import css from './PanelRow.module.scss';

export enum PanelRowVariant {
  /**
   * Default. One control — or a small cluster, e.g. a colour swatch beside a
   * hex field — sharing the row with its label. The first control fills the
   * column.
   */
  Control = 'is-variant-control',
  /**
   * A row of buttons. They wrap and share the width rather than scrolling
   * sideways out of the panel.
   */
  Actions = 'is-variant-actions',
  /**
   * A checkbox or switch. The label takes the row and the control hugs the
   * trailing edge, at every width — a toggle stacked under its own label reads
   * as two unrelated rows.
   */
  Toggle = 'is-variant-toggle'
}

export interface PanelRowProps extends UnsafeStyleProps {
  /**
   * Always required, even when hidden: it is the row's accessible name.
   */
  label: string;

  /**
   * Keep the label for assistive technology but take it out of the layout. The
   * row becomes a labelled group so the name is still announced.
   */
  isLabelHidden?: boolean;

  variant?: PanelRowVariant;

  /** The control, or several. Laid out as a wrapping flex row. */
  children: Slot;

  /**
   * Guidance under the control. Sits in the control column so it lines up with
   * what it explains, and takes the full row in the compact band.
   */
  helpText?: Slot;

  /**
   * Trailing affordance that must never shrink or wrap away from its control —
   * the expression/binding toggle, a browse button.
   */
  fxSlot?: Slot;

  /** Force the compact (label-above-control) layout at every width. */
  isStacked?: boolean;

  /** The value differs from its default: the label is accented. */
  isChanged?: boolean;

  /** With `isChanged`, shows a dot that resets the value on click. */
  onReset?: () => void;

  /**
   * `id` of the control this labels. When given the label becomes a real
   * `<label for>` and clicking it focuses the control.
   */
  htmlFor?: string;

  testId?: string;
}

/**
 * PNL-004 — the side panel's one label/control row.
 *
 * Three bands, declared once in `panel-bands.scss` and queried against the
 * `panel-body` container that `BasePanel` establishes:
 *
 *   compact  (< 340px)  label above control, controls full-width, actions wrap
 *   default  (340–559)  104px label column, control beside it
 *   wide     (>= 560)   132px label column
 *
 * The *default* band is the unqueried baseline, so a row rendered outside any
 * `panel-body` container — a story, a modal, a panel not yet migrated to
 * `BasePanel` — still lays out correctly rather than collapsing.
 *
 * A card may declare `panel-body` on itself (see `LocalBackendCard`), in which
 * case its rows respond to the card's width rather than the panel's.
 */
export function PanelRow({
  label,
  isLabelHidden,
  variant = PanelRowVariant.Control,
  children,
  helpText,
  fxSlot,
  isStacked,
  isChanged,
  onReset,
  htmlFor,
  testId,
  UNSAFE_className,
  UNSAFE_style
}: PanelRowProps) {
  const labelContent = (
    <>
      {label}
      {isChanged && onReset && (
        <span
          className={css['ResetDot']}
          title="Reset to default"
          onClick={onReset}
          role="button"
          aria-label={`Reset ${label}`}
        />
      )}
    </>
  );

  const labelClassName = classNames(
    css['Label'],
    isChanged && css['is-changed'],
    isLabelHidden && css['is-hidden']
  );

  return (
    <div
      className={classNames(
        css['Root'],
        css[variant],
        isStacked && css['is-stacked'],
        // On the row, not just the label: a hidden label must not reserve its
        // grid column, or every hidden-label row grows a 104px hole.
        isLabelHidden && css['is-label-hidden'],
        UNSAFE_className
      )}
      style={UNSAFE_style}
      data-test={testId}
      // A hidden label is only a label if something announces it. `for` is the
      // better association when the caller can give the control an id; this is
      // the fallback that works without one.
      role={isLabelHidden ? 'group' : undefined}
      aria-label={isLabelHidden ? label : undefined}
    >
      {htmlFor ? (
        <label className={labelClassName} htmlFor={htmlFor}>
          {labelContent}
        </label>
      ) : (
        <span className={labelClassName}>{labelContent}</span>
      )}

      <div className={css['Control']}>
        {children}
        {fxSlot && <div className={css['Fx']}>{fxSlot}</div>}
      </div>

      {helpText && <div className={css['Help']}>{helpText}</div>}
    </div>
  );
}
