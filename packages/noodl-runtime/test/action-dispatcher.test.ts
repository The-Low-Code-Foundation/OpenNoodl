/**
 * AGENT-005 — the action dispatcher.
 *
 * This is the one node in AIX-005 where a remote server tells the client what to do, so
 * the tests that matter most are the ones about what it *refuses*. An action dispatcher
 * that executes an unregistered action name is a remote-control hole, and "we did not
 * implement that action" is not a defence — the question is whether the code path exists.
 * So: every refusal reason has a test, every refusal asserts that nothing was executed as
 * well as that something was reported, and the built-in store actions are checked against
 * a store the message did not get to choose.
 *
 * After that, the hard parts are ordering (a stream can deliver several actions in one
 * frame), an action arriving before the component that handles it has mounted, and
 * leaving nothing ticking when a node is deleted mid-flow.
 */

import type { NodeInstance } from '@noodl/types';

import {
  ActionContext,
  ActionDispatcher,
  ActionDispatcherOptions,
  ActionRegistry,
  ActionStore,
  actionRegistry,
  BUILT_IN_ACTIONS,
  builtInFieldOf,
  isBuiltInAction,
  payloadOf,
  RefusalInfo
} from '../src/nodes/std-library/agent/action-dispatcher';
import { globalStoreManager } from '../src/nodes/std-library/agent/globalstore';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import DispatcherNodeModule = require('../src/nodes/std-library/agent/actiondispatchernode');
import HandlerNodeModule = require('../src/nodes/std-library/agent/actionhandlernode');

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function defaultOptions(overrides: Partial<ActionDispatcherOptions> = {}): ActionDispatcherOptions {
  return Object.assign(
    {
      channel: 'default',
      storeName: 'app',
      builtIns: [] as string[],
      allowedKeys: [] as string[],
      handlerTimeout: 30000,
      waitForHandler: 0,
      maxQueueSize: 100,
      rateLimit: 0,
      rateLimitWindow: 60000
    },
    overrides
  );
}

/** Records every hook the dispatcher fires, in order, so ordering can be asserted on. */
function recorder() {
  const events: string[] = [];
  const refusals: RefusalInfo[] = [];
  const completed: { type: string; result: unknown }[] = [];
  const failed: { type: string; error: string }[] = [];

  return {
    events,
    refusals,
    completed,
    failed,
    hooks: {
      onDispatched: (info: { actionType: string }) => void events.push('dispatched:' + info.actionType),
      onCompleted: (info: { actionType: string; result: unknown }) => {
        events.push('completed:' + info.actionType);
        completed.push({ type: info.actionType, result: info.result });
      },
      onFailed: (info: { actionType: string; error: string }) => {
        events.push('failed:' + info.actionType);
        failed.push({ type: info.actionType, error: info.error });
      },
      onRefused: (info: RefusalInfo) => {
        events.push('refused:' + info.reason + ':' + info.actionType);
        refusals.push(info);
      },
      onIdle: () => void events.push('idle')
    }
  };
}

/** An {@link ActionStore} that records calls instead of touching the real store. */
function fakeStore() {
  const calls: string[] = [];
  const state: Record<string, unknown> = {};
  const store: ActionStore & { calls: string[]; state: Record<string, unknown>; throwOn?: string } = {
    calls,
    state,
    setKey(storeName, key, value, opts) {
      calls.push(`setKey:${storeName}:${key}`);
      if (store.throwOn === 'setKey') throw new Error('store exploded');
      state[key] = opts && opts.merge && typeof state[key] === 'object' ? Object.assign({}, state[key], value) : value;
    },
    setState(storeName, updates) {
      calls.push(`setState:${storeName}:${Object.keys(updates).join('+')}`);
      Object.assign(state, updates);
    },
    deleteKey(storeName, key) {
      calls.push(`deleteKey:${storeName}:${key}`);
      delete state[key];
    },
    clearStore(storeName) {
      calls.push(`clearStore:${storeName}`);
      for (const key of Object.keys(state)) delete state[key];
    }
  };
  return store;
}

/** A handler that completes immediately and records what it saw. */
function syncHandler(log: string[], name: string, result?: unknown) {
  return {
    invoke(context: { actionType: string; payload: unknown; complete(r?: unknown): void }) {
      log.push(name + ':' + context.actionType);
      context.complete(result);
    }
  };
}

/** A handler that holds the action open until the test releases it. */
function asyncHandler(log: string[], name: string) {
  const pending: { complete(r?: unknown): void; fail(m: string): void }[] = [];
  return {
    pending,
    handler: {
      invoke(context: { actionType: string; complete(r?: unknown): void; fail(m: string): void }) {
        log.push(name + ':' + context.actionType);
        pending.push(context);
      }
    },
    releaseNext(result?: unknown) {
      const next = pending.shift();
      if (next) next.complete(result);
    }
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  actionRegistry.reset();
  globalStoreManager.reset({ clearState: true });
});

// ===========================================================================
// The registry — this is the allow-list
// ===========================================================================

describe('ActionRegistry', () => {
  it('registers a handler and reports it as the channel vocabulary', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];

    registry.register('default', 'OPEN', syncHandler(log, 'a'));
    registry.register('default', 'CLOSE', syncHandler(log, 'b'));

    expect(registry.has('default', 'OPEN')).toBe(true);
    expect(registry.has('default', 'NOPE')).toBe(false);
    expect(registry.registeredTypes('default')).toEqual(['CLOSE', 'OPEN']);
    expect(registry.handlerCount('default')).toBe(2);
  });

  it('keeps channels apart', () => {
    const registry = new ActionRegistry();
    registry.register('a', 'OPEN', syncHandler([], 'x'));

    expect(registry.has('a', 'OPEN')).toBe(true);
    expect(registry.has('b', 'OPEN')).toBe(false);
  });

  it('treats a blank channel as "default"', () => {
    const registry = new ActionRegistry();
    registry.register('', 'OPEN', syncHandler([], 'x'));
    expect(registry.has('default', 'OPEN')).toBe(true);
  });

  it('refuses to let a handler claim a reserved built-in name', () => {
    const registry = new ActionRegistry();
    for (const name of BUILT_IN_ACTIONS) {
      expect(() => registry.register('default', name, syncHandler([], 'x'))).toThrow('reserved built-in');
    }
    expect(registry.handlerCount('default')).toBe(0);
  });

  it('refuses an empty action type', () => {
    const registry = new ActionRegistry();
    expect(() => registry.register('default', '', syncHandler([], 'x'))).toThrow('action type is required');
  });

  it('unregisters idempotently and leaves nothing behind', () => {
    const registry = new ActionRegistry();
    const off = registry.register('default', 'OPEN', syncHandler([], 'x'));

    off();
    off();

    expect(registry.handlerCount('default', 'OPEN')).toBe(0);
    expect(registry.channelNames()).toEqual([]);
  });

  it('tells a listener about a registration only once the handler is reachable', () => {
    const registry = new ActionRegistry();
    let visibleAtNotification = false;

    registry.onRegister('default', (type) => {
      visibleAtNotification = registry.has('default', type);
    });
    registry.register('default', 'OPEN', syncHandler([], 'x'));

    expect(visibleAtNotification).toBe(true);
  });
});

