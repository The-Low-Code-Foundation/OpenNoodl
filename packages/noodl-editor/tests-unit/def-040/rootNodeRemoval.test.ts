/**
 * DEF-040 (phase 80) — **the home is gone if it was anywhere in the removed subtree.**
 *
 * Promoted from `UNOWNED-ROWS-TO-MEASURE.md §8`. The listener in `projectmodel.ts` asked
 * `getRootNode() === e.args.model`, and `NodeGraphModel.removeNode` notifies for the node it was
 * handed while dropping **every descendant** from `nodeMap`. So a home inside a deleted Group
 * left the test reading `false` — the home vanished from the graph while `rootNode` went on
 * pointing at it. **A dangling root, not a null one: the opposite failure, and the worse of the
 * two**, because `toJSON` then writes a `rootNodeId` naming a node that is not in the file.
 *
 * ⚠️ Graded here because neither `projectmodel` nor `NodeGraphModel` can be imported outside
 * Electron — both reach `platform.getUserDataPath()` through their imports (measured: the import
 * chain is `NodeGraphModel → NodeGraphNode → capability-gating → projectmodel →
 * projectmodel.modules → bugtracker.ts:208`). The predicate was extracted so that the two call
 * sites share one definition **and** so that definition can be checked by something other than a
 * copy of itself. The integration — real `removeNode`, real undo — is graded in the jasmine suite.
 */

import { isRootWithinRemoved } from '../../src/editor/src/models/nodegraphmodel/rootNodeRemoval';

/** A node that walks like `NodeGraphNode`: itself first, stopping on the first truthy return. */
function node(id: string, children: FakeNode[] = []): FakeNode {
  const self: FakeNode = {
    id,
    children,
    forEach(callback) {
      if (callback(self)) return true;
      for (const child of self.children) {
        if (child.forEach(callback)) return true;
      }
      return false;
    }
  };
  return self;
}

interface FakeNode {
  id: string;
  children: FakeNode[];
  forEach(callback: (n: unknown) => boolean | void): boolean;
}

describe('DEF-040 — is the home inside the subtree being removed?', () => {
  it('the node itself — the only case the old test caught', () => {
    const home = node('home');
    expect(isRootWithinRemoved(home, home)).toBe(true);
  });

  it('🔴 a home nested inside a deleted Group — the case that left a DANGLING root', () => {
    const home = node('home');
    const group = node('group', [node('sibling'), node('inner', [home])]);

    expect(isRootWithinRemoved(home, group)).toBe(true);
  });

  it('CONTROL: an unrelated subtree does not clear the home', () => {
    const home = node('home');
    const elsewhere = node('elsewhere', [node('a'), node('b')]);

    // If this ever reads true, the fix clears the home on every deletion — the
    // failure that looks like a success, because "home is null" is also what the
    // defect produced.
    expect(isRootWithinRemoved(home, elsewhere)).toBe(false);
  });

  it('CONTROL: no home, or nothing removed, is not a removal', () => {
    expect(isRootWithinRemoved(undefined, node('group'))).toBe(false);
    expect(isRootWithinRemoved(node('home'), undefined)).toBe(false);
    expect(isRootWithinRemoved(null, null)).toBe(false);
  });

  it('degrades to identity for something that cannot walk, rather than throwing', () => {
    const home = { id: 'home' };
    expect(isRootWithinRemoved(home, home)).toBe(true);
    expect(isRootWithinRemoved(home, { id: 'other' })).toBe(false);
  });

  it('the walk stops early — it is a find, and a deep tree does not change the answer', () => {
    let deepest = node('home');
    for (let i = 0; i < 200; i++) deepest = node(`level-${i}`, [deepest]);

    expect(isRootWithinRemoved(deepest, deepest)).toBe(true);
    // The home is at the bottom; the predicate has to reach it.
    let home = deepest;
    while (home.children.length) home = home.children[0];
    expect(home.id).toBe('home');
    expect(isRootWithinRemoved(home, deepest)).toBe(true);
  });
});
