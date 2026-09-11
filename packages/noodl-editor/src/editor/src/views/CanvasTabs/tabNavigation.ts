/**
 * VFN-004, second half — clicking the tab takes you back.
 *
 * The decision (`tabActivation`) and the sentences (`componentGoneMessage`) are pure and live in
 * `tabLocation.ts`; this file is the part that touches the project and the canvas, and it is
 * deliberately thin. It is the *only* place in the Logic Builder that navigates.
 *
 * 🔴 **Not `Router.route()`.** The editor's router early-returns when the route it is asked for
 * is the route it is already on, so an editor→editor `route()` is a silent no-op: it returns
 * normally, nothing moves, and the result is indistinguishable from a dead click handler — i.e.
 * indistinguishable from the bug this task exists to fix. `switchToComponent` is the door the
 * components panel, the search panel, the problems panel and the provenance panel all use, and it
 * is the door used here.
 */

import { NodeGraphContextTmp } from '../../contexts/NodeGraphContext/NodeGraphContext';
import { componentInstanceId } from '../../models/componentIdentity';
import type { ComponentModel } from '../../models/componentmodel';
import { ProjectModel } from '../../models/projectmodel';
import { ToastLayer } from '../ToastLayer/ToastLayer';
import {
  componentGoneMessage,
  componentLabelsFor,
  componentUnknownMessage,
  tabActivation,
  type TabActivation,
  type TabLocation
} from './tabLocation';

/** A tab, as far as navigation is concerned: where it belongs, and which node to select. */
export interface NavigableTab extends TabLocation {
  nodeId?: string;
}

/**
 * The component with this identity, or `undefined`.
 *
 * `ProjectModel` indexes components by name and offers no lookup by identity, so this is a scan. It
 * is over the project's component list and it runs once per tab click; the alternative — keying off
 * the name — is the stale-copy trap this task was told not to walk into.
 *
 * 🔴 **The key is `componentInstanceId`, not `component.id`.** `.id` is optional and absent for most
 * components of a v1 legacy project, which is what made this whole feature dead on arrival: the
 * lookup found nothing, `isTabAway` correctly refused to assert, and the tab sat there marked
 * "home" while the canvas was somewhere else. See `models/componentIdentity.ts`.
 *
 * ⚠️ Asking here **mints** an identity for any component that has not been asked about yet. That is
 * intended and is what makes the two sides agree: the tab's key and the canvas's key are minted by
 * the same function off the same model objects, so neither can be `undefined` while the other is not.
 */
export function findComponentByInstanceId(componentId: string | undefined, project = ProjectModel.instance) {
  if (!componentId || !project) return undefined;
  return project.getComponents().find((component) => componentInstanceId(component) === componentId);
}

/** The identity of the component currently on the node graph canvas, if any. */
export function getActiveComponentId(): string | undefined {
  return componentInstanceId(NodeGraphContextTmp.nodeGraph?.activeComponent);
}

/**
 * The component's name *now* — so a rename shows up in the label rather than the copy taken when
 * the tab opened. Falls back to nothing; the caller falls back to the snapshot.
 */
export function resolveComponentName(componentId: string | undefined): string | undefined {
  return findComponentByInstanceId(componentId)?.displayName;
}

/**
 * The component's full name *now* — what the tooltip says, and the one that disambiguates.
 *
 * `displayName` is the last path segment, so two components in different folders can share one;
 * the label lives with that (it is the common case, and the width is the point), the tooltip does
 * not have to.
 *
 * ⚠️ Read off the model, never assembled here. Component names in this codebase are **not**
 * leading-slash normalised, so a path built by string surgery is a path that matches nothing.
 */
export function resolveComponentPath(componentId: string | undefined): string | undefined {
  return findComponentByInstanceId(componentId)?.fullName;
}

export interface ResolvedTab<T extends TabLocation> {
  tab: T;
  /** The component string the label should paint, or `undefined` when the tab does not know. */
  componentLabel?: string;
  /** The full path, for the tooltip. */
  componentPath?: string;
}

/**
 * Every open tab's location, resolved against the project as it is *now*.
 *
 * Two resolutions and one cross-tab decision, done once for the whole tab bar:
 *
 * - The names come from each tab's `componentId` rather than from the copy taken when it opened,
 *   so a **rename** reaches the label. The snapshot is the fallback, and it is the right one: the
 *   only case the project can no longer answer for is a component that has been deleted, which is
 *   exactly when the snapshot is all anyone has.
 * - `componentLabelsFor` needs all the tabs at once, because whether "Home" is enough of an answer
 *   depends on whether the *other* open tab is also in a "Home".
 *
 * Not memoised, deliberately: its inputs include the project, which changes underneath React
 * without telling it, and a stale label is the defect this task is fixing.
 */
export function resolveTabLocations<T extends TabLocation>(tabs: readonly T[]): ResolvedTab<T>[] {
  const resolved = tabs.map((tab) => ({
    ...tab,
    componentName: resolveComponentName(tab.componentId) ?? tab.componentName,
    componentPath: resolveComponentPath(tab.componentId) ?? tab.componentPath
  }));

  const componentLabels = componentLabelsFor(resolved);

  return resolved.map((tab, index) => ({
    tab,
    componentLabel: componentLabels[index],
    componentPath: tab.componentPath
  }));
}

/**
 * Go to where a tab's blocks live, and leave the node selected.
 *
 * Returns what it decided, so a caller (and a drive) can assert the *consequence* rather than
 * that a function was called.
 *
 * On `'select'` — already standing on the right component — `switchToComponent` is still the call
 * made, and that is not a shortcut. Its component-swap work sits behind an
 * `if (this.activeComponent !== component)` guard, so passing the component it is already on
 * rebinds nothing and pushes no history entry; what still runs is the `args.node` branch, which
 * clears the selection, selects the node and centres it. Which is exactly the required
 * "select the node, navigate nowhere".
 */
export function navigateToTabComponent(tab: NavigableTab): TabActivation {
  const component = findComponentByInstanceId(tab.componentId);

  const decision = tabActivation(tab, {
    componentExists: Boolean(component),
    activeComponentId: getActiveComponentId()
  });

  if (decision === 'refuse-unknown') {
    // Out loud. A click that does nothing at all is the shape of the defect, not a fix for it.
    ToastLayer.showError(componentUnknownMessage(tab));
    return decision;
  }

  if (decision === 'refuse-missing') {
    // 🔴 The tab is NOT closed. Those blocks are still the builder's, and a deleted component is
    // not a reason to throw away a program the author may be halfway through moving somewhere
    // else. The only thing that closes a tab is the node going (VFN-001) or the author saying so.
    ToastLayer.showError(componentGoneMessage(tab));
    return decision;
  }

  switchTo(component as ComponentModel, tab.nodeId, decision);
  return decision;
}

function switchTo(component: ComponentModel, nodeId: string | undefined, decision: TabActivation) {
  const switchToComponent = NodeGraphContextTmp.switchToComponent;
  if (!switchToComponent) {
    console.warn('[CanvasTabs] No node graph to navigate — the canvas is not mounted.');
    return;
  }

  /**
   * `switchToComponent` reads nothing off `node` but `.id` (it re-finds the node in the graph it
   * has just bound, because the model this tab is holding may predate a rebind), so the stand-in
   * is the honest argument here — the same one `ProblemsPanel` passes.
   */
  const node = nodeId ? { id: nodeId } : undefined;

  switchToComponent(component, {
    node,
    // No history entry for a click that did not change component. `switchToComponent` already
    // guards this internally; saying it here as well means the intent survives a refactor of
    // either side.
    pushHistory: decision === 'navigate'
  });
}
