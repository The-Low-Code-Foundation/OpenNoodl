/**
 * DEBT-014 — Repeater items must not become process-global Models that are never freed.
 *
 * Two kinds of assertion live here, and the distinction matters:
 *
 * 1. **Registry accounting** (deterministic). Anonymous records and collections must not be
 *    entered into the strong tables at all. This is what the success criterion "adding and
 *    removing N Repeater items leaves the Model registry at its starting size" actually
 *    reduces to, and it needs no garbage collector to observe.
 *
 * 2. **Actual collectability** (GC-gated). Proves the weak tier really does let go. Requires
 *    node's `--expose-gc`; the suite skips these rather than run flaky assertions, so they do
 *    NOT run in the default `npm test`. Run them with:
 *      node --expose-gc ../../node_modules/.bin/jest model-registry-lifetime
 *
 * Group 1 is the failing-first evidence: before the fix every anonymous record and collection
 * landed in `Model._models` / `Collection._collections` permanently, so `named` grew by N.
 */

import Collection = require('../src/collection');
import Model = require('../src/model');

/** `global.gc`, when the process was started with `--expose-gc`. */
const forceGc: undefined | (() => void) = (globalThis as { gc?: () => void }).gc;

/**
 * Group 1 deliberately measures the strong tables *directly* rather than through
 * `Model._registrySize()`. `Model._models` and `Collection._collections` predate DEBT-014, so
 * this file runs — and fails on exactly these assertions — against the unfixed sources too.
 * A leak test that can only be expressed in terms of the fix would prove nothing.
 */
const namedModels = () => Object.keys(Model._models).length;
const namedCollections = () => Object.keys(Collection._collections).length;

/**
 * The anonymous tier's live count, reached through a cast rather than the declared
 * `_registrySize()`.
 *
 * The cast is deliberate and is the same portability point as the two helpers above: it keeps
 * this file *compilable* against the pre-DEBT-014 sources, where `_registrySize` does not
 * exist. Without it the suite fails to build rather than fails to pass, and "prove the test
 * fails before it passes" stops being something a later reader can reproduce by checking the
 * two source files out and re-running.
 */
const anonymousTierSize = (registry: unknown) =>
  (registry as { _registrySize(): { anonymous: number } })._registrySize().anonymous;

/**
 * Give the collector a chance to run and the FinalizationRegistry callbacks a chance to fire.
 * Finalizers are queued as microtasks *after* a collection, so a single `gc()` is not enough.
 */
