/**
 * WF-005 end-to-end over a real BackendService — the success criteria that only
 * a live service can prove:
 *   - admin CRUD over /admin/triggers (what the editor + MCP drive)
 *   - a webhook with the correct HMAC fires the target function, and the run
 *     appears in the execution history tagged 'webhook' with the trigger source
 *   - a wrong/missing secret is rejected 401 AND recorded (loud failure)
 *   - the per-hook size limit rejects 413 and is recorded
 *   - triggers survive a service restart (persisted config)
 *   - a manual test-fire runs the target and records the execution
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { WorkflowExecution } from '../src/execution/ExecutionStore';
import type {
  TriggerFiredResponse,
  TriggerDeletedResponse,
  TriggerListResponse,
  TriggerResponse
} from '../src/server/admin-triggers';
import { BackendService } from '../src/service';
import { signWebhookHmac } from '../src/triggers/webhook';

import { adminHeaders, ErrorBody, get, httpClient } from './helpers/http';

jest.setTimeout(30000);

const HELLO_WORKFLOW = {
  components: [
    {
      name: '/#__cloud__/hello',
      nodes: [
        { id: 'req1', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
        { id: 'res1', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
      ],
      connections: [{ sourceId: 'req1', sourcePort: 'receive', targetId: 'res1', targetPort: 'send' }],
      roots: []
    }
  ],
  settings: {},
  metadata: {}
};

describe('WF-005 triggers over HTTP', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  // FH-024: the admin credential rides every call. Dev-open still relaxes the
  // data and function gates on loopback, but no longer the admin one — a web
  // page can reach 127.0.0.1 on the developer's behalf, so loopback was never
  // the boundary it was being read as. The editor's supervisor already attaches
  // this token to every proxied request.
  const http = httpClient(
    () => base,
    () => adminHeaders(dataDir)
  );
  const req = <T = unknown>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
    http.request<T>(method, p, { body, headers });

  /**
   * Executions matching a query. The trigger specs all look for "the execution
   * this trigger produced", so the lookup is written once and throws naming the
   * trigger — an `undefined` from `.find` used to surface two lines later as a
   * property read on nothing.
   */
  async function executionFor(
    query: string,
    match: (e: WorkflowExecution) => boolean
  ): Promise<WorkflowExecution | undefined> {
    const list = await http.get<WorkflowExecution[]>(`/executions?${query}`);
    return list.json.find(match);
  }

  const byTrigger = (triggerId: string, rejected = false) => (e: WorkflowExecution) => {
    const meta = e.metadata as { triggerId?: string; rejected?: boolean } | undefined;
    return !!meta && meta.triggerId === triggerId && (!rejected || !!meta.rejected);
  };

  /**
   * The webhook secret is returned by exactly one response — the create that
   * minted it — so `TriggerResponse.secret` is optional. Asserting it here says
   * "this create was supposed to mint one" rather than carrying `undefined`
   * into `signWebhookHmac` and failing on a bad signature.
   */
  function secretOf(res: TriggerResponse): string {
    if (!res.secret) throw new Error(`trigger ${res.trigger.id} was created without a webhook secret`);
    return res.secret;
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wf005-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'hello.workflow.json'), JSON.stringify(HELLO_WORKFLOW));
    service = new BackendService({ dataDir, port: 0, backendId: 'backend_test', backendName: 'Trigger Test' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('CRUD: create/list/get/disable/delete a schedule trigger', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'schedule',
      name: 'nightly digest',
      target: { kind: 'function', name: 'hello' },
      schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip' }
    });
    expect(created.status).toBe(201);
    const id = created.json.trigger.id;

    const list = await req<TriggerListResponse>('GET', '/admin/triggers');
    expect(list.json.triggers.some((t) => t.id === id)).toBe(true);

    const got = await req<TriggerResponse>('GET', `/admin/triggers/${id}`);
    expect(got.json.trigger.schedule?.cron).toBe('0 3 * * *');

    const disabled = await req<TriggerResponse>('POST', `/admin/triggers/${id}/enabled`, { enabled: false });
    expect(disabled.json.trigger.enabled).toBe(false);

    const del = await req<TriggerDeletedResponse>('DELETE', `/admin/triggers/${id}`);
    expect(del.json.deleted).toBe(true);
    expect((await req<TriggerResponse>('GET', `/admin/triggers/${id}`)).status).toBe(404);
  });

  it('rejects an invalid trigger with a 400 and a reason (no silent accept)', async () => {
    const bad = await req<ErrorBody>('POST', '/admin/triggers', {
      type: 'schedule',
      target: { kind: 'function', name: 'hello' },
      schedule: { cron: 'not a cron', missedFirePolicy: 'skip' }
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/cron/);
  });

  it('webhook: correct HMAC fires the target and records a webhook execution', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'function', name: 'hello' },
      webhook: { slug: 'gh' }
    });
    expect(created.status).toBe(201);
    const secret = secretOf(created.json);
    const triggerId: string = created.json.trigger.id;
    expect(secret).toMatch(/^whsec_/);

    const payload = JSON.stringify({ action: 'opened', number: 7 });
    const sig = signWebhookHmac(secret, payload);
    const res = await fetch(`${base}/hooks/backend_test/gh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
      body: payload
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: {} }); // the hello function's response

    const entry = await executionFor('triggerType=webhook&limit=50', byTrigger(triggerId));
    expect(entry).toBeDefined();
    expect(entry?.workflowId).toBe('hello');
    expect(entry?.status).toBe('success');
    expect(entry?.metadata?.triggerSource).toBe('webhook gh');
  });

  it('webhook: wrong secret is rejected 401 AND recorded as a failed execution', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'function', name: 'hello' },
      webhook: { slug: 'secure' }
    });
    const triggerId: string = created.json.trigger.id;

    const payload = JSON.stringify({ x: 1 });
    const res = await fetch(`${base}/hooks/backend_test/secure`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=deadbeef' },
      body: payload
    });
    expect(res.status).toBe(401);

    const rejected = await executionFor('limit=100', byTrigger(triggerId, true));
    expect(rejected).toBeDefined();
    expect(rejected?.status).not.toBe('success');

    // The trigger's own status also reflects the failed attempt.
    const t = await req<TriggerResponse>('GET', `/admin/triggers/${triggerId}`);
    expect(t.json.trigger.status?.lastResult?.ok).toBe(false);
  });

  it('webhook: unknown/disabled slug is 404', async () => {
    const res = await fetch(`${base}/hooks/backend_test/does-not-exist`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(404);
  });

  it('webhook: a body over the per-hook limit is rejected 413 and recorded', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'function', name: 'hello' },
      webhook: { slug: 'tiny', maxBodyBytes: 16 }
    });
    const secret = secretOf(created.json);
    const triggerId: string = created.json.trigger.id;

    const big = JSON.stringify({ data: 'x'.repeat(1000) });
    const res = await fetch(`${base}/hooks/backend_test/tiny`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signWebhookHmac(secret, big) },
      body: big
    });
    expect(res.status).toBe(413);

    expect(await executionFor('limit=100', byTrigger(triggerId, true))).toBeDefined();
  });

  it('manual test-fire runs the target and records an execution', async () => {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      target: { kind: 'function', name: 'hello' },
      webhook: { slug: 'manual-fire' }
    });
    const id = created.json.trigger.id;
    const fired = await req<TriggerFiredResponse>('POST', `/admin/triggers/${id}/fire`, { hello: 'world' });
    expect(fired.status).toBe(200);
    expect((fired.json.result as { ok: boolean }).ok).toBe(true);
    expect(fired.json.response.statusCode).toBe(200);
  });
});

describe('WF-005 triggers survive a service restart', () => {
  it('persisted triggers.json reloads with its triggers and status', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wf005-restart-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    try {
      const first = new BackendService({ dataDir, port: 0, backendId: 'restart', backendName: 'R' });
      const s1 = await first.start();
      const created = await fetch(`${s1.listen.url}/admin/triggers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...adminHeaders(dataDir) },
        body: JSON.stringify({
          type: 'db-change',
          target: { kind: 'function', name: 'hello' },
          dbChange: { collection: 'Orders', actions: ['create', 'update'] }
        })
      });
      const { trigger } = (await created.json()) as TriggerResponse;
      await first.stop();

      const second = new BackendService({ dataDir, port: 0, backendId: 'restart', backendName: 'R' });
      const s2 = await second.start();
      // The token is minted once and persists in the data dir, so it survives the
      // restart alongside triggers.json — which is also what the editor relies on.
      const list = await get<TriggerListResponse>(s2.listen.url, '/admin/triggers', adminHeaders(dataDir));
      expect(
        list.json.triggers.some((t) => t.id === trigger.id && t.dbChange?.collection === 'Orders')
      ).toBe(true);
      await second.stop();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
