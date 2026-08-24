import React, { useEffect, useState } from 'react';

import { PropertyPanelBaseInput } from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput/PropertyPanelRow';

export interface ColorInputProps {
  label: string;
  /** The display string for the input ('#RRGGBB', color style name, or '') */
  value: string;
  /** The resolved CSS color for the thumbnail */
  resolvedColor: string | undefined;

  isChanged?: boolean;
  isConnected?: boolean;
  /** FB-018: the source driving this port, for the binding chip. */
  connectionLabel?: string;
  /** FB-018: click-to-navigate to the driving node. */
  onConnectionClick?: () => void;

  onCommit: (text: string) => void;
  /** Click on the color thumbnail — opens the color picker */
  onOpenColorPicker: (anchor: HTMLElement) => void;
  /** Click on the text input — opens the color style picker */
  onOpenStylePicker: (anchor: HTMLElement) => void;
  onFilter?: (text: string) => void;
  onEnter?: () => void;
  onReset?: () => void;
  dataIdentifier?: string;
}

export function ColorInput({
  label,
  value,
  resolvedColor,
  isChanged,
  isConnected,
  connectionLabel,
  onConnectionClick,
  onCommit,
  onOpenColorPicker,
  onOpenStylePicker,
  onFilter,
  onEnter,
  onReset,
  dataIdentifier
}: ColorInputProps) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <PropertyPanelBaseInput
          type="text"
          value={displayedValue}
          isChanged={isChanged}
          isConnected={isConnected}
          dataIdentifier={dataIdentifier}
          dataType="color"
          onChange={(text) => {
            setDisplayedValue(String(text));
            onFilter && onFilter(String(text));
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenStylePicker(e.currentTarget);
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
        <div
          className="color-thumbnail"
          style={{ flexShrink: 0, position: 'relative', width: 33, height: 33, padding: 0, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenColorPicker(e.currentTarget);
          }}
        >
          <div className="color-thumbnail-content" style={{ backgroundColor: resolvedColor }} />
        </div>
      </div>
    </PropertyPanelRow>
  );
}
