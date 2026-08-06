/**
 * A cloud function can read a stored credential, and the credential does not leak (CWF-009).
 *
 * Driven end to end through `POST /functions/:name` against the real service, because
 * "registered" is not "works" — TALK-007's finding was nine nodes that had been in the cloud
 * registry for months without anyone running them there.
 *
 * The four things this spec exists to hold:
 *
 *  1. A secret provisioned in `<dataDir>/secrets.json` under the `functions` namespace is
 *     readable by name through the node, and reaches a real outgoing HTTP header.
 *  2. `NODEGX_SECRET_<NAME>` is the second door, for deploy targets that provision environment
 *     variables rather than a data directory.
 *  3. An unknown name fails **loudly**, with a message that names the secret and the two places
 *     to put it — and never a value. Silently emitting `undefined` is what turns into a 401
 *     from somebody else's API an hour later.
 *  4. The value appears in **no file the service wrote** (execution history included) and in no
 *     log line — asserted by scanning, not by eye, which is what the task asked for.
 *
 * ⚠️ The namespace is supplied by `service.ts` and never by the graph, so `webhooks`, `email`,
 * `auth` and the top-level `adminToken` are not merely forbidden to this node — they are
 * unnameable by it. The `cannot reach another subsystem` case below is that, measured.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** The value provisioned in secrets.json. It must never appear anywhere but that file. */
const STORED_SECRET = 'sk_live_stored_2f4a9c1e_do_not_leak';
/** The value provisioned in the environment. */
const ENV_SECRET = 'sk_live_fromenv_77b3d5_do_not_leak';

/**
 * Request → Secret → HTTP (as a header) → Response.
 *
 * The secret's *name* arrives as a request parameter so one graph covers every case, and the
 * response carries only the upstream status — the value itself is never in the reply, which is
 * what makes the leak scan below mean something.
 */
const callWithSecret = (upstream: string) => ({
  name: '/#__cloud__/callWithSecret',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'secretName' },
      ports: [],
      children: []
    },
    { id: 'sec', type: 'noodl.cloud.secret', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    {
      id: 'http',
      type: 'net.noodl.HTTP',
      x: 0,
      y: 200,
      parameters: { url: `${upstream}/paid-api`, method: 'GET', headers: 'X-Api-Key' },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'status' },
      ports: [],
      children: []
    },
    {
      id: 'resErr',
      type: 'noodl.cloud.response',
      x: 0,
      y: 400,
      // Deliberately a 200 carrying the diagnostic rather than `status: 'failure'`: this spec is
      // asserting on the message's WORDING, and the failure branch answers `{error}` from the
      // node's own `errorMessage` input instead of the graph's parameters.
      parameters: { params: 'error' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-secretName', targetId: 'sec', targetPort: 'name' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    // `header-X-Api-Key` is a dynamic input; a connection to it is enough to mint it, and the
    // `headers` parameter above is what makes `buildHeaders` actually send it.
    { sourceId: 'sec', sourcePort: 'value', targetId: 'http', targetPort: 'header-X-Api-Key' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'http', targetPort: 'fetch' },
    { sourceId: 'http', sourcePort: 'statusCode', targetId: 'res', targetPort: 'pm-status' },
    { sourceId: 'http', sourcePort: 'done', targetId: 'res', targetPort: 'send' },
    // The failure path is wired. A function whose only wired path is the happy one hangs
    // forever when the credential is missing (CWF-018) — which is what a red 40s timeout here
    // would actually mean.
    { sourceId: 'sec', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'sec', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
});

interface UpstreamHit {
  url: string;
  apiKey?: string;
}

/** Every file the service wrote under dataDir, as text. */
function filesUnder(dir: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push({ file: full, text: fs.readFileSync(full).toString('binary') });
  }
  return out;
}