async function collectGarbage() {
  for (let i = 0; i < 4; i++) {
    forceGc!();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Allocate a throwaway record so the *previous* allocation is no longer the most recent one.
 *
 * V8 can keep the value most recently produced by an expression reachable from a register or
 * a statement's completion value for longer than the source suggests. Without this, a loop
 * that allocates N anonymous records reliably leaves exactly one survivor — which looks like
 * a leak of 1 and is really an artifact of the measurement. Displacing it is honest; loosening
 * the assertion to `<= 1` would hide a genuine off-by-one in the sweep logic.
 *
 * The returned id is the displacer's own, so a caller can exclude it if it counts tiers.
 */
function displaceMostRecentAllocation(): string {
  return Model.create({ content: 'debt014 displacer' }).getId();
}

const describeWithGc = forceGc ? describe : describe.skip;

describe('DEBT-014 Model registry lifetime', () => {
  describe('the named tier owns names, and only names', () => {
    it('does not register a record whose id it minted itself', () => {
      const before = namedModels();

      for (let i = 0; i < 200; i++) Model.get();

      expect(namedModels()).toBe(before);
    });

    it('does not register a record created from data with no id', () => {
      const before = namedModels();

      // This is the exact Repeater path: `collection.set` on plain objects reaches
      // `Model.create(item)` for each one.
      for (let i = 0; i < 200; i++) Model.create({ role: 'assistant', content: 'chunk ' + i });

      expect(namedModels()).toBe(before);
    });

    it('does register a record whose id was supplied by the caller', () => {
      const before = namedModels();

      Model.get('a-name-somebody-chose');

      expect(namedModels()).toBe(before + 1);
    });

    it('registers a created record when the data carries an explicit id', () => {
      const before = namedModels();

      Model.create({ id: 'debt014-explicit', content: 'hello' });

      expect(namedModels()).toBe(before + 1);
      expect(Model.get('debt014-explicit').content).toBe('hello');
    });
  });

  describe('cross-graph reach by id is unaffected', () => {
    it('resolves the same live record from two independent lookups', () => {
      const a = Model.get('debt014-shared');
      a.set('title', 'from the first reach');

      const b = Model.get('debt014-shared');

      expect(b).toBe(a);
      expect(b.get('title')).toBe('from the first reach');
    });

    it('keeps a named record alive with nobody holding a reference to it', async () => {
      Model.get('debt014-durable').set('title', 'still here');
      if (forceGc) await collectGarbage();

      expect(Model.get('debt014-durable').get('title')).toBe('still here');
    });

    it('sees writes made through one reference from the other', () => {
      const writer = Model.get('debt014-two-refs');
      const reader = Model.get('debt014-two-refs');

      writer.set('n', 41);
      expect(reader.get('n')).toBe(41);

      // ...and through the Proxy write path, which is what user JavaScript uses.
      (writer as unknown as Record<string, unknown>).n = 42;
      expect(reader.get('n')).toBe(42);
    });

    it('promotes an anonymous record when its id is later spelled explicitly', () => {
      const anonymous = Model.create({ content: 'minted anonymously' });
      const id = anonymous.getId();
      const namedBefore = namedModels();

      // Somebody captured the id (the Repeater publishes it on `itemActionItemId`) and is now
      // using it as a name.
      const reached = Model.get(id);

      expect(reached).toBe(anonymous);
      expect(reached.get('content')).toBe('minted anonymously');
      expect(namedModels()).toBe(namedBefore + 1);
    });

    it('reports an anonymous record as existing while it is still referenced', () => {
      const held = Model.create({ content: 'referenced' });

      expect(Model.exists(held.getId())).toBe(true);
    });
  });

  describe('Collection registry', () => {
    it('does not register an anonymous collection', () => {
      const before = namedCollections();

      for (let i = 0; i < 200; i++) Collection.create([{ v: i }]);
      for (let i = 0; i < 200; i++) Collection.get();

      expect(namedCollections()).toBe(before);
    });

    it('does register a named collection and returns the same one', () => {
      const before = namedCollections();

      const first = Collection.get('debt014-named-array');
      first.add(Model.create({ id: 'debt014-member', v: 1 }));

      expect(namedCollections()).toBe(before + 1);
      expect(Collection.get('debt014-named-array')).toBe(first);
      expect(Collection.get('debt014-named-array').size()).toBe(1);
    });

    it('promotes an anonymous collection when its id is spelled explicitly', () => {
      const anonymous = Collection.create([{ v: 1 }]);

      expect(Collection.get(anonymous.getId())).toBe(anonymous);
      expect(Collection.exists(anonymous.getId())).toBe(true);
    });
  });

  describe('a Repeater-shaped workload does not grow the registry', () => {
    /**
     * The shape of the leak as AIX-005 found it: a Repeater keeps a private anonymous
     * collection and `set`s a growing array of plain message objects into it. Each `set` mints
     * a Model per element; the accumulator bounds the visible list, nothing bounded the Models.
     */
    it('holds the named tiers flat across many turns of a bounded chat transcript', async () => {
      const modelsBefore = namedModels();
      const collectionsBefore = namedCollections();

      const repeaterInternalCollection = Collection.get(); // foreach.tsx does exactly this
      const maxMessages = 20;
      const transcript: Array<Record<string, unknown>> = [];

      for (let turn = 0; turn < 300; turn++) {
        transcript.push({ role: turn % 2 ? 'assistant' : 'user', content: 'turn ' + turn });
        // TextAccumulator's maxMessages: the author correctly bounds their visible list.
        while (transcript.length > maxMessages) transcript.shift();
        await repeaterInternalCollection.set(transcript);
      }

      expect(repeaterInternalCollection.size()).toBe(maxMessages);
      expect(namedModels()).toBe(modelsBefore);
      expect(namedCollections()).toBe(collectionsBefore);
    });
  });

  describe('the record Proxy is still fully enumerable', () => {
    /**
     * Regression guard for the DEBT-014 implementation itself.
     *
     * The fix hangs an instance→Proxy backreference off each record so that reaching either
     * keeps both alive. `_modelProxyHandler.ownKeys` reports the keys of `target.data` rather
     * than the instance's own keys, and a Proxy is required to report every *non-configurable*
     * own key of its target — so defining that slot with `Object.defineProperty`'s
     * `configurable: false` default made all three of these throw
     * "'ownKeys' on proxy: trap result did not include Symbol(noodl.model.proxy)".
     *
     * Nothing else in the suite spreads or enumerates a record, so without this test that
     * would have shipped: every Function node doing `{ ...myObject }` or
     * `Object.keys(myObject)` would have started throwing.
     */
    const record = () => Model.create({ title: 'a', count: 2 });

    it('supports Object.keys', () => {
      expect(Object.keys(record()).sort()).toEqual(['count', 'title']);
    });

    it('supports Reflect.ownKeys', () => {
      expect(Reflect.ownKeys(record()).sort()).toEqual(['count', 'title']);
    });

    it('supports object spread', () => {
      expect({ ...record() }).toEqual({ title: 'a', count: 2 });
    });

    it('supports JSON.stringify and for-in', () => {
      const r = record();
      // `id` is expected: `JSON.stringify` finds the record's own `toJSON`, which has always
      // merged the id in alongside the data. Unrelated to the backreference slot.
      expect(JSON.parse(JSON.stringify(r))).toEqual({ id: r.getId(), title: 'a', count: 2 });

      // `for-in` walks the prototype chain, and `Model.prototype`'s methods are assigned
      // plainly and so are enumerable — a record has always enumerated `on`, `set`, `toJSON`
      // and friends this way. Not something DEBT-014 changes, so this asserts only that the
      // data keys are reachable and that the traversal does not throw.
      const seen: string[] = [];
      for (const key in r) seen.push(key);
      expect(seen).toContain('title');
      expect(seen).toContain('count');
      expect(seen.filter((k) => typeof k !== 'string')).toEqual([]);
    });

    it('does not expose the backreference slot', () => {
      // It is symbol-keyed and non-enumerable, so it must be invisible to every key listing.
      expect(Reflect.ownKeys(record()).filter((k) => typeof k === 'symbol')).toEqual([]);
    });

    it('still round-trips through toJSON without the slot leaking in', () => {
      const r = record();
      expect(r.toJSON()).toEqual({ id: r.getId(), title: 'a', count: 2 });
    });
  });

  describe('degrades to strong retention on a host without WeakRef', () => {
    /**
     * `SUPPORTS_WEAKREF` is decided once at module load, so the only way to exercise the
     * fallback is to re-require the module with the global removed.
     *
     * Only `model` is re-required, never `collection`: `collection.ts` installs the
     * `Array.prototype` patch with `Object.defineProperty` defaults, i.e.
     * `configurable: false`, so loading a second copy would throw `TypeError: Cannot
     * redefine property`. That patch is load-bearing (PLAT-003) and is not to be made
     * configurable just to suit a test.
     */
    it('keeps anonymous records findable instead of throwing', () => {
      const realWeakRef = (globalThis as { WeakRef?: unknown }).WeakRef;
      const realFinalizationRegistry = (globalThis as { FinalizationRegistry?: unknown }).FinalizationRegistry;
      try {
        delete (globalThis as { WeakRef?: unknown }).WeakRef;
        delete (globalThis as { FinalizationRegistry?: unknown }).FinalizationRegistry;

        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const FallbackModel = require('../src/model') as typeof Model;

          // If this were the already-loaded module the test would be asserting nothing.
          expect(FallbackModel).not.toBe(Model);

          const anonymous = FallbackModel.create({ content: 'no weakref here' });
          const id = anonymous.getId();

          // Still kept out of the strong table, so `_models` stays a table of names only.
          // Checked before the `get(id)` below, which would legitimately promote it.
          expect(Object.keys(FallbackModel._models)).not.toContain(id);

          // The pre-DEBT-014 behaviour: retained, therefore still found. A leak on such a
          // host, but never a correctness change or a crash.
          expect(FallbackModel.exists(id)).toBe(true);
          expect(FallbackModel.get(id).get('content')).toBe('no weakref here');
        });
      } finally {
        (globalThis as { WeakRef?: unknown }).WeakRef = realWeakRef;
        (globalThis as { FinalizationRegistry?: unknown }).FinalizationRegistry = realFinalizationRegistry;
      }
    });
  });

  describeWithGc('actually releases memory (requires --expose-gc)', () => {
    it('collects an anonymous record once nothing holds it', async () => {
      const anonymousIds: string[] = [];
      for (let i = 0; i < 500; i++) anonymousIds.push(Model.create({ content: 'turn ' + i }).getId());

      displaceMostRecentAllocation();
      await collectGarbage();

      expect(anonymousIds.filter((id) => Model.exists(id))).toEqual([]);
    });

    it('releases the Models a dropped anonymous collection was holding', async () => {
      // Built inside a helper, and populated through `set` on plain objects rather than by
      // `add`-ing records this frame holds. That is both the real Repeater path (`foreach.tsx`
      // calls `collection.set(items)`, and `Collection.prototype.set` mints the Models) and the
      // only way to be sure no local variable here is what is keeping a member alive.
      async function buildRepeaterCollection() {
        const collection = Collection.create([]);
        await collection.set(Array.from({ length: 200 }, (_, i) => ({ content: 'message ' + i })));
        return {
          collection,
          collectionId: collection.getId(),
          memberIds: Array.from(collection).map((m) => m.getId())
        };
      }

      let built = await buildRepeaterCollection();
      const { collectionId, memberIds } = built;
      expect(memberIds).toHaveLength(200);
      expect(Model.exists(memberIds[0])).toBe(true);
      expect(Collection.exists(collectionId)).toBe(true);

      // The Repeater is deleted; its private collection is dropped.
      built = undefined as unknown as typeof built;
      displaceMostRecentAllocation();
      await collectGarbage();

      expect(Collection.exists(collectionId)).toBe(false);
      // The whole point: the collection was the only thing holding these, and it is gone.
      expect(memberIds.filter((id) => Model.exists(id))).toEqual([]);
    });

    it('does not collect a record that a live collection still holds', async () => {
      const collection = Collection.create([]);
      const member = Model.create({ content: 'held by the collection' });
      const memberId = member.getId();
      await collection.add(member);

      await collectGarbage();

      // Still reachable through the collection, so the registry must still find it.
      expect(Collection.instanceOf(collection)).toBe(true);
      expect(Model.exists(memberId)).toBe(true);
      expect(collection.size()).toBe(1);
    });

    it('does not collect a record that is still a member of a *second* collection', async () => {
      // A Model can legitimately be in several collections at once (filter/map/query all
      // build parallel collections over the same records), which is why a naive
      // "dropped from a collection => free it" rule would have been wrong.
      const keep = Collection.create([]);
      let drop = Collection.create([]);
      const shared = Model.create({ content: 'in both' });
      const sharedId = shared.getId();
      await keep.add(shared);
      await drop.add(shared);

      await drop.removeAtIndex(0);
      drop = undefined as unknown as typeof drop;
      await collectGarbage();

      expect(Model.exists(sharedId)).toBe(true);
      expect(keep.size()).toBe(1);
    });

    it('keeps a named record even when nothing else references it', async () => {
      Model.get('debt014-named-survives-gc').set('v', 'kept');

      await collectGarbage();

      expect(Model.exists('debt014-named-survives-gc')).toBe(true);
      expect(Model.get('debt014-named-survives-gc').get('v')).toBe('kept');
    });

    it('sweeps dead keys out of the anonymous tier itself', async () => {
      for (let i = 0; i < 1000; i++) Model.create({ content: 'ephemeral ' + i });

      const displacerId = displaceMostRecentAllocation();
      await collectGarbage();

      // Not merely "no live entries" — the Map must not retain 1000 dead WeakRef husks. The
      // displacer is the one record still legitimately reachable (this frame holds its id, and
      // V8 may still hold the record itself), so the tier is allowed to contain it and nothing
      // else.
      expect(anonymousTierSize(Model)).toBeLessThanOrEqual(1);
      expect(typeof displacerId).toBe('string');
    });
  });
});
