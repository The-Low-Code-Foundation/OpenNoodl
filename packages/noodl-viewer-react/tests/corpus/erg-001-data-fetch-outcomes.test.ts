/**
 * ERG-001 §4 — the outcome contract on the three `Fetch`-shaped Data nodes.
 *
 * `Array` (`Collection2`) and `Variable` (`Variable2`) live here; their twin `Object`
 * (`Model2`) is a `noodl-runtime` source and is in
 * `packages/noodl-runtime/test/corpus/erg-001-object-outcomes.test.ts`. The three are one family
 * — bind by a name, `Fetch` to rebind — and are built together for the reason `outcome.ts`'s
 * docstring gives: a rule implemented per node diverges.
 *
 * | Node | Action | Shape |
 * |---|---|---|
 * | `Collection2` — Array | `Fetch` | `done` **added** · `completed`; no `Failure` |
 * | `Variable2` — Variable | `Fetch` | `done` **added** · `completed`; no `Failure` *for this port* |
 * | `Model2` — Object | `Fetch` | `done` **added** · **`failure` added** · `completed` |
 *
 * ## ⚠️ Why `Fetched` is added-beside rather than renamed, on all three
 *
 * This is the Record/User question, answered the same way and for the same reason.
 *
 * - On **`Object`** and **`Variable`** it is *measured*: `fetched` fires inside `setModelID` /
 *   `setVariableName`, which are the `Id` and `Name` **input setters**. There is no invocation
 *   on those paths, so folding `fetched` into the outcome would report `Done` for a value
 *   binding. Rows below pin those paths as reporting nothing.
 * - On **`Array`** it is *not* measured — `fetched` there fires only from `scheduleSetCollection`,
 *   which only the port reaches, so `fetched` and `done` always co-fire. ⚠️ **That cost is
 *   recorded rather than hidden**, and it is the same cost `User` carries for the same reason:
 *   these three are documented twins, and splitting the family so one says `Fetched` where the
 *   others say `Done` for the identical author gesture is exactly the per-node divergence the
 *   contract exists to stop. A row asserts the co-firing, including the order.
 *
 * ## `Failure`, node by node — three different answers from three different mechanisms
 *
 * - **`Array`** — `Collection.get(id)` is create-on-read and answers for every spelling,
 *   including none. There is no branch that can refuse, so there is no `Failure` port.
 * - **`Variable`** — `setVariableName` cannot fail either. ⚠️ **The node does have a `failure`
 *   port, and it is not this port's.** It belongs to the `Value` **input setter**, which refuses
 *   a write with no `Name` (NDA-012). A value setter is not an invocation, so it reports no
 *   outcome and emits no `Completed`; a row pins that, because the alternative reading — route
 *   the setter through `reportOutcome` — would emit `Completed` for something nobody invoked.
 * - **`Object`** — ⚠️ **this one had a genuine dead end and it is fixed here, not merely
 *   adopted.** `setModelID` returns early for an empty `Id` and the file's own comment says so:
 *   *"`Fetched` is not sent on this path: nothing was fetched."* Correct as far as it went, and
 *   it left `Fetch` with an empty Id emitting **nothing at all** — the contract's headline class,
 *   in its own words: "a node that emits nothing is a dead chain with no diagnostic." It now
 *   reports `Failure` with a reason on the NDA-004 bus.
 *
 * ## No `Unchanged` on any of the three
 *
 * `Fetch` re-reads and rebinds unconditionally on all three; there is no post-condition that can
 * already hold, and §5 must not be taught to expect a port here.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | `Array`'s token minted inside `scheduleSetCollection`'s guard rather than before it | the two-pulses row only |
 * | `Variable`'s `Value`-setter refusal routed through `reportOutcome` | the setter-is-not-an-invocation row only |
 * | `Object`'s empty-Id branch returning silently again | the empty-Id row only |
 * | any of the three minting in its *setter* | that node's binding-is-silent row — ⚠️ except on `Array`, which has no setter path to `fetched` and therefore no such row |
 */

/* eslint-env jest */

const mockMetadata: Record<string, unknown> = {};

jest.mock('@noodl/runtime', () => {
  const runtime = jest.requireActual('../../../noodl-runtime');
  return {
    __esModule: true,
    default: { instance: { getMetaData: (key: string) => mockMetadata[key] } },
    Node: runtime.Node,
    instance: { getMetaData: (key: string) => mockMetadata[key] }
  };
});

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import CollectionNodeModule from '../../src/nodes/std-library/data/collectionnode2';
import VariableNodeModule from '../../src/nodes/std-library/data/variablenode2';

async function graphWith(module: unknown, type: string, parameters: Record<string, unknown> = {}): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(2);
  return graph;
}

