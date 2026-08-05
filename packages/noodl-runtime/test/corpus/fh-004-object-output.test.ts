/**
 * FH-004 — the `Object` node's object-valued output, and the array half it does not need.
 *
 * ✅ Decided by Richard, 2026-08-02 (ERG-004 §7.4). `Object Changed` shipped in phase 35 with
 * an `object`-typed input and **no producer anywhere in the node library**: the whole Data
 * category names an object by string id, so the obvious wire — `Object.Id → Object Changed
 * .Object` — went through the declared `string → object` typecast, which `eval`s the id as a
 * JavaScript literal, throws, catches, substitutes `{}` and leaves the watcher watching
 * nothing for the life of the app. The only working path was a `Script` node returning
 * `Noodl.Object.get(id)`.
 *
 * ## Why the rows connect a receiver rather than reading `getOutput(name).value`
 *
 * The same reason `erg-004-object-changed.test.ts` gives: an output's cached value is correct
 * by the time an assertion runs whether or not the graph ever delivered it. What this file has
 * to prove is that the value **crosses the wire**, because the defect being fixed is a wire
 * that carried a string. So every row here observes through a real `CorpusGraph` connection.
 *
 * ## ⚠️ The `null` row is not tidiness
 *
 * `Node.prototype.sendValue` returns early on `undefined` (`node.ts:687-689`). An unbound
 * `Object` node emitting `undefined` would therefore send *nothing at all*, and a downstream
 * `Object Changed` would go on watching whatever it was given before — the exact
 * silently-wrong shape this task exists to remove, reintroduced one branch over. Row FH004-4
 * is the only thing that catches it.
 *
 * ## Slice 0 — the array side, verified rather than built
 *
 * FH-004 says to check whether `Array.Items` already serves `Array Changed` before building a
 * twin port. `Collection2.items` returns the live `Collection` proxy and `on`/`off` come from
 * `Array.prototype` (`collection.ts`), so `isWatchableArray` should accept it. Row FH004-5
 * measures that end to end instead of arguing it, and it is why `Collection2` gained nothing.
 */

/* eslint-env jest */

const metadata: Record<string, unknown> = {};

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: (key: string) => metadata[key] },
  Node: require('../../src/node')
}));

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import Model = require('../../src/model');
import ModelNodeModule = require('../../src/nodes/std-library/data/modelnode2');

/* eslint-disable @typescript-eslint/no-var-requires */
const ObjectChangedModule = require('../../../noodl-viewer-react/src/nodes/std-library/objectchanged').default;
const ArrayChangedModule = require('../../../noodl-viewer-react/src/nodes/std-library/arraychanged').default;
const CollectionNodeModule = require('../../../noodl-viewer-react/src/nodes/std-library/data/collectionnode2').default;
/* eslint-enable @typescript-eslint/no-var-requires */

/** Records the value ports of whatever it is wired to, as they stood when a signal arrived. */
function recorderModule(seen: Array<Record<string, unknown>>): NodeModule {
  const record = (signal: string) =>
    function (this: NodeInstance) {
      seen.push({ signal, ...(this._internal.values as Record<string, unknown>) });
    };

  // Written through a closure so the recorded key and the port name cannot drift.
  const value = (name: string) => ({
    type: '*',
    set: function (this: NodeInstance, v: unknown) {
      (this._internal.values as Record<string, unknown>)[name] = v;
    }
  });

  return {
    node: {
      name: 'test.PortRecorder',
      category: 'Test',
      initialize: function (this: NodeInstance) {
        this._internal.values = {};
      },
      inputs: {
        a: value('a'),
        b: value('b'),
        c: value('c'),
        s1: { valueChangedToTrue: record('s1') },
        s2: { valueChangedToTrue: record('s2') },
        s3: { valueChangedToTrue: record('s3') },
        s4: { valueChangedToTrue: record('s4') }
      },
      outputs: {}
    } as never
  };
}

interface Wire {
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
}

async function graphOf(
  nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }>,
  connections: Wire[],
  seen: Array<Record<string, unknown>>
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [
      ModelNodeModule as unknown as NodeModule,
      ObjectChangedModule as NodeModule,
      ArrayChangedModule as NodeModule,
      CollectionNodeModule as NodeModule,
      recorderModule(seen)
    ],
    data: { components: [{ name: '/root', nodes, connections }] } as never
  });
  await graph.settle(2);
  return graph;
}

// ---------------------------------------------------------------------------
// FH004-1 — the port exists, and is object-typed.
// ---------------------------------------------------------------------------

