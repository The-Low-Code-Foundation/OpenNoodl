/**
 * The crypto kit, against known-good vectors (CWF-010).
 *
 * ⚠️ Every digest below is checked against a value produced OUTSIDE this repo (the standard
 * SHA-2 test vectors for "abc", RFC 4231-style HMAC, and jwt.io's published HS256 example). The
 * task is explicit about why: checking one of our nodes against another of our nodes proves
 * consistency, not correctness — two nodes sharing one wrong implementation agree perfectly.
 */

import { createNode, DrivenNode } from '../helpers/node-harness';
import { signJwt, verifyJwt } from '../../src/nodes/std-library/crypto/jwt';
import { randomUuid } from '../../src/nodes/std-library/crypto/encoding';

import HashModule = require('../../src/nodes/std-library/crypto/hash');
import RandomBytesModule = require('../../src/nodes/std-library/crypto/randombytes');
import UuidModule = require('../../src/nodes/std-library/crypto/uuid');

/**
 * Run the frame boundary, then let the node's promise continuation land.
 *
 * ⚠️ `scheduleAfterInputsHaveUpdated` only runs inside `Node.update()`, which the context drives
 * from `updateDirtyNodes()`. A single-node harness never gets there on its own — so without this
 * line the digest is simply never computed, and the test would be measuring nothing.
 */
