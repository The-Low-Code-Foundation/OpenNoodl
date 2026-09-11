/**
 * NAT-012 AC7 — drop the panels `SidePanel` has mounted that are no longer registered.
 *
 * ## Why this is a module and not six lines inside the component
 *
 * `SidePanel` calls `useSidePanelLayoutContext`, `useModernModel` and three model subscriptions,
 * so this repo's jest cannot render it — a spec written against the component would not fail, it
 * would fail *to run*, which is the shape of green this phase keeps being bitten by. The decision
 * is about a plain object, so it lives where a spec can reach it.
 *
 * 🔴 **The wiring is proven by the DRIVE, not by a spec.** A source-text assertion that
 * `SidePanel` calls this would pass on dead code — NAT-012 AC3 is the case where exactly that
 * happened. What establishes that this runs is the live reading in the task file: a refused
 * viewer's `[data-panel-id="community"]` present before and absent after.
 *
 * @module noodl-editor/views/SidePanel/prunePanels
 */

/**
 * Remove every entry whose panel id is no longer registered.
 *
 * ⚠️ **Returns the SAME object when nothing is stale**, which is not a micro-optimisation: this
 * is called from a `setPanels` updater, and returning a fresh object every time would re-render
 * `SidePanel` — and so re-run this — on every render that touched the rail.
 *
 * @param panels  What `SidePanel` currently has mounted, keyed by panel id.
 * @param isRegistered  Whether the sidebar still knows this id.
 */
export function prunePanels<T>(panels: Record<string, T>, isRegistered: (id: string) => boolean): Record<string, T> {
  const stale = Object.keys(panels).filter((id) => !isRegistered(id));
  if (stale.length === 0) {
    return panels;
  }

  const next = { ...panels };
  for (const id of stale) {
    delete next[id];
  }
  return next;
}
