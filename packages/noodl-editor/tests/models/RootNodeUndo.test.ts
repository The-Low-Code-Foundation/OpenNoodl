import { NodeGraphModel, NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { UndoQueue } from '@noodl-models/undo-queue-model';

/**
 * DEF-040 (phase 80) — **undoing a home-page deletion has to restore the home.**
 *
 * Promoted from `UNOWNED-ROWS-TO-MEASURE.md §8`, driven in DEF-007 s38 on a real editor: delete
 * the home node, press *"Delete it anyway"*, `UndoQueue.undo()`. The `Group` came back into the
 * graph and `ProjectModel.getRootNode()` was **still `null`**.
 *
 * `NodeGraphModel.removeNode` pushes an undo action that re-adds the node. The home pointer is
 * cleared somewhere else entirely — a module-scope `Model.nodeRemoved` listener in
 * `projectmodel.ts` — as a **side effect of an event rather than as part of the undoable act**,
 * so nothing in the undo group knew to reverse it.
 *
 * 🔴 **Not tidiness.** DEF-007 §7.2 shipped a *confirm* rather than a refusal, arguing that a
 * person may legitimately restructure and undo exists. Undo did not repair this, which made that
 * confirm the only protection there was — and sharpens Richard's *"you might not remember what
 * you deleted"*.
 *
 * ⚠️ **Jasmine, in the Electron suite, because that is the only place these load.** `NodeGraphModel`
 * reaches `platform.getUserDataPath()` through its imports and cannot be required under jest. The
 * subtree predicate itself is graded separately and cheaply in `tests-unit/def-040`.
 *
 * The project is a narrow structural double rather than a real `ProjectModel`: `removeNode`
 * reaches its project as `graph.owner.owner` (graph → component → project) and uses exactly two
 * methods. A real `ProjectModel` would drag the singleton and its listener into every spec here,
 * which is what `tests/models/StyleTokensUndo.test.ts` warns about for `UndoQueue`.
 */

interface FakeProject {
  rootNode: NodeGraphNode | undefined;
  getRootNode(): NodeGraphNode | undefined;
  setRootNode(node: NodeGraphNode | undefined): void;
}

function makeProject(): FakeProject {
  return {
    rootNode: undefined,
    getRootNode() {
      return this.rootNode;
    },
    setRootNode(node) {
      this.rootNode = node;
    }
  };
}

/** A graph whose `owner.owner` is the project, which is how `removeNode` finds it. */
function makeGraph(project: FakeProject): NodeGraphModel {
  const graph = new NodeGraphModel();
  graph.owner = { owner: project } as unknown as NodeGraphModel['owner'];
  return graph;
}

function makeNode(id: string): NodeGraphNode {
  return NodeGraphNode.fromJSON({ id, type: 'Group', x: 0, y: 0, parameters: {}, children: [] });
}

describe('DEF-040 — undo restores the project home', () => {
  let originalQueue: UndoQueue;

  beforeEach(() => {
    originalQueue = UndoQueue.instance;
    UndoQueue.instance = new UndoQueue();
  });

  afterEach(() => {
    UndoQueue.instance = originalQueue;
  });

  it('a deleted home node comes back AND is the home again', () => {
    const project = makeProject();
    const graph = makeGraph(project);

    const home = makeNode('home');
    graph.addRoot(home);
    project.setRootNode(home);

    // The listener in projectmodel.ts is what clears it in the running editor; this spec
    // reproduces its effect so the undo half is graded on its own terms.
    graph.removeNode(home, { undo: true, label: 'delete home' });
    project.setRootNode(undefined);

    expect(project.getRootNode()).toBeUndefined();

    UndoQueue.instance.undo();

    // The recorded defect, in two lines: the node came back and the home did not.
    expect(graph.findNodeWithId('home')).toBeTruthy();
    expect(project.getRootNode()).toBe(home);
  });

  it('a home nested inside a deleted Group comes back too', () => {
    const project = makeProject();
    const graph = makeGraph(project);

    const group = makeNode('group');
    const home = makeNode('home');
    group.addChild(home);
    graph.addRoot(group);
    project.setRootNode(home);

    graph.removeNode(group, { undo: true, label: 'delete group' });
    project.setRootNode(undefined);

    UndoQueue.instance.undo();

    expect(graph.findNodeWithId('home')).toBeTruthy();
    expect(project.getRootNode()).toBe(home);
  });

  it('CONTROL: undoing an unrelated deletion does NOT touch the home', () => {
    const project = makeProject();
    const graph = makeGraph(project);

    const home = makeNode('home');
    const other = makeNode('other');
    graph.addRoot(home);
    graph.addRoot(other);
    project.setRootNode(home);

    graph.removeNode(other, { undo: true, label: 'delete other' });
    expect(project.getRootNode()).toBe(home);

    UndoQueue.instance.undo();

    // A fix that restored the home on every undo would pass the two specs above and be
    // wrong; this is the arm that says so.
    expect(project.getRootNode()).toBe(home);
    expect(graph.findNodeWithId('other')).toBeTruthy();
  });

  it('CONTROL: a graph with no project attached still deletes and undoes', () => {
    const graph = new NodeGraphModel();
    const node = makeNode('lonely');
    graph.addRoot(node);

    // `removeNode` reads `this.owner.owner`; a graph outside a component has neither, and
    // must not throw on the way past.
    expect(() => graph.removeNode(node, { undo: true, label: 'delete' })).not.toThrow();
    expect(() => UndoQueue.instance.undo()).not.toThrow();
    expect(graph.findNodeWithId('lonely')).toBeTruthy();
  });
});
