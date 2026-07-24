import React, { useState, useEffect } from 'react';

import {
  PropertyPanelBaseInput,
  PropertyPanelBaseInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';

import { extractNumber } from '../../../utils/extractNumber';

export function PropertyPanelNumberInput({
  value,
  isChanged,
  isConnected,
  dataIdentifier,
  onChange,
  onFocus,
  onBlur,
  onKeyDown
}: PropertyPanelBaseInputProps) {
  // TODO: This component doesnt handle the value types correct

  const [displayedInputValue, setDisplayedInputValue] = useState(value?.toString() || '');

  useEffect(() => {
    setDisplayedInputValue(value?.toString() || '');
  }, [value]);

  function handleUpdate(inputValue: string) {
    // TODO: increase/decrease with arrows
    // TODO: handle drag up/down to increase/decrease
    // TODO: add basic arithmetic

    // Only commit real edits — committing unconditionally would push a
    // spurious undo entry on every mount/blur and neutralize app undo
    if (inputValue === '') {
      setDisplayedInputValue('');
      if ((value?.toString() || '') !== '') {
        onChange && onChange(inputValue);
      }
      return;
    }

    const newNumber = extractNumber(inputValue);

    if (!isNaN(newNumber)) {
      setDisplayedInputValue(newNumber.toString());
      if (newNumber.toString() !== (value?.toString() || '')) {
        onChange && onChange(newNumber);
      }
    }
  }

  return (
    <PropertyPanelBaseInput
      value={displayedInputValue}
      type="text"
      isChanged={isChanged}
      isConnected={isConnected}
      dataIdentifier={dataIdentifier}
      onChange={(value) => setDisplayedInputValue(String(value))}
      onFocus={onFocus}
      onBlur={(e) => {
        handleUpdate(displayedInputValue);
        onBlur && onBlur(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleUpdate(displayedInputValue);
        }

        onKeyDown && onKeyDown(e);
      }}
    />
  );
}
