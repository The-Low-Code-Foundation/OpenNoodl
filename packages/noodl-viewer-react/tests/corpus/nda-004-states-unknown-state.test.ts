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
async function statesGraph(states = 'A,B'): Promise<CorpusGraph> {
  const [first, second] = states.split(',');
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
              parameters: {
                states,
                values: 'x',
                ['value-' + first + '-x']: 10,
                ['value-' + second + '-x']: 100
              }
            }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'states', targetPort: 'currentState' },
            // `reached-<state>` is a runtime-discovered output: `onFinish` checks `hasOutput`,
            // and nothing registers the port unless a connection asks for it. Unwired, the
            // control below would read "the transition never completed" when the truth is
            // "nobody asked to hear about it".
            { sourceId: 'states', sourcePort: 'reached-' + second, targetId: 'reachedB', targetPort: 'ping' }
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
  });});

/**
 * OBS-003 — the near-match half of the phase-36 worked example.
 *
 * The design conversation's example was a States node receiving `"Clicked"` where the state is
 * named `"clicked"`. NDA-004 §2 already caught it and already listed the real names, so the
 * afternoon it costs was *shortened* rather than removed: an author still has to read a list and
 * spot one capital letter, which is exactly the reading nobody does at the end of the day.
 *
 * `nearestName` ranks case and surrounding whitespace ahead of edit distance, because those are
 * the two mistakes that are invisible in the editor — a trailing space in a text field looks like
 * nothing at all.
 *
 * ⚠️ The silent rows matter more than the firing one. A suggestion that is merely the least-bad
 * of several unrelated names sends the author to a name they never typed, and the next thing they
 * doubt is the diagnostic.
 */
describe('OBS-003: did you mean', () => {
  test('a capital letter is named, which is the worked example', async () => {
    const graph = await statesGraph('clicked,hover');
    requestState(graph, 'Clicked');

    const raised = graph.errors.filter((e) => e.code === 'states/unknown-state');
    expect(raised).toHaveLength(1);
    expect(raised[0].message).toContain('Did you mean "clicked"?');
    // The list is still there — the suggestion is an addition, not a replacement.
    expect(raised[0].message).toContain('clicked, hover');
  });

  test('a one-character typo is named', async () => {
    const graph = await statesGraph('clicked,hover');
    requestState(graph, 'hovor');

    expect(graph.errors[0].message).toContain('Did you mean "hover"?');
  });

  test('a name unlike anything gets the list and no guess', async () => {
    const graph = await statesGraph('clicked,hover');
    requestState(graph, 'submitted');

    const message = graph.errors[0].message;
    expect(message).toContain('clicked, hover');
    expect(message).not.toContain('Did you mean');
  });

  // Pinned: the pre-OBS-003 corpus above drives `A,B` with `Actve`, which is close to neither.
  // If the budget were ever widened, that row would start carrying a nonsense suggestion.
  test("the existing A,B graph's report gains no suggestion", async () => {
    const graph = await statesGraph();
    requestState(graph, 'Actve');

    expect(graph.errors[0].message).not.toContain('Did you mean');
  });
});

/**
 * OBS-003 — the standing accusation is withdrawn when the author fixes it.
 *
 * ⚠️ **Found by a live run, not by a test.** A failure raised on the error bus has no path back
 * to the editor: `createEditorWarningSubscriber` only ever calls `sendWarning`. So correcting a
 * misspelt state name left the danger ring and the Problems entry in place for the rest of the
 * session — the "panel becomes noise and gets ignored" failure `DIAGNOSTICS-CONTRACT.md` exists
 * to prevent, arriving through the one channel that contract does not own.
 *
 * The *event* is untouched, and the second row is what says so: the failure did happen, it
 * reached `On App Error` and a deployed console when it happened, and nothing rewrites that. Only
 * the editor's standing claim about the node's *current* state is withdrawn.
 */
describe('OBS-003: a corrected state name un-rings the node', () => {
  test('reaching a real state clears the editor warning', async () => {
    const graph = await statesGraph('clicked,hover');

    requestState(graph, 'Clicked');
    expect(graph.editorConnection.warnings.map((w) => w.key)).toContain('states/unknown-state');

    requestState(graph, 'hover');

    expect(graph.editorConnection.warnings.map((w) => w.key)).not.toContain('states/unknown-state');
    expect(graph.editorConnection.cleared).toContainEqual({ nodeId: 'states', key: 'states/unknown-state' });
  });

  /**
   * ⚠️ **The row a live run had to find.** The first fix cleared inside `goToState`, after the
   * unknown-state guard — which never runs for this case, because the author's correction is
   * usually to the state the node is *already in*: they typed `"Clicked"` meaning `"clicked"`,
   * and `"clicked"` is where the node has been sitting the whole time. Both
   * `scheduleGoToState`'s `pendingTarget === state` return and `goToState`'s
   * `internal.state === state` return skip it, so the node stayed red after the typo was fixed.
   *
   * The corpus had a clearing row and it passed, because it corrected to a *different* state.
   * That is the difference between testing the mechanism and testing the case.
   */
  test('correcting to the state the node is already in also clears', async () => {
    const graph = await statesGraph('clicked,hover');
    // The node boots into its first state, `clicked`.

    requestState(graph, 'Clicked');
    expect(graph.editorConnection.warnings.map((w) => w.key)).toContain('states/unknown-state');

    requestState(graph, 'clicked');

    expect(graph.editorConnection.warnings.map((w) => w.key)).not.toContain('states/unknown-state');
  });

  test('the failure event itself is not retracted — it happened', async () => {
    const graph = await statesGraph('clicked,hover');

    requestState(graph, 'Clicked');
    requestState(graph, 'hover');

    // Still exactly one raise on the bus. Clearing a warning is an editor concern; the event is
    // history, and `On App Error` already saw it.
    expect(graph.errors.filter((e) => e.code === 'states/unknown-state')).toHaveLength(1);
  });

  /**
   * ⚠️ The row that says where the de-duplication actually lives.
   *
   * A successful transition calls `setDiagnostic(code, null)` unconditionally, so the recording
   * harness — which logs every call — sees a clear even on a node that never failed. **The real
   * channel does not send one:** `ActiveWarnings.clearWarning` returns `false` for a key it never
   * held, and `EditorConnection.clearWarning` sends nothing on `false`
   * (`editorconnection.ts:658-673`). Guarding again inside the node would duplicate the one
   * component whose whole job this is.
   *
   * Asserted against a real `ActiveWarnings`, because asserting against the harness here would
   * only be asserting that the harness logs calls.
   */
  test('(control) a node that never failed sends no clear down the wire', async () => {
    const graph = await statesGraph('clicked,hover');

    requestState(graph, 'hover');

    // Nothing was ever raised on this node…
    expect(graph.editorConnection.warnings).toEqual([]);

    // …and the channel's own gate is what stops the clear becoming a message.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ActiveWarnings = require('../../../noodl-runtime/src/editorconnection.activewarnings');
    const active = new ActiveWarnings();
    expect(active.clearWarning('states', 'states/unknown-state')).toBe(false);
  });
});
