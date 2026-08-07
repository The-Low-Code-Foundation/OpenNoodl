/**
 * AIX-004 — Explain Mode: what the user last pointed at
 *
 * A record of what the user last pointed at, kept because the *live* selection
 * is not always readable when the panel wants it.
 *
 * Switching to any panel outside `panelHoldsCanvasSelection` (EditorEventBindings)
 * deselects every node on `SidebarModelEvent.activeChanged`. Explain used to be
 * outside that list — FH-008 — so opening it destroyed the very selection it was
 * opened to explain, and this memo was the only thing that survived. Explain is
 * in the list now and the live read normally wins; the memo still covers the
 * paths where it cannot:
 *
 *  - `SidebarModelEvent.nodeSelected`, which carries the node id explicitly and
 *    fires whenever clicking a node opens its property panel; and
 *  - the canvas context menu, which captures the live multi-selection at the
 *    moment the user asks for an explanation.
 *
 * It starts at editor boot, not at panel mount, because what it records happens
 * before the panel is ever opened. It is dropped by `SelectionActions.deselect`,
 * so it can never outlive the selection it shadows.
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
  // Quiet when there is nothing to forget. `SelectionActions.deselect` calls this
  // on every canvas mouse-up that lands on nothing, and an event per mouse-up
  // would re-render the panel for a change that did not happen.
  if (remembered === null) return;
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
