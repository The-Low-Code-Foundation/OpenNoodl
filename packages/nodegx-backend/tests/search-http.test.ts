/**
 * BAK-008 full-text search — end to end over a real BackendService.
 *
 * Two backends are used:
 *   - `open` (dev-open, the BAK-007-style default) exercises the admin config
 *     surface, the query-surface wire shape, ranking, snippets, rebuild
 *     idempotence, and the "no index" / "no term" error shapes.
 *   - `locked` (devOpen: false, real users) exercises ACL composition: a user
 *     who cannot read a record cannot find it via search, mirroring
 *     security-enforcement.test.ts's cross-user isolation suite but for the
 *     search path specifically.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import type { SearchCollectionResponse, SearchConfigResponse } from '../src/server/admin-search';

import { adminHeaders, ErrorBody, ParseQueryResult, ParseRecord, request, UserResponse } from './helpers/http';

/** A search hit: a record plus the two fields the search path adds. */
interface SearchHit extends ParseRecord {
  _score?: number;
  _snippet?: string;
}
type SearchResult = ParseQueryResult<SearchHit>;

jest.setTimeout(30000);

const req = <T = unknown>(
  base: string,
  method: string,
  p: string,
  body?: unknown,
  headers: Record<string, string> = {}
) => request<T>(base, method, p, { body, headers });

