/**
 * BAK-007 end-to-end over a real BackendService: the admin backup / export /
 * import / schema-promotion surface the editor panel + MCP tools drive.
 * Loopback + dev-open (default) means admin routes answer without a token.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(30000);

describe('BAK-007 admin surface over HTTP', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  async function req(method: string, p: string, body?: unknown) {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json };
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak007-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'bak007', backendName: 'BAK007 Test' });
    base = (await service.start()).listen.url;
    // Seed a couple of records via the BYOB surface (dev-open).
    await req('POST', '/api/Widget', { name: 'alpha', qty: 3 });
    await req('POST', '/api/Widget', { name: 'beta', qty: 7 });
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('runs a backup, lists it, and reports policy + status', async () => {
    const run = await req('POST', '/admin/backups');
    expect(run.status).toBe(200);
    expect(run.json.ok).toBe(true);
    expect(fs.existsSync(run.json.archive)).toBe(true);

    const list = await req('GET', '/admin/backups');
    expect(list.status).toBe(200);
    expect(list.json.backups.length).toBeGreaterThanOrEqual(1);
    expect(list.json.config.status.lastResult.ok).toBe(true);
  });

  it('updates the backup policy (retention)', async () => {
    const put = await req('PUT', '/admin/backups/config', { retention: { keepLast: 3 } });
    expect(put.status).toBe(200);
    expect(put.json.config.retention.keepLast).toBe(3);
  });

  it('exports a collection as JSON and previews an import (dry-run)', async () => {
    const exp = await req('GET', '/admin/export/Widget?format=json');
    expect(exp.status).toBe(200);
    expect(exp.json.count).toBe(2);

    const dry = await req('POST', '/admin/import/Widget', {
      format: 'json',
      content: exp.json.content,
      dryRun: true
    });
    expect(dry.status).toBe(200);
    expect(dry.json.dryRun).toBe(true);
    expect(dry.json.updated).toBe(2); // both objectIds already exist
    expect(dry.json.rejected).toEqual([]);
  });

  it('diffs a source schema against the running backend', async () => {
    const source = {
      tables: [
        { name: 'Widget', columns: [{ name: 'name', type: 'String' }, { name: 'qty', type: 'Number' }, { name: 'color', type: 'String' }] },
        { name: 'Gadget', columns: [{ name: 'label', type: 'String' }] }
      ]
    };
    const diff = await req('POST', '/admin/schema/diff', { source });
    expect(diff.status).toBe(200);
    expect(diff.json.diff.tables.added.map((t: { name: string }) => t.name)).toContain('Gadget');
    expect(diff.json.rendered).toMatch(/Gadget/);
  });
});
