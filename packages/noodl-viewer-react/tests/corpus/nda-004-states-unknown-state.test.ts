/**
 * NDA-004 §2 — the States node asked to go somewhere it cannot go.
 *
 * Register ⏳ item 5, predicted as "`goToState` with a name that is not in the list". The
 * prediction was right about the trigger and understated the damage, which by now is the pattern.
 *
 * `goToState` never checked its argument against `internal.states`. An unknown name has no
 * `value-<state>-<name>` parameters, so the transition timer's `onStart` fell through to
 * `stateValues[prefix + v] || 0` and animated **every value to 0** — zero for numbers, black for
 * colours. The node then wrote the bogus name to its `State` output and fired `stateChanged`, so
 * everything downstream was told the transition had succeeded. The one signal that would have
 * looked wrong, `reached-<state>`, never fired for the simple reason that no such port exists.
 *
 * That is the Expression node's defect in a different node: not silence, but a **plausible
 * result** — an author sees the state machine move and the values collapse, and nothing anywhere
 * says the name was wrong. It is also entirely ordinary to hit, because the `State` input is an
 * enum that a wire can feed with any string at all: a Text Input, a Record property, or a state
 * that was renamed in the editor while something upstream still spells it the old way.
 *
 * ## Why the port is safe here
 *
 * The same question `Expression` had to answer. The guard fires only for a **truthy** state that
 * is not in the list; a falsy request is resolved to the first state one line above — which is the
 * boot path, and what `states`'s own setter relies on — and the `State` port's default is
 * `startState || states[0]`. A node nobody has wired never reaches the branch. The last two
 * controls in this file are what hold that down.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import StatesModule from '../../src/nodes/std-library/states';

interface TriggerInstance extends NodeInstance {
  send(value: unknown): void;
}

/** One settable value output, wired into the States node's `State` input. */
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

/** Somewhere for `reached-B` to go, so the port gets registered. */
const SinkModule: NodeModule = {
  node: {
    name: 'corpus.Sink',
    category: 'Corpus',
    inputs: {
      ping: {
        valueChangedToTrue: function () {
          /* the signal only has to be received for the port to exist */
        }
      }
    }
  }
};

interface StatesInternals {
  _internal: { state?: string; currentValues: Record<string, unknown>; error?: string };
}

/**
 * A States node over `A,B` with one number value, driven through its `State` input by a wire —
 * the path an author actually takes, and the only one that can carry a name the node has never
 * heard of.
 *
 * Run forward on construction so the node has settled into `A` with `x` at 10 and
 * `valuesAreInitialised` is true; the first-transition swallow is separate, deliberate behaviour
 * and would otherwise mask these rows.
 */
async function statesGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [StatesModule as unknown as NodeModule, TriggerModule, SinkModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'reachedB', type: 'corpus.Sink' },
            {
              id: 'states',
              type: 'States',
              parameters: { states: 'A,B', values: 'x', 'value-A-x': 10, 'value-B-x': 100 }
            }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'states', targetPort: 'currentState' },
            // `reached-<state>` is a runtime-discovered output: `onFinish` checks `hasOutput`,
            // and nothing registers the port unless a connection asks for it. Unwired, the
            // control below would read "the transition never completed" when the truth is
            // "nobody asked to hear about it".
            { sourceId: 'states', sourcePort: 'reached-B', targetId: 'reachedB', targetPort: 'ping' }
          ]
        }
      ]
    } as never
  });

  runFrames(graph);
  graph.signalsFor('states').length = 0;
  graph.errors.length = 0;
  return graph;
}

/** Long enough for the default 300 ms transition to finish at 16 ms a frame. */
function runFrames(graph: CorpusGraph, count = 40) {
  for (let i = 0; i < count; i++) graph.frame(16);
}

function internals(graph: CorpusGraph): StatesInternals['_internal'] {
  return (graph.node('states') as unknown as StatesInternals)._internal;
}

/** Push a value at the `State` input and run the graph far enough for a transition to finish. */
function requestState(graph: CorpusGraph, state: unknown) {
  graph.node<TriggerInstance>('trigger').send(state);
  runFrames(graph);
}

