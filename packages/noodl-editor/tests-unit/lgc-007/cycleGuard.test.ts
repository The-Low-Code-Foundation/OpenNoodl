/**
 * LGC-007 §3 — the cycle guard, at save and at generate.
 *
 * ⚠️ **What this prevents is not an error message.** §3: *"the failure mode if this is missed
 * is not an error message; it is a hung renderer during a debounce tick, which will look like
 * the workspace freezing at random."* There is no console line, no stack trace anyone would
 * connect to a saved block, and no way to reproduce it on purpose. It is therefore the single
 * most valuable thing in this task to have under test, and the one thing in it that needs no
 * editor at all — so it has more specs than anything else here.
 *
 * §3 requires the check in **two** places and gives the reason: a definition can be edited
 * after a reference to it was created. Both are graded below, and the second half matters
 * independently of the first — a shelf can acquire a cycle without any save going through it
 * (a hand-edited project file, an imported library, a shelf written by an older build), and
 * that is exactly the state where a save-time-only guard is no guard.
 *
 * Two things here are *not* cycles and are graded anyway:
 *
 * - a **diamond** (A→B, A→C, B→D, C→D) must not be reported as one — a false positive here
 *   refuses a perfectly legal saved block and there is no way for the builder to argue;
 * - an acyclic but **exponential** graph must also terminate, because it hangs the renderer
 *   in exactly the way §3 is about while containing no cycle at all.
 */

import {
  describeCycle,
  findCycle,
  findMissingReferences,
  withEdges,
  type DefinitionGraph
} from '../../src/editor/src/views/BlocklyEditor/myblocks/cycles';
import {
  expandWorkspace,
  MAX_EXPANSIONS
} from '../../src/editor/src/views/BlocklyEditor/myblocks/expand';
import { InMemoryShelf, MyBlocksStore } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { callStatement, callValue, number, setOutput, workspace } from './fixtures';

