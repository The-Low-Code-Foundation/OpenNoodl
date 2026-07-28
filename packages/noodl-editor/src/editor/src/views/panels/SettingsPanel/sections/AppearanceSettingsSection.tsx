import React, { useEffect, useState } from 'react';

import { ThemeManager, ThemeManagerEvent, ThemeMode } from '@noodl-models/ThemeManager';
import { EditorSettings } from '@noodl-utils/editorsettings';

import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import { BLOCK_LANGUAGE_SETTINGS_KEY, SUPPORTED_LANGUAGES } from '../../../BlocklyEditor/BlocklyLocale';
import { ALWAYS_SHOW_WIRE_LABELS } from '../../../nodegrapheditor/NodeGraphEditorConnection';

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
];

const BLOCK_LANGUAGE_OPTIONS = [
  { label: 'System', value: 'system' },
  ...SUPPORTED_LANGUAGES.map(({ code, label }) => ({ label, value: code }))
];

/**
 * A quiet tri-state theme selector (UIX-008). Lives in Editor Settings — no
 * toggle in the main toolbar. Reads/writes the ThemeManager, which persists the
 * choice in the shared editor settings store and applies it everywhere.
 */
export function AppearanceSettingsSection() {
  const [mode, setMode] = useState<ThemeMode>(ThemeManager.currentMode);
  const [blockLanguage, setBlockLanguage] = useState<string>('system');
  const [alwaysShowWireLabels, setAlwaysShowWireLabels] = useState(false);

  useEffect(() => {
    const group = {};
    ThemeManager.on(ThemeManagerEvent.Changed, (state) => setMode(state.mode), group);
    // Sync in case the mode changed between render and subscribe.
    setMode(ThemeManager.currentMode);
    return () => {
      ThemeManager.off(group);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    EditorSettings.instance.ready
      .then(() => {
        if (cancelled) return;
        const saved = EditorSettings.instance.get(BLOCK_LANGUAGE_SETTINGS_KEY);
        setBlockLanguage(typeof saved === 'string' ? saved : 'system');
        setAlwaysShowWireLabels(!!EditorSettings.instance.get(ALWAYS_SHOW_WIRE_LABELS));
      })
      .catch(() => {
        /* keep the default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onBlockLanguageChange(value: string) {
    setBlockLanguage(value);
    EditorSettings.instance.set(BLOCK_LANGUAGE_SETTINGS_KEY, value);
  }

  function onAlwaysShowWireLabelsChange(value: boolean) {
    setAlwaysShowWireLabels(value);
    EditorSettings.instance.set(ALWAYS_SHOW_WIRE_LABELS, value);
  }

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
          <PanelRow
            label="Always show wire labels"
            helpText="Show the source port's name on every wire, instead of only when you hover a wire or one of the nodes it connects. Labels you have written yourself are always shown either way."
          >
            <Checkbox
              isChecked={alwaysShowWireLabels}
              onChange={(ev) => onAlwaysShowWireLabelsChange(ev.target.checked)}
            />
          </PanelRow>
          <PanelRow
            label="Block editor language"
            helpText="Language for the blocks inside a Logic Builder node. System follows your operating system. Takes effect the next time a Logic Builder tab is opened."
          >
            <PropertyPanelSelectInput
              value={blockLanguage}
              properties={{ options: BLOCK_LANGUAGE_OPTIONS }}
              onChange={onBlockLanguageChange}
            />
          </PanelRow>
        </VStack>
      </Box>
    </CollapsableSection>
  );
}
