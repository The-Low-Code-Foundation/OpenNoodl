/**
 * LocalSQLAdapter — full-text search (BAK-008)
 *
 * The correctness properties pinned here:
 *   - FTS5 is actually available on the resolved engine (the "verify first"
 *     step the spec calls for) — a skipped/failing suite here IS the negative
 *     finding.
 *   - The FTS5 shadow table stays in sync under every write path that goes
 *     through plain SQL INSERT/UPDATE/DELETE on the content table — create,
 *     save, delete, AND a raw db.prepare() write that bypasses the adapter
 *     entirely (simulating BYOB / import / workflow writes, which all end up
 *     as ordinary SQL against the same table). Sync is a database trigger, not
 *     application code, so there is no path that can forget it.
 *   - rebuildSearchIndex is idempotent: calling it twice in a row (or after
 *     drift) converges to the same, correct end state.
 *   - Search composes with the row-level ACL predicate (BAK-003) exactly like
 *     query() — an unreadable row cannot be found via search.
 *   - Ranking is sane (a closer match ranks at or above a looser one) and
 *     snippets highlight the match.
 *   - Search against a collection with no index fails with a clear "not
 *     enabled" message, not a raw SQL error.
 *   - The ephemeral mock refuses search loudly (mirrors the ACL guard).
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
      success: (...args) => resolve(args.length > 1 ? args : args[0]),
      error: (msg) => reject(new Error(String(msg)))
    });
  });
}

describe('LocalSQLAdapter full-text search (FTS5)', () => {
  let tmpDir;
  let adapter;

  beforeAll(async () => {
    if (!realEngine) throw new Error('No SQLite engine available — these tests require node:sqlite');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noodl-search-test-'));
    adapter = new LocalSQLAdapter(path.join(tmpDir, 'search.db'));
    await adapter.connect();
  });

  afterAll(async () => {
    if (adapter) await adapter.disconnect();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('FTS5 is available on the resolved engine (verification step)', () => {
    expect(adapter.schemaManager.hasFts5Support()).toBe(true);
  });

  describe('index sync under every write path', () => {
    const ids = {};

    beforeAll(async () => {
      await call(adapter, 'create', { collection: 'Article', data: { title: 'x', body: 'x' } }).catch(() => {});
      // Ensure the table (and its columns) exist before indexing.
      const a = await call(adapter, 'create', {
        collection: 'Article',
        data: { title: 'Quick brown fox', body: 'The fox jumps over the lazy dog.' }
      });
      ids.a = a.objectId;
      const b = await call(adapter, 'create', {
        collection: 'Article',
        data: { title: 'Totally unrelated', body: 'Nothing to see here.' }
      });
      ids.b = b.objectId;

      adapter.schemaManager.rebuildSearchIndex('Article', ['title', 'body']);
    });

    it('a record created through the adapter is searchable immediately (INSERT trigger)', async () => {
      const [results] = await call(adapter, 'search', { collection: 'Article', search: 'quick brown' });
      expect(results.map((r) => r.objectId)).toContain(ids.a);
      expect(results.map((r) => r.objectId)).not.toContain(ids.b);
    });

    it('a record saved through the adapter re-syncs (UPDATE trigger)', async () => {
      await call(adapter, 'save', { collection: 'Article', objectId: ids.b, data: { title: 'Now mentions zebras' } });
      const [results] = await call(adapter, 'search', { collection: 'Article', search: 'zebras' });
      expect(results.map((r) => r.objectId)).toEqual([ids.b]);
    });

    it('a record deleted through the adapter disappears from search (DELETE trigger)', async () => {
      await call(adapter, 'delete', { collection: 'Article', objectId: ids.b });
      const [results] = await call(adapter, 'search', { collection: 'Article', search: 'zebras' });
      expect(results.length).toBe(0);
    });

    it('a write that bypasses the adapter entirely (raw SQL — BYOB/import/workflow shape) still syncs', async () => {
      const db = adapter.getDatabase();
      const rawId = 'raw-write-1';
      db.prepare(
        'INSERT INTO "Article" ("objectId","createdAt","updatedAt","title","body","ACL") VALUES (?,?,?,?,?,?)'
      ).run(rawId, new Date().toISOString(), new Date().toISOString(), 'Marmots everywhere', 'Alpine rodents.', null);

      const [results] = await call(adapter, 'search', { collection: 'Article', search: 'marmots' });
      expect(results.map((r) => r.objectId)).toEqual([rawId]);

      // And a raw UPDATE / DELETE also stay in sync — the trigger fires
      // regardless of which code path issued the statement.
      db.prepare('UPDATE "Article" SET "title" = ? WHERE "objectId" = ?').run('Renamed away', rawId);
      const [afterUpdate] = await call(adapter, 'search', { collection: 'Article', search: 'marmots' });
      expect(afterUpdate.length).toBe(0);

      db.prepare('DELETE FROM "Article" WHERE "objectId" = ?').run(rawId);
      const [afterDelete] = await call(adapter, 'search', { collection: 'Article', search: 'renamed' });
      expect(afterDelete.length).toBe(0);
    });
  });

  describe('rebuild: explicit, reported, idempotent', () => {
    beforeAll(async () => {
      await call(adapter, 'create', { collection: 'Note', data: { title: 'Alpha note', tag: 'x' } });
      await call(adapter, 'create', { collection: 'Note', data: { title: 'Beta note', tag: 'y' } });
    });

    it('reports rows indexed and elapsed time', () => {
      const report = adapter.schemaManager.rebuildSearchIndex('Note', ['title']);
      expect(report).toMatchObject({ tableName: 'Note', fields: ['title'], tokenizer: 'unicode61' });
      expect(report.rowsIndexed).toBe(2);
      expect(typeof report.elapsedMs).toBe('number');
    });

    it('is idempotent: calling it repeatedly converges to the same correct state', async () => {
      adapter.schemaManager.rebuildSearchIndex('Note', ['title']);
      adapter.schemaManager.rebuildSearchIndex('Note', ['title']);
      adapter.schemaManager.rebuildSearchIndex('Note', ['title']);
      const [results] = await call(adapter, 'search', { collection: 'Note', search: 'alpha' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Alpha note');
    });

    it('reindexing after a field-set change picks up the new field', async () => {
      // 'tag' was never indexed (rebuild above only indexed 'title'); search
      // for its value should find nothing until the field is added and rebuilt.
      const [before] = await call(adapter, 'search', { collection: 'Note', search: 'y' });
      expect(before.length).toBe(0);

      adapter.schemaManager.rebuildSearchIndex('Note', ['title', 'tag']);
      const [after] = await call(adapter, 'search', { collection: 'Note', search: 'y' });
      expect(after.map((r) => r.title)).toEqual(['Beta note']);
    });
  });

  describe('ACL composition (shared reasoning with BAK-003)', () => {
    const ids = {};

    beforeAll(async () => {
      const pub = await call(adapter, 'create', {
        collection: 'Secret',
        data: { title: 'public findable secret', body: 'anyone can find this' }
      });
      ids.pub = pub.objectId;
      const priv = await call(adapter, 'create', {
        collection: 'Secret',
        data: { title: 'private findable secret', body: 'only alice can find this' }
      });
      // create() doesn't stamp ACLs itself (that's the HTTP layer's stampCreate,
      // BAK-003) — set it directly so this test only exercises the SQL predicate.
      const db = adapter.getDatabase();
      db.prepare('UPDATE "Secret" SET "ACL" = ? WHERE "objectId" = ?').run(
        JSON.stringify({ 'user-alice': { read: true, write: true } }),
        priv.objectId
      );
      ids.priv = priv.objectId;

      adapter.schemaManager.rebuildSearchIndex('Secret', ['title', 'body']);
    });

    it('without an acl context, both rows are findable (baseline)', async () => {
      const [results] = await call(adapter, 'search', { collection: 'Secret', search: 'findable' });
      expect(results.length).toBe(2);
    });

    it('a user who cannot read a record cannot find it via search', async () => {
      const [results] = await call(adapter, 'search', {
        collection: 'Secret',
        search: 'findable',
        acl: { access: 'read', keys: ['*', 'user-bob'] }
      });
      expect(results.map((r) => r.objectId)).toEqual([ids.pub]);
    });

    it('the owning user CAN find their ACL-restricted record via search', async () => {
      const [results] = await call(adapter, 'search', {
        collection: 'Secret',
        search: 'findable',
        acl: { access: 'read', keys: ['*', 'user-alice'] }
      });
      expect(results.map((r) => r.objectId).sort()).toEqual([ids.priv, ids.pub].sort());
    });

    it('search filters compose with a structured where AND the ACL predicate', async () => {
      const [results] = await call(adapter, 'search', {
        collection: 'Secret',
        search: 'findable',
        where: { title: { $eq: 'private findable secret' } },
        acl: { access: 'read', keys: ['*', 'user-alice'] }
      });
      expect(results.map((r) => r.objectId)).toEqual([ids.priv]);

      const [asBob] = await call(adapter, 'search', {
        collection: 'Secret',
        search: 'findable',
        where: { title: { $eq: 'private findable secret' } },
        acl: { access: 'read', keys: ['*', 'user-bob'] }
      });
      expect(asBob.length).toBe(0);
    });

    it('an acl option against the ephemeral mock is a hard error (search never silently un-enforces)', async () => {
      const failingEngine = {
        name: 'failing-test-engine',
        open() {
          throw new Error('simulated engine open failure');
        }
      };
      const mockAdapter = new LocalSQLAdapter(path.join(tmpDir, 'unused-search.db'), {
        allowEphemeral: true,
        engine: failingEngine
      });
      await mockAdapter.connect();
      await expect(
        call(mockAdapter, 'search', { collection: 'Secret', search: 'x', acl: { access: 'read', keys: ['*'] } })
      ).rejects.toThrow(/ACL enforcement is not available in ephemeral/);
      // Even without an acl context, search itself is refused in mock mode —
      // there is no FTS5 to evaluate MATCH against.
      await expect(call(mockAdapter, 'search', { collection: 'Secret', search: 'x' })).rejects.toThrow(
        /Full-text search is not available in ephemeral/
      );
      await mockAdapter.disconnect();
    });
  });

  describe('ranking and snippets', () => {
    beforeAll(async () => {
      await call(adapter, 'create', {
        collection: 'Ranked',
        data: { title: 'quick quick quick', body: 'quick brown fox quick' }
      });
      await call(adapter, 'create', {
        collection: 'Ranked',
        data: { title: 'a mention of quick', body: 'otherwise unrelated content entirely' }
      });
      adapter.schemaManager.rebuildSearchIndex('Ranked', ['title', 'body']);
    });

    it('a record with more/denser matches ranks at or above one with a single incidental match', async () => {
      const [results] = await call(adapter, 'search', { collection: 'Ranked', search: 'quick' });
      expect(results.length).toBe(2);
      // Higher _score = better match (sign-flipped bm25).
      expect(results[0].title).toBe('quick quick quick');
      expect(results[0]._score).toBeGreaterThan(results[1]._score);
    });

    it('snippets highlight the matched term', async () => {
      const [results] = await call(adapter, 'search', { collection: 'Ranked', search: 'quick' });
      expect(results[0]._snippet).toContain('<mark>');
      expect(results[0]._snippet.toLowerCase()).toContain('quick');
    });
  });

  describe('searching a collection with no index', () => {
    it('fails with a clear "not enabled" message, not a raw SQL error', async () => {
      await call(adapter, 'create', { collection: 'Unindexed', data: { title: 'hello' } });
      await expect(call(adapter, 'search', { collection: 'Unindexed', search: 'hello' })).rejects.toThrow(
        /Search is not enabled for collection "Unindexed"/
      );
    });
  });

  describe('empty search term', () => {
    it('is rejected rather than silently matching everything', async () => {
      await expect(call(adapter, 'search', { collection: 'Ranked', search: '' })).rejects.toThrow(
        /requires a non-empty/
      );
      await expect(call(adapter, 'search', { collection: 'Ranked' })).rejects.toThrow(/requires a non-empty/);
    });
  });
});