// ===========================================================================
// The closed vocabulary
// ===========================================================================

describe('the action vocabulary is closed', () => {
  it('refuses an action type nothing registered, and executes nothing', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions(), rec.hooks, { registry, store });

    dispatcher.dispatch({ type: 'DROP_TABLES' });

    expect(rec.refusals).toHaveLength(1);
    expect(rec.refusals[0].reason).toBe('unknown');
    expect(rec.refusals[0].actionType).toBe('DROP_TABLES');
    expect(rec.refusals[0].message).toContain('no handler is registered');
    expect(rec.events).not.toContain('dispatched:DROP_TABLES');
    expect(store.calls).toEqual([]);
  });

  it('refuses a built-in the author did not enable, and says so distinctly from "unknown"', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions(), rec.hooks, { registry, store });

    dispatcher.dispatch({ type: 'SET_STORE', key: 'a', value: 1 });

    expect(rec.refusals[0].reason).toBe('not-allowed');
    expect(rec.refusals[0].message).toContain('does not have it enabled');
    expect(store.calls).toEqual([]);
  });

  it('runs a built-in the author did enable', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ builtIns: ['SET_STORE'] }), rec.hooks, {
      registry,
      store
    });

    dispatcher.dispatch({ type: 'SET_STORE', key: 'view', value: 'agenda' });

    expect(store.state).toEqual({ view: 'agenda' });
    expect(rec.events).toEqual(['dispatched:SET_STORE', 'completed:SET_STORE', 'idle']);
    expect(rec.completed[0].result).toEqual({ storeName: 'app', key: 'view' });
  });

  it('ignores a store name the message tried to choose', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const dispatcher = new ActionDispatcher(
      defaultOptions({ builtIns: ['SET_STORE'], storeName: 'session' }),
      {},
      {
        registry,
        store
      }
    );

    dispatcher.dispatch({ type: 'SET_STORE', storeName: 'admin', key: 'role', value: 'root' });

    // The graph chose 'session'; the message's 'admin' had no effect.
    expect(store.calls).toEqual(['setKey:session:role']);
  });

  it('refuses a key outside the allow-list', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const rec = recorder();
    const dispatcher = new ActionDispatcher(
      defaultOptions({ builtIns: ['SET_STORE', 'DELETE_STORE_KEY'], allowedKeys: ['view'] }),
      rec.hooks,
      { registry, store }
    );

    dispatcher.dispatch({ type: 'SET_STORE', key: 'authToken', value: 'x' });
    dispatcher.dispatch({ type: 'DELETE_STORE_KEY', key: 'authToken' });
    dispatcher.dispatch({ type: 'SET_STORE', key: 'view', value: 'agenda' });

    expect(rec.refusals.map((r) => r.reason)).toEqual(['not-allowed', 'not-allowed']);
    expect(store.calls).toEqual(['setKey:app:view']);
  });

  it('refuses CLEAR_STORE whenever an allow-list is in force', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const rec = recorder();
    const dispatcher = new ActionDispatcher(
      defaultOptions({ builtIns: ['CLEAR_STORE'], allowedKeys: ['view'] }),
      rec.hooks,
      { registry, store }
    );

    dispatcher.dispatch({ type: 'CLEAR_STORE' });

    expect(rec.refusals[0].reason).toBe('not-allowed');
    expect(rec.refusals[0].message).toContain('outside them');
    expect(store.calls).toEqual([]);
  });

  it('deletes a store key — the primitive AGENT-003 had no node for', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    store.state.stale = 1;
    const dispatcher = new ActionDispatcher(
      defaultOptions({ builtIns: ['DELETE_STORE_KEY'] }),
      {},
      {
        registry,
        store
      }
    );

    dispatcher.dispatch({ type: 'DELETE_STORE_KEY', key: 'stale' });

    expect(store.state).toEqual({});
  });

  it('merges several keys in one action', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const dispatcher = new ActionDispatcher(defaultOptions({ builtIns: ['MERGE_STORE'] }), {}, { registry, store });

    dispatcher.dispatch({ type: 'MERGE_STORE', values: { a: 1, b: 2 } });

    expect(store.calls).toEqual(['setState:app:a+b']);
    expect(store.state).toEqual({ a: 1, b: 2 });
  });

  it('writes the real global store, including a delete', () => {
    const registry = new ActionRegistry();
    const dispatcher = new ActionDispatcher(
      defaultOptions({ builtIns: ['SET_STORE', 'DELETE_STORE_KEY'], storeName: 'app' }),
      {},
      { registry }
    );

    dispatcher.dispatch({ type: 'SET_STORE', key: 'view', value: 'agenda' });
    expect(globalStoreManager.getKey('app', 'view')).toBe('agenda');

    dispatcher.dispatch({ type: 'DELETE_STORE_KEY', key: 'view' });
    expect(globalStoreManager.hasKey('app', 'view')).toBe(false);
  });

  it('reports isBuiltInAction for exactly the four reserved names', () => {
    expect(BUILT_IN_ACTIONS.every(isBuiltInAction)).toBe(true);
    expect(isBuiltInAction('OPEN_VIEW')).toBe(false);
  });
});

