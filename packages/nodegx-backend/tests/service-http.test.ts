/**
 * WF-004 second half — integration tests for the full HTTP surface, run
 * against a real BackendService on a real node:sqlite database in a temp dir.
 *
 * Three families are exercised the way their actual clients speak them:
 *   - Parse-wire: the request shapes `cloudstore.js`/`userservice.ts`/
 *     `configservice.js`/`cloudfunctions.js` emit, verbatim.
 *   - BYOB `/api/:table` + `/api/_schema` + `/api/_batch`.
 *   - Admin `/admin/*` + `/executions*` (what BackendManager proxies IPC to).
 *
 * Plus the WF-004 success criteria that live at this level: persistence across
 * a service restart, and token auth on a non-loopback bind.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(30000);

const HELLO_WORKFLOW = {
  components: [
    {
      name: '/#__cloud__/hello',
      nodes: [
        {
          id: 'req1',
          type: 'noodl.cloud.request',
          x: 0,
          y: 0,
          parameters: { allowNoAuth: true },
          ports: [],
          children: []
        },
        { id: 'res1', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req1', sourcePort: 'receive', targetId: 'res1', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

describe('nodegx-backend HTTP surface', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  async function req(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; json: any }> {
    const res = await fetch(`${base}${pathName}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json };
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-test-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'hello.workflow.json'), JSON.stringify(HELLO_WORKFLOW));

    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'backend_test',
      backendName: 'Test Backend'
    });
    const started = await service.start();
    base = started.listen.url;
    expect(started.persistence.status.persistent).toBe(true);
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Parse-wire: records
  // ==========================================================================

  let taskId: string;

  it('POST /classes/:c creates and answers with the minimal Parse shape', async () => {
    const { status, json } = await req('POST', '/classes/Task', { title: 'first', done: false, priority: 1 });
    expect(status).toBe(201);
    expect(json.objectId).toBeDefined();
    expect(json.createdAt).toBeDefined();
    // Parse's create response is objectId+createdAt ONLY — the client merges
    // its own data over it without deserializing, so extra fields would leak.
    expect(Object.keys(json).sort()).toEqual(['createdAt', 'objectId']);
    taskId = json.objectId;
  });

  it('POST /classes/:c with _method:GET tunnels a query (where/order/count)', async () => {
    await req('POST', '/classes/Task', { title: 'second', done: true, priority: 9 });
    const { status, json } = await req('POST', '/classes/Task', {
      _method: 'GET',
      where: { priority: { $gte: 5 } },
      order: '-priority',
      limit: 10,
      count: 1
    });
    expect(status).toBe(200);
    expect(json.results.length).toBe(1);
    expect(json.results[0].title).toBe('second');
    expect(json.count).toBe(1);
  });

  it('keys= restricts fields but always includes objectId', async () => {
    const { json } = await req('POST', '/classes/Task', { _method: 'GET', keys: 'title', limit: 100 });
    expect(json.results.length).toBeGreaterThan(0);
    for (const r of json.results) {
      expect(r.objectId).toBeDefined();
      expect(r.priority).toBeUndefined();
    }
  });

  it('PUT increments via the Increment op and echoes the counter', async () => {
    const { status, json } = await req('PUT', `/classes/Task/${taskId}`, {
      priority: { __op: 'Increment', amount: 4 }
    });
    expect(status).toBe(200);
    expect(json.updatedAt).toBeDefined();
    expect(json.priority).toBe(5);
  });

  it('GET /classes/:c/:id fetches; unknown id answers 404 code 101', async () => {
    const found = await req('GET', `/classes/Task/${taskId}`);
    expect(found.status).toBe(200);
    expect(found.json.title).toBe('first');

    const missing = await req('GET', '/classes/Task/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.json.code).toBe(101);
  });

  it('expands schema-typed pointers on include= and envelopes them otherwise', async () => {
    // Schema-typed pointer column, as the editor's schema manager would create it.
    await req('POST', '/admin/schema', {
      action: 'createTable',
      table: 'Comment',
      columns: [
        { name: 'text', type: 'String' },
        { name: 'task', type: 'Pointer', targetClass: 'Task' }
      ]
    });
    const created = await req('POST', '/classes/Comment', {
      text: 'a comment',
      task: { __type: 'Pointer', className: 'Task', objectId: taskId }
    });
    expect(created.status).toBe(201);

    const plain = await req('POST', '/classes/Comment', { _method: 'GET', limit: 10 });
    expect(plain.json.results[0].task).toEqual({ __type: 'Pointer', className: 'Task', objectId: taskId });

    const included = await req('POST', '/classes/Comment', { _method: 'GET', limit: 10, include: 'task' });
    const expanded = included.json.results[0].task;
    expect(expanded.__type).toBe('Object');
    expect(expanded.className).toBe('Task');
    expect(expanded.objectId).toBe(taskId);
    expect(expanded.title).toBe('first');
  });

  it('AddRelation + $relatedTo round-trip, then RemoveRelation empties it', async () => {
    const comment = (await req('POST', '/classes/Comment', { _method: 'GET', limit: 1 })).json.results[0];

    const add = await req('PUT', `/classes/Task/${taskId}`, {
      comments: {
        __op: 'AddRelation',
        objects: [{ __type: 'Pointer', className: 'Comment', objectId: comment.objectId }]
      }
    });
    expect(add.status).toBe(200);

    const related = await req('POST', '/classes/Comment', {
      _method: 'GET',
      where: {
        $relatedTo: { object: { __type: 'Pointer', className: 'Task', objectId: taskId }, key: 'comments' }
      },
      limit: 10
    });
    expect(related.json.results.length).toBe(1);
    expect(related.json.results[0].objectId).toBe(comment.objectId);

    await req('PUT', `/classes/Task/${taskId}`, {
      comments: {
        __op: 'RemoveRelation',
        objects: [{ __type: 'Pointer', className: 'Comment', objectId: comment.objectId }]
      }
    });
    const after = await req('POST', '/classes/Comment', {
      _method: 'GET',
      where: {
        $relatedTo: { object: { __type: 'Pointer', className: 'Task', objectId: taskId }, key: 'comments' }
      },
      limit: 10
    });
    expect(after.json.results.length).toBe(0);
  });

  it('GET /classes/:c serves count() calls (where + limit=0 + count=1)', async () => {
    const { json } = await req('GET', '/classes/Task?limit=0&count=1');
    expect(json.results).toEqual([]);
    expect(json.count).toBeGreaterThanOrEqual(2);
  });

  it('GET /aggregate/:c handles group accessors and distinct', async () => {
    const group = encodeURIComponent(JSON.stringify({ maxP: { $max: '$priority' }, _id: null }));
    const agg = await req('GET', `/aggregate/Task?$group=${group}`);
    expect(agg.json.results[0].maxP).toBe(9);

    const distinct = await req('GET', '/aggregate/Task?distinct=done');
    expect(distinct.json.results.sort()).toEqual([0, 1]);
  });

  it('DELETE /classes/:c/:id deletes', async () => {
    const created = await req('POST', '/classes/Task', { title: 'doomed' });
    const del = await req('DELETE', `/classes/Task/${created.json.objectId}`);
    expect(del.status).toBe(200);
    const gone = await req('GET', `/classes/Task/${created.json.objectId}`);
    expect(gone.status).toBe(404);
  });

  // ==========================================================================
  // Parse-wire: sessions (userservice.ts request shapes)
  // ==========================================================================

  let sessionToken: string;
  let userId: string;

  it('signup -> 201 with objectId/createdAt/sessionToken; duplicate -> 202', async () => {
    const ok = await req('POST', '/users', {
      username: 'rich',
      password: 'secret123',
      email: 'r@x.io',
      nickname: 'Rich'
    });
    expect(ok.status).toBe(201);
    expect(ok.json.objectId).toBeDefined();
    expect(ok.json.sessionToken).toMatch(/^r:/);

    const dup = await req('POST', '/users', { username: 'rich', password: 'other' });
    expect(dup.status).toBe(400);
    expect(dup.json.code).toBe(202);
  });

  it('login -> user + sessionToken, never the password hash; bad login -> 101', async () => {
    const ok = await req('POST', '/login', { username: 'rich', password: 'secret123', _method: 'GET' });
    expect(ok.status).toBe(200);
    expect(ok.json.username).toBe('rich');
    expect(ok.json.sessionToken).toMatch(/^r:/);
    expect(ok.json._hashed_password).toBeUndefined();
    sessionToken = ok.json.sessionToken;
    userId = ok.json.objectId;

    const bad = await req('POST', '/login', { username: 'rich', password: 'wrong', _method: 'GET' });
    expect(bad.status).toBe(404);
    expect(bad.json.code).toBe(101);
  });

  it('GET /users/me echoes the session token (the client re-stores the whole response)', async () => {
    const me = await req('GET', '/users/me', undefined, { 'X-Parse-Session-Token': sessionToken });
    expect(me.status).toBe(200);
    expect(me.json.objectId).toBe(userId);
    expect(me.json.sessionToken).toBe(sessionToken);
    expect(me.json._hashed_password).toBeUndefined();

    const bogus = await req('GET', '/users/me', undefined, { 'X-Parse-Session-Token': 'r:bogus' });
    expect(bogus.status).toBe(400);
    expect(bogus.json.code).toBe(209);
  });

  it('PUT /users/:id updates own user only', async () => {
    const ok = await req('PUT', `/users/${userId}`, { nickname: 'Richy' }, { 'X-Parse-Session-Token': sessionToken });
    expect(ok.status).toBe(200);
    expect(ok.json.updatedAt).toBeDefined();

    const other = await req('POST', '/users', { username: 'eve', password: 'pw' });
    const stranger = await req(
      'PUT',
      `/users/${userId}`,
      { nickname: 'hax' },
      { 'X-Parse-Session-Token': other.json.sessionToken }
    );
    expect(stranger.status).toBe(403);
  });

  it('logout invalidates the session -> subsequent /users/me is 209', async () => {
    const login = await req('POST', '/login', { username: 'eve', password: 'pw', _method: 'GET' });
    const token = login.json.sessionToken;
    await req('POST', '/logout', {}, { 'X-Parse-Session-Token': token });
    const me = await req('GET', '/users/me', undefined, { 'X-Parse-Session-Token': token });
    expect(me.json.code).toBe(209);
  });

  it('account email flows answer 501 (JSON) / HTML for the scraped endpoints', async () => {
    const reset = await req('POST', '/requestPasswordReset', { email: 'r@x.io' });
    expect(reset.status).toBe(501);

    const res = await fetch(`${base}/apps/backend_test/verify_email?username=rich&token=x`);
    expect(res.status).toBe(501);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  // ==========================================================================
  // Parse-wire: files, config, functions
  // ==========================================================================

  it('uploads, serves, and deletes files', async () => {
    const upload = await fetch(`${base}/files/note.txt`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello files'
    });
    expect(upload.status).toBe(201);
    const { url, name } = (await upload.json()) as { url: string; name: string };
    expect(name).toContain('note.txt');

    const served = await fetch(url);
    expect(await served.text()).toBe('hello files');

    const del = await req('DELETE', `/files/${name}`);
    expect(del.status).toBe(200);
    const gone = await fetch(url);
    expect(gone.status).toBe(404);
  });

  it('GET /config serves {} by default and config-params.json when present', async () => {
    const empty = await req('GET', '/config');
    expect(empty.json).toEqual({ params: {} });

    fs.writeFileSync(path.join(dataDir, 'config-params.json'), JSON.stringify({ greeting: 'hi' }));
    const withParams = await req('GET', '/config');
    expect(withParams.json).toEqual({ params: { greeting: 'hi' } });
  });

  it('runs a real cloud function and logs a scrubbed execution', async () => {
    const run = await req('POST', '/functions/hello', { password: 'super-secret', note: 'ok' });
    expect(run.status).toBe(200);
    expect(run.json).toEqual({ result: {} });

    const unknown = await req('POST', '/functions/nope', {});
    expect(unknown.status).toBe(404);

    const list = await req('GET', '/executions?limit=10');
    const entry = list.json.find((e: any) => e.workflowId === 'hello');
    expect(entry).toBeDefined();
    expect(entry.status).toBe('success');
    expect(entry.metadata.backendId).toBe('backend_test');

    const detail = await req('GET', `/executions/${entry.id}`);
    expect(detail.status).toBe(200);
    expect(detail.json.triggerData.body.password).toBe('[REDACTED]');
    expect(detail.json.triggerData.body.note).toBe('ok');
  });

  // ==========================================================================
  // BYOB + admin
  // ==========================================================================

  it('BYOB /api/:table CRUD answers storage-shaped records', async () => {
    const created = await req('POST', '/api/Notes', { text: 'hi' });
    expect(created.status).toBe(201);
    expect(created.json.objectId).toBeDefined();
    expect(created.json.text).toBe('hi');

    const queried = await req('GET', '/api/Notes?count=1');
    expect(queried.json.results.length).toBe(1);
    expect(queried.json.count).toBe(1);

    const saved = await req('PUT', `/api/Notes/${created.json.objectId}`, { text: 'edited' });
    expect(saved.json.text).toBe('edited');

    const batch = await req('POST', '/api/_batch', {
      operations: [{ method: 'create', collection: 'Notes', data: { text: 'batched' } }]
    });
    expect(batch.json.results[0].objectId).toBeDefined();

    const deleted = await req('DELETE', `/api/Notes/${created.json.objectId}`);
    expect(deleted.json.deleted).toBe(true);
  });

  it('GET /admin/schema lists user tables but not system (_-prefixed) ones', async () => {
    const { json } = await req('GET', '/admin/schema');
    const names = json.tables.map((t: any) => t.name);
    // Regression guard for the SchemaManager LIKE-wildcard bug: an unescaped
    // `NOT LIKE '_%'` excluded EVERY table once a real engine ran.
    expect(names).toContain('Task');
    expect(names).toContain('Comment');
    expect(names).not.toContain('_User');
    expect(names).not.toContain('_Session');
  });

  it('admin schema mutations: addColumn, renameColumn, deleteTable, export', async () => {
    await req('POST', '/admin/schema', { action: 'createTable', table: 'Temp', columns: [{ name: 'a', type: 'String' }] });
    await req('POST', '/admin/schema', { action: 'addColumn', table: 'Temp', column: { name: 'b', type: 'Number' } });
    await req('POST', '/admin/schema', { action: 'renameColumn', table: 'Temp', oldName: 'b', newName: 'c' });

    const schema = await req('GET', '/admin/schema/Temp');
    const colNames = schema.json.columns.map((c: any) => c.name);
    expect(colNames).toContain('a');
    expect(colNames).toContain('c');
    expect(colNames).not.toContain('b');

    const exported = await req('GET', '/admin/schema-export?format=postgres');
    expect(exported.json.content).toContain('CREATE TABLE');

    const del = await req('POST', '/admin/schema', { action: 'deleteTable', table: 'Temp' });
    expect(del.json.success).toBe(true);
    const gone = await req('GET', '/admin/schema/Temp');
    expect(gone.status).toBe(404);
  });

  it('admin workflow status reports the loaded function', async () => {
    const status = await req('GET', '/admin/workflows');
    expect(status.json.initialized).toBe(true);
    expect(status.json.functions).toEqual([{ name: 'hello', workflow: 'hello' }]);
  });
});

describe('persistence across a service restart', () => {
  it('writes, stops the service, starts a fresh one on the same dataDir, reads back', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-restart-'));
    try {
      const first = new BackendService({ dataDir, port: 0, backendId: 'restart_test', backendName: 'Restart' });
      const started1 = await first.start();
      const create = await fetch(`${started1.listen.url}/classes/Persisted`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 42 })
      });
      const { objectId } = (await create.json()) as { objectId: string };
      await first.stop();

      const second = new BackendService({ dataDir, port: 0, backendId: 'restart_test', backendName: 'Restart' });
      const started2 = await second.start();
      const read = await fetch(`${started2.listen.url}/classes/Persisted/${objectId}`);
      const record = (await read.json()) as { value: number };
      expect(read.status).toBe(200);
      expect(record.value).toBe(42);
      await second.stop();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe('auth policy on non-loopback binds (BAK-003 model)', () => {
  it('refuses to start with dev-open on a non-loopback bind (the interlock)', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-auth-'));
    // First start on loopback writes the default security.json (devOpen: true).
    const local = new BackendService({ dataDir, port: 0, backendId: 'auth_test', backendName: 'Auth' });
    try {
      const started = await local.start();
      await started.stop();

      const publicBind = new BackendService({
        dataDir,
        port: 0,
        host: '0.0.0.0',
        backendId: 'auth_test',
        backendName: 'Auth'
      });
      await expect(publicBind.start()).rejects.toThrow(/devOpen/);
    } finally {
      await local.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('with dev-open off: CLPs govern data routes, the admin credential governs admin routes, /health stays public', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-auth-'));
    fs.mkdirSync(dataDir, { recursive: true });
    // Pre-write a locked config so the non-loopback start passes the interlock.
    const config = {
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
      files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
      signup: 'public'
    };
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(config));

    const service = new BackendService({
      dataDir,
      port: 0,
      host: '0.0.0.0',
      authToken: 'test-token', // WF-004 --token, now the admin credential
      backendId: 'auth_test',
      backendName: 'Auth'
    });
    try {
      const started = await service.start();
      const base = `http://127.0.0.1:${started.listen.port}`;

      // /health stays public (supervisor handshake + ops probes).
      const health = await fetch(`${base}/health`);
      expect(health.status).toBe(200);

      // Data routes: no blanket wall — CLP denies the anonymous caller (403/119).
      const denied = await fetch(`${base}/api/Notes`);
      expect(denied.status).toBe(403);
      expect((await denied.json()).code).toBe(119);

      // The admin credential (old WF-004 token) has full access.
      const allowed = await fetch(`${base}/api/Notes`, { headers: { authorization: 'Bearer test-token' } });
      expect(allowed.status).toBe(200);

      // Admin routes answer 401 without it — same answer for wrong and missing.
      const adminDenied = await fetch(`${base}/admin/schema`);
      expect(adminDenied.status).toBe(401);
      const adminWrong = await fetch(`${base}/admin/schema`, { headers: { authorization: 'Bearer wrong' } });
      expect(adminWrong.status).toBe(401);
    } finally {
      await service.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
