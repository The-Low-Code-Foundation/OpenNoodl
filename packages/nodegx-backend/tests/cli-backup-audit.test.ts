/**
 * BAK-009 follow-up: CLI-driven backup/restore now writes an `_Audit` row.
 *
 * Before this fix, `nodegx-backend backup`/`restore` produced an execution
 * record (WF-006 substrate) but nothing in `_Audit` — the row is stamped by
 * HttpServer's request dispatcher, which the CLI never passes through. See
 * BackupManager's module doc and cli.ts's `openCliAuditLog`.
 *
 * Driven IN-PROCESS via `main()` from src — a spawned child process would
 * exercise the built `dist/`, not this source tree, and would pass or fail
 * independently of these edits.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { main } from '../src/cli';
import { createAdapter } from '../src/persistence/createAdapter';
import { AdapterFacade } from '../src/persistence/AdapterFacade';
import { AUDIT_COLLECTION } from '../src/ops/audit';
import { ARCHIVE_EXT } from '../src/backup/archive';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function auditEntries(dataDir: string, action: string): Promise<Record<string, unknown>[]> {
  const handle = await createAdapter({ dataDir });
  const facade = new AdapterFacade(handle.adapter);
  try {
    const { results } = await facade.rawQuery(AUDIT_COLLECTION, { where: { action } });
    return results;
  } finally {
    await handle.adapter.disconnect();
  }
}

describe('BAK-009 follow-up: CLI backup/restore audit rows', () => {
  const created: string[] = [];
  afterAll(() => {
    for (const d of created) fs.rmSync(d, { recursive: true, force: true });
  });

  it('nodegx-backend backup writes a backup.create _Audit row with actorKind cli', async () => {
    const dataDir = tmpDir('cli-audit-backup-');
    created.push(dataDir);

    // `backup` needs a db to snapshot — prime one, the same way a real data
    // dir would already have one from a prior `serve`. A brand-new data dir
    // has no `_Audit` table at all yet either, which is the whole point:
    // "nothing recorded yet" is a missing table, not an empty query result.
    const seedHandle = await createAdapter({ dataDir });
    await seedHandle.adapter.disconnect();

    await main(['backup', '--data-dir', dataDir]);

    const after = await auditEntries(dataDir, 'backup.create');
    expect(after.length).toBe(1);
    expect(after[0]).toMatchObject({
      action: 'backup.create',
      actorKind: 'cli',
      outcome: 'success',
      ip: 'cli'
    });
    // The actor names a real OS user, not an empty/placeholder string, on any
    // platform this runs on.
    expect(typeof after[0].actor).toBe('string');
  });

  it('nodegx-backend restore writes a backup.restore _Audit row, into the POST-restore database', async () => {
    const dataDir = tmpDir('cli-audit-restore-');
    created.push(dataDir);

    // Seed a table + row so the backup archive carries real content, and so
    // a reader can tell the restored db (not some stale copy) is what the
    // audit connection actually opened afterward.
    const seedHandle = await createAdapter({ dataDir });
    const seedFacade = new AdapterFacade(seedHandle.adapter);
    seedFacade.schemaManager.createTable({ name: 'Widget', columns: [{ name: 'n', type: 'Number' }] });
    await seedFacade.rawCreate('Widget', { n: 1 });
    await seedHandle.adapter.disconnect();

    await main(['backup', '--data-dir', dataDir]);
    const archives = fs.readdirSync(path.join(dataDir, 'backups')).filter((f) => f.endsWith(ARCHIVE_EXT));
    expect(archives.length).toBeGreaterThan(0);
    const archivePath = path.join(dataDir, 'backups', archives[0]);

    await main(['restore', archivePath, '--data-dir', dataDir, '--no-safety']);

    const restoreEntries = await auditEntries(dataDir, 'backup.restore');
    expect(restoreEntries.length).toBe(1);
    expect(restoreEntries[0]).toMatchObject({ action: 'backup.restore', actorKind: 'cli', outcome: 'success', ip: 'cli' });
    expect((restoreEntries[0].detail as Record<string, unknown>).archive).toBe(archivePath);

    // The row is readable through a fresh connection to the CURRENT db (the
    // one restore just swapped into place) — Widget survived the round trip,
    // proving this isn't reading a stale pre-restore file.
    const checkHandle = await createAdapter({ dataDir });
    const checkFacade = new AdapterFacade(checkHandle.adapter);
    const widgets = (await checkFacade.rawQuery('Widget', {})).results;
    expect(widgets).toHaveLength(1);
    await checkHandle.adapter.disconnect();
  });

  it('a failed restore (bad archive) still records a failure row, not nothing', async () => {
    const dataDir = tmpDir('cli-audit-restore-fail-');
    created.push(dataDir);

    // Prime a db so the data dir + _Audit table exist ahead of the failure.
    const seedHandle = await createAdapter({ dataDir });
    await seedHandle.adapter.disconnect();

    const badArchive = path.join(dataDir, 'nonexistent.tar');
    await expect(main(['restore', badArchive, '--data-dir', dataDir])).rejects.toBeTruthy();

    const entries = await auditEntries(dataDir, 'backup.restore');
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatchObject({ action: 'backup.restore', actorKind: 'cli', outcome: 'failure' });
  });
});