// ===========================================================================
// Where a built-in reads its fields
//
// The integration pass found that the built-ins read `key`/`value`/`values` off the
// envelope only, while a handler's `payload` output resolves payload -> data -> the whole
// object. So the shape a server author writes first — and the shape a handler would have
// received — was refused as `invalid`. Both are accepted now; the envelope still wins.
// ===========================================================================

describe('a built-in reads its fields from the envelope or from the payload', () => {
  function make(options: Partial<ActionDispatcherOptions> = {}) {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const rec = recorder();
    return {
      store,
      rec,
      dispatcher: new ActionDispatcher(
        defaultOptions({ builtIns: [...BUILT_IN_ACTIONS], ...options }),
        rec.hooks,
        { registry, store }
      )
    };
  }

  it('accepts SET_STORE wrapped in a payload — the shape a server author writes first', () => {
    const { dispatcher, store, rec } = make();

    dispatcher.dispatch({ type: 'SET_STORE', payload: { key: 'title', value: 'x' } });

    expect(store.state).toEqual({ title: 'x' });
    expect(rec.refusals).toEqual([]);
    expect(rec.completed[0].result).toEqual({ storeName: 'app', key: 'title' });
  });

  it('accepts a payload under "data" too, exactly as payloadOf does', () => {
    const { dispatcher, store } = make();

    dispatcher.dispatch({ type: 'SET_STORE', data: { key: 'title', value: 'y' } });

    expect(store.state).toEqual({ title: 'y' });
  });

  it('still accepts the envelope form, and the envelope wins on a collision', () => {
    const { dispatcher, store } = make();

    dispatcher.dispatch({ type: 'SET_STORE', key: 'onEnvelope', value: 1, payload: { key: 'inPayload', value: 2 } });

    expect(store.calls).toEqual(['setKey:app:onEnvelope']);
    expect(store.state).toEqual({ onEnvelope: 1 });
  });

  it('reads a falsy value out of a payload rather than calling it absent', () => {
    const { dispatcher, store } = make();

    dispatcher.dispatch({ type: 'SET_STORE', payload: { key: 'count', value: 0 } });

    expect(store.state).toEqual({ count: 0 });
  });

  it('reads merge out of a payload as well', () => {
    const { dispatcher, store } = make();
    store.state.profile = { name: 'a' };

    dispatcher.dispatch({ type: 'SET_STORE', payload: { key: 'profile', value: { age: 2 }, merge: true } });

    // Merged, not replaced — so the flag was read from the payload and honoured.
    expect(store.state.profile).toEqual({ name: 'a', age: 2 });
  });

  it('accepts MERGE_STORE and DELETE_STORE_KEY wrapped in a payload', () => {
    const { dispatcher, store } = make();

    dispatcher.dispatch({ type: 'MERGE_STORE', payload: { values: { a: 1, b: 2 } } });
    expect(store.state).toEqual({ a: 1, b: 2 });

    dispatcher.dispatch({ type: 'DELETE_STORE_KEY', payload: { key: 'a' } });
    expect(store.state).toEqual({ b: 2 });
  });

  it('refuses a MERGE_STORE payload that is a bare key/value map, and says what it wanted', () => {
    // Deliberately *not* accepted: a payload of `{ values: {...} }` and a payload that
    // *is* the values are indistinguishable when a store key is itself called "values",
    // and a dispatcher may not guess about which keys a server gets to write.
    const { dispatcher, store, rec } = make();

    dispatcher.dispatch({ type: 'MERGE_STORE', payload: { a: 1, b: 2 } });

    expect(store.calls).toEqual([]);
    expect(rec.refusals[0].reason).toBe('invalid');
    expect(rec.refusals[0].message).toContain('requires a "values" object');
  });

  it('keeps every security property when the fields come from a payload', () => {
    // The store is the node's, not the message's.
    const scoped = make({ storeName: 'session' });
    scoped.dispatcher.dispatch({ type: 'SET_STORE', payload: { storeName: 'admin', key: 'role', value: 'root' } });
    expect(scoped.store.calls).toEqual(['setKey:session:role']);

    // allowedKeys still gates a key that arrived in a payload.
    const gated = make({ allowedKeys: ['view'] });
    gated.dispatcher.dispatch({ type: 'SET_STORE', payload: { key: 'authToken', value: 'x' } });
    expect(gated.store.calls).toEqual([]);
    expect(gated.rec.refusals[0].reason).toBe('not-allowed');

    // …and so does a whole set of merge keys.
    const gatedMerge = make({ allowedKeys: ['view'] });
    gatedMerge.dispatcher.dispatch({ type: 'MERGE_STORE', payload: { values: { view: 'a', authToken: 'x' } } });
    expect(gatedMerge.store.calls).toEqual([]);
    expect(gatedMerge.rec.refusals[0].reason).toBe('not-allowed');

    // CLEAR_STORE is still refused under an allow-list, payload or no payload.
    const cleared = make({ allowedKeys: ['view'] });
    cleared.dispatcher.dispatch({ type: 'CLEAR_STORE', payload: {} });
    expect(cleared.store.calls).toEqual([]);
    expect(cleared.rec.refusals[0].reason).toBe('not-allowed');
  });

  it('resolves a field the same way whether it is validated or executed', () => {
    // checkBuiltIn and runBuiltIn both call this, so the pure function is what makes it
    // impossible for the two to disagree about what an action said.
    expect(builtInFieldOf({ type: 'SET_STORE', key: 'a' }, 'key')).toBe('a');
    expect(builtInFieldOf({ type: 'SET_STORE', payload: { key: 'b' } }, 'key')).toBe('b');
    expect(builtInFieldOf({ type: 'SET_STORE', data: { key: 'c' } }, 'key')).toBe('c');
    expect(builtInFieldOf({ type: 'SET_STORE', key: 'a', payload: { key: 'b' } }, 'key')).toBe('a');
    expect(builtInFieldOf({ type: 'SET_STORE', payload: 'not a record' }, 'key')).toBeUndefined();
    expect(builtInFieldOf({ type: 'SET_STORE' }, 'key')).toBeUndefined();
    // With no payload at all, payloadOf returns the envelope — which must not make an
    // absent field resolve to something.
    expect(builtInFieldOf({ type: 'SET_STORE', value: 1 }, 'key')).toBeUndefined();
  });
});

