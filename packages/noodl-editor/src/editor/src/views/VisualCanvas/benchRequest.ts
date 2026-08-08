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

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';

export const BENCH_MOUNT_EVENT = 'preview-bench-mount';

let pending: string | undefined;

/** Ask the preview surface to mount `target` (a component's legacy name). */
export function requestBenchMount(target: string): void {
  pending = target;
  EventDispatcher.instance.emit(BENCH_MOUNT_EVENT, { target });
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
