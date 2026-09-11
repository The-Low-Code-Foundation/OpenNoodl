/**
 * DEF-046 — a value that has not changed re-runs a "Run on value change" input.
 *
 * ## The claim, and where it came from
 *
 * Raised by phase 77 s28 (D26) and carried unowned in phase 80's register: *"a code node
 * received `title: 'Pricing'` twice, identically, ran twice, and **wrote a database row on each
 * run** — three quarters of a defect where one `Duplicate` press created four pages."*
 *
 * 🔴 **AND IT CONTRADICTS THE RUNTIME'S OWN CONTRACT.** `run-on-value-change.ts` — Richard's
 * 2026-08-01 decision — justifies keeping `Run` on the grounds that an async re-fetch *"that
 * returns an identical value fires no change"*. That is only true if an identical value is not a
 * change. Until this file, it was one.
 *
 * ## The instrument, and why it is the scheduler rather than an output
 *
 * The defect is *"the node RAN"*, not *"a different value came out"* — the reported harm is a
 * side effect (a database write), and by definition the output is identical either way. So these
 * rows count calls to the node's own scheduler, which is the thing the setter decides to call.
 * Reading an output instead would measure output de-duplication somewhere downstream and report
 * it as this fix.
 *
 * ⚠️ **Every row is paired.** A guard that stops re-running on an unchanged value and also stops
 * re-running on a changed one is silence, not a fix — so the changed-value control sits beside
 * each claim, and the mutated-array row is the one that says the comparison is primitives-only.
 */
import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ExpressionNode = require('../../src/nodes/std-library/expression');
import FunctionNode = require('../../src/nodes/std-library/simplejavascript');
import ConditionNode = require('../../src/nodes/std-library/condition');

/** A producer that hands a value straight to whatever it is wired to. */
interface ProducerInstance extends NodeInstance {
  produce(value: unknown): void;
}

const ProducerModule: NodeModule = {
  node: {
    name: 'corpus.Producer',
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
      produce(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

/**
 * Count the calls to one method on one node instance, from now on.
 *
 * Returns a reader rather than a number so a row can take a reading, act, and take another —
 * the difference is what every assertion below is about.
 */
function countCalls(node: NodeInstance, method: string): () => number {
  let calls = 0;
  const target = node as unknown as Record<string, (...args: unknown[]) => unknown>;
  const original = target[method].bind(node);
  target[method] = function (...args: unknown[]) {
    calls++;
    return original(...args);
  };
  return () => calls;
}

async function graphWith(node: Record<string, unknown>, modules: NodeModule[], targetPort: string) {
  const graph = await createCorpusGraph({
    modules: [ProducerModule, ...modules],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [{ id: 'prod', type: 'corpus.Producer' }, node],
          connections: [{ sourceId: 'prod', sourcePort: 'value', targetId: 'n', targetPort }]
        }
      ]
    } as never
  });
  await graph.settle(4);
  return graph;
}

const produce = (graph: CorpusGraph, v: unknown) => graph.node<ProducerInstance>('prod').produce(v);

describe('DEF-046 — Expression', () => {
  const expressionGraph = () =>
    graphWith(
      { id: 'n', type: 'Expression', parameters: { expression: 'a + 1' } },
      [ExpressionNode as unknown as NodeModule],
      'a'
    );

  test('🔴 the SAME value arriving twice schedules ONE evaluation, not two', async () => {
    const graph = await expressionGraph();
    produce(graph, 41);
    await graph.settle(4);

    const scheduled = countCalls(graph.node('n'), '_scheduleEvaluateExpression');
    produce(graph, 41);
    await graph.settle(4);

    expect(scheduled()).toBe(0);
  });

  test('🟢 THE CONTROL — a DIFFERENT value still schedules one', async () => {
    const graph = await expressionGraph();
    produce(graph, 41);
    await graph.settle(4);

    const scheduled = countCalls(graph.node('n'), '_scheduleEvaluateExpression');
    produce(graph, 42);
    await graph.settle(4);

    expect(scheduled()).toBeGreaterThan(0);
    expect(graph.node('n').getOutput('result').value).toBe(43);
  });

  test('🟢 THE CONTROL THAT MATTERS MOST — a MUTATED ARRAY is the same reference and still runs', async () => {
    // An array changed in place is `Object.is`-identical to itself. A comparison that did not
    // exclude non-primitives would go quiet here, and every collection node in the runtime hands
    // rows around exactly this way — a silent data-loss bug wearing an optimisation's clothes.
    const graph = await graphWith(
      { id: 'n', type: 'Expression', parameters: { expression: 'a.length' } },
      [ExpressionNode as unknown as NodeModule],
      'a'
    );
    const rows: number[] = [1, 2];
    produce(graph, rows);
    await graph.settle(4);
    expect(graph.node('n').getOutput('result').value).toBe(2);

    const scheduled = countCalls(graph.node('n'), '_scheduleEvaluateExpression');
    rows.push(3);
    produce(graph, rows);
    await graph.settle(4);

    expect(scheduled()).toBeGreaterThan(0);
    expect(graph.node('n').getOutput('result').value).toBe(3);
  });
});

describe('DEF-046 — Function, the node the reported defect was measured on', () => {
  const functionGraph = () =>
    graphWith(
      { id: 'n', type: 'JavaScriptFunction', parameters: { functionScript: 'Outputs.result = Inputs.a;' } },
      [FunctionNode as unknown as NodeModule],
      'in-a'
    );

  test('🔴 the SAME value arriving twice schedules ONE run — the database write that happened twice', async () => {
    const graph = await functionGraph();
    produce(graph, 'Pricing');
    await graph.settle(4);

    const scheduled = countCalls(graph.node('n'), 'scheduleRun');
    produce(graph, 'Pricing');
    await graph.settle(4);

    expect(scheduled()).toBe(0);
  });

  test('🟢 THE CONTROL — a different title still runs it', async () => {
    const graph = await functionGraph();
    produce(graph, 'Pricing');
    await graph.settle(4);

    const scheduled = countCalls(graph.node('n'), 'scheduleRun');
    produce(graph, 'About');
    await graph.settle(4);

    expect(scheduled()).toBeGreaterThan(0);
    expect(graph.node('n').getOutput('out-result').value).toBe('About');
  });
});

describe('DEF-046 — Condition', () => {
  const conditionGraph = () =>
    graphWith({ id: 'n', type: 'Condition' }, [ConditionNode as unknown as NodeModule], 'condition');

  test('🔴 the same answer arriving twice evaluates once', async () => {
    const graph = await conditionGraph();
    produce(graph, true);
    await graph.settle(4);

    const scheduled = countCalls(graph.node('n'), 'scheduleEvaluate');
    produce(graph, true);
    await graph.settle(4);

    expect(scheduled()).toBe(0);
  });

  test('🟢 THE CONTROL — the answer changing evaluates', async () => {
    const graph = await conditionGraph();
    produce(graph, true);
    await graph.settle(4);

    const scheduled = countCalls(graph.node('n'), 'scheduleEvaluate');
    produce(graph, false);
    await graph.settle(4);

    expect(scheduled()).toBeGreaterThan(0);
  });
});
