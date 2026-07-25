/**
 * EmailTokenStore (BAK-002) — the token-hygiene properties both flows depend
 * on: single-use, time-limited, hashed at rest. Runs against a real
 * node:sqlite-backed adapter (via createAdapter), same as the rest of the
 * suite's integration-leaning tests.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createAdapter, PersistenceHandle } from '../src/persistence/createAdapter';
import { AdapterFacade } from '../src/persistence/AdapterFacade';
import { EmailTokenStore, hashToken } from '../src/email/tokens';

describe('EmailTokenStore', () => {
  let dataDir: string;
  let persistence: PersistenceHandle;
  let facade: AdapterFacade;
  let tokens: EmailTokenStore;
  let userId: string;

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-email-tokens-test-'));
    persistence = await createAdapter({ dataDir });
    facade = new AdapterFacade(persistence.adapter);
    tokens = new EmailTokenStore(facade);
    // Mirrors service.ts's ensureSystemTables(): pre-create `_EmailToken` so a
    // query against it before any token has been issued (this suite's
    // "garbage token" case) doesn't hit a "no such column" SQL error.
    facade.schemaManager.createTable({
      name: '_EmailToken',
      columns: [
        { name: 'tokenHash', type: 'String' },
        { name: 'userId', type: 'String' },
        { name: 'kind', type: 'String' },
        { name: 'expiresAt', type: 'Date' },
        { name: 'consumedAt', type: 'Date' }
      ]
    });
    const user = await facade.rawCreate('_User', { username: 'jane', email: 'jane@example.com' });
    userId = user.objectId as string;
  });

  afterEach(async () => {
    await persistence.adapter.disconnect();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('issues a token that hashes to something other than the plaintext (hashed at rest)', async () => {
    const token = await tokens.issue(userId, 'reset', 60_000);
    expect(token.length).toBeGreaterThan(20);
    const { results } = await facade.rawQuery('_EmailToken', { where: { userId } });
    expect(results).toHaveLength(1);
    expect(results[0].tokenHash).toBe(hashToken(token));
    expect(results[0].tokenHash).not.toBe(token);
  });

  it('consumes a valid token exactly once', async () => {
    const token = await tokens.issue(userId, 'reset', 60_000);
    const first = await tokens.consume(token, 'reset');
    expect(first).toBe(userId);
    const second = await tokens.consume(token, 'reset');
    expect(second).toBeNull(); // single-use
  });

  it('rejects a token of the wrong kind', async () => {
    const token = await tokens.issue(userId, 'reset', 60_000);
    expect(await tokens.consume(token, 'verify')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await tokens.issue(userId, 'reset', -1); // already expired
    expect(await tokens.consume(token, 'reset')).toBeNull();
  });

  it('rejects a token for the wrong expected user', async () => {
    const token = await tokens.issue(userId, 'reset', 60_000);
    expect(await tokens.consume(token, 'reset', 'someone-else')).toBeNull();
  });

  it('rejects a garbage/unknown token', async () => {
    expect(await tokens.consume('not-a-real-token', 'reset')).toBeNull();
  });

  it('reset and verify tokens for the same user are independent', async () => {
    const resetToken = await tokens.issue(userId, 'reset', 60_000);
    const verifyToken = await tokens.issue(userId, 'verify', 60_000);
    expect(await tokens.consume(resetToken, 'verify')).toBeNull();
    expect(await tokens.consume(verifyToken, 'verify')).toBe(userId);
    expect(await tokens.consume(resetToken, 'reset')).toBe(userId);
  });
});
