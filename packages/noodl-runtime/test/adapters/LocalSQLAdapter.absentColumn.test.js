/**
 * LocalSQLAdapter — a filter on a column nothing has written (DEF-014)
 *
 * A collection here is created on first use with no user columns, and its
 * columns appear one at a time as writes arrive. So on the day an app is made,
 * every property it filters on names a column that does not exist yet — and
 * before this, `WHERE "pageId" = ?` against a table without a `pageId` was not
 * an empty result but SQLite's `no such column`, surfaced by the adapter as an
 * error and by the HTTP layer as a 500. The site-builder's Publish refused
 * every page on every new site because of it.
 *
 * **The property pinned here is an equivalence, not an emptiness:** a column
 * the table does not have answers exactly as a column it does have and no row
 * has filled in. Both arms are run against the same fixture, operator by
 * operator, because "returns nothing" alone is passed by an implementation that
 * short-circuits every absent-column query to empty — which would get
 * `$exists: false` and `$ne` backwards and would still look green.
 *
 * The negative controls are the load-bearing half: a column that exists and
 * matches still returns its rows (an always-empty adapter fails), a column the
 * `_Schema` tracking table has never heard of is still found by the query if
 * the table has it (a `_Schema`-based check fails), and in ephemeral mock mode,
 * where no schema can be read, nothing is substituted at all.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const LocalSQLAdapter = require('../../src/api/adapters/local-sql/LocalSQLAdapter');
const { resolveEngine } = require('../../src/api/adapters/local-sql');

const realEngine = resolveEngine();

function call(adapter, method, options) {
  return new Promise((resolve, reject) => {
    adapter[method]({
      ...options,
      // query()/search() call success(results, count); every assertion here is
      // about the records, so take the first argument and nothing else.
      success: (...args) => resolve(args[0]),
      error: (msg) => reject(new Error(String(msg)))
    });
  });
}

/** Every operator whose SQL touches the column reference, with its Parse spelling. */
const OPERATORS = [
  ['bare equality', (col) => ({ [col]: 'x' })],
  ['$eq', (col) => ({ [col]: { $eq: 'x' } })],
  ['$eq null', (col) => ({ [col]: { $eq: null } })],
  ['$ne', (col) => ({ [col]: { $ne: 'x' } })],
  ['$ne null', (col) => ({ [col]: { $ne: null } })],
  ['$gt', (col) => ({ [col]: { $gt: 'a' } })],
  ['$gte', (col) => ({ [col]: { $gte: 'a' } })],
  ['$lt', (col) => ({ [col]: { $lt: 'z' } })],
  ['$lte', (col) => ({ [col]: { $lte: 'z' } })],
  ['$in', (col) => ({ [col]: { $in: ['x', 'y'] } })],
  ['$nin', (col) => ({ [col]: { $nin: ['x', 'y'] } })],
  ['$exists true', (col) => ({ [col]: { $exists: true } })],
  ['$exists false', (col) => ({ [col]: { $exists: false } })],
  ['$regex', (col) => ({ [col]: { $regex: '^x' } })],
  ['$contains', (col) => ({ [col]: { contains: 'x' } })],
  ['$or with a present column', (col) => ({ $or: [{ [col]: 'x' }, { title: 'B' }] })],
  ['$and with a present column', (col) => ({ $and: [{ [col]: { $exists: false } }, { title: 'B' }] })]
];

