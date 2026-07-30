/**
 * NDA-004 §2 — the Expression node, whose failure value is `0`.
 *
 * The register's triage put Expression at the top of the ⏳ list ("a malformed expression is a real
 * failure and `compileExpression` already returns `null`"). Reading it found the failure was worse
 * than mute in a specific way: **the value it falls back to is plausible**.
 *
 * A node that goes silent is at least visibly doing nothing. This one returns `0`, so `Is False`
 * fires, `Is True` does not, and every downstream branch takes exactly the path it would take for a
 * legitimate zero. There is nothing on the canvas, in the graph, or in a deployed console to
 * distinguish "your expression is broken" from "your expression evaluated to zero".
 *
 * ## Two failure modes, and one of them was misreporting itself
 *
 * `_compileFunction` caught the syntax error, logged it, and returned `undefined`.
 * `_calculateExpression` then called `.apply` on that `undefined`, which threw a `TypeError` into
 * its own catch — so the single diagnosis that reached anywhere at runtime said *"Cannot read
 * properties of undefined"*. The author's actual syntax error existed only in
 * `evalCompileWarnings`, which routes through `sendWarning` and is therefore editor-only.
 *
 * ## Why a Failure port is safe here when it was not on the Object node
 *
 * `registerInputIfNeeded` seeds every discovered input to `0`, not `undefined`. There is no window
 * in which the ports exist but hold nothing, so this node does not pass through a "values have not
 * arrived yet" state on its way to working — which is exactly the state that stopped the Object
 * node getting a port in the first §2 batch. The last row here pins that.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ExpressionNode = require('../../src/nodes/std-library/expression');

/** Feeds the expression's discovered input, so a row can drive re-evaluation. */
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

interface TriggerInstance extends NodeInstance {
  send(value: unknown): void;
}

/** One Expression node fed by one trigger on the input `a`. */
async function graphWith(expression: string): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, ExpressionNode as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'expr', type: 'Expression', parameters: { expression } }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'value', targetId: 'expr', targetPort: 'a' }]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

/** Push a value at the expression's `a` input and settle. */
async function feed(graph: CorpusGraph, value: unknown): Promise<void> {
  graph.node<TriggerInstance>('trigger').send(value);
  await graph.settle(4);
}

describe('NDA-004 §2: an expression that will not compile', () => {
  test('reports itself, rather than the TypeError from calling undefined', async () => {
    const graph = await graphWith('a +* 2');
    await feed(graph, 1);

    const raised = graph.errors.filter((e) => e.code === 'expression/compile-failed');
    expect(raised.length).toBe(1);
    // The point of the row: the message must be the author's syntax error, not the wrapper's.
    // "Cannot read properties of undefined (reading 'apply')" was the only thing that ever
    // reached a deployed runtime, and it names the runtime's bug rather than the author's.
    expect(raised[0].message).not.toContain('apply');
    expect(graph.node('expr').getOutput('error').value as string).toContain('could not be compiled');
  });

  test('fires Failure, and the result is still the 0 it always was', async () => {
    const graph = await graphWith('a +* 2');
    await feed(graph, 1);

    expect(graph.signalsFor('expr')).toContain('failure');
    // Deliberately unchanged. Moving the fallback value would change what existing projects
    // compute, which is not this contract's business — the contract's business is that the
    // 0 is no longer indistinguishable from a real one.
    expect(graph.node('expr').getOutput('result').value).toBe(0);
  });

  test('the broken expression reports once, not once per input change', async () => {
    const graph = await graphWith('a +* 2');
    await feed(graph, 1);
    const before = graph.errors.length;

    await feed(graph, 2);
    await feed(graph, 3);

    // This node is reactive: it re-evaluates every time anything upstream moves. Without the
    // dedupe, one author's typo would emit an event per frame and drown the channel it is
    // trying to report on.
    expect(graph.errors.length).toBe(before);
  });
});

describe('NDA-004 §2: an expression that throws while evaluating', () => {
  test('is reported instead of being swallowed to the console', async () => {
    const graph = await graphWith('a.missing.deeper');
    await feed(graph, { missing: undefined });

    const raised = graph.errors.filter((e) => e.code === 'expression/threw');
    expect(raised.length).toBe(1);
    expect(graph.signalsFor('expr')).toContain('failure');
  });

  test('an evaluation that works again re-arms the report', async () => {
    const graph = await graphWith('a.missing.deeper');
    await feed(graph, { missing: undefined });
    expect(graph.errors.length).toBe(1);

    // Good value: the expression evaluates.
    await feed(graph, { missing: { deeper: 7 } });
    expect(graph.node('expr').getOutput('result').value).toBe(7);

    // Broken again — and heard again. A dedupe that never resets would suppress a real,
    // recurring failure for the life of the session after one report.
    await feed(graph, { missing: undefined });
    expect(graph.errors.length).toBe(2);
  });
});

describe('NDA-004 §2: what must stay silent', () => {
  test('pinned control: a working expression reports nothing at all', async () => {
    const graph = await graphWith('a + 2');
    await feed(graph, 40);

    // Without this, every row above could be satisfied by a node that reports on every
    // evaluation. It also prices the happy path: no raise, no signal, no allocation.
    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('expr')).not.toContain('failure');
    expect(graph.node('expr').getOutput('result').value).toBe(42);
  });

  test('a legitimate zero is not a failure', async () => {
    const graph = await graphWith('a - 2');
    await feed(graph, 2);

    // The value the failure path also returns. These two states were identical from the graph
    // before this change, and the whole port pair exists to separate them.
    expect(graph.node('expr').getOutput('result').value).toBe(0);
    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('expr')).not.toContain('failure');
  });

  test('inputs are seeded to 0, so there is no “values have not arrived” state to fail in', async () => {
    // Never fed. This is the boot condition that stopped the Object node getting a `Failure`
    // port in the first §2 batch, and the reason Expression can safely have one: the discovered
    // input already holds `0` before anything is connected to it.
    const graph = await graphWith('a + 2');

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('expr')).not.toContain('failure');
    expect(graph.node('expr').getOutput('result').value).toBe(2);
  });
});
