/**
 * The admin secrets door (CWF-009 slice 4).
 *
 * CWF-009 shipped the store, the resolver and the Secret node, and deferred the
 * admin route because `HttpServer.ts` was outside that pass. This spec is the
 * route, driven over real HTTP against a real service, and it holds the two
 * things that are easy to say and easy to lose:
 *
 *  1. **The door writes where the graph reads.** A secret provisioned by
 *     `PUT /admin/secrets/:name` is resolvable by a Secret node inside a cloud
 *     function on the next call — asserted by sending it to an upstream HTTP
 *     server, because "the file changed" only proves JSON round-trips.
 *  2. **The value never comes back out.** No route returns it, and it appears in
 *     no file the service wrote (the audit database and executions.sqlite
 *     included) and in no log line. That is CWF-009's own bar, applied to the
 *     surface CWF-009 did not build: a route that writes a credential is a route
 *     that can leak one.
 *
 * Plus the namespace policy, which is the load-bearing part: `functions` is
 * supplied by the handler and there is no `:namespace` segment, so a caller
 * naming `adminToken` writes `functions.adminToken` and the real admin
 * credential is untouched. Asserted rather than reasoned about — the store's
 * whole-file read-modify-write is what makes it true, and it is exactly the
 * property a future "just add a namespace parameter" would quietly remove.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Enforcement on. Only the posture matters here; the collection rules are unused. */
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
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

/** Provisioned through the admin route. Allowed in secrets.json and nowhere else. */
const PROVISIONED = 'sk_live_via_admin_route_9d31c7_do_not_leak';
/** The replacement, to prove an overwrite is an overwrite and not an append. */
const ROTATED = 'sk_live_rotated_4b8e02_do_not_leak';

