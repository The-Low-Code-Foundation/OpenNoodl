/**
 * BCN-004 step 6 remainder: a **numeric** `objectId` through the Model store and the
 * Collection diff — the data path the Repeater consumes.
 *
 * Directus and PostgREST hand back integer primary keys, and BCN-004 deliberately stopped
 * stringifying them so that `author.objectId === article.author_id` holds for the same row.
 * The live node driver proved the whole CRUD round-trip copes (`BCN-004-NOTES-STEP6.md`).
 * What it could not reach is the Repeater, because that needs a rendered React tree.
 *
 * This covers the half of the Repeater risk that is *not* rendering. `foreach.tsx` does two
 * things with an id, and both are here:
 *
 *   - `itemNode.setInputValue('Id', model.getId())` — the `Id` output every graph wires;
 *   - it queues from the structural `add`/`remove` events that `Collection.set` emits, and
 *     `Collection.set` **diffs by `getId()`** (collection.ts:492).
 *
 * ## ⚠️ The load-bearing accident this pins
 *
 * `Model.get` keys off `models[id]`, a **plain object**, and `Collection.set`'s `keyIndex`
 * builds one too. JavaScript coerces object keys to strings, so `models[7]` and
 * `models['7']` are the same slot — a numeric id and its string spelling rendezvous on the
 * same record, which is exactly what a graph needs when a user types "7" into a `Record Id`
 * input for a row Directus returned as `7`.
 *
 * **That is correct behaviour resting on an implementation accident.** `WeakRegistry`
 * (weak-registry.ts:44) already uses `new Map<string, …>`, and a `Map` does *not* coerce:
 * `map.set(7, x); map.get('7')` is `undefined`. So converting `models` to a `Map` — an
 * obvious-looking modernisation, and the kind of change nothing in the suite would have
 * objected to — would silently split one record into two and break identity for every
 * integer-keyed backend. These tests are the objection.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import Model = require('../../src/model');
import Collection = require('../../src/collection');
import CloudStore = require('../../src/api/cloudstore');

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/**
 * A Directus row as `RestDataAdapter` normalises it: `objectId` is a number.
 *
 * ⚠️ The cast is a finding, not convenience. `CloudStore._fromJSON` declares its parameter
 * as `{ objectId?: string } & Record<string, unknown>`, so **the types still say the id is a
 * string** while BCN-004 deliberately made it arrive as a number. Without the cast this file
 * does not compile. That is the register's "the contract's `objectId?: string` should widen
 * to `string | number`" entry, confirmed at a second site — the declaration, not just the
 * contract. Left to its owner rather than widened here, because changing it recompiles every
 * consumer and this test's job is to describe what happens, not to change it.
 */
function directusRow(id: number, title: string) {
  return { objectId: id, title } as unknown as { objectId?: string } & Record<string, unknown>;
}

describe('a numeric objectId keeps one identity', () => {
  test('_fromJSON gives the Model the number, not a stringified copy', () => {
    const model = CloudStore._fromJSON(directusRow(7, 'Alpha'), 'articles') as Any;

    expect(model.getId()).toBe(7);
    expect(typeof model.getId()).toBe('number');
  });

  test('⚠️ the numeric id and its string spelling are the SAME record', () => {
    // The rendezvous a graph depends on: a `Record Id` input carrying the string '7' — from
    // a Text field, a URL parameter, a Function node — must reach the row Directus returned
    // as the number 7. This is what a `Map` would break.
    const fromBackend = CloudStore._fromJSON(directusRow(11, 'Charlie'), 'articles') as Any;
    const bySpelling = Model.get('11') as Any;

    expect(bySpelling.get('title')).toBe('Charlie');
    expect(bySpelling.getId()).toBe(fromBackend.getId());
  });

  test('and the reverse spelling too', () => {
    Model.get('202').set('title', 'typed first');
    const numeric = Model.get(202 as unknown as string) as Any;

    expect(numeric.get('title')).toBe('typed first');
  });

  test('a write through one spelling is visible through the other', () => {
    const numeric = CloudStore._fromJSON(directusRow(33, 'Echo'), 'articles') as Any;
    (Model.get('33') as Any).set('title', 'edited by string');

    expect(numeric.get('title')).toBe('edited by string');
  });
});

describe("Collection.set's diff — what the Repeater queues from", () => {
  test('re-setting the same numeric-id rows is a no-op, not a full replace', () => {
    // If the diff failed to match numeric ids it would remove and re-add every row, and the
    // Repeater would tear down and rebuild every item on each fetch — correct-looking output
    // with every item's state lost.
    const collection = Collection.get() as Any;
    const rows = [directusRow(1, 'A'), directusRow(2, 'B'), directusRow(3, 'C')];
    collection.set(rows.map((r) => CloudStore._fromJSON(r, 'articles')));

    const events: string[] = [];
    collection.on('add', () => events.push('add'));
    collection.on('remove', () => events.push('remove'));

    collection.set(rows.map((r) => CloudStore._fromJSON(r, 'articles')));

    expect(events).toEqual([]);
    expect(collection.size()).toBe(3);
  });

  test('a row that really went away is removed exactly once', () => {
    const collection = Collection.get() as Any;
    collection.set([101, 102, 103].map((id) => CloudStore._fromJSON(directusRow(id, 'r' + id), 'articles')));

    const removed: unknown[] = [];
    // ⚠️ The `remove` event carries `{item, index}` — NOT `{model}`. Reading `args.model`
    // throws inside the notifier, the handler pushes nothing, and the assertion then reads
    // as "no row was removed" rather than as a broken listener.
    collection.on('remove', (args: Any) => removed.push(args.item.getId()));

    collection.set([101, 103].map((id) => CloudStore._fromJSON(directusRow(id, 'r' + id), 'articles')));

    expect(removed).toEqual([102]);
    expect(collection.size()).toBe(2);
  });

  test('the diff matches a numeric id against its string spelling', () => {
    // The mixed case: rows fetched as numbers, then re-set from something that spelled them
    // as strings. Anything other than a no-op here means the Repeater rebuilds every item.
    const collection = Collection.get() as Any;
    collection.set([5, 6].map((id) => CloudStore._fromJSON(directusRow(id, 'n' + id), 'articles')));

    const events: string[] = [];
    collection.on('add', () => events.push('add'));
    collection.on('remove', () => events.push('remove'));

    collection.set([Model.get('5'), Model.get('6')]);

    expect(events).toEqual([]);
  });
});

describe('the id a graph actually reads', () => {
  test("the Repeater's Id is the number, so a === against a string is false", () => {
    // Not a defect — it is the deliberate choice that makes `author.objectId ===
    // article.author_id` hold. Pinned because it IS the sharp edge a user meets: a
    // Condition comparing the Repeater's Id to a string literal will not match, and the
    // node's own behaviour is correct.
    const model = CloudStore._fromJSON(directusRow(42, 'Zulu'), 'articles') as Any;
    const idAsAGraphSeesIt = model.getId();

    expect(idAsAGraphSeesIt === 42).toBe(true);
    expect((idAsAGraphSeesIt as unknown) === '42').toBe(false);
    expect(String(idAsAGraphSeesIt)).toBe('42');
  });

  test('a string-keyed backend is unaffected', () => {
    const model = CloudStore._fromJSON({ objectId: 'o9FVp2zMXX', title: 'Parse row' }, 'articles') as Any;

    expect(model.getId()).toBe('o9FVp2zMXX');
    expect(typeof model.getId()).toBe('string');
  });
});
