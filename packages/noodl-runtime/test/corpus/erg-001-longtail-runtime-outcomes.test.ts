/**
 * ERG-001 §4 — the long tail's `noodl-runtime` nodes: `Unique Id`, and (below) the CustomCode
 * script hosts and `Condition`.
 *
 * | Node | Action port | Shape |
 * |---|---|---|
 * | `Unique Id` | `New` | `done` (was `generated`) · `completed` — no `Failure`, no `Unchanged` |
 *
 * ## ⚠️ `Generated` is a rename, and the grep is why
 *
 * `sendSignalOnOutput('generated')` has exactly one caller: the `new` port's own
 * `valueChangedToTrue`. No setter route, no subscription — so `Generated` *is* this
 * invocation's outcome, and §0.2 Result 2's "eight ports displaying Done under four wire
 * names" gets one fewer name rather than one more port.
 *
 * ## No `Failure` and no `Unchanged`
 *
 * `Model.guid()` cannot fail and cannot return the id the node already holds, so both ports
 * would be dead ends of exactly the kind §5's check exists to complain about. "A node that
 * cannot fail gets no `Failure` port" — NDA-004 established it and the contract keeps it.
 *
 * ## What reverting reddens — predicted per fixture, before running
 *
 * | Revert | Predicted |
 * |---|---|
 * | `Unique Id` reports `done` before `flagOutputDirty('guid')` | **0** — nothing here observes both in one frame; recorded as an honest non-discrimination |
 * | the `new` handler stops minting a token | 3 — every `Unique Id` row but the port-surface control |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import UniqueIdModule = require('../../src/nodes/std-library/uniqueid');

/** The terminal outcomes a node reported, from a mark. */
function outcomesOf(graph: CorpusGraph, id: string, from = 0): string[] {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, id: string, signal: string, from = 0): number {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === signal).length;
}

function pulse(graph: CorpusGraph, id: string, port: string): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

/** Every signal-typed output a definition declares, by wire name. */
function signalPortsOf(module: unknown): string[] {
  const outputs = ((module as NodeModule).node as { outputs: Record<string, { type?: unknown }> }).outputs;
  return Object.keys(outputs).filter((name) => {
    const type = outputs[name].type;
    return type === 'signal' || (type && (type as { name?: string }).name === 'signal');
  });
}

// =================================================================================================
// Unique Id
// =================================================================================================

describe('ERG-001 §4: Unique Id', () => {
  async function uniqueIdGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [UniqueIdModule as unknown as NodeModule],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'node', type: 'Unique Id', parameters: {} }], connections: [] }]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('a New reports Done then Completed, and Generated is gone', async () => {
    const graph = await uniqueIdGraph();
    pulse(graph, 'node', 'new');
    await graph.settle(3);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(signals).not.toContain('generated');
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('the id really changed, and nothing was raised', async () => {
    const graph = await uniqueIdGraph();
    const before = (graph.node('node')._internal as { guid: string }).guid;

    pulse(graph, 'node', 'new');
    await graph.settle(3);

    expect((graph.node('node')._internal as { guid: string }).guid).not.toBe(before);
    expect(graph.errors).toEqual([]);
  });

  test('two News report two outcomes and two Completeds', async () => {
    const graph = await uniqueIdGraph();
    pulse(graph, 'node', 'new');
    await graph.settle(3);
    pulse(graph, 'node', 'new');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
  });

  test('(pinned control) no Failure and no Unchanged — this node can do neither', () => {
    expect(signalPortsOf(UniqueIdModule).sort()).toEqual(['completed', 'done']);
  });
});

/** Keeps `NodeInstance` referenced so the import is not dropped by `isolatedModules`. */
export type _Unused = NodeInstance;
