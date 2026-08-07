/**
 * LocalSQLAdapter — row-level ACL enforcement in SQL (BAK-003)
 *
 * The correctness property pinned here: every read shape (query, fetch, count,
 * distinct, aggregate) and every write shape (save, delete, increment) applies
 * the caller's ACL context IN the SQL statement, so count/limit/skip operate on
 * the *visible* set and writes are atomic write-permission checks. The same
 * queries run with and without an acl context against known fixtures; the
 * without-acl runs prove the fixtures, the with-acl runs prove the filtering.
 *
 * ACL shape (Parse): { "<principalKey>": { read: true, write: true }, ... }
 * where principal keys are '*', a userId, or 'role:<name>'. A NULL ACL means
 * public (retrofit semantics — pre-BAK-003 rows keep working).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const LocalSQLAdapter = require('../../src/api/adapters/local-sql/LocalSQLAdapter');
const { resolveEngine } = require('../../src/api/adapters/local-sql');

const realEngine = resolveEngine();

// Promisified wrappers over the callback-style adapter API -------------------

function call(adapter, method, options) {
  return new Promise((resolve, reject) => {
    adapter[method]({
      ...options,
      success: (...args) => resolve(args.length > 1 ? args : args[0]),
      error: (msg) => reject(new Error(String(msg)))
    });
  });
}

const ids = {};

/** Principal key sets, as the service's enforcement layer supplies them. */
const ANON = ['*'];
const ALICE = ['*', 'user-alice'];
const BOB = ['*', 'user-bob'];
const CAROL_EDITOR = ['*', 'user-carol', 'role:editors'];

function read(keys) {
  return { access: 'read', keys };
}
function write(keys) {
  return { access: 'write', keys };
}

