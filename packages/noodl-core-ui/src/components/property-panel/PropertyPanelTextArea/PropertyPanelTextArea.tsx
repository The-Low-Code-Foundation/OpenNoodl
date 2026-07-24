import classNames from 'classnames';
import React, { useEffect, useState } from 'react';

import css from './PropertyPanelTextArea.module.scss';

export interface PropertyPanelTextAreaProps {
  value: string;

  isChanged?: boolean;
  isConnected?: boolean;

  /** Rendered as data-identifier, used for input targeting (e.g. node double-click focus actions) */
  dataIdentifier?: string;

  onChange?: (value: string) => void;
}

export function PropertyPanelTextArea({
  value,
  isChanged,
  isConnected,
  dataIdentifier,
  onChange
}: PropertyPanelTextAreaProps) {
  const [displayedValue, setDisplayedValue] = useState(value ?? '');

  useEffect(() => {
    setDisplayedValue(value ?? '');
  }, [value]);

  // Commits on blur, like the single-line text input; typing only updates local state.
  return (
    <textarea
      className={classNames(css['Root'], isChanged && css['is-changed'], isConnected && css['is-connected'])}
      value={displayedValue}
      data-identifier={dataIdentifier}
      onChange={(e) => setDisplayedValue(e.target.value)}
      onBlur={() => onChange && onChange(displayedValue)}
    />
  );
}
