/**
 * ERG-001 §4 — the `States` node, and the last of §0's Animation row.
 *
 * | Node | Action ports | Shape |
 * |---|---|---|
 * | `States` | `Toggle`, each `To <state>` | `done` **added** · `unchanged` · `failure` kept · `completed` |
 *
 * ## ⚠️ `State Changed` is not this invocation's `Done`
 *
 * The grep the phase runs before every rename comes out against it: `stateChanged` is sent from
 * `jumpToState` and `goToState`, which are reached from the `currentState` and `startState`
 * input setters and from the `states` list arriving as well as from the action ports. It also
 * deliberately does **not** fire when the node enters its very first state — "the node arriving
 * at where it starts, not a transition an author asked for". So `Done` goes beside it.
 *
 * ## `Unchanged` is earned twice, and `Failure` gains a second reason
 *
 * - **Already in the state you asked for.** `goToState`'s `internal.state === state` guard was a
 *   bare `return`.
 * - **Already heading there in this pass.** `scheduleGoToState`'s `pendingTarget === state`
 *   guard, likewise. Both are a graph working exactly as written, so neither raises.
 * - **No States list at all.** `Toggle` opened with `if (!internal.states) return;` — a
 *   configuration mistake an author could only find by staring at the panel, with the graph
 *   behind it stopped and nothing anywhere saying why. That one is a `Failure`.
 *
 * The unknown-state path keeps `_failUnknownState` as the single owner of the raise, the
 * diagnostic and the `Error` output — it is reached from setter-driven routes too — and the
 * outcome is reported beside it with `raise: false` so the reason reaches the channel once.
 *
 * ## ⚠️ The reserved names were already in place
 *
 * §0.2 Result 4 flagged this node's verbatim value-name registration as the one unguarded
 * surface in the library, and the phase-36 pass had already added `done`/`unchanged`/`completed`
 * to `RESERVED_OUTPUTS` with a reported collision — *before* the ports landed, which is what
 * FINDINGS **SR-ix** asks for. Nothing in this build had to add them; a row below pins it.
 *
 * ## ⚠️ `Done` fires before `Has Reached <state>`, and that is the design
 *
 * A transition still animating has already *moved* the node: `State` reads the new name and
 * `State Changed` has fired. `Done` says that; `Has Reached <state>` says the animation
 * finished, which is a later moment and the port that exists to name it. `nda-001-states-
 * reactivity.test.ts`'s pinned control asserts the exact order.
 *
 * ## What reverting reddens — predicted per fixture, before running
 *
 * | Revert | Predicted |
 * |---|---|
 * | the already-in-that-state guard back to a bare `return` | 1 — the same-state row |
 * | `scheduleGoToState`'s pending-target guard back to a bare `return` | 1 — the twice-in-one-pass row |
 * | `Toggle`'s no-states branch back to a bare `return` | 1 — the no-states row |
 * | the `currentState` setter minting a token | 2 — the two counting rows; the setter-silence row stays green |
 * | `done` reported before `stateChanged` | 1 — the ordering row |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import StatesModule from '../../src/nodes/std-library/states';

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

function mark(graph: CorpusGraph, id: string): number {
  return graph.signalsFor(id).length;
}

/**
 * ⚠️ `to-<state>` and `currentState` are runtime-discovered: they exist only once something asks
 * for them, which in a real graph is a connection being made. A `setInputValue` on a port that
 * was never registered does nothing at all — and reads exactly like a node that stayed silent.
 */
function pulse(graph: CorpusGraph, id: string, port: string): void {
  const node = graph.node(id);
  node.registerInputIfNeeded(port);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

/** Long enough for the default 300 ms transition to finish at 16 ms a frame. */
function runFrames(graph: CorpusGraph, frames = 25): void {
  for (let i = 0; i < frames; i++) graph.frame();
}

/**
 * A States node over `A,B`, settled into `A` with `valuesAreInitialised` true — the
 * first-transition swallow is a separate, deliberate behaviour and would otherwise mask
 * everything below.
 */
async function statesGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [StatesModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'node',
              type: 'States',
              parameters,
            }
          ],
          connections: []
        }
      ]
    } as never
  });
  runFrames(graph);
  graph.signalsFor('node').length = 0;
  return graph;
}