describe('FH004-1 — Object declares an object-valued output', () => {
  it('has an `object` output of type object, beside `id`', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const graph = await graphOf([{ id: 'obj', type: 'Model2' }], [], seen);

    const port = graph.node('obj').getOutput('object');
    expect(port).toBeDefined();

    const declared = (
      graph.context.nodeRegister.getNodeMetadata('Model2') as unknown as {
        outputs: Record<string, { type: unknown; displayName?: string; description?: string }>;
      }
    ).outputs.object;
    expect(declared).toBeDefined();
    const typeName = typeof declared.type === 'string' ? declared.type : (declared.type as { name: string }).name;
    expect(typeName).toBe('object');
    expect(declared.displayName).toBe('Object');
    // `description` is canonical (Richard, 2026-08-01) — a port the AI loop and the catalog
    // can see but not read is half a port.
    expect(typeof declared.description).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// FH004-2 — the wire the task exists for, with no Script node in it.
// ---------------------------------------------------------------------------

describe('FH004-2 — Object.Object → Object Changed.Object', () => {
  it('delivers the live Model, so editing a key fires Key Changed with the payload', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const graph = await graphOf(
      [
        { id: 'obj', type: 'Model2', parameters: { modelId: 'fh004-a' } },
        { id: 'watch', type: 'net.noodl.ObjectChanged' },
        { id: 'rec', type: 'test.PortRecorder' }
      ],
      [
        { sourceId: 'obj', sourcePort: 'object', targetId: 'watch', targetPort: 'object' },
        { sourceId: 'watch', sourcePort: 'key', targetId: 'rec', targetPort: 'a' },
        { sourceId: 'watch', sourcePort: 'value', targetId: 'rec', targetPort: 'b' },
        { sourceId: 'watch', sourcePort: 'previousValue', targetId: 'rec', targetPort: 'c' },
        { sourceId: 'watch', sourcePort: 'keyAdded', targetId: 'rec', targetPort: 's1' },
        { sourceId: 'watch', sourcePort: 'keyChanged', targetId: 'rec', targetPort: 's2' }
      ],
      seen
    );

    // The Object node bound `fh004-a` from its parameter; the watcher must have received the
    // Model itself, not the string.
    const watched = graph.node('watch')._internal.object;
    expect(watched).toBe(Model.get('fh004-a'));

    const object = Model.get('fh004-a');
    object.set('name', 'Ada');
    await graph.settle(2);
    object.set('name', 'Grace');
    await graph.settle(2);

    expect(seen).toEqual([
      { signal: 's1', a: 'name', b: 'Ada', c: null },
      { signal: 's2', a: 'name', b: 'Grace', c: 'Ada' }
    ]);
  });
});

// ---------------------------------------------------------------------------
// FH004-3 — what the old wiring did, so the fix is measured against it.
// ---------------------------------------------------------------------------

describe('FH004-3 — the id wire is still the wrong one', () => {
  it('Object.Id → Object Changed.Object watches nothing, which is why the object port exists', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const graph = await graphOf(
      [
        { id: 'obj', type: 'Model2', parameters: { modelId: 'fh004-b' } },
        { id: 'watch', type: 'net.noodl.ObjectChanged' }
      ],
      [{ sourceId: 'obj', sourcePort: 'id', targetId: 'watch', targetPort: 'object' }],
      seen
    );

    // Not an assertion about what *should* happen — a record of the behaviour FH-004 routes
    // around. The typecast is deliberately out of scope (ERG-004 §7.4 blast radius).
    expect(graph.node('watch')._internal.object).not.toBe(Model.get('fh004-b'));
  });
});

// ---------------------------------------------------------------------------
// FH004-4 — an unbound Object says so, rather than saying nothing.
// ---------------------------------------------------------------------------

describe('FH004-4 — clearing the Id clears the watcher', () => {
  it('sends null rather than undefined, so the watcher stops watching the old object', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const graph = await graphOf(
      [
        { id: 'obj', type: 'Model2', parameters: { modelId: 'fh004-c' } },
        { id: 'watch', type: 'net.noodl.ObjectChanged' }
      ],
      [{ sourceId: 'obj', sourcePort: 'object', targetId: 'watch', targetPort: 'object' }],
      seen
    );

    expect(graph.node('watch')._internal.object).toBe(Model.get('fh004-c'));

    // The Empty-Value Contract's explicit clear, arriving the way a cleared Text Input sends it.
    graph.node('obj').setInputValue('modelId', null);
    await graph.settle(2);

    expect(graph.node('watch')._internal.object).toBeNull();

    // And it really unsubscribed: a later edit to the old object reports nothing.
    const signalsBefore = graph.signalsFor('watch').length;
    Model.get('fh004-c').set('name', 'Katherine');
    await graph.settle(2);
    expect(graph.signalsFor('watch').length).toBe(signalsBefore);
  });
});

// ---------------------------------------------------------------------------
// FH004-5 — slice 0. The array half, verified rather than built.
// ---------------------------------------------------------------------------

describe('FH004-5 — Array.Items already serves Array Changed', () => {
  it('delivers the live Collection, so adding an item fires Item Added with Index and Count', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const graph = await graphOf(
      [
        { id: 'arr', type: 'Collection2', parameters: { collectionId: 'fh004-list' } },
        { id: 'watch', type: 'net.noodl.ArrayChanged' },
        { id: 'rec', type: 'test.PortRecorder' }
      ],
      [
        { sourceId: 'arr', sourcePort: 'items', targetId: 'watch', targetPort: 'array' },
        { sourceId: 'watch', sourcePort: 'index', targetId: 'rec', targetPort: 'a' },
        { sourceId: 'watch', sourcePort: 'count', targetId: 'rec', targetPort: 'b' },
        { sourceId: 'watch', sourcePort: 'itemAdded', targetId: 'rec', targetPort: 's1' },
        { sourceId: 'watch', sourcePort: 'itemRemoved', targetId: 'rec', targetPort: 's2' }
      ],
      seen
    );

    // The array crossed the wire as an array, not as its id — this is the whole of slice 0.
    const watched = graph.node('watch')._internal.array;
    expect(Array.isArray(watched)).toBe(true);
    expect(typeof (watched as { on?: unknown }).on).toBe('function');

    const collection = graph.node('arr')._internal.collection as {
      add(m: unknown): void;
      remove(m: unknown): void;
    };
    const first = Model.create({ name: 'Ada' });
    collection.add(first);
    await graph.settle(2);
    collection.remove(first);
    await graph.settle(2);

    expect(seen).toEqual([
      { signal: 's1', a: 0, b: 1 },
      { signal: 's2', a: 0, b: 0 }
    ]);
  });
});
