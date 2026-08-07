/**
 * AGENT-004 — the Optimistic Update node.
 *
 * The happy path is three lines and is not where this can go wrong. What is tested hardest
 * here is the set of ways an optimistic update *fails*: the server rejects it, the server
 * never answers at all, somebody else writes the key before the rollback lands, two updates
 * are in flight and the answers come back in the wrong order, and the component holding the
 * node is torn down while a patch is still open. Each of those either corrupts shared state
 * or strands it, and none of them announces itself.
 *
 * The store's own patch primitives (AGENT-003 §3.5) are relied on rather than reimplemented,
 * so several of these are as much a test of the seam between the two as of this node.
 */

import type { NodeInstance } from '@noodl/types';

import { globalStoreManager } from '../src/nodes/std-library/agent/globalstore';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import GlobalStoreNodeModule = require('../src/nodes/std-library/agent/globalstorenode');
import OptimisticUpdateModule = require('../src/nodes/std-library/agent/optimisticupdatenode');

const store = globalStoreManager;

interface Probe {
  node: NodeInstance;
  signals: string[];
}

function createContext() {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(GlobalStoreNodeModule.node));
  context.nodeRegister.register(NodeDefinition.defineNode(OptimisticUpdateModule.node));
  return context;
}

let nextNodeId = 0;

function createNode(context: InstanceType<typeof NodeContext>, type: string): Probe {
  const node = context.nodeRegister.createNode(type, 'node-' + ++nextNodeId) as NodeInstance;
  const signals: string[] = [];
  const original = node.sendSignalOnOutput.bind(node);
  node.sendSignalOnOutput = (name: string) => {
    signals.push(name);
    original(name);
  };
  return { node, signals };
}

function output(node: NodeInstance, name: string): unknown {
  return node.getOutput(name).value;
}

/**
 * Runs one frame's worth of updates on a node.
 *
 * The iteration bump is not decoration. `Node.update` allows a hundred passes per context
 * iteration before it declares a cyclic loop and stops updating the node entirely, and a
 * test that calls `update()` in a loop without advancing the context hits that ceiling and
 * then fails for a reason that has nothing to do with the node under test. A real graph
 * advances it once per frame; so does this.
 */
function tick(node: NodeInstance) {
  (node.context as unknown as { updateIteration: number }).updateIteration++;
  node.update();
}

/** Pulses a signal input. Signals are edge-triggered, so a second pulse needs the falling edge. */
function pulse(node: NodeInstance, name: string) {
  node.setInputValue(name, false);
  node.setInputValue(name, true);
  tick(node);
}

