/**
 * NDA-001 corpus — reactivity rows R1–R6 (defect class A1).
 *
 * `Collection` is not a class: it is a set of properties patched onto `Array.prototype`
 * (`src/collection.ts`). Historically exactly five of them notified — `add`, `addAtIndex`,
 * `remove`, `removeAtIndex`, `set` — every native mutation was silent, and `items` **was**
 * the array, so the moment user code touched `.items` — or simply treated a Noodl Array as
 * the array it genuinely is — every subsequent change was invisible to the fourteen nodes
 * that listen on `change`.
 *
 * NDA-002 closed that: consumers receive a Proxy whose traps notify, `items` returns the
 * Proxy rather than the raw array, and `notify` is synchronous like `Model`'s. See
 * `dev-docs/reference/REACTIVITY-CONTRACT.md`.
 *
 * ⚠️ This file is on its own because importing `src/collection` mutates `Array.prototype`.
 * Jest gives each test *file* its own module registry and its own globals, so the patch
 * cannot leak into an unrelated suite — but only as long as the corpus rows that need it are
 * not merged into a file that other rows share. Keep them here.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import './expected-failure';

import type { CollectionLike, ModelLike } from '@noodl/types';

import Collection = require('../../src/collection');
import Model = require('../../src/model');

interface Watched {
  collection: CollectionLike;
  /** `change` notifications seen since the watcher was attached. */
  changes: number;
  item(data?: Record<string, unknown>): ModelLike;
}

/**
 * A collection with two records already in it and a `change` counter attached *after* the
 * seeding, so the count only ever reflects what the test itself did.
 */
async function watched(): Promise<Watched> {
  const collection = Collection.create([]);
  const item = (data: Record<string, unknown> = {}) => Model.create(data);

  await collection.add(item({ seed: 1 }));
  await collection.add(item({ seed: 2 }));

  const state: Watched = { collection, changes: 0, item };
  collection.on('change', () => {
    state.changes++;
  });
  return state;
}

describe('NDA-001 R1–R6: a Noodl Array notifies when it changes', () => {
  test('R1: collection.push(item) fires change', async () => {
    const state = await watched();

    state.collection.push(state.item({ pushed: true }));
    await Promise.resolve();

    // The item lands, and listeners are told — this is Richard's "using a JS node and
    // Noodl.Array to add something doesn't trigger the change signal", closed.
    expect(state.collection.length).toBe(3);
    expect(state.changes).toBe(1);
  });

  test('R2: collection.splice(0, 1) fires change', async () => {
    const state = await watched();

    state.collection.splice(0, 1);
    await Promise.resolve();

    expect(state.collection.length).toBe(1);
    // One call, one `change` — not one per element the splice touched.
    expect(state.changes).toBe(1);
  });

  test('R3: collection[0] = item fires change', async () => {
    const state = await watched();

    state.collection[0] = state.item({ replaced: true });
    await Promise.resolve();

    expect(state.changes).toBe(1);
  });

  test('R4: collection.items.push(item) fires change', async () => {
    const state = await watched();

    // `items` used to be an identity getter handing back the *raw* array, which is why
    // reaching for `.items` in a Function node was silent. It returns the notifying Proxy
    // now. The reference the corpus holds is already that Proxy — `Collection.create`
    // returns it — so `items === collection` still reads true, and every `===` guard in the
    // node library (`foreach.tsx`'s `items` input, `runtasks.ts`, `options.ts`) is
    // undisturbed. What changed is not the identity, it is that both of them notify.
    expect(state.collection.items).toBe(state.collection);
    expect(state.collection.items).toBe(state.collection.items);

    state.collection.items.push(state.item({ viaItems: true }));
    await Promise.resolve();

    expect(state.collection.length).toBe(3);
    expect(state.changes).toBe(1);
  });

  test('R5: collection.length = 0 fires change', async () => {
    const state = await watched();

    state.collection.length = 0;
    await Promise.resolve();

    expect(state.collection.length).toBe(0);
    expect(state.changes).toBe(1);
  });

  // ✅ Pinned. One of the five verbs that do notify — NDA-002 must not lose it while adding
  // the rest.
  test('R6: collection.add(item) fires change', async () => {
    const state = await watched();

    await state.collection.add(state.item({ added: true }));

    expect(state.collection.length).toBe(3);
    expect(state.changes).toBe(1);
  });

  // ✅ Pinned alongside R6, and the one pinned row NDA-002 deliberately inverted.
  //
  // It used to record the *old* behaviour: `notify` was `async` and awaited each listener, so
  // `add` settled a turn later than a synchronous-looking call site expected and a throwing
  // listener rejected a promise nobody held. The contract's third clause says the
  // notification runs before the mutating call returns, with `Model.notify` as the reference
  // implementation — so the assertion is now the opposite one, and it is pinned in that
  // direction.
  test('R6 (corollary): add notifies before it returns', async () => {
    const state = await watched();

    state.collection.add(state.item({ added: true }));
    expect(state.changes).toBe(1);
  });

  // ✅ Pinned. The contract's second clause, on the operation that broke it worst: `set`
  // reaches `removeAtIndex`/`addAtIndex`/`add` per item, and each of those used to emit a
  // `change` of its own on top of its structural event — so replacing a 100-item collection
  // emitted 200 notifications. The structural events are still per item, because that is what
  // the Repeater queues its mount/unmount work from (`foreach.tsx`).
  test('R1–R5 (corollary): set replaces N items with N structural events and one change', async () => {
    const state = await watched();
    const structural: string[] = [];
    state.collection.on('add', () => structural.push('add'));
    state.collection.on('remove', () => structural.push('remove'));

    state.collection.set([{ id: 'kept-1' }, { id: 'kept-2' }, { id: 'kept-3' }]);

    expect(state.collection.length).toBe(3);
    // Two seeded records leave, three arrive.
    expect(structural.filter((event) => event === 'remove').length).toBe(2);
    expect(structural.filter((event) => event === 'add').length).toBe(3);
    expect(state.changes).toBe(1);
  });

  // ✅ Pinned: a `set` that changes nothing is not a mutation, so it says nothing.
  test('R1–R5 (corollary): a set that changes nothing is silent', async () => {
    const state = await watched();

    state.collection.set(Array.from(state.collection));

    expect(state.collection.length).toBe(2);
    expect(state.changes).toBe(0);
  });

  // ✅ Pinned: a listener that throws must not stop the ones behind it. Until the NDA-004
  // error channel exists the exception is logged (see `collection.ts`'s TODO); what this row
  // guards is that it is neither swallowed into an unhandled rejection nor allowed to abort
  // the loop.
  test('R6 (corollary): one throwing listener does not silence the others', async () => {
    const state = await watched();
    const reached: string[] = [];
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    state.collection.on('change', () => {
      reached.push('first');
      throw new Error('listener blew up');
    });
    state.collection.on('change', () => reached.push('second'));

    try {
      state.collection.push(state.item({ pushed: true }));

      expect(reached).toEqual(['first', 'second']);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
