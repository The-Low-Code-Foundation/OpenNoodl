/**
 * BAK-007: per-collection export / import — JSON + CSV, dry-run, upsert
 * idempotency, typed coercion, and a rejects report.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createAdapter } from '../src/persistence/createAdapter';
import { AdapterFacade } from '../src/persistence/AdapterFacade';
import { exportCollection, importCollection, parseCSV } from '../src/backup/dataio';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bak-dataio-'));
}

async function facadeFor(dataDir: string): Promise<{ facade: AdapterFacade; disconnect: () => Promise<void> }> {
  const handle = await createAdapter({ dataDir });
  return { facade: new AdapterFacade(handle.adapter), disconnect: () => handle.adapter.disconnect() };
}

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('backup/dataio CSV parser', () => {
  it('handles quotes, embedded commas and newlines', () => {
    const rows = parseCSV('a,b,c\r\n1,"x,y","line1\nline2"\r\n2,"he said ""hi""",z\r\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x,y', 'line1\nline2'],
      ['2', 'he said "hi"', 'z']
    ]);
  });
});

describe('backup/dataio export + import', () => {
  it('JSON round-trips losslessly into a fresh backend', async () => {
    const src = tmpDir();
    dirs.push(src);
    const { facade, disconnect } = await facadeFor(src);
    facade.schemaManager.createTable({
      name: 'Note',
      columns: [
        { name: 'title', type: 'String' },
        { name: 'count', type: 'Number' },
        { name: 'done', type: 'Boolean' },
        { name: 'meta', type: 'Object' }
      ]
    });
    for (let i = 0; i < 20; i++) {
      await facade.rawCreate('Note', { title: `t${i}`, count: i, done: i % 2 === 0, meta: { i } });
    }
    const original = (await facade.rawQuery('Note', { limit: 100, sort: 'count' })).results;
    const json = await exportCollection(facade, 'Note', 'json');
    await disconnect();

    // Import into a fresh backend.
    const dst = tmpDir();
    dirs.push(dst);
    const { facade: f2, disconnect: d2 } = await facadeFor(dst);
    const report = importCollection(f2, 'Note', json.content, { format: 'json' });
    expect(report.applied).toBe(true);
    expect(report.created).toBe(20);
    expect(report.rejected).toEqual([]);
    const restored = (await f2.rawQuery('Note', { limit: 100, sort: 'count' })).results;
    expect(restored).toEqual(original);

    // Re-import is idempotent (upsert by objectId — updates, no duplicates).
    const again = importCollection(f2, 'Note', json.content, { format: 'json' });
    expect(again.updated).toBe(20);
    expect(again.created).toBe(0);
    expect((await f2.rawQuery('Note', { limit: 1000 })).results.length).toBe(20);
    await d2();
  });

  it('imports a 10k-row CSV with dry-run preview, typed coercion, and idempotent re-import', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const { facade, disconnect } = await facadeFor(dir);
    facade.schemaManager.createTable({
      name: 'Big',
      columns: [
        { name: 'n', type: 'Number' },
        { name: 'ok', type: 'Boolean' }
      ]
    });

    const lines = ['objectId,n,ok'];
    for (let i = 0; i < 10000; i++) lines.push(`row-${i},${i},${i % 2 === 0 ? 'true' : 'false'}`);
    const csv = lines.join('\r\n') + '\r\n';

    // Dry run writes nothing.
    const dry = importCollection(facade, 'Big', csv, { format: 'csv', dryRun: true });
    expect(dry.total).toBe(10000);
    expect(dry.created).toBe(10000);
    expect((await facade.rawQuery('Big', { limit: 5 })).results.length).toBe(0);

    // Real import.
    const real = importCollection(facade, 'Big', csv, { format: 'csv' });
    expect(real.applied).toBe(true);
    expect(real.created).toBe(10000);
    expect((await facade.rawQuery('Big', { count: true, limit: 0 })).count).toBe(10000);

    // Coercion happened: n is a number; ok was coerced from the CSV string to a
    // boolean and stored (the adapter's raw read returns booleans as 0/1).
    const odd = (await facade.rawQuery('Big', { where: { objectId: 'row-5' } })).results[0];
    const even = (await facade.rawQuery('Big', { where: { objectId: 'row-4' } })).results[0];
    expect(odd.n).toBe(5);
    expect(Boolean(odd.ok)).toBe(false);
    expect(Boolean(even.ok)).toBe(true);

    // Re-import upserts idempotently (no duplicates).
    const reimport = importCollection(facade, 'Big', csv, { format: 'csv' });
    expect(reimport.updated).toBe(10000);
    expect((await facade.rawQuery('Big', { count: true, limit: 0 })).count).toBe(10000);
    await disconnect();
  });

  it('rejects rows that fail type coercion and never half-imports them', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const { facade, disconnect } = await facadeFor(dir);
    facade.schemaManager.createTable({ name: 'Typed', columns: [{ name: 'n', type: 'Number' }] });
    const csv = 'objectId,n\r\ngood,42\r\nbad,not-a-number\r\nalso-good,7\r\n';
    const report = importCollection(facade, 'Typed', csv, { format: 'csv' });
    expect(report.applied).toBe(true);
    expect(report.created).toBe(2);
    expect(report.rejected.length).toBe(1);
    expect(report.rejected[0].objectId).toBe('bad');
    expect(report.rejected[0].errors.join()).toMatch(/not a number/);
    expect((await facade.rawQuery('Typed', { limit: 100 })).results.length).toBe(2);
    await disconnect();
  });
});
