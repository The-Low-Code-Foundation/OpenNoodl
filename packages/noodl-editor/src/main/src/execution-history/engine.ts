/**
 * ExecutionHistory engine selection — WF-006
 *
 * `ExecutionStore` needs a synchronous SQLite-compatible handle.
 * `better-sqlite3` is deliberately NOT a dependency here: that native-module
 * decision belongs to WF-004/RUN-004 jointly. Two paths, in order of
 * preference, per the WF-006 spec's "Engine note":
 *
 *   1. `node:sqlite` (`DatabaseSync`) — no native module, no ABI question —
 *      IF the current Node/Electron build provides it flag-free. This is
 *      checked at runtime by actually requiring it, not assumed from docs:
 *      Electron's bundled Node version can differ from whatever installed
 *      `node --version` prints on a dev machine.
 *   2. A loudly-labeled in-memory fallback (`InMemorySqliteFallback`) —
 *      execution history is the one place short-term ephemerality is
 *      acceptable; the caller is told which engine it got and must not
 *      present in-memory data as durable.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { SQLiteDatabase } from '@noodl-viewer-cloud/execution-history';

import { InMemorySqliteFallback } from './InMemorySqliteFallback';

export type ExecutionHistoryEngineKind = 'node:sqlite' | 'in-memory-fallback';

export interface ExecutionHistoryEngine {
  db: SQLiteDatabase;
  kind: ExecutionHistoryEngineKind;
  persistent: boolean;
  dbPath: string | null;
  /** Set only when node:sqlite was attempted and unavailable/failed. */
  nodeSqliteError: string | null;
}

interface NodeSqliteModule {
  DatabaseSync: new (location: string) => SQLiteDatabase;
}

/** Overridable only for tests — production callers always use the real loader. */
export type NodeSqliteLoader = () => NodeSqliteModule | null;

export const defaultNodeSqliteLoader: NodeSqliteLoader = () => {
  try {
    // A plain `require` of a string literal, deliberately not a static `import`:
    // webpack's node/electron externals preset leaves `node:`-prefixed built-ins
    // as runtime requires, so this really does probe the Node build the app is
    // running on, not whatever ships in @types/node or the docs.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('node:sqlite');
    if (mod && typeof mod.DatabaseSync === 'function') {
      return mod as NodeSqliteModule;
    }
    return null;
  } catch {
    return null;
  }
};

export function defaultExecutionHistoryDbPath(): string {
  return path.join(os.homedir(), '.noodl', 'execution-history.db');
}

/**
 * Pick and open the best available engine. Never throws — always returns a
 * working (if degraded) engine, plus enough information for the caller to
 * log and report the decision (and for the fallback to be "loud" about it).
 */
export function openExecutionHistoryEngine(
  dbPath: string = defaultExecutionHistoryDbPath(),
  loadNodeSqlite: NodeSqliteLoader = defaultNodeSqliteLoader
): ExecutionHistoryEngine {
  const nodeSqlite = loadNodeSqlite();

  if (nodeSqlite) {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      const db = new nodeSqlite.DatabaseSync(dbPath);
      return { db, kind: 'node:sqlite', persistent: true, dbPath, nodeSqliteError: null };
    } catch (e) {
      // node:sqlite exists but opening this specific file failed (permissions,
      // corrupt file, etc). Fall back rather than crash the editor's main
      // process over an observability nicety.
      return {
        db: new InMemorySqliteFallback(),
        kind: 'in-memory-fallback',
        persistent: false,
        dbPath: null,
        nodeSqliteError: e instanceof Error ? e.message : String(e)
      };
    }
  }

  return {
    db: new InMemorySqliteFallback(),
    kind: 'in-memory-fallback',
    persistent: false,
    dbPath: null,
    nodeSqliteError: 'node:sqlite is not available in this Node/Electron build'
  };
}
