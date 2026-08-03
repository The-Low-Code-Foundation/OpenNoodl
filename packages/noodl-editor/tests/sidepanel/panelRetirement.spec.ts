/**
 * AIB-008 criterion 6 — a saved sidebar layout survives the merge.
 *
 * `SidebarModel.switch()` on an unknown id falls through to `createPanel`,
 * throws, and the catch selects the first visible item. So retiring `github`
 * without a mapping would not *break* anything — a user who last closed the
 * editor on GitHub would simply find themselves somewhere else, silently, with
 * nothing to tell them where their issues went. PNL-008 built the remap for
 * exactly that case, and this pins that AIB-008 used it rather than leaning on
 * the fallback.
 *
 * Lives in the jasmine suite rather than `tests-unit/` on purpose:
 * `settingsPanelRoute.ts` imports `SidebarModel`, so the plain-Node runner
 * refuses it — which is that runner's boundary working, not a problem to route
 * around.
 */

import {
  RETIRED_PANEL_IDS,
  SETTINGS_PANEL_ID
} from '../../src/editor/src/views/panels/SettingsPanel/settingsPanelRoute';
import { VersionControlPanel_ID } from '../../src/editor/src/views/panels/VersionControlPanel';

describe('AIB-008 — the retired GitHub panel id', () => {
  it('remaps to version control, where its contents went', () => {
    expect(RETIRED_PANEL_IDS['github']).toEqual({ id: VersionControlPanel_ID });
  });

  it('asks for no settings tab — the merged panel has sections, not tabs', () => {
    expect(RETIRED_PANEL_IDS['github'].tab).toBeUndefined();
  });

  it('leaves the panels PNL-008 retired exactly as they were', () => {
    // A regression guard with a real failure mode: the table is one object
    // literal, and an edit that reformats it is an edit that can drop a row.
    expect(RETIRED_PANEL_IDS['app-setup']).toEqual({ id: SETTINGS_PANEL_ID, tab: 'project' });
    expect(RETIRED_PANEL_IDS['editor-settings']).toEqual({ id: SETTINGS_PANEL_ID, tab: 'editor' });
    expect(RETIRED_PANEL_IDS['cloud-functions']).toEqual({ id: 'components' });
  });

  it('never maps a retired panel onto another retired panel', () => {
    // One hop only. A chain would leave `switch()` with an id that is still not
    // registered, which is the failure this whole table exists to avoid.
    const chained = Object.entries(RETIRED_PANEL_IDS)
      .filter(([, mapping]) => RETIRED_PANEL_IDS[mapping.id])
      .map(([from, mapping]) => `${from} -> ${mapping.id}`);
    expect(chained).toEqual([]);
  });
});
