/**
 * ERG-004 §0 — what the runtime actually broadcasts, measured rather than assumed.
 *
 * The spec asserted six line numbers and two payload shapes. The line numbers all hold
 * (`model.ts:308,318,346`; `collection.ts:180,192,206,212,600,624,637`). One claim about
 * *meaning* did not, and it is the claim the §0 decision rests on:
 *
 * > `Collection.notify('change')` at `collection.ts:180` and `:192` is bare — no payload.
 * > **That is the whole-array-replacement path.** So a wholesale `set` can report *that* the
 * > array changed and nothing about how.
 *
 * It is not the replacement path, and a wholesale `set` reports a great deal about how.
 * `notifyChange` is the *coalesced companion* to every structural event: `announceAdd` and
 * `announceRemove` each call it (`collection.ts:207`, `:213`), and `withBatch` holds it back
 * so one logical operation emits one `change` however many items it moved. `Collection.set`
 * runs its whole diff inside `withBatch` (`:512`), so replacing a collection emits a full
 * per-item `add`/`remove` stream *and then* one bare `change` as the summary.
 *
 * These rows pin that, because the ERG-004 decision — do not enrich, consume `add`/`remove` —
 * is only correct while it stays true.
 */

/* eslint-env jest */

import Collection = require('../../src/collection');
import Model = require('../../src/model');

interface Event {
  event: string;
  args: unknown;
}

/** Records every event a collection emits, in order. */
function recorder(target: { on(e: string, l: (a?: unknown) => void): void }, events: string[]): Event[] {
  const seen: Event[] = [];
  for (const event of events) {
    target.on(event, (args?: unknown) => {
      seen.push({ event, args });
    });
  }
  return seen;
}

const collectionEvents = ['add', 'remove', 'change'];

describe('S0-A — Model change events carry name, value and old', () => {
  it('set carries all three, and a new key is the same event with old === undefined', () => {
    const model = Model.create();
    const seen: Event[] = [];
    model.on('change', (args: unknown) => seen.push({ event: 'change', args }));

    model.set('name', 'Ada');
    model.set('name', 'Grace');

    expect(seen).toEqual([
      // A key that did not exist now does — `old` is undefined, which is what makes
      // "Key Added" derivable without any new plumbing.
      { event: 'change', args: { name: 'name', value: 'Ada', old: undefined } },
      { event: 'change', args: { name: 'name', value: 'Grace', old: 'Ada' } }
    ]);
  });

  it('an unchanged write is silent, so identity guards are the runtime’s job and not the node’s', () => {
    const model = Model.create();
    model.set('name', 'Ada');

    const seen: Event[] = [];
    model.on('change', (args: unknown) => seen.push({ event: 'change', args }));
    model.set('name', 'Ada');

    expect(seen).toEqual([]);
  });

  it('setAll and fill carry the same shape', () => {
    const model = Model.create();
    model.set('a', 1);

    const seen: Event[] = [];
    model.on('change', (args: unknown) => seen.push({ event: 'change', args }));

    model.setAll({ a: 2, b: 3 });
    expect(seen).toEqual([
      { event: 'change', args: { name: 'a', value: 2, old: 1 } },
      { event: 'change', args: { name: 'b', value: 3, old: undefined } }
    ]);

    seen.length = 0;
    model.fill(null);
    expect(seen).toEqual([
      { event: 'change', args: { name: 'a', value: null, old: 2 } },
      { event: 'change', args: { name: 'b', value: null, old: 3 } }
    ]);
  });
});

describe('S0-B — add and remove carry item and index', () => {
  it('add reports the item and the index it landed at', () => {
    const collection = Collection.create();
    const seen = recorder(collection, collectionEvents);

    const item = Model.create();
    collection.add(item);

    expect(seen).toEqual([
      { event: 'add', args: { item, index: 0 } },
      { event: 'change', args: undefined }
    ]);
  });

  it('remove reports the item and the index it occupied', () => {
    const collection = Collection.create();
    const item = Model.create();
    collection.add(item);

    const seen = recorder(collection, collectionEvents);
    collection.remove(item);

    expect(seen).toEqual([
      { event: 'remove', args: { item, index: 0 } },
      { event: 'change', args: undefined }
    ]);
  });
});

describe('S0-C — `change` is the coalesced companion, not the replacement path', () => {
  // This is the row that overturns the spec. If it ever goes red, the "do not enrich"
  // decision in ERG-004-NOTES.md has to be revisited.
  it('a wholesale set emits per-item add/remove and exactly one bare change', () => {
    const collection = Collection.create();
    const seen = recorder(collection, collectionEvents);

    collection.set([{ id: 'a', v: 1 }, { id: 'b', v: 2 }]);

    const adds = seen.filter((e) => e.event === 'add');
    const changes = seen.filter((e) => e.event === 'change');

    // Two items arrived, and each was announced with its own index.
    expect(adds.length).toBe(2);
    expect(adds.map((e) => (e.args as { index: number }).index)).toEqual([0, 1]);

    // …and the `change` is one summary, emitted last, carrying nothing.
    expect(changes.length).toBe(1);
    expect(changes[0].args).toBeUndefined();
    expect(seen[seen.length - 1].event).toBe('change');
  });

  it('replacing the contents of a populated collection also emits per-item detail', () => {
    const collection = Collection.create();
    collection.set([{ id: 'a' }, { id: 'b' }]);

    const seen = recorder(collection, collectionEvents);
    collection.set([{ id: 'b' }, { id: 'c' }]);

    // `a` left, `c` arrived — the node can say exactly that, which is precisely what the
    // spec believed was unavailable on this path.
    expect(seen.filter((e) => e.event === 'remove').length).toBeGreaterThan(0);
    expect(seen.filter((e) => e.event === 'add').length).toBeGreaterThan(0);
    expect(seen.filter((e) => e.event === 'change').length).toBe(1);
  });

  it('sort and reverse emit `change` alone — the one case with no add/remove beside it', () => {
    const collection = Collection.create();
    collection.set([{ id: 'a' }, { id: 'b' }]);

    const seen = recorder(collection, collectionEvents);
    collection.reverse();

    // A reorder is the only mutation class that `add`/`remove` cannot see. `Array Changed`
    // does not report it, and its port descriptions say so.
    expect(seen.map((e) => e.event)).toEqual(['change']);
  });
});
