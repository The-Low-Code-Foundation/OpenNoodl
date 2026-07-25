/**
 * LocalSQLAdapter — persistence behaviour (RUN-004 + WF-004)
 *
 * Two things are pinned here:
 *
 *   1. Loud failure (RUN-004). The adapter used to silently substitute an
 *      in-memory mock when the SQLite engine could not load: records appeared
 *      to save and then vanished on restart, with no error pointing at the
 *      cause. When no engine is available (or one fails to open), connect()
 *      throws a LocalBackendPersistenceError — unless the caller explicitly
 *      opts in to a clearly-labelled ephemeral mode.
 *
 *   2. Real persistence (WF-004). The engine is now resolved by ./engine.js,
 *      which prefers `node:sqlite` (built into Node ≥22.13, zero native dep)
 *      and falls back to `better-sqlite3` only if installed. Data written
 *      through the adapter survives a full disconnect / reconnect.
 *
 * The loud-failure branch is exercised deterministically by INJECTING an engine
 * that fails to open (options.engine), so it runs in every environment rather
 * than only where a native module happens to be missing. The persistence branch
 * uses whatever real engine ./engine.js resolves — on any supported Node that is
 * node:sqlite, so it runs everywhere too.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const LocalSQLAdapter = require('../../src/api/adapters/local-sql/LocalSQLAdapter');
const { LocalBackendPersistenceError, resolveEngine } = require('../../src/api/adapters/local-sql');

/** The engine ./engine.js resolves in this environment (node:sqlite on supported Node). */
const realEngine = resolveEngine();

/** An engine whose open() throws — simulates a native module that loads but cannot open a db. */
const failingEngine = {
  name: 'failing-test-engine',
  open() {
    throw new Error('simulated engine open failure');
  }
};

/** Promisified adapter.create — the adapter API is callback-style. */
function createRecord(adapter, collection, data) {
  return new Promise((resolve, reject) => {
    adapter.create({ collection, data, success: resolve, error: (msg) => reject(new Error(msg)) });
  });
}

/** Promisified adapter.fetch — rejects when the record is missing. */
function fetchRecord(adapter, collection, objectId) {
  return new Promise((resolve, reject) => {
    adapter.fetch({ collection, objectId, success: resolve, error: (msg) => reject(new Error(msg)) });
  });
}

/**
 * Promisified adapter.fetch that resolves to null on "not found" rather than
 * rejecting — the adapter reports a missing record via the error callback.
 */
function fetchRecordOrNull(adapter, collection, objectId) {
  return new Promise((resolve, reject) => {
    adapter.fetch({
      collection,
      objectId,
      success: resolve,
      error: (msg) => (/not found/i.test(msg) ? resolve(null) : reject(new Error(msg)))
    });
  });
}

describe('LocalSQLAdapter — engine unavailable (loud failure)', () => {
  it('throws a LocalBackendPersistenceError instead of silently mocking', async () => {
    const adapter = new LocalSQLAdapter(':memory:', { engine: failingEngine });

    await expect(adapter.connect()).rejects.toThrow(LocalBackendPersistenceError);

    const status = adapter.getPersistenceStatus();
    expect(status.mode).toBe('failed');
    expect(status.persistent).toBe(false);
    expect(status.ephemeral).toBe(false);
  });

  it('tags the thrown error with a stable, actionable code', async () => {
    const adapter = new LocalSQLAdapter(':memory:', { engine: failingEngine });

    await expect(adapter.connect()).rejects.toMatchObject({
      code: 'PERSISTENCE_ENGINE_UNAVAILABLE'
    });
  });

  it('falls back to an explicitly ephemeral mock only when opted in', async () => {
    const adapter = new LocalSQLAdapter(':memory:', { engine: failingEngine, allowEphemeral: true });

    await expect(adapter.connect()).resolves.toBeUndefined();

    const status = adapter.getPersistenceStatus();
    expect(status.mode).toBe('ephemeral');
    expect(status.ephemeral).toBe(true);
    expect(status.persistent).toBe(false);
    expect(adapter._usingMock).toBe(true);
  });

  it('ephemeral data does not survive a new adapter instance', async () => {
    const adapter = new LocalSQLAdapter(':memory:', { engine: failingEngine, allowEphemeral: true });
    await adapter.connect();
    const created = await createRecord(adapter, 'notes', { title: 'gone tomorrow' });
    expect(created.objectId).toBeTruthy();

    // A second adapter starts with an empty in-memory store — proving the data
    // was never persisted anywhere.
    const reopened = new LocalSQLAdapter(':memory:', { engine: failingEngine, allowEphemeral: true });
    await reopened.connect();
    const readBack = await fetchRecordOrNull(reopened, 'notes', created.objectId);
    expect(readBack).toBeNull();
  });
});

// The real engine is present on every supported Node (node:sqlite ≥ 22.13);
// skip honestly (never silently pass) on the off chance it is not.
const describeWhenEnginePresent = realEngine ? describe : describe.skip;

describeWhenEnginePresent('LocalSQLAdapter — persistence integrity (WF-004 engine)', () => {
  let dbPath;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `noodl-wf004-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`);
  });

  afterEach(() => {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.unlinkSync(dbPath + suffix);
      } catch (e) {
        /* ignore */
      }
    }
  });

  it('reports persistent mode and names the resolved engine', async () => {
    const adapter = new LocalSQLAdapter(dbPath);
    await adapter.connect();

    const status = adapter.getPersistenceStatus();
    expect(status.mode).toBe('persistent');
    expect(status.persistent).toBe(true);
    expect(status.engine).toBe(realEngine.name);
    expect(adapter._usingMock).toBe(false);

    await adapter.disconnect();
  });

  it('persists a record across a full disconnect / reconnect', async () => {
    // Write with one adapter instance...
    const writer = new LocalSQLAdapter(dbPath);
    await writer.connect();
    const created = await createRecord(writer, 'notes', { title: 'still here tomorrow' });
    expect(created.objectId).toBeTruthy();
    await writer.disconnect();

    // ...read back with a completely fresh instance on the same file. On the old
    // in-memory mock this returned nothing — that silent loss is the bug.
    const reader = new LocalSQLAdapter(dbPath);
    await reader.connect();
    const readBack = await fetchRecord(reader, 'notes', created.objectId);
    expect(readBack).toBeTruthy();
    expect(readBack.title).toBe('still here tomorrow');
    await reader.disconnect();
  });
});
