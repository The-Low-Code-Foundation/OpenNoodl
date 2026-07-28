/**
 * WFA-005 — the two shipped trigger defects, against a real running service.
 *
 * **F7.** `webhook.ts` accepts a per-hook secret as `Authorization: Bearer` and
 * its own refusal message advertises that it does, but `resolvePrincipal` ran
 * for every request before routing and threw 401 for any Bearer that was not an
 * admin token — so that form could never authenticate. A third-party service
 * that sends only `Authorization` could not call a NodeGX hook, and the error it
 * got did not mention webhooks.
 *
 * The fix exempts the hook route family from service-credential resolution. That
 * is a security boundary, so the specs below assert both halves: that the three
 * documented transports work AND that the exemption reaches nothing else —
 * `/admin/*` is still admin-only, and an admin token is not a skeleton key for
 * arbitrary hooks.
 *
 * **F8.** `POST /admin/triggers` answered 201 to a config it had silently
 * halved, while the same key in `triggers.json` refuses to let the service
 * start. `upsert` built a definition from the fields it knew and validated the
 * object it had just built, so an unknown key never reached validation. The
 * specs assert a 400 NAMING the key, for every trigger type — the class — and
 * then that `schedule.payload`, the key that exposed it, is stored and
 * delivered.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ErrorBody } from './helpers/http';
import type { TriggerResponse } from '../src/server/admin-triggers';
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(30000);

/** A cloud function that echoes what it was given, so `body` can be observed. */
const ECHO_WORKFLOW = {
  components: [
    {
      name: '/#__cloud__/echo',
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

/** Just enough of an execution row to find one by its trigger and read its body. */
interface ExecutionRow {
  id: string;
  metadata?: { triggerId?: string };
  triggerData?: Record<string, unknown>;
}

/**
 * A one-step workflow. A WORKFLOW target is what the payload specs run against,
 * for two reasons: it is the case F8 exists for (a schedule feeding a workflow),
 * and the engine records the run payload as `triggerData` directly — a cloud
 * function's record is the HTTP request it received (`{headers, bodySize, body}`)
 * with the payload one level further in, which would make the assertion read as
 * `triggerData.body.body` and assert the wrong thing on a rename.
 */
const PING_WORKFLOW_DEF = {
  version: 1,
  id: 'ping',
  name: 'Ping',
  entry: 'hold',
  concurrency: 1,
  steps: [{ id: 'hold', kind: 'wait', params: { duration: 1 } }],
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z'
};

const ADMIN_TOKEN = 'admin-token-for-wfa005';
const BACKEND_ID = 'backend_wfa005';

/**
 * Enforcement ON. F7 lives in `resolvePrincipal`, one step before `checkAccess`,
 * so it reproduces under dev-open too — but the "the exemption reaches nothing
 * else" specs are meaningless when dev-open relaxes every gate anyway.
 */
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

describe('WFA-005 — trigger auth and input validation', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const http = httpClient(() => base);
  const req = <T = unknown>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
    http.request<T>(method, p, { body, headers: { authorization: `Bearer ${ADMIN_TOKEN}`, ...headers } });

  /** Create a token-scheme hook and hand back its slug and one-time secret. */
  async function tokenHook(slug: string, target = { kind: 'function' as const, name: 'echo' }) {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target,
      webhook: { slug, scheme: 'token' }
    });
    expect(created.status).toBe(201);
    if (!created.json.secret) throw new Error(`hook "${slug}" was created without a secret`);
    return { id: created.json.trigger.id, secret: created.json.secret };
  }

  const hookUrl = (slug: string) => `${base}/hooks/${BACKEND_ID}/${slug}`;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wfa005-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'echo.workflow.json'), JSON.stringify(ECHO_WORKFLOW));
    fs.mkdirSync(path.join(dataDir, 'workflow-defs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflow-defs', 'ping.workflow-def.json'),
      JSON.stringify(PING_WORKFLOW_DEF)
    );
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG, null, 2));
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: BACKEND_ID,
      backendName: 'WFA-005',
      authToken: ADMIN_TOKEN
    });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // F7 — all three token transports authenticate
  // ==========================================================================

  describe('F7 — the three documented webhook token transports', () => {
    it('X-Webhook-Token authenticates', async () => {
      const { secret } = await tokenHook('t-header');
      const res = await fetch(hookUrl('t-header'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-webhook-token': secret },
        body: '{"n":1}'
      });
      expect(res.status).toBe(200);
    });

    it('Authorization: Bearer authenticates — the transport the message promises', async () => {
      const { secret } = await tokenHook('t-bearer');
      const res = await fetch(hookUrl('t-bearer'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: '{"n":2}'
      });
      expect(res.status).toBe(200);
    });

    it('?token= authenticates', async () => {
      const { secret } = await tokenHook('t-query');
      const res = await fetch(`${hookUrl('t-query')}?token=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"n":3}'
      });
      expect(res.status).toBe(200);
    });

    /**
     * The half that matters as much: a wrong secret must be refused with the
     * WEBHOOK's message. `{"error":"Unauthorized."}` from generic principal
     * resolution is what F7 looked like, and it tells the sender nothing about
     * which credential the hook wanted.
     */
    it.each([
      ['X-Webhook-Token', (s: string) => ({ headers: { 'x-webhook-token': s }, qs: '' })],
      ['Bearer', (s: string) => ({ headers: { authorization: `Bearer ${s}` }, qs: '' })],
      ['?token=', (s: string) => ({ headers: {}, qs: `?token=${encodeURIComponent(s)}` })]
    ])('a wrong secret sent as %s is rejected with the webhook message', async (_name, build) => {
      await tokenHook(`wrong-${_name.replace(/[^a-z]/gi, '').toLowerCase()}`);
      const slug = `wrong-${_name.replace(/[^a-z]/gi, '').toLowerCase()}`;
      const { headers, qs } = build('whsec_not-the-right-secret');
      const res = await fetch(`${hookUrl(slug)}${qs}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: '{}'
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/Webhook rejected/);
      expect(body.error).toMatch(/webhook token does not match/);
      expect(body.error).not.toBe('Unauthorized.');
    });

    it('a missing credential names all three transports', async () => {
      await tokenHook('t-none');
      const res = await fetch(hookUrl('t-none'), { method: 'POST', body: '{}' });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/X-Webhook-Token/);
      expect(body.error).toMatch(/Bearer/);
      expect(body.error).toMatch(/\?token=/);
    });

    it('the HMAC scheme is untouched — a Bearer is not a signature', async () => {
      const created = await req<TriggerResponse>('POST', '/admin/triggers', {
        type: 'webhook',
        target: { kind: 'function', name: 'echo' },
        webhook: { slug: 'hmac-hook' } // default scheme
      });
      const secret = created.json.secret as string;
      const res = await fetch(hookUrl('hmac-hook'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: '{}'
      });
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: string }).error).toMatch(/missing signature header/);
    });
  });

  // ==========================================================================
  // F7 — and the exemption reaches nothing else
  // ==========================================================================

  describe('F7 — the exemption is scoped to the hook route family', () => {
    /**
     * The spec's trap, written as the test it asks for. The exemption keys off
     * the matched route's declared access kind, so there is no path string to
     * dress up — but this asserts the property rather than the implementation,
     * so a future refactor to a prefix test would fail here.
     */
    it.each([
      '/admin/triggers',
      '/admin/workflow-defs',
      '/admin/permissions',
      '/admin/keys'
    ])('%s is still admin-only and unreachable without a credential', async (route) => {
      const res = await fetch(`${base}${route}`, { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it.each([
      '/hooks/../admin/triggers',
      '/hooks/%2e%2e/admin/triggers',
      '/admin/triggers?x=/hooks/'
    ])('a request dressed as a hook (%s) does not reach admin data', async (route) => {
      const res = await fetch(`${base}${route}`, { method: 'GET' });
      // 401 (still gated) or 404 (no such route) — never 200 with admin data.
      expect([401, 404]).toContain(res.status);
    });

    /**
     * The explicit constraint: do not create a path where the admin token can
     * fire arbitrary hooks. On the hook route an admin Bearer is just bytes to
     * compare against that hook's own secret.
     */
    it('an admin token cannot fire a hook it is not the secret for', async () => {
      await tokenHook('not-for-admins');
      const res = await fetch(hookUrl('not-for-admins'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` },
        body: '{}'
      });
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: string }).error).toMatch(/webhook token does not match/);
    });

    it('a hook secret is not a credential anywhere else', async () => {
      const { secret } = await tokenHook('scoped-secret');
      const res = await fetch(`${base}/admin/triggers`, {
        method: 'GET',
        headers: { authorization: `Bearer ${secret}` }
      });
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // F8 — an unknown key is a 400, per type
  // ==========================================================================

  describe('F8 — an unknown key in a trigger config is a 400 naming it', () => {
    const base400 = async (body: unknown) => req<ErrorBody>('POST', '/admin/triggers', body);

    it('rejects an unknown key at the top level', async () => {
      const res = await base400({
        type: 'schedule',
        target: { kind: 'function', name: 'echo' },
        schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' },
        retryPolicy: 'exponential'
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/unknown key "retryPolicy"/);
    });

    it('rejects an unknown key in a schedule config', async () => {
      const res = await base400({
        type: 'schedule',
        target: { kind: 'function', name: 'echo' },
        schedule: { cron: '0 * * * *', missedFirePolicy: 'skip', timezone: 'Europe/London' }
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/unknown schedule key "timezone"/);
    });

    it('rejects an unknown key in a webhook config', async () => {
      const res = await base400({
        type: 'webhook',
        target: { kind: 'function', name: 'echo' },
        webhook: { slug: 'unknown-key-hook', verifySsl: false }
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/unknown webhook key "verifySsl"/);
    });

    it('rejects an unknown key in a db-change config', async () => {
      const res = await base400({
        type: 'db-change',
        target: { kind: 'function', name: 'echo' },
        dbChange: { collection: 'Orders', actions: ['create'], filter: { total: { $gt: 100 } } }
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/unknown dbChange key "filter"/);
    });

    it('rejects an unknown key in the target', async () => {
      const res = await base400({
        type: 'schedule',
        target: { kind: 'function', name: 'echo', backendId: 'somewhere-else' },
        schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' }
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/unknown target key "backendId"/);
    });

    /**
     * A rejected write must leave the registry exactly as it was — otherwise
     * "400" would be a lie told after a partial store.
     */
    it('a rejected create stores nothing', async () => {
      const before = await req<{ triggers: unknown[] }>('GET', '/admin/triggers');
      await base400({
        type: 'webhook',
        target: { kind: 'function', name: 'echo' },
        webhook: { slug: 'never-stored', retries: 3 }
      });
      const after = await req<{ triggers: unknown[] }>('GET', '/admin/triggers');
      expect(after.json.triggers.length).toBe(before.json.triggers.length);
    });

    /**
     * The other half of the rule, and the reason it is not simply "reject every
     * key you did not ask for": GET a trigger, edit it, PUT it back is the
     * obvious gesture from a panel or an agent, and it round-trips the three
     * fields the registry owns.
     */
    it('accepts a full definition read back from GET, ignoring the registry-owned fields', async () => {
      const created = await req<TriggerResponse>('POST', '/admin/triggers', {
        type: 'schedule',
        name: 'round trip',
        target: { kind: 'function', name: 'echo' },
        schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' }
      });
      const id = created.json.trigger.id;

      const got = await req<TriggerResponse>('GET', `/admin/triggers/${id}`);
      const edited = { ...got.json.trigger, schedule: { cron: '30 2 * * *', missedFirePolicy: 'skip' as const } };
      const put = await req<TriggerResponse>('PUT', `/admin/triggers/${id}`, edited);

      expect(put.status).toBe(200);
      expect(put.json.trigger.schedule?.cron).toBe('30 2 * * *');
      // createdAt is the registry's, not the caller's.
      expect(put.json.trigger.createdAt).toBe(created.json.trigger.createdAt);
    });
  });

  // ==========================================================================
  // F8 — and then the field it was found through
  // ==========================================================================

  describe('F8 — a schedule carries a payload', () => {
    it('stores a schedule payload and returns it', async () => {
      const created = await req<TriggerResponse>('POST', '/admin/triggers', {
        type: 'schedule',
        name: 'nightly',
        target: { kind: 'function', name: 'echo' },
        schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip', payload: { mode: 'nightly', limit: 50 } }
      });
      expect(created.status).toBe(201);
      expect(created.json.trigger.schedule?.payload).toEqual({ mode: 'nightly', limit: 50 });
    });

    it('refuses a payload that is not an object, because it becomes the body', async () => {
      const res = await req<ErrorBody>('POST', '/admin/triggers', {
        type: 'schedule',
        target: { kind: 'function', name: 'echo' },
        schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip', payload: ['a', 'b'] }
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/schedule\.payload must be an object/);
    });

    it('is a schedule-only field — a webhook cannot carry one', async () => {
      const res = await req<ErrorBody>('POST', '/admin/triggers', {
        type: 'webhook',
        target: { kind: 'function', name: 'echo' },
        webhook: { slug: 'payload-hook', payload: { a: 1 } }
      });
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/unknown webhook key "payload"/);
    });

    /**
     * A test fire with no body of its own reproduces what cron will send. The
     * alternative — an empty body — makes "Test fire" exercise a payload the
     * real fire never uses, which is the one thing a test fire must not do.
     */
    it('a test fire with no body of its own uses the schedule payload', async () => {
      const created = await req<TriggerResponse>('POST', '/admin/triggers', {
        type: 'schedule',
        target: { kind: 'workflow', name: 'ping' },
        schedule: { cron: '0 4 * * *', missedFirePolicy: 'skip', payload: { from: 'the schedule' } }
      });
      const id = created.json.trigger.id;
      const fired = await req<{ fired: boolean }>('POST', `/admin/triggers/${id}/fire`, {});
      expect(fired.status).toBe(200);

      const list = await req<ExecutionRow[]>('GET', '/executions?limit=50');
      const record = list.json.find((e) => e.metadata?.triggerId === id);
      expect(record?.triggerData?.body).toEqual({ from: 'the schedule' });
    });

    it('an explicitly posted body still wins, so a variation can be tried', async () => {
      const created = await req<TriggerResponse>('POST', '/admin/triggers', {
        type: 'schedule',
        target: { kind: 'workflow', name: 'ping' },
        schedule: { cron: '0 5 * * *', missedFirePolicy: 'skip', payload: { from: 'the schedule' } }
      });
      const id = created.json.trigger.id;
      await req('POST', `/admin/triggers/${id}/fire`, { from: 'the caller' });

      const list = await req<ExecutionRow[]>('GET', '/executions?limit=50');
      const record = list.json.find((e) => e.metadata?.triggerId === id);
      expect(record?.triggerData?.body).toEqual({ from: 'the caller' });
    });
  });
});
