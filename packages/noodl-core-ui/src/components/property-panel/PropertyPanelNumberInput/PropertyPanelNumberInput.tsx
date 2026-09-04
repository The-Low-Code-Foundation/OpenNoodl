import React, { useState, useEffect } from 'react';

import {
  PropertyPanelBaseInput,
  PropertyPanelBaseInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import { ScrubBinding, useDragToScrub } from '@noodl-core-ui/components/property-panel/scrub';

import { readNumberInputText } from './numberInputEdit';

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
    const current = value?.toString() || '';
    const edit = readNumberInputText(inputValue);

    if (edit.kind === 'empty') {
      setDisplayedInputValue('');
      if (current !== '') {
        onChange && onChange(inputValue);
      }
      return;
    }

    if (edit.kind === 'number') {
      setDisplayedInputValue(edit.text);
      if (edit.text !== current) {
        onChange && onChange(edit.value);
      }
      return;
    }

    // REL-014 — text this field cannot read as a number is NOT this component's
    // to throw away. See `numberInputEdit`: the branch that used to be missing
    // here is why `var(--space-4)` could never survive a plain number port, and
    // why a mistyped value left the field showing something the model did not
    // hold. The row decides; this hands it down.
    //
    // 🔴 The snap-back is what makes a refusal visible, and it has to happen
    // *before* the hand-off. If the row accepts (a token), `value` changes and
    // the effect above re-seeds the field from it; if the row refuses, nothing
    // is written, `value` does not change, the effect does not fire — and the
    // typed text would otherwise stay on screen looking accepted.
    setDisplayedInputValue(current);
    if (edit.text !== current) {
      onChange && onChange(edit.text);
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
