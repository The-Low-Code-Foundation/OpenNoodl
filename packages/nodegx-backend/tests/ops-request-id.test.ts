/**
 * BAK-009 request correlation, end to end over a real socket.
 *
 * The spec's criterion is a traceability CHAIN, not a header: access log →
 * execution record → response header must all carry the same id for one
 * request. Asserting only that a header comes back would pass on a service
 * where the id never reaches anything that matters, so this drives a real
 * function call and reads the id back out of the execution record it wrote.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { Logger, logger } from '../src/ops/logger';

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

describe('BAK-009 request ids', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;
  /** Lines the process-wide logger produced during a test. */
  let lines: Record<string, unknown>[];

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-ops-reqid-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'hello.workflow.json'), JSON.stringify(HELLO_WORKFLOW));

    service = new BackendService({ dataDir, port: 0, backendId: 'backend_ops', backendName: 'Ops Test' });
    const started = await service.start();
    base = started.listen.url;
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    // Capture what the service logs. The setup file silences the singleton via
    // NODEGX_LOG_LEVEL; `configure` here re-opens it into our capture buffer.
    lines = [];
    Object.assign(logger, new Logger({ level: 'debug', format: 'json', write: (l) => lines.push(JSON.parse(l)) }));
  });

  afterAll(async () => {
    if (service) await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  function requestLines(): Record<string, unknown>[] {
    return lines.filter((l) => l.event === 'request');
  }

  it('mints an id, echoes it in the header, and logs exactly one line for the request', async () => {
    lines.length = 0;
    const res = await fetch(`${base}/health`);
    const id = res.headers.get('x-request-id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const logged = requestLines();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      requestId: id,
      method: 'GET',
      route: 'health',
      path: '/health',
      status: 200,
      principal: 'anonymous'
    });
    expect(typeof logged[0].durationMs).toBe('number');
  });

  it('honours a caller-supplied id, and refuses an unsafe one', async () => {
    const ok = await fetch(`${base}/health`, { headers: { 'x-request-id': 'ci-run-42' } });
    expect(ok.headers.get('x-request-id')).toBe('ci-run-42');

    // A header with a newline would let a client forge log lines.
    const forged = await fetch(`${base}/health`, { headers: { 'x-request-id': 'a'.repeat(200) } });
    expect(forged.headers.get('x-request-id')).not.toBe('a'.repeat(200));
    expect(forged.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('puts the id in the error body, so a screenshot is enough to find the request', async () => {
    const res = await fetch(`${base}/api/does-not-exist/nope/nope`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.requestId).toBe(res.headers.get('x-request-id'));
  });

  it('logs unmatched requests too — a 404 has no route but still gets a line', async () => {
    lines.length = 0;
    const res = await fetch(`${base}/nope/nothing`);
    expect(res.status).toBe(404);
    const logged = requestLines();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ route: null, path: '/nope/nothing', status: 404, level: 'warn' });
  });

  it('names the principal kind and never the credential', async () => {
    lines.length = 0;
    await fetch(`${base}/admin/status`, { headers: { authorization: `Bearer ${adminToken}` } });
    const logged = requestLines();
    expect(logged[0].principal).toBe('admin');
    expect(JSON.stringify(logged)).not.toContain(adminToken);
  });

  it('traces a function call from the access log into the execution record', async () => {
    lines.length = 0;
    const res = await fetch(`${base}/functions/hello`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    const id = res.headers.get('x-request-id');
    expect(id).toBeTruthy();

    // 1. the access log carries it
    const logged = requestLines().find((l) => l.route === 'functions/:name');
    expect(logged).toBeTruthy();
    expect(logged!.requestId).toBe(id);

    // 2. so does the execution the call produced
    const list = await fetch(`${base}/executions`, { headers: { authorization: `Bearer ${adminToken}` } });
    const listed = await list.json();
    const executions = (Array.isArray(listed) ? listed : listed.executions || listed.results) as {
      metadata?: Record<string, unknown>;
    }[];
    const match = executions.find((e) => e.metadata && e.metadata.requestId === id);
    expect(match).toBeTruthy();
  });
});
