/**
 * NDA-017 §0 — a signal-driven node cannot tell a fresh input from a stale one.
 *
 * From a Noodl community report (see the task spec): an Expression whose `Run` is connected
 * "gives out the same previous output" when the values feeding it have not landed yet. The
 * phase specced this from source rather than from a reproduction, and §0 is blocking for the
 * reason two earlier tasks made expensive — NDA-008 §0 and NDA-016 §0 both found the spec
 * aimed at the wrong file.
 *
 * ## The idiom under test
 *
 * Every node in this class registers its value setters like this
 * (`expression.ts:120-125`, and eleven more families listed in the spec):
 *
 * ```ts
 * set: function (value) {
 *   this._internal.scope[name] = value;
 *   if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
 * }
 * ```
 *
 * Connect `Run` and the setters go passive: they record the value and schedule nothing. The
 * signal handler then evaluates whatever happens to be in the scope object. The scope entry is
 * never *wrong* in a way the node can detect — it holds the last value that arrived, which is
 * either the value the author meant, a value from a previous cycle, or the seed, and nothing in
 * the node or in `Node` distinguishes the three.
 *
 * ## Why the rows drive frames the way they do
 *
 * `graph.update()` is **synchronous** — it drains the dirty list and the after-update callbacks
 * without yielding — while `graph.settle()` awaits the macrotask queue between frames. A
 * producer that lands its value from a `setTimeout` therefore *cannot* have landed across an
 * `update()`, and that is precisely the real timing being modelled: the `Run` signal arrives on
 * one frame and the async answer arrives some frames later. Rows that used `settle()` here would
 * let the producer win the race and would report the defect as absent.
 *
 * Row 4 is the same claim aimed at the **Function** node, because the reporter's stated
 * workaround was to abandon Expression for Function. If it reproduces there too, the finding is
 * a class rather than a node — and the workaround is not one.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import './expected-failure';

import ExpressionNode = require('../../src/nodes/std-library/expression');
import FunctionNode = require('../../src/nodes/std-library/simplejavascript');

/**
 * A producer whose value lands on a later macrotask.
 *
 * This is the whole point of the report — an HTTP Request, a record query, a Function that
 * awaits. `produce()` returns immediately and the value appears only once the test yields, so a
 * synchronous `update()` between the two sees the port still holding whatever it held before.
 */
const AsyncProducerModule: NodeModule = {
  node: {
    name: 'corpus.AsyncProducer',
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
        setTimeout(() => {
          this._internal.value = value;
          this.flagOutputDirty('value');
        }, 0);
      }
    }
  }
};

/** The thing wired into `Run`. Its presence is what makes the value setters passive. */
const PulseModule: NodeModule = {
  node: {
    name: 'corpus.Pulse',
    category: 'Corpus',
    outputs: {
      signal: { type: 'signal' }
    },
    methods: {
      pulse(this: NodeInstance) {
        this.sendSignalOnOutput('signal');
      }
    }
  }
};

/**
 * Downstream, which is where the damage is done.
 *
 * Row 3's claim is about a disagreement between two ports of the same node, and it is only
 * observable from the far end of the wires: a value port that stays quiet delivers nothing,
 * while a signal port that fires delivers a pulse. Reading the node's own outputs would show
 * the cached value and miss the asymmetry entirely.
 */
const RecorderModule: NodeModule = {
  node: {
    name: 'corpus.Recorder',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      this._internal.values = [];
      this._internal.pulses = 0;
    },
    inputs: {
      value: {
        type: '*',
        set: function (this: NodeInstance, value: unknown) {
          (this._internal.values as unknown[]).push(value);
        }
      },
      bump: {
        type: 'signal',
        valueChangedToTrue: function (this: NodeInstance) {
          (this._internal.pulses as number)++;
        }
      }
    }
  }
};

interface ProducerInstance extends NodeInstance {
  produce(value: unknown): void;
}
interface PulseInstance extends NodeInstance {
  pulse(): void;
}

/** Values delivered to the recorder's value port, in order. */
function delivered(graph: CorpusGraph): unknown[] {
  return graph.node('rec')._internal.values as unknown[];
}
/** Signal pulses delivered to the recorder. */
function pulses(graph: CorpusGraph): number {
  return graph.node('rec')._internal.pulses as number;
}

/**
 * `A + B`, both fed by async producers, `Run` wired, result and `On True` wired downstream.
 *
 * The reported graph, as small as it goes.
 */
