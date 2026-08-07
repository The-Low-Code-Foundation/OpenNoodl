/**
 * ERG-001 §4 — the outcome contract on the Record CRUD family.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md` for the decision and
 * `ERG-001-S0-MEASUREMENT.md` §0.1 for the ground. Five actions, and — unlike the eleven Cloud
 * Services nodes, where each owned its own funnel — **one shared funnel for all five**:
 *
 * | Node | Action | Old wire | Shape |
 * |---|---|---|---|
 * | `NewDbModelProperties` — Create Record | `Do` | `created` | `done` · `failure` · `completed` |
 * | `SetDbModelProperties` — Update Record | `Do` | `stored` | same, on both `Store to` branches |
 * | `DeleteDbModelProperties` — Delete Record | `Do` | `deleted` | same |
 * | `AddDbModelRelation` — Add Record Relation | `Do` | `relationAdded` | same |
 * | `RemoveDbModelRelation` — Remove Record Relation | `Do` | `relationRemoved` | same |
 *
 * §0.2 Result 2 counted four different internal names behind one displayed "Done". Four of those
 * five wires are in this file, which is why the whole family is one build: doing half of it is
 * what manufactures the divergence in the first place.
 *
 * ## ⚠️ The funnel is `dbmodelcrudbase`, and it is changed **once**
 *
 * `setError` is the family's single failure path and is reached from four places — the verb's own
 * error callback, `checkWarningsBeforeCloudOp`, `cloudStoreForScope`, and the relation nodes'
 * `validateInputs`. Every one of them now settles the *caller's* tokens rather than minting a
 * fresh one behind its back. The rows that read this are the two-pulse rows and the
 * unknown-backend rows: before the tokens, a refusal inside `cloudStore()` reported one failure
 * and the caller's invocation was left open forever, which no test could see.
 *
 * ## No `Unchanged` on any of the five, and each absence is measured rather than argued
 *
 * - **Create Record** mints a record every time; there is no post-condition that can already hold.
 * - **Update Record** sends whatever the property inputs hold and the backend does not diff. The
 *   `Local only` branch calls `Model.set`, which *does* suppress an identical value — but it
 *   reports nothing back, so the node cannot tell. Recorded as an unmeasured candidate rather
 *   than given a port that would be guessing.
 * - **Delete Record** deletes; a record that is not there answers on `error`.
 * - **Add / Remove Record Relation** — ⚠️ Remove's own description says it succeeds "when the
 *   relation was not there to begin with", which *is* the `Unchanged` shape. The backend answers
 *   identically either way, so the node has nothing to distinguish them with. A port that can
 *   never fire is exactly what §5's dead-end check exists to complain about, so there is none.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the `done` rename in any one node | that node's success rows; each has an exact-array clause so the rename cannot pass vacuously |
 * | `checkWarningsBeforeCloudOp` minting its own token instead of taking the caller's | the no-class rows, on a leaked `outcome/duplicate` from the *next* invocation |
 * | `cloudStore()` minting its own token | the unknown-backend rows, on `outcome/duplicate` |
 * | the token pushed *after* `hasScheduledStore` returns in `scheduleStore` | the two-local-pulses row only |
 */

/* eslint-env jest */

const metadata: Record<string, unknown> = {};

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: (key: string) => metadata[key] },
  Node: require('../../src/node')
}));

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import CloudStore = require('../../src/api/cloudstore');
import Model = require('../../src/model');

import AddRelationModule = require('../../src/nodes/std-library/data/dbmodelnode-addrelation');
import CreateRecordModule = require('../../src/nodes/std-library/data/newdbmodelpropertiesnode');
import DeleteRecordModule = require('../../src/nodes/std-library/data/deletedbmodelpropertiesnode');
import RemoveRelationModule = require('../../src/nodes/std-library/data/dbmodelnode-removerelation');
import UpdateRecordModule = require('../../src/nodes/std-library/data/setdbmodelpropertiesnode');

// =================================================================================================
// Doubles
// =================================================================================================

/** Every store call this family can make, recorded rather than auto-answered. */
interface StoreCall {
  method: string;
  options: { success(response?: unknown): void; error(error?: string): void } & Record<string, unknown>;
}

let storeCalls: StoreCall[] = [];

