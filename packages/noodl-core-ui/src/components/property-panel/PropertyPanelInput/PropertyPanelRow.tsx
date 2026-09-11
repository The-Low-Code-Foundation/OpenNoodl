import classNames from 'classnames';
import React from 'react';

import { BindingChip } from '@noodl-core-ui/components/property-panel/BindingChip';
import { Slot } from '@noodl-core-ui/types/global';

import css from './PropertyPanelInput.module.scss';

export interface PropertyPanelRowProps {
  isChanged?: boolean;
  label: string;
  children: Slot;
  /** When set and the value is changed from its default, a dot is shown that resets the value on click */
  onReset?: () => void;

  /**
   * FB-018. The rows that are not built out of `PropertyPanelInput` — the number+unit
   * row (Width/Height), the picker rows (image, font, component, identifier, text
   * style, source file) and the icon row — reach the binding chip through here.
   *
   * 🔴 THIS IS A SEAM, NOT A SECOND IMPLEMENTATION. Those rows had `isConnected`
   * already and spent it on a 1px outline around a field that stayed fully editable,
   * so typing into a connected Width silently wrote a value the connection would
   * overwrite. Rather than teach three components to draw a chip — three chances to
   * drift from the one `PropertyPanelInput` draws — they each pass the connection
   * down to the row they were already wrapping themselves in.
   */
  isConnected?: boolean;
  /** The source label for the chip, e.g. "CallCF · Result". */
  connectionLabel?: string;
  /** Click-to-navigate to the driving node; the chip is read-only without it. */
  onConnectionClick?: () => void;
}

export function PropertyPanelRow({
  isChanged,
  label,
  children,
  onReset,
  isConnected,
  connectionLabel,
  onConnectionClick
}: PropertyPanelRowProps) {
  // The chip REPLACES the row's controls rather than sitting beside them. For the
  // number+unit row that also retires the unit dropdown and the Fixed checkbox while
  // connected, which is correct: they edit parts of a value the connection supplies
  // whole.
  const showsChanged = isChanged && !isConnected;

  return (
    <div className={css['Root']}>
      <div className={classNames(css['Label'], showsChanged && css['is-changed'])}>
        {label}
        {showsChanged && onReset && <span className={css['ResetDot']} title="Reset to default" onClick={onReset} />}
      </div>
      <div className={css['InputContainer']}>
        {isConnected ? <BindingChip source={connectionLabel} onClick={onConnectionClick} /> : children}
      </div>
    </div>
  );
}
