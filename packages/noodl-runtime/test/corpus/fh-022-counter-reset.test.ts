/**
 * FH-022 slice 3 — `Counter.Reset`'s guard, which had never once fired.
 *
 * The count lives at `_internal.currentValue`; the guard read `this.currentValue`, which is
 * `undefined` on every pass, so the early return was dead code from the day it was written
 * (PLAT-003 NOTES §25). ERG-001 §4 kept it verbatim deliberately and said why in the code: it
 * is a behaviour change, and one had no business riding along inside a contract adoption.
 *
 * ⚠️ **The obvious repair is also wrong**, which is why row R-3 exists. Pointing the read at
 * `_internal` while leaving the comparison against `0` would report `Unchanged` for "the count
 * is zero" — a different condition, and wrong on every counter that starts anywhere but zero.
 * The post-condition `Reset` establishes is `currentValue === startValue`.
 *
 * ⚠️ **This is a behaviour change, and it ships alone.** `Count Changed` stops firing on a
 * Reset that changes nothing, and `Reset` starts emitting an outcome it has never emitted.
 * Both are what the contract says should happen, and both are reversible by reverting one
 * commit.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the guard back to `this.currentValue` | R-1 and R-2; R-4 stays green, which is the point of having it |
 * | `_internal.currentValue === 0` instead of `=== startValue` | R-3 only |
 * | reporting `done` from the guard | R-1's outcome clause, not its Count Changed clause |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import CounterNode = require('../../src/nodes/std-library/counter');

interface TriggerInstance extends NodeInstance {
  go(): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' } },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

/** A Counter whose `Reset To Start` and `Increase Count` are both driven from one trigger port. */
async function counterWith(parameters: Record<string, unknown>, targetPort: string): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, CounterNode as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'counter', type: 'Counter', parameters }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'counter', targetPort }]
        }
      ]
    } as never
  });
  await graph.settle(4);
  return graph;
}

function outcomesOf(graph: CorpusGraph): string[] {
  return graph.signalsFor('counter').filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, signal: string): number {
  return graph.signalsFor('counter').filter((s) => s === signal).length;
}

// ---------------------------------------------------------------------------
// R-1 — the criterion, verbatim.
// ---------------------------------------------------------------------------

describe('R-1 — Reset on a counter already at Start Value', () => {
  test('reports Unchanged, fires Completed, and leaves Count Changed silent', async () => {
    const graph = await counterWith({ startValue: 3 }, 'reset');

    // Setting Start Value seeds the count and announces it once at load — that is the
    // `startValueSet` branch, and it is not what this row is about.
    const changedAtLoad = countOf(graph, 'countChanged');

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(outcomesOf(graph)).toEqual(['unchanged']);
    expect(countOf(graph, 'completed')).toBe(1);
    // The behaviour change, stated as an observation rather than as an absence: the count did
    // not move, so nothing downstream is told it did.
    expect(countOf(graph, 'countChanged')).toBe(changedAtLoad);
    expect(graph.node('counter').getOutput('currentCount').value).toBe(3);
    // Not a failure. Reset was a legitimate request whose post-condition already held.
    expect(graph.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R-2 — the other half of the criterion.
// ---------------------------------------------------------------------------

describe('R-2 — Reset on a counter anywhere else', () => {
  test('still reports Done and still fires Count Changed, exactly as before', async () => {
    const graph = await counterWith({ startValue: 3 }, 'increase');

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);
    expect(graph.node('counter').getOutput('currentCount').value).toBe(4);

    // Reset by hand, since the trigger is wired to Increase in this graph.
    const counter = graph.node('counter');
    counter.setInputValue('reset', false);
    counter.setInputValue('reset', true);
    await graph.settle(3);

    expect(outcomesOf(graph)).toEqual(['done', 'done']);
    expect(countOf(graph, 'countChanged')).toBeGreaterThan(1);
    expect(counter.getOutput('currentCount').value).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// R-3 — the repair that would have been wrong.
// ---------------------------------------------------------------------------

describe('R-3 — the post-condition is Start Value, not zero', () => {
  test('a counter sitting at zero with Start Value 5 still moves on Reset', async () => {
    const graph = await counterWith({ startValue: 5 }, 'decrease');

    // Walk it down to exactly zero. `_internal.currentValue === 0` would call this "unchanged",
    // which is a different condition from "already reset" and is wrong on this counter.
    const counter = graph.node('counter');
    for (let i = 0; i < 5; i++) {
      counter.setInputValue('decrease', false);
      counter.setInputValue('decrease', true);
      await graph.settle(2);
    }
    expect(counter.getOutput('currentCount').value).toBe(0);

    graph.signalsFor('counter').length = 0;
    counter.setInputValue('reset', false);
    counter.setInputValue('reset', true);
    await graph.settle(3);

    expect(outcomesOf(graph)).toEqual(['done']);
    expect(counter.getOutput('currentCount').value).toBe(5);
  });

  test('and a counter at Start Value 0 reports Unchanged, so zero is not special either way', async () => {
    const graph = await counterWith({ startValue: 0 }, 'reset');

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(outcomesOf(graph)).toEqual(['unchanged']);
  });
});

// ---------------------------------------------------------------------------
// R-4 — the port set did not change, and the one premise that was wrong.
// ---------------------------------------------------------------------------

describe('R-4 — the port set did not change', () => {
  test('Counter already had Unchanged, so this slice adds no port and describes no new one', async () => {
    const graph = await counterWith({ startValue: 3 }, 'reset');
    const metadata = graph.context.nodeRegister.getNodeMetadata('Counter') as unknown as {
      outputs: Record<string, unknown>;
      inputs: Record<string, unknown>;
    };
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      ['completed', 'countChanged', 'currentCount', 'done', 'unchanged'].sort()
    );
  });

  test('⚠️ but `Treat Unchanged as` does NOT apply to Counter — FH-022 said it did', async () => {
    /**
     * The task doc's slice-3 note ends "`Counter` already has an `unchanged` port … so no port
     * set changes and `Treat Unchanged as` already applies". The first half is true; the second
     * is not, and it is not a Counter quirk.
     *
     * `counter.ts` spreads `outcomeOutputs` and never `outcomeInputs`, so the setting has no
     * port here at all — and, measured from the generated catalog, **30 of the 34 nodes with an
     * `Unchanged` output carry no `treatUnchangedAs` input**. The escape hatch ERG-001 §3
     * shipped reaches four nodes.
     *
     * Recorded rather than fixed: adding it here would change the port set on the one node this
     * behaviour-change commit touches, which is precisely what shipping this slice alone is
     * meant to avoid. The row is written to go red the day somebody closes the gap, which is
     * when the sentence above stops being true.
     */
    const graph = await counterWith({ startValue: 3 }, 'reset');
    const metadata = graph.context.nodeRegister.getNodeMetadata('Counter') as unknown as {
      inputs: Record<string, unknown>;
    };

    expect(metadata.inputs.treatUnchangedAs).toBeUndefined();

    // And so the setting is inert on this node however it is supplied: the outcome stays
    // `unchanged` rather than being remapped to `done`.
    const counter = graph.node('counter');
    counter.setInputValue('treatUnchangedAs', 'done');
    await graph.settle(2);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(outcomesOf(graph)).toEqual(['unchanged']);
  });
});
