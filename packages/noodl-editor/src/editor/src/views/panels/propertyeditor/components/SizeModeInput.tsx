import classNames from 'classnames';
import React from 'react';

type TooltipValue = string | { standard?: string; extended?: string };

export interface SizeModeInputProps {
  value: string | undefined;
  isDefault: boolean;
  tooltips: {
    explicit?: TooltipValue;
    contentHeight?: TooltipValue;
    contentWidth?: TooltipValue;
    contentSize?: TooltipValue;
  };
  onChange: (value: string) => void;
  onReset?: () => void;
}

function tooltipText(tooltip: TooltipValue | undefined): string | undefined {
  if (tooltip === undefined) return undefined;
  return typeof tooltip === 'object' ? tooltip.standard : tooltip;
}

// Keyed: 'explicit' renders both as an array
const VLINE = (
  <div
    key="vline"
    className="resizing-top resizing-bottom resizing-vline"
    style={{ position: 'absolute', top: 2, left: 10, width: 10, height: 22 }}
  />
);
const HLINE = (
  <div
    key="hline"
    className="resizing-left resizing-right resizing-hline"
    style={{ position: 'absolute', top: 10, left: 2, width: 22, height: 10 }}
  />
);

const MODES: { value: string; tooltipKey: keyof SizeModeInputProps['tooltips']; children: React.ReactNode }[] = [
  { value: 'explicit', tooltipKey: 'explicit', children: [VLINE, HLINE] },
  { value: 'contentHeight', tooltipKey: 'contentHeight', children: HLINE },
  { value: 'contentWidth', tooltipKey: 'contentWidth', children: VLINE },
  { value: 'contentSize', tooltipKey: 'contentSize', children: null }
];

/**
 * React version of the legacy `sizemode` template: four icons choosing how a
 * visual node is sized. Reuses the `size-icon` / `resizing-*` classes from the
 * global stylesheet so the visuals are unchanged.
 */
export function SizeModeInput({ value, isDefault, tooltips, onChange, onReset }: SizeModeInputProps) {
  return (
    <div style={{ height: 50, position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', position: 'relative', top: 2 }}>
        {MODES.map((mode) => (
          <div
            key={mode.value}
            className={classNames('size-icon', value === mode.value && (isDefault ? 'def' : 'sel'))}
            title={tooltipText(tooltips[mode.tooltipKey])}
            onClick={() => onChange(mode.value)}
          >
            <div className="resizing-border" style={{ width: 30, height: 30, position: 'relative' }}>
              {mode.children}
            </div>
          </div>
        ))}
      </div>

      {!isDefault && onReset && (
        <span
          title="Reset to default"
          onClick={onReset}
          style={{
            position: 'absolute',
            right: 10,
            top: 12,
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: 'var(--theme-color-secondary-as-fg)',
            cursor: 'pointer'
          }}
        />
      )}
    </div>
  );
}
