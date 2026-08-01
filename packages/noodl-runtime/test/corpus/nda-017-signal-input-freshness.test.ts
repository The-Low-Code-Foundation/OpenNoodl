/**
 * NDA-017 — a signal-driven node cannot tell a fresh input from a stale one.
 *
 * ## §2 has landed, and it changed what these rows measure
 *
 * §0 (below) reproduced the community report against a spec that offered four remedies and
 * recommended two of them. Richard chose none of the four on 2026-08-01: the fix is a
 * per-input **"Run on value change"** checkbox, because the defect is one level deeper than
 * staleness — *connecting `Run` silently changes what every other port does.*
 *
 * That moves the contract, so it moves the rows. The three points worth having in front of
 * you before reading any assertion below:
 *
 * 1. **The remedy does not make a mid-flight `Run` clairvoyant, and nothing could.** A `Run`
 *    that fires while the producers are still in flight still reads the previous cycle's
 *    values. What it no longer does is *stay* there: the setters are no longer passive, so
 *    the answer corrects itself the moment the values land. Row 2 therefore asserts the
 *    settled outcome, and keeps the synchronous instant as an explicit characterisation so
 *    the distinction is measured rather than assumed. It was written that way after checking
 *    the settled assertion goes red on the pre-§2 code — the "never corrects it"
 *    characterisation that stood here before is exactly that proof.
 * 2. **"A passive setter is the feature" is the sentence the decision overturned.** It used
 *    to be pinned as a control. Passivity is still a feature and still pinned — but it is now
 *    reached by unticking a box, not by wiring an unrelated port.
 * 3. **`test.failing` reports as *passed*.** Every row here was read with that in mind: a ✓
 *    on a `test.failing` row means the body still throws.
 *
 * ## §0 — the original reproduction
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

describe('NDA-017 row 1: the seed is a plausible number', () => {
  test('Run before anything has ever produced does not emit a real-looking 0', async () => {
    const graph = await expressionGraph();

    // Both producers are in flight. Nothing has ever arrived on `a` or `b`.
    produce(graph, 10, 20);
    runNow(graph);

    // `registerInputIfNeeded` used to seed every discovered input to `0`, so the node
    // evaluated `0 + 0` and published a zero that nothing downstream could tell from a
    // legitimate one — the NDA-004 class-B shape exactly: not silence, a plausible value.
    // §2 seeds `undefined` instead.
    expect(result(graph)).not.toBe(0);
  });

  test('characterisation: what it publishes instead is NaN, which is absent rather than plausible', async () => {
    const graph = await expressionGraph();

    produce(graph, 10, 20);
    runNow(graph);

    // The mechanism, pinned. `NaN` is not an answer either — the point is that it does not
    // *look* like one. A branch downstream takes the same path for `0` as for a real zero;
    // nothing takes a confident path on `NaN`.
    //
    // If a future change makes this `0` again, the seed has been reintroduced somewhere and
    // row 1 above is passing for a reason that has nothing to do with the fix.
    expect(result(graph)).toBeNaN();
  });

  test('a node that has never evaluated reports null, not a confident value', async () => {
    const graph = await expressionGraph();

    // Constraint 4, and the route §0 found that no control-signal check could ever have
    // intercepted: with `Run` connected the node never evaluates at boot, and `signalsFor`
    // proves it, yet `connectInput` still pushes the `result` getter's answer down the wire
    // the moment it is made. That answer used to be a confident `0`.
    expect(graph.signalsFor('expr')).toEqual([]);
    expect(result(graph)).toBeNull();

    // The two boolean ports were the worse half, and `Is False` worst of all: `!undefined` is
    // `true`, so an Expression that had never run asserted "my result is falsy" to every
    // branch downstream. A claim, not an absence.
    expect(graph.node('expr').getOutput('isTrue').value).toBeNull();
    expect(graph.node('expr').getOutput('isFalse').value).toBeNull();
  });
});

describe('NDA-017 row 2: a previous cycle’s value, which is the reported case', () => {
  test('the stale answer corrects itself once the values land', async () => {
    const graph = await expressionGraph();

    // Cycle 1, fully settled: the honest case, and it always worked.
    produce(graph, 1, 2);
    await graph.settle(4);
    runNow(graph);
    expect(result(graph)).toBe(3);

    // Cycle 2: new values are in flight when `Run` fires — the producer "couldn't run on
    // time", in the reporter's words.
    produce(graph, 10, 20);
    runNow(graph);

    // This is the assertion that was red before §2 and is the whole of the reported defect.
    // The values land, the setters are no longer passive, and the node re-runs. Before §2 the
    // setters recorded the late values and scheduled nothing, so the stale answer stood until
    // something pulsed `Run` again — which is what made it "messed up the whole logic" rather
    // than a one-frame flicker.
    await graph.settle(4);
    expect(result(graph)).toBe(30);
  });

  test('characterisation: the instant Run fires it still reads the old value, and that is not what was fixed', async () => {
    const graph = await expressionGraph();

    produce(graph, 1, 2);
    await graph.settle(4);
    runNow(graph);

    produce(graph, 10, 20);
    runNow(graph);

    // Kept deliberately, and it is the honest boundary of the remedy: a `Run` fired while the
    // producers are in flight evaluates what is there, because nothing in a dataflow graph can
    // evaluate a value that has not arrived. Only the spec's option B — a runtime-wide
    // in-flight concept — could even *report* this, and Richard did not take it.
    //
    // The author's answer for a graph that must run exactly once per fetch is unchanged and is
    // why the `Run` port survives §2: wire `Run` to the producer's completion signal rather
    // than to whatever kicked the producer off.
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

describe('NDA-017 row 4: the reporter’s workaround had the identical defect', () => {
  test('Function’s second Run reflects the second inputs', async () => {
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

  test('Function re-runs when a ticked input lands, with no Run pulse at all', async () => {
    const graph = await functionGraph();

    graph.node<ProducerInstance>('prodA').produce(1);
    graph.node<ProducerInstance>('prodB').produce(2);
    await graph.settle(4);
    graph.node<PulseInstance>('pulse').pulse();
    await graph.settle(4);
    expect(functionResult(graph)).toBe(3);

    // No pulse this time. `setScriptInputValue` carried the same guard as Expression, so the
    // late values used to be recorded and re-run nothing — the reporter moved from a node with
    // this defect to a node with this defect, which is what made the finding a class rather
    // than a node.
    graph.node<ProducerInstance>('prodA').produce(10);
    graph.node<ProducerInstance>('prodB').produce(20);
    await graph.settle(4);

    expect(functionResult(graph)).toBe(30);
  });
});

/**
 * The controls.
 *
 * Without these, every row above is satisfied by a node that is simply broken, and the fix
 * "always re-evaluate on every input" would look correct while destroying the entire point of a
 * control signal.
 */