describe('LocalSQLAdapter ACL enforcement (SQL-level)', () => {
  let tmpDir;
  let adapter;

  beforeAll(async () => {
    if (!realEngine) throw new Error('No SQLite engine available — these tests require node:sqlite');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noodl-acl-test-'));
    adapter = new LocalSQLAdapter(path.join(tmpDir, 'acl.db'));
    await adapter.connect();

    const fixtures = [
      ['pub1', { title: 'public one', score: 1, ACL: null }],
      ['pub2', { title: 'public two', score: 2, ACL: null }],
      ['alice1', { title: 'alice private', score: 4, ACL: { 'user-alice': { read: true, write: true } } }],
      [
        'alice2',
        {
          title: 'alice owned, world readable',
          score: 8,
          ACL: { 'user-alice': { read: true, write: true }, '*': { read: true } }
        }
      ],
      ['bob1', { title: 'bob private', score: 16, ACL: { 'user-bob': { read: true, write: true } } }],
      ['role1', { title: 'editors only', score: 32, ACL: { 'role:editors': { read: true, write: true } } }],
      // Write-only for alice: grants write but NOT read.
      ['wo1', { title: 'write only', score: 64, ACL: { 'user-alice': { write: true } } }]
    ];
    for (const [key, data] of fixtures) {
      const record = await call(adapter, 'create', { collection: 'Doc', data });
      ids[key] = record.objectId;
    }
  });

  afterAll(async () => {
    if (adapter) await adapter.disconnect();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function titles(results) {
    return results.map((r) => r.title).sort();
  }

  // ==========================================================================
  // query
  // ==========================================================================

  it('without an acl context, all fixtures are returned (baseline)', async () => {
    const [results] = await call(adapter, 'query', { collection: 'Doc', count: true });
    expect(results.length).toBe(7);
  });

  it('anonymous sees only public and world-readable rows', async () => {
    const [results] = await call(adapter, 'query', { collection: 'Doc', acl: read(ANON) });
    expect(titles(results)).toEqual(['alice owned, world readable', 'public one', 'public two']);
  });

  it('a user sees public rows plus rows their id can read', async () => {
    const [results] = await call(adapter, 'query', { collection: 'Doc', acl: read(ALICE) });
    expect(titles(results)).toEqual(['alice owned, world readable', 'alice private', 'public one', 'public two']);
  });

  it('role membership grants row visibility via role: keys', async () => {
    const [results] = await call(adapter, 'query', { collection: 'Doc', acl: read(CAROL_EDITOR) });
    expect(titles(results)).toEqual(['alice owned, world readable', 'editors only', 'public one', 'public two']);
  });

  it('a write-only grant does NOT confer read', async () => {
    const [results] = await call(adapter, 'query', { collection: 'Doc', acl: read(ALICE) });
    expect(titles(results)).not.toContain('write only');
  });

  it('an empty key set sees only NULL-ACL rows', async () => {
    const [results] = await call(adapter, 'query', { collection: 'Doc', acl: { access: 'read', keys: [] } });
    expect(titles(results)).toEqual(['public one', 'public two']);
  });

  it('query filters compose with the ACL predicate (AND semantics)', async () => {
    const [results] = await call(adapter, 'query', {
      collection: 'Doc',
      where: { score: { $gte: 4 } },
      acl: read(ALICE)
    });
    expect(titles(results)).toEqual(['alice owned, world readable', 'alice private']);
  });

  // ==========================================================================
  // count / limit / skip — the reason this is done in SQL
  // ==========================================================================

  it('count counts the visible set, not the table', async () => {
    const count = await call(adapter, 'count', { collection: 'Doc', acl: read(BOB) });
    // pub1, pub2, alice2 (world-readable), bob1
    expect(count).toBe(4);
  });

  it('query count:true returns the visible count alongside limited results', async () => {
    const [results, count] = await call(adapter, 'query', {
      collection: 'Doc',
      limit: 1,
      count: true,
      acl: read(BOB)
    });
    expect(results.length).toBe(1);
    expect(count).toBe(4);
  });

  it('limit/skip paginate over the visible set with no gaps or leaks', async () => {
    const page = (skip) =>
      call(adapter, 'query', {
        collection: 'Doc',
        sort: ['score'],
        limit: 2,
        skip,
        acl: read(ALICE)
      }).then(([results]) => results.map((r) => r.title));

    // Visible to alice ordered by score: pub1(1), pub2(2), alice1(4), alice2(8)
    expect(await page(0)).toEqual(['public one', 'public two']);
    expect(await page(2)).toEqual(['alice private', 'alice owned, world readable']);
    expect(await page(4)).toEqual([]);
  });

  // ==========================================================================
  // fetch — existence hiding
  // ==========================================================================

  it('fetch returns a readable row', async () => {
    const record = await call(adapter, 'fetch', { collection: 'Doc', objectId: ids.alice1, acl: read(ALICE) });
    expect(record.title).toBe('alice private');
  });

  it('fetch of an unreadable row answers exactly like a missing row', async () => {
    const forOtherUser = call(adapter, 'fetch', { collection: 'Doc', objectId: ids.alice1, acl: read(BOB) });
    await expect(forOtherUser).rejects.toThrow('Object not found');
    const missing = call(adapter, 'fetch', { collection: 'Doc', objectId: 'does-not-exist', acl: read(BOB) });
    await expect(missing).rejects.toThrow('Object not found');
  });

  // ==========================================================================
  // distinct / aggregate — no side-channel reads
  // ==========================================================================

  it('distinct excludes invisible rows', async () => {
    const values = await call(adapter, 'distinct', { collection: 'Doc', property: 'title', acl: read(ANON) });
    expect(values.sort()).toEqual(['alice owned, world readable', 'public one', 'public two']);
  });

  it('aggregate computes over the visible set only', async () => {
    const result = await call(adapter, 'aggregate', {
      collection: 'Doc',
      group: { total: { sum: 'score' } },
      acl: read(ANON)
    });
    // pub1(1) + pub2(2) + alice2(8)
    expect(result.total).toBe(11);
  });

  // ==========================================================================
  // writes — atomic write-permission checks
  // ==========================================================================

  it('save succeeds with write access (own row, and write-only grants count)', async () => {
    const updated = await call(adapter, 'save', {
      collection: 'Doc',
      objectId: ids.alice1,
      data: { title: 'alice private v2' },
      acl: write(ALICE)
    });
    expect(updated.title).toBe('alice private v2');

    // wo1 grants alice write (not read) — write must succeed.
    const wo = await call(adapter, 'save', {
      collection: 'Doc',
      objectId: ids.wo1,
      data: { title: 'write only v2' },
      acl: write(ALICE)
    });
    expect(wo.title).toBe('write only v2');
  });

  it("save on another user's row reports Object not found (0 rows changed)", async () => {
    const attempt = call(adapter, 'save', {
      collection: 'Doc',
      objectId: ids.alice1,
      data: { title: 'bob was here' },
      acl: write(BOB)
    });
    await expect(attempt).rejects.toThrow('Object not found');
    // And the row is untouched.
    const record = await call(adapter, 'fetch', { collection: 'Doc', objectId: ids.alice1 });
    expect(record.title).toBe('alice private v2');
  });

  it('a world-readable grant does not confer write', async () => {
    const attempt = call(adapter, 'save', {
      collection: 'Doc',
      objectId: ids.alice2,
      data: { title: 'defaced' },
      acl: write(BOB)
    });
    await expect(attempt).rejects.toThrow('Object not found');
  });

  it('NULL-ACL rows are publicly writable (Parse retrofit semantics)', async () => {
    const updated = await call(adapter, 'save', {
      collection: 'Doc',
      objectId: ids.pub1,
      data: { title: 'public one v2' },
      acl: write(ANON)
    });
    expect(updated.title).toBe('public one v2');
  });

  it('increment respects the write predicate', async () => {
    const updated = await call(adapter, 'increment', {
      collection: 'Doc',
      objectId: ids.alice1,
      properties: { score: 10 },
      acl: write(ALICE)
    });
    expect(updated.score).toBe(14);

    const attempt = call(adapter, 'increment', {
      collection: 'Doc',
      objectId: ids.alice1,
      properties: { score: 1000 },
      acl: write(BOB)
    });
    await expect(attempt).rejects.toThrow('Object not found');
  });

  it('delete respects the write predicate', async () => {
    const attempt = call(adapter, 'delete', { collection: 'Doc', objectId: ids.bob1, acl: write(ALICE) });
    await expect(attempt).rejects.toThrow('Object not found');

    await call(adapter, 'delete', { collection: 'Doc', objectId: ids.bob1, acl: write(BOB) });
    await expect(call(adapter, 'fetch', { collection: 'Doc', objectId: ids.bob1 })).rejects.toThrow('Object not found');
  });

  it('role write grants work end-to-end', async () => {
    const updated = await call(adapter, 'save', {
      collection: 'Doc',
      objectId: ids.role1,
      data: { title: 'editors only v2' },
      acl: write(CAROL_EDITOR)
    });
    expect(updated.title).toBe('editors only v2');
  });

  // ==========================================================================
  // The ephemeral mock cannot enforce — must refuse, not silently allow
  // ==========================================================================

  it('an acl option against the ephemeral mock is a hard error', async () => {
    const failingEngine = {
      name: 'failing-test-engine',
      open() {
        throw new Error('simulated engine open failure');
      }
    };
    const mockAdapter = new LocalSQLAdapter(path.join(tmpDir, 'unused.db'), {
      allowEphemeral: true,
      engine: failingEngine
    });
    await mockAdapter.connect();
    expect(mockAdapter.getPersistenceStatus().ephemeral).toBe(true);

    await expect(call(mockAdapter, 'query', { collection: 'Doc', acl: read(ANON) })).rejects.toThrow(
      /ACL enforcement is not available in ephemeral/
    );
    // Without an acl context the mock keeps working (dev-open path).
    await call(mockAdapter, 'create', { collection: 'Doc', data: { title: 'mock row' } });
    const [results] = await call(mockAdapter, 'query', { collection: 'Doc' });
    expect(results.length).toBe(1);
    await mockAdapter.disconnect();
  });
});
