import { SidebarModel } from '@noodl-models/sidebar';

/**
 * PNL-008 — the one settings destination, and how the rest of the editor asks
 * for a particular tab inside it.
 *
 * Three rail entries became one, so `switch('editor-settings')` no longer names
 * anything. Callers that used to route to a *specific* settings panel now route
 * to this one and name the tab they wanted. Going through a helper rather than
 * a bare `SidebarModel.instance.switch('settings')` keeps the id in one place —
 * `switch()` silently no-ops on an unknown id, which is exactly how the two dead
 * `switch('cloud-functions')` calls survived WF-007 unnoticed.
 */

/** The registered panel id. Unchanged from the old Project Settings panel. */
export const SETTINGS_PANEL_ID = 'settings';

export type SettingsTabId = 'project' | 'editor';

/**
 * Panel ids this task retired, and where a stored one should land instead.
 *
 * Read on project open (`useSetupSettings`) so a project last closed on App
 * Setup reopens on the tab that absorbed it, rather than falling through to
 * Components and silently losing the user's place.
 *
 * `cloud-functions` is not this task's doing — it has been unregistered since
 * WF-007 retired Cloud Services, and any project that was sitting on it when
 * that landed still has the id stored. It is mapped here for the same reason.
 */
export const RETIRED_PANEL_IDS: Record<string, { id: string; tab?: SettingsTabId }> = {
  'app-setup': { id: SETTINGS_PANEL_ID, tab: 'project' },
  'editor-settings': { id: SETTINGS_PANEL_ID, tab: 'editor' },
  'cloud-functions': { id: 'components' }
};

/**
 * The tab the panel should show when it next mounts (or, if it is already
 * mounted, right now).
 *
 * A module-level value plus a DOM event rather than a context: the panel is
 * mounted by `SidebarModel` outside any provider this module could reach, and
 * callers (Clippy, the id migration) run before it exists.
 */
let requestedTab: SettingsTabId | null = null;

export const SETTINGS_TAB_EVENT = 'nodegx:settings-tab-requested';

/** Consumed once, by the panel, on mount or on the event. */
export function takeRequestedSettingsTab(): SettingsTabId | null {
  const tab = requestedTab;
  requestedTab = null;
  return tab;
}

/** Ask for a tab without switching panels — used by the open-on-project-open path. */
export function requestSettingsTab(tab: SettingsTabId): void {
  requestedTab = tab;
  window.dispatchEvent(new CustomEvent(SETTINGS_TAB_EVENT));
}

/**
 * Open the settings panel, optionally on a particular tab.
 *
 * The tab is requested *before* the switch so a first mount reads it
 * synchronously and never renders the wrong tab first.
 */
export function openSettingsPanel(tab?: SettingsTabId): void {
  if (tab) requestSettingsTab(tab);
  SidebarModel.instance.switch(SETTINGS_PANEL_ID);
}
