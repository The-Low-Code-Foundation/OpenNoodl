/**
 * NDA-001 corpus — reactivity rows R1–R6 (defect class A1).
 *
 * `Collection` is not a class: it is a set of properties patched onto `Array.prototype`
 * (`src/collection.ts:63-235`), and exactly five of them notify — `add`, `addAtIndex`,
 * `remove`, `removeAtIndex`, `set`. Every native mutation is silent, and `items` **is** the
 * array (`collection.ts:63-71`), so the moment user code touches `.items` — or simply treats
 * a Noodl Array as the array it genuinely is — every subsequent change is invisible to the
 * fourteen nodes that listen on `change`.
 *
 * ⚠️ This file is on its own because importing `src/collection` mutates `Array.prototype`.
 * Jest gives each test *file* its own module registry and its own globals, so the patch
 * cannot leak into an unrelated suite — but only as long as the corpus rows that need it are
 * not merged into a file that other rows share. Keep them here.
 *
 * Rows R1–R5 fail today and are marked `test.failing`, which fails loudly the moment
 * NDA-002 makes them pass. R6 already passes and is pinned.
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
  test.failing('R1: collection.push(item) fires change', async () => {
    const state = await watched();

    state.collection.push(state.item({ pushed: true }));
    await Promise.resolve();

    // The item lands. Nothing is told. Every Repeater, Array Filter and Array Map bound to
    // this collection keeps rendering the old contents — this is Richard's "using a JS node
    // and Noodl.Array to add something doesn't trigger the change signal", exactly.
    expect(state.collection.length).toBe(3);
    expect(state.changes).toBeGreaterThan(0);
  });

  test.failing('R2: collection.splice(0, 1) fires change', async () => {
    const state = await watched();

    state.collection.splice(0, 1);
    await Promise.resolve();

    expect(state.collection.length).toBe(1);
    expect(state.changes).toBeGreaterThan(0);
  });

  test.failing('R3: collection[0] = item fires change', async () => {
    const state = await watched();

    state.collection[0] = state.item({ replaced: true });
    await Promise.resolve();

    expect(state.changes).toBeGreaterThan(0);
  });

  test.failing('R4: collection.items.push(item) fires change', async () => {
    const state = await watched();

    // `items` is an identity getter. This is not a different container — it is the same
    // array, which is why reaching for `.items` in a Function node has always been silent.
    expect(state.collection.items).toBe(state.collection);

    state.collection.items.push(state.item({ viaItems: true }));
    await Promise.resolve();

    expect(state.collection.length).toBe(3);
    expect(state.changes).toBeGreaterThan(0);
  });

  test.failing('R5: collection.length = 0 fires change', async () => {
    const state = await watched();

    state.collection.length = 0;
    await Promise.resolve();

    expect(state.collection.length).toBe(0);
    expect(state.changes).toBeGreaterThan(0);
  });

  // ✅ Pinned. One of the five verbs that do notify — NDA-002 must not lose it while adding
  // the rest.
  test('R6: collection.add(item) fires change', async () => {
    const state = await watched();

    await state.collection.add(state.item({ added: true }));

    expect(state.collection.length).toBe(3);
    expect(state.changes).toBe(1);
  });

  // ✅ Pinned alongside R6: `notify` is `async` and awaits each listener
  // (`collection.ts:171-179`), so `add` settles a turn later than a synchronous-looking call
  // site expects. Recorded rather than judged — NDA-002 may keep or drop the asynchrony, but
  // it should not do so by accident.
  test('R6 (corollary): add notifies asynchronously, not before it returns', async () => {
    const state = await watched();

    const pending = state.collection.add(state.item({ added: true }));
    expect(state.changes).toBe(0);

    await pending;
    expect(state.changes).toBe(1);
  });
});
