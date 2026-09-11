/**
 * DEF-040 (phase 80) — is the project's home node inside the subtree being removed?
 *
 * Two places have to answer this and **they have to agree**:
 *
 *  - the module-scope `Model.nodeRemoved` listener in `projectmodel.ts`, which clears the home;
 *  - `NodeGraphModel.removeNode`, which has to know — *before* the removal — whether its undo
 *    action owes a `setRootNode` on the way back.
 *
 * They used to answer differently, and both were wrong in the same direction. The listener asked
 * `getRootNode() === e.args.model`, and `removeNode` notifies for the node it was handed and
 * **nothing else** while dropping every descendant from `nodeMap`. So a home node sitting inside
 * a deleted Group left the test reading `false`: the home vanished from the graph while
 * `rootNode` went on pointing at it — **a dangling root rather than a null one**, which is the
 * opposite failure and the worse of the two.
 *
 * 🔴 **This lives in its own module so it can be graded.** `NodeGraphModel` and `projectmodel`
 * both reach `platform.getUserDataPath()` through their imports and cannot load outside Electron,
 * so a predicate written inside either could only be checked by a copy of itself.
 *
 * @module noodl-editor/models/nodegraphmodel/rootNodeRemoval
 */

/** The slice of `NodeGraphNode` this needs: a node that can walk itself and its descendants. */
export interface WalkableNode {
  forEach?(callback: (node: unknown) => boolean | void): boolean;
}

/**
 * True when `rootNode` is `removed` itself, or any node beneath it.
 *
 * ⚠️ `NodeGraphNode.forEach` visits the node itself first and **stops on the first truthy
 * return** — it is a `find` wearing a `forEach`'s name. That is exactly the behaviour wanted
 * here, and it is why this one call covers the `===` case as well as the nested one.
 *
 * Falls back to identity when handed something that cannot walk, so a caller passing a bare
 * object degrades to the old behaviour rather than throwing.
 */
export function isRootWithinRemoved(rootNode: unknown, removed: unknown): boolean {
  if (!rootNode || !removed) return false;
  if (removed === rootNode) return true;

  const walkable = removed as WalkableNode;
  if (typeof walkable.forEach !== 'function') return false;

  return walkable.forEach((n) => n === rootNode) === true;
}
