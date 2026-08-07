/**
 * ERG-001 §4 — finishing the rename, and the two nodes where it is not a rename.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md` for the decision and
 * `ERG-001-S0-MEASUREMENT.md` §0.2 for the ground. §1/§2 adopted the contract on the Array
 * family and unified their wire name on `done`; the library was then **half renamed**, which
 * is the worst state to leave it in. These rows cover the four runtime-side nodes that finish
 * it. The two viewer-side Component Object nodes are in
 * `packages/noodl-viewer-react/tests/corpus/erg-001-outcome-contract.test.ts`.
 *
 * ## The four, and which are renames
 *
 * | Node | Was | Is | Pure rename? |
 * |---|---|---|---|
 * | `NewModel` | `created` | `done` | yes |
 * | `SetModelProperties` | `stored` | `done` | yes |
 * | `net.noodl.GlobalStore.Set` | `completed` | `done` + a real `completed` | **no** |
 * | `net.noodl.ActionDispatcher` | `completed` | `actionCompleted` + a real `completed` | **no** |
 *
 * ⚠️ **Why the last two are not renames.** §0.2 Result 3: on both, the port called `Completed`
 * fires *only* on success and is mutually exclusive with the failure port
 * (`globalstoresetnode.ts:178` vs `:190-195`; `actiondispatchernode.ts:80-96`). The contract's
 * `Completed` fires after **all three** outcomes. Adopting the reserved name in place would
 * silently invert the meaning of a wire an author has already drawn — the SR-ix class.
 *
 * ## ⚠️ `ActionDispatcher` is a third case: two granularities, not one
 *
 * Its `Completed` is per-**action**, not per-invocation of the node's own `Dispatch` input. One
 * `Dispatch` can admit an array of five actions and produce five completions, minutes apart,
 * long after the invocation ended. So the port is **not** the invocation's `Done` and renaming
 * it to `done` would have been a second lie in place of the first. It becomes
 * `actionCompleted` / "Action Completed", which is what it has always meant, and the node then
 * adopts the contract on its two signal inputs beside it. The rows below pin both granularities
 * at once, because that pairing is the whole claim.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the `done` rename on `NewModel`/`SetModelProperties` | every row naming `done` in those two describes; the absent-old-name clauses catch a vacuous pass |
 * | `GlobalStore.Set` firing `completed` only on success | the failure-path `completed` row only |
 * | `ActionDispatcher.actionCompleted` back to `completed` | the two-granularities row, and the per-action row that asserts `completed` counts invocations |
 * | `Cancel All` reporting `done` unconditionally | the nothing-to-cancel `unchanged` row, not the real-cancel row |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ModelImport = require('../../src/model');
import NewModelNode = require('../../src/nodes/std-library/data/newmodelnode');
import SetModelProperties = require('../../src/nodes/std-library/data/setmodelpropertiesnode');
import SetGlobalStoreNode = require('../../src/nodes/std-library/agent/globalstoresetnode');
import ActionDispatcherNode = require('../../src/nodes/std-library/agent/actiondispatchernode');

import { globalStoreManager } from '../../src/nodes/std-library/agent/globalstore';
import { actionRegistry } from '../../src/nodes/std-library/agent/action-dispatcher';

const Model = ModelImport;

interface TriggerInstance extends NodeInstance {
  go(): void;
  go2(): void;
  send(port: string, value: unknown): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      go: { type: 'signal' },
      go2: { type: 'signal' },
      a: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.a;
        }
      },
      b: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.b;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      go2(this: NodeInstance) {
        this.sendSignalOnOutput('go2');
      },
      send(this: NodeInstance, port: string, value: unknown) {
        this._internal[port] = value;
        this.flagOutputDirty(port);
      }
    }
  }
};

type Wire = { sourcePort: string; targetPort: string };

async function graphWith(type: string, parameters: Record<string, unknown>, wires: Wire[]): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [
      TriggerModule,
      NewModelNode as unknown as NodeModule,
      SetModelProperties as unknown as NodeModule,
      SetGlobalStoreNode as unknown as NodeModule,
      ActionDispatcherNode as unknown as NodeModule
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'target', type, parameters }
          ],
          connections: wires.map((w) => ({
            sourceId: 'trigger',
            sourcePort: w.sourcePort,
            targetId: 'target',
            targetPort: w.targetPort
          }))
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

/** The terminal outcomes only, with the lifecycle and per-action noise a row never asserts on removed. */
function outcomesOf(graph: CorpusGraph, id = 'target'): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, signal: string, id = 'target'): number {
  return graph.signalsFor(id).filter((s) => s === signal).length;
}

beforeEach(() => {
  globalStoreManager.reset({ clearState: true });
  actionRegistry.reset();
});