/** A node already configured against `app.<key>`, with the update applied. */
function applied(
  context: InstanceType<typeof NodeContext>,
  key: string,
  value: unknown,
  extra?: Record<string, unknown>
) {
  const probe = createNode(context, 'net.noodl.OptimisticUpdate');
  probe.node.setInputValue('key', key);
  probe.node.setInputValue('optimisticValue', value);
  for (const name of Object.keys(extra || {})) {
    probe.node.setInputValue(name, (extra as Record<string, unknown>)[name]);
  }
  probe.node.setInputValue('apply', true);
  tick(probe.node);
  return probe;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  // Deliberately before the timer teardown: a node that failed to clear a timer would
  // otherwise be hidden by clearAllTimers.
  store.reset({ clearState: true });
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

describe('apply', () => {
  it('writes the value straight away and reports the transaction', () => {
    const context = createContext();
    const { node, signals } = applied(context, 'status', 'accepted');

    expect(store.getKey('app', 'status')).toBe('accepted');
    // ⚠️ ERG-001 is **purely additive** on this node. `Applied`, `Committed`, `Rolled Back` and
    // `Timed Out` all stay, because they say *which phase* of a three-phase lifecycle resolved
    // and the contract's shared `Done` cannot. The outcome lands last, after every value the
    // action wrote is already readable.
    expect(signals).toEqual(['applied', 'done', 'completed']);
    expect(output(node, 'value')).toBe('accepted');
    expect(output(node, 'isPending')).toBe(true);
    expect(output(node, 'pendingCount')).toBe(1);
    expect(output(node, 'isCommitted')).toBe(false);
    expect(output(node, 'isRolledBack')).toBe(false);
    expect(String(output(node, 'transactionId'))).toMatch(/^tx_/);
    expect(output(node, 'error')).toBeUndefined();
  });

  it('reads the key and value that arrived in the same frame as the signal', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.OptimisticUpdate');

    // Deliberately the wrong way round: the signal first, the data after.
    node.setInputValue('apply', true);
    node.setInputValue('key', 'status');
    node.setInputValue('optimisticValue', 'accepted');
    tick(node);

    expect(store.getKey('app', 'status')).toBe('accepted');
  });

  it('reports the value the key held before, and leaves it reachable', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node } = applied(context, 'status', 'accepted');

    expect(output(node, 'previousValue')).toBe('pending');
    expect(output(node, 'value')).toBe('accepted');
  });

  it('reports a missing key instead of doing nothing quietly', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.OptimisticUpdate');

    node.setInputValue('optimisticValue', 1);
    node.setInputValue('apply', true);
    tick(node);

    expect(output(node, 'error')).toBe('Key is required');
    // NDA-012: `Failure` is new. This node used to end a refusal on the `error` string
    // alone, so an author had a success signal to wire and nothing to sequence a failure
    // off. A rollback is deliberately not a `Failure` — it has `Rolled Back` already.
    //
    // ERG-001: `Completed` joins it. `failure` itself is unchanged — it already carried the
    // contract's name and exactly its meaning — but it is now fired through `reportOutcome`
    // rather than by hand, which is what also produces the `Completed` an author wires to
    // carry on regardless.
    expect(signals).toEqual(['failure', 'completed']);
    expect(store.getState('app')).toEqual({});
  });

  it('honours an authored transaction id', () => {
    const context = createContext();
    const { node } = applied(context, 'status', 'accepted', { transactionId: 'tx-accept-7' });

    expect(output(node, 'transactionId')).toBe('tx-accept-7');
    expect(store.getOpenPatches('app').map((patch) => patch.id)).toEqual(['tx-accept-7']);
  });

  it('rejects a second apply with the same transaction id', () => {
    const context = createContext();
    const { node, signals } = applied(context, 'status', 'a', { transactionId: 'dup' });
    signals.length = 0;

    node.setInputValue('optimisticValue', 'b');
    pulse(node, 'apply');

    // NDA-012: `Failure` is new. This node used to end a refusal on the `error` string
    // alone, so an author had a success signal to wire and nothing to sequence a failure
    // off. A rollback is deliberately not a `Failure` — it has `Rolled Back` already.
    //
    // ERG-001: `Completed` joins it. `failure` itself is unchanged — it already carried the
    // contract's name and exactly its meaning — but it is now fired through `reportOutcome`
    // rather than by hand, which is what also produces the `Completed` an author wires to
    // carry on regardless.
    expect(signals).toEqual(['failure', 'completed']);
    expect(String(output(node, 'error'))).toContain('already open');
    expect(store.getKey('app', 'status')).toBe('a');
    expect(output(node, 'pendingCount')).toBe(1);
  });

  it('targets a named store rather than the default one', () => {
    const context = createContext();
    const probe = createNode(context, 'net.noodl.OptimisticUpdate');
    probe.node.setInputValue('storeName', 'connections');
    probe.node.setInputValue('key', 'c1');
    probe.node.setInputValue('optimisticValue', { status: 'accepted' });
    probe.node.setInputValue('apply', true);
    tick(probe.node);

    expect(store.getKey('connections', 'c1')).toEqual({ status: 'accepted' });
    expect(store.getState('app')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

describe('commit', () => {
  it('keeps the optimistic value and closes the patch', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted');
    signals.length = 0;

    pulse(node, 'commit');

    expect(signals).toEqual(['committed', 'done', 'completed']);
    expect(store.getKey('app', 'status')).toBe('accepted');
    expect(store.getOpenPatches('app')).toEqual([]);
    expect(output(node, 'isPending')).toBe(false);
    expect(output(node, 'pendingCount')).toBe(0);
    expect(output(node, 'isCommitted')).toBe(true);
    expect(output(node, 'isRolledBack')).toBe(false);
  });

  it('reports a commit with nothing in flight instead of warning to a console nobody reads', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.OptimisticUpdate');
    node.setInputValue('key', 'status');
    node.setInputValue('commit', true);
    tick(node);

    // NDA-012: `Failure` is new. This node used to end a refusal on the `error` string
    // alone, so an author had a success signal to wire and nothing to sequence a failure
    // off. A rollback is deliberately not a `Failure` — it has `Rolled Back` already.
    //
    // ERG-001: `Completed` joins it. `failure` itself is unchanged — it already carried the
    // contract's name and exactly its meaning — but it is now fired through `reportOutcome`
    // rather than by hand, which is what also produces the `Completed` an author wires to
    // carry on regardless.
    expect(signals).toEqual(['failure', 'completed']);
    expect(output(node, 'error')).toBe('There is no open update to commit');
  });

  it('reports an unknown transaction id', () => {
    const context = createContext();
    const { node, signals } = applied(context, 'status', 'a');
    signals.length = 0;

    node.setInputValue('transactionId', 'not-a-transaction');
    pulse(node, 'commit');

    // NDA-012: `Failure` is new. This node used to end a refusal on the `error` string
    // alone, so an author had a success signal to wire and nothing to sequence a failure
    // off. A rollback is deliberately not a `Failure` — it has `Rolled Back` already.
    //
    // ERG-001: `Completed` joins it. `failure` itself is unchanged — it already carried the
    // contract's name and exactly its meaning — but it is now fired through `reportOutcome`
    // rather than by hand, which is what also produces the `Completed` an author wires to
    // carry on regardless.
    expect(signals).toEqual(['failure', 'completed']);
    expect(String(output(node, 'error'))).toContain('not-a-transaction');
    expect(output(node, 'pendingCount')).toBe(1);
  });

  it('clears a previous error', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.OptimisticUpdate');
    node.setInputValue('commit', true);
    tick(node);
    expect(output(node, 'error')).toBeDefined();

    node.setInputValue('key', 'status');
    node.setInputValue('optimisticValue', 1);
    pulse(node, 'apply');
    expect(output(node, 'error')).toBeUndefined();

    pulse(node, 'commit');
    expect(output(node, 'error')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

describe('rollback', () => {
  it('puts the previous value back and surfaces the reason', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted');
    signals.length = 0;

    node.setInputValue('errorMessage', 'Server said no');
    pulse(node, 'rollback');

    // ⚠️ `Done`, not `Failure`. A rollback is the author's *success* path for a failed request:
    // the graph asked for the old value back and got it. Folding the server's failure — which
    // the graph already knows about, it is why it pulsed `Rollback` — into this node's own
    // outcome is the collapse Rule 1 exists to stop.
    expect(signals).toEqual(['rolledBack', 'done', 'completed']);
    expect(store.getKey('app', 'status')).toBe('pending');
    expect(output(node, 'value')).toBe('pending');
    expect(output(node, 'error')).toBe('Server said no');
    expect(output(node, 'isRolledBack')).toBe(true);
    expect(output(node, 'isPending')).toBe(false);
    expect(store.getOpenPatches('app')).toEqual([]);
  });

  it('deletes a key the update introduced rather than leaving it holding undefined', () => {
    const context = createContext();
    const { node } = applied(context, 'draft', { text: 'hi' });

    expect(store.hasKey('app', 'draft')).toBe(true);
    pulse(node, 'rollback');

    expect(store.hasKey('app', 'draft')).toBe(false);
    expect(store.getState('app')).toEqual({});
  });

  it('falls back to a generic reason when none is wired', () => {
    const context = createContext();
    const { node } = applied(context, 'status', 'accepted');

    pulse(node, 'rollback');

    expect(output(node, 'error')).toBe('The update was rolled back');
  });

  it('reports a rollback with nothing in flight', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.OptimisticUpdate');
    node.setInputValue('key', 'status');
    node.setInputValue('rollback', true);
    tick(node);

    // NDA-012: `Failure` is new. This node used to end a refusal on the `error` string
    // alone, so an author had a success signal to wire and nothing to sequence a failure
    // off. A rollback is deliberately not a `Failure` — it has `Rolled Back` already.
    //
    // ERG-001: `Completed` joins it. `failure` itself is unchanged — it already carried the
    // contract's name and exactly its meaning — but it is now fired through `reportOutcome`
    // rather than by hand, which is what also produces the `Completed` an author wires to
    // carry on regardless.
    expect(signals).toEqual(['failure', 'completed']);
    expect(output(node, 'error')).toBe('There is no open update to roll back');
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('timeout', () => {
  it('rolls back on its own when nothing answers', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted', { timeout: 5000 });
    signals.length = 0;

    jest.advanceTimersByTime(4999);
    expect(store.getKey('app', 'status')).toBe('accepted');
    expect(signals).toEqual([]);

    jest.advanceTimersByTime(1);

    // ⚠️ ERG-001 — **no `Completed`, and the exact `toEqual` is what proves it.** `Rolled Back`
    // is dual-route: the `Rollback` port and this timer both reach `finishRollback`. Only the
    // port owes an outcome, because a deadline firing is a genuinely later event that nobody
    // invoked — there is no invocation to complete. A `Completed` here would tell an author
    // "your action finished" about an action they never took.
    expect(signals).toEqual(['rolledBack', 'timedOut']);
    expect(store.getKey('app', 'status')).toBe('pending');
    expect(output(node, 'error')).toBe('Request timed out');
    expect(output(node, 'isRolledBack')).toBe(true);
    expect(output(node, 'pendingCount')).toBe(0);
    expect(store.getOpenPatches('app')).toEqual([]);
  });

  it('defaults to thirty seconds', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');
    applied(context, 'status', 'accepted');

    jest.advanceTimersByTime(29999);
    expect(store.getKey('app', 'status')).toBe('accepted');

    jest.advanceTimersByTime(1);
    expect(store.getKey('app', 'status')).toBe('pending');
  });

  it('leaves the update open forever when the deadline is zero', () => {
    const context = createContext();
    const { node, signals } = applied(context, 'status', 'accepted', { timeout: 0 });
    signals.length = 0;

    jest.advanceTimersByTime(10 * 60 * 1000);

    expect(signals).toEqual([]);
    expect(output(node, 'pendingCount')).toBe(1);
    expect(store.getKey('app', 'status')).toBe('accepted');
  });

  it('does not fire after a commit', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted', { timeout: 1000 });
    pulse(node, 'commit');
    signals.length = 0;

    jest.advanceTimersByTime(10000);

    expect(signals).toEqual([]);
    expect(store.getKey('app', 'status')).toBe('accepted');
  });

  it('turns a late commit into a reported no-op rather than a second resolution', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted', { timeout: 1000 });
    jest.advanceTimersByTime(1000);
    signals.length = 0;

    pulse(node, 'commit');

    // NDA-012: `Failure` is new. This node used to end a refusal on the `error` string
    // alone, so an author had a success signal to wire and nothing to sequence a failure
    // off. A rollback is deliberately not a `Failure` — it has `Rolled Back` already.
    //
    // ERG-001: `Completed` joins it. `failure` itself is unchanged — it already carried the
    // contract's name and exactly its meaning — but it is now fired through `reportOutcome`
    // rather than by hand, which is what also produces the `Completed` an author wires to
    // carry on regardless.
    expect(signals).toEqual(['failure', 'completed']);
    expect(output(node, 'error')).toBe('There is no open update to commit');
    expect(store.getKey('app', 'status')).toBe('pending');
  });

  it('gives each in-flight update its own deadline', () => {
    const context = createContext();
    const { node, signals } = applied(context, 'a', 1, { timeout: 1000, transactionId: 'first' });

    jest.advanceTimersByTime(500);
    node.setInputValue('transactionId', 'second');
    node.setInputValue('key', 'b');
    node.setInputValue('optimisticValue', 2);
    node.setInputValue('timeout', 1000);
    pulse(node, 'apply');
    signals.length = 0;

    jest.advanceTimersByTime(500);
    expect(store.hasKey('app', 'a')).toBe(false);
    expect(store.getKey('app', 'b')).toBe(2);

    jest.advanceTimersByTime(500);
    expect(store.hasKey('app', 'b')).toBe(false);
    expect(signals).toEqual(['rolledBack', 'timedOut', 'rolledBack', 'timedOut']);
  });
});

// ---------------------------------------------------------------------------
// Several updates in flight
// ---------------------------------------------------------------------------

describe('several updates in flight', () => {
  it('counts them, and resolves the oldest first when no id is given', () => {
    const context = createContext();
    const { node } = applied(context, 'a', 1, { timeout: 0 });

    node.setInputValue('key', 'b');
    node.setInputValue('optimisticValue', 2);
    pulse(node, 'apply');

    expect(output(node, 'pendingCount')).toBe(2);

    // No transaction id wired, so this resolves `a` — first in, first answered.
    pulse(node, 'rollback');
    expect(store.hasKey('app', 'a')).toBe(false);
    expect(store.getKey('app', 'b')).toBe(2);
    expect(output(node, 'pendingCount')).toBe(1);
  });

  it('resolves answers that arrive out of order by transaction id', () => {
    const context = createContext();
    const { node } = applied(context, 'a', 1, { timeout: 0, transactionId: 'first' });

    node.setInputValue('transactionId', 'second');
    node.setInputValue('key', 'b');
    node.setInputValue('optimisticValue', 2);
    pulse(node, 'apply');

    // The second request answers first, and succeeds.
    pulse(node, 'commit');
    expect(store.getKey('app', 'b')).toBe(2);
    expect(output(node, 'pendingCount')).toBe(1);

    // The first answers later, and fails.
    node.setInputValue('transactionId', 'first');
    pulse(node, 'rollback');
    expect(store.hasKey('app', 'a')).toBe(false);
    expect(store.getKey('app', 'b')).toBe(2);
    expect(output(node, 'pendingCount')).toBe(0);
  });

  it('keeps two nodes updating one key from clobbering each other on rollback', () => {
    const context = createContext();
    store.setKey('app', 'likes', 0);

    const first = applied(context, 'likes', 1, { timeout: 0 });
    const second = applied(context, 'likes', 2, { timeout: 0 });

    expect(store.getKey('app', 'likes')).toBe(2);

    // The older update fails. The newer one is still open and owns the key, so the live
    // value must not move — the store hands the older value to the newer patch instead.
    pulse(first.node, 'rollback');
    expect(store.getKey('app', 'likes')).toBe(2);
    expect(String(output(first.node, 'error'))).not.toContain('changed after');

    // When the newer one fails too, it lands on the value from before either of them.
    pulse(second.node, 'rollback');
    expect(store.getKey('app', 'likes')).toBe(0);
    expect(store.getOpenPatches('app')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A rollback racing a newer plain write
// ---------------------------------------------------------------------------

describe('a rollback racing a newer write', () => {
  it('leaves the newer value alone and says why', () => {
    const context = createContext();
    store.setKey('app', 'messages', ['a']);

    const { node, signals } = applied(context, 'messages', ['a', 'sending']);
    signals.length = 0;

    // A realtime push, another component, the user typing again — anything that is not a
    // patch. Restoring `['a']` here would throw this write away.
    store.setKey('app', 'messages', ['a', 'b']);

    pulse(node, 'rollback');

    expect(store.getKey('app', 'messages')).toEqual(['a', 'b']);
    // ⚠️ **This is where ERG-001's `Unchanged` lives on this node, and it is the contract's
    // headline discrimination.** `Rolled Back` fires whether or not the old value was actually
    // restored — compare the row above, which is the same signal for the opposite outcome — so
    // before this the only way to tell them apart was to poll the `error` string. That is
    // `Insert Object Into Array`'s defect verbatim, the one the contract opens with.
    //
    // The post-condition a rollback exists to establish is "the value this update wrote is no
    // longer in the store". Something newer had already replaced it, so it held before the
    // action ran and nothing needed doing.
    expect(signals).toEqual(['rolledBack', 'unchanged', 'completed']);
    expect(output(node, 'isRolledBack')).toBe(true);
    expect(String(output(node, 'error'))).toContain('changed after the update was applied');
    expect(store.getOpenPatches('app')).toEqual([]);
  });

  it('treats a deleted key as superseded too', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node } = applied(context, 'status', 'accepted');
    store.deleteKey('app', 'status');

    pulse(node, 'rollback');

    expect(store.hasKey('app', 'status')).toBe(false);
    expect(String(output(node, 'error'))).toContain('changed after');
  });

  it('applies the same rule to a timeout', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted', { timeout: 1000 });
    store.setKey('app', 'status', 'confirmed-elsewhere');
    signals.length = 0;

    jest.advanceTimersByTime(1000);

    expect(store.getKey('app', 'status')).toBe('confirmed-elsewhere');
    expect(signals).toEqual(['rolledBack', 'timedOut']);
    expect(String(output(node, 'error'))).toContain('Request timed out');
    expect(String(output(node, 'error'))).toContain('changed after');
  });

  it('still rolls back when the value was written back to what the update applied', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node } = applied(context, 'status', 'accepted');
    // An identical write is not a supersession: the value the update put there is still there.
    store.setKey('app', 'status', 'accepted', { force: true });

    pulse(node, 'rollback');

    expect(store.getKey('app', 'status')).toBe('pending');
    expect(output(node, 'error')).toBe('The update was rolled back');
  });
});

// ---------------------------------------------------------------------------
// Disposal
// ---------------------------------------------------------------------------

describe('disposal with an update still open', () => {
  it('rolls it back by default, and leaves nothing behind in the store', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted', { timeout: 1000 });
    signals.length = 0;

    (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();

    expect(store.getKey('app', 'status')).toBe('pending');
    expect(store.getOpenPatches('app')).toEqual([]);
    expect(store.subscriberCount('app')).toBe(0);
    // Nobody is left to hear a signal, and firing one on a dead node is how phantom graph
    // activity happens.
    expect(signals).toEqual([]);
  });

  it('keeps the value when the node is configured to', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node } = applied(context, 'status', 'accepted', { onDispose: 'commit' });
    (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();

    expect(store.getKey('app', 'status')).toBe('accepted');
    expect(store.getOpenPatches('app')).toEqual([]);
  });

  it('cancels the deadline, so no timer fires into a dead node', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node, signals } = applied(context, 'status', 'accepted', { onDispose: 'commit', timeout: 1000 });
    (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();
    signals.length = 0;

    jest.advanceTimersByTime(10000);

    expect(jest.getTimerCount()).toBe(0);
    expect(signals).toEqual([]);
    expect(store.getKey('app', 'status')).toBe('accepted');
  });

  it('resolves every open update, not just the first', () => {
    const context = createContext();
    const { node } = applied(context, 'a', 1, { timeout: 0, transactionId: 'first' });

    node.setInputValue('transactionId', 'second');
    node.setInputValue('key', 'b');
    node.setInputValue('optimisticValue', 2);
    pulse(node, 'apply');

    (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();

    expect(store.getState('app')).toEqual({});
    expect(store.getOpenPatches('app')).toEqual([]);
  });

  it('does not undo a value that moved on while the node was dying', () => {
    const context = createContext();
    store.setKey('app', 'status', 'pending');

    const { node } = applied(context, 'status', 'accepted');
    store.setKey('app', 'status', 'from-the-server');

    (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();

    expect(store.getKey('app', 'status')).toBe('from-the-server');
  });
});

// ---------------------------------------------------------------------------
// The value output
// ---------------------------------------------------------------------------

describe('the value output', () => {
  it('follows writes made by anything else', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.OptimisticUpdate');
    node.setInputValue('key', 'status');
    tick(node);

    store.setKey('app', 'status', 'from-elsewhere');

    expect(output(node, 'value')).toBe('from-elsewhere');
    expect(store.subscriberCount('app')).toBe(1);
  });

  it('moves its subscription when the key changes, without leaving one behind', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.OptimisticUpdate');

    node.setInputValue('key', 'a');
    tick(node);
    expect(store.subscriberCount('app')).toBe(1);

    node.setInputValue('key', 'b');
    tick(node);
    expect(store.subscriberCount('app')).toBe(1);

    node.setInputValue('storeName', 'other');
    tick(node);
    expect(store.subscriberCount('app')).toBe(0);
    expect(store.subscriberCount('other')).toBe(1);
  });

  it('subscribes once however many inputs arrive in one frame', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.OptimisticUpdate');

    node.setInputValue('storeName', 'app');
    node.setInputValue('key', 'a');
    tick(node);

    expect(store.subscriberCount('app')).toBe(1);
  });

  it('is undefined until a key is set, rather than throwing', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.OptimisticUpdate');
    tick(node);

    expect(output(node, 'value')).toBeUndefined();
    expect(store.getStoreNames()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// End to end, the way a graph would wire it
// ---------------------------------------------------------------------------

describe('end to end', () => {
  it('drives a Global Store node subscribed to the same key', () => {
    const context = createContext();
    const view = createNode(context, 'net.noodl.GlobalStore');
    view.node.setInputValue('storeName', 'app');
    tick(view.node);
    view.signals.length = 0;

    const update = applied(context, 'bookmarked', true, { timeout: 0 });
    expect(view.signals).toEqual(['stateChanged']);
    expect(output(view.node, 'state')).toEqual({ bookmarked: true });

    view.signals.length = 0;
    pulse(update.node, 'rollback');

    // The key is gone again, so every subscriber hears about it exactly once.
    expect(view.signals).toEqual(['stateChanged']);
    expect(output(view.node, 'state')).toEqual({});
    expect(output(view.node, 'changedKeys')).toBe('bookmarked');
  });

  it('survives an apply / commit cycle repeated many times without accumulating anything', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.OptimisticUpdate');
    node.setInputValue('key', 'count');
    node.setInputValue('timeout', 1000);

    for (let i = 1; i <= 50; i++) {
      node.setInputValue('optimisticValue', i);
      pulse(node, 'apply');
      pulse(node, 'commit');
    }

    expect(store.getKey('app', 'count')).toBe(50);
    expect(store.getOpenPatches('app')).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
    expect(store.subscriberCount('app')).toBe(1);
  });
});
