import { useEffect, useState } from 'react';

import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';

import { AiAuthoringPanel_ID } from './AiAuthoringPanel';

/**
 * Is the Build panel switched on for this user, right now?
 *
 * 🔴 **Build is an `experimental` panel, so it is OFF unless someone turned it on** in Settings →
 * Editor → Experimental panels. `SidebarModel.register` only pushes an experimental item into
 * `items` when its setting is set, and `getPanel` searches `items` — so this is the same question
 * as "is it in the rail", asked without knowing how the rail decides.
 *
 * ⚠️ **It must be re-read, not read once.** The toggle is live: `SidebarModel`'s constructor adds
 * and removes the item as the setting changes and fires `itemsChanged`, so a component that
 * captured the answer at mount would keep offering — or keep hiding — a panel the user has just
 * changed their mind about. Sidebar panels in this editor are hidden rather than unmounted, which
 * makes a stale answer long-lived.
 *
 * Anything that would send the user *into* the Build panel has to ask this first. Richard,
 * 2026-09-06, on the Docs panel's offer to draft docs: *"don't link to the Build panel (unless the
 * user has it turned on)."* A `switch()` to an id that is not registered no-ops silently, so the
 * failure of getting this wrong is a button that does nothing.
 */
export function useBuildPanelEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => Boolean(SidebarModel.instance.getPanel(AiAuthoringPanel_ID)));

  useEffect(() => {
    const group = {};
    SidebarModel.instance.on(
      SidebarModelEvent.itemsChanged,
      () => setEnabled(Boolean(SidebarModel.instance.getPanel(AiAuthoringPanel_ID))),
      group
    );
    return () => {
      SidebarModel.instance.off(group);
    };
  }, []);

  return enabled;
}
