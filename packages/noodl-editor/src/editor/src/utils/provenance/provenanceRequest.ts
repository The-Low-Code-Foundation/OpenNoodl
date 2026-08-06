import { SidebarModel } from '@noodl-models/sidebar';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import type { EdgeRef, RootEvent } from './walkEngine';

/**
 * Ask the Provenance panel to look at something, from anywhere in the editor.
 *
 * Two request kinds, one pattern:
 *
 *  - **a walk** — backwards from a port, the canvas right-click's *"Why is this empty?"*;
 *  - **a root** — forwards from one recorded interaction, the recording HUD's expanded list
 *    (HUD-003). This is the join between the two halves of the product split: the HUD says
 *    *that* something happened, and the panel is the only thing that says *why*.
 *
 * ⚠️ **This exists because emitting and then switching loses the first request of a session.**
 * The two canvas entry points used to do exactly that inline:
 *
 * ```ts
 * EventDispatcher.instance.emit('provenance:walk', ref);
 * SidebarModel.instance.switch('provenance');
 * ```
 *
 * The panel subscribes when it mounts, and it does not mount until the sidebar switches to it.
 * So the very first *"Why is this empty?"* after opening a project fired into nothing, the panel
 * opened on its own placeholder, and the user had to ask twice. Every later request worked,
 * because the panel stays mounted once shown — which is the worst shape for a bug to have: it is
 * invisible to anyone who has already used the feature, and it is the first thing everybody else
 * sees.
 *
 * Reversing the two lines does not fix it — React mounts on a later tick, so a synchronous emit
 * after `switch()` still arrives before the listener exists. So the request is *stashed* as well
 * as emitted, and a panel that mounts afterwards claims it.
 *
 * ⚠️ **The root request is *more* exposed to this than the walk ever was.** A right-click at
 * least happens on a canvas whose user has usually opened the panel already. With Record on the
 * canvas (HUD-001) an entire recording session can happen without the Provenance panel ever
 * having been *constructed* — `SidePanel` does not build a panel until it is first opened — so
 * the first click on a root is **always** the losing case rather than merely the first of a
 * session.
 */
let pendingWalk: EdgeRef | undefined;
let pendingRoot: RootEvent | undefined;

/**
 * Only one destination survives.
 *
 * Both stashes are claimed by the same mount, and a panel that claimed both would start a
 * backward walk and then immediately replace it with a forward one — the earlier gesture
 * deciding what the later one shows. The last thing the user pointed at is the thing they meant.
 */
function clearAll(): void {
  pendingWalk = undefined;
  pendingRoot = undefined;
}

export function requestProvenanceWalk(ref: EdgeRef): void {
  // Stash first. If the panel is already mounted its listener runs synchronously inside `emit`
  // and consumes this immediately, so the mount path below never sees a stale request.
  clearAll();
  pendingWalk = ref;
  EventDispatcher.instance.emit('provenance:walk', ref);
  SidebarModel.instance.switch('provenance');
}

/**
 * Open the panel on the forward walk of one recorded interaction.
 *
 * ⚠️ The whole {@link RootEvent} travels, not its `seq`. `seq` **restarts at 1 on a preview
 * reload**, so a number resolved against the buffer on the other side of a reload names a
 * different event with total confidence. Carrying the event itself removes the lookup — and the
 * panel additionally drops a focused root when the session reports the buffer renumbered, which
 * is the same trap one step further along.
 */
export function requestProvenanceRootWalk(root: RootEvent): void {
  clearAll();
  pendingRoot = root;
  EventDispatcher.instance.emit('provenance:root', root);
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

/** The root half of {@link takePendingProvenanceWalk}, with the same claimed-once contract. */
export function takePendingProvenanceRoot(): RootEvent | undefined {
  const root = pendingRoot;
  pendingRoot = undefined;
  return root;
}

/** Called by the panel's own listener, so a live request is never also replayed on mount. */
export function clearPendingProvenanceWalk(): void {
  pendingWalk = undefined;
}

/** Called by the panel's own listener, so a live request is never also replayed on mount. */
export function clearPendingProvenanceRoot(): void {
  pendingRoot = undefined;
}

/**
 * Drop every unclaimed request — the buffer they were about has been replaced.
 *
 * `TraceSession` announces this when a preview reload renumbers the trace, when a new recording
 * is armed, and when the project changes. A root stashed before any of those points at an event
 * that no longer exists, or worse at a *different* event that has inherited its `seq`.
 */
export function clearPendingProvenanceRequests(): void {
  clearAll();
}
