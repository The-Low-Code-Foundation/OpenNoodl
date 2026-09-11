/**
 * BEN-004 §6 — "Preview in isolation", from a panel that is a different React
 * root and may be asking while the preview surface does not exist.
 *
 * The live case is an event: the components panel emits, `VisualCanvas` is
 * mounted and switches. The case that needs more than an event is
 * `detachedPreview` — the preview is its own window and `VisualCanvas` is not
 * rendered at all, so an event fired at it lands nowhere and the menu item does
 * nothing. `EditorDocument` re-attaches the preview when it sees the request,
 * and by the time the surface mounts the event is long gone.
 *
 * So the request is also *parked*, and the surface claims it on mount. One
 * request, claimed once, by whichever half is there to claim it.
 *
 * @module noodl-editor/views/VisualCanvas/benchRequest
 */

import { ProjectModel } from '@noodl-models/projectmodel';

import { NodeGraphContextTmp } from '../../contexts/NodeGraphContext/NodeGraphContext';
import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';

export const BENCH_MOUNT_EVENT = 'preview-bench-mount';

let pending: string | undefined;

/**
 * Open the benched component in the node graph, so the canvas shows the thing
 * the preview is showing.
 *
 * ⚠️ **Called from the two places a *user* asks for a bench target, and
 * deliberately not from the surface that renders one.** `VisualCanvas` remounts
 * on layout changes and re-claims its scope, so navigating from there would
 * yank the canvas back to the benched component every time — undoing a
 * deliberate move away from it, which is the one thing this must not do. A
 * request is a user action and happens once; a render is neither.
 *
 * Silent when the target does not resolve: the caller is about to mount it and
 * `buildBenchExport` already says *"… is not a component in this project"* on
 * the surface. Two messages for one mistake is worse than one.
 */
export function revealBenchTarget(target: string): void {
  const component = ProjectModel.instance?.getComponentWithName(target);
  if (!component) return;
  EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', { component, pushHistory: true });
}

/**
 * FIX-019 — which component the node graph is showing, by legacy name.
 *
 * The other half of {@link revealBenchTarget}: that one moves the canvas, this
 * one reads where it got to, and the chip between them says when the two
 * surfaces have come apart.
 *
 * ⚠️ **`.name` rather than an id, deliberately.** `scope.target` is a legacy
 * name and this exists to be compared against it, so going via
 * `componentInstanceId` (what `CanvasTabs`'s `useActiveComponentId` does, for
 * its own good reasons) would mean resolving straight back to a name — through
 * a field that is `undefined` on most v1 components.
 *
 * ⚠️ **`NodeGraphContextTmp.nodeGraph` is `null` in the detached preview
 * window**, which has no node graph at all. The optional chaining is the
 * null-guard FIX-019's fourth acceptance criterion drives, and `undefined` is
 * read by `isDivergedFromCanvas` as "nothing to diverge from" rather than as a
 * divergence.
 */
export function activeCanvasComponentName(): string | undefined {
  return NodeGraphContextTmp.nodeGraph?.activeComponent?.name;
}

/** Ask the preview surface to mount `target` (a component's legacy name). */
export function requestBenchMount(target: string): void {
  pending = target;
  EventDispatcher.instance.emit(BENCH_MOUNT_EVENT, { target });
  revealBenchTarget(target);
}

/**
 * Take the parked request, if there is one. Claiming clears it — a request that
 * survived its own handling would re-mount the bench every time the preview
 * surface remounted, which on a layout change is often.
 */
export function takePendingBenchMount(): string | undefined {
  const target = pending;
  pending = undefined;
  return target;
}

/** Drop a parked request without acting on it. Used when the live path took it. */
export function clearPendingBenchMount(): void {
  pending = undefined;
}
