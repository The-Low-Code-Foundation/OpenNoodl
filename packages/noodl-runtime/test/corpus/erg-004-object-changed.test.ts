/**
 * ERG-004 §1 — `Object Changed`.
 *
 * ⚠️ **Why these rows connect a receiver instead of reading output values.**
 *
 * Phase 30's most-repeated defect (FINDINGS `NV-ii`) is a signal sent before the values it
 * describes. Polling `getOutput(name).value` after the fact cannot see it — the value is
 * correct by the time the assertion runs either way. What sees it is a *downstream node*,
 * because that is the only thing that observes the value **at the moment the signal arrives**.
 * `node-signal-value-pairing.test.ts` established the shape; this file reuses it.
 *
 * ⚠️ **And why every class is driven twice.** NV-ii's second half: whether the defect is visible
 * depends on whether the paired value port held a non-`undefined` value at connect time. A row
 * that fires once can pass against a node that sends its signal first, because on the very
 * first pass "the previous value" and "no value at all" are indistinguishable. So each class
 * below drives two events and asserts on both observations, not just the last.
 *
 * ⚠️ **These rows live in `noodl-runtime` although the node lives in `noodl-viewer-react`.**
 * `helpers/node-harness.ts` is native here and `noodl-viewer-react`'s tsconfig compiles at
 * `module: es6` with `tests` excluded. The corpus already crosses this boundary in the other
 * direction (the viewer's files import `graph-harness` from here), and the node module imports
 * nothing but `@noodl/types`, so it compiles cleanly in this program.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createGraph, type TestGraph, type TestNode } from '../helpers/node-harness';

import Model = require('../../src/model');

/* eslint-disable @typescript-eslint/no-var-requires */
const ObjectChangedModule = require('../../../noodl-viewer-react/src/nodes/std-library/objectchanged').default;
/* eslint-enable @typescript-eslint/no-var-requires */

const OBJECT_CHANGED = 'net.noodl.ObjectChanged';

/** What a downstream node saw when one signal arrived. */
interface Observation {
  signal: string;
  key: unknown;
  value: unknown;
  previousValue: unknown;
}

/**
 * A node that records the three value ports **as they stood when each signal fired**.
 *
 * Deliberately minimal: it exists to be the graph's witness, not to model anything.
 */
function recorderModule(observations: Observation[]) {
  function record(signal: string) {
    return function (this: NodeInstance) {
      observations.push({
        signal,
        key: this._internal.key,
        value: this._internal.value,
        previousValue: this._internal.previousValue
      });
    };
  }

  return {
    node: {
      name: 'test.ChangeRecorder',
      category: 'Test',
      initialize: function (this: NodeInstance) {
        this._internal.key = undefined;
        this._internal.value = undefined;
        this._internal.previousValue = undefined;
      },
      inputs: {
        key: {
          type: '*',
          set: function (this: NodeInstance, v: unknown) {
            this._internal.key = v;
          }
        },
        value: {
          type: '*',
          set: function (this: NodeInstance, v: unknown) {
            this._internal.value = v;
          }
        },
        previousValue: {
          type: '*',
          set: function (this: NodeInstance, v: unknown) {
            this._internal.previousValue = v;
          }
        },
        onKeyAdded: { valueChangedToTrue: record('keyAdded') },
        onKeyChanged: { valueChangedToTrue: record('keyChanged') },
        onObjectReplaced: { valueChangedToTrue: record('objectReplaced') }
      }
    }
  };
}

interface Probe {
  graph: TestGraph;
  node: TestNode;
  /** Everything the downstream node has witnessed, in order. */
  seen: Observation[];
  /** Sends a new Object to the input port. */
  watch(value: unknown): void;
  /** Drains the queues, which is what a frame boundary does. */
  settle(): void;
  /** Signal names the node itself sent, in order. */
  signals: string[];
  destroy(): void;
}

function makeProbe(): Probe {
  const seen: Observation[] = [];
  const graph = createGraph(ObjectChangedModule, recorderModule(seen));

  const node = graph.make(OBJECT_CHANGED, 'oc');
  const recorder = graph.make('test.ChangeRecorder', 'rec');

  recorder.connectInput('key', node, 'key');
  recorder.connectInput('value', node, 'value');
  recorder.connectInput('previousValue', node, 'previousValue');
  recorder.connectInput('onKeyAdded', node, 'keyAdded');
  recorder.connectInput('onKeyChanged', node, 'keyChanged');
  recorder.connectInput('onObjectReplaced', node, 'objectReplaced');

  return {
    graph,
    node,
    seen,
    watch: (value: unknown) => node.setInputValue('object', value),
    settle: () => recorder.update(),
    signals: graph.signalsFor('oc'),
    destroy: () => node._onNodeDeleted()
  };
}