describe('NDA-017: what must keep working', () => {
  test('pinned control: with inputs settled, Run evaluates the current values', async () => {
    const graph = await expressionGraph();

    produce(graph, 4, 5);
    await graph.settle(4);
    runNow(graph);

    expect(result(graph)).toBe(9);
  });

  /**
   * The control the decision inverted, in its two halves.
   *
   * The old row asserted that with `Run` connected, values arriving evaluate nothing —
   * "don't fire on every keystroke, fire when I say", pinned as the reason the idiom exists.
   * That behaviour is exactly what Richard removed. It is still available and still worth
   * pinning; what changed is how an author asks for it. Wiring an unrelated port no longer
   * buys it silently. Unticking the box buys it, visibly.
   */
  test('pinned control: with every box ticked — the default — inputs alone do evaluate', async () => {
    const graph = await expressionGraph();

    // `Run` is connected and never pulsed. Nothing has been unticked, so nothing has changed
    // from what this graph would do with no `Run` wired at all. That is constraint 2, and it
    // is what makes `Run` additive rather than modal.
    produce(graph, 4, 5);
    await graph.settle(4);

    expect(result(graph)).toBe(9);
  });

  test('pinned control: unticking an input is what makes its setter passive', async () => {
    const graph = await expressionGraph();
    const expr = graph.node('expr');

    // The affordance, driven the way the property panel drives it. Both inputs off.
    expr.setInputValue('runOnChange-a', false);
    expr.setInputValue('runOnChange-b', false);

    produce(graph, 4, 5);
    await graph.settle(4);

    // Nothing evaluated. `isTrueEv`/`isFalseEv` fire on *every* evaluation, so an empty signal
    // log is the proof that none happened — and `result` is still abstaining rather than
    // holding a fabricated zero.
    expect(graph.signalsFor('expr')).toEqual([]);
    expect(result(graph)).toBeNull();

    // …and `Run` still works, which is the other half of "additive". An author who unticks
    // everything has rebuilt the pre-§2 behaviour deliberately, and it behaves identically.
    runNow(graph);
    expect(result(graph)).toBe(9);
  });

  test('pinned control: one input still ticked is enough, and the untick is per input', async () => {
    const graph = await expressionGraph();

    graph.node('expr').setInputValue('runOnChange-a', false);

    // `a` lands first and must trigger nothing; `b` lands and must trigger a run that sees
    // both. Without the per-input granularity this row cannot tell "b re-ran it" from "a
    // re-ran it", which is why `a` is produced on its own frame.
    graph.node<ProducerInstance>('prodA').produce(4);
    await graph.settle(4);
    expect(result(graph)).toBeNull();

    graph.node<ProducerInstance>('prodB').produce(5);
    await graph.settle(4);
    expect(result(graph)).toBe(9);
  });

  test('pinned control: two ticked inputs moving in one frame produce one run, not two', async () => {
    const graph = await expressionGraph();

    // Constraint 3. Both producers land on the same macrotask, so both setters fire before
    // the node updates. `isTrueEv`/`isFalseEv` fire once per *evaluation*, so counting the
    // signal log counts evaluations — and this is the coalescing that
    // `hasScheduledEvaluation` has always done, pinned now because the checkboxes could very
    // easily have been implemented by evaluating directly in the setter.
    produce(graph, 4, 5);
    await graph.settle(4);

    expect(graph.signalsFor('expr')).toHaveLength(1);
    expect(result(graph)).toBe(9);
  });

  test('the connect-time push is now an abstention rather than a confident zero', async () => {
    const graph = await expressionGraph();

    // Measured rather than assumed, and it is not nothing: `connectInput` pushes the source's
    // current output when the wire is made, so the recorder holds a value before anything has
    // evaluated or produced. It used to be `0` — a plausible value standing in for "no answer
    // yet", arriving by a route no control-signal check could intercept, which is why §0
    // flagged it as the thing option A would have missed.
    expect(delivered(graph)).toEqual([null]);
    expect(graph.signalsFor('expr')).toEqual([]);
  });
});
