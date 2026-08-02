import React, { useEffect, useState } from 'react';

import { ThemeManager, ThemeManagerEvent, ThemeMode } from '@noodl-models/ThemeManager';

import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
];

const HELP_TEXT =
  'System follows your operating system’s light or dark setting. Theme applies to the whole app — the launcher and the editor — and your running app’s appearance is unaffected.';

/**
 * The tri-state theme control (UIX-008), as ONE component with two hosts: the
 * editor's Appearance settings section and the launcher's settings dialog.
 *
 * It is a row rather than a section because the two hosts group it differently
 * — the editor sits it beside editor-only preferences (wire labels, block
 * language) that mean nothing at the launcher, where there is no canvas and no
 * Logic Builder.
 *
 * There is no local state to keep in sync: `ThemeManager` owns the mode, writes
 * it to the shared `EditorSettings` store and re-broadcasts, so both hosts show
 * the same value the moment either one changes it. A second copy of this select
 * would be a second source of truth for a preference that is deliberately
 * app-wide.
 */
export function ThemeSettingRow() {
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
    <PanelRow label="Theme" helpText={HELP_TEXT}>
      <PropertyPanelSelectInput
        value={mode}
        properties={{ options: THEME_OPTIONS }}
        onChange={(value: ThemeMode) => ThemeManager.setMode(value)}
      />
    </PanelRow>
  );
}
