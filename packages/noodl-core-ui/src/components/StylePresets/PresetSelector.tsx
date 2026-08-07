/**
 * STYLE-003: PresetSelector
 *
 * Horizontal grid of PresetCards with a description below for the
 * currently-selected preset.
 *
 * Usage:
 *   <PresetSelector
 *     presets={getAllPresets()}
 *     selectedId="modern"
 *     onChange={(id) => setPreset(id)}
 *   />
 */

import React from 'react';

import { PresetCard, PresetDisplayInfo } from './PresetCard';
import css from './PresetSelector.module.scss';

export interface PresetSelectorProps {
  /** All available presets to display. */
  presets: PresetDisplayInfo[];
  /** Currently selected preset id. */
  selectedId: string;
  /** Called when the user picks a different preset. */
  onChange: (id: string) => void;
}

export function PresetSelector({ presets, selectedId, onChange }: PresetSelectorProps) {
  const selected = presets.find((p) => p.id === selectedId);

  return (
    <div className={css['PresetSelector']}>
      <span className={css['PresetSelector-label']}>Style Preset</span>

      <div className={css['PresetSelector-grid']} role="group" aria-label="Style presets">
        {presets.map((preset) => (
          <PresetCard key={preset.id} preset={preset} isSelected={preset.id === selectedId} onSelect={onChange} />
        ))}
      </div>

      {selected && <p className={css['PresetSelector-description']}>{selected.description}</p>}
    </div>
  );
}
