/**
 * Persistence wiring — the one real, verified piece of the front half.
 *
 * The adapter stack (LocalSQLAdapter / QueryBuilder / SchemaManager) stays in
 * `@noodl/runtime` and is consumed as a dependency, per the WF-004 scope
 * ("adapters stay in noodl-runtime and are consumed as a dependency; record if
 * this proves wrong"). This module is the seam where the standalone service
 * opens its database.
 *
 * The engine decision (WF-004): `node:sqlite`. It is resolved by
 * `@noodl/runtime`'s `engine.js` (node:sqlite preferred, better-sqlite3 as a
 * legacy fallback). If NO engine is available and the caller has not opted in to
 * ephemeral mode, `connect()` throws a LocalBackendPersistenceError — the
 * service refuses to start rather than silently losing data (RUN-004).
 *
 * @module nodegx-backend/persistence/createAdapter
 */

import * as fs from 'fs';
import * as path from 'path';

// The adapter stack is plain CommonJS JS without type declarations; require it
// through the package's public subpath. This is the declared dependency edge —
// no relative reach into another package's internals.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const localSql = require('@noodl/runtime/src/api/adapters/local-sql');

const { LocalSQLAdapter, LocalBackendPersistenceError } = localSql;

export { LocalBackendPersistenceError };

export interface PersistenceHandle {
  /** The connected LocalSQLAdapter instance (CloudStore-shaped API). */
  adapter: any;
  /** Absolute path to the SQLite file backing this data-dir. */
  dbPath: string;
  /** { mode, persistent, ephemeral, engine, error } from the adapter. */
  status: {
    mode: string;
    persistent: boolean;
    ephemeral: boolean;
    engine: string | null;
    error: { message: string; code: string } | null;
  };
}

export interface CreateAdapterOptions {
  dataDir: string;
  /** Opt in to ephemeral (non-persisting) mode when no engine loads. */
  allowEphemeral?: boolean;
  /** Collection schemas, if known up front (same shape as dbCollections metadata). */
  collections?: Record<string, unknown>;
}

/**
 * Open the backend's database under <dataDir>/data/local.db and connect.
 * (`data/local.db` is the layout the editor has always created under
 * `~/.noodl/backends/<id>/` — the service keeps it so a backend directory
 * means the same thing whichever process opens it.)
 *
 * @throws LocalBackendPersistenceError when no SQLite engine is available and
 *   allowEphemeral is false — the service must not pretend to persist.
 */
export async function createAdapter(options: CreateAdapterOptions): Promise<PersistenceHandle> {
  fs.mkdirSync(path.join(options.dataDir, 'data'), { recursive: true });
  const dbPath = path.join(options.dataDir, 'data', 'local.db');

  const adapter = new LocalSQLAdapter(dbPath, {
    allowEphemeral: !!options.allowEphemeral,
    collections: options.collections || {}
  });

  await adapter.connect(); // throws loudly if it cannot persist and !allowEphemeral

  return {
    adapter,
    dbPath,
    status: adapter.getPersistenceStatus()
  };
}
