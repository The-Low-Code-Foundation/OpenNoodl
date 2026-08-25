import React, { useState, useEffect } from 'react';

import {
  PropertyPanelBaseInput,
  PropertyPanelBaseInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import { ScrubBinding, useDragToScrub } from '@noodl-core-ui/components/property-panel/scrub';

import { extractNumber } from '../../../utils/extractNumber';

export interface PropertyPanelNumberInputProps extends PropertyPanelBaseInputProps {
  /**
   * FB-022 — drag-to-scrub, when the row's port type says this number can be dragged.
   * Absent for every field whose row did not opt in, which is what keeps this a property of
   * the port type rather than of the component.
   */
  scrub?: ScrubBinding;
}

export function PropertyPanelNumberInput({
  value,
  isChanged,
  isConnected,
  dataIdentifier,
  scrub,
  onChange,
  onFocus,
  onBlur,
  onKeyDown
}: PropertyPanelNumberInputProps) {
  // TODO: This component doesnt handle the value types correct

  const [displayedInputValue, setDisplayedInputValue] = useState(value?.toString() || '');
  // ⚠️ The drag writes through the row (`scrub.onScrub`), never through `handleUpdate`. That
  // path parses text and pushes an undo entry per call, which is precisely what a scrub must
  // not do — the row's `onScrubEnd` records the one entry for the whole gesture.
  const dragToScrub = useDragToScrub(scrub);

  useEffect(() => {
    setDisplayedInputValue(value?.toString() || '');
  }, [value]);

  function handleUpdate(inputValue: string) {
    // TODO: increase/decrease with arrows
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
      isNumeric
      isChanged={isChanged}
      isConnected={isConnected}
      isScrubbable={Boolean(scrub)}
      dataIdentifier={dataIdentifier}
      onChange={(value) => setDisplayedInputValue(String(value))}
      onMouseDown={dragToScrub.onMouseDown}
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
