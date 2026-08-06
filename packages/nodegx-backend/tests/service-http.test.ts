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

import type { ExecutionWithSteps, WorkflowExecution } from '../src/execution/ExecutionStore';
import type { SchemaMutationResponse, SchemaResponse, TableSchemaResponse } from '../src/server/byob-admin';
import type { WorkflowRunnerStatus } from '../src/workflow/WorkflowRunner';
import { BackendService } from '../src/service';

import {
  adminHeaders,
  DeletedResponse,
  ErrorBody,
  ParseQueryResult,
  ParseRecord,
  request,
  UserResponse
} from './helpers/http';

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

  // The admin credential rides every call unless a test overrides it. FH-024:
  // dev-open relaxes the data and function gates on loopback and no longer the
  // admin one, so `/admin/*` and `/executions` want the token here — the same
  // token the editor's supervisor already sends on every proxied request.
  const req = <T = unknown>(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ) => request<T>(base, method, pathName, { body, headers: { ...adminHeaders(dataDir), ...headers } });

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
    const { status, json } = await req<ParseRecord>('POST', '/classes/Task', { title: 'first', done: false, priority: 1 });
    expect(status).toBe(201);
    expect(json.objectId).toBeDefined();
    expect(json.createdAt).toBeDefined();
    // Parse's create response is objectId+createdAt ONLY — the client merges
    // its own data over it without deserializing, so extra fields would leak.
    expect(Object.keys(json).sort()).toEqual(['createdAt', 'objectId']);
    taskId = json.objectId;
  });

  it('POST /classes/:c with _method:GET tunnels a query (where/order/count)', async () => {
    await req<ParseRecord>('POST', '/classes/Task', { title: 'second', done: true, priority: 9 });
    const { status, json } = await req<ParseQueryResult>('POST', '/classes/Task', {
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
    const { json } = await req<ParseQueryResult>('POST', '/classes/Task', { _method: 'GET', keys: 'title', limit: 100 });
    expect(json.results.length).toBeGreaterThan(0);
    for (const r of json.results) {
      expect(r.objectId).toBeDefined();
      expect(r.priority).toBeUndefined();
    }
  });

  it('PUT increments via the Increment op and echoes the counter', async () => {
    const { status, json } = await req<ParseRecord>('PUT', `/classes/Task/${taskId}`, {
      priority: { __op: 'Increment', amount: 4 }
    });
    expect(status).toBe(200);
    expect(json.updatedAt).toBeDefined();
    expect(json.priority).toBe(5);
  });

  it('GET /classes/:c/:id fetches; unknown id answers 404 code 101', async () => {
    const found = await req<ParseRecord>('GET', `/classes/Task/${taskId}`);
    expect(found.status).toBe(200);
    expect(found.json.title).toBe('first');

    const missing = await req<ParseRecord>('GET', '/classes/Task/does-not-exist');
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
    const created = await req<ParseRecord>('POST', '/classes/Comment', {
      text: 'a comment',
      task: { __type: 'Pointer', className: 'Task', objectId: taskId }
    });
    expect(created.status).toBe(201);

    const plain = await req<ParseQueryResult>('POST', '/classes/Comment', { _method: 'GET', limit: 10 });
    expect(plain.json.results[0].task).toEqual({ __type: 'Pointer', className: 'Task', objectId: taskId });

    const included = await req<ParseQueryResult>('POST', '/classes/Comment', { _method: 'GET', limit: 10, include: 'task' });
    // An expanded pointer is a full object under `__type: 'Object'`, which the
    // stored-field bag cannot say on its own.
    const expanded = included.json.results[0].task as ParseRecord & { __type: string; className: string };
    expect(expanded.__type).toBe('Object');
    expect(expanded.className).toBe('Task');
    expect(expanded.objectId).toBe(taskId);
    expect(expanded.title).toBe('first');
  });

  it('AddRelation + $relatedTo round-trip, then RemoveRelation empties it', async () => {
    const comment = (await req<ParseQueryResult>('POST', '/classes/Comment', { _method: 'GET', limit: 1 })).json.results[0];

    const add = await req<ParseRecord>('PUT', `/classes/Task/${taskId}`, {
      comments: {
        __op: 'AddRelation',
        objects: [{ __type: 'Pointer', className: 'Comment', objectId: comment.objectId }]
      }
    });
    expect(add.status).toBe(200);

    const related = await req<ParseQueryResult>('POST', '/classes/Comment', {
      _method: 'GET',
      where: {
        $relatedTo: { object: { __type: 'Pointer', className: 'Task', objectId: taskId }, key: 'comments' }
      },
      limit: 10
    });
    expect(related.json.results.length).toBe(1);
    expect(related.json.results[0].objectId).toBe(comment.objectId);

    await req<ParseRecord>('PUT', `/classes/Task/${taskId}`, {
      comments: {
        __op: 'RemoveRelation',
        objects: [{ __type: 'Pointer', className: 'Comment', objectId: comment.objectId }]
      }
    });
    const after = await req<ParseQueryResult>('POST', '/classes/Comment', {
      _method: 'GET',
      where: {
        $relatedTo: { object: { __type: 'Pointer', className: 'Task', objectId: taskId }, key: 'comments' }
      },
      limit: 10
    });
    expect(after.json.results.length).toBe(0);
  });

  it('GET /classes/:c serves count() calls (where + limit=0 + count=1)', async () => {
    const { json } = await req<ParseQueryResult>('GET', '/classes/Task?limit=0&count=1');
    expect(json.results).toEqual([]);
    expect(json.count).toBeGreaterThanOrEqual(2);
  });

  it('GET /aggregate/:c handles group accessors and distinct', async () => {
    const group = encodeURIComponent(JSON.stringify({ maxP: { $max: '$priority' }, _id: null }));
    const agg = await req<ParseQueryResult>('GET', `/aggregate/Task?$group=${group}`);
    expect(agg.json.results[0].maxP).toBe(9);

    const distinct = await req<ParseQueryResult>('GET', '/aggregate/Task?distinct=done');
    expect(distinct.json.results.sort()).toEqual([0, 1]);
  });

  it('DELETE /classes/:c/:id deletes', async () => {
    const created = await req<ParseRecord>('POST', '/classes/Task', { title: 'doomed' });
    const del = await req<DeletedResponse>('DELETE', `/classes/Task/${created.json.objectId}`);
    expect(del.status).toBe(200);
    const gone = await req<ParseRecord>('GET', `/classes/Task/${created.json.objectId}`);
    expect(gone.status).toBe(404);
  });

  // ==========================================================================
  // Parse-wire: sessions (userservice.ts request shapes)
  // ==========================================================================

  let sessionToken: string;
  let userId: string;

  /**
   * `sessionToken` rides only on signup and login, so `UserResponse` declares it
   * optional. Asserting it here means "this response was supposed to carry one"
   * rather than sending `undefined` on as a header value, which the server would
   * read as an anonymous request and answer 209 for reasons unrelated to the
   * test.
   */
  function tokenOf(user: UserResponse): string {
    if (!user.sessionToken) throw new Error(`no sessionToken on the response for ${user.username ?? user.objectId}`);
    return user.sessionToken;
  }

  it('signup -> 201 with objectId/createdAt/sessionToken; duplicate -> 202', async () => {
    const ok = await req<UserResponse>('POST', '/users', {
      username: 'rich',
      password: 'secret123',
      email: 'r@x.io',
      nickname: 'Rich'
    });
    expect(ok.status).toBe(201);
    expect(ok.json.objectId).toBeDefined();
    expect(ok.json.sessionToken).toMatch(/^r:/);

    const dup = await req<UserResponse>('POST', '/users', { username: 'rich', password: 'other' });
    expect(dup.status).toBe(400);
    expect(dup.json.code).toBe(202);
  });

  it('login -> user + sessionToken, never the password hash; bad login -> 101', async () => {
    const ok = await req<UserResponse>('POST', '/login', { username: 'rich', password: 'secret123', _method: 'GET' });
    expect(ok.status).toBe(200);
    expect(ok.json.username).toBe('rich');
    expect(ok.json.sessionToken).toMatch(/^r:/);
    expect(ok.json._hashed_password).toBeUndefined();
    sessionToken = tokenOf(ok.json);
    userId = ok.json.objectId;

    const bad = await req<UserResponse>('POST', '/login', { username: 'rich', password: 'wrong', _method: 'GET' });
    expect(bad.status).toBe(404);
    expect(bad.json.code).toBe(101);
  });

  /**
   * BCN-006's other half — `emailVerified` is a **fact**, not an absence.
   *
   * The client could only ever half-fix this. `POST /users` answers
   * `{objectId, createdAt, sessionToken}` and nothing else, deliberately, so
   * BCN-006 made the *client* default a brand-new sign-up to `false`. That fixed
   * the account it had just created and nothing else: a user whose row predates
   * the change, or who signs in on a fresh page load, still read `undefined` —
   * and a graph doing `if (!user.emailVerified) show the "please verify" banner`
   * could not tell "not verified" from "this backend does not track it".
   *
   * ⚠️ **`false`, not `0`.** SQLite has no boolean type and this codebase has
   * been bitten by that before (`isFlagSet` exists because `record.emailVerified
   * === true` was false for a verified user). The column is inferred as `Boolean`
   * and comes back as a real boolean; asserting the *type* is what would catch a
   * regression to a number, which would reach a graph as a truthy-looking `0`.
   */
  it('signup writes emailVerified: false, so login and /users/me report it', async () => {
    const signup = await req<UserResponse>('POST', '/users', {
      username: 'bcn006b_ev',
      password: 'secret123',
      email: 'bcn006b_ev@x.io'
    });
    expect(signup.status).toBe(201);

    const login = await req<UserResponse>('POST', '/login', {
      username: 'bcn006b_ev',
      password: 'secret123',
      _method: 'GET'
    });
    expect(login.status).toBe(200);
    expect(login.json.emailVerified).toBe(false);
    expect(typeof login.json.emailVerified).toBe('boolean');

    const me = await req<UserResponse>('GET', '/users/me', undefined, {
      'X-Parse-Session-Token': tokenOf(login.json)
    });
    expect(me.json.emailVerified).toBe(false);
  });

  it('GET /users/me echoes the session token (the client re-stores the whole response)', async () => {
    const me = await req<UserResponse>('GET', '/users/me', undefined, { 'X-Parse-Session-Token': sessionToken });
    expect(me.status).toBe(200);
    expect(me.json.objectId).toBe(userId);
    expect(me.json.sessionToken).toBe(sessionToken);
    expect(me.json._hashed_password).toBeUndefined();

    const bogus = await req<UserResponse>('GET', '/users/me', undefined, { 'X-Parse-Session-Token': 'r:bogus' });
    expect(bogus.status).toBe(400);
    expect(bogus.json.code).toBe(209);
  });

  it('PUT /users/:id updates own user only', async () => {
    const ok = await req<UserResponse>('PUT', `/users/${userId}`, { nickname: 'Richy' }, { 'X-Parse-Session-Token': sessionToken });
    expect(ok.status).toBe(200);
    expect(ok.json.updatedAt).toBeDefined();

    const other = await req<UserResponse>('POST', '/users', { username: 'eve', password: 'pw' });
    const stranger = await req<UserResponse>(
      'PUT',
      `/users/${userId}`,
      { nickname: 'hax' },
      { 'X-Parse-Session-Token': tokenOf(other.json) }
    );
    expect(stranger.status).toBe(403);
  });

  it('logout invalidates the session -> subsequent /users/me is 209', async () => {
    const login = await req<UserResponse>('POST', '/login', { username: 'eve', password: 'pw', _method: 'GET' });
    const token = tokenOf(login.json);
    await req('POST', '/logout', {}, { 'X-Parse-Session-Token': token });
    const me = await req<UserResponse>('GET', '/users/me', undefined, { 'X-Parse-Session-Token': token });
    expect(me.json.code).toBe(209);
  });

  it('account email flows are real (BAK-002): JSON endpoints answer 200, the scraped endpoints answer HTML', async () => {
    // Anti-enumeration: always 200/{}, whether or not the address exists and
    // whether or not SMTP is configured (this backend has none — see the
    // dedicated email-flows.test.ts for the full loud/quiet-failure matrix).
    const reset = await req('POST', '/requestPasswordReset', { email: 'r@x.io' });
    expect(reset.status).toBe(200);
    expect(reset.json).toEqual({});

    const res = await fetch(`${base}/apps/backend_test/verify_email?username=rich&token=x`);
    expect(res.status).toBe(400); // invalid/unknown token -> the served failure page, not a 501
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

    const list = await req<WorkflowExecution[]>('GET', '/executions?limit=10');
    const entry = list.json.find((e) => e.workflowId === 'hello');
    if (!entry) throw new Error('no execution recorded for the "hello" function');
    expect(entry.status).toBe('success');
    expect(entry.metadata?.backendId).toBe('backend_test');

    const detail = await req<ExecutionWithSteps>('GET', `/executions/${entry.id}`);
    expect(detail.status).toBe(200);
    // `triggerData` is the per-trigger-kind bag (see DbChangeLegacyPayload for the
    // db-change one); for a function call it carries the scrubbed HTTP body.
    const body = (detail.json.triggerData as { body: Record<string, unknown> } | undefined)?.body;
    expect(body?.password).toBe('[REDACTED]');
    expect(body?.note).toBe('ok');
  });

  // ==========================================================================
  // BYOB + admin
  // ==========================================================================

  it('BYOB /api/:table CRUD answers storage-shaped records', async () => {
    const created = await req<ParseRecord>('POST', '/api/Notes', { text: 'hi' });
    expect(created.status).toBe(201);
    expect(created.json.objectId).toBeDefined();
    expect(created.json.text).toBe('hi');

    const queried = await req<ParseQueryResult>('GET', '/api/Notes?count=1');
    expect(queried.json.results.length).toBe(1);
    expect(queried.json.count).toBe(1);

    const saved = await req<ParseRecord>('PUT', `/api/Notes/${created.json.objectId}`, { text: 'edited' });
    expect(saved.json.text).toBe('edited');

    const batch = await req<ParseQueryResult>('POST', '/api/_batch', {
      operations: [{ method: 'create', collection: 'Notes', data: { text: 'batched' } }]
    });
    expect(batch.json.results[0].objectId).toBeDefined();

    const deleted = await req<DeletedResponse>('DELETE', `/api/Notes/${created.json.objectId}`);
    expect(deleted.json.deleted).toBe(true);
  });

  it('DELETE /api/:table/:id 404s for a row that is not there (POL-014)', async () => {
    // The adapter only reports "Object not found" when an ACL predicate is in
    // play, so an admin delete of a missing row removed nothing, threw nothing,
    // and this route used to answer `{ deleted: true }`. That is how the Data
    // Browser could accept a delete confirm and silently do nothing.
    const missing = await req<{ error?: string }>('DELETE', '/api/Notes/undefined');
    expect(missing.status).toBe(404);

    // Deleting the same row twice: the first is a delete, the second is not.
    const created = await req<ParseRecord>('POST', '/api/Notes', { text: 'transient' });
    const first = await req<DeletedResponse>('DELETE', `/api/Notes/${created.json.objectId}`);
    expect(first.status).toBe(200);
    const second = await req('DELETE', `/api/Notes/${created.json.objectId}`);
    expect(second.status).toBe(404);
  });

  it('GET /admin/schema lists user tables but not system (_-prefixed) ones', async () => {
    const { json } = await req<SchemaResponse>('GET', '/admin/schema');
    const names = json.tables.map((t) => t.name);
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

    const schema = await req<TableSchemaResponse>('GET', '/admin/schema/Temp');
    // `columns` is the untyped SchemaManager's shape (PLAT-003's), so the field
    // read is named here rather than asserted away as `any`.
    const colNames = schema.json.columns.map((c) => (c as { name: string }).name);
    expect(colNames).toContain('a');
    expect(colNames).toContain('c');
    expect(colNames).not.toContain('b');

    const exported = await req<{ format: string; content: string }>('GET', '/admin/schema-export?format=postgres');
    expect(exported.json.content).toContain('CREATE TABLE');

    const del = await req<SchemaMutationResponse>('POST', '/admin/schema', { action: 'deleteTable', table: 'Temp' });
    expect(del.json.success).toBe(true);
    const gone = await req('GET', '/admin/schema/Temp');
    expect(gone.status).toBe(404);
  });

  it('admin workflow status reports the loaded function', async () => {
    const status = await req<WorkflowRunnerStatus>('GET', '/admin/workflows');
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
      const denied = await request<ErrorBody>(base, 'GET', '/api/Notes');
      expect(denied.status).toBe(403);
      expect(denied.json.code).toBe(119);

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
