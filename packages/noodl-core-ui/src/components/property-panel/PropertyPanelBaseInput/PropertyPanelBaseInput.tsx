import classNames from 'classnames';
import React, { FocusEventHandler, KeyboardEventHandler, MouseEventHandler } from 'react';

import css from './PropertyPanelBaseInput.module.scss';

export interface PropertyPanelBaseInputProps<ValueType = string | number> {
  value: ValueType;
  type: string;

  isChanged?: boolean;
  isConnected?: boolean;
  isFauxFocused?: boolean;
  hasHiddenCaret?: boolean;
  hasSmallText?: boolean;
  /** Numeric presentation (mock `.input.num`): mono 11.5px, centered. */
  isNumeric?: boolean;
  /**
   * FB-022 — this field's number can be dragged, so it offers an `ew-resize` cursor.
   *
   * ⚠️ Presentation only, and deliberately separate from `onMouseDown`. The gesture lives in
   * `useDragToScrub`, which this component does not call: it has no hooks, and several specs
   * evaluate element trees containing it in a runner with no React dispatcher. Keeping the
   * hook in the two callers is what keeps this component gradeable there.
   */
  isScrubbable?: boolean;

  /** Rendered as data-identifier, used for input targeting (e.g. node double-click focus actions) */
  dataIdentifier?: string;
  /** Rendered as data-type (the legacy color input carried data-type="color") */
  dataType?: string;
  /** Shape hint shown while the field is empty — FB-015, driven by the port's own metadata. */
  placeholder?: string;

  onChange?: (value: ValueType) => void;
  onClick?: MouseEventHandler<HTMLInputElement>;
  onMouseDown?: MouseEventHandler<HTMLInputElement>;
  onMouseEnter?: MouseEventHandler<HTMLInputElement>;
  onMouseLeave?: MouseEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler;
  onError?: (error: Error) => void;

  className?: string;
}

export function PropertyPanelBaseInput({
  value,
  type,

  isChanged,
  isConnected,
  isFauxFocused,
  hasHiddenCaret,
  hasSmallText,
  isNumeric,
  isScrubbable,

  dataIdentifier,
  dataType,
  placeholder,

  onChange,
  onClick,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onKeyDown,

  className
}: PropertyPanelBaseInputProps) {
  return (
    <input
      className={classNames(
        css['Root'],
        isChanged && css['is-changed'],
        isConnected && css['is-connected'],
        hasHiddenCaret && css['has-hidden-caret'],
        isFauxFocused && css['is-faux-focused'],
        hasSmallText && css['has-small-text'],
        isNumeric && css['is-numeric'],
        isScrubbable && css['is-scrubbable']
      )}
      type={type}
      // A port with no value resolves to null; React wants '' for a controlled input
      value={value === null ? '' : value}
      data-identifier={dataIdentifier}
      data-type={dataType}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}