async function expressionGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [AsyncProducerModule, PulseModule, RecorderModule, ExpressionNode as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'prodA', type: 'corpus.AsyncProducer' },
            { id: 'prodB', type: 'corpus.AsyncProducer' },
            { id: 'pulse', type: 'corpus.Pulse' },
            { id: 'rec', type: 'corpus.Recorder' },
            { id: 'expr', type: 'Expression', parameters: { expression: 'a + b' } }
          ],
          connections: [
            { sourceId: 'prodA', sourcePort: 'value', targetId: 'expr', targetPort: 'a' },
            { sourceId: 'prodB', sourcePort: 'value', targetId: 'expr', targetPort: 'b' },
            { sourceId: 'pulse', sourcePort: 'signal', targetId: 'expr', targetPort: 'run' },
            { sourceId: 'expr', sourcePort: 'result', targetId: 'rec', targetPort: 'value' },
            { sourceId: 'expr', sourcePort: 'isTrueEv', targetId: 'rec', targetPort: 'bump' }
          ]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

/** Start both producers. Neither value has landed when this returns. */
function produce(graph: CorpusGraph, a: unknown, b: unknown): void {
  graph.node<ProducerInstance>('prodA').produce(a);
  graph.node<ProducerInstance>('prodB').produce(b);
}

/** Fire `Run` and let exactly one synchronous frame happen — no yielding, so no producer lands. */
function runNow(graph: CorpusGraph): void {
  graph.node<PulseInstance>('pulse').pulse();
  graph.update();
}

function result(graph: CorpusGraph): unknown {
  return graph.node('expr').getOutput('result').value;
}

describe('NDA-017 §0 row 1: the seed is a plausible number', () => {
  test.failing('Run before anything has ever produced evaluates 0 + 0 and emits a real-looking 0', async () => {
    const graph = await expressionGraph();

    // Both producers are in flight. Nothing has ever arrived on `a` or `b`.
    produce(graph, 10, 20);
    runNow(graph);

    // `registerInputIfNeeded` seeded both discovered inputs to 0 (`expression.ts:117-118`), so
    // the node evaluates `0 + 0` and publishes 0 — indistinguishable downstream from a
    // legitimate zero. This is the NDA-004 class-B shape exactly: not silence, a plausible value.
    expect(result(graph)).not.toBe(0);
  });

  test('characterisation: the value it publishes instead is the seed sum', async () => {
    const graph = await expressionGraph();

    produce(graph, 10, 20);
    runNow(graph);

    // Kept as an ordinary row so the *mechanism* is pinned even while row 1 is red. If a future
    // change makes this NaN or undefined instead, the diagnosis above stops being true and this
    // is what says so.
    expect(result(graph)).toBe(0);
  });
});

describe('NDA-017 §0 row 2: a previous cycle’s value, which is the reported case', () => {
  test.failing('the second Run reflects the second inputs', async () => {
    const graph = await expressionGraph();

    // Cycle 1, fully settled: the honest case, and it works.
    produce(graph, 1, 2);
    await graph.settle(4);
    runNow(graph);
    expect(result(graph)).toBe(3);

    // Cycle 2: new values are in flight when `Run` fires — the producer "couldn't run on time",
    // in the reporter's words.
    produce(graph, 10, 20);
    runNow(graph);

    expect(result(graph)).toBe(30);
  });

  test('characterisation: it re-publishes the previous cycle’s answer, and never corrects it', async () => {
    const graph = await expressionGraph();

    produce(graph, 1, 2);
    await graph.settle(4);
    runNow(graph);

    produce(graph, 10, 20);
    runNow(graph);
    expect(result(graph)).toBe(3);

    // And the correction never comes. Once the values do land, the setters record them and
    // schedule nothing, because `Run` is connected — so the stale answer stands until something
    // pulses `Run` again. This is the half that makes it "messed up the whole logic" rather than
    // a one-frame flicker.
    await graph.settle(4);
    expect(result(graph)).toBe(3);
  });
});

describe('NDA-017 §0 row 3: a signal fires downstream while the value stays quiet', () => {
  test('a re-evaluation pulses On True downstream without delivering a value', async () => {
    const graph = await expressionGraph();

    produce(graph, 1, 2);
    await graph.settle(4);

    runNow(graph);
    const deliveredAfterFirst = delivered(graph).length;
    const pulsesAfterFirst = pulses(graph);
    expect(result(graph)).toBe(3);

    // Nothing upstream has changed. Fire again.
    runNow(graph);

    // `_scheduleEvaluateExpression` only re-flags `result`/`isTrue`/`isFalse` when the value
    // *differs* (`expression.ts:133-139`), while `isTrueEv`/`isFalseEv` fire on every evaluation
    // (`:140-141`). So downstream receives a pulse asserting "this is true again" with no value
    // to go with it — and on a stale evaluation, that pulse is asserting last cycle's answer.
    expect(pulses(graph)).toBe(pulsesAfterFirst + 1);
    expect(delivered(graph).length).toBe(deliveredAfterFirst);

    // Characterisation, not approval: whether the two ports *should* agree is §1's decision.
    // This row exists so that decision is made against a measurement.
  });
});

/**
 * The same claim, aimed at the node the reporter switched to.
 *
 * "had to use function node many times in places where even a simple expression node would be
 * suffice" — if row 2 reproduces here, that migration bought nothing, and the spec's headline
 * (twelve families, not one node) is measured rather than grepped.
 */
