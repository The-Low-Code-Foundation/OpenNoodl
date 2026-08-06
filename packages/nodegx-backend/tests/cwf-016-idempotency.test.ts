/**
 * CWF-016 slice 3 — the same webhook, delivered twice, over real HTTP.
 *
 * The store's own race is pinned in `idempotency-store.test.ts`. This file
 * drives the promise a caller actually makes, against a real service with real
 * graphs, and every "ran once" here is measured by the EXECUTION HISTORY — the
 * durable record the backend writes per invocation — rather than by a counter
 * the spec keeps. A replayed delivery writes no execution record, because it
 * never reaches `runner.run`, which is the entire point of doing this at the
 * endpoint instead of in a node.
 *
 * The concurrency case is genuinely concurrent: `charge` sleeps 300ms inside a
 * JavaScript node, and the duplicate deliveries are fired with no `await`
 * between them, so the second is in the dispatcher while the first is still in
 * the graph. Two awaited calls would prove nothing.
 *
 * ⚠️ The one thing this cannot cover, and it is documented rather than worked
 * around: a workflow's `call-function` step never reaches this endpoint. It runs
 * in process through `WorkflowRunner.invokeFunction` with `headers: {}`, so a
 * CWF-005 retry is a genuine duplicate invocation that no endpoint feature can
 * see. Teaching the step to send a key would turn a DELIBERATE retry into a
 * silent no-op, which is worse. The last test in this file pins the mechanism so
 * the limit stays a fact rather than a memory.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(60000);

/**
 * One graph shape under many names: Request → JavaScript (sleep, mint a unique
 * token) → Response.
 *
 * The token is unique per invocation on purpose. "Both bodies are identical" is
 * a weak claim when the graph is deterministic — it would hold even if the graph
 * ran twice. With a random token, identical bodies can only mean the second
 * caller received the FIRST caller's bytes.
 */
function makeFunction(name: string, delayMs: number, status?: 'failure') {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: `${name}-req`,
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true },
        ports: [],
        children: []
      },
      {
        id: `${name}-js`,
        type: 'JavaScriptFunction',
        x: 0,
        y: 100,
        parameters: {
          functionScript:
            `await new Promise((r) => setTimeout(r, ${delayMs}));\n` +
            `Outputs.token = 'tok-' + Math.random().toString(36).slice(2) + '-' + Date.now();`
        },
        ports: [],
        children: []
      },
      {
        id: `${name}-res`,
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: status === 'failure' ? { status: 'failure', errorMessage: 'deliberate' } : { params: 'token' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: `${name}-req`, sourcePort: 'receive', targetId: `${name}-js`, targetPort: 'run' },
      { sourceId: `${name}-js`, sourcePort: 'out-token', targetId: `${name}-res`, targetPort: 'pm-token' },
      { sourceId: `${name}-js`, sourcePort: 'success', targetId: `${name}-res`, targetPort: 'send' }
    ],
    roots: []
  };
}