// ===========================================================================
// Malformed input
// ===========================================================================

describe('malformed actions are refused, not guessed at', () => {
  function make() {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const rec = recorder();
    return {
      rec,
      store,
      dispatcher: new ActionDispatcher(defaultOptions({ builtIns: ['SET_STORE'] }), rec.hooks, { registry, store })
    };
  }

  it.each([
    ['nothing at all', undefined, 'no action was provided'],
    ['null', null, 'no action was provided'],
    ['an empty string', '   ', 'no action was provided'],
    ['unparseable JSON', '{nope', 'not valid JSON'],
    ['a bare number', 42, 'must be an object'],
    ['an object with no type', { key: 'a' }, 'non-empty string "type"'],
    ['an object with a non-string type', { type: 7 }, 'non-empty string "type"'],
    ['an empty array', [], 'array is empty']
  ])('refuses %s', (_label, value, expected) => {
    const { rec, store, dispatcher } = make();
    dispatcher.dispatch(value);

    expect(rec.refusals).toHaveLength(1);
    expect(rec.refusals[0].reason).toBe('invalid');
    expect(rec.refusals[0].message).toContain(expected as string);
    expect(store.calls).toEqual([]);
  });

  it('accepts an action as JSON text, which is what a raw stream frame is', () => {
    const { store, dispatcher } = make();
    dispatcher.dispatch('{"type":"SET_STORE","key":"a","value":1}');
    expect(store.state).toEqual({ a: 1 });
  });

  it('refuses only the bad member of an array and still runs the rest', () => {
    const { rec, store, dispatcher } = make();

    dispatcher.dispatch([
      { type: 'SET_STORE', key: 'a', value: 1 },
      { noType: true },
      { type: 'SET_STORE', key: 'b', value: 2 }
    ]);

    expect(store.state).toEqual({ a: 1, b: 2 });
    expect(rec.refusals).toHaveLength(1);
    expect(rec.refusals[0].reason).toBe('invalid');
  });

  it('refuses a built-in that is missing the field it needs', () => {
    const { rec, store, dispatcher } = make();
    dispatcher.dispatch({ type: 'SET_STORE', value: 1 });

    expect(rec.refusals[0].reason).toBe('invalid');
    expect(rec.refusals[0].message).toContain('requires a non-empty string "key"');
    expect(store.calls).toEqual([]);
  });
});

// ===========================================================================
// Ordering
// ===========================================================================

describe('ordering', () => {
  it('runs rapidly-arriving actions strictly in arrival order', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'STEP', {
      invoke(context: ActionContext) {
        log.push('step' + context.action.n);
        context.complete();
      }
    });

    const dispatcher = new ActionDispatcher(defaultOptions(), {}, { registry, store: fakeStore() });
    for (let n = 1; n <= 5; n++) dispatcher.dispatch({ type: 'STEP', n });

    expect(log).toEqual(['step1', 'step2', 'step3', 'step4', 'step5']);
  });

  it('runs an array of actions in order — the multi-step flow case', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    const log: string[] = [];
    registry.register('default', 'HIGHLIGHT', syncHandler(log, 'highlight'));

    const dispatcher = new ActionDispatcher(defaultOptions({ builtIns: ['SET_STORE'] }), {}, { registry, store });

    dispatcher.dispatch([
      { type: 'SET_STORE', key: 'view', value: 'timeline' },
      { type: 'HIGHLIGHT', elementId: 'session-123' },
      { type: 'SET_STORE', key: 'toast', value: 'here it is' }
    ]);

    expect(store.calls).toEqual(['setKey:app:view', 'setKey:app:toast']);
    expect(log).toEqual(['highlight:HIGHLIGHT']);
  });

  it('does not start the next action until an async handler completes', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    const slow = asyncHandler(log, 'slow');
    registry.register('default', 'STEP', slow.handler);

    const dispatcher = new ActionDispatcher(defaultOptions(), {}, { registry, store: fakeStore() });

    dispatcher.dispatch({ type: 'STEP', n: 1 });
    dispatcher.dispatch({ type: 'STEP', n: 2 });

    expect(log).toEqual(['slow:STEP']);
    expect(dispatcher.queueSize).toBe(1);
    expect(dispatcher.isExecuting).toBe(true);

    slow.releaseNext();
    expect(log).toEqual(['slow:STEP', 'slow:STEP']);
    expect(dispatcher.queueSize).toBe(0);
  });

  it('runs several handlers for one type in registration order, and completes once', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    const rec = recorder();
    registry.register('default', 'STEP', syncHandler(log, 'first'));
    registry.register('default', 'STEP', syncHandler(log, 'second', 'from-second'));

    const dispatcher = new ActionDispatcher(defaultOptions(), rec.hooks, { registry, store: fakeStore() });
    dispatcher.dispatch({ type: 'STEP' });

    expect(log).toEqual(['first:STEP', 'second:STEP']);
    expect(rec.events).toEqual(['dispatched:STEP', 'completed:STEP', 'idle']);
    expect(rec.completed[0].result).toBe('from-second');
  });

  it('does not recurse per action — a hundred synchronous actions stay flat', () => {
    const registry = new ActionRegistry();
    let deepest = 0;
    registry.register('default', 'STEP', {
      invoke(context: { complete(): void }) {
        const depth = (new Error().stack || '').split('\n').length;
        if (depth > deepest) deepest = depth;
        context.complete();
      }
    });

    const dispatcher = new ActionDispatcher(defaultOptions(), {}, { registry, store: fakeStore() });
    const first = { type: 'STEP' };
    dispatcher.dispatch(first);
    const baseline = deepest;

    deepest = 0;
    dispatcher.dispatch(Array.from({ length: 100 }, () => ({ type: 'STEP' })));

    // A recursive implementation would add a frame per action; a loop adds none.
    expect(deepest).toBeLessThanOrEqual(baseline + 4);
  });
});

// ===========================================================================
// Actions that arrive before their handler exists
// ===========================================================================

