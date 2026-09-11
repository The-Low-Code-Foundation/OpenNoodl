import classNames from 'classnames';
import React from 'react';

import { exportBadgeTitle, type ExportBadge as ExportBadgeData } from '@noodl-utils/codeExport/exportBadge';

import css from './ExportBadge.module.scss';

export interface ExportBadgeProps {
  badge: ExportBadgeData | undefined;
  /**
   * Where the badge sits. `header` is the property panel (room for the words); `card` is a
   * text badge for a wide row; `dot` is the picker card's right-hand slot — a card is ~150px
   * and its name line is ellipsised, so words there are clipped before they are read
   * (measured on the drive, `drive13-03-picker.png`). The dot carries the words as `title`
   * and `aria-label`, and the preview pane beside the grid prints them in full.
   */
  variant?: 'card' | 'header' | 'dot';
  className?: string;
}

/**
 * EXP-013 AC1 — the "Not exportable yet" / "Not exportable" mark.
 *
 * One component for the picker card and the property-panel header, so the two surfaces cannot
 * say different things about the same type. It draws nothing for `undefined`, which is the value
 * every exporting type produces — so it can sit unconditionally in both places.
 *
 * 🔴 **No hooks and no `Icon` import**, on purpose: that is what lets `tests-unit/exp-013` evaluate
 * it as an element tree (memory `this-jest-can-grade-a-react-component`), one card of each
 * status beside a `translated` control. A glyph is a CSS pseudo-element for the same reason.
 *
 * The full reason is the `title` — a hover, which is the cheapest "expand" there is — and the
 * picker's preview pane prints it in full beside the docs.
 */
export function ExportBadge({ badge, variant = 'card', className }: ExportBadgeProps) {
  if (!badge) return null;
  const title = exportBadgeTitle(badge);
  return (
    <span
      className={classNames(css['Root'], css[`Root--${variant}`], css[`Root--${badge.kind}`], className)}
      title={title}
      aria-label={variant === 'dot' ? title : undefined}
      data-test="export-badge"
      data-export-status={badge.kind}
    >
      {variant === 'dot' ? null : badge.label}
    </span>
  );
}