function record(method: string) {
  return (options: StoreCall['options']) => {
    storeCalls.push({ method, options });
  };
}

/** A store that records and answers nothing until a row says so. */
function stubStore(): void {
  jest.spyOn(CloudStore as unknown as { forBackend: (...a: unknown[]) => unknown }, 'forBackend').mockReturnValue({
    create: record('create'),
    save: record('save'),
    delete: record('delete'),
    addRelation: record('addRelation'),
    removeRelation: record('removeRelation'),
    _fromJSON: (json: Record<string, unknown>) => ({
      getId: () => json.objectId || 'new-id',
      data: json,
      set: () => undefined,
      notify: () => undefined,
      on: () => undefined,
      off: () => undefined
    })
  } as never);
}

/** No backend at all — the shape that used to leave the caller's invocation open forever. */
function stubNoStore(): void {
  jest
    .spyOn(CloudStore as unknown as { forBackend: (...a: unknown[]) => unknown }, 'forBackend')
    .mockReturnValue(undefined as never);
}

function lastCall(method: string): StoreCall {
  const found = storeCalls.filter((c) => c.method === method);
  if (found.length === 0) throw new Error('no ' + method + ' call was made');
  return found[found.length - 1];
}

beforeEach(() => {
  storeCalls = [];
  for (const key of Object.keys(metadata)) delete metadata[key];
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function graphWith(module: unknown, type: string, parameters: Record<string, unknown> = {}): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(2);
  return graph;
}

/** The terminal outcomes a node reported, with value-level announcements dropped. */
function outcomesOf(graph: CorpusGraph, id = 'node'): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function pulse(graph: CorpusGraph, port: string, id = 'node'): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

/** A record the family will accept as bound, without a backend round trip. */
function bindRecord(graph: CorpusGraph, id = 'r1'): void {
  graph.node('node').setInputValue('modelId', id);
}

// =================================================================================================
// Create Record
// =================================================================================================

describe('ERG-001 §4: Create Record', () => {
  test('a stored record reports Done then Completed, and no longer says "created"', async () => {
    stubStore();
    const graph = await graphWith(CreateRecordModule, 'NewDbModelProperties', { collectionName: 'articles' });
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('create').options.success({ objectId: 'r1', title: 'Ada' });
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    // ⚠️ Exact array, not `.not.toContain('created')` — the negative form passes *vacuously*
    // the moment the port stops existing, which is the trap this phase was caught by once.
    expect(signals).toEqual(['done', 'completed']);
    expect(graph.node('node').hasOutput('created')).toBe(false);
  });

  test('a refused insert reports Failure with the family code, then Completed', async () => {
    stubStore();
    const graph = await graphWith(CreateRecordModule, 'NewDbModelProperties', { collectionName: 'articles' });
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('create').options.error('Permission denied');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['record/storage-op-failed']);
    expect(graph.errors[0].message).toBe('Permission denied');
  });

  /**
   * ⚠️ The pre-flight check settles the caller's invocation rather than minting its own.
   *
   * `checkWarningsBeforeCloudOp` runs *before* the deferral, and its `setError` used to open and
   * close a token nobody else knew about. The consequence is not visible in this invocation — it
   * is visible in the *next* one, which would drain a token this one never spent and report
   * twice. That is why the second pulse is here rather than in a row of its own: a row asserting
   * silence cannot detect a wrongly-minted token; only a later count can.
   */
  test('with no Class set it reports one Failure per Do, and never twice for one', async () => {
    stubStore();
    const graph = await graphWith(CreateRecordModule, 'NewDbModelProperties');

    pulse(graph, 'store');
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure', 'failure']);
    expect(graph.signalsFor('node').filter((s) => s === 'completed')).toHaveLength(2);
    expect(graph.errors.map((e) => e.code)).not.toContain('outcome/duplicate');
    expect(graph.errors.every((e) => e.message === 'No class name specified')).toBe(true);
  });

  test('an unknown backend reports exactly one Failure — no outcome/duplicate', async () => {
    stubNoStore();
    const graph = await graphWith(CreateRecordModule, 'NewDbModelProperties', {
      collectionName: 'articles',
      backendId: 'deleted-backend'
    });
    pulse(graph, 'store');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['record/storage-op-failed']);
    expect(graph.errors[0].message).toContain('deleted-backend');
  });

  test('two Do pulses in one frame coalesce into one insert and still report two outcomes', async () => {
    stubStore();
    const graph = await graphWith(CreateRecordModule, 'NewDbModelProperties', { collectionName: 'articles' });

    pulse(graph, 'store');
    pulse(graph, 'store');
    await graph.settle(2);

    expect(storeCalls.filter((c) => c.method === 'create')).toHaveLength(1);
    lastCall('create').options.success({ objectId: 'r1' });
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['done', 'done']);
    expect(graph.signalsFor('node').filter((s) => s === 'completed')).toHaveLength(2);
  });

  // ✅ Pinned control. Nobody has pressed Do.
  test('(pinned control) booting reports no outcome and raises nothing', async () => {
    stubStore();
    const graph = await graphWith(CreateRecordModule, 'NewDbModelProperties', { collectionName: 'articles' });
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  // ✅ Pinned control. A create always creates.
  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(CreateRecordModule, 'NewDbModelProperties');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// Update Record — two branches of one port, and both are actions
// =================================================================================================

describe('ERG-001 §4: Update Record', () => {
  test('a saved record reports Done then Completed, and no longer says "stored"', async () => {
    stubStore();
    const graph = await graphWith(UpdateRecordModule, 'SetDbModelProperties', { collectionName: 'articles' });
    bindRecord(graph);
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('save').options.success({ title: 'Grace' });
    await graph.settle(2);

    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
    expect(graph.node('node').hasOutput('stored')).toBe(false);
  });

  /**
   * ⚠️ The `Local only` branch is the *same port* reaching a different method, and NDA-004 §2
   * already found the two branches disagreeing about whether to report a missing Id. They must
   * not now disagree about whether to report an outcome.
   */
  test('the Local only branch reports Done and Completed too, with no backend call', async () => {
    stubStore();
    const graph = await graphWith(UpdateRecordModule, 'SetDbModelProperties', {
      collectionName: 'articles',
      storeType: 'local'
    });
    bindRecord(graph);
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    expect(storeCalls).toEqual([]);
    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
  });

  /**
   * ⚠️ The token is pushed **before** the `hasScheduledStore` guard can return, for the same
   * reason `login.ts` mints before its guard: the guard exists to coalesce the *work*, not the
   * outcomes. Two presses are two invocations.
   */
  test('two local Do pulses in one frame do one write and still report two outcomes', async () => {
    stubStore();
    const graph = await graphWith(UpdateRecordModule, 'SetDbModelProperties', {
      collectionName: 'articles',
      storeType: 'local'
    });
    bindRecord(graph);
    await graph.settle(2);

    pulse(graph, 'store');
    pulse(graph, 'store');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['done', 'done']);
    expect(graph.signalsFor('node').filter((s) => s === 'completed')).toHaveLength(2);
  });

  test('a save with no Id reports Failure, then Completed', async () => {
    stubStore();
    const graph = await graphWith(UpdateRecordModule, 'SetDbModelProperties', { collectionName: 'articles' });
    pulse(graph, 'store');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.message)).toEqual(['Missing Record Id']);
  });

  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(UpdateRecordModule, 'SetDbModelProperties');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });

  // ✅ Pinned control. Binding `Id` is a value setter, not an invocation.
  test('(pinned control) binding Id reports no outcome', async () => {
    stubStore();
    const graph = await graphWith(UpdateRecordModule, 'SetDbModelProperties', { collectionName: 'articles' });
    bindRecord(graph);
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual([]);
  });
});

