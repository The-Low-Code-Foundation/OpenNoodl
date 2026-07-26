/**
 * Token infrastructure shared by both email flows (BAK-002 step 2):
 * password reset and email verification. Tokens are:
 *
 *   - single-use     (consumed atomically — see EmailTokenStore.consume)
 *   - time-limited    (kind-specific TTL; see RESET_TTL_MS / VERIFY_TTL_MS)
 *   - HASHED at rest (sha256; only the hash is ever persisted — the plaintext
 *     token exists only in memory long enough to put it in the email)
 *
 * Storage: a plain `_EmailToken` collection via AdapterFacade, auto-created
 * on first write exactly like every other BYOB collection (LocalSQLAdapter's
 * `_ensureTable` + column inference) — no schema migration needed.
 *
 * @module nodegx-backend/email/tokens
 */

import * as crypto from 'crypto';

import type { AdapterFacade } from '../persistence/AdapterFacade';

export type TokenKind = 'reset' | 'verify' | 'magic';

/** Password-reset links are short-lived: a leaked reset email is a live credential. */
export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Verification links are informational, not a credential-change — longer-lived. */
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/**
 * BAK-004 magic links. The TTL is configurable (auth.json `magicLink.ttlMinutes`)
 * because deliverability delays vary wildly between SMTP setups; this is the
 * default. A magic link is a *login credential in an inbox*, so it is the
 * shortest-lived of the three by design.
 */
export const MAGIC_LINK_DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

const TOKEN_BYTES = 32;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function newPlaintextToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

export class EmailTokenStore {
  private readonly facade: AdapterFacade;

  constructor(facade: AdapterFacade) {
    this.facade = facade;
  }

  /**
   * Mint + persist (hashed) a token for `userId`; returns the PLAINTEXT token to
   * put in the email — never stored.
   *
   * `extra` carries the few fields a flow needs to remember across the round
   * trip to an inbox. BAK-004's magic links use it for two: the `email` (a
   * signup link is issued before any user exists, so `userId` is empty and the
   * address IS the identity) and the `redirectUrl` (already authorised against
   * the redirect allow-list at REQUEST time, so the click cannot smuggle in a
   * new destination). Nothing secret goes in here — the row is queryable by
   * anything with database access, whereas the token itself never is.
   */
  async issue(userId: string, kind: TokenKind, ttlMs: number, extra?: Record<string, unknown>): Promise<string> {
    const token = newPlaintextToken();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await this.facade.rawCreate('_EmailToken', {
      ...(extra || {}),
      tokenHash: hashToken(token),
      userId,
      kind,
      expiresAt,
      consumedAt: null
    });
    return token;
  }

  /**
   * Verify + consume in one step: a token that fails any check (not found,
   * already used, expired, wrong kind, wrong user when `expectedUserId` is
   * given) returns null — the caller cannot distinguish WHY, which is
   * deliberate (no oracle for token guessing). On success the token row is
   * marked consumed before the userId is returned, so a token can never be
   * used twice even under a race (the second caller reads `consumedAt` set).
   */
  async consume(token: string, kind: TokenKind, expectedUserId?: string): Promise<string | null> {
    const row = await this.consumeRow(token, kind, expectedUserId);
    return row ? (row.userId as string) : null;
  }

  /**
   * The same single-use consumption, returning the WHOLE row rather than just
   * its userId — what a flow needs when it stored `extra` fields at issue time
   * (BAK-004 magic links). `consume` above is this, projected.
   */
  async consumeRow(token: string, kind: TokenKind, expectedUserId?: string): Promise<Record<string, unknown> | null> {
    const tokenHash = hashToken(token);
    const { results } = await this.facade.rawQuery('_EmailToken', { where: { tokenHash }, limit: 1 });
    const row = results[0];
    if (!row) return null;
    if (row.kind !== kind) return null;
    if (row.consumedAt) return null;
    if (typeof row.expiresAt !== 'string' || new Date(row.expiresAt).getTime() < Date.now()) return null;
    if (expectedUserId && row.userId !== expectedUserId) return null;

    // Mark consumed FIRST — a concurrent second consume() on the same row now
    // sees consumedAt set and reads null, even though this isn't a single
    // transaction (single-process SQLite serializes writes; documented
    // best-effort, not a distributed-lock claim).
    await this.facade.rawSave('_EmailToken', row.objectId as string, { consumedAt: new Date().toISOString() });
    return row;
  }
}
