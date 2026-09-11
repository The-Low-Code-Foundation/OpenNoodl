/**
 * P79 G1 — an Expression's `As Number` / `As String` / `As Boolean` outputs never update.
 *
 * Found building spine lesson 5, where wiring `As Number → Creature.size` drew **no circle at
 * all** and every gate stayed green: `create_lesson` scored F1–F4 `pass`, and the render report
 * reported `placeholders: 0`, `consoleErrors: []`, `overflowingCount: 0`.
 *
 * ## The mechanism
 *
 * `Expression` declares fourteen ports. After each evaluation it flagged exactly three outputs
 * dirty — `result`, `isTrue`, `isFalse` — plus `error` on the failure path. `asString`, `asNumber`
 * and `asBoolean` are declared with getters and were **never flagged anywhere in the file**. A
 * getter that is never flagged is never re-read by the graph, so a wire leaving one of those three
 * delivers whatever the getter happened to return when the connection was made, and never again.
 *
 * 🔴 **This is why the test measures a WIRE and not a getter.** `getOutput(...).value` calls the
 * getter directly and is therefore current at HEAD, defect and all — a spec written that way passes
 * against the broken runtime and grades nothing. Every row below reads what a CONNECTED NODE
 * actually received.
 *
 * ⚠️ **One detail of the original row no longer holds and is corrected here, not silently.** It
 * recorded the first `asNumber` reading as `NaN`; the getter now ends `Number(val) || 0`, so an
 * unevaluated expression reads `0`. The port is equally dead either way — and `0` into a dimension
 * is just as invisible as `NaN` — but the number in the write-up is stale.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ExpressionNode = require('../../src/nodes/std-library/expression');

/** Feeds the expression's discovered input `a`. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

/**
 * Records every value a wire delivers to it. This is the instrument the row needs: the
 * difference between a live port and a dead one is invisible from the producing side.
 */
const SinkModule: NodeModule = {
  node: {
    name: 'corpus.Sink',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      this._internal.received = [];
    },
    inputs: {
      value: {
        type: '*',
        set: function (this: NodeInstance, value: unknown) {
          (this._internal.received as unknown[]).push(value);
        }
      }
    }
  }
};

interface TriggerInstance extends NodeInstance {
  send(value: unknown): void;
}

/** One Expression fed by a trigger, with a sink on whichever typed output is under test. */
async function graphWiring(port: string, expression = 'a * 2'): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, SinkModule, ExpressionNode as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'expr', type: 'Expression', parameters: { expression } },
            { id: 'sink', type: 'corpus.Sink' }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'expr', targetPort: 'a' },
            { sourceId: 'expr', sourcePort: port, targetId: 'sink', targetPort: 'value' }
          ]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

async function feed(graph: CorpusGraph, value: unknown): Promise<void> {
  graph.node<TriggerInstance>('trigger').send(value);
  await graph.settle(4);
}

/** What the sink actually received, in order. */
function received(graph: CorpusGraph): unknown[] {
  return graph.node('sink')._internal.received as unknown[];
}

describe('P79 G1 — a typed output delivers down a wire', () => {
  test('🔴 As Number reaches a wired node, and keeps reaching it', async () => {
    const graph = await graphWiring('asNumber');

    await feed(graph, 5);
    expect(received(graph)).toContain(10);

    // The second value is the whole row: before the fix the port delivered once, at connection
    // time, and never again — so a lesson wiring it drew the same thing for ever.
    await feed(graph, 50);
    expect(received(graph)).toContain(100);
  });

  test('🔴 As String reaches a wired node, and keeps reaching it', async () => {
    const graph = await graphWiring('asString');

    await feed(graph, 5);
    expect(received(graph)).toContain('10');

    await feed(graph, 50);
    expect(received(graph)).toContain('100');
  });

  test('🔴 As Boolean reaches a wired node, and keeps reaching it', async () => {
    const graph = await graphWiring('asBoolean', 'a > 3');

    await feed(graph, 5);
    expect(received(graph)).toContain(true);

    await feed(graph, 1);
    expect(received(graph)).toContain(false);
  });

  test('the lesson-5 shape: a size that follows a counter', async () => {
    // `96 + pokes * 8` is the transformation lesson 5 teaches, wired the way its author wired
    // it before finding the port dead.
    const graph = await graphWiring('asNumber', '96 + a * 8');

    await feed(graph, 0);
    await feed(graph, 5);

    expect(received(graph)).toContain(96);
    expect(received(graph)).toContain(136);
  });

  /*
   * The controls. Without these, "flag every output on every evaluation" would pass every row
   * above while changing what the node costs and what it emits.
   */
  test('control — `result` was always live and still is', async () => {
    const graph = await graphWiring('result');

    await feed(graph, 5);
    await feed(graph, 50);

    expect(received(graph)).toContain(10);
    expect(received(graph)).toContain(100);
  });

  test('control — a typed output does not re-deliver when the result has not moved', async () => {
    const graph = await graphWiring('asNumber');

    await feed(graph, 5);
    const afterFirst = received(graph).length;
    // Cardinality first: an absence is only meaningful beside a signal known to fire. If the
    // port delivered nothing at all this row would pass while measuring nothing — which is
    // exactly what it did at HEAD, before the fix.
    expect(afterFirst).toBeGreaterThan(0);

    // Same input, same result. The existing guard around the flagging is
    // `!hadEvaluated || lastValue !== cachedValue`, and the typed outputs ride inside it — so a
    // node whose answer has not changed must stay quiet rather than waking its consumers.
    await feed(graph, 5);
    expect(received(graph).length).toBe(afterFirst);
  });
});
