/**
 * A cloud function can log, and you can find the log (CWF-013).
 *
 * The node is the easy half. The question this suite exists to answer is **where the line comes
 * out**, and the task named three existing answers: the structured logger (redacted, request id,
 * queryable), the execution record, and a bare `console.log` that has none of that. An author
 * could reach only the third. This drives the first two.
 *
 * What it holds:
 *
 *  1. A `Log` node in a real cloud function writes a `function.log` line to the structured logger,
 *     at the level the author chose, carrying **the run's request id** — the same id in the access
 *     log and in the execution record, which is what makes the three joinable.
 *  2. A **copy lands in the execution record** as a step, so the History panel has it.
 *  3. ⚠️ **A logged secret comes out redacted, tested with a planted value.** Two different
 *     mechanisms, and the interesting one is the second:
 *       - `Data` is **key**-redacted by the service's one `redact()` door — `{ apiKey: … }`.
 *       - `Message` is **value**-redacted, because key-based redaction cannot touch free text and
 *         `ops/redact.ts` says so about itself: *"a secret stored under an innocent name is not
 *         caught"*. A `Log` node's message is the first arbitrary author text in the product to
 *         reach a log line, and `Secret → Log` is a two-node graph.
 *
 * ⚠️ The suite turns the process logger back up (`setup-logging.js` silences it for every other
 * spec) and captures `process.stdout.write`. Asserting on the real singleton rather than a
 * hand-built `Logger` is the point: a test that constructs its own logger proves the formatter
 * works and proves nothing about whether the node reaches it.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { MIN_SCRUBBABLE_LENGTH, SecretValueScrubber } from '../src/ops/log-scrub';
import { logger } from '../src/ops/logger';
import { SecretsStore, FUNCTION_SECRETS_NAMESPACE } from '../src/config/SecretsStore';
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Planted. It must never appear in a log line or an execution record. */
const STORED_SECRET = 'sk_live_logged_by_mistake_9f4c2b';

