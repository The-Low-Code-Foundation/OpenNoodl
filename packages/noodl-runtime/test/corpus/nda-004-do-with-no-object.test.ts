/**
 * NDA-004 §2 — "the Do that did nothing".
 *
 * The Object family shared one shape across five call sites: an action node whose scheduler
 * opened with `if (!internal.model) return;`. Press `Do`/`Store` with no object bound and the
 * node wrote nothing, emitted nothing and reported nothing — from the graph, indistinguishable
 * from a write that succeeded. That is the Failure Contract's headline case ("the node was
 * asked to act and could not"), and it is what these rows pin.
 *
 * Two things here are deliberate and easy to undo by accident, so each has its own row:
 *
 * - `Failure` fires in **both** id-source modes, but the *raise* happens only in `explicit`
 *   mode. In `foreach` mode `foreachitem.ts` has already raised the precise diagnosis
 *   (`repeater-item/no-item-in-scope`), and a second, vaguer event about one root cause is
 *   the "two wordings of one failure" the contract calls noise.
 * - The Object node does **not** clear its pending `dirtyValues` on the failure path. That is
 *   the behaviour it always had, and a retry after the object arrives depends on it.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ModelNode = require('../../src/nodes/std-library/data/modelnode2');
import SetModelProperties = require('../../src/nodes/std-library/data/setmodelpropertiesnode');

/** Fires the action port under test, so a row never depends on input-queue ordering. */
interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      go: { type: 'signal' },
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

/**
 * One action node, one trigger, and whatever parameters the row wants.
 *
 * `modelId` is left unset on purpose in most rows — that is exactly the author mistake under
 * test, and setting it would make every row pass by binding an object.
 */
async function graphWith(
  type: string,
  actionPort: string,
  parameters: Record<string, unknown>,
  /** When given, the trigger drives `actionPort` with this value instead of a signal. */
  value?: unknown
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, ModelNode as unknown as NodeModule, SetModelProperties as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'target', type, parameters }
          ],
          connections: [
            {
              sourceId: 'trigger',
              sourcePort: value === undefined ? 'go' : 'value',
              targetId: 'target',
              targetPort: actionPort
            }
          ]
        }
      ]
    } as never
  });

  await graph.settle(3);
  if (value === undefined) graph.node<TriggerInstance>('trigger').go();
  else graph.node<TriggerInstance>('trigger').send(value);
  await graph.settle(6);
  return graph;
}

describe('NDA-004 §2: Set Object Properties with no object bound', () => {
  test('fires Failure instead of returning silently', async () => {
    const graph = await graphWith('SetModelProperties', 'store', { properties: 'name' });

    expect(graph.signalsFor('target')).toContain('failure');
    expect(graph.signalsFor('target')).not.toContain('stored');
  });

  test('raises a namespaced code an author can match on', async () => {
    const graph = await graphWith('SetModelProperties', 'store', { properties: 'name' });

    expect(graph.errors.map((error) => error.code)).toContain('set-object-properties/no-object');
  });

  test('publishes the reason on the Error output, not only on the bus', async () => {
    const graph = await graphWith('SetModelProperties', 'store', { properties: 'name' });

    // The contract's "a bare Failure signal reproduces the current problem one level up".
    expect(graph.node('target').getOutput('error').value).toEqual(
      expect.stringContaining('no object is bound')
    );
  });

  // ✅ Pinned control: a node that *can* act still acts, and says nothing on the error
  // channel. Without this the rows above would pass just as well if `Do` had stopped working.
  test('(pinned control) with an Id set, it stores and stays quiet', async () => {
    const graph = await graphWith('SetModelProperties', 'store', { properties: 'name', modelId: 'an-object' });

    expect(graph.signalsFor('target')).toContain('stored');
    expect(graph.signalsFor('target')).not.toContain('failure');
    expect(graph.errors).toEqual([]);
  });
});

/**
 * The Object node is the near-miss, and this row exists so nobody "fixes" it.
 *
 * `Model2.scheduleStore` opens with the same `if (!internal.model) return;`, so it reads as
 * the same defect. It is not: the node has no `Do` input at all — `scheduleStore` is reached
 * from `userInputSetter`, i.e. from any value arriving at a `prop-…` port. An Object node
 * whose Id has not arrived yet therefore reaches that line once per incoming value, on the
 * ordinary path, with nobody having asked it to act. Failing there would fire `Failure`
 * during a normal boot.
 */
describe('NDA-004 §2: the Object node stays silent, on purpose', () => {
  test('values arriving before the Id do not raise, and are not lost', async () => {
    const graph = await graphWith('Model2', 'prop-name', { properties: 'name' }, 'Ada');

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('target')).not.toContain('failure');
  });
});

describe('NDA-004 §2: id-source mode decides whether the failure is also raised', () => {
  /**
   * The asymmetry, stated. Both modes reach the graph; only `explicit` reaches the bus,
   * because `foreachitem.ts` owns the report in `foreach` mode and has already made it.
   */
  test('From repeater outside a repeater: Failure fires, and the only raise is the binding one', async () => {
    const graph = await graphWith('SetModelProperties', 'store', {
      properties: 'name',
      idSource: 'foreach'
    });

    expect(graph.signalsFor('target')).toContain('failure');

    const codes = graph.errors.map((error) => error.code);
    expect(codes).toContain('repeater-item/no-item-in-scope');
    expect(codes).not.toContain('set-object-properties/no-object');
  });

});
