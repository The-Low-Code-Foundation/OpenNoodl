/**
 * VFN-001, second half — *"including potentially the very logic node you're editing, and then
 * the editor stays open which shouldn't happen"*.
 *
 * A Logic Builder tab holds a `nodeId`. When that node leaves the graph — by the Delete this
 * task fixed, by the context menu, by an undo — the tab used to survive it, editing a model that
 * is no longer there: `BlockTraceClient` keeps arming a node that is gone, and the 300 ms
 * debounce writes the workspace back to it.
 *
 * The decision lives in a pure module precisely so it can be gated here. The provider around it
 * cannot be rendered by either of this package's runners.
 */
import {
  removedNodeIds,
  tabsClosedByNodeRemoval,
  type RemovedNode,
  type TabWithNode
} from '../../src/editor/src/contexts/canvasTabsNodeRemoval';

/**
 * A stand-in for `NodeGraphNode`, whose `forEach` visits the node **and** its descendants —
 * which is the property the group case depends on.
 */
function node(id: string, children: RemovedNode[] = []): RemovedNode {
  return {
    id,
    forEach(callback) {
      callback({ id });
      for (const child of children) child.forEach?.(callback);
    }
  };
}

const tabs: TabWithNode[] = [
  { id: 'logic-builder-a', nodeId: 'a' },
  { id: 'logic-builder-b', nodeId: 'b' },
  { id: 'scratch', nodeId: undefined }
];

describe('VFN-001 — a deleted node takes its tab with it', () => {
  it('closes the tab that was editing the deleted node', () => {
    expect(tabsClosedByNodeRemoval(tabs, node('a'))).toEqual(['logic-builder-a']);
  });

  it('closes nothing when the deleted node had no tab open', () => {
    expect(tabsClosedByNodeRemoval(tabs, node('somebody-else'))).toEqual([]);
  });

  it('closes the tabs of Visual Functions nested inside a deleted group', () => {
    // 🔴 The graph emits `nodeRemoved` **once**, for the group. Its children are dropped from the
    // node map with no event each, so a check against `model.id` alone would leave both of these
    // tabs open — which is the defect, arriving by a different door.
    const group = node('group', [node('a'), node('b')]);

    expect(removedNodeIds(group)).toEqual(new Set(['group', 'a', 'b']));
    expect(tabsClosedByNodeRemoval(tabs, group)).toEqual(['logic-builder-a', 'logic-builder-b']);
  });

  it('never closes a tab that is not editing a node', () => {
    // A tab with no `nodeId` cannot be orphaned by a deletion, so no removal may take it.
    const everything = node('everything', [node('a'), node('b'), node('c')]);

    expect(tabsClosedByNodeRemoval(tabs, everything)).not.toContain('scratch');
  });

  it('survives an event carrying no model', () => {
    expect(tabsClosedByNodeRemoval(tabs, undefined)).toEqual([]);
    expect(tabsClosedByNodeRemoval(tabs, null)).toEqual([]);
    expect(removedNodeIds(undefined)).toEqual(new Set());
  });

  it('falls back to the id when handed something simpler than a real node', () => {
    expect(removedNodeIds({ id: 'a' })).toEqual(new Set(['a']));
    expect(tabsClosedByNodeRemoval(tabs, { id: 'a' })).toEqual(['logic-builder-a']);
  });

  it('closes nothing when a node with no id is removed', () => {
    expect(tabsClosedByNodeRemoval(tabs, {})).toEqual([]);
  });
});