const SECURITY = {
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
  functions: {
    charge: { call: 'public', idempotency: { enabled: true } },
    quick: { call: 'public', idempotency: { enabled: true } },
    strict: { call: 'public', idempotency: { enabled: true, requireKey: true } },
    bodykeyed: { call: 'public', idempotency: { enabled: true, hashBody: true } },
    failing: { call: 'public', idempotency: { enabled: true } },
    unprotected: { call: 'public' }
  },
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

const WORKFLOW = {
  components: [
    makeFunction('charge', 300),
    makeFunction('quick', 0),
    makeFunction('strict', 0),
    makeFunction('bodykeyed', 0),
    makeFunction('failing', 0, 'failure'),
    makeFunction('unprotected', 0)
  ],
  settings: {},
  metadata: {}
};

interface ChargeBody {
  result?: { token?: string };
  error?: string;
}

type ExecutionsBody = { id: string; workflowId: string; status: string }[];

describe('CWF-016 idempotency at the function endpoint', () => {
  let dataDir: string;
  let service: BackendService;
  let base = '';
  let adminHeader: Record<string, string>;

  const client = httpClient(() => base);

  async function boot(): Promise<void> {
    service = new BackendService({ dataDir, port: 0, backendId: 'cwf016', backendName: 'CWF-016' });
    base = (await service.start()).listen.url;
    const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    adminHeader = { authorization: `Bearer ${secrets.adminToken}` };
  }

  /** How many times the graph behind `name` actually ran. */
  async function runsOf(name: string): Promise<number> {
    const res = await client.get<ExecutionsBody>(`/executions?workflowId=${name}&limit=200`, adminHeader);
    expect(res.status).toBe(200);
    return res.json.length;
  }

  const deliver = (fn: string, key: string | null, body: unknown = { amount: 10 }) =>
    client.post<ChargeBody>(`/functions/${fn}`, body, key === null ? {} : { 'idempotency-key': key });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf016-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(SECURITY));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'main.workflow.json'), JSON.stringify(WORKFLOW));
    await boot();
  });

  afterAll(async () => {
    if (service) await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // The fixture itself — if this fails, nothing below means anything
  // ==========================================================================

  it('the fixture graph answers with a token that differs per run', async () => {
    const a = await deliver('unprotected', null);
    const b = await deliver('unprotected', null);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(typeof a.json.result?.token).toBe('string');
    expect(a.json.result?.token).not.toBe(b.json.result?.token);
    expect(await runsOf('unprotected')).toBe(2);
  });

  // ==========================================================================
  // Done when — the four bullets
  // ==========================================================================

  it('the same key twice, sequentially, runs the graph once and returns the identical body', async () => {
    const first = await deliver('quick', 'evt_seq');
    const second = await deliver('quick', 'evt_seq');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.text).toBe(first.text);
    expect(await runsOf('quick')).toBe(1);

    // And it says which is which, so "did my retry get deduped?" is answerable
    // from outside.
    expect(first.headers.get('idempotency-status')).toBe('stored');
    expect(second.headers.get('idempotency-status')).toBe('replayed');
  });

  it('the same key twice CONCURRENTLY still runs the graph once — no await between the deliveries', async () => {
    // `charge` sleeps 300ms in its graph, so the duplicates below are genuinely
    // in flight together: the second reaches the dispatcher while the first is
    // still inside `runner.run`. This is the case a check-then-run
    // implementation fails and every sequential test passes.
    const inFlight = [
      deliver('charge', 'evt_race'),
      deliver('charge', 'evt_race'),
      deliver('charge', 'evt_race'),
      deliver('charge', 'evt_race')
    ];
    const results = await Promise.all(inFlight);

    for (const r of results) expect(r.status).toBe(200);
    expect(new Set(results.map((r) => r.text)).size).toBe(1);
    expect(await runsOf('charge')).toBe(1);

    // Exactly one of the four ran the graph; the rest replayed its answer.
    const statuses = results.map((r) => r.headers.get('idempotency-status'));
    expect(statuses.filter((s) => s === 'stored')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'replayed')).toHaveLength(3);
  });

  it('a different key runs the graph again', async () => {
    const before = await runsOf('quick');
    const other = await deliver('quick', 'evt_seq_2');
    expect(other.status).toBe(200);
    expect(await runsOf('quick')).toBe(before + 1);
  });

  it('keys are scoped per function: the same key on another function is another run', async () => {
    const res = await deliver('bodykeyed', 'evt_seq', { amount: 10 });
    expect(res.status).toBe(200);
    expect(res.headers.get('idempotency-status')).toBe('stored');
    expect(await runsOf('bodykeyed')).toBe(1);
  });

  // ==========================================================================
  // ⚠️ A 500 must not be cached
  // ==========================================================================

  it('a non-2xx answer does NOT claim the key — the same delivery runs again', async () => {
    const first = await deliver('failing', 'evt_fail');
    expect(first.status).toBe(400);
    expect(first.headers.get('idempotency-status')).toBe('not-stored');

    const second = await deliver('failing', 'evt_fail');
    expect(second.status).toBe(400);
    expect(second.headers.get('idempotency-status')).toBe('not-stored');

    // Twice, because replaying a failure for 24 hours is worse than running
    // twice — and the caller retrying is what fixes a transient failure.
    expect(await runsOf('failing')).toBe(2);
  });

  // ==========================================================================
  // The two opt-ins
  // ==========================================================================

  it('an unkeyed call runs unprotected and SAYS SO rather than implying it was deduped', async () => {
    const res = await deliver('quick', null);
    expect(res.status).toBe(200);
    expect(res.headers.get('idempotency-status')).toBe('unkeyed');
  });

  it('requireKey refuses an unkeyed call by name instead of running it', async () => {
    const before = await runsOf('strict');
    const res = await deliver('strict', null);
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toContain('Idempotency-Key');
    expect(await runsOf('strict')).toBe(before);

    // With a key it works normally.
    const ok = await deliver('strict', 'evt_strict');
    expect(ok.status).toBe(200);
    expect((await deliver('strict', 'evt_strict')).text).toBe(ok.text);
    expect(await runsOf('strict')).toBe(before + 1);
  });

  it('hashBody makes the same key with a different body a different request', async () => {
    const before = await runsOf('bodykeyed');
    const a = await deliver('bodykeyed', 'evt_body', { amount: 1 });
    const aAgain = await deliver('bodykeyed', 'evt_body', { amount: 1 });
    expect(aAgain.text).toBe(a.text);
    expect(await runsOf('bodykeyed')).toBe(before + 1);

    const b = await deliver('bodykeyed', 'evt_body', { amount: 2 });
    expect(b.text).not.toBe(a.text);
    expect(await runsOf('bodykeyed')).toBe(before + 2);
  });

  it('without hashBody a changed body under the same key still replays — the provider-retry case', async () => {
    // `quick` has hashBody off, which is the default and the reason for it: a
    // provider retry whose payload carries a fresh timestamp must not look like
    // a new request.
    const before = await runsOf('quick');
    const first = await deliver('quick', 'evt_ts', { amount: 5, sentAt: 1 });
    const retry = await deliver('quick', 'evt_ts', { amount: 5, sentAt: 2 });
    expect(retry.text).toBe(first.text);
    expect(await runsOf('quick')).toBe(before + 1);
  });

  it('a key longer than the limit is refused rather than stored', async () => {
    const res = await deliver('quick', 'x'.repeat(256));
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toContain('255');
  });

  it('a function with no idempotency entry ignores the header entirely', async () => {
    const before = await runsOf('unprotected');
    const a = await deliver('unprotected', 'evt_ignored');
    const b = await deliver('unprotected', 'evt_ignored');
    expect(a.text).not.toBe(b.text);
    expect(a.headers.get('idempotency-status')).toBeNull();
    expect(await runsOf('unprotected')).toBe(before + 2);
  });

  // ==========================================================================
  // The admin surface CWF-017's panel reads
  // ==========================================================================

  it('the admin surface round-trips the setting and reports the service TTL', async () => {
    interface FunctionsBody {
      functions: { name: string; idempotency: { enabled: boolean; requireKey?: boolean } | null }[];
      idempotency: { available: boolean; ttlHours: number };
    }

    const put = await client.put(
      '/admin/permissions/functions/quick',
      { idempotency: { enabled: true, requireKey: true } },
      adminHeader
    );
    expect(put.status).toBe(200);

    const list = await client.get<FunctionsBody>('/admin/permissions/functions', adminHeader);
    expect(list.status).toBe(200);
    expect(list.json.idempotency.available).toBe(true);
    expect(list.json.idempotency.ttlHours).toBe(24);
    const row = list.json.functions.find((f) => f.name === 'quick');
    expect(row?.idempotency).toEqual({ enabled: true, requireKey: true });

    // Asserted against the file on disk too, the way CWF-017's suite does: a
    // panel write that only lived in memory would pass every HTTP assertion.
    const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'security.json'), 'utf-8'));
    expect(onDisk.functions.quick.idempotency).toEqual({ enabled: true, requireKey: true });

    // `null` clears the field, which is the panel's "back to the default".
    const cleared = await client.put('/admin/permissions/functions/quick', { idempotency: null }, adminHeader);
    expect(cleared.status).toBe(200);
    const after = JSON.parse(fs.readFileSync(path.join(dataDir, 'security.json'), 'utf-8'));
    expect(after.functions.quick.idempotency).toBeUndefined();

    // Put it back — later tests in this file assume the fixture posture.
    await client.put('/admin/permissions/functions/quick', { idempotency: { enabled: true } }, adminHeader);
  });

  it('a contradictory setting is refused at the door, not stored and quietly ignored', async () => {
    const res = await client.put(
      '/admin/permissions/functions/quick',
      { idempotency: { enabled: false, requireKey: true } },
      adminHeader
    );
    expect(res.status).toBe(400);
    expect(String((res.json as { error?: string }).error)).toContain('requireKey');

    const unknown = await client.put(
      '/admin/permissions/functions/quick',
      { idempotency: { enabled: true, dedupe: true } },
      adminHeader
    );
    expect(unknown.status).toBe(400);
  });

  // ==========================================================================
  // ⚠️ The documented hole: a workflow step bypasses all of this
  // ==========================================================================

  it('a call-function step reaches the graph WITHOUT going through the endpoint, so no key can apply', async () => {
    // `invokeFunction` is the in-process path a `call-function` step takes. It
    // writes no execution record of its own (the engine writes the step's), and
    // more to the point it never touches `runFunction`, so `Idempotency-Key` has
    // nowhere to arrive from. Two invocations here are two graph runs, by
    // construction — that is CWF-016's known limit, pinned.
    const runner = (service as unknown as { runner: { invokeFunction(n: string, r: unknown): Promise<{ statusCode: number; body: string }> } }).runner;

    const one = await runner.invokeFunction('quick', { body: '{}', headers: {} });
    const two = await runner.invokeFunction('quick', { body: '{}', headers: {} });
    expect(one.statusCode).toBe(200);
    expect(two.statusCode).toBe(200);
    // Different tokens: the graph ran twice, and nothing could have stopped it.
    expect(one.body).not.toBe(two.body);
  });

  // ==========================================================================
  // Survives a restart — the bullet that forces sqlite. LAST, it rebinds `base`.
  // ==========================================================================

  it('survives a backend restart between the two deliveries', async () => {
    const first = await deliver('charge', 'evt_restart');
    expect(first.status).toBe(200);
    const runsBefore = await runsOf('charge');

    await service.stop();
    await boot();

    const second = await deliver('charge', 'evt_restart');
    expect(second.status).toBe(200);
    expect(second.text).toBe(first.text);
    expect(second.headers.get('idempotency-status')).toBe('replayed');
    // The restart's own claim recovery must not have eaten a COMPLETED key.
    expect(await runsOf('charge')).toBe(runsBefore);
  });
});
