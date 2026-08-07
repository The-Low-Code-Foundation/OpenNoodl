/**
 * CWF-018 — a cloud function that never answers must not hold the connection.
 *
 * Driven over real HTTP against a real service, because the defect is not
 * visible from any unit: `CloudRunner.run` settled only when a Response node
 * fired, `POST /functions/:name` awaited that with no bound, and the socket was
 * held until the client gave up. Nothing threw, nothing logged, and the
 * component instance plus its model scope stayed alive for the life of the
 * process.
 *
 * Three fixtures, because there are three ways to reach the same silence:
 *
 *   - `hangs` — the ordinary authoring mistake. Every outcome-contract node has
 *     `Failure` and `Unchanged` beside `Done`, and a path that ends without a
 *     Response node is what wiring only the happy path produces. Here the
 *     Response node exists and nothing reaches it.
 *   - `unknown-node` — the SECOND confirmed instance, and the same mechanism:
 *     an unregistered node type is logged and skipped by `NodeScope`
 *     (`createNodeFromModel` catches), its connections are then dropped by
 *     `addConnection` (which also catches), and the graph runs with its chain
 *     cut. Nothing errors; the request simply never gets an answer.
 *   - `answers` — the control. A normal function must be untouched.
 *
 * The teardown half is asserted, not eyeballed: the runtime's component-instance
 * factory is instrumented, and N abandoned runs must leave N deleted instances.
 * That is the half the doc predicted would be forgotten, and it is the half that
 * turns a slow endpoint into an outage.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { logger } from '../src/ops/logger';
import { BackendService } from '../src/service';
import { DEFAULT_FUNCTION_TIMEOUT_MS } from '../src/workflow/WorkflowRunner';

import { httpClient } from './helpers/http';

// Every case here is bounded by a timeout the spec itself configures (400ms),
// so this suite must never approach jest's own limit — that it does not is the
// point of the whole task.
jest.setTimeout(20000);

/** The Response node is present and simply unreachable — the everyday mistake. */
const hangs = {
  name: '/#__cloud__/hangs',
  nodes: [
    {
      id: 'req-h',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true },
      ports: [],
      children: []
    },
    { id: 'res-h', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
  ],
  connections: [],
  roots: []
};

/** Wired correctly — through a node type this runtime has never heard of. */
const unknownNode = {
  name: '/#__cloud__/unknown-node',
  nodes: [
    {
      id: 'req-u',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true },
      ports: [],
      children: []
    },
    { id: 'ghost', type: 'NotARegisteredNodeType', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    { id: 'res-u', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] }
  ],
  connections: [
    { sourceId: 'req-u', sourcePort: 'receive', targetId: 'ghost', targetPort: 'run' },
    { sourceId: 'ghost', sourcePort: 'done', targetId: 'res-u', targetPort: 'send' }
  ],
  roots: []
};

/** The control: request in, response out. */
const answers = {
  name: '/#__cloud__/answers',
  nodes: [
    {
      id: 'req-a',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true },
      ports: [],
      children: []
    },
    {
      id: 'res-a',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'ok', 'pm-ok': 'yes' },
      ports: [],
      children: []
    }
  ],
  connections: [{ sourceId: 'req-a', sourcePort: 'receive', targetId: 'res-a', targetPort: 'send' }],
  roots: []
};

/** Declared per function, exactly where CWF-017's panel writes its rules. */
const SECURITY = {
  version: 1,
  devOpen: true,
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
    hangs: { timeoutMs: 400 },
    'unknown-node': { timeoutMs: 400 }
  },
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

interface TimeoutBody {
  error?: string;
  code?: string;
  function?: string;
  timeoutMs?: number;
  result?: Record<string, unknown>;
}

interface FunctionRow {
  name: string;
  timeoutMs: number | null;
}

interface FunctionsBody {
  functions: FunctionRow[];
  defaultTimeoutMs: number;
}

