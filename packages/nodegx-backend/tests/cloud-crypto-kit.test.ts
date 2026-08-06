/**
 * The crypto kit, driven inside a real cloud function (CWF-010).
 *
 * The unit suite (`noodl-runtime/test/nodes/cwf-010-crypto.test.ts`) checks the ALGORITHMS
 * against vectors produced outside this repo. This one checks the other half, which is the half
 * that has actually been wrong before: that the nodes are **registered in the cloud registry**,
 * that a graph can wire them, and that an asynchronous WebCrypto node settles before the Response
 * node fires.
 *
 * ⚠️ With a registration line removed, these specs do not fail — they **hang** for the full
 * timeout. An unknown node type in a cloud function means nothing ever reaches a Response node.
 * A 40-second red here is what "this node is not registered" looks like from out here.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

const SIGNING_SECRET = 'a-shared-secret-for-signing';

/** Request → Hash → Response. The digest of a request parameter comes back in the reply. */
const hashFunction = {
  name: '/#__cloud__/hashIt',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'text' },
      ports: [],
      children: []
    },
    // No `algorithm` and no `encoding` parameter: the declared defaults never run their setters,
    // so this is exactly the graph that would break if `initialize` did not set them.
    { id: 'hash', type: 'net.noodl.Hash', x: 0, y: 100, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'digest' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-text', targetId: 'hash', targetPort: 'value' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'hash', targetPort: 'hash' },
    { sourceId: 'hash', sourcePort: 'digest', targetId: 'res', targetPort: 'pm-digest' },
    // The whole async question, in one wire: `Done` fires from the promise continuation, so a
    // node that signalled early would answer with an empty Digest and still return 200.
    { sourceId: 'hash', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/** Request → Random Bytes → UUID → Response. Two ids per call, both from the CSPRNG. */
const idsFunction = {
  name: '/#__cloud__/mintIds',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true },
      ports: [],
      children: []
    },
    {
      id: 'rand',
      type: 'net.noodl.RandomBytes',
      x: 0,
      y: 100,
      parameters: { length: 16, encoding: 'base64url' },
      ports: [],
      children: []
    },
    { id: 'uuid', type: 'net.noodl.UUID', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'nonce,id' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'rand', targetPort: 'generate' },
    { sourceId: 'rand', sourcePort: 'done', targetId: 'uuid', targetPort: 'generate' },
    { sourceId: 'rand', sourcePort: 'value', targetId: 'res', targetPort: 'pm-nonce' },
    { sourceId: 'uuid', sourcePort: 'uuid', targetId: 'res', targetPort: 'pm-id' },
    { sourceId: 'uuid', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/**
 * Request → Secret → HMAC → Response.
 *
 * The key comes from CWF-009's Secret node, which is the dependency CWF-010 was sequenced behind:
 * before it, "sign this with our key" had no way to name the key.
 */
const hmacFunction = {
  name: '/#__cloud__/signIt',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'body' },
      ports: [],
      children: []
    },
    {
      id: 'sec',
      type: 'noodl.cloud.secret',
      x: 0,
      y: 100,
      parameters: { name: 'WEBHOOK_SIGNING_KEY' },
      ports: [],
      children: []
    },
    { id: 'mac', type: 'noodl.cloud.hmac', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'signature' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-body', targetId: 'mac', targetPort: 'value' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    { sourceId: 'sec', sourcePort: 'value', targetId: 'mac', targetPort: 'key' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'mac', targetPort: 'sign' },
    { sourceId: 'mac', sourcePort: 'signature', targetId: 'res', targetPort: 'pm-signature' },
    { sourceId: 'mac', sourcePort: 'done', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/** Request → Secret → JWT Sign → JWT Verify → Response. A round trip through both nodes. */
const jwtFunction = {
  name: '/#__cloud__/jwtRoundTrip',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'claims,token' },
      ports: [],
      children: []
    },
    {
      id: 'sec',
      type: 'noodl.cloud.secret',
      x: 0,
      y: 100,
      parameters: { name: 'WEBHOOK_SIGNING_KEY' },
      ports: [],
      children: []
    },
    {
      id: 'sign',
      type: 'noodl.cloud.jwtsign',
      x: 0,
      y: 200,
      parameters: { expiresIn: 300 },
      ports: [],
      children: []
    },
    { id: 'ver', type: 'noodl.cloud.jwtverify', x: 0, y: 300, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 400,
      parameters: { params: 'token,valid,claims' },
      ports: [],
      children: []
    },
    {
      id: 'resErr',
      type: 'noodl.cloud.response',
      x: 0,
      y: 500,
      parameters: { params: 'rejected' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-claims', targetId: 'sign', targetPort: 'claims' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    { sourceId: 'sec', sourcePort: 'value', targetId: 'sign', targetPort: 'key' },
    { sourceId: 'sec', sourcePort: 'value', targetId: 'ver', targetPort: 'key' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'sign', targetPort: 'sign' },
    { sourceId: 'sign', sourcePort: 'token', targetId: 'ver', targetPort: 'token' },
    { sourceId: 'sign', sourcePort: 'token', targetId: 'res', targetPort: 'pm-token' },
    { sourceId: 'sign', sourcePort: 'done', targetId: 'ver', targetPort: 'verify' },
    { sourceId: 'ver', sourcePort: 'valid', targetId: 'res', targetPort: 'pm-valid' },
    { sourceId: 'ver', sourcePort: 'claims', targetId: 'res', targetPort: 'pm-claims' },
    { sourceId: 'ver', sourcePort: 'done', targetId: 'res', targetPort: 'send' },
    { sourceId: 'ver', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-rejected' },
    { sourceId: 'ver', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

/** Verify a token the CALLER supplies, so the attack cases can be driven over HTTP. */
const verifyOnlyFunction = {
  name: '/#__cloud__/verifyIt',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'token' },
      ports: [],
      children: []
    },
    {
      id: 'sec',
      type: 'noodl.cloud.secret',
      x: 0,
      y: 100,
      parameters: { name: 'WEBHOOK_SIGNING_KEY' },
      ports: [],
      children: []
    },
    { id: 'ver', type: 'noodl.cloud.jwtverify', x: 0, y: 200, parameters: {}, ports: [], children: [] },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'valid,claims' },
      ports: [],
      children: []
    },
    {
      id: 'resErr',
      type: 'noodl.cloud.response',
      x: 0,
      y: 400,
      parameters: { params: 'rejected,claims' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'pm-token', targetId: 'ver', targetPort: 'token' },
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    { sourceId: 'sec', sourcePort: 'value', targetId: 'ver', targetPort: 'key' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'ver', targetPort: 'verify' },
    { sourceId: 'ver', sourcePort: 'valid', targetId: 'res', targetPort: 'pm-valid' },
    { sourceId: 'ver', sourcePort: 'claims', targetId: 'res', targetPort: 'pm-claims' },
    { sourceId: 'ver', sourcePort: 'done', targetId: 'res', targetPort: 'send' },
    { sourceId: 'ver', sourcePort: 'error', targetId: 'resErr', targetPort: 'pm-rejected' },
    { sourceId: 'ver', sourcePort: 'claims', targetId: 'resErr', targetPort: 'pm-claims' },
    { sourceId: 'ver', sourcePort: 'failure', targetId: 'resErr', targetPort: 'send' }
  ],
  roots: []
};

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('the crypto kit in a cloud function (CWF-010)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const client = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cloud-crypto-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'crypto.workflow.json'),
      JSON.stringify({
        components: [hashFunction, idsFunction, hmacFunction, jwtFunction, verifyOnlyFunction],
        settings: {},
        metadata: {}
      })
    );
    fs.writeFileSync(
      path.join(dataDir, 'secrets.json'),
      JSON.stringify({ functions: { WEBHOOK_SIGNING_KEY: SIGNING_SECRET } }, null, 2),
      { mode: 0o600 }
    );

    service = new BackendService({ dataDir, port: 0, backendId: 'cloud_crypto', backendName: 'Cloud crypto' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('hashes with SHA-256 hex although neither default setter ever ran', async () => {
    const res = await client.request<{ result: { digest?: string } }>('POST', '/functions/hashIt', {
      body: { text: 'abc' }
    });
    expect(res.status).toBe(200);
    // The standard SHA-256 vector for "abc" — produced outside this repo.
    expect(res.json.result.digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('mints a distinct nonce and UUID per call', async () => {
    type Ids = { result: { nonce?: string; id?: string } };
    const [a, b] = await Promise.all([
      client.request<Ids>('POST', '/functions/mintIds', { body: {} }),
      client.request<Ids>('POST', '/functions/mintIds', { body: {} })
    ]);

    expect(a.status).toBe(200);
    expect(String(a.json.result.nonce)).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes, base64url, unpadded
    expect(String(a.json.result.id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(a.json.result.nonce).not.toBe(b.json.result.nonce);
    expect(a.json.result.id).not.toBe(b.json.result.id);
  });

  it('signs with a key it read from the Secret node, matching an HMAC computed outside the graph', async () => {
    const res = await client.request<{ result: { signature?: string } }>('POST', '/functions/signIt', {
      body: { body: 'The quick brown fox jumps over the lazy dog' }
    });
    expect(res.status).toBe(200);

    // Computed here with node:crypto, not with our own HMAC node — consistency is not correctness.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as typeof import('crypto');
    const expected = nodeCrypto
      .createHmac('sha256', SIGNING_SECRET)
      .update('The quick brown fox jumps over the lazy dog')
      .digest('hex');
    expect(res.json.result.signature).toBe(expected);
  });

  it('signs and verifies a token end to end, in one function', async () => {
    const res = await client.request<{ result: { token?: string; valid?: boolean; claims?: Record<string, unknown> } }>(
      'POST',
      '/functions/jwtRoundTrip',
      { body: { claims: { sub: 'user-1', scope: 'read' } } }
    );

    expect(res.status).toBe(200);
    expect(res.json.result.valid).toBe(true);
    expect(res.json.result.claims).toMatchObject({ sub: 'user-1', scope: 'read' });
    expect(Number(res.json.result.claims?.exp) - Number(res.json.result.claims?.iat)).toBe(300);
    expect(String(res.json.result.token).split('.')).toHaveLength(3);
  });

  it('refuses an alg:none token over the wire, and hands back no claims', async () => {
    const forged = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: 'admin' })}.`;
    const res = await client.request<{ result: { rejected?: string; claims?: unknown } }>(
      'POST',
      '/functions/verifyIt',
      { body: { token: forged } }
    );

    expect(res.status).toBe(200);
    expect(String(res.json.result.rejected)).toContain('alg "none"');
    // Nothing in an unverified token may be believed, so Claims is deliberately never populated.
    expect(res.json.result.claims).toBeUndefined();
  });

  it('refuses a token signed with the wrong key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as typeof import('crypto');
    const header = base64url({ alg: 'HS256', typ: 'JWT' });
    const payload = base64url({ sub: 'admin' });
    const signature = nodeCrypto
      .createHmac('sha256', 'not-the-signing-key')
      .update(`${header}.${payload}`)
      .digest('base64url');

    const res = await client.request<{ result: { rejected?: string } }>('POST', '/functions/verifyIt', {
      body: { token: `${header}.${payload}.${signature}` }
    });
    expect(String(res.json.result.rejected)).toContain('signature does not match');
  });

  it('refuses an expired token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as typeof import('crypto');
    const header = base64url({ alg: 'HS256', typ: 'JWT' });
    const payload = base64url({ sub: 'u1', exp: Math.floor(Date.now() / 1000) - 60 });
    const signature = nodeCrypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const res = await client.request<{ result: { rejected?: string } }>('POST', '/functions/verifyIt', {
      body: { token: `${header}.${payload}.${signature}` }
    });
    expect(String(res.json.result.rejected)).toContain('expired');
  });

  it('keeps the key-holding nodes out of the browser and the key-free ones in both', () => {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json'), 'utf8')
    ) as { nodes: { typeName: string; availableIn: string[] }[] };
    const availability = (typeName: string) => catalog.nodes.find((n) => n.typeName === typeName)?.availableIn;

    // A key in a browser is a key in the hands of everyone who opens the page.
    expect(availability('noodl.cloud.hmac')).toEqual(['cloud']);
    expect(availability('noodl.cloud.jwtsign')).toEqual(['cloud']);
    expect(availability('noodl.cloud.jwtverify')).toEqual(['cloud']);

    // These three take no key, so both surfaces get them.
    expect(availability('net.noodl.Hash')).toEqual(['browser', 'cloud']);
    expect(availability('net.noodl.RandomBytes')).toEqual(['browser', 'cloud']);
    expect(availability('net.noodl.UUID')).toEqual(['browser', 'cloud']);
  });
});
