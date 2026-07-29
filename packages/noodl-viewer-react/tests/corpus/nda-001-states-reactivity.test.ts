/**
 * NDA-001 corpus — reactivity rows R8 and R9 (defect class A3).
 *
 * This is Richard's *"sometimes triggering a state change using the state value input doesn't
 * trigger the state change output"*, and it is not sometimes.
 *
 * `scheduleGoToState` used to store the requested state and return early if a transition was
 * already scheduled for this pass, so several requests inside one update pass were coalesced
 * to the **last** one. `goToState` then compared that survivor against the current state and
 * returned if they matched. Go `A → B → A` in one pass and the pair cancelled each other out:
 * no transition, no `stateChanged`, no `reached-A`, and no `reached-B` — the intermediate
 * state never happened as far as anything downstream could tell.
 *
 * NDA-002 §4 queues the requests and runs them. The animation is still coalesced — only the
 * state the pass ends in animates — but every state passed through is settled and reported.
 *
 * Two controls sit beside the failing rows. Without them "zero signals" would be equally
 * consistent with a harness that never drove a frame, and `reached-<state>` in particular is
 * timer-driven — it only fires from `animation.onFinish`, which needs a clock.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import '../../../noodl-runtime/test/corpus/expected-failure';

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import StatesModule from '../../src/nodes/std-library/states';

interface SwitcherInstance extends NodeInstance {
  goToB(): void;
  goToA(): void;
}

/** Two `to-<state>` pulses, so a test can fire both inside one update pass. */
const SwitcherModule: NodeModule = {
  node: {
    name: 'corpus.Switcher',
    category: 'Corpus',
    outputs: {
      toB: { type: 'signal' },
      toA: { type: 'signal' }
    },
    methods: {
      goToB(this: NodeInstance) {
        this.sendSignalOnOutput('toB');
      },
      goToA(this: NodeInstance) {
        this.sendSignalOnOutput('toA');
      }
    }
  }
};

interface CounterInstance extends NodeInstance {
  hits: number;
}

const CounterModule: NodeModule = {
  node: {
    name: 'corpus.Counter',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      (this as unknown as CounterInstance).hits = 0;
    },
    inputs: {
      ping: {
        valueChangedToTrue: function (this: NodeInstance) {
          (this as unknown as CounterInstance).hits++;
        }
      }
    }
  }
};

/**
 * A States node over `A,B` with one animated value, its `stateChanged` and `reached-B`
 * outputs each counted downstream, and a Switcher able to pulse `to-A` / `to-B`.
 *
 * The graph is run forward far enough on construction that the node has settled into `A` and
 * `valuesAreInitialised` is true — the first-transition swallow at `states.ts:407-412` is a
 * separate, deliberate behaviour and would otherwise mask the rows under test.
 */
async function statesGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [StatesModule as unknown as NodeModule, SwitcherModule, CounterModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'switcher', type: 'corpus.Switcher' },
            {
              id: 'states',
              type: 'States',
              parameters: { states: 'A,B', values: 'x', 'value-A-x': 0, 'value-B-x': 100 }
            },
            { id: 'changedCounter', type: 'corpus.Counter' },
            { id: 'reachedBCounter', type: 'corpus.Counter' }
          ],
          connections: [
            { sourceId: 'switcher', sourcePort: 'toB', targetId: 'states', targetPort: 'to-B' },
            { sourceId: 'switcher', sourcePort: 'toA', targetId: 'states', targetPort: 'to-A' },
            { sourceId: 'states', sourcePort: 'stateChanged', targetId: 'changedCounter', targetPort: 'ping' },
            { sourceId: 'states', sourcePort: 'reached-B', targetId: 'reachedBCounter', targetPort: 'ping' }
          ]
        }
      ]
    } as never
  });

  runFrames(graph);
  graph.signalsFor('states').length = 0;
  return graph;
}

/** Long enough for the default 300 ms transition to finish at 16 ms a frame. */
function runFrames(graph: CorpusGraph, count = 40) {
  for (let i = 0; i < count; i++) graph.frame(16);
}

function currentState(graph: CorpusGraph): string | undefined {
  return (graph.node('states') as unknown as { _internal: { state?: string } })._internal.state;
}

describe('NDA-001 R8–R9: States driven A → B → A inside one update pass', () => {
  test('R8: stateChanged fires for a state change that happened and came back', async () => {
    const graph = await statesGraph();
    const switcher = graph.node<SwitcherInstance>('switcher');

    switcher.goToB();
    switcher.goToA();
    runFrames(graph);

    // Both requests land in the same pass. The second used to overwrite the first, and the
    // survivor equalled the state the node was already in, so `goToState` returned before it
    // did anything at all. The pass is queued now: B is settled and reported on the way
    // through, and A — the state the pass ends in — is the one that animates.
    expect(currentState(graph)).toBe('A');
    expect(graph.signalsFor('states').filter((signal) => signal === 'stateChanged').length).toBe(2);
    expect((graph.node('changedCounter') as unknown as CounterInstance).hits).toBe(2);
  });

  test('R9: reached-B fires when B is passed through', async () => {
    const graph = await statesGraph();
    const switcher = graph.node<SwitcherInstance>('switcher');

    switcher.goToB();
    switcher.goToA();
    runFrames(graph);

    // B used to be skipped entirely, so the transition that would have ended in B was never
    // started and `animation.onFinish` never ran. Passing *through* B now reports reaching
    // it — the whole point of wiring A → B → A.
    expect((graph.node('reachedBCounter') as unknown as CounterInstance).hits).toBe(1);
  });

  // ✅ Pinned control. A single transition works end to end — including the timer-driven
  // `reached-B` — so the two rows above are about coalescing, not about the harness.
  test('R8–R9 (pinned control): a single A → B transition signals and reaches B', async () => {
    const graph = await statesGraph();

    graph.node<SwitcherInstance>('switcher').goToB();
    runFrames(graph);

    expect(currentState(graph)).toBe('B');
    expect(graph.signalsFor('states')).toEqual(['stateChanged', 'reached-B']);
    expect((graph.node('changedCounter') as unknown as CounterInstance).hits).toBe(1);
    expect((graph.node('reachedBCounter') as unknown as CounterInstance).hits).toBe(1);
  });

  // ✅ Pinned control. The same A → B → A, given a frame in between, behaves — which is what
  // makes the failure look intermittent to an author.
  test('R8–R9 (pinned control): A → B → A across separate passes signals twice', async () => {
    const graph = await statesGraph();
    const switcher = graph.node<SwitcherInstance>('switcher');

    switcher.goToB();
    runFrames(graph);
    switcher.goToA();
    runFrames(graph);

    expect(currentState(graph)).toBe('A');
    expect(graph.signalsFor('states').filter((signal) => signal === 'stateChanged').length).toBe(2);
    expect((graph.node('reachedBCounter') as unknown as CounterInstance).hits).toBe(1);
  });
});