describe('an action that arrives before its handler', () => {
  it('waits for the handler and then runs, rather than being refused on a mount race', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ waitForHandler: 2000 }), rec.hooks, {
      registry,
      store: fakeStore()
    });

    dispatcher.dispatch({ type: 'OPEN_SESSION', sessionId: '123' });

    expect(rec.refusals).toEqual([]);
    expect(dispatcher.waitingFor).toBe('OPEN_SESSION');

    jest.advanceTimersByTime(500);
    registry.register('default', 'OPEN_SESSION', syncHandler(log, 'late'));

    expect(log).toEqual(['late:OPEN_SESSION']);
    expect(dispatcher.waitingFor).toBe('');
    expect(rec.events).toContain('completed:OPEN_SESSION');
  });

  it('refuses once the wait window expires, and says which type', () => {
    const registry = new ActionRegistry();
    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ waitForHandler: 2000 }), rec.hooks, {
      registry,
      store: fakeStore()
    });

    dispatcher.dispatch({ type: 'NEVER_HANDLED' });
    expect(rec.refusals).toEqual([]);

    jest.advanceTimersByTime(2000);

    expect(rec.refusals).toHaveLength(1);
    expect(rec.refusals[0].reason).toBe('unknown');
    expect(rec.refusals[0].actionType).toBe('NEVER_HANDLED');
    expect(dispatcher.waitingFor).toBe('');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('holds the actions behind it, because order is the promise', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'SECOND', syncHandler(log, 'second'));

    const dispatcher = new ActionDispatcher(
      defaultOptions({ waitForHandler: 2000 }),
      {},
      {
        registry,
        store: fakeStore()
      }
    );

    dispatcher.dispatch([{ type: 'FIRST' }, { type: 'SECOND' }]);

    expect(log).toEqual([]);
    expect(dispatcher.queueSize).toBe(1);

    registry.register('default', 'FIRST', syncHandler(log, 'first'));

    expect(log).toEqual(['first:FIRST', 'second:SECOND']);
  });

  it('refuses immediately when the wait window is zero', () => {
    const registry = new ActionRegistry();
    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ waitForHandler: 0 }), rec.hooks, {
      registry,
      store: fakeStore()
    });

    dispatcher.dispatch({ type: 'LATER' });

    expect(rec.refusals[0].reason).toBe('unknown');
    expect(jest.getTimerCount()).toBe(0);
  });
});

// ===========================================================================
// Bounds
// ===========================================================================

describe('bounds', () => {
  it('refuses the newest action when the queue is full, keeping what was accepted in order', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    const slow = asyncHandler(log, 'slow');
    registry.register('default', 'STEP', slow.handler);

    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ maxQueueSize: 2 }), rec.hooks, {
      registry,
      store: fakeStore()
    });

    // 1 goes in flight; 2 and 3 fill the queue; 4 is refused.
    for (let n = 1; n <= 4; n++) dispatcher.dispatch({ type: 'STEP', n });

    expect(dispatcher.queueSize).toBe(2);
    expect(rec.refusals).toHaveLength(1);
    expect(rec.refusals[0].reason).toBe('queue-full');
  });

  it('rate-limits rather than delays, and the window slides', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'STEP', syncHandler(log, 'step'));

    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ rateLimit: 2, rateLimitWindow: 1000 }), rec.hooks, {
      registry,
      store: fakeStore()
    });

    for (let n = 0; n < 4; n++) dispatcher.dispatch({ type: 'STEP' });

    expect(log).toHaveLength(2);
    expect(rec.refusals.map((r) => r.reason)).toEqual(['rate-limited', 'rate-limited']);

    jest.advanceTimersByTime(1001);
    dispatcher.dispatch({ type: 'STEP' });

    expect(log).toHaveLength(3);
  });

  it('is unbounded when the bound is zero', () => {
    const registry = new ActionRegistry();
    const slow = asyncHandler([], 'slow');
    registry.register('default', 'STEP', slow.handler);

    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ maxQueueSize: 0 }), rec.hooks, {
      registry,
      store: fakeStore()
    });

    for (let n = 0; n < 200; n++) dispatcher.dispatch({ type: 'STEP' });

    expect(dispatcher.queueSize).toBe(199);
    expect(rec.refusals).toEqual([]);
  });
});

// ===========================================================================
// Failure paths
// ===========================================================================

describe('failure paths', () => {
  it('fails an action whose handler never completes, and carries on with the queue', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'SLOW', asyncHandler(log, 'slow').handler);
    registry.register('default', 'FAST', syncHandler(log, 'fast'));

    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ handlerTimeout: 5000 }), rec.hooks, {
      registry,
      store: fakeStore()
    });

    dispatcher.dispatch([{ type: 'SLOW' }, { type: 'FAST' }]);
    expect(log).toEqual(['slow:SLOW']);

    jest.advanceTimersByTime(5000);

    expect(rec.failed[0].error).toContain('did not complete within 5000ms');
    expect(log).toEqual(['slow:SLOW', 'fast:FAST']);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('waits forever when the timeout is zero, without leaving a timer', () => {
    const registry = new ActionRegistry();
    registry.register('default', 'SLOW', asyncHandler([], 'slow').handler);

    const dispatcher = new ActionDispatcher(
      defaultOptions({ handlerTimeout: 0 }),
      {},
      {
        registry,
        store: fakeStore()
      }
    );
    dispatcher.dispatch({ type: 'SLOW' });

    expect(jest.getTimerCount()).toBe(0);
    expect(dispatcher.isExecuting).toBe(true);
  });

  it('fails an action whose handler throws, and the next one still runs', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'BOOM', {
      invoke() {
        throw new Error('handler blew up');
      }
    });
    registry.register('default', 'FINE', syncHandler(log, 'fine'));

    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions(), rec.hooks, { registry, store: fakeStore() });

    dispatcher.dispatch([{ type: 'BOOM' }, { type: 'FINE' }]);

    expect(rec.failed[0].error).toBe('handler blew up');
    expect(log).toEqual(['fine:FINE']);
  });

  it('fails an action a handler explicitly rejected', () => {
    const registry = new ActionRegistry();
    registry.register('default', 'NOPE', {
      invoke(context: { fail(m: string): void }) {
        context.fail('the session no longer exists');
      }
    });

    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions(), rec.hooks, { registry, store: fakeStore() });
    dispatcher.dispatch({ type: 'NOPE' });

    expect(rec.failed).toEqual([{ type: 'NOPE', error: 'the session no longer exists' }]);
  });

  it('does not run later handlers of the same type once one has failed', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'STEP', {
      invoke(context: { fail(m: string): void }) {
        log.push('first');
        context.fail('no');
      }
    });
    registry.register('default', 'STEP', syncHandler(log, 'second'));

    const dispatcher = new ActionDispatcher(defaultOptions(), {}, { registry, store: fakeStore() });
    dispatcher.dispatch({ type: 'STEP' });

    expect(log).toEqual(['first']);
  });

  it('surfaces a store failure as a failed action, not a refusal', () => {
    const registry = new ActionRegistry();
    const store = fakeStore();
    store.throwOn = 'setKey';
    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions({ builtIns: ['SET_STORE'] }), rec.hooks, {
      registry,
      store
    });

    dispatcher.dispatch({ type: 'SET_STORE', key: 'a', value: 1 });

    expect(rec.refusals).toEqual([]);
    expect(rec.failed[0].error).toBe('store exploded');
  });

  it('ignores a second completion from the same handler', () => {
    const registry = new ActionRegistry();
    registry.register('default', 'STEP', {
      invoke(context: { complete(r?: unknown): void; fail(m: string): void }) {
        context.complete('first');
        context.complete('second');
        context.fail('too late');
      }
    });

    const rec = recorder();
    const dispatcher = new ActionDispatcher(defaultOptions(), rec.hooks, { registry, store: fakeStore() });
    dispatcher.dispatch({ type: 'STEP' });

    expect(rec.events).toEqual(['dispatched:STEP', 'completed:STEP', 'idle']);
    expect(rec.completed[0].result).toBe('first');
  });

  it('keeps going when a hook throws — a broken output must not stop the queue', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'STEP', syncHandler(log, 'step'));

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dispatcher = new ActionDispatcher(
      defaultOptions(),
      {
        onDispatched() {
          throw new Error('the graph exploded');
        }
      },
      { registry, store: fakeStore() }
    );

    dispatcher.dispatch([{ type: 'STEP' }, { type: 'STEP' }]);

    expect(log).toEqual(['step:STEP', 'step:STEP']);
    spy.mockRestore();
  });
});

