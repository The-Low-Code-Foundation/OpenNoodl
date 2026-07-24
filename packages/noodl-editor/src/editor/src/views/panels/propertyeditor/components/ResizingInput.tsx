import React, { useEffect, useState } from 'react';

import { PropertyPanelBaseInput } from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';

export const RESIZING_PIN_KEYS = [
  'pinLeft',
  'pinRight',
  'pinTop',
  'pinBottom',
  'pinHCenter',
  'pinVCenter',
  'sizeWidth',
  'sizeHeight'
] as const;

export type ResizingPinKey = (typeof RESIZING_PIN_KEYS)[number];
export type ResizingPins = Record<ResizingPinKey, boolean>;

export interface DimValue {
  value: number;
  unit: string;
}

/**
 * The legacy constraint rules: which pins are enabled given the current
 * selection. Committed values treat a disabled pin as unset.
 */
export function computeResizingModes(values: ResizingPins): ResizingPins {
  const modes: ResizingPins = {
    pinLeft: true,
    pinRight: true,
    pinTop: true,
    pinBottom: true,
    pinHCenter: true,
    pinVCenter: true,
    sizeHeight: true,
    sizeWidth: true
  };

  if (values.pinLeft || values.pinRight) modes.pinHCenter = false;
  if (values.pinLeft && values.pinRight) modes.sizeWidth = false;
  else if (values.pinHCenter) {
    modes.pinRight = false;
    modes.pinLeft = false;
  } else if (values.pinLeft && values.sizeWidth) modes.pinRight = false;
  else if (values.pinRight && values.sizeWidth) modes.pinLeft = false;

  if (values.pinTop || values.pinBottom) modes.pinVCenter = false;
  if (values.pinTop && values.pinBottom) modes.sizeHeight = false;
  else if (values.pinVCenter) {
    modes.pinTop = false;
    modes.pinBottom = false;
  } else if (values.pinTop && values.sizeHeight) modes.pinBottom = false;
  else if (values.pinBottom && values.sizeHeight) modes.pinTop = false;

  return modes;
}

interface DimInputProps {
  label: string;
  value: DimValue | undefined;
  defaultValue: DimValue;
  units: string[];
  /** undefined commits a reset back to the default */
  onCommit: (value: DimValue | undefined) => void;
}

