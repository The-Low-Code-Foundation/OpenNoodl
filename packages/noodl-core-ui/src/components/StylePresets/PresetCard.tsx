/**
 * STYLE-003: PresetCard
 *
 * Individual card showing a visual mini-preview of a style preset.
 * Renders a small mockup using the preset's preview colors/radius
 * so users can see what their UI will look like before choosing.
 */

import React from 'react';

import css from './PresetCard.module.scss';

export interface PresetDisplayInfo {
  /** Unique slug id (e.g. 'modern', 'minimal'). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description shown below the card grid. */
  description: string;
  /** Raw CSS values for the visual preview. No token references. */
  preview: {
    primaryColor: string;
    backgroundColor: string;
    surfaceColor: string;
    borderColor: string;
    textColor: string;
    mutedTextColor: string;
    radiusMd: string;
  };
}

export interface PresetCardProps {
  preset: PresetDisplayInfo;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function PresetCard({ preset, isSelected, onSelect }: PresetCardProps) {
  const { preview } = preset;

  return (
    <button
      type="button"
      className={[css['PresetCard'], isSelected ? css['PresetCard--selected'] : ''].filter(Boolean).join(' ')}
      onClick={() => onSelect(preset.id)}
      aria-pressed={isSelected}
      title={preset.name}
    >
      {/* Mini UI mockup */}
      <div
        className={css['PresetCard-mockup']}
        style={{ backgroundColor: preview.backgroundColor, borderColor: preview.borderColor }}
      >
        {/* Primary button row */}
        <div
          className={css['PresetCard-btn']}
          style={{
            backgroundColor: preview.primaryColor,
            borderRadius: preview.radiusMd
          }}
        />

        {/* Text lines */}
        <div className={css['PresetCard-lines']}>
          <div className={css['PresetCard-line']} style={{ backgroundColor: preview.textColor, width: '70%' }} />
          <div className={css['PresetCard-line']} style={{ backgroundColor: preview.mutedTextColor, width: '50%' }} />
        </div>

        {/* Surface card strip */}
        <div
          className={css['PresetCard-surface']}
          style={{
            backgroundColor: preview.surfaceColor,
            borderColor: preview.borderColor,
            borderRadius: `calc(${preview.radiusMd} * 0.6)`
          }}
        />
      </div>

      {/* Preset name */}
      <span className={css['PresetCard-name']}>{preset.name}</span>

      {/* Selected indicator */}
      {isSelected && <span className={css['PresetCard-check']} aria-hidden />}
    </button>
  );
}
