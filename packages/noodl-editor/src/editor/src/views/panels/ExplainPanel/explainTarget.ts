/**
 * AIX-004 — Explain Mode: what the user last pointed at
 *
 * **A sidebar panel cannot read the canvas selection when it opens.** Switching
 * to any panel other than `PropertyEditor`/`PortEditor` deselects every node —
 * `EditorEventBindings` does it on `SidebarModelEvent.activeChanged`, so the
 * selection is already gone by the time a panel mounts. A panel that asked
 * `getSelectedNodes()` on mount would always see an empty selection and would
 * only ever be able to explain whole components. (The Data Lineage panel listens
 * for a `selectionChanged` event that nothing in the editor emits, and its
 * context-menu entry is commented out — so it has this bug today.)
 *
 * This module is the fix: it remembers what the user pointed at *before* the
 * deselect, from two sources that both fire early enough —
 *
 *  - `SidebarModelEvent.nodeSelected`, which carries the node id explicitly and
 *    fires whenever clicking a node opens its property panel; and
 *  - the canvas context menu, which captures the live multi-selection at the
 *    moment the user asks for an explanation.
 *
 * It starts at editor boot, not at panel mount, because the selection it needs
 * to see usually happens before the panel is ever opened.
 *
 * @module noodl-editor/views/panels/ExplainPanel/explainTarget
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';

import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';

/** Emitted whenever the remembered target changes. */
export const EXPLAIN_TARGET_CHANGED = 'Explain.TargetChanged';

export interface ExplainTarget {
  /** Full name of the component the nodes live in. */
  componentName: string;
  nodeIds: string[];
}

let remembered: ExplainTarget | null = null;
let started = false;

/** What the user last pointed at, if it is still in the open component. */
export function rememberedTarget(): ExplainTarget | null {
  const activeComponent = NodeGraphContextTmp.nodeGraph?.activeComponent;
  if (!remembered || !activeComponent) return null;
  // A target from a component the user has navigated away from is worse than
  // none: its ids would not resolve, and its citations would point off screen.
  if (remembered.componentName !== activeComponent.fullName) return null;
  return remembered;
}

export function rememberTarget(componentName: string, nodeIds: string[]): void {
  remembered = nodeIds.length ? { componentName, nodeIds: [...nodeIds] } : null;
  EventDispatcher.instance.emit(EXPLAIN_TARGET_CHANGED, remembered);
}

export function forgetTarget(): void {
  remembered = null;
  EventDispatcher.instance.emit(EXPLAIN_TARGET_CHANGED, null);
}

/**
 * Begin tracking. Called once from `router.setup`, deliberately not from the
 * panel — by the time the panel mounts, the selection it needs has been cleared.
 */
export function startExplainTargetTracking(): void {
  if (started) return;
  started = true;

  const group = {};

  SidebarModel.instance.on(
    SidebarModelEvent.nodeSelected,
    (nodeId: string) => {
      const componentName = NodeGraphContextTmp.nodeGraph?.activeComponent?.fullName;
      if (componentName && nodeId) rememberTarget(componentName, [nodeId]);
    },
    group
  );

  // Navigating to another component invalidates the target. `rememberedTarget`
  // also guards against it, but clearing here means the panel is told.
  EventDispatcher.instance.on(
    'activeComponentChanged',
    () => {
      if (remembered) forgetTarget();
    },
    group
  );
}
