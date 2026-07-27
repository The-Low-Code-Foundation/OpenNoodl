import React, { useEffect, useState } from 'react';

import { ThemeManager, ThemeManagerEvent, ThemeMode } from '@noodl-models/ThemeManager';

import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
];

/**
 * A quiet tri-state theme selector (UIX-008). Lives in Editor Settings — no
 * toggle in the main toolbar. Reads/writes the ThemeManager, which persists the
 * choice in the shared editor settings store and applies it everywhere.
 */
export function AppearanceSettingsSection() {
  const [mode, setMode] = useState<ThemeMode>(ThemeManager.currentMode);

  useEffect(() => {
    const group = {};
    ThemeManager.on(ThemeManagerEvent.Changed, (state) => setMode(state.mode), group);
    // Sync in case the mode changed between render and subscribe.
    setMode(ThemeManager.currentMode);
    return () => {
      ThemeManager.off(group);
    };
  }, []);

  return (
    <CollapsableSection title="Appearance">
      <Box hasXSpacing>
        <VStack>
          <PanelRow
            label="Theme"
            helpText="System follows your operating system’s light or dark setting. Theme applies to the editor interface — your running app’s appearance is unaffected."
          >
            <PropertyPanelSelectInput
              value={mode}
              properties={{ options: THEME_OPTIONS }}
              onChange={(value: ThemeMode) => ThemeManager.setMode(value)}
            />
          </PanelRow>
        </VStack>
      </Box>
    </CollapsableSection>
  );
}
