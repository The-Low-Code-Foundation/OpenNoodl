import React, { useCallback, useEffect, useState } from 'react';

import { Tabs, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { EditorSettingsTab } from './EditorSettingsTab';
import { ProjectSettingsTab } from './ProjectSettingsTab';
import { SETTINGS_TAB_EVENT, SettingsTabId, takeRequestedSettingsTab } from './settingsPanelRoute';
import css from './SettingsPanel.module.scss';

const TABS = [
  { label: 'Project', id: 'project', testId: 'settings-tab-project', content: null },
  { label: 'Editor', id: 'editor', testId: 'settings-tab-editor', content: null }
];

/**
 * PNL-008 — the rail's one settings destination.
 *
 * Three panels (App Setup, Project settings, Editor settings) became this one,
 * behind a cog rather than a sun. Project and Editor are tabs because they are
 * different *scopes* — this project vs. this machine — not different subjects;
 * VS Code splits its single Settings surface exactly this way.
 *
 * ## Why the tab bodies are rendered here rather than by `Tabs`
 *
 * `Tabs` is used as a controlled segmented *control* — `activeTab` + `onChange`,
 * with no content of its own — and the active tab's sections are rendered as its
 * siblings. That is deliberate, not an oversight:
 *
 *   - `Tabs.Root` is `height: 100%; overflow: hidden`, and its segmented variant
 *     stretches its content pane rather than scrolling it, because it was built
 *     (UIX-013) for full-height panes that scroll themselves. Dropping that into
 *     `BasePanel`'s scroll container would clip the settings at the panel height
 *     and stop the panel scrolling — PNL-001's bug, reintroduced.
 *   - The alternative (`BasePanel` stops scrolling, each tab body scrolls itself)
 *     moves the scrollbar 16px inboard of the panel edge and puts two extra
 *     elements between the legacy ports view and its scroll container, which
 *     `Ports.renderGroups()` walks by a hardcoded two levels.
 *
 * So: one scroll container, panel-owned, exactly as every other panel has; the
 * tab strip and the sections are siblings inside it. Forking a second segmented
 * control to achieve that would have been worse than using this one for the half
 * of its job that fits.
 */
export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => takeRequestedSettingsTab() || 'project');

  // Another part of the editor (Clippy's "set up an AI provider", the retired-id
  // migration on project open) can ask for a specific tab while this panel is
  // already mounted — `SidePanel` keeps panels alive behind `display: none`, so
  // a mount-time read alone would miss every request after the first.
  useEffect(() => {
    const onRequest = () => {
      const tab = takeRequestedSettingsTab();
      if (tab) setActiveTab(tab);
    };
    window.addEventListener(SETTINGS_TAB_EVENT, onRequest);
    return () => window.removeEventListener(SETTINGS_TAB_EVENT, onRequest);
  }, []);

  const onChange = useCallback((id: string) => setActiveTab(id as SettingsTabId), []);

  return (
    <BasePanel title="Settings" hasContentScroll>
      <div className={css['TabStrip']}>
        <Tabs
          tabs={TABS}
          variant={TabsVariant.Segmented}
          activeTab={activeTab}
          onChange={onChange}
          /* `Tabs.Root` is `height: 100%` — right for the full-height panes the
             segmented variant was built for (UIX-013), wrong for a control used
             on its own, where it would claim the whole scroll viewport. Inline
             rather than a class in this panel's own module, because two single-
             class selectors tie on specificity and the winner is then whichever
             stylesheet the bundler emitted last. */
          UNSAFE_style={{ height: 'auto' }}
        />
      </div>

      {activeTab === 'project' ? <ProjectSettingsTab /> : <EditorSettingsTab />}
    </BasePanel>
  );
}
