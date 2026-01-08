import React, { useState, useEffect } from 'react';
import { AppPWA } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';

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
      {/* Enable PWA Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--theme-color-fg-default)'
          }}
        >
          <input
            type="checkbox"
            checked={localEnabled}
            onChange={handleToggle}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
          Enable Progressive Web App
        </label>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--theme-color-fg-muted)',
            marginTop: '4px',
            marginLeft: '24px'
          }}
        >
          Allow users to install your app on their device
        </div>
      </div>

      {/* PWA Configuration Fields - Only shown when enabled */}
      {localEnabled && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '4px',
                color: 'var(--theme-color-fg-default)'
              }}
            >
              Short Name
            </label>
            <PropertyPanelTextInput value={pwa?.shortName || ''} onChange={(value) => onChange({ shortName: value })} />
            <div
              style={{
                fontSize: '11px',
                color: 'var(--theme-color-fg-muted)',
                marginTop: '4px'
              }}
            >
              Name shown on home screen (12 chars max recommended)
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '4px',
                color: 'var(--theme-color-fg-default)'
              }}
            >
              Start URL
            </label>
            <PropertyPanelTextInput
              value={pwa?.startUrl || '/'}
              onChange={(value) => onChange({ startUrl: value || '/' })}
            />
            <div
              style={{
                fontSize: '11px',
                color: 'var(--theme-color-fg-muted)',
                marginTop: '4px'
              }}
            >
              URL the app opens to (default: /)
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '4px',
                color: 'var(--theme-color-fg-default)'
              }}
            >
              Display Mode
            </label>
            <select
              value={localDisplay}
              onChange={(e) => {
                const newValue = e.target.value as AppPWA['display'];
                setLocalDisplay(newValue);
                onChange({ display: newValue });
              }}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                fontFamily: 'inherit',
                backgroundColor: 'var(--theme-color-bg-3)',
                border: '1px solid var(--theme-color-border-default)',
                borderRadius: '4px',
                color: 'var(--theme-color-fg-default)',
                cursor: 'pointer'
              }}
            >
              {DISPLAY_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--theme-color-fg-muted)',
                marginTop: '4px'
              }}
            >
              How the app appears when launched
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '4px',
                color: 'var(--theme-color-fg-default)'
              }}
            >
              Background Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={localBgColor}
                onChange={(e) => {
                  setLocalBgColor(e.target.value);
                  onChange({ backgroundColor: e.target.value });
                }}
                style={{
                  width: '40px',
                  height: '32px',
                  border: '1px solid var(--theme-color-border-default)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: 'transparent'
                }}
              />
              <div style={{ flex: 1 }}>
                <PropertyPanelTextInput
                  value={localBgColor}
                  onChange={(value) => {
                    setLocalBgColor(value);
                    onChange({ backgroundColor: value });
                  }}
                />
              </div>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--theme-color-fg-muted)',
                marginTop: '4px'
              }}
            >
              Splash screen background color
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '4px',
                color: 'var(--theme-color-fg-default)'
              }}
            >
              Source Icon
            </label>
            <PropertyPanelTextInput
              value={pwa?.sourceIcon || ''}
              onChange={(value) => onChange({ sourceIcon: value })}
            />
            <div
              style={{
                fontSize: '11px',
                color: 'var(--theme-color-fg-muted)',
                marginTop: '4px'
              }}
            >
              Path to 512x512 icon (generates all sizes automatically)
            </div>
          </div>
        </>
      )}
    </CollapsableSection>
  );
}