// =================================================================================================
// Create New Object — a pure rename, and a node that cannot fail
// =================================================================================================

describe('ERG-001 §4: Create New Object', () => {
  const WIRES: Wire[] = [
    { sourcePort: 'go', targetPort: 'new' },
    { sourcePort: 'b', targetPort: 'prop-name' }
  ];

  test('reports Done on the contract wire name, and Completed after it', async () => {
    const graph = await graphWith('NewModel', { properties: 'name' }, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    await graph.settle(2);
    trigger.go();
    await graph.settle(3);

    const signals = graph.signalsFor('target');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    // The rename cannot pass vacuously: the old wire name must be *gone*, not merely unasserted.
    expect(signals).not.toContain('created');
    expect(graph.node('target').hasOutput('created')).toBe(false);
  });

  test('keeps no Failure port, because it builds its own object and cannot fail', async () => {
    const graph = await graphWith('NewModel', { properties: 'name' }, WIRES);

    // NDA-004's exemption, kept by the contract: "a node that cannot fail gets no Failure port".
    // `Create New Object` applies `addModelId` and deliberately not `addFailure`.
    expect(graph.node('target').hasOutput('failure')).toBe(false);
    expect(graph.node('target').hasOutput('unchanged')).toBe(false);
    expect(graph.node('target').hasOutput('completed')).toBe(true);
  });

  test('three Do pulses give three outcomes and three Completeds', async () => {
    const graph = await graphWith('NewModel', { properties: 'name' }, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    await graph.settle(2);
    for (let i = 0; i < 3; i++) {
      trigger.go();
      await graph.settle(3);
    }

    // NV-iii: outcome state is per-invocation, never latched on the node.
    expect(outcomesOf(graph)).toEqual(['done', 'done', 'done']);
    expect(countOf(graph, 'completed')).toBe(3);
  });
});

// =================================================================================================
// Set Object Properties — a pure rename, on a node that keeps its Failure
// =================================================================================================

describe('ERG-001 §4: Set Object Properties', () => {
  const WIRES: Wire[] = [
    { sourcePort: 'a', targetPort: 'modelId' },
    { sourcePort: 'b', targetPort: 'prop-name' },
    { sourcePort: 'go', targetPort: 'store' }
  ];

  test('a real Id reports Done on the contract wire name, then Completed', async () => {
    const graph = await graphWith('SetModelProperties', { properties: 'name' }, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    trigger.send('a', 'erg001-s4-real-id');
    await graph.settle(3);
    trigger.go();
    await graph.settle(3);

    const signals = graph.signalsFor('target');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    expect(signals).not.toContain('stored');
    expect(graph.node('target').hasOutput('stored')).toBe(false);
    expect(Model.get('erg001-s4-real-id').data).toEqual({ name: 'Ada' });
  });

  test('no object bound still reports Failure on the NDA-004 channel — and Completed follows it', async () => {
    const graph = await graphWith('SetModelProperties', { properties: 'name' }, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    await graph.settle(3);
    trigger.go();
    await graph.settle(3);

    const signals = graph.signalsFor('target');
    expect(outcomesOf(graph)).toEqual(['failure']);
    // The half §4 adds: before this, a failed store ended the chain dead even for an author
    // who wanted to carry on regardless.
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('failure'));
    expect(graph.errors.map((e) => e.code)).toContain('set-object-properties/no-object');
  });
});

// =================================================================================================
// Set Global Store — §0.2 Result 3, half one: `Completed` meant "succeeded"
// =================================================================================================

describe('ERG-001 §4: Set Global Store', () => {
  const WIRES: Wire[] = [
    { sourcePort: 'a', targetPort: 'value' },
    { sourcePort: 'go', targetPort: 'set' }
  ];

  test('a write reports Done on the contract wire name, then Completed', async () => {
    const graph = await graphWith('net.noodl.GlobalStore.Set', { storeName: 'app', key: 'k' }, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', 42);
    await graph.settle(3);
    trigger.go();
    await graph.settle(3);

    const signals = graph.signalsFor('target');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    expect(globalStoreManager.getKey('app', 'k')).toBe(42);
  });

  test('⚠️ a refused write now ALSO emits Completed, which the old port could never do', async () => {
    // The whole reason this is not a rename. `Completed` used to sit inside the `try` and the
    // no-key guard routed to `reportFailure` instead, so the two were mutually exclusive — an
    // author who wired `Completed` to mean "carry on regardless" got silence on every failure.
    const graph = await graphWith('net.noodl.GlobalStore.Set', { storeName: 'app' }, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', 42);
    await graph.settle(3);
    trigger.go();
    await graph.settle(3);

    const signals = graph.signalsFor('target');
    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('failure'));
    expect(graph.errors.map((e) => e.code)).toContain('global-store/set-failed');
  });

  test('(control) Done and Failure remain mutually exclusive — Completed is the only universal one', async () => {
    const graph = await graphWith('net.noodl.GlobalStore.Set', { storeName: 'app', key: 'k' }, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', 1);
    await graph.settle(3);
    trigger.go();
    await graph.settle(3);

    // "Exactly one" is the load-bearing half of Rule 1. Without this row, a fix that emitted
    // everything on every path would pass every other row in this describe.
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(countOf(graph, 'completed')).toBe(1);
  });
});

// =================================================================================================
// Action Dispatcher — §0.2 Result 3, half two, plus the granularity §0 flagged and did not settle
// =================================================================================================

describe('ERG-001 §4: Action Dispatcher', () => {
  const WIRES: Wire[] = [
    { sourcePort: 'a', targetPort: 'action' },
    { sourcePort: 'go', targetPort: 'dispatch' },
    { sourcePort: 'go2', targetPort: 'cancel' }
  ];

  const PARAMS = { channel: 'erg001-s4', storeName: 'app', builtIns: 'SET_STORE', waitForHandler: 0 };

  test('an admitted Dispatch reports Done on the invocation, then Completed', async () => {
    const graph = await graphWith('net.noodl.ActionDispatcher', PARAMS, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', { type: 'SET_STORE', payload: { key: 'x', value: 1 } });
    await graph.settle(3);
    trigger.go();
    await graph.settle(4);

    const signals = graph.signalsFor('target');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
  });

  test('⚠️ the two granularities are distinct ports: Completed counts invocations, Action Completed counts actions', async () => {
    const graph = await graphWith('net.noodl.ActionDispatcher', PARAMS, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    // ONE Dispatch carrying THREE actions. This is the pairing the rename exists for: the old
    // `completed` fired three times for one invocation while claiming to be the node's
    // completion signal.
    trigger.send('a', [
      { type: 'SET_STORE', payload: { key: 'a', value: 1 } },
      { type: 'SET_STORE', payload: { key: 'b', value: 2 } },
      { type: 'SET_STORE', payload: { key: 'c', value: 3 } }
    ]);
    await graph.settle(3);
    trigger.go();
    await graph.settle(8);

    expect(countOf(graph, 'actionCompleted')).toBe(3);
    expect(countOf(graph, 'completed')).toBe(1);
    expect(outcomesOf(graph)).toEqual(['done']);
    // The old name must be gone, or the rename passes vacuously.
    expect(graph.node('target').hasOutput('actionCompleted')).toBe(true);
    expect(graph.signalsFor('target').indexOf('completed')).toBeGreaterThan(-1);
  });

  test('a Dispatch that admits nothing reports Failure, and still emits Completed', async () => {
    const graph = await graphWith('net.noodl.ActionDispatcher', PARAMS, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    // Malformed: refused outright, so the invocation did no work at all.
    trigger.send('a', { notAType: true });
    await graph.settle(3);
    trigger.go();
    await graph.settle(4);

    const signals = graph.signalsFor('target');
    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(signals).toContain('refused');
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('failure'));
  });

  test('Cancel All with nothing queued reports Unchanged rather than nothing at all', async () => {
    const graph = await graphWith('net.noodl.ActionDispatcher', PARAMS, WIRES);
    const trigger = graph.node<TriggerInstance>('trigger');

    // Measured before: `doCancel` opened `if (!internal.dispatcher) return;` — a bare return,
    // so a Cancel All before anything was ever dispatched was a dead chain with no diagnostic.
    trigger.go2();
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual(['unchanged']);
    expect(graph.signalsFor('target')).toContain('completed');
    // Unchanged is not a failure and raises nothing.
    expect(graph.errors.length).toBe(0);
  });

  test('(control) a Cancel All that really drops something still reports Done', async () => {
    // ⚠️ `waitForHandler` must be non-zero here or the unknown action is refused on the spot
    // instead of waiting in the queue, and there would be nothing for Cancel All to drop.
    const graph = await graphWith(
      'net.noodl.ActionDispatcher',
      { ...PARAMS, waitForHandler: 60000 },
      WIRES
    );
    const trigger = graph.node<TriggerInstance>('trigger');

    // An action whose handler never appears sits in the queue, so there is something to drop.
    trigger.send('a', { type: 'NEVER_HANDLED' });
    await graph.settle(3);
    trigger.go();
    await graph.settle(2);
    trigger.go2();
    await graph.settle(4);

    // Without this control, "Cancel All always says Unchanged" would pass the row above.
    expect(outcomesOf(graph)).toContain('done');
  });
});
