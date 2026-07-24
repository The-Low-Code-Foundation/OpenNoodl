import React, { useEffect, useState } from 'react';

import {
  PropertyPanelBaseInput,
  PropertyPanelBaseInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';

export interface PropertyPanelPasswordInputProps extends Omit<PropertyPanelBaseInputProps<string>, 'type'> {
  value: string;
}

export function PropertyPanelPasswordInput({
  value,
  isChanged,
  isConnected,

  onChange
}: PropertyPanelPasswordInputProps) {
  const [displayedInputValue, setDisplayedInputValue] = useState(value);
  const [focused, setFocused] = useState(false);

  function handleUpdate(inputValue: string) {
    setDisplayedInputValue(inputValue);
    // Only commit real edits — committing unconditionally would push a
    // spurious undo entry on every mount/blur and neutralize app undo
    if (inputValue !== value) {
      onChange && onChange(inputValue);
    }
  }

  function handleBlur() {
    handleUpdate(displayedInputValue);
    setFocused(false);
  }

  function handleFocus() {
    setFocused(true);
  }

  useEffect(() => {
    setDisplayedInputValue(value);
  }, [value]);

  return (
    <PropertyPanelBaseInput
      value={displayedInputValue}
      type={focused ? 'text' : 'password'}
      isChanged={isChanged}
      isConnected={isConnected}
      onChange={(value) => setDisplayedInputValue(String(value))}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(displayedInputValue)}
    />
  );
}
