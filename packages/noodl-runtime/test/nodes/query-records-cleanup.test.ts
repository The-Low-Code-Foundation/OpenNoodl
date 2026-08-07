/**
 * Characterisation tests for the two Query Records defects PLAT-003 slice 12 recorded
 * (NOTES §27.3 items 1 and 3) and slice 13 fixes.
 *
 *   * **The `error` output has never carried a message.** `setError` wrote
 *     `this._internal.err` while the `error` output's getter reads `this._internal.error`,
 *     so a failed fetch fired the `failure` signal and left the port empty. §23.4 recorded
 *     exactly this in the *deprecated* `dbcollectionnode` — this is the same bug in the
 *     node that replaced it, carried across the rewrite.
 *
 *   * **The `create` listener outlived the node.** `initialize` subscribes to `save`,
 *     `create` and `delete`; `_onNodeDeleted` unsubscribed `insert`, `delete` and `save`.
 *     Nothing in the runtime emits `insert`, so the `create` subscription survived — and it
 *     closes over the node, so a deleted Query Records node stayed reachable and kept
 *     patching a collection nobody reads.
 *
 * These assert the fixed behaviour and are written to fail against the pre-fix source.
 */

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import type { NodeModule } from '@noodl/types';

const NodeDefinition = require('../../src/nodedefinition');

import CloudStore = require('../../src/api/cloudstore');
import QueryRecords = require('../../src/nodes/std-library/data/dbcollectionnode2');

/** The members of a Query Records instance these tests reach for. */
interface QueryRecordsNode {
  _internal: { error?: string; err?: string };
  setError(err: string): void;
  getOutput(name: string): { value: unknown };
  _onNodeDeleted(): void;
}

/**
 * A `CloudStore` is created per model scope, so giving each test its own scope object gives
 * it its own event emitter — and therefore a listener count that means something.
 */
interface ScopeStub {
  modelScope: Record<string, unknown>;
  deleteNode(): void;
}

function createStubContext() {
  return {
    hasFatalError: false,
    scheduleUpdate() {},
    scheduleAfterUpdate() {},
    scheduleAfterInputsHaveUpdated(cb: () => void) {
      cb();
    },
    // `flagOutputDirty` reaches `Node.sendValue`, which reports every sent value to the
    // context. Only needed once the `error` output actually *has* a value to send.
    connectionSentValue() {},
    // `sendSignalOnOutput` → `scheduleAfterInputsHaveUpdated` → `flagDirty` on the node
    // itself, which announces the node to the scheduler, and then reports the signal.
    nodeIsDirty() {},
    connectionSentSignal() {},
    editorConnection: undefined,
    modelScope: undefined
  };
}

function createScope(): ScopeStub {
  return { modelScope: {}, deleteNode() {} };
}

function createNode(scope: ScopeStub): QueryRecordsNode {
  const definition = NodeDefinition.defineNode((QueryRecords as NodeModule).node);
  return definition(createStubContext(), 'query-records-test', scope);
}

/** The emitter behind the `CloudStore` for a given scope. */
function eventsFor(scope: ScopeStub) {
  return (CloudStore as unknown as { forScope(s: unknown): { events: { listenerCount(n: string): number } } }).forScope(
    scope.modelScope
  ).events;
}

describe('Query Records — the error output carries the message', () => {
  it('puts the message where the output getter reads it', () => {
    const node = createNode(createScope());

    node.setError('Failed to fetch.');

    expect(node.getOutput('error').value).toBe('Failed to fetch.');
  });

  it('still signals failure', () => {
    const node = createNode(createScope());

    let failed = false;
    (node as unknown as { sendSignalOnOutput(n: string): void }).sendSignalOnOutput = function (name: string) {
      if (name === 'failure') failed = true;
    };

    node.setError('Failed to fetch.');

    expect(failed).toBe(true);
  });
});

describe('Query Records — deleting the node unsubscribes every listener it added', () => {
  it('subscribes to save, create and delete on initialize', () => {
    const scope = createScope();
    const events = eventsFor(scope);

    createNode(scope);

    expect(events.listenerCount('save')).toBe(1);
    expect(events.listenerCount('create')).toBe(1);
    expect(events.listenerCount('delete')).toBe(1);
  });

  it('leaves no listener behind — including create, which nothing used to remove', () => {
    const scope = createScope();
    const events = eventsFor(scope);
    const node = createNode(scope);

    node._onNodeDeleted();

    expect(events.listenerCount('create')).toBe(0);
    expect(events.listenerCount('save')).toBe(0);
    expect(events.listenerCount('delete')).toBe(0);
  });

  it('never subscribed to insert, so nothing should be unsubscribed from it', () => {
    const scope = createScope();
    const events = eventsFor(scope);
    const node = createNode(scope);

    expect(events.listenerCount('insert')).toBe(0);
    node._onNodeDeleted();
    expect(events.listenerCount('insert')).toBe(0);
  });
});