// =================================================================================================
// Delete Record
// =================================================================================================

describe('ERG-001 §4: Delete Record', () => {
  test('a deleted record reports Done then Completed, and no longer says "deleted"', async () => {
    stubStore();
    const graph = await graphWith(DeleteRecordModule, 'DeleteDbModelProperties', { collectionName: 'articles' });
    bindRecord(graph);
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('delete').options.success();
    await graph.settle(2);

    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
    expect(graph.node('node').hasOutput('deleted')).toBe(false);
  });

  test('a refused delete reports Failure with the family code, then Completed', async () => {
    stubStore();
    const graph = await graphWith(DeleteRecordModule, 'DeleteDbModelProperties', { collectionName: 'articles' });
    bindRecord(graph);
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('delete').options.error('Record is referenced elsewhere');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    // ⚠️ Added after the discrimination check caught it: this row's *name* said "then
    // Completed" and its body never asserted it, so it survived a revert that took
    // `Completed` off every failure in the family. A title is not an assertion.
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['record/storage-op-failed']);
  });

  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(DeleteRecordModule, 'DeleteDbModelProperties');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// Add / Remove Record Relation — the two nodes whose refusal is a `validateInputs` verdict
// =================================================================================================

describe('ERG-001 §4: Add Record Relation', () => {
  test('a written relation reports Done then Completed, and no longer says "relationAdded"', async () => {
    stubStore();
    // The target must be a record something has loaded, or `validateInputs` refuses before the
    // request — see the class-burning measurement in `dbmodelnode-addrelation.ts`.
    (Model as unknown as { get(id: string): { _class?: string } }).get('t1')._class = 'Authors';

    const graph = await graphWith(AddRelationModule, 'AddDbModelRelation', {
      collectionName: 'articles',
      relationProperty: 'authors'
    });
    bindRecord(graph);
    graph.node('node').setInputValue('targetId', 't1');
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('addRelation').options.success({});
    await graph.settle(2);

    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
    expect(graph.node('node').hasOutput('relationAdded')).toBe(false);
  });

  test('an unloaded target reports Failure once, then Completed', async () => {
    stubStore();
    const graph = await graphWith(AddRelationModule, 'AddDbModelRelation', {
      collectionName: 'articles',
      relationProperty: 'authors'
    });
    bindRecord(graph);
    graph.node('node').setInputValue('targetId', 'never-loaded');
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['record/storage-op-failed']);
    expect(graph.errors[0].message).toContain('has not been loaded');
    expect(storeCalls).toEqual([]);
  });

  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(AddRelationModule, 'AddDbModelRelation');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

describe('ERG-001 §4: Remove Record Relation', () => {
  test('a removed relation reports Done then Completed, and no longer says "relationRemoved"', async () => {
    stubStore();
    (Model as unknown as { get(id: string): { _class?: string } }).get('t2')._class = 'Authors';

    const graph = await graphWith(RemoveRelationModule, 'RemoveDbModelRelation', {
      collectionName: 'articles',
      relationProperty: 'authors'
    });
    bindRecord(graph);
    graph.node('node').setInputValue('targetId', 't2');
    await graph.settle(2);
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('removeRelation').options.success({});
    await graph.settle(2);

    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
    expect(graph.node('node').hasOutput('relationRemoved')).toBe(false);
  });

  /**
   * ✅ Pinned control, and the one the contract most wants written down.
   *
   * The node's own description says a removal succeeds "when the relation was not there to begin
   * with" — the duplicate-insert shape the contract's problem statement opens with. It gets no
   * `Unchanged` anyway, because the backend answers identically either way and the node has
   * nothing to tell them apart with. §5 must not be taught to expect one here.
   */
  test('(pinned control) has no Unchanged port, though a no-op removal is expressible', async () => {
    const graph = await graphWith(RemoveRelationModule, 'RemoveDbModelRelation');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// The family, as a set
// =================================================================================================

describe('ERG-001 §4: the Record CRUD family, as a set', () => {
  const FAMILY: Array<{ label: string; module: unknown; type: string; oldWire: string }> = [
    { label: 'Create Record', module: CreateRecordModule, type: 'NewDbModelProperties', oldWire: 'created' },
    { label: 'Update Record', module: UpdateRecordModule, type: 'SetDbModelProperties', oldWire: 'stored' },
    { label: 'Delete Record', module: DeleteRecordModule, type: 'DeleteDbModelProperties', oldWire: 'deleted' },
    { label: 'Add Record Relation', module: AddRelationModule, type: 'AddDbModelRelation', oldWire: 'relationAdded' },
    {
      label: 'Remove Record Relation',
      module: RemoveRelationModule,
      type: 'RemoveDbModelRelation',
      oldWire: 'relationRemoved'
    }
  ];

  test.each(FAMILY)('$label declares done, failure and completed and drops $oldWire', async ({ module, type, oldWire }) => {
    const graph = await graphWith(module, type);
    const node = graph.node<NodeInstance>('node');

    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // "Completed is universal, and it is the one port with no exemption."
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput(oldWire)).toBe(false);
  });
});
