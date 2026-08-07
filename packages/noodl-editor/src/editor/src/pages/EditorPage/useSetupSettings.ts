import { useEffect } from 'react';

import { peekPendingScopePlan } from '@noodl-models/AiAssistant/scoping/pendingPlan';
import { ProjectModel } from '@noodl-models/projectmodel';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { EditorSettings } from '@noodl-utils/editorsettings';

import { AiAuthoringPanel_ID } from '../../views/panels/AiAuthoringPanel';
import { RETIRED_PANEL_IDS, requestSettingsTab } from '../../views/panels/SettingsPanel';

/** PNL-003's per-panel widths and PNL-009's float rects, keyed by panel id. */
const WIDTHS_KEY = 'editor-sidebar-widths';
const FLOAT_RECTS_KEY = 'editor-sidebar-float-rects';
const ACTIVE_PANEL_KEY = 'editor-sidebar-panel';

/**
 * PNL-008 — retire panel ids without losing the user's place.
 *
 * Three keys under the project's settings are keyed by panel id: the active
 * panel (here), per-panel widths (PNL-003) and float rects (PNL-009). A project
 * last closed on `app-setup` restores an id that no longer exists; `switch()`
 * silently no-ops on an unknown id and the guard below falls back to
 * `components`, so nothing breaks — the user just silently ends up somewhere
 * they did not leave off.
 *
 * The three are treated consistently, but not identically, and the difference is
 * deliberate:
 *
 *   - the **active panel** is remapped, and the tab that absorbed it is
 *     requested, so App Setup reopens on Project and Editor settings on Editor.
 *   - the **width** and **float rect** entries are *dropped*, not carried over.
 *     Carrying `app-setup`'s width onto `settings` would overwrite the width the
 *     user had already chosen for the surviving panel. Dropping is also
 *     order-independent, which matters: `useSidePanelLayout` reads the width map
 *     during render, before this effect runs, and a retired id is simply never
 *     looked up again.
 *
 * Idempotent, so it is safe on every open, not just the first after upgrading.
 */
function migrateRetiredPanelIds(projectEditorSettings: Record<string, unknown>): string | undefined {
  const savedPanelId = projectEditorSettings[ACTIVE_PANEL_KEY] as string | undefined;
  const patch: Record<string, unknown> = {};

  let resolvedPanelId = savedPanelId;
  const mapping = savedPanelId ? RETIRED_PANEL_IDS[savedPanelId] : undefined;
  if (mapping) {
    resolvedPanelId = mapping.id;
    patch[ACTIVE_PANEL_KEY] = mapping.id;
    if (mapping.tab) requestSettingsTab(mapping.tab);
  }

  for (const key of [WIDTHS_KEY, FLOAT_RECTS_KEY]) {
    const stored = projectEditorSettings[key];
    if (!stored || typeof stored !== 'object') continue;

    const retired = Object.keys(stored).filter((id) => RETIRED_PANEL_IDS[id]);
    if (retired.length) {
      /*
       * `setMerge` deep-merges and can only ever *add* — handing it the filtered
       * map would leave the retired entries exactly where they were. Writing
       * `undefined` is the one thing it will do: `deepMerge` assigns it straight
       * through, and `JSON.stringify` drops undefined values on the next store.
       */
      patch[key] = Object.fromEntries(retired.map((id) => [id, undefined]));
    }
  }

  if (Object.keys(patch).length) {
    EditorSettings.instance.setMerge(ProjectModel.instance.id, patch);
  }

  return resolvedPanelId;
}

export function useSetupSettings() {
  useEffect(() => {
    const eventGroup = {};

    // Set the active side panel
    const projectEditorSettings = EditorSettings.instance.get(ProjectModel.instance.id) || {};

    const savedPanelId = migrateRetiredPanelIds(projectEditorSettings);
    const panelExists = savedPanelId && SidebarModel.instance.getItems().find((p) => p.id === savedPanelId);

    /**
     * AIB-005 — arriving with a plan agreed in the launcher's wizard is not a
     * normal project open. It is the continuation of something the user was in
     * the middle of thirty seconds ago, and without this they land on an
     * unexplained hello-world page with the plan behind a rail icon they have no
     * reason to click.
     *
     * **It has to be decided here, not in `EditorPage`'s own mount effect.** It
     * was there first, and it worked for exactly as long as it took this effect
     * to run: two `switch` calls, the second one winning, ending on `components`.
     * There is one owner of "which panel is active on open" and this is it.
     *
     * Peeked, never taken — `ProjectAuthoringView` owns the consumption (into
     * `PlanSessionStore`, per AIB-003) and a second consumer here would be the
     * race that task exists to remove.
     *
     * The user's saved panel is *not* overwritten: the `activeChanged` listener
     * that persists it is subscribed below, after this switch, so an auto-open
     * never becomes the place they come back to. That is the "restore their
     * layout afterwards" trap answered by never disturbing it in the first place.
     */
    const scopePlanWaiting = Boolean(peekPendingScopePlan(ProjectModel.instance.id));
    const panelId = scopePlanWaiting ? AiAuthoringPanel_ID : panelExists ? savedPanelId : 'components';
    SidebarModel.instance.switch(panelId);

    // Save changes to side panel
    SidebarModel.instance.on(
      SidebarModelEvent.activeChanged,
      () => {
        if (!ProjectModel.instance) return;

        const currentPanel = SidebarModel.instance.getCurrent();
        if (!currentPanel.transient) {
          EditorSettings.instance.setMerge(ProjectModel.instance.id, { [ACTIVE_PANEL_KEY]: currentPanel.id });
        }
      },
      eventGroup
    );

    return () => {
      SidebarModel.instance.off(eventGroup);
    };
  }, []);
}