async function functionGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [AsyncProducerModule, PulseModule, RecorderModule, FunctionNode as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'prodA', type: 'corpus.AsyncProducer' },
            { id: 'prodB', type: 'corpus.AsyncProducer' },
            { id: 'pulse', type: 'corpus.Pulse' },
            { id: 'rec', type: 'corpus.Recorder' },
            {
              id: 'fn',
              type: 'JavaScriptFunction',
              parameters: { functionScript: 'Outputs.result = Inputs.a + Inputs.b;' }
            }
          ],
          connections: [
            { sourceId: 'prodA', sourcePort: 'value', targetId: 'fn', targetPort: 'in-a' },
            { sourceId: 'prodB', sourcePort: 'value', targetId: 'fn', targetPort: 'in-b' },
            { sourceId: 'pulse', sourcePort: 'signal', targetId: 'fn', targetPort: 'run' },
            { sourceId: 'fn', sourcePort: 'out-result', targetId: 'rec', targetPort: 'value' }
          ]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

function functionResult(graph: CorpusGraph): unknown {
  return graph.node('fn').getOutput('out-result').value;
}

describe('NDA-017 §0 row 4: the reporter’s workaround has the identical defect', () => {
  test.failing('Function’s second Run reflects the second inputs', async () => {
    const graph = await functionGraph();

    graph.node<ProducerInstance>('prodA').produce(1);
    graph.node<ProducerInstance>('prodB').produce(2);
    await graph.settle(4);
    graph.node<PulseInstance>('pulse').pulse();
    await graph.settle(4);
    expect(functionResult(graph)).toBe(3);

    // In flight when `Run` fires. `update()` starts the script synchronously — an `AsyncFunction`
    // body runs up to its first `await` immediately — so `Inputs.a`/`Inputs.b` are read before
    // any producer can land, exactly as on a real frame.
    graph.node<ProducerInstance>('prodA').produce(10);
    graph.node<ProducerInstance>('prodB').produce(20);
    runNow(graph);
    await graph.settle(4);

    expect(functionResult(graph)).toBe(30);
  });

  test('characterisation: Function re-publishes the previous cycle’s answer too', async () => {
    const graph = await functionGraph();

    graph.node<ProducerInstance>('prodA').produce(1);
    graph.node<ProducerInstance>('prodB').produce(2);
    await graph.settle(4);
    graph.node<PulseInstance>('pulse').pulse();
    await graph.settle(4);

    graph.node<ProducerInstance>('prodA').produce(10);
    graph.node<ProducerInstance>('prodB').produce(20);
    runNow(graph);
    await graph.settle(4);

    // `setScriptInputValue` carries the same guard (`simplejavascript.ts:287`), so the late
    // values are recorded and re-run nothing. The reporter moved from a node with this defect to
    // a node with this defect.
    expect(functionResult(graph)).toBe(3);
  });
});

/**
 * The controls.
 *
 * Without these, every row above is satisfied by a node that is simply broken, and the fix
 * "always re-evaluate on every input" would look correct while destroying the entire point of a
 * control signal.
 */
describe('NDA-017 §0: what must keep working', () => {
  test('pinned control: with inputs settled, Run evaluates the current values', async () => {
    const graph = await expressionGraph();

    produce(graph, 4, 5);
    await graph.settle(4);
    runNow(graph);

    expect(result(graph)).toBe(9);
  });

  test('pinned control: a passive setter is the feature — inputs alone do not evaluate', async () => {
    const graph = await expressionGraph();

    // `Run` is connected and never pulsed. Values arrive and are recorded; nothing evaluates.
    // "Don't fire on every keystroke, fire when I say" is the whole reason the idiom exists, and
    // any §1 remedy that breaks this row has cured the patient by killing them.
    produce(graph, 4, 5);
    await graph.settle(4);

    expect(result(graph)).toBe(0);
    // Zero evaluations: `isTrueEv`/`isFalseEv` fire on *every* evaluation, so an empty signal log
    // is the proof that none happened — the guard held for the whole boot, not just after it.
    expect(graph.signalsFor('expr')).toEqual([]);
  });

  test('the one value downstream does get is the connect-time push, not an evaluation', async () => {
    const graph = await expressionGraph();

    // Measured rather than assumed, and it is not nothing: the recorder holds a `0` before
    // anything has evaluated or produced. `connectInput` pushes the source's current output when
    // the wire is made, and `result`'s getter answers with the initial `cachedValue`.
    //
    // So a downstream node reads a confident `0` from an Expression that has never run. That is
    // the same shape as row 1 — a plausible value standing in for "no answer yet" — arriving by a
    // different route, and it is why row 1's remedy has to consider the boot value too.
    expect(delivered(graph)).toEqual([0]);
    expect(graph.signalsFor('expr')).toEqual([]);
  });
});
