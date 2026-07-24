import React, { useEffect, useRef } from 'react';

import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';

export interface VariableInputProps {
  /** The available type codes, e.g. ['12', 'Ab', 'Co', 'Bo'] */
  types: string[];
  currentType: string;
  /** The rendered element of the inner value editor (BasicType/ColorType/BooleanType view) */
  childEl: HTMLElement | TSFixme;
  onTypeChange: (type: string) => void;
}

/**
 * React version of the legacy `variable-type` template: the inner value editor
 * fills the row, with a small type selector overlapping at the left (where the
 * legacy 33px dropdown box sat).
 */
export function VariableInput({ types, currentType, childEl, onTypeChange }: VariableInputProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';
    const node = childEl && childEl.jquery ? childEl[0] : childEl;
    if (node) host.appendChild(node);
  }, [childEl]);

  return (
    <div style={{ minHeight: 35, position: 'relative' }}>
      <div ref={hostRef} style={{ position: 'absolute', width: '100%', height: '100%' }} />

      <div style={{ position: 'absolute', left: 25, top: 1, bottom: 1, width: 33 }}>
        <PropertyPanelSelectInput
          value={currentType}
          properties={{ options: types.map((t) => ({ label: t, value: t })) }}
          onChange={(t) => onTypeChange(String(t))}
          hasHiddenCaret
          hasSmallText
        />
      </div>
    </div>
  );
}