function DimInput({ label, value, defaultValue, units, onCommit }: DimInputProps) {
  const number = value !== undefined ? value.value : defaultValue.value;
  const unit = value !== undefined ? value.unit : defaultValue.unit;

  const [displayed, setDisplayed] = useState(String(number ?? ''));

  useEffect(() => {
    setDisplayed(String(number ?? ''));
  }, [number]);

  function commit(text: string, commitUnit: string) {
    const parsed = parseFloat(text);
    if (isNaN(parsed)) {
      // Invalid input resets to the default (legacy semantics)
      onCommit(undefined);
      setDisplayed(String(defaultValue.value ?? ''));
    } else {
      onCommit({ value: parsed, unit: commitUnit });
    }
  }

  return (
    <div style={{ position: 'relative', width: '50%', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <label className="property-label" style={{ position: 'relative', width: 'auto', marginLeft: 3 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
        <PropertyPanelBaseInput
          type="text"
          value={displayed}
          onChange={(text) => setDisplayed(String(text))}
          onBlur={() => displayed !== String(number ?? '') && commit(displayed, unit)}
          onKeyDown={(e) => e.key === 'Enter' && displayed !== String(number ?? '') && commit(displayed, unit)}
        />
        <div style={{ width: 40, flexShrink: 0 }}>
          <PropertyPanelSelectInput
            value={unit}
            properties={{ options: units.map((u) => ({ label: u, value: u })) }}
            onChange={(u) => commit(displayed, String(u))}
            hasHiddenCaret
            hasSmallText
          />
        </div>
      </div>
    </div>
  );
}

export interface ResizingInputProps {
  pins: ResizingPins;
  width: DimValue | undefined;
  height: DimValue | undefined;
  defaultWidth: DimValue;
  defaultHeight: DimValue;
  widthUnits: string[];
  heightUnits: string[];

  onPinToggle: (pin: ResizingPinKey) => void;
  onWidthCommit: (value: DimValue | undefined) => void;
  onHeightCommit: (value: DimValue | undefined) => void;
}

/**
 * The pinning/sizing widget: two pin boxes plus W/H dimension inputs.
 * Reuses the legacy resizing-* / marginpadding-border CSS.
 */
export function ResizingInput({
  pins,
  width,
  height,
  defaultWidth,
  defaultHeight,
  widthUnits,
  heightUnits,
  onPinToggle,
  onWidthCommit,
  onHeightCommit
}: ResizingInputProps) {
  const modes = computeResizingModes(pins);

  function pinClass(base: string, pin: ResizingPinKey) {
    const classes = [base];
    if (!modes[pin]) classes.push('disabled');
    else if (pins[pin]) classes.push('sel');
    return classes.join(' ');
  }

  function pinProps(pin: ResizingPinKey) {
    return {
      'data-pin': pin,
      onClick: () => {
        if (!modes[pin]) return;
        onPinToggle(pin);
      }
    };
  }

  const showWidth = modes.sizeWidth && pins.sizeWidth;
  const showHeight = modes.sizeHeight && pins.sizeHeight;

  return (
    <div style={{ position: 'relative', height: 170 }}>
      <div className="marginpadding-border" style={{ position: 'absolute', top: 10, left: 20, width: 80, height: 80 }}>
        <div
          className={pinClass('resizing-left resizing-hline', 'pinLeft')}
          style={{ position: 'absolute', left: 5, top: 30, width: 10, height: 20 }}
          {...pinProps('pinLeft')}
        />
        <div
          className={pinClass('resizing-right resizing-hline', 'pinRight')}
          style={{ position: 'absolute', right: 5, top: 30, width: 10, height: 20 }}
          {...pinProps('pinRight')}
        />
        <div
          className={pinClass('resizing-top resizing-vline', 'pinTop')}
          style={{ position: 'absolute', top: 5, left: 30, width: 20, height: 10 }}
          {...pinProps('pinTop')}
        />
        <div
          className={pinClass('resizing-bottom resizing-vline', 'pinBottom')}
          style={{ position: 'absolute', bottom: 5, left: 30, width: 20, height: 10 }}
          {...pinProps('pinBottom')}
        />
        <div
          className={pinClass('resizing-hline', 'pinVCenter')}
          style={{ position: 'absolute', bottom: 35, left: 20, width: 40, height: 10 }}
          {...pinProps('pinVCenter')}
        />
        <div
          className={pinClass('resizing-vline', 'pinHCenter')}
          style={{ position: 'absolute', left: 35, bottom: 20, height: 40, width: 10 }}
          {...pinProps('pinHCenter')}
        />
      </div>

      <div className="resizing-label" style={{ position: 'absolute', left: 20, top: 100, width: 80, height: 10 }}>
        Pinning
      </div>

      <div className="marginpadding-border" style={{ position: 'absolute', top: 10, right: 20, width: 80, height: 80 }}>
        <div
          className={pinClass('sizemode-v resizing-top resizing-bottom resizing-vline', 'sizeHeight')}
          style={{ position: 'absolute', top: 5, left: 30, width: 20, height: 70 }}
          {...pinProps('sizeHeight')}
        />
        <div
          className={pinClass('sizemode-h resizing-left resizing-right resizing-hline', 'sizeWidth')}
          style={{ position: 'absolute', top: 30, left: 5, width: 70, height: 20 }}
          {...pinProps('sizeWidth')}
        />
      </div>

      <div className="resizing-label" style={{ position: 'absolute', right: 20, top: 100, width: 80, height: 10 }}>
        Sizing
      </div>

      <div style={{ position: 'absolute', left: 10, right: 10, top: 130, height: 35, display: 'flex' }}>
        {showWidth && (
          <DimInput
            label="W"
            value={width}
            defaultValue={defaultWidth}
            units={widthUnits}
            onCommit={onWidthCommit}
          />
        )}
        {showHeight && (
          <DimInput
            label="H"
            value={height}
            defaultValue={defaultHeight}
            units={heightUnits}
            onCommit={onHeightCommit}
          />
        )}
      </div>
    </div>
  );
}