// ===========================================================================
// Disposal
// ===========================================================================

describe('disposal and cancellation', () => {
  it('discards queued actions on dispose and leaves no timer or listener behind', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    registry.register('default', 'SLOW', asyncHandler(log, 'slow').handler);

    const dispatcher = new ActionDispatcher(
      defaultOptions({ handlerTimeout: 5000 }),
      {},
      {
        registry,
        store: fakeStore()
      }
    );
    dispatcher.dispatch([{ type: 'SLOW' }, { type: 'SLOW' }, { type: 'SLOW' }]);

    expect(jest.getTimerCount()).toBe(1);

    const dropped = dispatcher.dispose();

    expect(dropped).toBe(3);
    expect(dispatcher.queueSize).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(dispatcher.isDisposed).toBe(true);

    // Nothing runs afterwards, and nothing is reported to a node that is gone.
    dispatcher.dispatch({ type: 'SLOW' });
    expect(log).toEqual(['slow:SLOW']);
  });

  it('drops a parked action and its registry listener on dispose', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    const dispatcher = new ActionDispatcher(
      defaultOptions({ waitForHandler: 2000 }),
      {},
      {
        registry,
        store: fakeStore()
      }
    );

    dispatcher.dispatch({ type: 'LATE' });
    expect(dispatcher.waitingFor).toBe('LATE');

    dispatcher.dispose();

    expect(jest.getTimerCount()).toBe(0);
    registry.register('default', 'LATE', syncHandler(log, 'late'));
    expect(log).toEqual([]);
  });

  it('reports how many actions a cancel discarded, and stays usable', () => {
    const registry = new ActionRegistry();
    const log: string[] = [];
    const slow = asyncHandler(log, 'slow');
    registry.register('default', 'STEP', slow.handler);

    const dispatcher = new ActionDispatcher(defaultOptions(), {}, { registry, store: fakeStore() });
    dispatcher.dispatch([{ type: 'STEP' }, { type: 'STEP' }, { type: 'STEP' }]);

    expect(dispatcher.cancelAll()).toBe(3);
    expect(dispatcher.queueSize).toBe(0);
    expect(dispatcher.isExecuting).toBe(false);

    // The abandoned handler completing later must not resurrect anything.
    slow.releaseNext();
    expect(dispatcher.queueSize).toBe(0);

    dispatcher.dispatch({ type: 'STEP' });
    expect(dispatcher.isExecuting).toBe(true);
  });
});

// ===========================================================================
// payloadOf
// ===========================================================================

describe('payloadOf', () => {
  it('prefers an explicit payload, then data, then the action itself', () => {
    expect(payloadOf({ type: 'X', payload: { a: 1 }, data: { b: 2 } })).toEqual({ a: 1 });
    expect(payloadOf({ type: 'X', data: { b: 2 } })).toEqual({ b: 2 });
    expect(payloadOf({ type: 'X', sessionId: '1' })).toEqual({ type: 'X', sessionId: '1' });
  });

  it('treats a falsy payload as present — the spec\'s "data || action" did not', () => {
    expect(payloadOf({ type: 'X', payload: 0 })).toBe(0);
    expect(payloadOf({ type: 'X', data: '' })).toBe('');
    expect(payloadOf({ type: 'X', payload: null })).toBe(null);
  });
});

// ===========================================================================
// The nodes
// ===========================================================================

interface Probe {
  node: NodeInstance;
  signals: string[];
  out(name: string): unknown;
  pulse(name: string): void;
}

let nextNodeId = 0;

function createContext() {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(DispatcherNodeModule.node));
  context.nodeRegister.register(NodeDefinition.defineNode(HandlerNodeModule.node));
  return context;
}

function createNode(context: InstanceType<typeof NodeContext>, type: string): Probe {
  const node = context.nodeRegister.createNode(type, 'node-' + ++nextNodeId) as NodeInstance;
  const signals: string[] = [];
  const original = node.sendSignalOnOutput.bind(node);
  node.sendSignalOnOutput = (name: string) => {
    signals.push(name);
    original(name);
  };
  return {
    node,
    signals,
    out: (name: string) => node.getOutput(name).value,
    pulse: (name: string) => {
      node.setInputValue(name, false);
      node.setInputValue(name, true);
    }
  };
}

