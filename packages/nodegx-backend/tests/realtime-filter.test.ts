/**
 * BAK-001 filter matcher — the twin property that keeps realtime filtering and
 * SQL query membership in lockstep.
 *
 * `matchesFilter` (src/realtime/filter.ts) decides, in JS, whether a single
 * changed record should be delivered to a subscription. The query routes decide
 * the same thing in SQL (QueryBuilder.buildWhereClause). If they ever disagree,
 * a record a paired query returns would be undeliverable over realtime — or,
 * worse, a record a query hides would be pushed. This suite runs a GENERATED
 * matrix of filters against a real `node:sqlite` database and asserts, for every
 * (filter, record) pair, that `matchesFilter` === "the query returned this row".
 *
 * The records under test are produced by the LocalSQLAdapter itself, so the
 * matcher is checked against the exact record shape the change events carry.
 */
import type { LocalSqlAdapter, LocalSqlAdapterCtor } from './helpers/local-sql';
import { matchesFilter, assertFilterSupported, UnsupportedFilterError, Where } from '../src/realtime/filter';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEngine } = require('../../noodl-runtime/src/api/adapters/local-sql/engine');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LocalSQLAdapter: LocalSqlAdapterCtor = require('../../noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter');

/** Deterministic PRNG (mulberry32) so a failure reproduces exactly. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N_POOL = [0, 1, 2, 3, 4, 5, null];
const S_POOL = ['apple', 'banana', 'cherry', 'Date', 'egg', null]; // 'Date' exercises ASCII LIKE case-folding
const CAT_POOL = ['x', 'y', 'z', null];

function pick<T>(rng: () => number, pool: T[]): T {
  return pool[Math.floor(rng() * pool.length)];
}

interface Rec {
  objectId?: string;
  n: number | null;
  s: string | null;
  cat: string | null;
}

/** Build one random field-condition on a numeric or string field. */
function randomCondition(rng: () => number): Where {
  const r = rng();
  if (r < 0.34) {
    // numeric field
    const op = pick(rng, ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', 'direct']);
    if (op === 'direct') return { n: pick(rng, N_POOL) };
    if (op === '$exists') return { n: { $exists: rng() < 0.5 } };
    if (op === '$in' || op === '$nin') {
      const arr = [pick(rng, N_POOL.filter((v) => v !== null)), pick(rng, N_POOL.filter((v) => v !== null))];
      return { n: { [op]: arr } };
    }
    return { n: { [op]: pick(rng, N_POOL.filter((v) => v !== null)) } };
  }
  if (r < 0.7) {
    // string field
    const op = pick(rng, ['$eq', '$ne', '$in', '$nin', '$regex', '$exists', 'direct']);
    if (op === 'direct') return { s: pick(rng, S_POOL) };
    if (op === '$exists') return { s: { $exists: rng() < 0.5 } };
    if (op === '$in' || op === '$nin') {
      const arr = [pick(rng, S_POOL.filter((v) => v !== null)), pick(rng, S_POOL.filter((v) => v !== null))];
      return { s: { [op]: arr } };
    }
    if (op === '$regex') {
      // Plain substrings only (no %/_ wildcards, no regex metachars).
      return { s: { $regex: pick(rng, ['a', 'an', 'e', 'rr', 'DA']) } };
    }
    return { s: { [op]: pick(rng, S_POOL.filter((v) => v !== null)) } };
  }
  // category field, direct or $in
  if (rng() < 0.5) return { cat: pick(rng, CAT_POOL) };
  return { cat: { $in: [pick(rng, ['x', 'y']), pick(rng, ['z', 'x'])] } };
}

/** Combine 1–2 conditions, sometimes under $and/$or. */
function randomFilter(rng: () => number): Where {
  const r = rng();
  if (r < 0.45) return randomCondition(rng);
  if (r < 0.72) return { ...randomCondition(rng), ...randomCondition(rng) };
  const combinator = rng() < 0.5 ? '$and' : '$or';
  return { [combinator]: [randomCondition(rng), randomCondition(rng)] };
}

describe('matchesFilter is the exact twin of the SQL WHERE clause', () => {
  const engine = resolveEngine();

  let adapter: LocalSqlAdapter;
  let records: Rec[] = [];

  beforeAll(async () => {
    if (!engine) throw new Error('node:sqlite required for the realtime filter property test');
    adapter = new LocalSQLAdapter(':memory:', { engine, autoCreateTables: true });
    await adapter.connect();

    // First record has every field non-null so column types are inferred well.
    const seedRng = makeRng(1);
    const rows: Rec[] = [{ n: 3, s: 'apple', cat: 'x' }];
    for (let i = 0; i < 60; i++) {
      rows.push({ n: pick(seedRng, N_POOL), s: pick(seedRng, S_POOL), cat: pick(seedRng, CAT_POOL) });
    }

    records = [];
    for (const row of rows) {
      await new Promise<void>((resolve, reject) => {
        adapter.create({
          collection: 'Doc',
          data: row,
          success: (rec: Rec) => {
            records.push(rec);
            resolve();
          },
          error: (e: unknown) => reject(new Error(String(e)))
        });
      });
    }
  });

  afterAll(async () => {
    if (adapter) await adapter.disconnect();
  });

  function queryMembership(filter: Where): Set<string> {
    let ids: string[] = [];
    adapter.query({
      collection: 'Doc',
      where: filter,
      success: (results: Rec[]) => {
        ids = results.map((r) => r.objectId as string);
      },
      error: (e: unknown) => {
        throw new Error(String(e));
      }
    });
    return new Set(ids);
  }

  it('agrees with SQL membership across a large generated matrix', () => {
    const rng = makeRng(0xc0ffee);
    let comparisons = 0;
    for (let iter = 0; iter < 400; iter++) {
      const filter = randomFilter(rng);
      const inQuery = queryMembership(filter);
      for (const rec of records) {
        const viaJs = matchesFilter(filter, rec as unknown as Record<string, unknown>);
        const viaSql = inQuery.has(rec.objectId as string);
        if (viaJs !== viaSql) {
          throw new Error(
            `matcher/SQL disagreement:\n  filter=${JSON.stringify(filter)}\n  record=${JSON.stringify(rec)}\n` +
              `  matchesFilter=${viaJs} query=${viaSql}`
          );
        }
        comparisons++;
      }
    }
    expect(comparisons).toBeGreaterThan(20000);
  });

  it('an empty/absent filter matches every record (subscribe-to-all)', () => {
    for (const rec of records) {
      expect(matchesFilter(undefined, rec as unknown as Record<string, unknown>)).toBe(true);
      expect(matchesFilter({}, rec as unknown as Record<string, unknown>)).toBe(true);
    }
  });

  it('$relatedTo is refused for realtime, both at match and validation time', () => {
    const filter: Where = { $relatedTo: { object: { objectId: 'x', className: 'Y' }, key: 'k' } };
    expect(() => assertFilterSupported(filter)).toThrow(UnsupportedFilterError);
    expect(() => matchesFilter(filter, { n: 1 })).toThrow(UnsupportedFilterError);
    // Nested under $and is caught too.
    expect(() => assertFilterSupported({ $and: [{ n: 1 }, filter] })).toThrow(UnsupportedFilterError);
  });
});
