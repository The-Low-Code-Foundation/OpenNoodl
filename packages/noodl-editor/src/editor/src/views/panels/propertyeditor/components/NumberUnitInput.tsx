import React, { useEffect, useState } from 'react';

import { PropertyPanelBaseInput } from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';

export interface NumberUnitInputProps {
  label: string;
  /** The numeric part, as a string ('' when unset) */
  value: string;
  unit: string;
  units: string[];

  isChanged?: boolean;
  isConnected?: boolean;
  dataIdentifier?: string;

  /** Dimension rows show the Fixed checkbox when the unit is % */
  showFixed?: boolean;
  isFixed?: boolean;
  isPercent?: boolean;

  /** Commit the typed text (may include a unit suffix, e.g. '50%') */
  onCommit: (text: string) => void;
  /** A unit was picked from the dropdown; commits with the currently displayed text */
  onUnitChange: (unit: string, currentText: string) => void;
  onFixedToggle?: () => void;
  onReset?: () => void;
}

export function NumberUnitInput({
  label,
  value,
  unit,
  units,
  isChanged,
  isConnected,
  dataIdentifier,
  showFixed,
  isFixed,
  isPercent,
  onCommit,
  onUnitChange,
  onFixedToggle,
  onReset
}: NumberUnitInputProps) {
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
    <PropertyPanelRow label={label} isChanged={isChanged} onReset={onReset}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <PropertyPanelBaseInput
          type="text"
          value={displayedValue}
          isChanged={isChanged}
          isConnected={isConnected}
          dataIdentifier={dataIdentifier}
          onChange={(text) => setDisplayedValue(String(text))}
          onBlur={() => commitIfChanged()}
          onKeyDown={(e) => e.key === 'Enter' && commitIfChanged()}
        />
        <div style={{ width: 40, flexShrink: 0 }}>
          <PropertyPanelSelectInput
            value={unit}
            properties={{ options: units.map((u) => ({ label: u, value: u })) }}
            onChange={(u) => onUnitChange(String(u), displayedValue)}
            hasHiddenCaret
            hasSmallText
          />
        </div>

        {showFixed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              opacity: isPercent ? 1 : 0.3,
              pointerEvents: isPercent ? 'auto' : 'none'
            }}
          >
            <label
              className="property-label"
              style={{ position: 'relative', width: 'auto', marginLeft: 6, marginRight: 4 }}
            >
              Fixed
            </label>
            <div
              className="sidebar-panel-dark-input"
              style={{ width: 26, height: 26, position: 'relative', cursor: 'pointer' }}
              onClick={() => onFixedToggle && onFixedToggle()}
            >
              {isFixed && <i className="fa fa-check" style={{ position: 'absolute', left: 7, top: 6 }} />}
            </div>
          </div>
        )}
      </div>
    </PropertyPanelRow>
  );
}
