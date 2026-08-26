const { resolveEngine } = require('../../src/api/adapters/local-sql');
const QueryBuilder = require('../../src/api/adapters/local-sql/QueryBuilder');

describe('QueryBuilder', () => {
  describe('escapeTable', () => {
    it('escapes table names', () => {
      expect(QueryBuilder.escapeTable('users')).toBe('"users"');
      expect(QueryBuilder.escapeTable('User_Data')).toBe('"User_Data"');
    });

    it('removes invalid characters from table names', () => {
      expect(QueryBuilder.escapeTable('users; DROP TABLE')).toBe('"usersDROPTABLE"');
      expect(QueryBuilder.escapeTable("users'--")).toBe('"users"');
    });
  });

  describe('escapeColumn', () => {
    it('escapes column names', () => {
      expect(QueryBuilder.escapeColumn('name')).toBe('"name"');
      expect(QueryBuilder.escapeColumn('user_id')).toBe('"user_id"');
    });

    it('handles reserved words', () => {
      expect(QueryBuilder.escapeColumn('order')).toBe('"order"');
      expect(QueryBuilder.escapeColumn('select')).toBe('"select"');
    });
  });

  describe('buildWhereClause', () => {
    it('returns empty string for empty where', () => {
      const params = [];
      expect(QueryBuilder.buildWhereClause({}, params)).toBe('');
      expect(QueryBuilder.buildWhereClause(null, params)).toBe('');
      expect(QueryBuilder.buildWhereClause(undefined, params)).toBe('');
    });

    it('handles $eq operator', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause({ name: { $eq: 'John' } }, params);
      expect(result).toBe('"name" = ?');
      expect(params).toEqual(['John']);
    });

    it('handles $ne operator', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause({ status: { $ne: 'deleted' } }, params);
      expect(result).toBe('"status" != ?');
      expect(params).toEqual(['deleted']);
    });

    it('handles $gt, $gte, $lt, $lte operators', () => {
      let params = [];
      expect(QueryBuilder.buildWhereClause({ age: { $gt: 18 } }, params)).toBe('"age" > ?');
      expect(params).toEqual([18]);

      params = [];
      expect(QueryBuilder.buildWhereClause({ age: { $gte: 21 } }, params)).toBe('"age" >= ?');
      expect(params).toEqual([21]);

      params = [];
      expect(QueryBuilder.buildWhereClause({ age: { $lt: 65 } }, params)).toBe('"age" < ?');
      expect(params).toEqual([65]);

      params = [];
      expect(QueryBuilder.buildWhereClause({ age: { $lte: 100 } }, params)).toBe('"age" <= ?');
      expect(params).toEqual([100]);
    });

    it('handles $in operator', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause({ status: { $in: ['active', 'pending'] } }, params);
      expect(result).toBe('"status" IN (?, ?)');
      expect(params).toEqual(['active', 'pending']);
    });

    it('handles $nin operator', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause({ status: { $nin: ['deleted', 'archived'] } }, params);
      expect(result).toBe('"status" NOT IN (?, ?)');
      expect(params).toEqual(['deleted', 'archived']);
    });

    it('handles $exists operator', () => {
      let params = [];
      expect(QueryBuilder.buildWhereClause({ email: { $exists: true } }, params)).toBe('"email" IS NOT NULL');
      expect(params).toEqual([]);

      params = [];
      expect(QueryBuilder.buildWhereClause({ phone: { $exists: false } }, params)).toBe('"phone" IS NULL');
      expect(params).toEqual([]);
    });

    it('handles $and operator', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause(
        {
          $and: [{ name: { $eq: 'John' } }, { age: { $gt: 18 } }]
        },
        params
      );
      expect(result).toBe('("name" = ? AND "age" > ?)');
      expect(params).toEqual(['John', 18]);
    });

    it('handles $or operator', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause(
        {
          $or: [{ status: { $eq: 'active' } }, { status: { $eq: 'pending' } }]
        },
        params
      );
      expect(result).toBe('("status" = ? OR "status" = ?)');
      expect(params).toEqual(['active', 'pending']);
    });

    it('handles nested $and and $or', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause(
        {
          $and: [{ $or: [{ type: { $eq: 'A' } }, { type: { $eq: 'B' } }] }, { active: { $eq: true } }]
        },
        params
      );
      expect(result).toBe('(("type" = ? OR "type" = ?) AND "active" = ?)');
      // 🔴 `1`, not `true` — SB-008 F18/F19. This assertion (and three more like
      // it below) pinned a raw JS boolean as the correct parameter, and
      // better-sqlite3 REFUSES to bind one: every WHERE clause these four specs
      // certified threw `Provided value cannot be bound to SQLite parameter 1`
      // the moment it reached `db.prepare(sql).all(...params)`. The suite was
      // green over a query that could not run.
      //
      // ⚠️ The contradiction was already in this file, eleven lines apart:
      // `serializeValue(true) === 1` is asserted below, so the write path's
      // conversion was pinned correct and the read path's absence was pinned
      // correct too. A params list is only evidence if something binds it.
      expect(params).toEqual(['A', 'B', 1]);
    });

    it('handles direct equality', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause({ name: 'John' }, params);
      expect(result).toBe('"name" = ?');
      expect(params).toEqual(['John']);
    });

    it('handles Parse Date type', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause(
        {
          createdAt: { $gt: { __type: 'Date', iso: '2024-01-01T00:00:00.000Z' } }
        },
        params
      );
      expect(result).toBe('"createdAt" > ?');
      expect(params).toEqual(['2024-01-01T00:00:00.000Z']);
    });

    it('handles Parse Pointer type', () => {
      const params = [];
      const result = QueryBuilder.buildWhereClause(
        {
          author: { $eq: { __type: 'Pointer', objectId: 'abc123', className: 'User' } }
        },
        params
      );
      expect(result).toBe('"author" = ?');
      expect(params).toEqual(['abc123']);
    });

    it('handles null equality', () => {
      let params = [];
      expect(QueryBuilder.buildWhereClause({ name: { $eq: null } }, params)).toBe('"name" IS NULL');

      params = [];
      expect(QueryBuilder.buildWhereClause({ name: { $ne: null } }, params)).toBe('"name" IS NOT NULL');
    });
  });

  /**
   * SB-008 F18 — a boolean filter, in every operator that can carry one.
   *
   * The write path folds booleans to 0/1 (`serializeValue`, asserted below) and
   * until this block the read path did not, so a row this driver had itself
   * stored as `1` could not be asked for by the literal it was written as. The
   * symptom was not a wrong answer: better-sqlite3 refuses to bind a JS boolean,
   * so the query THREW — a 500 from `/classes/:c`, `query-records/query-failed`
   * in a browser, and an empty navigation on every page of the site-builder
   * template (SB-006's derived nav).
   *
   * Every operator is covered rather than `$eq` alone: a boolean is legal in all
   * of them, and a half-converted set is the harder bug to find.
   */
  describe('a boolean is bound as 0/1, never as a JS boolean (SB-008 F18)', () => {
    const paramsFor = (where) => {
      const params = [];
      QueryBuilder.buildWhereClause(where, params);
      return params;
    };

    it('converts direct equality', () => {
      expect(paramsFor({ showInNav: true })).toEqual([1]);
      expect(paramsFor({ showInNav: false })).toEqual([0]);
    });

    it('converts $eq and $ne', () => {
      expect(paramsFor({ published: { $eq: true } })).toEqual([1]);
      expect(paramsFor({ published: { $ne: false } })).toEqual([0]);
    });

    it('converts every member of $in and $nin', () => {
      // The list form is where a half-fix hides: one unconverted member is
      // enough to make the whole statement unbindable.
      expect(paramsFor({ flag: { $in: [true, false] } })).toEqual([1, 0]);
      expect(paramsFor({ flag: { $nin: [false, true] } })).toEqual([0, 1]);
    });

    it('leaves the values it is not about alone', () => {
      // The negative control: converting booleans must not convert anything
      // else, and `0`/`1` arriving as numbers must stay numbers.
      expect(paramsFor({ n: { $eq: 1 } })).toEqual([1]);
      expect(paramsFor({ s: { $eq: 'true' } })).toEqual(['true']);
      expect(paramsFor({ d: { $gt: { __type: 'Date', iso: '2024-01-01T00:00:00.000Z' } } })).toEqual([
        '2024-01-01T00:00:00.000Z'
      ]);
    });

    /**
     * 🔴 F19 — the assertion the four pre-existing specs were missing.
     *
     * A `params` list is only evidence if something binds it. Four specs in this
     * file certified `[…, true]` as the correct parameter list for a WHERE
     * clause that could not execute, and stayed green for as long as nothing in
     * the suite handed those params to a statement. This one does, and the
     * second half is the known-firing control: the *unconverted* value throws,
     * so the first half is a measurement rather than a tautology.
     */
    it('🔴 the converted value BINDS and the raw boolean does not', () => {
      const engine = resolveEngine();
      if (!engine) throw new Error('no SQLite engine resolved — this spec cannot measure anything');
      const db = engine.open(':memory:');
      db.exec('CREATE TABLE t ("objectId" TEXT, "showInNav" INTEGER)');
      db.prepare('INSERT INTO t VALUES (?, ?)').run('a', 1);
      db.prepare('INSERT INTO t VALUES (?, ?)').run('b', 0);

      const params = [];
      const where = QueryBuilder.buildWhereClause({ showInNav: true }, params);
      const rows = db.prepare(`SELECT "objectId" FROM t WHERE ${where}`).all(...params);
      expect(rows.map((r) => r.objectId)).toEqual(['a']);

      // The control: the shape the four specs pinned, against the same statement.
      expect(() => db.prepare(`SELECT "objectId" FROM t WHERE ${where}`).all(true)).toThrow();

      db.close();
    });
  });

  describe('buildOrderClause', () => {
    it('returns empty string for empty sort', () => {
      expect(QueryBuilder.buildOrderClause(null)).toBe('');
      expect(QueryBuilder.buildOrderClause(undefined)).toBe('');
      expect(QueryBuilder.buildOrderClause('')).toBe('');
    });

    it('handles ascending sort', () => {
      expect(QueryBuilder.buildOrderClause('name')).toBe('"name" ASC');
      expect(QueryBuilder.buildOrderClause(['name'])).toBe('"name" ASC');
    });

    it('handles descending sort', () => {
      expect(QueryBuilder.buildOrderClause('-createdAt')).toBe('"createdAt" DESC');
      expect(QueryBuilder.buildOrderClause(['-createdAt'])).toBe('"createdAt" DESC');
    });

    it('handles multiple sort fields', () => {
      expect(QueryBuilder.buildOrderClause(['name', '-createdAt'])).toBe('"name" ASC, "createdAt" DESC');
      expect(QueryBuilder.buildOrderClause('name,-createdAt')).toBe('"name" ASC, "createdAt" DESC');
    });
  });

  describe('buildSelect', () => {
    it('builds basic select', () => {
      const { sql, params } = QueryBuilder.buildSelect({ collection: 'users' });
      expect(sql).toBe('SELECT * FROM "users"');
      expect(params).toEqual([]);
    });

    it('builds select with where', () => {
      const { sql, params } = QueryBuilder.buildSelect({
        collection: 'users',
        where: { active: { $eq: true } }
      });
      expect(sql).toBe('SELECT * FROM "users" WHERE "active" = ?');
      expect(params).toEqual([1]); // F18: a bound boolean is 0/1, never a JS boolean
    });

    it('builds select with sort', () => {
      const { sql, params } = QueryBuilder.buildSelect({
        collection: 'users',
        sort: '-createdAt'
      });
      expect(sql).toBe('SELECT * FROM "users" ORDER BY "createdAt" DESC');
      expect(params).toEqual([]);
    });

    it('builds select with limit and skip', () => {
      const { sql, params } = QueryBuilder.buildSelect({
        collection: 'users',
        limit: 10,
        skip: 20
      });
      expect(sql).toBe('SELECT * FROM "users" LIMIT ? OFFSET ?');
      expect(params).toEqual([10, 20]);
    });

    it('builds select with specific fields', () => {
      const { sql, params } = QueryBuilder.buildSelect({
        collection: 'users',
        select: ['name', 'email']
      });
      expect(sql).toContain('SELECT');
      expect(sql).toContain('"objectId"');
      expect(sql).toContain('"name"');
      expect(sql).toContain('"email"');
    });

    it('builds complete query', () => {
      const { sql, params } = QueryBuilder.buildSelect({
        collection: 'users',
        where: { age: { $gte: 18 } },
        sort: ['name', '-createdAt'],
        limit: 10,
        skip: 5
      });
      expect(sql).toBe('SELECT * FROM "users" WHERE "age" >= ? ORDER BY "name" ASC, "createdAt" DESC LIMIT ? OFFSET ?');
      expect(params).toEqual([18, 10, 5]);
    });
  });

  describe('buildCount', () => {
    it('builds basic count', () => {
      const { sql, params } = QueryBuilder.buildCount({ collection: 'users' });
      expect(sql).toBe('SELECT COUNT(*) as count FROM "users"');
      expect(params).toEqual([]);
    });

    it('builds count with where', () => {
      const { sql, params } = QueryBuilder.buildCount({
        collection: 'users',
        where: { active: { $eq: true } }
      });
      expect(sql).toBe('SELECT COUNT(*) as count FROM "users" WHERE "active" = ?');
      expect(params).toEqual([1]); // F18: a bound boolean is 0/1, never a JS boolean
    });
  });

  describe('buildInsert', () => {
    it('builds insert with objectId', () => {
      const { sql, params } = QueryBuilder.buildInsert(
        { collection: 'users', data: { name: 'John', age: 30 } },
        'abc123'
      );
      expect(sql).toContain('INSERT INTO "users"');
      expect(sql).toContain('"objectId"');
      expect(sql).toContain('"name"');
      expect(sql).toContain('"age"');
      expect(params).toContain('abc123');
      expect(params).toContain('John');
      expect(params).toContain(30);
    });
  });

  describe('buildUpdate', () => {
    it('builds update', () => {
      const { sql, params } = QueryBuilder.buildUpdate({
        collection: 'users',
        objectId: 'abc123',
        data: { name: 'Jane' }
      });
      expect(sql).toContain('UPDATE "users" SET');
      expect(sql).toContain('"name" = ?');
      expect(sql).toContain('WHERE "objectId" = ?');
      expect(params).toContain('Jane');
      expect(params).toContain('abc123');
    });
  });

  describe('buildDelete', () => {
    it('builds delete', () => {
      const { sql, params } = QueryBuilder.buildDelete({
        collection: 'users',
        objectId: 'abc123'
      });
      expect(sql).toBe('DELETE FROM "users" WHERE "objectId" = ?');
      expect(params).toEqual(['abc123']);
    });
  });

  describe('buildIncrement', () => {
    it('builds increment', () => {
      const { sql, params } = QueryBuilder.buildIncrement({
        collection: 'posts',
        objectId: 'abc123',
        properties: { views: 1, likes: 5 }
      });
      expect(sql).toContain('UPDATE "posts" SET');
      expect(sql).toContain('"views" = COALESCE("views", 0) + ?');
      expect(sql).toContain('"likes" = COALESCE("likes", 0) + ?');
      expect(params).toContain(1);
      expect(params).toContain(5);
      expect(params).toContain('abc123');
    });
  });

  describe('buildDistinct', () => {
    it('builds distinct', () => {
      const { sql, params } = QueryBuilder.buildDistinct({
        collection: 'users',
        property: 'country'
      });
      expect(sql).toBe('SELECT DISTINCT "country" FROM "users"');
      expect(params).toEqual([]);
    });

    it('builds distinct with where', () => {
      const { sql, params } = QueryBuilder.buildDistinct({
        collection: 'users',
        property: 'country',
        where: { active: { $eq: true } }
      });
      expect(sql).toBe('SELECT DISTINCT "country" FROM "users" WHERE "active" = ?');
      expect(params).toEqual([1]); // F18: a bound boolean is 0/1, never a JS boolean
    });
  });

  describe('buildAggregate', () => {
    it('builds aggregate with sum', () => {
      const { sql, params } = QueryBuilder.buildAggregate({
        collection: 'orders',
        group: { totalAmount: { sum: 'amount' } }
      });
      expect(sql).toBe('SELECT SUM("amount") as "totalAmount" FROM "orders"');
      expect(params).toEqual([]);
    });

    it('builds aggregate with avg', () => {
      const { sql, params } = QueryBuilder.buildAggregate({
        collection: 'products',
        group: { avgPrice: { avg: 'price' } }
      });
      expect(sql).toBe('SELECT AVG("price") as "avgPrice" FROM "products"');
      expect(params).toEqual([]);
    });

    it('builds aggregate with max and min', () => {
      const { sql, params } = QueryBuilder.buildAggregate({
        collection: 'products',
        group: {
          maxPrice: { max: 'price' },
          minPrice: { min: 'price' }
        }
      });
      expect(sql).toContain('MAX("price") as "maxPrice"');
      expect(sql).toContain('MIN("price") as "minPrice"');
    });

    it('builds aggregate with where', () => {
      const { sql, params } = QueryBuilder.buildAggregate({
        collection: 'orders',
        where: { status: { $eq: 'completed' } },
        group: { total: { sum: 'amount' } }
      });
      expect(sql).toContain('WHERE "status" = ?');
      expect(params).toEqual(['completed']);
    });
  });

  describe('serializeValue', () => {
    it('handles null and undefined', () => {
      expect(QueryBuilder.serializeValue(null)).toBe(null);
      expect(QueryBuilder.serializeValue(undefined)).toBe(null);
    });

    it('handles primitives', () => {
      expect(QueryBuilder.serializeValue('hello')).toBe('hello');
      expect(QueryBuilder.serializeValue(42)).toBe(42);
      expect(QueryBuilder.serializeValue(true)).toBe(1);
      expect(QueryBuilder.serializeValue(false)).toBe(0);
    });

    it('handles Date objects', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(QueryBuilder.serializeValue(date)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('handles Parse Date type', () => {
      expect(QueryBuilder.serializeValue({ __type: 'Date', iso: '2024-01-01T00:00:00.000Z' })).toBe(
        '2024-01-01T00:00:00.000Z'
      );
    });

    it('handles Parse Pointer type', () => {
      expect(QueryBuilder.serializeValue({ __type: 'Pointer', objectId: 'abc123', className: 'User' })).toBe('abc123');
    });

    it('handles arrays and objects as JSON', () => {
      expect(QueryBuilder.serializeValue([1, 2, 3])).toBe('[1,2,3]');
      expect(QueryBuilder.serializeValue({ foo: 'bar' })).toBe('{"foo":"bar"}');
    });
  });

  describe('deserializeValue', () => {
    it('handles null and undefined', () => {
      expect(QueryBuilder.deserializeValue(null)).toBe(null);
      expect(QueryBuilder.deserializeValue(undefined)).toBe(null);
    });

    it('handles Boolean type', () => {
      expect(QueryBuilder.deserializeValue(1, 'Boolean')).toBe(true);
      expect(QueryBuilder.deserializeValue(0, 'Boolean')).toBe(false);
    });

    it('handles JSON strings for Object type', () => {
      expect(QueryBuilder.deserializeValue('{"foo":"bar"}', 'Object')).toEqual({ foo: 'bar' });
    });

    it('handles JSON strings for Array type', () => {
      expect(QueryBuilder.deserializeValue('[1,2,3]', 'Array')).toEqual([1, 2, 3]);
    });

    it('auto-parses JSON strings', () => {
      expect(QueryBuilder.deserializeValue('{"foo":"bar"}')).toEqual({ foo: 'bar' });
      expect(QueryBuilder.deserializeValue('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('returns non-JSON strings as-is', () => {
      expect(QueryBuilder.deserializeValue('hello')).toBe('hello');
      expect(QueryBuilder.deserializeValue('not json {')).toBe('not json {');
    });
  });

  describe('toFts5MatchQuery (BAK-008)', () => {
    it('quotes a single word as a literal phrase', () => {
      expect(QueryBuilder.toFts5MatchQuery('hello')).toBe('"hello"');
    });

    it('quotes each whitespace-separated word independently (implicit AND, order-insensitive)', () => {
      expect(QueryBuilder.toFts5MatchQuery('quick brown')).toBe('"quick" "brown"');
    });

    it('neutralizes FTS5 syntax characters that would otherwise be operators', () => {
      // Bare `-` means "exclude"; a hyphenated word must stay literal.
      expect(QueryBuilder.toFts5MatchQuery('state-of-the-art')).toBe('"state-of-the-art"');
      // Bare `:` means "column filter"; `*` means prefix wildcard.
      expect(QueryBuilder.toFts5MatchQuery('col:term')).toBe('"col:term"');
      expect(QueryBuilder.toFts5MatchQuery('wild*card')).toBe('"wild*card"');
    });

    it('escapes embedded double quotes per FTS5 string-literal syntax', () => {
      expect(QueryBuilder.toFts5MatchQuery('say "hi"')).toBe('"say" """hi"""');
    });

    it('collapses repeated whitespace and trims', () => {
      expect(QueryBuilder.toFts5MatchQuery('  quick   brown  ')).toBe('"quick" "brown"');
    });
  });
});