describe('NDA-004 §2: States asked for a name it does not have', () => {
  test('fires Failure and raises states/unknown-state', async () => {
    const graph = await statesGraph();
    requestState(graph, 'Actve');

    expect(graph.signalsFor('states')).toContain('failure');
    const raised = graph.errors.filter((e) => e.code === 'states/unknown-state');
    expect(raised.length).toBe(1);
    expect(raised[0].nodeId).toBe('states');
  });

  test('does not claim the transition happened', async () => {
    const graph = await statesGraph();
    requestState(graph, 'Actve');

    // `stateChanged` used to fire here, which is what made the whole thing look like it worked.
    expect(graph.signalsFor('states')).not.toContain('stateChanged');
  });

  test('stays in the state it has, rather than adopting the name it was given', async () => {
    const graph = await statesGraph();
    requestState(graph, 'Actve');

    expect(internals(graph).state).toBe('A');
  });

  test('leaves the values alone instead of animating them all to zero', async () => {
    const graph = await statesGraph();
    requestState(graph, 'Actve');

    // The actual damage, and the reason this is a `0`-class defect rather than a silence one.
    // `value-Actve-x` does not exist, so `onStart`'s `|| 0` used to drive `x` from 10 to 0 over
    // 300 ms — a number a downstream `Is False` or a layout would treat as entirely legitimate.
    expect(internals(graph).currentValues.x).toBe(10);
  });

  test('the report names the states the node does have', async () => {
    const graph = await statesGraph();
    requestState(graph, 'Actve');

    const raised = graph.errors.filter((e) => e.code === 'states/unknown-state');
    // Alternatives, not just an absence — a misspelling and a rename are the two causes and both
    // are obvious the moment the real names are in front of you.
    expect(raised[0].message).toContain('Actve');
    expect(raised[0].message).toContain('A, B');
    expect(raised[0].detail).toEqual({ requested: 'Actve', states: ['A', 'B'] });
  });

  test('the Error output carries the message', async () => {
    const graph = await statesGraph();
    requestState(graph, 'Actve');

    expect(internals(graph).error).toContain('no such state');
  });

  test('the Failure and Error ports exist', async () => {
    const graph = await statesGraph();
    const states = graph.node('states');

    // Not redundant beside the `toContain('failure')` row above: the harness records a signal
    // name before delegating, and `sendSignalOnOutput` on a port the node lacks only logs, so
    // deleting the output leaves that row green. See the corpus README.
    expect(states.hasOutput('failure')).toBe(true);
    expect(states.hasOutput('error')).toBe(true);
  });

  // ✅ Pinned control. The same wire, a real state: the node transitions, signals, reaches, and
  // moves its value. Without this every row above is equally consistent with a node that has
  // stopped responding to its `State` input at all.
  test('(pinned control) a known state through the same input still works end to end', async () => {
    const graph = await statesGraph();
    requestState(graph, 'B');

    expect(internals(graph).state).toBe('B');
    expect(internals(graph).currentValues.x).toBe(100);
    expect(graph.signalsFor('states')).toContain('stateChanged');
    expect(graph.signalsFor('states')).toContain('reached-B');
    expect(graph.signalsFor('states')).not.toContain('failure');
    expect(graph.errors).toEqual([]);
  });

  // ✅ Pinned control — the boot-path safety of the port, and the reason the guard tests for a
  // *truthy* unknown name rather than "not in the list".
  test('(pinned control) an empty State value resolves to the first state and raises nothing', async () => {
    const graph = await statesGraph();
    requestState(graph, 'B');
    graph.signalsFor('states').length = 0;

    requestState(graph, '');

    // A falsy request means "no opinion about which state", which `goToState` answers with the
    // first one. It is not an author error and must not report as one.
    expect(internals(graph).state).toBe('A');
    expect(graph.signalsFor('states')).not.toContain('failure');
    expect(graph.errors).toEqual([]);
  });

  // ✅ Pinned control. Asking for the state the node is already in is still a silent no-op —
  // the equality guard runs before the membership check, so a graph that re-sends its current
  // state every frame does not accumulate anything.
  test('(pinned control) re-requesting the current state is silent', async () => {
    const graph = await statesGraph();
    requestState(graph, 'A');

    expect(graph.signalsFor('states')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});

/**
 * ERG-001 §0.2 — the collision sweep's one unguarded finding, closed before the reserved names
 * spread through §4.
 *
 * `States` registers value names as output ports **verbatim**, and `registerOutputIfNeeded`
 * opened with a silent `if (this.hasOutput(name)) return;`. A value named `done` would therefore
 * resolve to the outcome contract's signal and the author's value output would simply not exist,
 * with nothing anywhere saying why — FINDINGS **SR-ix**, which on `Logic Builder` was already
 * live and silent against that node's own `error` and `run` ports.
 */
describe('ERG-001 §0.2: States reserves the outcome-contract port names', () => {
  async function statesWithValues(values: string): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [StatesModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'states', type: 'States', parameters: { states: 'A,B', values } }]
          }
        ]
      } as never
    });
    // The `values` setter runs when the parameter is applied on the node's first update, not at
    // import time — without this the control row reads "no output" and passes for the wrong reason.
    await graph.settle(4);
    return graph;
  }

  test.each(['done', 'unchanged', 'completed', 'failure'])(
    'a value named "%s" is refused out loud rather than silently dropped',
    async (name) => {
      const graph = await statesWithValues(name);

      const raised = graph.errors.filter((e) => e.code === 'states/reserved-port-name');
      expect(raised.length).toBeGreaterThan(0);
      expect(raised[0].message).toContain(name);
    }
  );

  test('(control) an ordinary value name still becomes an output and raises nothing', async () => {
    const graph = await statesWithValues('opacity');

    expect(graph.node('states').hasOutput('opacity')).toBe(true);
    expect(graph.errors.filter((e) => e.code === 'states/reserved-port-name')).toEqual([]);
  });
});
