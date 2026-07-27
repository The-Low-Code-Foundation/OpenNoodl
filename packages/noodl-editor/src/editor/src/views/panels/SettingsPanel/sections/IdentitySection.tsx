import React, { useState, useEffect } from 'react';
import { AppIdentity } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import css from './sections.module.scss';

interface IdentitySectionProps {
  identity: AppIdentity;
  onChange: (updates: Partial<AppIdentity>) => void;

  /**
   * PNL-008 / finding F15. `settings.htmlTitle` used to be edited in the *other*
   * settings panel, as "Title" under a group called "General". It is a different
   * field from `identity.appName` and both are genuinely consumed (the trace is
   * in PNL-008-NOTES.md), so both survive — but they now sit together, labelled
   * for what they each do, instead of one per panel each labelled as if it were
   * the app's title.
   */
  browserTitle: string;
  onBrowserTitleChange: (value: string) => void;
}

export function IdentitySection({ identity, onChange, browserTitle, onBrowserTitleChange }: IdentitySectionProps) {
  // Local state for immediate textarea updates
  const [localDescription, setLocalDescription] = useState(identity.description || '');

  // Sync local state when external identity changes
  useEffect(() => {
    setLocalDescription(identity.description || '');
  }, [identity.description]);

  const appName = identity.appName || '';
  // While the two agree (or the title has never been set), editing the app name
  // carries the browser title with it — see `ProjectSettingsTab.updateIdentity`.
  const isFollowingAppName = !browserTitle || browserTitle === appName;

  return (
    <CollapsableSection title="App Identity" hasGutter hasVisibleOverflow>
      <PanelRow
        label="App name"
        helpText="Read at runtime as Noodl.Config.appName, and the default for the Open Graph title."
      >
        <PropertyPanelTextInput value={appName} onChange={(value) => onChange({ appName: value })} />
      </PanelRow>

      <PanelRow
        label="Browser tab title"
        helpText={
          isFollowingAppName
            ? 'The <title> of the built and previewed page. Follows the app name — type here to set a different one.'
            : 'The <title> of the built and previewed page. Set independently; clear it to follow the app name again.'
        }
      >
        <PropertyPanelTextInput value={browserTitle} onChange={onBrowserTitleChange} />
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
