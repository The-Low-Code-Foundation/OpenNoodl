import React, { useEffect, useState } from 'react';

import { PropertyPanelBaseInput } from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput/PropertyPanelRow';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';

export interface NumberUnitInputProps {
  label: string;
  /** The numeric part, as a string ('' when unset) */
  value: string;
  unit: string;
  units: string[];

  isChanged?: boolean;
  isConnected?: boolean;
  /** FB-018: the source driving this port, for the binding chip. */
  connectionLabel?: string;
  /** FB-018: click-to-navigate to the driving node. */
  onConnectionClick?: () => void;
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
  connectionLabel,
  onConnectionClick,
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

  const hasUnitChoice = (units?.length ?? 0) > 1;
  const staticUnit = unit || units?.[0] || '';

  useEffect(() => {
    setDisplayedValue(value ?? '');
  }, [value]);

  function commitIfChanged() {
    if (displayedValue !== (value ?? '')) {
      onCommit(displayedValue);
    }
  }

  return (
    // FB-018 AC1 — this is the row the test user hit. Width was a fully editable
    // field with a 1px outline while a connection drove it, so typing a width
    // rendered and then reverted, and nothing on screen explained why.
    <PropertyPanelRow
      label={label}
      isChanged={isChanged}
      onReset={onReset}
      isConnected={isConnected}
      connectionLabel={connectionLabel}
      onConnectionClick={onConnectionClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <PropertyPanelBaseInput
          type="text"
          isNumeric
          value={displayedValue}
          isChanged={isChanged}
          isConnected={isConnected}
          dataIdentifier={dataIdentifier}
          onChange={(text) => setDisplayedValue(String(text))}
          onBlur={() => commitIfChanged()}
          onKeyDown={(e) => e.key === 'Enter' && commitIfChanged()}
        />
        {/* FH-014. About half the unit-bearing ports declare exactly one unit
            (21x ['px'], 4x ['%'], 1x ['deg'] — Font Size, Padding, Border Width,
            the Shadow numbers, Rotation...). A dropdown offering one immutable
            choice is noise, so those render a static unit label instead. */}
        {hasUnitChoice ? (
          <div style={{ width: 40, flexShrink: 0 }}>
            <PropertyPanelSelectInput
              value={unit}
              properties={{ options: units.map((u) => ({ label: u, value: u })) }}
              onChange={(u) => onUnitChange(String(u), displayedValue)}
              hasHiddenCaret
              hasSmallText
            />
          </div>
        ) : (
          Boolean(staticUnit) && (
            <div
              style={{
                width: 40,
                flexShrink: 0,
                textAlign: 'center',
                fontSize: 10,
                lineHeight: '28px',
                color: 'var(--theme-color-fg-default)',
                userSelect: 'none'
              }}
            >
              {staticUnit}
            </div>
          )
        )}

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
