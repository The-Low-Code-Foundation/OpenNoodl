import { SidebarModel } from '@noodl-models/sidebar';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import type { EdgeRef } from './walkEngine';

/**
 * Ask the Provenance panel to walk backwards from a port, from anywhere in the editor.
 *
 * ⚠️ **This exists because emitting and then switching loses the first request of a session.**
 * The two canvas entry points used to do exactly that inline:
 *
 * ```ts
 * EventDispatcher.instance.emit('provenance:walk', ref);
 * SidebarModel.instance.switch('provenance');
 * ```
 *
 * The panel subscribes to `provenance:walk` when it mounts, and it does not mount until the
 * sidebar switches to it. So the very first *"Why is this empty?"* after opening a project fired
 * into nothing, the panel opened on its own placeholder, and the user had to ask twice. Every
 * later request worked, because the panel stays mounted once shown — which is the worst shape for
 * a bug to have: it is invisible to anyone who has already used the feature, and it is the first
 * thing everybody else sees.
 *
 * Reversing the two lines does not fix it — React mounts on a later tick, so a synchronous emit
 * after `switch()` still arrives before the listener exists. So the request is *stashed* as well
 * as emitted, and a panel that mounts afterwards claims it.
 */
let pendingWalk: EdgeRef | undefined;

export function requestProvenanceWalk(ref: EdgeRef): void {
  // Stash first. If the panel is already mounted its listener runs synchronously inside `emit`
  // and consumes this immediately, so the mount path below never sees a stale request.
  pendingWalk = ref;
  EventDispatcher.instance.emit('provenance:walk', ref);
  SidebarModel.instance.switch('provenance');
}

/**
 * Claim a request made before the panel existed. Returns `undefined` once consumed, so a later
 * remount — switching sidebars, reloading the panel — does not silently repeat an old walk.
 */
export function takePendingProvenanceWalk(): EdgeRef | undefined {
  const ref = pendingWalk;
  pendingWalk = undefined;
  return ref;
}

/** Called by the panel's own listener, so a live request is never also replayed on mount. */
export function clearPendingProvenanceWalk(): void {
  pendingWalk = undefined;
}