/** How many `change` listeners a Model is carrying. */
function listenerCount(model: unknown): number {
  const listeners = (model as { listeners?: Record<string, unknown[]> }).listeners;
  if (!listeners || !listeners.change) return 0;
  return listeners.change.length;
}

// ---------------------------------------------------------------------------
// OC-1 — the three classes, each driven twice.
// ---------------------------------------------------------------------------

describe('OC-1 — Key Added, driven twice', () => {
  it('reports the key and both values, on the first added key and on the second', () => {
    const p = makeProbe();
    const object = Model.create();
    p.watch(object);
    p.settle();
    p.seen.length = 0; // the Object Replaced for the initial arrival is OC-3's business

    object.set('name', 'Ada');
    p.settle();
    object.set('city', 'London');
    p.settle();

    // Both observations, not just the last: a node that signals before it flags its outputs
    // passes an assertion on the final state and fails here on the first row.
    expect(p.seen).toEqual([
      { signal: 'keyAdded', key: 'name', value: 'Ada', previousValue: null },
      { signal: 'keyAdded', key: 'city', value: 'London', previousValue: null }
    ]);
  });
});

describe('OC-2 — Key Changed, driven twice', () => {
  it('reports the old value beside the new one, on both changes', () => {
    const p = makeProbe();
    const object = Model.create();
    p.watch(object);
    object.set('name', 'Ada');
    p.settle();
    p.seen.length = 0;

    object.set('name', 'Grace');
    p.settle();
    object.set('name', 'Katherine');
    p.settle();

    expect(p.seen).toEqual([
      { signal: 'keyChanged', key: 'name', value: 'Grace', previousValue: 'Ada' },
      { signal: 'keyChanged', key: 'name', value: 'Katherine', previousValue: 'Grace' }
    ]);
  });

  it('a write of the value the key already holds reports nothing', () => {
    const p = makeProbe();
    const object = Model.create();
    p.watch(object);
    object.set('name', 'Ada');
    p.settle();
    p.seen.length = 0;

    object.set('name', 'Ada');
    p.settle();

    expect(p.seen).toEqual([]);
  });
});

