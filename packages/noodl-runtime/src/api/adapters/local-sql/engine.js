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
const NODE_SQLITE_MIN = [22, 13, 0];

/**
 * A statement handle shaped like better-sqlite3's Statement.
 * @typedef {Object} EngineStatement
 * @property {(...params: any[]) => (any|undefined)} get
 * @property {(...params: any[]) => any[]} all
 * @property {(...params: any[]) => { changes: number, lastInsertRowid: (number|bigint) }} run
 */

/**
 * A database handle shaped like a better-sqlite3 Database — the shape the
 * adapter stack consumes.
 * @typedef {Object} EngineDatabase
 * @property {(sql: string) => EngineStatement} prepare
 * @property {(sql: string) => void} exec
 * @property {(source: string) => any} pragma
 * @property {(fn: Function) => Function} transaction
 * @property {() => void} close
 */

/**
 * @typedef {Object} ResolvedEngine
 * @property {string} name - Engine identifier, e.g. 'node:sqlite' or 'better-sqlite3'.
 * @property {(dbPath: string) => EngineDatabase} open - Open/create a database at dbPath.
 */

/**
 * Parse a semver-ish string ("22.22.0") into a numeric tuple.
 * @param {string} v
 * @returns {number[]}
 */
function parseVersion(v) {
  return String(v)
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean} true if a >= b
 */
function gte(a, b) {
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
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {EngineDatabase}
 */
function wrapNodeSqlite(db) {
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
 * @returns {ResolvedEngine|null} null if unavailable (older Node / build without it).
 */
function tryNodeSqlite() {
  if (!gte(parseVersion(process.versions.node), NODE_SQLITE_MIN)) {
    return null;
  }
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    return null;
  }
  if (typeof DatabaseSync !== 'function') {
    return null;
  }
  return {
    name: 'node:sqlite',
    open(dbPath) {
      const db = new DatabaseSync(dbPath);
      return wrapNodeSqlite(db);
    }
  };
}

/**
 * Try to resolve `better-sqlite3` (only if actually installed).
 * @returns {ResolvedEngine|null}
 */
function tryBetterSqlite3() {
  let Database;
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
 *
 * @returns {ResolvedEngine|null}
 */
function resolveEngine() {
  return tryNodeSqlite() || tryBetterSqlite3() || null;
}

module.exports = {
  resolveEngine,
  wrapNodeSqlite,
  tryNodeSqlite,
  tryBetterSqlite3,
  NODE_SQLITE_MIN
};