interface ExecutionRow {
  id: string;
  workflowId: string;
  status: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/** The runtime seam this spec instruments to count instances (see teardown case). */
interface InstrumentedService {
  runner: {
    cloudRunner: {
      runtime: {
        context: {
          createComponentInstanceNode(
            componentName: string,
            id: string,
            nodeScope: unknown,
            extraProps?: unknown
          ): Promise<{ _onNodeDeleted(): void }>;
        };
      };
    };
  };
}

describe('CWF-018 a cloud function that never responds', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;
  const created: string[] = [];
  const deleted: string[] = [];
  const logLines: string[] = [];

  const client = httpClient(() => base);
  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf018-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(SECURITY));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'main.workflow.json'),
      JSON.stringify({ components: [hangs, unknownNode, answers], settings: {}, metadata: {} })
    );

    service = new BackendService({ dataDir, port: 0, backendId: 'cwf018', backendName: 'CWF-018' });
    base = (await service.start()).listen.url;
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;

    // The teardown seam. Every per-request component instance is created here
    // and must be deleted by the run that created it — including a run nobody
    // ever answered.
    const context = (service as unknown as InstrumentedService).runner.cloudRunner.runtime.context;
    const original = context.createComponentInstanceNode.bind(context);
    context.createComponentInstanceNode = async (name, id, scope, extra) => {
      const node = await original(name, id, scope, extra);
      created.push(id);
      const originalDelete = node._onNodeDeleted.bind(node);
      // `Node.prototype` is built with `Object.create` descriptors, so its
      // methods are read-only — a plain assignment throws.
      Object.defineProperty(node, '_onNodeDeleted', {
        configurable: true,
        value: () => {
          deleted.push(id);
          return originalDelete();
        }
      });
      return node;
    };

    // The suite runs with the process logger silenced (setup-logging.js). The
    // operator-facing line is part of the fix, so this file un-silences errors
    // and captures what is written.
    delete process.env.NODEGX_LOG_LEVEL;
    logger.configure({ level: 'error', format: 'json' });
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      logLines.push(String(chunk));
      return true;
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    process.env.NODEGX_LOG_LEVEL = 'silent';
    logger.configure({ level: 'silent' });
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('answers 504 naming the function instead of holding the connection', async () => {
    const started = Date.now();
    const res = await client.request<TimeoutBody>('POST', '/functions/hangs', { body: {} });
    const elapsed = Date.now() - started;

    expect(res.status).toBe(504);
    expect(res.json.code).toBe('function/timeout');
    expect(res.json.function).toBe('hangs');
    expect(res.json.timeoutMs).toBe(400);
    expect(res.json.error).toContain('hangs');
    expect(res.json.error).toContain('Response node');
    // It answered because it timed out, not because something else was slow.
    expect(elapsed).toBeGreaterThanOrEqual(350);
    expect(elapsed).toBeLessThan(5000);
  });

  it('a function whose graph runs through an unregistered node type times out the same way', async () => {
    // The runtime drops the unknown node and its wires and carries on, so the
    // Response node is simply never reached — one mechanism, two causes.
    const res = await client.request<TimeoutBody>('POST', '/functions/unknown-node', { body: {} });
    expect(res.status).toBe(504);
    expect(res.json.function).toBe('unknown-node');
  });

  it('a normal function is unaffected', async () => {
    const res = await client.request<TimeoutBody>('POST', '/functions/answers', { body: {} });
    expect(res.status).toBe(200);
    expect(res.json.result).toEqual({ ok: 'yes' });
  });

  it('logs the timeout where an operator can reach it, and never the request body', async () => {
    logLines.length = 0;
    await client.request('POST', '/functions/hangs', { body: { customerCard: '4111111111111111' } });

    const line = logLines.map((l) => l.trim()).find((l) => l.includes('"event":"function.timeout"'));
    expect(line).toBeDefined();
    const record = JSON.parse(String(line)) as Record<string, unknown>;
    expect(record.level).toBe('error');
    expect(record.function).toBe('hangs');
    expect(record.timeoutMs).toBe(400);
    expect(record.requestId).toEqual(expect.any(String));
    // `redact()` is KEY-based, so a secret under an innocent name would survive
    // it. The request body is therefore not logged at all.
    expect(logLines.join('\n')).not.toContain('4111111111111111');
  });

  it('records the run as timed out rather than leaving it open', async () => {
    const res = await client.request<ExecutionRow[]>('GET', '/executions?workflowId=hangs', {
      headers: asAdmin()
    });
    expect(res.status).toBe(200);
    const rows = res.json;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.status).toBe('error');
      expect(row.metadata && row.metadata.timedOut).toBe(true);
      expect(row.metadata && row.metadata.timeoutMs).toBe(400);
    }
  });

  it('tears every abandoned run down — no component instance is left behind', async () => {
    created.length = 0;
    deleted.length = 0;

    for (let i = 0; i < 3; i++) {
      const res = await client.request('POST', '/functions/hangs', { body: {} });
      expect(res.status).toBe(504);
    }

    expect(created.length).toBe(3);
    expect(deleted.sort()).toEqual(created.sort());
  });

  it('exposes and accepts the limit on CWF-017’s own surface, live', async () => {
    const before = await client.request<FunctionsBody>('GET', '/admin/permissions/functions', {
      headers: asAdmin()
    });
    expect(before.status).toBe(200);
    const rowsBefore = Object.fromEntries(before.json.functions.map((f) => [f.name, f]));
    expect(before.json.defaultTimeoutMs).toBe(DEFAULT_FUNCTION_TIMEOUT_MS);
    expect(rowsBefore.hangs.timeoutMs).toBe(400);
    // Undeclared reads as null — the panel shows the default beside it.
    expect(rowsBefore.answers.timeoutMs).toBeNull();

    // Writing one takes effect on the NEXT call, with no restart.
    const put = await client.request('PUT', '/admin/permissions/functions/hangs', {
      body: { timeoutMs: 150 },
      headers: asAdmin()
    });
    expect(put.status).toBe(200);

    const started = Date.now();
    const res = await client.request<TimeoutBody>('POST', '/functions/hangs', { body: {} });
    expect(res.status).toBe(504);
    expect(res.json.timeoutMs).toBe(150);
    expect(Date.now() - started).toBeLessThan(2000);

    const bad = await client.request<{ error?: string }>('PUT', '/admin/permissions/functions/hangs', {
      body: { timeoutMs: -1 },
      headers: asAdmin()
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toContain('timeoutMs');
  });
});