const AB = { states: 'A,B', values: 'x', 'value-A-x': 0, 'value-B-x': 100 };

describe('ERG-001 §4: States', () => {
  test('a To <state> that moves the node reports Done then Completed, after State Changed', async () => {
    const graph = await statesGraph(AB);

    pulse(graph, 'node', 'to-B');
    await graph.settle(3);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('stateChanged'));
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('asking for the state the node is already in is Unchanged, and raises nothing', async () => {
    const graph = await statesGraph(AB);

    pulse(graph, 'node', 'to-A');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.signalsFor('node')).not.toContain('stateChanged');
    expect(graph.errors).toEqual([]);
  });

  /** `scheduleGoToState`'s other bare `return`: the pass is already heading there. */
  test('asking twice for the same state in one pass reports Done then Unchanged', async () => {
    const graph = await statesGraph(AB);

    const node = graph.node('node');
    node.registerInputIfNeeded('to-B');
    node.setInputValue('to-B', false);
    node.setInputValue('to-B', true);
    node.setInputValue('to-B', false);
    node.setInputValue('to-B', true);
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
    expect(countOf(graph, 'node', 'stateChanged')).toBe(1);
  });

  test('a state this node does not have is a Failure, raised exactly once', async () => {
    const graph = await statesGraph(AB);
    const errorsBefore = graph.errors.length;

    pulse(graph, 'node', 'to-Nope');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.slice(errorsBefore).map((e) => e.code)).toEqual(['states/unknown-state']);
  });

  /**
   * ⚠️ The dead chain `Toggle` had. With no States list it returned bare — no signal, nothing
   * raised, and the author's only clue was an empty field in the panel.
   */
  test('a Toggle on a node with no States list is a Failure carrying a code', async () => {
    const graph = await statesGraph({});
    const errorsBefore = graph.errors.length;

    pulse(graph, 'node', 'toggle');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.slice(errorsBefore).map((e) => e.code)).toEqual(['states/no-states']);
  });

  test('a Toggle that moves the node reports Done', async () => {
    const graph = await statesGraph(AB);

    pulse(graph, 'node', 'toggle');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
  });

  /**
   * ⚠️ A counting row, not a silence row. A token minted in the `currentState` setter would
   * never be settled, so nothing would be reported and a silence row would stay green; what
   * catches it is the next invocation draining the stale token and reporting twice.
   */
  test('writing State directly reports nothing, and the next port pulse reports once', async () => {
    const graph = await statesGraph(AB);

    graph.node('node').registerInputIfNeeded('currentState');
    graph.node('node').setInputValue('currentState', 'B');
    await graph.settle(3);
    expect(outcomesOf(graph, 'node')).toEqual([]);
    expect(graph.signalsFor('node')).toContain('stateChanged');

    const from = mark(graph, 'node');
    pulse(graph, 'node', 'to-A');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
  });

  /**
   * §0.2 Result 4 / FINDINGS **SR-ix**. Value names become output ports verbatim, so the
   * contract's three names have to be refused rather than silently resolving to the built-ins.
   * The guard was added by the phase-36 pass *before* the ports landed; this pins it.
   */
  test('a value named after a contract port is refused, not silently swallowed', async () => {
    const graph = await statesGraph({ states: 'A,B', values: 'done' });

    expect(graph.errors.map((e) => e.code)).toContain('states/reserved-port-name');
  });

  test('(pinned control) the port surface carries all four outcome signals', () => {
    const outputs = (StatesModule.node as { outputs: Record<string, { type?: unknown }> }).outputs;
    const signals = Object.keys(outputs).filter((name) => outputs[name].type === 'signal');
    expect(signals.sort()).toEqual(['completed', 'done', 'failure', 'stateChanged', 'unchanged']);
  });
});

/** Keeps `NodeInstance` referenced so the import is not dropped by `isolatedModules`. */
export type _Unused = NodeInstance;
