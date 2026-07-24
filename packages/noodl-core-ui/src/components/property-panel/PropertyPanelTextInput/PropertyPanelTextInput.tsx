import React, { useEffect, useState } from 'react';

import {
  PropertyPanelBaseInput,
  PropertyPanelBaseInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';

export interface PropertyPanelTextInputProps extends Omit<PropertyPanelBaseInputProps<string>, 'type'> {
  value: string;
}

export function PropertyPanelTextInput({
  value,
  isChanged,
  isConnected,
  dataIdentifier,

  onChange
}: PropertyPanelTextInputProps) {
  const [displayedInputValue, setDisplayedInputValue] = useState(value);

  function handleUpdate(inputValue: string) {
    setDisplayedInputValue(inputValue);
    // Only commit real edits — committing unconditionally would push a
    // spurious undo entry on every mount/blur and neutralize app undo
    if (inputValue !== value) {
      onChange && onChange(inputValue);
    }
  }

  useEffect(() => {
    setDisplayedInputValue(value);
  }, [value]);

  return (
    <PropertyPanelBaseInput
      value={displayedInputValue}
      type="text"
      isChanged={isChanged}
      isConnected={isConnected}
      dataIdentifier={dataIdentifier}
      onChange={(value) => setDisplayedInputValue(String(value))}
      onBlur={(e) => handleUpdate(displayedInputValue)}
      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(displayedInputValue)}
    />
  );
}
