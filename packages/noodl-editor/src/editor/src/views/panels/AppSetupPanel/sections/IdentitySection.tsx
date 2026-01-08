import React, { useState, useEffect } from 'react';
import { AppIdentity } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';

interface IdentitySectionProps {
  identity: AppIdentity;
  onChange: (updates: Partial<AppIdentity>) => void;
}

export function IdentitySection({ identity, onChange }: IdentitySectionProps) {
  // Local state for immediate textarea updates
  const [localDescription, setLocalDescription] = useState(identity.description || '');

  // Sync local state when external identity changes
  useEffect(() => {
    setLocalDescription(identity.description || '');
  }, [identity.description]);

  return (
    <CollapsableSection title="App Identity" hasGutter hasVisibleOverflow>
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
          App Name
        </label>
        <PropertyPanelTextInput value={identity.appName || ''} onChange={(value) => onChange({ appName: value })} />
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
          Description
        </label>
        <textarea
          value={localDescription}
          onChange={(e) => {
            setLocalDescription(e.target.value);
            onChange({ description: e.target.value });
          }}
          placeholder="Describe your app..."
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
          Cover Image
        </label>
        <PropertyPanelTextInput
          value={identity.coverImage || ''}
          onChange={(value) => onChange({ coverImage: value })}
        />
        <div
          style={{
            fontSize: '11px',
            color: 'var(--theme-color-fg-muted)',
            marginTop: '4px'
          }}
        >
          Path to cover image in project
        </div>
      </div>
    </CollapsableSection>
  );
}