describe('the Secret node in a cloud function (CWF-009)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let upstream: http.Server;
  const hits: UpstreamHit[] = [];
  const consoleOutput: string[] = [];
  const spies: jest.SpyInstance[] = [];

  const client = httpClient(() => base);

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      hits.push({ url: String(req.url), apiKey: req.headers['x-api-key'] as string | undefined });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamUrl = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cloud-secret-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'secrets.workflow.json'),
      JSON.stringify({ components: [callWithSecret(upstreamUrl)], settings: {}, metadata: {} })
    );

    // Door 1: the store convention. Written with a sibling namespace present so the read cannot
    // accidentally be "the file has one key in it".
    fs.writeFileSync(
      path.join(dataDir, 'secrets.json'),
      JSON.stringify(
        {
          adminToken: 'admin-token-not-reachable-from-a-graph',
          webhooks: { trg_1: 'webhook-secret-not-reachable-from-a-graph' },
          functions: { STRIPE_KEY: STORED_SECRET }
        },
        null,
        2
      ),
      { mode: 0o600 }
    );

    // Door 2: the environment.
    process.env.NODEGX_SECRET_MAILGUN_KEY = ENV_SECRET;

    for (const method of ['log', 'warn', 'error', 'info'] as const) {
      spies.push(
        jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
          consoleOutput.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        })
      );
    }

    service = new BackendService({ dataDir, port: 0, backendId: 'cloud_secret', backendName: 'Cloud secret' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    for (const spy of spies) spy.mockRestore();
    delete process.env.NODEGX_SECRET_MAILGUN_KEY;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('reads a secret from the functions namespace and sends it as a real HTTP header', async () => {
    const res = await client.request<{ result: { status?: number } }>('POST', '/functions/callWithSecret', {
      body: { secretName: 'STRIPE_KEY' }
    });

    expect(res.status).toBe(200);
    expect(res.json.result.status).toBe(200);
    // The upstream is the only place the value is allowed to arrive.
    expect(hits.find((h) => h.url === '/paid-api')?.apiKey).toBe(STORED_SECRET);
    // ...and the reply the caller got does not contain it.
    expect(res.text).not.toContain(STORED_SECRET);
  });

  it('falls back to NODEGX_SECRET_<NAME> when the store has no such secret', async () => {
    const before = hits.length;
    const res = await client.request<{ result: { status?: number } }>('POST', '/functions/callWithSecret', {
      body: { secretName: 'MAILGUN_KEY' }
    });

    expect(res.status).toBe(200);
    expect(hits.slice(before)[0]?.apiKey).toBe(ENV_SECRET);
  });

  it('fails loudly on an unknown name, naming the secret and both places to provision it', async () => {
    const res = await client.request<{ result: { error?: string } }>('POST', '/functions/callWithSecret', {
      body: { secretName: 'NEVER_PROVISIONED' }
    });

    const error = res.json.result.error || '';
    expect(error).toContain('NEVER_PROVISIONED');
    expect(error).toContain('secrets.json');
    expect(error).toContain('NODEGX_SECRET_NEVER_PROVISIONED');
    // The expected production failure, said in those words.
    expect(error).toContain('does not travel with a deploy');
    // No credential in a diagnostic, ever.
    expect(error).not.toContain(STORED_SECRET);
    expect(error).not.toContain(ENV_SECRET);
  });

  it('cannot reach another subsystem s namespace by naming it', async () => {
    for (const name of ['adminToken', 'webhooks', 'email', 'auth']) {
      const res = await client.request<{ result: { error?: string } }>('POST', '/functions/callWithSecret', {
        body: { secretName: name }
      });
      const error = res.json.result.error || '';
      expect(error).toContain(`"${name}" is not provisioned`);
      expect(error).not.toContain('admin-token-not-reachable-from-a-graph');
      expect(error).not.toContain('webhook-secret-not-reachable-from-a-graph');
    }
  });

  it('rejects an unusable name without echoing it back whole', async () => {
    const res = await client.request<{ result: { error?: string } }>('POST', '/functions/callWithSecret', {
      body: { secretName: 'a name with spaces and \n newlines' }
    });
    expect(res.json.result.error || '').toContain('is not a usable secret name');
  });

  it('leaves the value in no file the service wrote and in no log line', () => {
    const written = filesUnder(dataDir);
    // Sanity: the scan is looking at something, including the execution history.
    expect(written.length).toBeGreaterThan(1);
    expect(written.some((f) => f.file.endsWith('executions.sqlite'))).toBe(true);

    for (const { file, text } of written) {
      if (path.basename(file) === 'secrets.json') {
        expect(text).toContain(STORED_SECRET); // the one place it belongs
        continue;
      }
      expect(`${file} contains the secret: ${text.includes(STORED_SECRET)}`).toBe(`${file} contains the secret: false`);
    }

    const logged = consoleOutput.join('\n');
    expect(logged).not.toContain(STORED_SECRET);
    expect(logged).not.toContain(ENV_SECRET);
  });

  it('is registered for the cloud runtime only', () => {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json'), 'utf8')
    ) as { nodes: { typeName: string; availableIn: string[] }[] };
    const secret = catalog.nodes.find((n) => n.typeName === 'noodl.cloud.secret');
    expect(secret).toBeDefined();
    // If this ever says "browser", the registration moved into the shared list and a secret is
    // now shipped in a browser bundle.
    expect(secret?.availableIn).toEqual(['cloud']);
  });
});
