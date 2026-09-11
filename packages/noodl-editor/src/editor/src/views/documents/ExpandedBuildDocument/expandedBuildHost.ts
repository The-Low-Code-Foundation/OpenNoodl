/**
 * BLD-009 — where the expanded document puts its half of the deal.
 *
 * ## Why there is a registry at all
 *
 * The task's constraint is *one* `BuildThread`, and its trap is two of them:
 * "make sure only one thread instance is live at a time, or two subscriptions
 * will both drive the same store and the activity feed will double." The
 * obvious build — mount `AiAuthoringPanel` a second time inside the document —
 * satisfies "one component" and violates exactly that: two mounts, two sets of
 * `useState`, two `AuthoringSession` refs. A run started in the panel would be
 * invisible in the document, and the acceptance criterion *"expand mid-run: the
 * run continues, nothing restarts"* would be unsatisfiable rather than merely
 * unbuilt.
 *
 * So the panel is never mounted twice. `SidePanel` keeps every visited panel
 * mounted behind `display: none` (see its `PanelItems` map), which means the
 * Build panel's instance — with its session, its subscriptions and its
 * in-flight run — is *already* alive and stays alive while a document is open.
 * The expanded document therefore supplies a DOM node, and the panel renders
 * itself into it with `createPortal`. The React component never unmounts; only
 * the DOM it paints into changes.
 *
 * ## Why a module and not a document prop
 *
 * `AppRegistry.openDocument(id, props)` captures its props once, at the call, so
 * a callback passed that way is pinned to the panel instance that opened the
 * document. That is fine until the panel remounts underneath it — the editor's
 * `ErrorBoundary` retry and the sidebar's hot-reload both do — and then the
 * document is holding a handle to a component that no longer exists, with no
 * way to notice. A module the *new* panel instance can read on mount has no
 * such state to go stale: whoever is alive asks where to paint.
 *
 * Deliberately dependency-free (no `Model`, no Electron, no React) so it can be
 * graded in the plain-Node runner alongside the rules it serves.
 *
 * @module noodl-editor/views/documents/ExpandedBuildDocument/expandedBuildHost
 */

let container: HTMLElement | null = null;
const listeners = new Set<() => void>();

/**
 * The node the Build panel should portal into, or null for "stay in the rail".
 *
 * Read at mount as well as subscribed to: a panel that remounts while the
 * expanded document is open must find its way back to it without waiting for an
 * event that already fired.
 */
export function expandedContainer(): HTMLElement | null {
  return container;
}

/**
 * Claim or release the expanded surface.
 *
 * Called by `ExpandedBuildDocument`'s ref callback — `null` on unmount, which is
 * what returns the thread to the rail when any other document takes the surface.
 */
export function setExpandedContainer(next: HTMLElement | null): void {
  if (container === next) return;
  container = next;
  for (const listener of Array.from(listeners)) listener();
}

/** Subscribe; returns the unsubscribe. */
export function onExpandedContainerChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Specs only — module state, and a spec must not inherit another's. */
export function resetExpandedHostForTests(): void {
  container = null;
  listeners.clear();
}
