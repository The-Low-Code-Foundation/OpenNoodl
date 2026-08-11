import React, { useEffect, useState } from 'react';

import { EditorSettings } from '@noodl-utils/editorsettings';

import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import { BLOCK_LANGUAGE_SETTINGS_KEY, SUPPORTED_LANGUAGES } from '../../../BlocklyEditor/BlocklyLocale';
import {
  ALWAYS_SHOW_WIRE_DIRECTION,
  ALWAYS_SHOW_WIRE_LABELS
} from '../../../nodegrapheditor/NodeGraphEditorConnection';
import { ThemeSettingRow } from './ThemeSettingRow';

const BLOCK_LANGUAGE_OPTIONS = [
  { label: 'System', value: 'system' },
  ...SUPPORTED_LANGUAGES.map(({ code, label }) => ({ label, value: code }))
];

/**
 * Appearance preferences. The theme selector itself is `ThemeSettingRow`, shared
 * verbatim with the launcher's settings dialog — theme is an app-wide preference
 * and is settable from both places (UIX-008). The other rows here are
 * editor-only and deliberately do not travel to the launcher.
 */
export function AppearanceSettingsSection() {
  const [blockLanguage, setBlockLanguage] = useState<string>('system');
  const [alwaysShowWireLabels, setAlwaysShowWireLabels] = useState(false);
  const [alwaysShowWireDirection, setAlwaysShowWireDirection] = useState(true);

  useEffect(() => {
    let cancelled = false;
    EditorSettings.instance.ready
      .then(() => {
        if (cancelled) return;
        const saved = EditorSettings.instance.get(BLOCK_LANGUAGE_SETTINGS_KEY);
        setBlockLanguage(typeof saved === 'string' ? saved : 'system');
        setAlwaysShowWireLabels(!!EditorSettings.instance.get(ALWAYS_SHOW_WIRE_LABELS));
        setAlwaysShowWireDirection(EditorSettings.instance.get(ALWAYS_SHOW_WIRE_DIRECTION) !== false);
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

  function onAlwaysShowWireDirectionChange(value: boolean) {
    setAlwaysShowWireDirection(value);
    EditorSettings.instance.set(ALWAYS_SHOW_WIRE_DIRECTION, value);
  }

  return (
    <CollapsableSection title="Appearance">
      <Box hasXSpacing>
        <VStack>
          <ThemeSettingRow />
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
            label="Always show wire direction"
            helpText="Repeat a small chevron along every wire, pointing the way it runs. Only wires long enough that you cannot easily see both ends get them, so short hops stay clean. Turn this off to leave direction to the circle where a wire leaves, the arrowhead where it arrives, and the mark that runs along a wire you hover."
          >
            <Checkbox
              isChecked={alwaysShowWireDirection}
              onChange={(ev) => onAlwaysShowWireDirectionChange(ev.target.checked)}
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
