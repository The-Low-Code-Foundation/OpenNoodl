/**
 * FIX-025 — one place to say *"the community changed"*, and one place to hear it.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEFECT THIS EXISTS FOR IS A CACHE THAT NOBODY INVALIDATES, AND IT SHIPPED TWICE.
 *
 * Richard, 2026-08-20, on the community tab: *"Replying to a question works, but when I go
 * back to the list of questions the one I answered still says 'no reply yet'."* And on the
 * launcher: *"I'm signed in on the projects page, but on the Learning page it says 'Sign in
 * to NodeGX'."*
 *
 * Both are the same shape. Two hooks read the same remote state independently, each holds its
 * own copy, and a **write performed through one of them leaves the other's copy in place**:
 *
 *  - `useCommunityThread` re-reads its own thread after a reply (it bumps its own generation)
 *    and `useCommunityMirror`, which drew the row saying *no reply yet*, is never told.
 *  - `useCommunityAccount` signs in and updates its own state; `useLearnerPath`, which read
 *    the session once on mount, still believes there is no session — so the *same device flow*
 *    that just succeeded leaves its own sign-in button on screen.
 *
 * ⚠️ **Neither is fixable inside the hook that shows the stale value**, which is why they went
 * unnoticed: each hook is correct about the request it made. The missing thing is between them.
 *
 * ⚠️ **Deliberately not a store, a context or a query cache.** There is no shared state here —
 * every hook already knows how to re-read, and all any of them lacks is a nudge. A cache would
 * add a second copy of the community for the copies to disagree with. This publishes *that*
 * something changed, never *what*, so a subscriber can only respond by re-reading the platform,
 * which keeps the platform the single source of truth (D14's mirror argument, one layer down).
 *
 * ⚠️ **Fires synchronously.** A subscriber's re-read is async anyway, and deferring the notify
 * puts it after a React unmount in the one case that matters — a pane that posts and closes.
 *
 * @module models/community/communitychanged
 */

/** What changed. Subscribers may narrow on it; none has to. */
export type CommunityChange =
  /** A reply, an accepted answer, a post — anything that changes what a thread list would say. */
  | 'threads'
  /** The stored session: signed in, signed out, or replaced. */
  | 'session';

type Listener = (change: CommunityChange) => void;

const listeners = new Set<Listener>();

/**
 * Subscribe. Returns the unsubscribe function — call it from the effect's cleanup, or the
 * listener outlives the component and calls `setState` on something unmounted.
 */
export function onCommunityChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Announce a change.
 *
 * ⚠️ A listener that throws must not stop the others being told — the whole point is that a
 * surface which cannot be reached from here still hears about the write.
 */
export function notifyCommunityChanged(change: CommunityChange): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener(change);
    } catch (error) {
      console.error('[community] a change listener threw', error);
    }
  }
}

/** Test seam: how many subscribers are live. */
export function communityChangedListenerCount(): number {
  return listeners.size;
}