describe('BAK-008 full-text search — dev-open backend', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  /**
   * `/admin/search/*` with the credential. FH-024: dev-open relaxes the data
   * and function gates on loopback but no longer the admin one — a browser can
   * reach 127.0.0.1 on the developer's behalf, so loopback was never the
   * boundary it was being read as. The editor's search panel already sends this
   * token; the seeding calls below stay unauthenticated, which is dev-open's
   * actual ergonomic and still works.
   */
  const adm = <T = unknown>(method: string, p: string, body?: unknown) =>
    req<T>(base, method, p, body, adminHeaders(dataDir));

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak008-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'bak008', backendName: 'BAK008 Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.search.fts5Available).toBe(true);

    // Seed via the BYOB surface (dev-open, no auth needed) — creates the
    // table + columns the admin/search route validates field names against.
    await req(base, 'POST', '/api/Article', { title: 'Quick brown fox', body: 'The fox jumps over the lazy dog.' });
    await req(base, 'POST', '/api/Article', { title: 'Totally unrelated', body: 'Nothing to see here.' });
    await req(base, 'POST', '/api/Article', {
      title: 'Another quick mention',
      body: 'brown paper packages tied up with string'
    });
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('reports FTS5 availability and an empty config before anything is enabled', async () => {
    const { status, json } = await adm<SearchConfigResponse>('GET', '/admin/search');
    expect(status).toBe(200);
    expect(json.fts5Available).toBe(true);
    expect(json.config.collections).toEqual({});
  });

  it('rejects enabling search with an unknown field', async () => {
    const { status, json } = await adm<SearchCollectionResponse & ErrorBody>('PUT', '/admin/search/collections/Article', {
      fields: ['title', 'doesNotExist']
    });
    expect(status).toBe(400);
    expect(json.error).toMatch(/Unknown column/);
  });

  it('rejects enabling search with no fields', async () => {
    const { status } = await adm<SearchCollectionResponse & ErrorBody>('PUT', '/admin/search/collections/Article', { fields: [] });
    expect(status).toBe(400);
  });

  it('rejects a system collection', async () => {
    const { status } = await adm<SearchCollectionResponse & ErrorBody>('PUT', '/admin/search/collections/_User', { fields: ['username'] });
    expect(status).toBe(400);
  });

  it('searching before search is enabled fails with a clear message, not a raw SQL error', async () => {
    const { status, json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Article', { _method: 'GET', search: 'quick' });
    expect(status).toBe(400);
    expect(json.error).toMatch(/Search is not enabled/);
  });

  it('enables search on a collection via the admin route and rebuilds', async () => {
    const { status, json } = await adm<SearchCollectionResponse & ErrorBody>('PUT', '/admin/search/collections/Article', {
      fields: ['title', 'body']
    });
    expect(status).toBe(200);
    expect(json.config).toEqual({ enabled: true, fields: ['title', 'body'] });
    expect(json.rebuild?.rowsIndexed).toBe(3);

    const config = await adm<SearchConfigResponse>('GET', '/admin/search');
    expect(config.json.config.collections.Article).toEqual({ enabled: true, fields: ['title', 'body'] });
  });

  it('search "quick brown" matches, ranks sensibly, and returns highlighted snippets', async () => {
    const { status, json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Article', {
      _method: 'GET',
      search: 'quick brown'
    });
    expect(status).toBe(200);
    const titles = json.results.map((r) => r.title);
    expect(titles).toContain('Quick brown fox');
    expect(titles).toContain('Another quick mention');
    expect(titles).not.toContain('Totally unrelated');

    for (const r of json.results) {
      expect(typeof r._score).toBe('number');
      expect(typeof r._snippet).toBe('string');
      expect(r._snippet).toContain('<mark>');
    }
    // Best match first.
    expect(json.results[0]._score).toBeGreaterThanOrEqual(json.results[1]._score as number);
  });

  it('search respects a structured filter in the same query', async () => {
    const { json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Article', {
      _method: 'GET',
      search: 'quick',
      where: { title: { $eq: 'Another quick mention' } }
    });
    expect(json.results.map((r) => r.title)).toEqual(['Another quick mention']);
  });

  it('an empty search term falls back to a plain query (no-op), not an error', async () => {
    const { status, json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Article', { _method: 'GET', search: '' });
    expect(status).toBe(200);
    expect(json.results.length).toBe(3); // all rows, plain query
  });

  it('a record created after enabling search is immediately findable (index sync)', async () => {
    await req(base, 'POST', '/api/Article', { title: 'Marmots everywhere', body: 'Alpine rodents.' });
    const { json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Article', { _method: 'GET', search: 'marmots' });
    expect(json.results.map((r) => r.title)).toEqual(['Marmots everywhere']);
  });

  it('rebuild is explicit and idempotent', async () => {
    const first = await adm<SearchCollectionResponse>('POST', '/admin/search/collections/Article/rebuild');
    expect(first.status).toBe(200);
    expect(first.json.rebuild?.rowsIndexed).toBe(4);

    const second = await adm<SearchCollectionResponse>('POST', '/admin/search/collections/Article/rebuild');
    expect(second.status).toBe(200);
    expect(second.json.rebuild?.rowsIndexed).toBe(4);

    const { json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Article', { _method: 'GET', search: 'marmots' });
    expect(json.results.length).toBe(1);
  });

  it('disabling search drops the index; searching afterward fails cleanly again', async () => {
    const del = await adm<SearchCollectionResponse>('DELETE', '/admin/search/collections/Article');
    expect(del.status).toBe(200);
    expect(del.json.removed).toBe(true);

    const { status, json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Article', { _method: 'GET', search: 'quick' });
    expect(status).toBe(400);
    expect(json.error).toMatch(/Search is not enabled/);
  });

  it('enabling search on a freshly-created collection works standalone', async () => {
    await req(base, 'POST', '/api/Tag', { label: 'zzz-unique-tag-value' });
    const enable = await adm<SearchCollectionResponse & ErrorBody>('PUT', '/admin/search/collections/Tag', { fields: ['label'] });
    expect(enable.status).toBe(200);
    expect(enable.json.rebuild?.rowsIndexed).toBe(1);

    const found = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Tag', { _method: 'GET', search: 'zzz-unique-tag-value' });
    expect(found.status).toBe(200);
    expect(found.json.results.length).toBe(1);
  });
});

describe('BAK-008 full-text search — ACL composition (locked backend)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  const LOCKED_CONFIG = {
    version: 1,
    devOpen: false,
    defaults: {
      permissions: {
        find: 'authenticated',
        get: 'authenticated',
        create: 'authenticated',
        update: 'authenticated',
        delete: 'authenticated'
      },
      creatorOwns: true
    },
    collections: {},
    functions: {},
    files: { upload: 'authenticated', read: 'authenticated', delete: 'nobody' },
    signup: 'public'
  };

  interface User {
    id: string;
    token: string;
  }
  let alice: User;
  let bob: User;

  const asUser = (u: User) => ({ 'x-parse-session-token': u.token });
  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });

  async function signup(username: string): Promise<User> {
    const { status, json } = await req<UserResponse>(base, 'POST', '/users', { username, password: `pw-${username}` });
    expect(status).toBe(201);
    if (!json.sessionToken) throw new Error(`signup of ${username} returned no sessionToken`);
    return { id: json.objectId, token: json.sessionToken };
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak008-acl-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    service = new BackendService({ dataDir, port: 0, backendId: 'bak008_acl', backendName: 'BAK008 ACL Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    alice = await signup('alice');
    bob = await signup('bob');

    // Alice creates a creator-owned, findable record (private by creatorOwns).
    await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Secret', { title: 'alice findable secret' }, asUser(alice));
    // A public (admin-created, no ACL) record — findable by anyone.
    await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Secret', { title: 'public findable secret' }, asAdmin());

    const enable = await req<SearchCollectionResponse & ErrorBody>(base, 'PUT', '/admin/search/collections/Secret', { fields: ['title'] }, asAdmin());
    expect(enable.status).toBe(200);
    expect(enable.json.rebuild?.rowsIndexed).toBe(2);
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('without auth, search on a locked backend is refused (find CLP gates it, same as query)', async () => {
    // Anonymous fails the collection-level `find` CLP (defaults to
    // 'authenticated') — a 403 permission denial, the same as an
    // unauthenticated plain query would get.
    const { status } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Secret', { _method: 'GET', search: 'findable' });
    expect(status).toBe(403);
  });

  it('the admin sees both records via search (bypasses ACL)', async () => {
    const { json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Secret', { _method: 'GET', search: 'findable' }, asAdmin());
    expect(json.results.length).toBe(2);
  });

  it('the owner finds their own record via search', async () => {
    const { json } = await req<SearchResult>(
      base,
      'POST',
      '/classes/Secret',
      { _method: 'GET', search: 'findable' },
      asUser(alice)
    );
    const titles = json.results.map((r) => r.title);
    expect(titles).toContain('alice findable secret');
    expect(titles).toContain('public findable secret');
  });

  it('a user who cannot read a record cannot find it via search', async () => {
    const { json } = await req<SearchResult & ErrorBody>(base, 'POST', '/classes/Secret', { _method: 'GET', search: 'findable' }, asUser(bob));
    const titles = json.results.map((r) => r.title);
    expect(titles).not.toContain('alice findable secret');
    expect(titles).toContain('public findable secret');
  });
});