describe('net.noodl.ActionDispatcher (node)', () => {
  it('declares the documented ports', () => {
    const context = createContext();
    createNode(context, 'net.noodl.ActionDispatcher');
    const metadata = context.nodeRegister.getNodeMetadata('net.noodl.ActionDispatcher');

    expect(Object.keys(metadata.inputs).sort()).toEqual(
      [
        'action',
        'allowedKeys',
        'builtIns',
        'cancel',
        'channel',
        'dispatch',
        'handlerTimeout',
        'maxQueueSize',
        'rateLimit',
        'rateLimitWindow',
        'storeName',
        'waitForHandler'
      ].sort()
    );
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      [
        'actionId',
        'actionType',
        'cancelled',
        'cancelledCount',
        'completed',
        'completedCount',
        'dispatched',
        'failed',
        'failedCount',
        'idle',
        'isExecuting',
        'lastError',
        'payload',
        'queueSize',
        'refusalMessage',
        'refusalReason',
        'refused',
        'refusedCount',
        'refusedType',
        'result',
        'waitingFor'
      ].sort()
    );
  });

  it('executes an enabled built-in against the real store', () => {
    const context = createContext();
    const { node, signals, out } = createNode(context, 'net.noodl.ActionDispatcher');

    node.setInputValue('builtIns', 'SET_STORE');
    node.setInputValue('storeName', 'app');
    node.setInputValue('action', { type: 'SET_STORE', key: 'view', value: 'agenda' });
    node.setInputValue('dispatch', true);
    node.update();

    expect(globalStoreManager.getKey('app', 'view')).toBe('agenda');
    expect(signals).toEqual(['dispatched', 'completed', 'idle']);
    expect(out('actionType')).toBe('SET_STORE');
    expect(out('completedCount')).toBe(1);
    expect(out('isExecuting')).toBe(false);
  });

  it('surfaces a refusal on its outputs and executes nothing', () => {
    const context = createContext();
    const { node, signals, out } = createNode(context, 'net.noodl.ActionDispatcher');

    node.setInputValue('waitForHandler', 0);
    node.setInputValue('action', { type: 'SET_STORE', key: 'view', value: 'agenda' });
    node.setInputValue('dispatch', true);
    node.update();

    expect(globalStoreManager.hasKey('app', 'view')).toBe(false);
    expect(signals).toContain('refused');
    expect(signals).not.toContain('dispatched');
    expect(out('refusedType')).toBe('SET_STORE');
    expect(out('refusalReason')).toBe('not-allowed');
    expect(String(out('refusalMessage'))).toContain('does not have it enabled');
    expect(out('refusedCount')).toBe(1);
  });

  it('reports a misspelt built-in name instead of quietly enabling nothing', () => {
    const context = createContext();
    const { node, out } = createNode(context, 'net.noodl.ActionDispatcher');

    node.setInputValue('builtIns', 'SET_STORE, SET_STOR');
    node.update();

    expect(String(out('lastError'))).toContain('SET_STOR');
  });

  it('does not coalesce two actions that arrive in the same frame', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.ActionDispatcher');

    node.setInputValue('builtIns', 'SET_STORE');

    // Exactly what a stream does: value, signal, value, signal, all before any update().
    node.setInputValue('action', { type: 'SET_STORE', key: 'a', value: 1 });
    node.setInputValue('dispatch', true);
    node.setInputValue('dispatch', false);
    node.setInputValue('action', { type: 'SET_STORE', key: 'b', value: 2 });
    node.setInputValue('dispatch', true);
    node.update();

    expect(globalStoreManager.getState('app')).toEqual({ a: 1, b: 2 });
  });

  it('cancels the queue and says how many it dropped', () => {
    const context = createContext();
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');

    handlerProbe.node.setInputValue('actionType', 'STEP');
    handlerProbe.node.setInputValue('autoComplete', false);
    handlerProbe.node.update();

    dispatcherProbe.node.setInputValue('action', [{ type: 'STEP' }, { type: 'STEP' }, { type: 'STEP' }]);
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(dispatcherProbe.out('queueSize')).toBe(2);

    dispatcherProbe.pulse('cancel');
    dispatcherProbe.node.update();

    expect(dispatcherProbe.out('cancelledCount')).toBe(3);
    expect(dispatcherProbe.out('queueSize')).toBe(0);
    expect(dispatcherProbe.signals).toContain('cancelled');
  });

  it('leaves no timer running when the node is deleted mid-flow', () => {
    const context = createContext();
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');

    handlerProbe.node.setInputValue('actionType', 'STEP');
    handlerProbe.node.setInputValue('autoComplete', false);
    handlerProbe.node.update();

    dispatcherProbe.node.setInputValue('handlerTimeout', 5000);
    dispatcherProbe.node.setInputValue('action', [{ type: 'STEP' }, { type: 'STEP' }]);
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(jest.getTimerCount()).toBe(1);

    (dispatcherProbe.node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();

    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('net.noodl.ActionHandler (node)', () => {
  it('declares the documented ports', () => {
    const context = createContext();
    createNode(context, 'net.noodl.ActionHandler');
    const metadata = context.nodeRegister.getNodeMetadata('net.noodl.ActionHandler');

    expect(Object.keys(metadata.inputs).sort()).toEqual(
      ['actionType', 'autoComplete', 'channel', 'complete', 'enabled', 'errorMessage', 'fail', 'result'].sort()
    );
    expect(Object.keys(metadata.outputs).sort()).toEqual(
      ['actionId', 'error', 'payload', 'registered', 'trigger', 'triggeredCount'].sort()
    );
  });

  it('registers itself, and that registration is what makes the action executable', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');

    handlerProbe.node.setInputValue('actionType', 'OPEN_SESSION');
    handlerProbe.node.update();

    expect(handlerProbe.out('registered')).toBe(true);
    expect(actionRegistry.registeredTypes('default')).toEqual(['OPEN_SESSION']);

    dispatcherProbe.node.setInputValue('action', { type: 'OPEN_SESSION', sessionId: '123' });
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(handlerProbe.signals).toContain('trigger');
    expect(handlerProbe.out('payload')).toEqual({ type: 'OPEN_SESSION', sessionId: '123' });
    expect(handlerProbe.out('triggeredCount')).toBe(1);
    expect(dispatcherProbe.signals).toContain('completed');
  });

  it('refuses to claim a reserved built-in name, loudly', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');

    handlerProbe.node.setInputValue('actionType', 'SET_STORE');
    handlerProbe.node.update();

    expect(handlerProbe.out('registered')).toBe(false);
    expect(String(handlerProbe.out('error'))).toContain('reserved built-in');
    expect(actionRegistry.handlerCount('default')).toBe(0);
  });

  it('reports a missing action type rather than registering nothing quietly', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');

    handlerProbe.node.setInputValue('channel', 'default');
    handlerProbe.node.update();

    expect(handlerProbe.out('error')).toBe('An action type is required');
    expect(handlerProbe.out('registered')).toBe(false);
  });

  it('moves its registration when the type changes, without leaving one behind', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');

    handlerProbe.node.setInputValue('actionType', 'FIRST');
    handlerProbe.node.update();
    expect(actionRegistry.registeredTypes('default')).toEqual(['FIRST']);

    handlerProbe.node.setInputValue('actionType', 'SECOND');
    handlerProbe.node.update();

    expect(actionRegistry.registeredTypes('default')).toEqual(['SECOND']);
    expect(actionRegistry.handlerCount('default')).toBe(1);
  });

  it('unregisters when disabled, so the action is refused rather than ignored', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');

    handlerProbe.node.setInputValue('actionType', 'OPEN');
    handlerProbe.node.update();
    handlerProbe.node.setInputValue('enabled', false);
    handlerProbe.node.update();

    expect(handlerProbe.out('registered')).toBe(false);
    expect(actionRegistry.handlerCount('default')).toBe(0);

    dispatcherProbe.node.setInputValue('waitForHandler', 0);
    dispatcherProbe.node.setInputValue('action', { type: 'OPEN' });
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(dispatcherProbe.out('refusalReason')).toBe('unknown');
    expect(handlerProbe.signals).not.toContain('trigger');
  });

  it('gates the next step when Auto Complete is off', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');

    handlerProbe.node.setInputValue('actionType', 'STEP');
    handlerProbe.node.setInputValue('autoComplete', false);
    handlerProbe.node.setInputValue('result', 'done');
    handlerProbe.node.update();

    dispatcherProbe.node.setInputValue('action', [{ type: 'STEP' }, { type: 'STEP' }]);
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(handlerProbe.out('triggeredCount')).toBe(1);
    expect(dispatcherProbe.out('queueSize')).toBe(1);

    handlerProbe.pulse('complete');
    handlerProbe.node.update();

    expect(handlerProbe.out('triggeredCount')).toBe(2);
    expect(dispatcherProbe.out('result')).toBe('done');
  });

  it('fails the action when the handler signals Fail', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');

    handlerProbe.node.setInputValue('actionType', 'STEP');
    handlerProbe.node.setInputValue('autoComplete', false);
    handlerProbe.node.setInputValue('errorMessage', 'the session is gone');
    handlerProbe.node.update();

    dispatcherProbe.node.setInputValue('action', { type: 'STEP' });
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    handlerProbe.pulse('fail');
    handlerProbe.node.update();

    expect(dispatcherProbe.signals).toContain('failed');
    expect(dispatcherProbe.out('lastError')).toBe('the session is gone');
    expect(dispatcherProbe.out('failedCount')).toBe(1);
  });

  it('reports a Complete signal that had no action in flight', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');

    handlerProbe.node.setInputValue('actionType', 'STEP');
    handlerProbe.node.update();
    handlerProbe.pulse('complete');
    handlerProbe.node.update();

    expect(handlerProbe.out('error')).toBe('Complete was signalled with no action in flight');
  });

  it('fails the in-flight action when the handler node is deleted, freeing the queue', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');
    const otherProbe = createNode(context, 'net.noodl.ActionHandler');
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');

    handlerProbe.node.setInputValue('actionType', 'STEP');
    handlerProbe.node.setInputValue('autoComplete', false);
    handlerProbe.node.update();

    otherProbe.node.setInputValue('actionType', 'NEXT');
    otherProbe.node.update();

    dispatcherProbe.node.setInputValue('action', [{ type: 'STEP' }, { type: 'NEXT' }]);
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(dispatcherProbe.out('queueSize')).toBe(1);

    (handlerProbe.node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();

    expect(dispatcherProbe.out('failedCount')).toBe(1);
    expect(String(dispatcherProbe.out('lastError'))).toContain('was removed before it completed');
    expect(otherProbe.signals).toContain('trigger');
    expect(actionRegistry.handlerCount('default', 'STEP')).toBe(0);
  });

  it('lets a handler that mounts late still receive an action already waiting', () => {
    const context = createContext();
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');

    dispatcherProbe.node.setInputValue('waitForHandler', 2000);
    dispatcherProbe.node.setInputValue('action', { type: 'OPEN_SESSION', sessionId: '9' });
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(dispatcherProbe.out('waitingFor')).toBe('OPEN_SESSION');

    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');
    handlerProbe.node.setInputValue('actionType', 'OPEN_SESSION');
    handlerProbe.node.update();

    expect(handlerProbe.signals).toContain('trigger');
    expect(dispatcherProbe.out('waitingFor')).toBe('');
    expect(dispatcherProbe.out('completedCount')).toBe(1);
  });

  it('keeps two channels from reaching each other', () => {
    const context = createContext();
    const handlerProbe = createNode(context, 'net.noodl.ActionHandler');
    const dispatcherProbe = createNode(context, 'net.noodl.ActionDispatcher');

    handlerProbe.node.setInputValue('channel', 'agent');
    handlerProbe.node.setInputValue('actionType', 'OPEN');
    handlerProbe.node.update();

    dispatcherProbe.node.setInputValue('channel', 'other');
    dispatcherProbe.node.setInputValue('waitForHandler', 0);
    dispatcherProbe.node.setInputValue('action', { type: 'OPEN' });
    dispatcherProbe.node.setInputValue('dispatch', true);
    dispatcherProbe.node.update();

    expect(handlerProbe.signals).not.toContain('trigger');
    expect(dispatcherProbe.out('refusalReason')).toBe('unknown');
  });
});
