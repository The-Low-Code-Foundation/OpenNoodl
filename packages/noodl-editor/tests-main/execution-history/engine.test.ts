/**
 * WF-006: engine selection.
 *
 * The real, unmocked default loader is exercised too (not just the injected
 * fake) — that's the actual "check at runtime, not from docs" behavior the
 * spec asks for, and it should pick node:sqlite on the Node version this repo
 * runs tests under. See the task report for the equivalent check against
 * Electron's bundled Node.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { defaultNodeSqliteLoader, openExecutionHistoryEngine } from '../../src/main/src/execution-history/engine';
import { InMemorySqliteFallback } from '../../src/main/src/execution-history/InMemorySqliteFallback';

describe('openExecutionHistoryEngine', () => {
  const tmpDbPath = path.join(os.tmpdir(), `wf006-engine-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

  afterEach(() => {
    try {
      fs.unlinkSync(tmpDbPath);
    } catch {
      // fine if it was never created (e.g. the fallback path ran)
    }
  });

  it('uses node:sqlite when the loader finds it, and the db satisfies SQLiteDatabase', () => {
    const engine = openExecutionHistoryEngine(tmpDbPath);

    expect(engine.kind).toBe('node:sqlite');
    expect(engine.persistent).toBe(true);
    expect(engine.dbPath).toBe(tmpDbPath);
    expect(engine.nodeSqliteError).toBeNull();

    // Prove it's a real, working handle, not just a truthy stub.
    engine.db.exec('CREATE TABLE probe (id TEXT)');
    engine.db.prepare('INSERT INTO probe (id) VALUES (?)').run('a');
    expect(engine.db.prepare('SELECT * FROM probe').all()).toEqual([{ id: 'a' }]);
    expect(fs.existsSync(tmpDbPath)).toBe(true);
  });

  it('falls back to the in-memory engine when node:sqlite is unavailable', () => {
    const engine = openExecutionHistoryEngine(tmpDbPath, () => null);

    expect(engine.kind).toBe('in-memory-fallback');
    expect(engine.persistent).toBe(false);
    expect(engine.dbPath).toBeNull();
    expect(engine.nodeSqliteError).toContain('not available');
    expect(engine.db).toBeInstanceOf(InMemorySqliteFallback);
    expect(fs.existsSync(tmpDbPath)).toBe(false);
  });

  it('falls back when node:sqlite is present but opening the file throws', () => {
    const throwingLoader = () => ({
      DatabaseSync: class {
        constructor() {
          throw new Error('disk full');
        }
      } as unknown as new (location: string) => never
    });

    const engine = openExecutionHistoryEngine(tmpDbPath, throwingLoader as never);

    expect(engine.kind).toBe('in-memory-fallback');
    expect(engine.persistent).toBe(false);
    expect(engine.nodeSqliteError).toBe('disk full');
  });

  it('the real default loader (no injection) finds node:sqlite on this Node build', () => {
    // This is the actual runtime probe production code uses — verifies the
    // "check at runtime, not from docs" requirement against whatever Node
    // this test process is actually running under.
    const mod = defaultNodeSqliteLoader();
    expect(mod).not.toBeNull();
    expect(typeof mod?.DatabaseSync).toBe('function');
  });
});
