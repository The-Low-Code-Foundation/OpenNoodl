import React from 'react';

import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

export interface IconValue {
  class?: string;
  code?: string;
  /** Some icon sets (e.g. SVG-based) encode the glyph as a second class instead of text content */
  codeAsClass?: boolean;
}

export interface IconInputProps {
  label: string;
  value?: IconValue;

  isChanged?: boolean;
  dataIdentifier?: string;

  /** Open the icon picker popout. `anchor` is the thumbnail element. */
  onOpenPicker: (anchor: HTMLElement) => void;
  onReset?: () => void;
}

/**
 * The icon property row: a label plus a clickable thumbnail box that shows
 * the currently selected icon and opens the icon picker popout.
 */
export function IconInput({ label, value, isChanged, dataIdentifier, onOpenPicker, onReset }: IconInputProps) {
  const thumbnailClass = value
    ? value.codeAsClass
      ? [value.class, value.code].filter(Boolean).join(' ')
      : value.class
    : undefined;
  const thumbnailText = value && !value.codeAsClass ? value.code : '';

  return (
    <PropertyPanelRow label={label} isChanged={isChanged} onReset={onReset}>
      <div
        className="sidebar-panel-dark-input"
        data-identifier={dataIdentifier}
        style={{
          height: 32,
          width: 33,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenPicker(e.currentTarget);
        }}
      >
        <span className={thumbnailClass} style={{ color: 'white', fontSize: 20, display: 'inline-block' }}>
          {thumbnailText}
        </span>
      </div>
    </PropertyPanelRow>
  );
}
