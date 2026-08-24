import React, { useEffect, useState } from 'react';

import { PropertyPanelBaseInput } from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput/PropertyPanelRow';

export interface PickerTextInputProps {
  label: string;
  value: string;

  isChanged?: boolean;
  isConnected?: boolean;
  /** FB-018: the source driving this port, for the binding chip. */
  connectionLabel?: string;
  /** FB-018: click-to-navigate to the driving node. */
  onConnectionClick?: () => void;

  /** Commit the typed value (blur / Enter, only when actually changed) */
  onCommit: (value: string) => void;
  /** Open the picker popout. `anchor` is the input element. */
  onOpenPicker: (anchor: HTMLElement) => void;
  /** Live filter as the user types while the picker is open */
  onFilter?: (text: string) => void;
  onEnter?: () => void;
  onReset?: () => void;
  dataIdentifier?: string;
}

/**
 * The shared row shape of the legacy font/image/identifier/component rows:
 * a text input that commits on change, opens a picker popout on click, and
 * live-filters the picker while typing.
 */
export function PickerTextInput({
  label,
  value,
  isChanged,
  isConnected,
  connectionLabel,
  onConnectionClick,
  onCommit,
  onOpenPicker,
  onFilter,
  onEnter,
  onReset,
  dataIdentifier
}: PickerTextInputProps) {
  const [displayedValue, setDisplayedValue] = useState(value ?? '');

  useEffect(() => {
    setDisplayedValue(value ?? '');
  }, [value]);

  function commitIfChanged() {
    if (displayedValue !== (value ?? '')) {
      onCommit(displayedValue);
    }
  }

  return (
    <PropertyPanelRow
      label={label}
      isChanged={isChanged}
      onReset={onReset}
      isConnected={isConnected}
      connectionLabel={connectionLabel}
      onConnectionClick={onConnectionClick}
    >
      <PropertyPanelBaseInput
        type="text"
        value={displayedValue}
        isChanged={isChanged}
        isConnected={isConnected}
        dataIdentifier={dataIdentifier}
        onChange={(text) => {
          setDisplayedValue(String(text));
          onFilter && onFilter(String(text));
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenPicker(e.currentTarget);
        }}
        onFocus={(e) => e.stopPropagation()}
        onBlur={() => commitIfChanged()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitIfChanged();
            onEnter && onEnter();
          }
        }}
      />
    </PropertyPanelRow>
  );
}
