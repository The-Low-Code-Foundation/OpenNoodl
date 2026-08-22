/**
 * NAT-012 AC4 — ask the editor to open a community thread, from anywhere in the editor.
 *
 * ## The end that used to be a browser
 *
 * `AskAboutNodeDialog` posts a question to the Bench and then says *"Answers will appear on the
 * Bench"* — a sentence with nowhere to click. Richard's bar for this phase is *"whatever you do in
 * the editor can be viewed and solved in the editor"*, and D6 narrowed the editor's community
 * surface to exactly one project-relevant verb: **ask about this node**. A verb whose last step is
 * a dead end is the whole task, in miniature.
 *
 * So asking opens the thread — in the rail panel, in place, using the same
 * `useCommunityThread` state the panel and the launcher tab already share.
 *
 * ## ⚠️ Why this is a stash and not an emit
 *
 * 🔴 **Emitting and then switching loses the first request of a session**, and
 * `utils/provenance/provenanceRequest.ts` is this repo's written record of paying for it: the
 * panel subscribes when it *mounts*, and `SidePanel` does not construct a panel until the sidebar
 * first switches to it. A synchronous emit before the listener exists fires into nothing, and
 * reversing the two lines does not help — React mounts on a later tick.
 *
 * ⚠️ **This request is the most exposed shape of that bug, not the least.** Somebody asking their
 * first question has, by construction, never opened the Community panel: the dialog is reached
 * from a canvas right-click. So *"the panel was already mounted"* is the rare case here, and the
 * losing one is the ordinary path.
 *
 * @module noodl-editor/utils/community/communityThreadRequest
 */

import { SidebarModel } from '@noodl-models/sidebar';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';

/**
 * ⚠️ The literal id, exactly as `provenanceRequest` uses `'provenance'`. Importing
 * `CommunityPanel_ID` would pull a *view* into a utility that four things call, and the id is the
 * one string this module and `router.setup.ts` have to agree about.
 */
const COMMUNITY_PANEL_ID = 'community';

export const COMMUNITY_THREAD_EVENT = 'community:open-thread';

let pendingThreadId: string | undefined;

/**
 * Open a thread in the editor's community panel.
 *
 * ⚠️ Stash **first**: if the panel is already mounted its listener runs synchronously inside
 * `emit`, clears the stash, and the mount path never sees a stale request.
 */
export function requestCommunityThread(threadId: string): void {
  pendingThreadId = threadId;
  EventDispatcher.instance.emit(COMMUNITY_THREAD_EVENT, threadId);
  SidebarModel.instance.switch(COMMUNITY_PANEL_ID);
}

/**
 * Claim a request made before anything was listening. Returns `undefined` once consumed, so a
 * later remount — switching sidebars, closing and reopening the panel — does not silently reopen
 * a thread the reader has already navigated away from.
 */
export function takePendingCommunityThread(): string | undefined {
  const id = pendingThreadId;
  pendingThreadId = undefined;
  return id;
}

/** Called by a live listener, so a request that was delivered is never also replayed on mount. */
export function clearPendingCommunityThread(): void {
  pendingThreadId = undefined;
}
