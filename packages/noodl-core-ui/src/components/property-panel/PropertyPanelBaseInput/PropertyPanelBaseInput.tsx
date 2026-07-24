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

  /** Rendered as data-identifier, used for input targeting (e.g. node double-click focus actions) */
  dataIdentifier?: string;
  /** Rendered as data-type (the legacy color input carried data-type="color") */
  dataType?: string;

  onChange?: (value: ValueType) => void;
  onClick?: MouseEventHandler<HTMLInputElement>;
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

  dataIdentifier,
  dataType,

  onChange,
  onClick,
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
        hasSmallText && css['has-small-text']
      )}
      type={type}
      value={value}
      data-identifier={dataIdentifier}
      data-type={dataType}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}
