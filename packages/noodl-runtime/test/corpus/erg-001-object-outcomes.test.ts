/**
 * ERG-001 §4 — the outcome contract on `Object` (`Model2`), and the dead end it had.
 *
 * The third of the three `Fetch`-shaped Data nodes; its twins `Array` and `Variable` are
 * `noodl-viewer-react` sources and live in
 * `packages/noodl-viewer-react/tests/corpus/erg-001-data-fetch-outcomes.test.ts`, whose header
 * carries the family-wide reasoning.
 *
 * `done` and `completed` are **added**; `failure` is **new**.
 *
 * ## ⚠️ `Fetched` is not the rename, and here it is measured
 *
 * `setModelID` fires `fetched` and is reached from the `Id` **input setter** as well as from the
 * `Fetch` port. There is no invocation on the setter path, so folding `fetched` into the outcome
 * would report `Done` for a value binding. A row pins that path as silent.
 *
 * ## ⚠️ The defect this build fixes rather than merely adopts
 *
 * `setModelID` returns early for `undefined` / `null` / `''`, and the file's own comment explains
 * why that is right: *"`Fetched` is not sent on this path: nothing was fetched, and a completion
 * signal for work that went nowhere is what the Failure Contract exists to forbid."*
 *
 * Correct as far as it goes — and it left `Fetch` with a blank `Id` emitting **nothing at all**,
 * which is the contract's opening sentence about itself: "a node that emits nothing is a dead
 * chain with no diagnostic." The empty spellings are not exotic; NDA-012 measured them arriving
 * from a cleared Text Input. So the port now reports `Failure` with a reason on the NDA-004 bus.
 *
 * ⚠️ **The setter keeps its silence**, and that is the point of splitting them: a blank `Id`
 * *arriving* is not a failure of anything — nobody asked for anything — whereas pressing `Fetch`
 * with nothing to fetch is a request the node cannot honour. Two rows hold that line apart.
 *
 * ## No `Unchanged`
 *
 * `Fetch` rebinds unconditionally; there is no post-condition that can already hold.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the empty-Id branch returning silently again | the empty-Id-fails row only |
 * | the token minted in `setModelID` rather than in `scheduleSetModel` | the binding-is-silent row, and the two-pulses row on its count |
 * | the token minted inside `scheduleSetModel`'s guard rather than before it | the two-pulses row only |
 */

/* eslint-env jest */

const metadata: Record<string, unknown> = {};

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: (key: string) => metadata[key] },
  Node: require('../../src/node')
}));

import type { NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ModelNodeModule = require('../../src/nodes/std-library/data/modelnode2');

async function graphWith(parameters: Record<string, unknown> = {}): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [ModelNodeModule as unknown as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type: 'Model2', parameters }], connections: [] }]
    } as never
  });
  await graph.settle(2);
  return graph;
}

function outcomesOf(graph: CorpusGraph, id = 'node'): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function pulse(graph: CorpusGraph, port: string, id = 'node'): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

describe('ERG-001 §4: Object', () => {
  test('a Fetch with an Id reports Done then Completed, beside the existing Fetched', async () => {
    const graph = await graphWith();
    graph.node('node').setInputValue('modelId', 'o1');
    await graph.settle(2);
    pulse(graph, 'fetch');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals).toContain('fetched');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
  });

  /**
   * ⚠️ The claim the "do not fold `Fetched` in" decision rests on for this node: `setModelID`
   * fires `fetched` straight from the `Id` setter, where there is no invocation. If the token
   * were minted there, this row would see an outcome.
   */
  test('binding Id reports no outcome at all, though it does announce Fetched', async () => {
    const graph = await graphWith();
    graph.node('node').setInputValue('modelId', 'o1');
    await graph.settle(2);

    expect(graph.signalsFor('node')).toContain('fetched');
    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  /**
   * ⚠️ The dead end, closed. This used to emit **nothing**: no `Fetched` (correctly — nothing
   * was fetched) and no failure either, so a chain hanging off this node simply stopped, with
   * no diagnosis in the editor, the console or `On App Error`.
   */
  test.each([
    ['unset', undefined],
    ['blank', '']
  ])('a Fetch with a %s Id reports Failure with a reason, then Completed', async (_label, id) => {
    const graph = await graphWith();
    if (id !== undefined) graph.node('node').setInputValue('modelId', id);
    await graph.settle(2);
    pulse(graph, 'fetch');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.signalsFor('node')).not.toContain('fetched');
    expect(graph.errors.map((e) => e.code)).toEqual(['object/fetch-failed']);
    expect(graph.errors[0].message).toMatch(/no Id/i);
  });

  /**
   * ✅ Pinned control, and the line the fix above must not cross.
   *
   * A blank `Id` *arriving* is not a failure of anything: nobody asked for anything. Only
   * pressing `Fetch` with nothing to fetch is a request the node cannot honour.
   */
  test('(pinned control) a blank Id arriving on the setter reports nothing and raises nothing', async () => {
    const graph = await graphWith();
    graph.node('node').setInputValue('modelId', 'o1');
    await graph.settle(2);
    graph.node('node').setInputValue('modelId', '');
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
    expect(graph.errors).toEqual([]);
  });

  test('two Fetch pulses in one frame coalesce into one rebind and still report two outcomes', async () => {
    const graph = await graphWith();
    graph.node('node').setInputValue('modelId', 'o2');
    await graph.settle(2);
    // ⚠️ Counted from *here*, not from boot: binding `Id` already announced one `Fetched` of
    // its own, which is the very fact the row above pins. A flat count would have folded the
    // setter's announcement into the port's and read "two rebinds" for one.
    const fetchedBefore = graph.signalsFor('node').filter((s) => s === 'fetched').length;

    pulse(graph, 'fetch');
    pulse(graph, 'fetch');
    await graph.settle(2);

    expect(graph.signalsFor('node').filter((s) => s === 'fetched').length - fetchedBefore).toBe(1);
    expect(outcomesOf(graph)).toEqual(['done', 'done']);
    expect(graph.signalsFor('node').filter((s) => s === 'completed')).toHaveLength(2);
  });

  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith();
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
    expect(graph.node('node').hasOutput('failure')).toBe(true);
  });

  test('(pinned control) booting reports no outcome', async () => {
    const graph = await graphWith();
    await graph.settle(4);
    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});