describe('LocalSQLAdapter — a filter on a column nothing has written (DEF-014)', () => {
  let tmpDir;
  let adapter;

  beforeAll(async () => {
    if (!realEngine) throw new Error('No SQLite engine available — these tests require node:sqlite');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'def014-'));
    adapter = new LocalSQLAdapter(path.join(tmpDir, 'def014.db'));
    await adapter.connect();

    // Three rows with a `title`. `absent` is never written by anything, and
    // `allNull` exists as a column but no row carries a value — the reference
    // arm every absent-column reading is compared against.
    await call(adapter, 'create', { collection: 'Section', data: { title: 'A' } });
    await call(adapter, 'create', { collection: 'Section', data: { title: 'B' } });
    await call(adapter, 'create', { collection: 'Section', data: { title: 'C' } });
    adapter.db.exec('ALTER TABLE "Section" ADD COLUMN "allNull" TEXT');
  });

  afterAll(() => {
    if (adapter) adapter.disconnect && adapter.disconnect();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── The day-one case, and the control that stops "always empty" passing ──

  it('answers a filter on a column no record has written, instead of failing', async () => {
    const results = await call(adapter, 'query', {
      collection: 'Section',
      where: { pageId: 'baa851b3-0000-0000-0000-000000000000' }
    });
    expect(results).toEqual([]);
  });

  it('NEGATIVE CONTROL: a filter on a column that exists and matches still returns its rows', async () => {
    const results = await call(adapter, 'query', { collection: 'Section', where: { title: 'B' } });
    expect(results.map((r) => r.title)).toEqual(['B']);
  });

  it('NEGATIVE CONTROL: an unfiltered query still returns every row', async () => {
    const results = await call(adapter, 'query', { collection: 'Section' });
    expect(results).toHaveLength(3);
  });

  // ── The boundary decision, graded: absent === present-and-always-null ──

  describe('an absent column answers exactly as an all-NULL column does', () => {
    it.each(OPERATORS)('%s', async (_name, build) => {
      const viaAbsent = await call(adapter, 'query', { collection: 'Section', where: build('absent') });
      const viaAllNull = await call(adapter, 'query', { collection: 'Section', where: build('allNull') });
      expect(viaAbsent.map((r) => r.title).sort()).toEqual(viaAllNull.map((r) => r.title).sort());
    });

    it('and that equivalence is not vacuous — the two arms are not both empty everywhere', async () => {
      // $exists:false matches every row on a column no row has a value for.
      // If a future change made absent-column queries unconditionally empty,
      // the it.each above would still pass unless this reading is pinned too.
      const viaAbsent = await call(adapter, 'query', {
        collection: 'Section',
        where: { absent: { $exists: false } }
      });
      expect(viaAbsent).toHaveLength(3);
    });
  });

  // ── The same column reference in the other clauses ──

  it('sorts by a column nothing has written instead of failing', async () => {
    const results = await call(adapter, 'query', { collection: 'Section', sort: '-absent' });
    expect(results).toHaveLength(3);
  });

  it('selects a column nothing has written as an empty field, like an all-NULL one', async () => {
    const [viaAbsent] = await call(adapter, 'query', {
      collection: 'Section',
      select: ['absent'],
      where: { title: 'A' }
    });
    const [viaAllNull] = await call(adapter, 'query', {
      collection: 'Section',
      select: ['allNull'],
      where: { title: 'A' }
    });
    expect(viaAbsent.absent).toBeNull();
    expect(viaAbsent.absent).toEqual(viaAllNull.allNull);
  });

  it('counts a filter on a column nothing has written', async () => {
    const count = await new Promise((resolve, reject) => {
      adapter.count({ collection: 'Section', where: { absent: 'x' }, success: resolve, error: (e) => reject(new Error(String(e))) });
    });
    expect(count).toBe(0);
  });

  it('counts, aggregates and distincts over a column nothing has written', async () => {
    const distinct = await call(adapter, 'distinct', { collection: 'Section', property: 'absent' });
    expect(distinct).toEqual([null]);

    const aggregate = await call(adapter, 'aggregate', {
      collection: 'Section',
      group: { total: { sum: 'absent' } }
    });
    expect(aggregate.total).toBeNull();
  });

  // ── AC3: the typo case is decided, and it is not decided silently ──

  describe('the misspelled-property case', () => {
    it('is answered as empty AND reported once, because nothing here can tell it from an unwritten one', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await call(adapter, 'query', { collection: 'Section', where: { titel: 'B' } });
        await call(adapter, 'query', { collection: 'Section', where: { titel: 'B' } });

        const lines = warn.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('"titel"'));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('Section');
        expect(lines[0]).toContain('no record has ever carried that property');
      } finally {
        warn.mockRestore();
      }
    });

    it('says nothing about a column that exists', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await call(adapter, 'query', { collection: 'Section', where: { title: 'B' } });
        expect(warn.mock.calls.filter((c) => String(c[0]).includes('has no column'))).toHaveLength(0);
      } finally {
        warn.mockRestore();
      }
    });
  });

  // ── The instrument: PRAGMA, not _Schema ──

  describe('which schema the existence check reads', () => {
    it('_Schema never records a column ahead of the data, so it cannot say which properties are declared', async () => {
      // The day-one state exactly: a collection brought into existence by a
      // query and never written to. Its tracked schema has NO columns, while
      // the table has the four system ones — so _Schema knows strictly less
      // than the table does, and knows nothing at all about the properties the
      // app is about to filter on. This is the measurement behind DEF-014 §3's
      // question: there is no "declared but unwritten" state here to tell a
      // typo apart from a property no record has carried yet.
      await call(adapter, 'query', { collection: 'Untouched', where: { pageId: 'x' } });

      const tracked = JSON.parse(
        adapter.db.prepare('SELECT "schema" FROM "_Schema" WHERE "name" = ?').get('Untouched').schema
      );
      expect(tracked.columns).toEqual([]);
      expect(adapter.db.prepare('PRAGMA table_info("Untouched")').all().map((c) => c.name)).toEqual([
        'objectId',
        'createdAt',
        'updatedAt',
        'ACL'
      ]);

      // And once a write creates one, _Schema learns it at the same moment the
      // table does — the two only ever move together.
      await call(adapter, 'create', { collection: 'Untouched', data: { pageId: 'x' } });
      const after = JSON.parse(
        adapter.db.prepare('SELECT "schema" FROM "_Schema" WHERE "name" = ?').get('Untouched').schema
      );
      expect(after.columns.map((c) => c.name)).toEqual(['pageId']);
    });

    it('a column the tracking table has never heard of is still found by a query', async () => {
      // SchemaManager.addColumn skips its _Schema update when the ALTER TABLE
      // reports a duplicate, so a column can exist, hold data, and be missing
      // from _Schema. Treating that as absent would answer a working query
      // with no rows — a worse defect than the one DEF-014 fixes.
      adapter.db.exec('ALTER TABLE "Section" ADD COLUMN "sidecar" TEXT');
      adapter.db.prepare('UPDATE "Section" SET "sidecar" = ? WHERE "title" = ?').run('here', 'C');

      const tracked = JSON.parse(adapter.db.prepare('SELECT "schema" FROM "_Schema" WHERE "name" = ?').get('Section').schema);
      expect((tracked.columns || []).map((c) => c.name)).not.toContain('sidecar');

      const results = await call(adapter, 'query', { collection: 'Section', where: { sidecar: 'here' } });
      expect(results.map((r) => r.title)).toEqual(['C']);
    });
  });
});

describe('LocalSQLAdapter — ephemeral mock mode substitutes nothing (DEF-014)', () => {
  it('reads the column scope as unknown, and a query on a real column still returns its rows', async () => {
    const adapter = new LocalSQLAdapter('/def014-never-written.db', { allowEphemeral: true });
    adapter._resolveEngine = () => null;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await adapter.connect();
      expect(adapter.getPersistenceStatus().mode).toBe('ephemeral');
      // No PRAGMA to read: unknown, which must mean "do not substitute" rather
      // than "no columns exist" — the latter would empty every query in this mode.
      expect(adapter._columnScope('Thing')).toBeUndefined();

      await call(adapter, 'create', { collection: 'Thing', data: { name: 'kept' } });
      const results = await call(adapter, 'query', { collection: 'Thing', where: { name: 'kept' } });
      expect(results.map((r) => r.name)).toEqual(['kept']);
    } finally {
      warn.mockRestore();
    }
  });
});
