/**
 * DEF-007 — do not let somebody quietly delete the node that is the project's home page.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE ASK (Richard, 2026-08-31):
 *
 * *"Can we at the same time make the app scream loudly when someone tries to delete a home page?
 * There's already the big error in the preview when no homepage has been selected, but to stop
 * people making the accidental deletion mistake."*
 *
 * ⚠️ **"There's already the big error in the preview" is the load-bearing half.** The consequence
 * is not unreported — it is reported *afterwards*, in a different surface, as a project that will
 * not open. This is `lessonprotection.ts`'s defect exactly one level up: the distance between the
 * action and the sentence about it is what makes the mistake unrecoverable in practice, not the
 * absence of undo.
 *
 * ## 🔴 What was ALREADY protected, and why this module is still needed
 *
 * Deleting the home **component** from the Components panel is already refused outright —
 * `ProjectModel.deleteComponentAllowed` answers *"Home component can't be deleted"* and
 * `useComponentActions.handleDelete` shows it. **That door is shut and this module does not touch
 * it.**
 *
 * The door that is open is the **node canvas**. The home is a *node*, not a component
 * (`ProjectModel.rootNode`), and selecting it and pressing Delete goes through `EditorClipboard`
 * → `NodeGraphModel.removeNode` → a module-scope listener in `projectmodel.ts`:
 *
 * ```ts
 * EventDispatcher.instance.on('Model.nodeRemoved', function (e) {
 *   if (ProjectModel.instance && ProjectModel.instance.getRootNode() === e.args.model) {
 *     ProjectModel.instance.setRootNode(undefined);   // ← silent
 *   }
 * });
 * ```
 *
 * That is the whole of what happens today: the project's home is set to `undefined` with no
 * toast, no dialog and no entry anywhere a person looks. The refusal in the Components panel makes
 * this *worse* rather than better, because it teaches that the home is protected.
 *
 * ## 🔴 Why this walks the SUBTREE and the listener above does not
 *
 * `removeNode` notifies `nodeRemoved` **only for the node passed to it** — its children are
 * dropped from `nodeMap` in a `forEach` with no notification each (`NodeGraphModel.ts:441-455`).
 * So the listener above sees an ancestor deletion and does not fire, and a root node that has been
 * dragged inside a Group would be removed from the graph while `ProjectModel.rootNode` went on
 * pointing at it. This module asks the caller for the **flattened removal set** instead, which is
 * right for both shapes and does not depend on that asymmetry staying as it is.
 *
 * ⚠️ **A confirm, never a refusal.** The same reasoning `lessonprotection.ts` gives: a person is
 * allowed to restructure their own project, and the Components panel already demonstrates what a
 * refusal costs — there is no way to delete a home component at all, even deliberately, which is
 * a second defect this module is careful not to copy onto the canvas.
 *
 * @module models/homeprotection
 */

/** A node as this module needs to see it. Structural, so tests need no editor. */
export interface DeletedNodeView {
  id: string;
  label?: string;
  typeName?: string;
}

export interface HomeDeletionFinding {
  /** What to call the node in the dialog. */
  nodeName: string;
  /** The component the home node lives in, when the caller knows it. */
  componentName?: string;
}

/**
 * The home node among the nodes about to be removed, or `null`.
 *
 * @param deleting    every node that will actually be removed — **including descendants**, which
 *                    the caller flattens. See the module note on why.
 * @param rootNodeId  `ProjectModel.getRootNode()?.id`. Absent or empty means the project has no
 *                    home right now, and there is nothing to protect.
 * @param homeComponentName  optional, purely for the sentence.
 */
export function homeInDeletion(
  deleting: readonly DeletedNodeView[],
  rootNodeId: string | undefined | null,
  homeComponentName?: string
): HomeDeletionFinding | null {
  // ⚠️ Guarded before the scan rather than relying on `undefined === undefined` never matching:
  // a `DeletedNodeView` with no id would otherwise match a project with no home and warn about
  // deleting a home that does not exist.
  if (!rootNodeId) return null;

  const home = deleting.find((n) => n.id === rootNodeId);
  if (!home) return null;

  return {
    nodeName: home.label || home.typeName || 'this node',
    componentName: homeComponentName
  };
}

/**
 * The sentence the confirm dialog shows. `null` when there is nothing to warn about, which is the
 * caller's signal to delete without asking.
 *
 * 🔴 **It names the CONSEQUENCE, not the rule.** *"This is the home page"* is a fact somebody can
 * agree with and still not understand; what they need is that the app stops opening. The second
 * sentence is the way out, because a dialog that only says what breaks leaves somebody who
 * genuinely meant it with nothing to do next.
 */
export function homeDeletionMessage(finding: HomeDeletionFinding | null): string | null {
  if (!finding) return null;

  const where = finding.componentName ? ` in “${finding.componentName}”` : '';
  return (
    `“${finding.nodeName}”${where} is this project’s home page — the page the app opens on. ` +
    `Delete it and the project has no home: preview will show an error instead of your app, and ` +
    `anyone who installs it as a template will see the same. You can pick a new home afterwards ` +
    `by right-clicking a component and choosing “Make home”.`
  );
}