function newStore() {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

/** A graph straight from an adjacency list, for the pure walk specs. */
function graphOf(edges: Record<string, string[]>): DefinitionGraph {
  return {
    edgesOf: (id) => edges[id],
    nameOf: (id) => id.toUpperCase()
  };
}

describe('LGC-007 §3 — findCycle, the walk itself', () => {
  it('finds a direct self-reference', () => {
    expect(findCycle('a', graphOf({ a: ['a'] }))).toEqual(['a', 'a']);
  });

  it('finds a two-step cycle and closes the path on the node it started from', () => {
    expect(findCycle('a', graphOf({ a: ['b'], b: ['a'] }))).toEqual(['a', 'b', 'a']);
  });

  it('finds a cycle that does not include the node the walk started at', () => {
    // A → B → C → B. Reporting "the loop is A → B → C → B" would be misleading: A is fine.
    expect(findCycle('a', graphOf({ a: ['b'], b: ['c'], c: ['b'] }))).toEqual(['b', 'c', 'b']);
  });

  it('does not call a diamond a cycle — D is reached twice by two legal routes', () => {
    const diamond = graphOf({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] });
    expect(findCycle('a', diamond)).toBeNull();
  });

  it('does not call a repeat visit to a finished node a cycle', () => {
    // The naive "have I seen this before" implementation fails exactly here.
    expect(findCycle('a', graphOf({ a: ['b', 'b'], b: [] }))).toBeNull();
  });

  it('treats a reference to a definition that is not on any shelf as a leaf, not a cycle', () => {
    expect(findCycle('a', graphOf({ a: ['gone'] }))).toBeNull();
    expect(findMissingReferences('a', graphOf({ a: ['gone'] }))).toEqual(['gone']);
  });

  it('terminates on a wide acyclic graph rather than exploring it exponentially', () => {
    // Ten layers, each calling the one below twice: 2^10 paths, 21 nodes. Without the
    // finished-node set this walk does 1024 visits; the point is that it does not.
    const edges: Record<string, string[]> = {};
    for (let i = 0; i < 10; i++) edges[`n${i}`] = [`n${i + 1}`, `n${i + 1}`];
    edges['n10'] = [];

    const started = Date.now();
    expect(findCycle('n0', graphOf(edges))).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('names the cycle in display names, in order', () => {
    const graph = graphOf({ a: ['b'], b: ['a'] });
    expect(describeCycle(findCycle('a', graph), graph)).toBe('A → B → A');
  });

  it('answers for the overlay rather than the stored graph, which is what a save needs', () => {
    const stored = graphOf({ a: [], b: ['a'] });
    // Nothing is cyclic yet. Saving A with an edge to B would make it so.
    expect(findCycle('a', stored)).toBeNull();
    expect(findCycle('a', withEdges(stored, 'a', ['b']))).toEqual(['a', 'b', 'a']);
  });
});

describe('LGC-007 §3 — refused at save', () => {
  it('refuses a definition that calls itself', () => {
    const store = newStore();
    const self = store.save({ name: 'Loop', body: workspace(number(1)), scope: 'project' });

    expect(() => store.save({ id: self.id, name: 'Loop', body: workspace(callValue(self.id)), scope: 'project' })).toThrow(
      /using itself/i
    );
  });

  it('refuses A → B → A, with a message naming the cycle', () => {
    const store = newStore();
    const a = store.save({ name: 'Total', body: workspace(number(1)), scope: 'project' });
    const b = store.save({ name: 'Subtotal', body: workspace(callValue(a.id)), scope: 'project' });

    let error: Error;
    try {
      store.save({ id: a.id, name: 'Total', body: workspace(callValue(b.id)), scope: 'project' });
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MyBlocksCycleError');
    expect(error.message).toContain('Total → Subtotal → Total');
    // Acceptance asks that it be *refused*, which means the shelf is unchanged afterwards.
    expect(store.get(a.id).requires).toEqual([]);
  });

  it('refuses a three-step cycle', () => {
    const store = newStore();
    const a = store.save({ name: 'A', body: workspace(number(1)), scope: 'project' });
    const b = store.save({ name: 'B', body: workspace(callValue(a.id)), scope: 'project' });
    const c = store.save({ name: 'C', body: workspace(callValue(b.id)), scope: 'project' });

    expect(() => store.save({ id: a.id, name: 'A', body: workspace(callValue(c.id)), scope: 'project' })).toThrow(
      /A → B → C → A|A → C → B → A/
    );
  });

  it('catches the cycle when the *definition* is edited, not when the reference is made', () => {
    // This is the case §3 gives as the reason the guard cannot live only at save-of-the-caller.
    const store = newStore();
    const helper = store.save({ name: 'Helper', body: workspace(number(1)), scope: 'project' });
    const main = store.save({ name: 'Main', body: workspace(callValue(helper.id)), scope: 'project' });

    // Editing Helper — a definition the builder may not remember anything points at.
    expect(() =>
      store.save({ id: helper.id, name: 'Helper', body: workspace(callValue(main.id)), scope: 'project' })
    ).toThrow(/using itself/i);
  });

  it('catches a cycle that crosses the two shelves', () => {
    const store = newStore();
    const inProject = store.save({ name: 'Project one', body: workspace(number(1)), scope: 'project' });
    const inBackpack = store.save({ name: 'Backpack one', body: workspace(callValue(inProject.id)), scope: 'user' });

    expect(() =>
      store.save({ id: inProject.id, name: 'Project one', body: workspace(callValue(inBackpack.id)), scope: 'project' })
    ).toThrow(/using itself/i);
  });

  it('allows a diamond, which is not a cycle and must not be refused', () => {
    const store = newStore();
    const d = store.save({ name: 'D', body: workspace(number(1)), scope: 'project' });
    const b = store.save({ name: 'B', body: workspace(callValue(d.id)), scope: 'project' });
    const c = store.save({ name: 'C', body: workspace(callValue(d.id)), scope: 'project' });

    const a = store.save({
      name: 'A',
      body: workspace(setOutput('x', callValue(b.id), setOutput('y', callValue(c.id)))),
      scope: 'project'
    });

    expect(a.requires.sort()).toEqual([b.id, c.id].sort());
  });
});

describe('LGC-007 §3 — refused at generate', () => {
  /**
   * A shelf whose contents were not written through `MyBlocksStore.save`, which is the whole
   * point: a hand-edited project file, an imported library, or a shelf written before the
   * save-time guard existed. Everything below is what happens when the save-time guard was
   * never consulted.
   */
  function cyclicShelfStore() {
    const project = new InMemoryShelf('project');
    const store = new MyBlocksStore({ project, user: new InMemoryShelf('user') });
    project.write({
      formatVersion: 1,
      definitions: [
        {
          formatVersion: 1,
          id: 'a',
          name: 'A',
          shape: 'value',
          params: [],
          requires: [],
          body: workspace(callValue('b')),
          createdAt: '',
          updatedAt: ''
        },
        {
          formatVersion: 1,
          id: 'b',
          name: 'B',
          shape: 'value',
          params: [],
          // ⚠️ `requires` deliberately lies here. If any guard read the cache instead of the
          // body, this graph would look acyclic and the renderer would hang.
          requires: [],
          body: workspace(callValue('a')),
          createdAt: '',
          updatedAt: ''
        }
      ]
    });
    return store;
  }

  it('terminates with a named cycle instead of recursing, for a cycle that never went through save', () => {
    const store = cyclicShelfStore();

    let error: Error;
    try {
      expandWorkspace(workspace(setOutput('r', callValue('a'))), store);
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MyBlocksCycleError');
    expect(error.message).toContain('A → B → A');
    expect(error.message).toContain('No code was generated');
  });

  it('finds the same cycle from the store graph, even though every `requires` says otherwise', () => {
    const store = cyclicShelfStore();
    // The cache says there are no edges at all; the guard reads the bodies.
    expect(store.get('a').requires).toEqual([]);
    expect(findCycle('a', store.graph())).toEqual(['a', 'b', 'a']);
  });

  it('refuses a call to a definition that is not on any shelf rather than generating silence', () => {
    const store = newStore();

    let error: Error;
    try {
      expandWorkspace(workspace(setOutput('r', callValue('vanished'))), store);
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MyBlocksMissingDefinitionError');
    expect(error.message).toContain('vanished');
  });

  it('refuses an acyclic but exponential expansion instead of hanging the renderer', () => {
    // Twelve layers, each calling the one below twice. 2^12 = 4096 copies, and not one cycle
    // anywhere — the failure §3 describes, reached by a route §3 does not mention.
    const project = new InMemoryShelf('project');
    const store = new MyBlocksStore({ project, user: new InMemoryShelf('user') });

    const definitions = [];
    for (let i = 0; i < 12; i++) {
      definitions.push({
        formatVersion: 1,
        id: `n${i}`,
        name: `N${i}`,
        shape: 'statement',
        params: [],
        requires: [],
        body: workspace(callStatement(`n${i + 1}`, [], [], callStatement(`n${i + 1}`))),
        createdAt: '',
        updatedAt: ''
      });
    }
    definitions.push({
      formatVersion: 1,
      id: 'n12',
      name: 'N12',
      shape: 'statement',
      params: [],
      requires: [],
      body: workspace(setOutput('x', number(1))),
      createdAt: '',
      updatedAt: ''
    });
    project.write({ formatVersion: 1, definitions } as never);

    const started = Date.now();
    let error: Error;
    try {
      expandWorkspace(workspace(callStatement('n0')), store);
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MyBlocksBudgetError');
    expect(error.message).toContain(String(MAX_EXPANSIONS));
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('refuses a chain nested past the depth limit', () => {
    const project = new InMemoryShelf('project');
    const store = new MyBlocksStore({ project, user: new InMemoryShelf('user') });

    const definitions = [];
    for (let i = 0; i < 40; i++) {
      definitions.push({
        formatVersion: 1,
        id: `d${i}`,
        name: `D${i}`,
        shape: 'statement',
        params: [],
        requires: [],
        body: workspace(callStatement(`d${i + 1}`)),
        createdAt: '',
        updatedAt: ''
      });
    }
    definitions.push({
      formatVersion: 1,
      id: 'd40',
      name: 'D40',
      shape: 'statement',
      params: [],
      requires: [],
      body: workspace(setOutput('x', number(1))),
      createdAt: '',
      updatedAt: ''
    });
    project.write({ formatVersion: 1, definitions } as never);

    expect(() => expandWorkspace(workspace(callStatement('d0')), store)).toThrow(/nested more than/i);
  });

  it('generates normally when there is no cycle — the guard must not refuse the happy case', () => {
    const store = newStore();
    const inner = store.save({ name: 'Inner', body: workspace(number(7)), scope: 'project' });
    const outer = store.save({ name: 'Outer', body: workspace(callValue(inner.id)), scope: 'project' });

    const result = expandWorkspace(workspace(setOutput('r', callValue(outer.id))), store);

    expect(result.expansions).toBe(2);
    expect(JSON.stringify(result.workspace)).not.toContain('myblocks_call');
  });
});
