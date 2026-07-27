import React, { useState, useEffect } from 'react';
import { AppSEO, AppIdentity } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import css from './sections.module.scss';

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
      <PanelRow
        label="Open Graph title"
        helpText={!seo.ogTitle && defaultOgTitle ? `Defaults to: ${defaultOgTitle}` : undefined}
      >
        <PropertyPanelTextInput
          value={seo.ogTitle || ''}
          onChange={(value) => onChange({ ogTitle: value || undefined })}
        />
      </PanelRow>

      <PanelRow
        label="Open Graph description"
        htmlFor="app-setup-og-description"
        isStacked
        helpText={
          !seo.ogDescription && defaultOgDescription
            ? `Defaults to: ${defaultOgDescription.substring(0, 50)}${defaultOgDescription.length > 50 ? '...' : ''}`
            : undefined
        }
      >
        <textarea
          id="app-setup-og-description"
          className={css.Textarea}
          value={localOgDescription}
          onChange={(e) => {
            setLocalOgDescription(e.target.value);
            onChange({ ogDescription: e.target.value || undefined });
          }}
          placeholder="Enter description..."
          rows={3}
        />
      </PanelRow>

      <PanelRow
        label="Open Graph image"
        helpText={!seo.ogImage && defaultOgImage ? `Defaults to: ${defaultOgImage}` : undefined}
      >
        <PropertyPanelTextInput
          value={seo.ogImage || ''}
          onChange={(value) => onChange({ ogImage: value || undefined })}
        />
      </PanelRow>

      <PanelRow label="Favicon" helpText="Path to favicon (.ico, .png, .svg)">
        <PropertyPanelTextInput value={seo.favicon || ''} onChange={(value) => onChange({ favicon: value })} />
      </PanelRow>

      <PanelRow label="Theme colour" helpText="Browser theme color (hex format)">
        <div className={css.ColourField}>
          <input
            type="color"
            aria-label="Theme colour swatch"
            className={css.ColourSwatch}
            value={localThemeColor}
            onChange={(e) => {
              setLocalThemeColor(e.target.value);
              onChange({ themeColor: e.target.value });
            }}
          />
          <div className={css.ColourText}>
            <PropertyPanelTextInput
              value={localThemeColor}
              onChange={(value) => {
                setLocalThemeColor(value);
                onChange({ themeColor: value });
              }}
            />
          </div>
        </div>
      </PanelRow>
    </CollapsableSection>
  );
}