/** Request → Secret → HTTP (as a header) → Response. CWF-009's own fixture shape. */
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
    { id: 'res', type: 'noodl.cloud.response', x: 0, y: 300, parameters: { params: 'status' }, ports: [], children: [] },
    {
      id: 'resErr',
      type: 'noodl.cloud.response',
      x: 0,
      y: 400,
      parameters: { params: 'error' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-secretName', targetId: 'sec', targetPort: 'name' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    { sourceId: 'sec', sourcePort: 'value', targetId: 'http', targetPort: 'header-X-Api-Key' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'http', targetPort: 'fetch' },
    { sourceId: 'http', sourcePort: 'statusCode', targetId: 'res', targetPort: 'pm-status' },
    { sourceId: 'http', sourcePort: 'done', targetId: 'res', targetPort: 'send' },
    // The failure path is wired: without it a missing credential hangs the call
    // to the harness limit instead of failing (CWF-018).
    { sourceId: 'sec', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-error' },
    { sourceId: 'sec', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
});

interface SecretRow {
  name: string;
  envName: string;
  alsoInEnvironment: boolean;
}
interface SecretList {
  namespace: string;
  secrets: SecretRow[];
  environment: string[];
  readable: boolean;
  envPrefix: string;
}
interface WriteResult {
  success?: boolean;
  name?: string;
  created?: boolean;
  existed?: boolean;
  stillResolvesFromEnvironment?: boolean;
  error?: string;
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

describe('the admin secrets route (CWF-009 slice 4)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;
  let upstream: http.Server;
  const hits: { url: string; apiKey?: string }[] = [];
  const consoleOutput: string[] = [];
  const spies: jest.SpyInstance[] = [];

  const client = httpClient(() => base);
  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });

  /** What the store actually holds, read from disk rather than from the API. */
  const onDisk = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')) as Record<string, unknown>;

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      hits.push({ url: String(req.url), apiKey: req.headers['x-api-key'] as string | undefined });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamUrl = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-admin-secrets-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'secrets.workflow.json'),
      JSON.stringify({ components: [callWithSecret(upstreamUrl)], settings: {}, metadata: {} })
    );

    // Enforcement ON, deliberately. Dev-open relaxes EVERY admin gate on
    // loopback (`HttpServer.checkAccess` step 2), which is the posture the
    // editor's own spawned backend runs in — so a spec that left it on would
    // assert nothing about who may call this door, and the 401 case below would
    // be a 200.
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));

    // A sibling namespace exists before anything is written, so "preserved the
    // rest of the file" is a real assertion and not a one-key file.
    fs.writeFileSync(
      path.join(dataDir, 'secrets.json'),
      JSON.stringify({ webhooks: { trg_1: 'webhook-secret-not-reachable-from-a-graph' } }, null, 2),
      { mode: 0o600 }
    );

    process.env.NODEGX_SECRET_ONLY_IN_ENV = 'env-provisioned-not-through-this-door';

    for (const method of ['log', 'warn', 'error', 'info'] as const) {
      spies.push(
        jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
          consoleOutput.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        })
      );
    }

    service = new BackendService({ dataDir, port: 0, backendId: 'admin_secrets', backendName: 'Admin secrets' });
    base = (await service.start()).listen.url;
    // Minted on first start beside the namespace written above — which is the
    // read-modify-write convention working, before this spec writes anything.
    adminToken = onDisk().adminToken as string;
    expect(typeof adminToken).toBe('string');
  });

  afterAll(async () => {
    await service.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    for (const spy of spies) spy.mockRestore();
    delete process.env.NODEGX_SECRET_ONLY_IN_ENV;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 1. It is admin-gated, like every other route in this family
  // ==========================================================================

  it('refuses an unauthenticated caller on all three verbs', async () => {
    expect((await client.get('/admin/secrets')).status).toBe(401);
    expect((await client.put('/admin/secrets/ANY', { value: 'x' })).status).toBe(401);
    expect((await client.del('/admin/secrets/ANY')).status).toBe(401);
    // ...and nothing was written by the attempt.
    expect(onDisk().functions).toBeUndefined();
  });

  // ==========================================================================
  // 2. The door writes where the graph reads
  // ==========================================================================

  it('provisions a secret a cloud function can then resolve by name', async () => {
    const wrote = await client.put<WriteResult>('/admin/secrets/STRIPE_KEY', { value: PROVISIONED }, asAdmin());
    expect(wrote.status).toBe(201);
    expect(wrote.json.created).toBe(true);
    // The reply does not carry the value back — not even the one just sent.
    expect(wrote.text).not.toContain(PROVISIONED);

    const call = await client.request<{ result: { status?: number } }>('POST', '/functions/callWithSecret', {
      body: { secretName: 'STRIPE_KEY' }
    });
    expect(call.status).toBe(200);
    expect(call.json.result.status).toBe(200);
    expect(hits.find((h) => h.url === '/paid-api')?.apiKey).toBe(PROVISIONED);
  });

  it('replaces a value in place, and the next call sees the new one', async () => {
    const before = hits.length;
    const wrote = await client.put<WriteResult>('/admin/secrets/STRIPE_KEY', { value: ROTATED }, asAdmin());
    expect(wrote.status).toBe(200);
    expect(wrote.json.created).toBe(false);

    await client.request('POST', '/functions/callWithSecret', { body: { secretName: 'STRIPE_KEY' } });
    expect(hits.slice(before)[0]?.apiKey).toBe(ROTATED);
    // One key, not two — a rotation that appends is a credential that never rotates.
    expect(Object.keys(onDisk().functions as Record<string, string>)).toEqual(['STRIPE_KEY']);
  });

  // ==========================================================================
  // 3. Names out, values never
  // ==========================================================================

  it('lists names and provenance, and offers no way to read a value back', async () => {
    const list = await client.get<SecretList>('/admin/secrets', asAdmin());
    expect(list.status).toBe(200);
    expect(list.json.namespace).toBe('functions');
    expect(list.json.readable).toBe(false);
    expect(list.json.secrets.map((s) => s.name)).toEqual(['STRIPE_KEY']);
    expect(list.json.secrets[0].envName).toBe('NODEGX_SECRET_STRIPE_KEY');
    expect(list.json.secrets[0].alsoInEnvironment).toBe(false);
    // The second door is reported, because a names-only list of the first one
    // would call an env-provisioned secret missing.
    expect(list.json.environment).toContain('NODEGX_SECRET_ONLY_IN_ENV');
    expect(list.text).not.toContain(ROTATED);
    expect(list.text).not.toContain('env-provisioned-not-through-this-door');

    // There is no GET of a value at any of the shapes someone would try.
    expect((await client.get('/admin/secrets/STRIPE_KEY', asAdmin())).status).toBe(404);
    expect((await client.get('/admin/secrets/functions/STRIPE_KEY', asAdmin())).status).toBe(404);
  });

  // ==========================================================================
  // 4. The namespace policy, measured
  // ==========================================================================

  it('cannot reach another subsystem s namespace, because there is no namespace to name', async () => {
    const adminTokenBefore = onDisk().adminToken;

    // A name that collides with a backend namespace lands INSIDE `functions`.
    const wrote = await client.put<WriteResult>('/admin/secrets/adminToken', { value: 'not-the-real-one' }, asAdmin());
    expect(wrote.status).toBe(201);
    expect(onDisk().adminToken).toBe(adminTokenBefore);
    expect((onDisk().functions as Record<string, string>).adminToken).toBe('not-the-real-one');
    // The webhook secret written before the service started is still there —
    // whole-file read-modify-write, which is what makes this door composable.
    expect((onDisk().webhooks as Record<string, string>).trg_1).toBe('webhook-secret-not-reachable-from-a-graph');
    await client.del('/admin/secrets/adminToken', asAdmin());

    // And the path shape that would express a namespace does not route.
    expect((await client.put('/admin/secrets/webhooks/trg_1', { value: 'x' }, asAdmin())).status).toBe(404);
  });

  it('refuses a name a Secret node could never ask for, without echoing it back', async () => {
    const res = await client.put<WriteResult>('/admin/secrets/' + encodeURIComponent('has spaces'), { value: 'x' }, asAdmin());
    expect(res.status).toBe(400);
    expect(res.json.error).toContain('not a usable secret name');
    expect(res.json.error).not.toContain('has spaces');
  });

  it('refuses a body that is not a value, and an empty value', async () => {
    expect((await client.put<WriteResult>('/admin/secrets/X', { value: 42 }, asAdmin())).status).toBe(400);
    expect((await client.put<WriteResult>('/admin/secrets/X', { value: '' }, asAdmin())).status).toBe(400);
    const unknown = await client.put<WriteResult>('/admin/secrets/X', { value: 'ok', namespace: 'auth' }, asAdmin());
    expect(unknown.status).toBe(400);
    expect(unknown.json.error).toContain('"namespace"');
    expect(onDisk().functions).not.toHaveProperty('X');
  });

  // ==========================================================================
  // 5. Delete, and the honest thing about the second door
  // ==========================================================================

  it('deletes a secret and says whether the environment still answers for it', async () => {
    const gone = await client.del<WriteResult>('/admin/secrets/STRIPE_KEY', asAdmin());
    expect(gone.status).toBe(200);
    expect(gone.json.existed).toBe(true);
    expect(gone.json.stillResolvesFromEnvironment).toBe(false);

    const call = await client.request<{ result: { error?: string } }>('POST', '/functions/callWithSecret', {
      body: { secretName: 'STRIPE_KEY' }
    });
    expect(call.json.result.error || '').toContain('"STRIPE_KEY" is not provisioned');

    // Deleting something that is only in the environment removes nothing and
    // says so, rather than reporting a success that changes no behaviour.
    const envOnly = await client.del<WriteResult>('/admin/secrets/ONLY_IN_ENV', asAdmin());
    expect(envOnly.json.existed).toBe(false);
    expect(envOnly.json.stillResolvesFromEnvironment).toBe(true);
  });

  // ==========================================================================
  // 6. CWF-009's bar, applied to the route that writes the credential
  // ==========================================================================

  it('leaves both values in no file but secrets.json, and in no log line', () => {
    // Put one back so the scan has something to find in its one legal home.
    // (Through the door under test, which is the point.)
    return client.put('/admin/secrets/STRIPE_KEY', { value: PROVISIONED }, asAdmin()).then(() => {
      const written = filesUnder(dataDir);
      expect(written.some((f) => f.file.endsWith('executions.sqlite'))).toBe(true);

      for (const { file, text } of written) {
        if (path.basename(file) === 'secrets.json') {
          expect(text).toContain(PROVISIONED);
          continue;
        }
        const found = text.includes(PROVISIONED) || text.includes(ROTATED);
        expect(`${file} contains a secret: ${found}`).toBe(`${file} contains a secret: false`);
      }

      const logged = consoleOutput.join('\n');
      expect(logged).not.toContain(PROVISIONED);
      expect(logged).not.toContain(ROTATED);
    });
  });
});
