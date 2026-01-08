import React, { useState, useEffect } from 'react';
import { AppSEO, AppIdentity } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';

interface SEOSectionProps {
  seo: AppSEO;
  identity: AppIdentity;
  onChange: (updates: Partial<AppSEO>) => void;
}

export function SEOSection({ seo, identity, onChange }: SEOSectionProps) {
  // Local state for immediate UI updates
  const [localOgDescription, setLocalOgDescription] = useState(seo.ogDescription || '');
  const [localThemeColor, setLocalThemeColor] = useState(seo.themeColor || '#000000');

  // Sync local state when external seo changes
  useEffect(() => {
    setLocalOgDescription(seo.ogDescription || '');
  }, [seo.ogDescription]);

  useEffect(() => {
    setLocalThemeColor(seo.themeColor || '#000000');
  }, [seo.themeColor]);

  // Smart defaults from identity
  const defaultOgTitle = identity.appName || '';
  const defaultOgDescription = identity.description || '';
  const defaultOgImage = identity.coverImage || '';

  return (
    <CollapsableSection title="SEO & Metadata" hasGutter hasVisibleOverflow hasTopDivider>
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
          Open Graph Title
        </label>
        <PropertyPanelTextInput
          value={seo.ogTitle || ''}
          onChange={(value) => onChange({ ogTitle: value || undefined })}
        />
        {!seo.ogTitle && defaultOgTitle && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--theme-color-fg-muted)',
              marginTop: '4px'
            }}
          >
            Defaults to: {defaultOgTitle}
          </div>
        )}
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
          Open Graph Description
        </label>
        <textarea
          value={localOgDescription}
          onChange={(e) => {
            setLocalOgDescription(e.target.value);
            onChange({ ogDescription: e.target.value || undefined });
          }}
          placeholder="Enter description..."
          rows={3}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '13px',
            fontFamily: 'inherit',
            backgroundColor: 'var(--theme-color-bg-3)',
            border: '1px solid var(--theme-color-border-default)',
            borderRadius: '4px',
            color: 'var(--theme-color-fg-default)',
            resize: 'vertical'
          }}
        />
        {!seo.ogDescription && defaultOgDescription && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--theme-color-fg-muted)',
              marginTop: '4px'
            }}
          >
            Defaults to: {defaultOgDescription.substring(0, 50)}
            {defaultOgDescription.length > 50 ? '...' : ''}
          </div>
        )}
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
          Open Graph Image
        </label>
        <PropertyPanelTextInput
          value={seo.ogImage || ''}
          onChange={(value) => onChange({ ogImage: value || undefined })}
        />
        {!seo.ogImage && defaultOgImage && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--theme-color-fg-muted)',
              marginTop: '4px'
            }}
          >
            Defaults to: {defaultOgImage}
          </div>
        )}
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
          Favicon
        </label>
        <PropertyPanelTextInput value={seo.favicon || ''} onChange={(value) => onChange({ favicon: value })} />
        <div
          style={{
            fontSize: '11px',
            color: 'var(--theme-color-fg-muted)',
            marginTop: '4px'
          }}
        >
          Path to favicon (.ico, .png, .svg)
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
          Theme Color
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="color"
            value={localThemeColor}
            onChange={(e) => {
              setLocalThemeColor(e.target.value);
              onChange({ themeColor: e.target.value });
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
              value={localThemeColor}
              onChange={(value) => {
                setLocalThemeColor(value);
                onChange({ themeColor: value });
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
          Browser theme color (hex format)
        </div>
      </div>
    </CollapsableSection>
  );
}
