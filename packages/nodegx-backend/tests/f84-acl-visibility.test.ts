/**
 * F84 — measuring what the Data Browser's own read path returns.
 *
 * The Data Browser does not speak `/classes` (the Parse wire). It goes through
 * `BackendManager.queryRecords` → `GET /api/:table` and
 * `BackendManager.getTableSchema` → `GET /admin/schema/:table`, both with the
 * admin bearer token. F84 says "a record created with a specific ACL shows no
 * ACL in the data explorer", and there are two candidate causes: the backend
 * does not return `ACL`, or the grid drops it. This spec pins the backend half
 * so the answer cannot drift back.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(30000);

interface ApiRecord {
  objectId: string;
  ACL?: unknown;
  [key: string]: unknown;
}

describe('F84 — the ACL on the Data Browser read path', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;
  let docId: string;

  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });

  async function req<T>(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; json: T }> {
    const res = await fetch(`${base}${pathName}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let json = {} as T;
    try {
      json = (await res.json()) as T;
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json };
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-f84-'));
    fs.writeFileSync(
      path.join(dataDir, 'security.json'),
      JSON.stringify({
        version: 1,
        devOpen: false,
        defaults: {
          permissions: { find: 'public', get: 'public', create: 'public', update: 'public', delete: 'public' },
          creatorOwns: false
        },
        collections: {},
        functions: {},
        files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
        signup: 'public'
      })
    );

    service = new BackendService({ dataDir, port: 0, backendId: 'f84', backendName: 'F84' });
    const started = await service.start();
    base = started.listen.url;
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    // A record with a specific ACL — exactly what the Create Record node's
    // Access Control Rules emit (`{ ACL: { '<id>': { read, write } } }`).
    const created = await req<ApiRecord>(
      'POST',
      '/api/Doc',
      { title: 'acl doc', ACL: { 'user-1': { read: true, write: true }, '*': { read: true } } },
      asAdmin()
    );
    expect(created.status).toBe(201);
    docId = created.json.objectId;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('GET /api/:table returns the ACL on every row, parsed as an object', async () => {
    const { status, json } = await req<{ results: ApiRecord[] }>('GET', '/api/Doc?limit=50&skip=0', undefined, asAdmin());
    expect(status).toBe(200);
    const row = json.results.find((r) => r.objectId === docId);
    expect(row).toBeDefined();
    expect(row!.ACL).toEqual({ 'user-1': { read: true, write: true }, '*': { read: true } });
  });

  it('GET /api/:table/:id returns the ACL too', async () => {
    const { status, json } = await req<ApiRecord>('GET', `/api/Doc/${docId}`, undefined, asAdmin());
    expect(status).toBe(200);
    expect(json.ACL).toEqual({ 'user-1': { read: true, write: true }, '*': { read: true } });
  });

  it('the table schema does NOT declare ACL as a column — it is a system column', async () => {
    // This is why the grid could not show it: `allColumns` is three hard-coded
    // system columns plus whatever `/admin/schema/:table` lists, and the
    // SchemaManager keeps `ACL` out of the `_Schema` JSON (it is stamped onto
    // the physical table alongside objectId/createdAt/updatedAt).
    const { status, json } = await req<{ columns: { name: string }[] }>(
      'GET',
      '/admin/schema/Doc',
      undefined,
      asAdmin()
    );
    expect(status).toBe(200);
    expect(json.columns.map((c) => c.name)).not.toContain('ACL');
  });

  it('PUT /api/:table/:id writes a replacement ACL and reads it back', async () => {
    const next = { 'user-2': { read: true, write: false } };
    const saved = await req<ApiRecord>('PUT', `/api/Doc/${docId}`, { ACL: next }, asAdmin());
    expect(saved.status).toBe(200);
    const { json } = await req<ApiRecord>('GET', `/api/Doc/${docId}`, undefined, asAdmin());
    expect(json.ACL).toEqual(next);
  });

  it('PUT /api/:table/:id refuses a mis-shaped ACL instead of storing it', async () => {
    // The Parse-wire twin has validated this since BAK-003 (`parse-wire.ts`
    // classPut) but the BYOB route the Data Browser writes through did not —
    // so an edit of the new ACL cell could store `{"a": 5}` and quietly make
    // the row unreadable to everyone.
    const before = await req<ApiRecord>('GET', `/api/Doc/${docId}`, undefined, asAdmin());
    const bad = await req<{ error?: string }>('PUT', `/api/Doc/${docId}`, { ACL: { someone: 5 } }, asAdmin());
    expect(bad.status).toBe(400);
    expect(String(bad.json.error)).toMatch(/ACL/);
    const after = await req<ApiRecord>('GET', `/api/Doc/${docId}`, undefined, asAdmin());
    expect(after.json.ACL).toEqual(before.json.ACL);
  });

  it('POST /api/:table refuses a mis-shaped ACL', async () => {
    const bad = await req<{ error?: string }>('POST', '/api/Doc', { title: 'nope', ACL: 'everyone' }, asAdmin());
    expect(bad.status).toBe(400);
    expect(String(bad.json.error)).toMatch(/ACL/);
  });

  it('a null ACL clears it — the row becomes public', async () => {
    const saved = await req<ApiRecord>('PUT', `/api/Doc/${docId}`, { ACL: null }, asAdmin());
    expect(saved.status).toBe(200);
    const { json } = await req<ApiRecord>('GET', `/api/Doc/${docId}`, undefined, asAdmin());
    expect(json.ACL == null).toBe(true);
  });
});