/** Request → Secret → Log(message = the secret) → Response. The leak, as a graph. */
const logSecretFunction = {
  name: '/#__cloud__/logSecret',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'note' },
      ports: [],
      children: []
    },
    { id: 'sec', type: 'noodl.cloud.secret', x: 0, y: 100, parameters: { name: 'STRIPE_KEY' }, ports: [], children: [] },
    { id: 'log', type: 'net.noodl.Log', x: 0, y: 200, parameters: { level: 'warn' }, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'ok' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    // The planted value, straight into free text. Nothing here is named "apiKey".
    { sourceId: 'sec', sourcePort: 'value', targetId: 'log', targetPort: 'message' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'log', targetPort: 'log' },
    { sourceId: 'req', sourcePort: 'pm-note', targetId: 'res', targetPort: 'pm-ok' },
    { sourceId: 'log', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/** Request → Log(message + data from the body) → Response. The ordinary use. */
const plainLogFunction = {
  name: '/#__cloud__/plainLog',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'message,payload' },
      ports: [],
      children: []
    },
    { id: 'log', type: 'net.noodl.Log', x: 0, y: 100, parameters: { level: 'error' }, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'ok' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-message', targetId: 'log', targetPort: 'message' },
    { sourceId: 'req', sourcePort: 'pm-payload', targetId: 'log', targetPort: 'data' },
    { sourceId: 'req', sourcePort: 'pm-message', targetId: 'log', targetPort: 'value' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'log', targetPort: 'log' },
    // The pass-through, wired: Value in, Value out, and the graph carries on through it.
    { sourceId: 'log', sourcePort: 'value', targetId: 'res', targetPort: 'pm-ok' },
    { sourceId: 'log', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

interface LogLine {
  ts: string;
  level: string;
  event: string;
  message?: string;
  requestId?: string;
  nodeId?: string;
  function?: string;
  data?: Record<string, unknown>;
}

describe('the Log node in a cloud function (CWF-013)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let previousLevel: string | undefined;
  let stdoutSpy: jest.SpyInstance;
  const stdout: string[] = [];

  const client = httpClient(() => base);

  /** Every structured line the service wrote, parsed. */
  const lines = (): LogLine[] =>
    stdout
      .filter((l) => l.trim().startsWith('{'))
      .map((l) => {
        try {
          return JSON.parse(l) as LogLine;
        } catch {
          return { ts: '', level: '', event: '' } as LogLine;
        }
      });

  const authorLines = () => lines().filter((l) => l.event === 'function.log');

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cloud-log-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'log.workflow.json'),
      JSON.stringify({ components: [logSecretFunction, plainLogFunction], settings: {}, metadata: {} })
    );
    fs.writeFileSync(
      path.join(dataDir, 'secrets.json'),
      JSON.stringify({ functions: { STRIPE_KEY: STORED_SECRET } }, null, 2),
      { mode: 0o600 }
    );

    // `setup-logging.js` silences the process logger for the whole suite, and the env var beats
    // anything `configure` is handed — so turning it up has to happen before `start()`.
    previousLevel = process.env.NODEGX_LOG_LEVEL;
    process.env.NODEGX_LOG_LEVEL = 'debug';
    process.env.NODEGX_LOG_FORMAT = 'json';

    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });

    service = new BackendService({ dataDir, port: 0, backendId: 'cloud_log', backendName: 'Cloud log' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    stdoutSpy.mockRestore();
    if (previousLevel === undefined) delete process.env.NODEGX_LOG_LEVEL;
    else process.env.NODEGX_LOG_LEVEL = previousLevel;
    delete process.env.NODEGX_LOG_FORMAT;
    logger.configure({ level: 'silent' });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('writes the author s line to the structured logger, at the author s level, with the request id', async () => {
    const before = authorLines().length;
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/plainLog', {
      body: { message: 'order processed', payload: { orderId: 7 } }
    });

    expect(res.status).toBe(200);
    const written = authorLines().slice(before);
    expect(written).toHaveLength(1);
    expect(written[0].message).toBe('order processed');
    expect(written[0].level).toBe('error');
    expect(written[0].function).toBe('plainLog');
    expect(written[0].nodeId).toBeTruthy();
    // The join between the access log, this line and the execution record.
    expect(written[0].requestId).toBe(res.headers.get('x-request-id'));
  });

  it('passes Value straight through, so the node can sit inline on a wire', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/plainLog', {
      body: { message: 'carried through', payload: {} }
    });
    expect(res.json.result.ok).toBe('carried through');
  });

  it('key-redacts the Data object, so a credential-named property never reaches the log', async () => {
    const before = authorLines().length;
    await client.request('POST', '/functions/plainLog', {
      body: { message: 'calling out', payload: { apiKey: 'sk_from_the_caller_9911', orderId: 7 } }
    });

    const written = authorLines().slice(before);
    expect(written[0].data).toEqual({ apiKey: '[REDACTED]', orderId: 7 });
    expect(JSON.stringify(written[0])).not.toContain('sk_from_the_caller_9911');
  });

  it('VALUE-redacts a planted secret out of the message, which key-based redaction cannot do', async () => {
    // The graph wires Secret.Value straight into Log.Message. There is no key called "secret"
    // anywhere — `redact()`'s own comment concedes it cannot catch this, and it does not. What
    // catches it is the value-based pass over the values this backend itself provisioned.
    const before = authorLines().length;
    const res = await client.request('POST', '/functions/logSecret', { body: { note: 'go' } });
    expect(res.status).toBe(200);

    const written = authorLines().slice(before);
    expect(written).toHaveLength(1);
    expect(written[0].message).toBe('[REDACTED]');
    expect(JSON.stringify(written)).not.toContain(STORED_SECRET);
  });

  it('leaves the planted secret in NO log line and NO file the service wrote', () => {
    const everything = stdout.join('\n');
    expect(everything).not.toContain(STORED_SECRET);

    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
      }
      return out;
    };

    for (const file of walk(dataDir)) {
      const text = fs.readFileSync(file).toString('binary');
      if (path.basename(file) === 'secrets.json') {
        expect(text).toContain(STORED_SECRET); // the one place it belongs
        continue;
      }
      // Sqlite included: the execution record carries a copy of every line.
      expect(`${file} contains the secret: ${text.includes(STORED_SECRET)}`).toBe(
        `${file} contains the secret: false`
      );
    }
  });

  it('copies the line into the run s execution record, where a panel can read it', async () => {
    await client.request('POST', '/functions/plainLog', {
      body: { message: 'recorded for posterity', payload: { orderId: 11 } }
    });

    const history = new ExecutionHistory();
    history.open(dataDir);
    {
      const runs = history.list({ workflowId: 'plainLog', limit: 20 });
      expect(runs.length).toBeGreaterThan(0);

      const withTheLine = runs
        .map((run) => history.get(run.id))
        .find((record) =>
          (record?.steps || []).some(
            (step) => step.nodeType === 'net.noodl.Log' && JSON.stringify(step.inputData || {}).includes('posterity')
          )
        );

      expect(withTheLine).toBeDefined();
    }
  });
});

