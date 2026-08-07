/**
 * BAK-007 centerpiece: the restore round-trip.
 *
 * Write records into a live backend db, back it up (consistent snapshot +
 * files + workflows + config), restore into a CLEAN dir, and prove the logical
 * content is byte-/row-identical. Plus a snapshot-under-concurrent-writes test
 * proving no torn records. This is a HARD acceptance criterion — no untested
 * "restore works" claims.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createAdapter } from '../src/persistence/createAdapter';
import { AdapterFacade } from '../src/persistence/AdapterFacade';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { BackupConfigStore } from '../src/backup/config';
import { BackupManager } from '../src/backup/BackupManager';
import { verifyDatabaseIntegrity } from '../src/backup/snapshot';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function openBackend(dataDir: string): Promise<{ facade: AdapterFacade; disconnect: () => Promise<void> }> {
  const handle = await createAdapter({ dataDir });
  const facade = new AdapterFacade(handle.adapter);
  return { facade, disconnect: () => handle.adapter.disconnect() };
}

function makeManager(dataDir: string): { manager: BackupManager; executions: ExecutionHistory; config: BackupConfigStore } {
  const executions = new ExecutionHistory();
  executions.open(dataDir);
  const config = new BackupConfigStore(dataDir);
  const manager = new BackupManager({
    dataDir,
    dbPath: path.join(dataDir, 'data', 'local.db'),
    executions,
    config,
    backendId: 'test-backend',
    backendName: 'Test Backend'
  });
  return { manager, executions, config };
}

describe('BAK-007 restore round-trip', () => {
  const created: string[] = [];
  afterAll(() => {
    for (const d of created) fs.rmSync(d, { recursive: true, force: true });
  });

  it('backs up a live-written backend and restores it row-identical into a clean dir', async () => {
    const src = tmpDir('bak-src-');
    const dst = tmpDir('bak-dst-');
    created.push(src, dst);

    // 1. Populate a live backend: schema + records of several types.
    const { facade, disconnect } = await openBackend(src);
    facade.schemaManager.createTable({
      name: 'Note',
      columns: [
        { name: 'title', type: 'String' },
        { name: 'count', type: 'Number' },
        { name: 'done', type: 'Boolean' },
        { name: 'meta', type: 'Object' }
      ]
    });
    for (let i = 0; i < 50; i++) {
      await facade.rawCreate('Note', {
        title: `note ${i} — "quoted", commas, \n newlines`,
        count: i,
        done: i % 2 === 0,
        meta: { tags: ['a', 'b', i], nested: { x: i } }
      });
    }
    // Files + workflows + config artifacts that must travel in the archive.
    fs.mkdirSync(path.join(src, 'files'), { recursive: true });
    fs.writeFileSync(path.join(src, 'files', 'hello.txt'), 'hello files');
    fs.mkdirSync(path.join(src, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(src, 'workflows', 'fn.json'), JSON.stringify({ name: 'fn' }));
    fs.writeFileSync(path.join(src, 'security.json'), JSON.stringify({ devOpen: true }));

    const sourceRows = (await facade.rawQuery('Note', { limit: 1000, sort: 'count' })).results;
    await disconnect();

    // 2. Back up.
    const { manager } = makeManager(src);
    const backup = await manager.createBackup({ triggerType: 'test', source: 'roundtrip' });
    expect(fs.existsSync(backup.archivePath)).toBe(true);
    expect(['online-backup', 'vacuum-into']).toContain(backup.manifest.snapshotMechanism);

    // 3. Restore into a CLEAN dir (no safety snapshot needed — dst is empty).
    const { manager: dstManager } = makeManager(dst);
    const restore = await dstManager.restore(backup.archivePath, { targetDataDir: dst, safetySnapshot: false });
    expect(restore.integrity.ok).toBe(true);

    // 4. Compare logical content row-by-row.
    const { facade: rFacade, disconnect: rDisconnect } = await openBackend(dst);
    const restoredRows = (await rFacade.rawQuery('Note', { limit: 1000, sort: 'count' })).results;
    expect(restoredRows.length).toBe(sourceRows.length);
    expect(restoredRows).toEqual(sourceRows);
    await rDisconnect();

    // 5. Non-db artifacts restored.
    expect(fs.readFileSync(path.join(dst, 'files', 'hello.txt'), 'utf-8')).toBe('hello files');
    expect(fs.readFileSync(path.join(dst, 'workflows', 'fn.json'), 'utf-8')).toBe(JSON.stringify({ name: 'fn' }));
    expect(JSON.parse(fs.readFileSync(path.join(dst, 'security.json'), 'utf-8'))).toEqual({ devOpen: true });
  });

  it('produces a consistent (no-torn-records) snapshot while writes are in flight', async () => {
    const src = tmpDir('bak-cc-');
    created.push(src);
    const { facade, disconnect } = await openBackend(src);
    facade.schemaManager.createTable({ name: 'Item', columns: [{ name: 'n', type: 'Number' }] });
    for (let i = 0; i < 100; i++) await facade.rawCreate('Item', { n: i });
    const before = (await facade.rawQuery('Item', { limit: 5000 })).results.length;

    // Fire writes without awaiting, then snapshot concurrently.
    const writes: Promise<unknown>[] = [];
    for (let i = 100; i < 200; i++) writes.push(facade.rawCreate('Item', { n: i }).catch(() => undefined));

    const { manager } = makeManager(src);
    const backup = await manager.createBackup({ triggerType: 'test', source: 'concurrent' });
    await Promise.all(writes);
    const after = (await facade.rawQuery('Item', { limit: 5000 })).results.length;
    await disconnect();

    // The snapshot's db passes integrity_check and every captured row is intact.
    const snapDir = tmpDir('bak-cc-restore-');
    created.push(snapDir);
    const { manager: rm } = makeManager(snapDir);
    await rm.restore(backup.archivePath, { targetDataDir: snapDir, safetySnapshot: false });
    expect(verifyDatabaseIntegrity(path.join(snapDir, 'data', 'local.db')).ok).toBe(true);

    const { facade: rf, disconnect: rd } = await openBackend(snapDir);
    const rows = (await rf.rawQuery('Item', { limit: 5000 })).results;
    // Count is a consistent prefix: >= what existed before writes, <= final.
    expect(rows.length).toBeGreaterThanOrEqual(before);
    expect(rows.length).toBeLessThanOrEqual(after);
    // No torn records: every row has an objectId and a numeric n.
    for (const r of rows) {
      expect(typeof r.objectId).toBe('string');
      expect(typeof r.n).toBe('number');
    }
    await rd();
  });
});
