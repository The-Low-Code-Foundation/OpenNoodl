import React, { useState, useEffect } from 'react';
import { AppPWA } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import css from './sections.module.scss';

interface PWASectionProps {
  pwa: AppPWA | undefined;
  onChange: (updates: Partial<AppPWA>) => void;
}

const DISPLAY_MODES = [
  { value: 'standalone', label: 'Standalone (Recommended)' },
  { value: 'fullscreen', label: 'Fullscreen' },
  { value: 'minimal-ui', label: 'Minimal UI' },
  { value: 'browser', label: 'Browser' }
] as const;

export function PWASection({ pwa, onChange }: PWASectionProps) {
  // Local state for immediate UI updates
  const [localEnabled, setLocalEnabled] = useState(pwa?.enabled || false);
  const [localDisplay, setLocalDisplay] = useState<AppPWA['display']>(pwa?.display || 'standalone');
  const [localBgColor, setLocalBgColor] = useState(pwa?.backgroundColor || '#ffffff');

  // Sync local state when external pwa changes
  useEffect(() => {
    setLocalEnabled(pwa?.enabled || false);
  }, [pwa?.enabled]);

  useEffect(() => {
    setLocalDisplay(pwa?.display || 'standalone');
  }, [pwa?.display]);

  useEffect(() => {
    setLocalBgColor(pwa?.backgroundColor || '#ffffff');
  }, [pwa?.backgroundColor]);

  const handleToggle = () => {
    if (!localEnabled) {
      // Enable with defaults
      setLocalEnabled(true); // Immediate UI update
      onChange({
        enabled: true,
        startUrl: '/',
        display: 'standalone'
      });
    } else {
      // Disable
      setLocalEnabled(false); // Immediate UI update
      onChange({ enabled: false });
    }
  };

  return (
    <CollapsableSection title="Progressive Web App" hasGutter hasVisibleOverflow hasTopDivider>
      {/* The master switch gates everything below it, so it reads as a statement
          rather than as one more label/control row. */}
      <div className={css.Group}>
        <label className={css.CheckboxLabel}>
          <input type="checkbox" className={css.CheckboxInput} checked={localEnabled} onChange={handleToggle} />
          Enable Progressive Web App
        </label>
        <div className={css.CheckboxHelp}>Allow users to install your app on their device</div>
      </div>

      {/* PWA Configuration Fields - Only shown when enabled */}
      {localEnabled && (
        <>
          <PanelRow label="Short name" helpText="Name shown on home screen (12 chars max recommended)">
            <PropertyPanelTextInput value={pwa?.shortName || ''} onChange={(value) => onChange({ shortName: value })} />
          </PanelRow>

          <PanelRow label="Start URL" helpText="URL the app opens to (default: /)">
            <PropertyPanelTextInput
              value={pwa?.startUrl || '/'}
              onChange={(value) => onChange({ startUrl: value || '/' })}
            />
          </PanelRow>

          <PanelRow label="Display mode" htmlFor="app-setup-pwa-display" helpText="How the app appears when launched">
            <select
              id="app-setup-pwa-display"
              className={css.NativeSelect}
              value={localDisplay}
              onChange={(e) => {
                const newValue = e.target.value as AppPWA['display'];
                setLocalDisplay(newValue);
                onChange({ display: newValue });
              }}
            >
              {DISPLAY_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </PanelRow>

          <PanelRow label="Background colour" helpText="Splash screen background color">
            <div className={css.ColourField}>
              <input
                type="color"
                aria-label="Background colour swatch"
                className={css.ColourSwatch}
                value={localBgColor}
                onChange={(e) => {
                  setLocalBgColor(e.target.value);
                  onChange({ backgroundColor: e.target.value });
                }}
              />
              <div className={css.ColourText}>
                <PropertyPanelTextInput
                  value={localBgColor}
                  onChange={(value) => {
                    setLocalBgColor(value);
                    onChange({ backgroundColor: value });
                  }}
                />
              </div>
            </div>
          </PanelRow>

          <PanelRow label="Source icon" helpText="Path to 512x512 icon (generates all sizes automatically)">
            <PropertyPanelTextInput
              value={pwa?.sourceIcon || ''}
              onChange={(value) => onChange({ sourceIcon: value })}
            />
          </PanelRow>
        </>
      )}
    </CollapsableSection>
  );
}
