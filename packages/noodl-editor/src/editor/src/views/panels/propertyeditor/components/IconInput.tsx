import React from 'react';

import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import type { IconSetValue } from '../../../../../../shared/utils/iconsets';
import { IconGlyphPreview } from './IconGlyphPreview';

/**
 * A stored icon parameter. Structurally `Noodl.Icon` — NDA-007 §1's union — because that is what
 * lands in project JSON and flows down the port. A font value carries no `kind`, which is how an
 * existing project's parameters keep their exact shape.
 */
export type IconValue = IconSetValue;

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
        {/* One renderer for the thumbnail and the picker cell — NDA-007 §3. This used to be a
            third independent copy of the font splat, so a sprite value showed as an empty box. */}
        <div style={{ color: 'white' }}>
          <IconGlyphPreview value={value} size={20} />
        </div>
      </div>
    </PropertyPanelRow>
  );
}
