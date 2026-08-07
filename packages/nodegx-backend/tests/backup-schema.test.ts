/**
 * BAK-007: schema diff & apply (dev->prod promotion) — additive auto-applies,
 * destructive is gated and forces a pre-apply backup, data is never clobbered.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createAdapter } from '../src/persistence/createAdapter';
import { AdapterFacade } from '../src/persistence/AdapterFacade';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { BackupConfigStore } from '../src/backup/config';
import { BackupManager } from '../src/backup/BackupManager';
import { applySchema, diffSchema, SchemaSnapshot, snapshotFromLiveDir } from '../src/backup/schema-migrate';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bak-schema-'));
}
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

async function facadeFor(dataDir: string): Promise<{ facade: AdapterFacade; disconnect: () => Promise<void> }> {
  const handle = await createAdapter({ dataDir });
  return { facade: new AdapterFacade(handle.adapter), disconnect: () => handle.adapter.disconnect() };
}

function managerFor(dataDir: string, facade: AdapterFacade): BackupManager {
  const executions = new ExecutionHistory();
  executions.open(dataDir);
  return new BackupManager({
    dataDir,
    dbPath: path.join(dataDir, 'data', 'local.db'),
    executions,
    config: new BackupConfigStore(dataDir),
    backendId: 'b',
    backendName: 'B',
    getSchema: () => facade.schemaManager.exportSchemas()
  });
}

describe('backup/schema-migrate diff', () => {
  it('classifies additive vs destructive changes', () => {
    const source: SchemaSnapshot = {
      tables: [
        { name: 'User', columns: [{ name: 'email', type: 'String' }, { name: 'age', type: 'Number' }] },
        { name: 'NewTable', columns: [{ name: 'x', type: 'String' }] }
      ],
      permissions: { collections: { User: { find: 'authenticated' } } }
    };
    const target: SchemaSnapshot = {
      tables: [
        { name: 'User', columns: [{ name: 'email', type: 'String' }] },
        { name: 'Legacy', columns: [{ name: 'y', type: 'String' }] }
      ],
      permissions: { collections: {} }
    };
    const diff = diffSchema(source, target);
    expect(diff.tables.added.map((t) => t.name)).toEqual(['NewTable']);
    expect(diff.tables.changed[0].addedColumns.map((c) => c.name)).toEqual(['age']);
    expect(diff.tables.removed).toEqual(['Legacy']); // destructive
    expect(diff.destructive).toBe(true);
    expect(diff.config.permissions.join()).toMatch(/User/);
  });
});

describe('backup/schema-migrate apply', () => {
  it('applies additive table+column+permission changes without touching data', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const { facade, disconnect } = await facadeFor(dir);
    facade.schemaManager.createTable({ name: 'User', columns: [{ name: 'email', type: 'String' }] });
    await facade.rawCreate('User', { email: 'a@b.co' });
    fs.writeFileSync(path.join(dir, 'security.json'), JSON.stringify({ collections: {} }));

    const source: SchemaSnapshot = {
      tables: [
        { name: 'User', columns: [{ name: 'email', type: 'String' }, { name: 'age', type: 'Number' }] },
        { name: 'Post', columns: [{ name: 'title', type: 'String' }] }
      ],
      permissions: { collections: { User: { find: 'authenticated' } } }
    };
    const target = snapshotFromLiveDir(facade.schemaManager, dir);
    const diff = diffSchema(source, target);
    expect(diff.destructive).toBe(false);

    const result = await applySchema({ schemaManager: facade.schemaManager, dataDir: dir }, source, diff, {});
    expect(result.appliedTables).toContain('Post');
    expect(result.appliedColumns).toContain('User.age');
    expect(result.preApplyBackup).toBeNull();

    // Data intact; new column present.
    const users = (await facade.rawQuery('User', { limit: 10 })).results;
    expect(users.length).toBe(1);
    expect(users[0].email).toBe('a@b.co');
    expect(facade.getColumns('User').map((c) => c.name)).toContain('age');
    expect(facade.schemaManager.listTables()).toContain('Post');

    // Permission promoted into security.json.
    const security = JSON.parse(fs.readFileSync(path.join(dir, 'security.json'), 'utf-8'));
    expect(security.collections.User.find).toBe('authenticated');
    await disconnect();
  });

  it('refuses a destructive apply without allowDestructive, and forces a backup with it', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const { facade, disconnect } = await facadeFor(dir);
    facade.schemaManager.createTable({ name: 'Keep', columns: [] });
    facade.schemaManager.createTable({ name: 'Doomed', columns: [{ name: 'z', type: 'String' }] });

    const source: SchemaSnapshot = { tables: [{ name: 'Keep', columns: [] }] }; // Doomed removed
    const target = snapshotFromLiveDir(facade.schemaManager, dir);
    const diff = diffSchema(source, target);
    expect(diff.destructive).toBe(true);

    // Refuses without the flag.
    await expect(
      applySchema({ schemaManager: facade.schemaManager, dataDir: dir }, source, diff, {})
    ).rejects.toThrow(/DESTRUCTIVE/);
    expect(facade.schemaManager.listTables()).toContain('Doomed'); // untouched

    // With the flag + a backupManager, takes a pre-apply backup then drops.
    const manager = managerFor(dir, facade);
    const result = await applySchema({ schemaManager: facade.schemaManager, dataDir: dir }, source, diff, {
      allowDestructive: true,
      backupManager: manager
    });
    expect(result.preApplyBackup).toBeTruthy();
    expect(fs.existsSync(result.preApplyBackup!)).toBe(true);
    expect(result.droppedTables).toContain('Doomed');
    expect(facade.schemaManager.listTables()).not.toContain('Doomed');
    await disconnect();
  });
});
