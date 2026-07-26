import React from 'react';

import { ALIGN_ICONS } from './alignToolsIcons';

export interface AlignToolsInputProps {
  /** Current parameter value per alignment component; a key present with
   *  undefined value means the comp belongs to this tool but is unset. */
  values: Record<string, string | undefined>;
  defaults: Record<string, string | undefined>;
  isVertical: boolean;

  onToggle: (comp: string, value: string | undefined) => void;
  onReset: () => void;
}

/**
 * The alignment icon toolbar (vertical/horizontal align, justify,
 * align-items, justify-content, align-content). Renders only the icons whose
 * comp belongs to this instance; classes reuse the legacy align-icon CSS.
 */
export function AlignToolsInput({ values, defaults, isVertical, onToggle, onReset }: AlignToolsInputProps) {
  const comps = Object.keys(values);
  const isDefault = comps.every((comp) => values[comp] === undefined);

  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      {!isDefault && (
        <span className="property-changed-dot" title="Reset to default" onClick={() => onReset()} />
      )}

      {/* PAR-002: the mock's `.seg-icons` segmented control */}
      <div className="align-tools-seg" style={{ marginLeft: 20 }}>
        {ALIGN_ICONS.filter((icon) => comps.includes(icon.comp)).map((icon) => {
          const classes = ['align-icon'];
          if (values[icon.comp] !== undefined) {
            if (values[icon.comp] === icon.value) classes.push('sel');
          } else if (defaults[icon.comp] === icon.value) {
            classes.push('def');
          }
          if (isVertical && icon.rotate) {
            classes.push(icon.rotate === 'rotate2' ? 'align-icon-rotate2' : 'align-icon-rotate');
          }

          return (
            <div
              key={icon.comp + ':' + icon.value}
              className={classes.join(' ')}
              title={icon.tooltip}
              onClick={() => {
                // Clicking the selected value un-sets it (legacy toggle semantics)
                onToggle(icon.comp, values[icon.comp] === icon.value ? undefined : icon.value);
              }}
              dangerouslySetInnerHTML={{ __html: icon.svg }}
            />
          );
        })}
      </div>
    </div>
  );
}