/** The terminal outcomes a node reported, with the value-level announcements dropped. */
function outcomesOf(graph: CorpusGraph, id = 'node'): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function pulse(graph: CorpusGraph, port: string, id = 'node'): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

// =================================================================================================
// Array
// =================================================================================================

describe('ERG-001 §4: Array', () => {
  test('a Fetch reports Done then Completed, beside the existing Fetched', async () => {
    const graph = await graphWith(CollectionNodeModule, 'Collection2');
    graph.node('node').setInputValue('collectionId', 'things');
    await graph.settle(2);
    pulse(graph, 'fetch');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    // ⚠️ Recorded, not hidden: on this node `fetched` has no setter path, so the two always
    // co-fire — the cost `User` carries for the same twins reason. The order is the assertion
    // that matters: the value-level announcement first, the invocation's outcome last.
    expect(signals).toContain('fetched');
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('fetched'));
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
  });

  test('two Fetch pulses in one frame coalesce into one rebind and still report two outcomes', async () => {
    const graph = await graphWith(CollectionNodeModule, 'Collection2');
    graph.node('node').setInputValue('collectionId', 'things');
    await graph.settle(2);

    pulse(graph, 'fetch');
    pulse(graph, 'fetch');
    await graph.settle(2);

    // One rebind — `hasScheduledSetCollection` drops the second pulse's work, deliberately —
    // and two outcomes, because two presses are two invocations.
    expect(graph.signalsFor('node').filter((s) => s === 'fetched')).toHaveLength(1);
    expect(outcomesOf(graph)).toEqual(['done', 'done']);
    expect(graph.signalsFor('node').filter((s) => s === 'completed')).toHaveLength(2);
  });

  // ✅ Pinned control. Binding `Id` rebinds the node; it is a value setter, not an invocation.
  test('(pinned control) binding Id reports no outcome', async () => {
    const graph = await graphWith(CollectionNodeModule, 'Collection2');
    graph.node('node').setInputValue('collectionId', 'things');
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  // ✅ Pinned control. `Collection.get` is create-on-read and answers for every spelling, so
  // there is no branch that could refuse — "a node that cannot fail gets no Failure port".
  test('(pinned control) has no Failure and no Unchanged port', async () => {
    const graph = await graphWith(CollectionNodeModule, 'Collection2');
    expect(graph.node('node').hasOutput('failure')).toBe(false);
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });

  test('(pinned control) booting reports no outcome', async () => {
    const graph = await graphWith(CollectionNodeModule, 'Collection2');
    await graph.settle(4);
    expect(graph.signalsFor('node')).toEqual([]);
  });
});

// =================================================================================================
// Variable
// =================================================================================================

describe('ERG-001 §4: Variable', () => {
  test('a Fetch reports Done then Completed, beside the existing Fetched', async () => {
    const graph = await graphWith(VariableNodeModule, 'Variable2', { name: 'greeting' });
    await graph.settle(2);
    pulse(graph, 'fetch');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
  });

  /**
   * ⚠️ The claim the "do not fold `Fetched` in" decision rests on, for this node.
   *
   * `setVariableName` fires `fetched` and is reached from the `Name` **input setter**. If the
   * token were minted there rather than in the `Fetch` handler, this row would see an outcome.
   */
  test('binding Name reports no outcome at all, though it does announce Fetched', async () => {
    const graph = await graphWith(VariableNodeModule, 'Variable2');
    graph.node('node').setInputValue('name', 'greeting');
    await graph.settle(2);

    expect(graph.signalsFor('node')).toContain('fetched');
    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  /**
   * ⚠️ The node's `Failure` port belongs to the `Value` **setter**, not to `Fetch`.
   *
   * NDA-012 made a `Value` arriving with no `Name` refuse rather than write a key literally
   * named `undefined`. That refusal is a value-setter failure: nobody invoked anything, so it
   * reports no outcome and must not emit `Completed`. Routing it through `reportOutcome` would
   * announce a completion for work no port asked for.
   */
  test('a Value refused for want of a Name fires Failure but reports no outcome', async () => {
    const graph = await graphWith(VariableNodeModule, 'Variable2');
    graph.node('node').setInputValue('value', 'x');
    await graph.settle(2);

    expect(graph.signalsFor('node')).toContain('failure');
    expect(graph.signalsFor('node')).not.toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['variable/no-name']);
  });

  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(VariableNodeModule, 'Variable2');
    expect(graph.node<NodeInstance>('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node<NodeInstance>('node').hasOutput('completed')).toBe(true);
  });

  test('(pinned control) booting reports no outcome', async () => {
    const graph = await graphWith(VariableNodeModule, 'Variable2', { name: 'greeting' });
    await graph.settle(4);
    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });
});
