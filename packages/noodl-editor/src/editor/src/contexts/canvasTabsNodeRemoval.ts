/**
 * VFN-001 — which open tabs a node removal closes.
 *
 * The wiring lives in `CanvasTabsContext`; the decision lives here, because the decision is the
 * part that can be wrong and the provider cannot be rendered by either of this package's runners
 * (the jasmine suite needs Electron, `tests-unit` is plain Node with no react-dom).
 */

/** The half of a `NodeGraphNode` this needs: an id, and a walk over itself and its descendants. */
export interface RemovedNode {
  id?: string;
  forEach?: (callback: (node: { id?: string }) => void) => void;
}

/** The half of a `Tab` this needs. */
export interface TabWithNode {
  id: string;
  nodeId?: string;
}

/**
 * Every node id the removal took with it — the node itself and everything under it.
 *
 * 🔴 `NodeGraphModel` emits `nodeRemoved` **once**, for the node that was removed, and deletes
 * its descendants from the node map without an event each. A Visual Function nested inside a
 * deleted group therefore has no event of its own, and a check against `model.id` alone would
 * leave its tab open — editing a node that is no longer in the graph, which is the defect.
 *
 * `NodeGraphNode.forEach` visits the node and its children recursively, so it already answers
 * this. The `model.id` fallback is for a caller holding something simpler than a real node.
 */
export function removedNodeIds(removed: RemovedNode | undefined | null): Set<string> {
  const ids = new Set<string>();
  if (!removed) return ids;

  removed.forEach?.((node) => {
    if (node?.id) ids.add(node.id);
  });

  if (ids.size === 0 && removed.id) ids.add(removed.id);

  return ids;
}

/**
 * The ids of the tabs that were editing a node this removal deleted.
 *
 * A tab with no `nodeId` is never closed by a node removal — it is not editing a node, so no
 * deletion can orphan it.
 */
export function tabsClosedByNodeRemoval(tabs: readonly TabWithNode[], removed: RemovedNode | undefined | null): string[] {
  const ids = removedNodeIds(removed);
  if (ids.size === 0) return [];

  return tabs.filter((tab) => tab.nodeId && ids.has(tab.nodeId)).map((tab) => tab.id);
}
