/**
 * DEF-014 — the day a site is made, its first query is against columns nothing
 * has written yet.
 *
 * Phase 77's SBR-015 drive found the site-builder's Publish refusing every page
 * on every brand-new site. The cause was two doors down from the template: a
 * collection here is created on first use with no user columns, columns appear
 * only as writes arrive, and a `where` naming one that does not exist yet was
 * not an empty result but SQLite's `no such column`, surfaced as HTTP **500**.
 * `publishPage` was right to refuse a query that errored; there was nothing
 * sensible for it to do with one.
 *
 * This is the same request the drive issued, at the same door — a real service
 * on a real database, over HTTP — with the record-level equivalents of its
 * control pair beside it. The adapter-level semantics (an absent column answers
 * exactly as an all-NULL one, operator by operator) are pinned in
 * `noodl-runtime`'s `LocalSQLAdapter.absentColumn.test.js`; what this file adds
 * is that the answer survives the wire as a 200 rather than a 500.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { adminHeaders, ParseQueryResult, ParseRecord, request } from './helpers/http';

jest.setTimeout(30000);

describe('DEF-014 — a query against a class before its first row is written', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const req = <T = unknown>(method: string, pathName: string, body?: unknown) =>
    request<T>(base, method, pathName, { body, headers: adminHeaders(dataDir) });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'def014-http-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'backend_def014', backendName: 'DEF-014' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.persistence.status.persistent).toBe(true);
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('answers 200 with no results — the exact request that returned 500', async () => {
    // Verbatim from the drive: a site claimed, two pages created, no sections
    // authored anywhere, and the publish path asking which sections belong to
    // the page. `Section` does not exist yet; the first query creates it.
    const where = encodeURIComponent(JSON.stringify({ pageId: 'baa851b3-0000-0000-0000-000000000000' }));
    const { status, json } = await req<ParseQueryResult>('GET', `/classes/Section?where=${where}`);

    expect(status).toBe(200);
    expect(json.results).toEqual([]);
  });

  it('created the class as a side effect, with nothing declared on it — the state the defect lived in', async () => {
    // The class is brought into existence by the query that failed, which is
    // why a backend inspected before a publish shows no `Section` at all and
    // one inspected after shows an empty one. Both are the same defect.
    const listed = await req<{ tables: Array<{ name: string }> }>('GET', '/admin/schema');
    expect(listed.json.tables.map((t) => t.name)).toContain('Section');

    // And the schema surface reports no columns — this is the measurement
    // behind DEF-014 §3's question about telling a typo from an unwritten
    // property. There is nothing here to tell them apart with: a column is
    // only ever recorded at the moment a write creates it.
    const table = await req<{ columns: unknown[] }>('GET', '/admin/schema/Section');
    expect(table.status).toBe(200);
    expect(table.json.columns).toEqual([]);
  });

  it('NEGATIVE CONTROL: the same filter, once a row carries the property, returns that row', async () => {
    const mine = 'baa851b3-0000-0000-0000-000000000000';
    const theirs = 'c0ffee00-0000-0000-0000-000000000000';
    const created = await req<ParseRecord>('POST', '/classes/Section', { pageId: mine, title: 'Hero' });
    expect(created.status).toBe(201);
    await req<ParseRecord>('POST', '/classes/Section', { pageId: theirs, title: 'Other' });

    const where = encodeURIComponent(JSON.stringify({ pageId: mine }));
    const { status, json } = await req<ParseQueryResult>('GET', `/classes/Section?where=${where}`);
    expect(status).toBe(200);
    expect(json.results.map((r) => r.title)).toEqual(['Hero']);
  });

  it('NEGATIVE CONTROL: a filter that matches nothing on a column that DOES exist is still 200 and empty', async () => {
    const where = encodeURIComponent(JSON.stringify({ pageId: 'no-such-page' }));
    const { status, json } = await req<ParseQueryResult>('GET', `/classes/Section?where=${where}`);
    expect(status).toBe(200);
    expect(json.results).toEqual([]);
  });

  it('counts and sorts on an unwritten property without failing either', async () => {
    const where = encodeURIComponent(JSON.stringify({ neverWritten: 'x' }));
    const counted = await req<ParseQueryResult>('GET', `/classes/Section?where=${where}&count=1`);
    expect(counted.status).toBe(200);
    expect(counted.json.count).toBe(0);

    // A list page ordering by a property no row carries yet — the same column
    // reference in a different clause, and it failed the same way.
    const sorted = await req<ParseQueryResult>('GET', '/classes/Section?order=-neverWritten');
    expect(sorted.status).toBe(200);
    expect(sorted.json.results).toHaveLength(2);
  });
});