/**
 * The value-based scrubber on its own.
 *
 * The end-to-end spec above proves the seam is wired; these prove the rule, including the two
 * cases a graph is awkward to build for: a secret **embedded** in a longer sentence, and the
 * minimum length below which scrubbing would destroy the log instead of protecting it.
 */
describe('SecretValueScrubber (CWF-013)', () => {
  let dataDir: string;
  let store: SecretsStore;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-log-scrub-'));
    store = new SecretsStore(dataDir);
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('replaces a secret EMBEDDED in a sentence, which is the shape an author actually writes', () => {
    store.set(FUNCTION_SECRETS_NAMESPACE, 'STRIPE_KEY', 'sk_live_abcdefgh12345678');
    const scrubber = new SecretValueScrubber(store);
    expect(scrubber.scrub('calling stripe with sk_live_abcdefgh12345678 now')).toBe(
      'calling stripe with [REDACTED] now'
    );
  });

  it('reaches into a data object at depth, under an innocent key', () => {
    store.set(FUNCTION_SECRETS_NAMESPACE, 'TOKEN', 'tok_deadbeefdeadbeef');
    const scrubber = new SecretValueScrubber(store);
    // `note` is exactly the innocent name `redact()`'s comment says it cannot catch.
    expect(scrubber.scrubValue({ outer: { note: 'the value is tok_deadbeefdeadbeef' } })).toEqual({
      outer: { note: 'the value is [REDACTED]' }
    });
  });

  it('covers the environment door as well as the store', () => {
    process.env.NODEGX_SECRET_MAILGUN_KEY = 'mg_env_provisioned_12345';
    try {
      const scrubber = new SecretValueScrubber(store);
      expect(scrubber.scrub('key=mg_env_provisioned_12345')).toBe('key=[REDACTED]');
    } finally {
      delete process.env.NODEGX_SECRET_MAILGUN_KEY;
    }
  });

  it('ignores a value shorter than the minimum, because scrubbing "dev" would destroy every line', () => {
    store.set(FUNCTION_SECRETS_NAMESPACE, 'MODE', 'dev');
    const scrubber = new SecretValueScrubber(store);
    expect('dev'.length).toBeLessThan(MIN_SCRUBBABLE_LENGTH);
    expect(scrubber.scrub('running in dev mode')).toBe('running in dev mode');
  });

  it('treats a secret containing regex metacharacters as text, not as a pattern', () => {
    store.set(FUNCTION_SECRETS_NAMESPACE, 'ODD', 'a.b+c(d)efgh');
    const scrubber = new SecretValueScrubber(store);
    expect(scrubber.scrub('value a.b+c(d)efgh here')).toBe('value [REDACTED] here');
    // ...and the pattern does not match what the unescaped regex would have.
    expect(scrubber.scrub('value axbbbcdefgh here')).toBe('value axbbbcdefgh here');
  });

  it('says nothing about the values it holds beyond how many there are', () => {
    store.set(FUNCTION_SECRETS_NAMESPACE, 'A', 'aaaaaaaaaaaa');
    const scrubber = new SecretValueScrubber(store);
    scrubber.scrub('warm the cache');
    expect(scrubber.size).toBeGreaterThan(0);
    // There is deliberately no accessor that hands a value back — SecretsStore has no bulk read
    // (CWF-009 design question 4) and this must not become one.
    expect(JSON.stringify(Object.keys(scrubber))).not.toContain('aaaaaaaaaaaa');
  });
});