describe('OC-3 — Object Replaced, driven twice', () => {
  it('fires for each different Object, carrying the Objects themselves', () => {
    const p = makeProbe();
    const first = Model.create();
    const second = Model.create();

    p.watch(first);
    p.settle();
    p.watch(second);
    p.settle();

    expect(p.seen).toEqual([
      // The first Object to arrive is a replacement too — the same call `Value Changed`
      // makes, and for the same reason.
      { signal: 'objectReplaced', key: null, value: first, previousValue: null },
      { signal: 'objectReplaced', key: null, value: second, previousValue: first }
    ]);
  });

  it('re-sending the same Object reports nothing', () => {
    const p = makeProbe();
    const object = Model.create();

    p.watch(object);
    p.settle();
    p.seen.length = 0;

    p.watch(object);
    p.settle();

    expect(p.seen).toEqual([]);
  });

  it('Key is cleared by a replacement rather than left stale from the last key change', () => {
    const p = makeProbe();
    const first = Model.create();
    first.set('name', 'Ada');
    p.watch(first);
    first.set('name', 'Grace');
    p.settle();
    p.seen.length = 0;

    p.watch(Model.create());
    p.settle();

    expect(p.seen.length).toBe(1);
    expect(p.seen[0].signal).toBe('objectReplaced');
    // Not 'name'. A stale key beside a fresh signal is the defect this node exists to avoid.
    expect(p.seen[0].key).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// OC-3b — the ordering hazard this file found, pinned on its own.
// ---------------------------------------------------------------------------

describe('OC-3b — a value port never emits undefined, so its queue key exists from the first send', () => {
  /**
   * ⚠️ The row that justifies "drive it twice", and the one that found a general runtime
   * hazard rather than a defect in this node.
   *
   * `Node.prototype.sendValue` returns early on `undefined` (`node.ts:706`), so a port whose
   * first emit is `undefined` queues nothing. The receiver drains with
   * `Object.keys(this._inputValuesQueue)` (`node.ts:566`) — **insertion order**, and each key
   * is created on that port's first delivery. So a value port that was `undefined` first time
   * has its key created *after* the signal that did fire, and is delivered after that signal
   * from then on.
   *
   * `Previous Value` is `undefined` on the very first `Object Replaced` and meaningful on the
   * second. Before the fix, the second observation carried `undefined` — the signal arrived
   * ahead of the value. A row driving the node once sees nothing wrong.
   */
  it('Previous Value arrives with the second Object Replaced, not one signal late', () => {
    const p = makeProbe();
    const first = Model.create();
    const second = Model.create();
    const third = Model.create();

    p.watch(first);
    p.settle();
    p.watch(second);
    p.settle();
    p.watch(third);
    p.settle();

    // Before the fix: [null, undefined, undefined] — every Previous Value after the first was
    // delivered behind its signal, so the receiver held the value from the pass before.
    expect(p.seen.map((o) => o.previousValue)).toEqual([null, first, second]);
  });

  it('the node itself emits null rather than undefined on its value ports', () => {
    const p = makeProbe();
    p.watch(Model.create());

    // Read off the node, not the receiver: this is the property the fix actually establishes.
    expect(p.node.getOutput('previousValue').value).toBeNull();
    expect(p.node.getOutput('key').value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// OC-4 — the empty-value contract.
// ---------------------------------------------------------------------------

describe('OC-4 — undefined abstains, null clears', () => {
  it('undefined leaves the current subscription alone', () => {
    const p = makeProbe();
    const object = Model.create();
    p.watch(object);
    p.settle();
    p.seen.length = 0;

    p.watch(undefined);
    p.settle();
    expect(p.seen).toEqual([]);

    // Still watching, which is the half that a plain `if (!value) return` would break.
    object.set('name', 'Ada');
    p.settle();
    expect(p.seen.map((o) => o.signal)).toEqual(['keyAdded']);
  });

  it('null clears: it reports a replacement and unsubscribes', () => {
    const p = makeProbe();
    const object = Model.create();
    p.watch(object);
    p.settle();
    p.seen.length = 0;

    p.watch(null);
    p.settle();

    expect(p.seen).toEqual([{ signal: 'objectReplaced', key: null, value: null, previousValue: object }]);

    // The old object is no longer this node's business.
    p.seen.length = 0;
    object.set('name', 'Ada');
    p.settle();
    expect(p.seen).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// OC-5 — the inputs that would crash a duck-typed implementation.
// ---------------------------------------------------------------------------

describe('OC-5 — inputs that are not watchable Objects', () => {
  it('an array is declined rather than subscribed to', () => {
    // ⚠️ `collection.ts:643` installs `on`/`off` on `Array.prototype`, so a duck-type test
    // says yes to every array — and an array's `change` payload is `undefined`, so the
    // listener would read `.name` off nothing. Array Changed is the node for this.
    const p = makeProbe();
    const array: unknown[] = [];

    expect(() => p.watch(array)).not.toThrow();
    p.settle();
    p.seen.length = 0;

    expect(() => (array as { push(v: unknown): void }).push(Model.create())).not.toThrow();
    p.settle();
    expect(p.seen).toEqual([]);
  });

  it('a plain object is accepted and reports only its replacement', () => {
    const p = makeProbe();
    const plain = { name: 'Ada' };

    expect(() => p.watch(plain)).not.toThrow();
    p.settle();

    expect(p.seen.map((o) => o.signal)).toEqual(['objectReplaced']);
  });

  it('null on a never-populated node does not throw', () => {
    // `Model.instanceOf(null)` throws (`model.ts:260` reads `.target` off it), which is why
    // the guard tests for nullish before anything else.
    const p = makeProbe();
    expect(() => p.watch(null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// OC-6 — lifecycle. Dropdown's three defects, checked one node over.
// ---------------------------------------------------------------------------

describe('OC-6 — the change listener does not leak', () => {
  it('re-sending the same Object does not accumulate listeners', () => {
    const p = makeProbe();
    const object = Model.create();

    p.watch(object);
    p.watch(object);
    p.watch(object);

    expect(listenerCount(object)).toBe(1);
  });

  it('a different Object unsubscribes the previous one', () => {
    const p = makeProbe();
    const first = Model.create();
    const second = Model.create();

    p.watch(first);
    p.watch(second);

    expect(listenerCount(first)).toBe(0);
    expect(listenerCount(second)).toBe(1);
  });

  it('a deleted node stops listening', () => {
    const p = makeProbe();
    const object = Model.create();
    p.watch(object);
    expect(listenerCount(object)).toBe(1);

    p.destroy();

    expect(listenerCount(object)).toBe(0);
  });

  it('the control: deleting a never-populated node does not throw', () => {
    const p = makeProbe();
    expect(() => p.destroy()).not.toThrow();
  });

  it('100 replace cycles return the listener count to baseline', () => {
    const p = makeProbe();
    const objects = Array.from({ length: 100 }, () => Model.create());

    for (const object of objects) p.watch(object);

    // Only the last one is still watched; the other 99 were released as they were replaced.
    expect(objects.slice(0, 99).map(listenerCount)).toEqual(new Array(99).fill(0));
    expect(listenerCount(objects[99])).toBe(1);

    p.destroy();
    expect(listenerCount(objects[99])).toBe(0);
  });
});