const settle = async (node: DrivenNode) => {
  node.context.updateDirtyNodes();
  // ⚠️ Waiting one macrotask is not enough and produced a flake that only appeared under load:
  // `crypto.subtle.digest` resolves off Node's threadpool, so the number of turns before the
  // continuation runs is not fixed — SHA-512 took more than SHA-256 often enough to be red once
  // in a suite run. Wait for the outcome the node actually reports.
  for (let i = 0; i < 200 && !node.signals.some((s) => s === 'done' || s === 'failure'); i++) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

describe('Hash (CWF-010 slice 1)', () => {
  let hash: DrivenNode;

  beforeEach(() => {
    hash = createNode(HashModule, 'net.noodl.Hash');
  });

  it('defaults to SHA-256 hex WITHOUT its setters ever running', async () => {
    // The declared `default` never runs its setter, so this is the case a real graph hits:
    // Algorithm and Encoding are untouched, and the node still has to do the right thing.
    hash.node.setInputValue('value', 'abc');
    hash.pulse('hash');
    await settle(hash);

    expect(hash.out('digest')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hash.signals).toContain('done');
  });

  it.each([
    ['SHA-384', 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7'],
    [
      'SHA-512',
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd' +
        '454d4423643ce80e2a9ac94fa54ca49f'
    ]
  ])('computes %s of "abc" to the standard vector', async (algorithm, expected) => {
    hash.node.setInputValue('algorithm', algorithm);
    hash.node.setInputValue('value', 'abc');
    hash.pulse('hash');
    await settle(hash);
    expect(hash.out('digest')).toBe(expected);
  });

  it.each([
    ['base64', 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='],
    ['base64url', 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0']
  ])('renders the same digest as %s', async (encoding, expected) => {
    hash.node.setInputValue('encoding', encoding);
    hash.node.setInputValue('value', 'abc');
    hash.pulse('hash');
    await settle(hash);
    expect(hash.out('digest')).toBe(expected);
  });

  it('fires Done only after the digest has landed, never beside the Do', () => {
    hash.node.setInputValue('value', 'abc');
    hash.pulse('hash');
    hash.context.updateDirtyNodes();
    // `crypto.subtle` is async, so the frame that started the digest cannot be the frame that
    // announces it. A node that signalled Done here would hand the next node a stale digest.
    expect(hash.signals).not.toContain('done');
    expect(hash.out('digest')).toBeUndefined();
  });
});

describe('Random Bytes (CWF-010 slice 3)', () => {
  it('produces 32 bytes as 64 hex characters with no input touched', () => {
    const random = createNode(RandomBytesModule, 'net.noodl.RandomBytes');
    random.pulse('generate');
    random.context.updateDirtyNodes();
    expect(String(random.out('value'))).toMatch(/^[0-9a-f]{64}$/);
    expect(random.signals).toContain('done');
  });

  it('gives a different block every New', () => {
    const random = createNode(RandomBytesModule, 'net.noodl.RandomBytes');
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      random.pulse('generate');
      random.context.updateDirtyNodes();
      seen.add(String(random.out('value')));
    }
    expect(seen.size).toBe(20);
  });

  it('refuses a length it cannot honour rather than quietly producing something else', () => {
    const random = createNode(RandomBytesModule, 'net.noodl.RandomBytes');
    random.node.setInputValue('length', 0);
    random.pulse('generate');
    random.context.updateDirtyNodes();
    expect(random.signals).toContain('failure');
    expect(String(random.out('error'))).toContain('whole number');
  });
});

describe('UUID (CWF-010 slice 3)', () => {
  it('is a version-4 UUID, not the 10 characters Unique Id emits', () => {
    const uuid = createNode(UuidModule, 'net.noodl.UUID');
    expect(String(uuid.out('uuid'))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('mints a fresh one on New', () => {
    const uuid = createNode(UuidModule, 'net.noodl.UUID');
    const first = uuid.out('uuid');
    uuid.pulse('generate');
    uuid.context.updateDirtyNodes();
    expect(uuid.out('uuid')).not.toBe(first);
    expect(uuid.signals).toContain('done');
  });

  it('the getRandomValues fallback produces a valid v4 too', () => {
    // The path a browser on a non-secure origin takes: `randomUUID` is absent, `getRandomValues`
    // is not. It must not be a weaker id — same layout, same entropy source.
    const host = globalThis as { crypto?: { randomUUID?: () => string } };
    const original = host.crypto?.randomUUID;
    if (host.crypto) delete host.crypto.randomUUID;
    try {
      expect(randomUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      if (host.crypto && original) host.crypto.randomUUID = original;
    }
  });
});

describe('JWT (CWF-010 slice 4)', () => {
  /** jwt.io's published HS256 example. Produced outside this repo; that is the point. */
  const KNOWN_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
    'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const KNOWN_SECRET = 'your-256-bit-secret';

  it('verifies a token this repo did not produce', async () => {
    const result = await verifyJwt(KNOWN_TOKEN, KNOWN_SECRET, 'HS256');
    expect(result.valid).toBe(true);
    expect(result.claims).toMatchObject({ sub: '1234567890', name: 'John Doe', iat: 1516239022 });
  });

  it('signs a token that verifier accepts, with iat and exp stamped', async () => {
    const token = await signJwt({ sub: 'u1' }, 'shh', 'HS256', 3600);
    const result = await verifyJwt(token, 'shh', 'HS256');
    expect(result.valid).toBe(true);
    expect(typeof result.claims?.iat).toBe('number');
    expect(Number(result.claims?.exp) - Number(result.claims?.iat)).toBe(3600);
  });

  it('leaves out exp entirely when no expiry was asked for', async () => {
    const token = await signJwt({ sub: 'u1' }, 'shh', 'HS256');
    const result = await verifyJwt(token, 'shh', 'HS256');
    expect(result.claims).not.toHaveProperty('exp');
  });

  it('rejects alg:none — the classic defect, spelled out', async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'admin' })}.`;
    const result = await verifyJwt(forged, 'shh', 'HS256');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('alg "none"');
  });

  it('rejects a token signed with a different algorithm than the one expected', async () => {
    const token = await signJwt({ sub: 'u1' }, 'shh', 'HS512');
    const result = await verifyJwt(token, 'shh', 'HS256');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('HS512');
  });

  it('rejects the wrong key', async () => {
    const token = await signJwt({ sub: 'u1' }, 'shh', 'HS256');
    const result = await verifyJwt(token, 'not-the-key', 'HS256');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature does not match');
  });

  it('rejects a tampered payload', async () => {
    const token = await signJwt({ sub: 'u1', admin: false }, 'shh', 'HS256');
    const [header, , signature] = token.split('.');
    const tampered = `${header}.${Buffer.from(JSON.stringify({ sub: 'u1', admin: true })).toString(
      'base64url'
    )}.${signature}`;
    const result = await verifyJwt(tampered, 'shh', 'HS256');
    expect(result.valid).toBe(false);
    expect(result.claims).toBeUndefined();
  });

  it('rejects an expired token, and accepts it again inside the clock tolerance', async () => {
    const token = await signJwt({ sub: 'u1' }, 'shh', 'HS256', 1);
    // Move the world forward rather than sleeping.
    const realNow = Date.now;
    Date.now = () => realNow() + 3000;
    try {
      expect((await verifyJwt(token, 'shh', 'HS256')).reason).toContain('expired');
      expect((await verifyJwt(token, 'shh', 'HS256', 60)).valid).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('rejects a token that is not valid yet', async () => {
    const notYet = Math.floor(Date.now() / 1000) + 600;
    const token = await signJwt({ sub: 'u1', nbf: notYet }, 'shh', 'HS256');
    const result = await verifyJwt(token, 'shh', 'HS256');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not valid yet');
  });

  it('rejects a malformed token without throwing', async () => {
    for (const bad of ['', 'not-a-token', 'a.b', 'a.b.c.d', '!!!.???.***']) {
      const result = await verifyJwt(bad, 'shh', 'HS256');
      expect(result.valid).toBe(false);
      expect(typeof result.reason).toBe('string');
    }
  });
});
