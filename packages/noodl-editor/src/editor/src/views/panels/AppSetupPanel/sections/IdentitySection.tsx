import React, { useState, useEffect } from 'react';
import { AppIdentity } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import css from './sections.module.scss';

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
      <PanelRow label="App name">
        <PropertyPanelTextInput value={identity.appName || ''} onChange={(value) => onChange({ appName: value })} />
      </PanelRow>

      {/* A three-line textarea wants the whole row at every width. */}
      <PanelRow label="Description" htmlFor="app-setup-description" isStacked>
        <textarea
          id="app-setup-description"
          className={css.Textarea}
          value={localDescription}
          onChange={(e) => {
            setLocalDescription(e.target.value);
            onChange({ description: e.target.value });
          }}
          placeholder="Describe your app..."
          rows={3}
        />
      </PanelRow>

      <PanelRow label="Cover image" helpText="Path to cover image in project">
        <PropertyPanelTextInput
          value={identity.coverImage || ''}
          onChange={(value) => onChange({ coverImage: value })}
        />
      </PanelRow>
    </CollapsableSection>
  );
}
