import classNames from 'classnames';
import React, { useEffect, useState } from 'react';

import css from './PropertyPanelTextArea.module.scss';

export interface PropertyPanelTextAreaProps {
  value: string;

  isChanged?: boolean;
  isConnected?: boolean;

  onChange?: (value: string) => void;
}

export function PropertyPanelTextArea({ value, isChanged, isConnected, onChange }: PropertyPanelTextAreaProps) {
  const [displayedValue, setDisplayedValue] = useState(value ?? '');

  useEffect(() => {
    setDisplayedValue(value ?? '');
  }, [value]);

  // Commits on blur, like the single-line text input; typing only updates local state.
  return (
    <textarea
      className={classNames(css['Root'], isChanged && css['is-changed'], isConnected && css['is-connected'])}
      value={displayedValue}
      onChange={(e) => setDisplayedValue(e.target.value)}
      onBlur={() => onChange && onChange(displayedValue)}
    />
  );
}
