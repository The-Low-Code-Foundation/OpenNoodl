/**
 * SQLite engine resolver + shim (WF-004 — the engine seam).
 *
 * The rest of the adapter stack (LocalSQLAdapter, SchemaManager) is written
 * against the `better-sqlite3` handle shape:
 *
 *   const db = new Database(path);
 *   db.pragma('journal_mode = WAL');
 *   const stmt = db.prepare(sql);
 *   stmt.get(...p); stmt.all(...p); stmt.run(...p);
 *   db.exec(sql);
 *   db.transaction(fn)();
 *   db.close();
 *
 * This module is the ONE place the concrete engine is chosen. It resolves, in
 * order of preference:
 *
 *   1. `node:sqlite` (`DatabaseSync`) — built into Node ≥22.13 / ≥23.4,
 *      flag-free, zero native dependency, zero ABI matrix. Wrapped by a thin
 *      shim (`wrapNodeSqlite`) that adds the two methods `node:sqlite` lacks
 *      (`pragma`, `transaction`) so the rest of the stack is untouched.
 *   2. `better-sqlite3` — used only if it is actually installed AND
 *      `node:sqlite` is unavailable (older Node). It already matches the shape,
 *      so it is returned as-is.
 *
 * WF-004 engine decision: Option A (`node:sqlite`). See the NOTES section in
 * dev-docs/tasks/phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md and the
 * committed compatibility test. `better-sqlite3` is intentionally NOT a
 * dependency of any package — a dependency that does not exist cannot break.
 *
 * @module adapters/local-sql/engine
 */

/**
 * Minimum Node version that ships `node:sqlite` flag-free.
 * (Added behind `--experimental-sqlite` in 22.5; unflagged in 22.13 / 23.4.)
 */
export const NODE_SQLITE_MIN = [22, 13, 0];

/** A statement handle shaped like better-sqlite3's Statement. */
export interface EngineStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

/**
 * A database handle shaped like a better-sqlite3 Database — the shape the
 * adapter stack consumes.
 */
export interface EngineDatabase {
  prepare(sql: string): EngineStatement;
  exec(sql: string): void;
  pragma(source: string): unknown;
  transaction(fn: (...args: unknown[]) => unknown): (...args: unknown[]) => unknown;
  close(): void;
}

export interface ResolvedEngine {
  /** Engine identifier, e.g. 'node:sqlite' or 'better-sqlite3'. */
  name: string;
  /** Open/create a database at dbPath. */
  open(dbPath: string): EngineDatabase;
}

/** The slice of `node:sqlite`'s DatabaseSync the shim reads. */
interface NodeSqliteDatabaseLike {
  prepare(sql: string): EngineStatement;
  exec(sql: string): void;
  close(): void;
}

/**
 * Parse a semver-ish string ("22.22.0") into a numeric tuple.
 */
function parseVersion(v: string): number[] {
  return String(v)
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/**
 * @returns true if a >= b
 */
function gte(a: number[], b: number[]): boolean {
  for (let i = 0; i < b.length; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

/**
 * Wrap a `node:sqlite` DatabaseSync instance in a better-sqlite3-shaped handle.
 *
 * The only two gaps are `pragma()` and `transaction()`; everything else
 * (`prepare`, `exec`, `close`) passes straight through — the StatementSync
 * already exposes get/all/run with variadic positional params, matching the
 * adapter's `stmt.get(...params)` call style.
 */
export function wrapNodeSqlite(db: NodeSqliteDatabaseLike): EngineDatabase {
  return {
    prepare(sql) {
      return db.prepare(sql);
    },
    exec(sql) {
      return db.exec(sql);
    },
    close() {
      return db.close();
    },
    /**
     * better-sqlite3-compatible pragma(). Runs `PRAGMA <source>` and returns
     * the result rows (better-sqlite3 returns the value; we return rows, which
     * is sufficient for the adapter's fire-and-forget `pragma('journal_mode = WAL')`).
     */
    pragma(source) {
      const stmt = db.prepare('PRAGMA ' + source);
      try {
        return stmt.all();
      } catch (e) {
        // Some pragmas cannot be prepared/queried; fall back to exec.
        db.exec('PRAGMA ' + source);
        return undefined;
      }
    },
    /**
     * Single-level transaction shim matching `db.transaction(fn)()`.
     * better-sqlite3 supports nested savepoints; the adapter never nests, so a
     * plain BEGIN/COMMIT/ROLLBACK is sufficient and is documented as such.
     */
    transaction(fn) {
      return (...args) => {
        db.exec('BEGIN');
        try {
          const result = fn(...args);
          db.exec('COMMIT');
          return result;
        } catch (e) {
          try {
            db.exec('ROLLBACK');
          } catch (rollbackError) {
            /* ignore rollback failure; surface the original error */
          }
          throw e;
        }
      };
    }
  };
}

/**
 * Try to resolve `node:sqlite`.
 * @returns null if unavailable (older Node / build without it).
 */
export function tryNodeSqlite(): ResolvedEngine | null {
  if (!gte(parseVersion(process.versions.node), NODE_SQLITE_MIN)) {
    return null;
  }
  let DatabaseSync: unknown;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    // Sandboxed module systems can fail the plain require even though the
    // builtin exists — jest's resolver predates node:sqlite and tries to open
    // it as a file (and it intercepts createRequire too). getBuiltinModule
    // (Node ≥22.3) reaches the builtin below the module system entirely;
    // identical behaviour outside sandboxes.
    try {
      // getBuiltinModule shipped in Node 22.3; the workspace @types/node predates it.
      ({ DatabaseSync } = (
        process as unknown as { getBuiltinModule(id: string): { DatabaseSync?: unknown } }
      ).getBuiltinModule('node:sqlite'));
    } catch (e2) {
      return null;
    }
  }
  if (typeof DatabaseSync !== 'function') {
    return null;
  }
  const DatabaseSyncCtor = DatabaseSync as new (dbPath: string) => NodeSqliteDatabaseLike;
  return {
    name: 'node:sqlite',
    open(dbPath) {
      const db = new DatabaseSyncCtor(dbPath);
      return wrapNodeSqlite(db);
    }
  };
}

/**
 * Try to resolve `better-sqlite3` (only if actually installed).
 */
export function tryBetterSqlite3(): ResolvedEngine | null {
  let Database: new (dbPath: string) => EngineDatabase;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    return null;
  }
  return {
    name: 'better-sqlite3',
    open(dbPath) {
      // Already the shape the adapter expects.
      return new Database(dbPath);
    }
  };
}

/**
 * Resolve the best available SQLite engine.
 *
 * Order: node:sqlite (preferred), then better-sqlite3 (legacy fallback).
 * Returns null when neither is available so the caller can throw the loud
 * LocalBackendPersistenceError (RUN-004 policy) rather than silently mocking.
 */
export function resolveEngine(): ResolvedEngine | null {
  return tryNodeSqlite() || tryBetterSqlite3() || null;
}
