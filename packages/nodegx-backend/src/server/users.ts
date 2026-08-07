/**
 * Minimal Parse-wire session/user endpoints — the subset `userservice.ts`
 * actually emits (WF-004 wire-protocol decision):
 *
 *   POST /login       { username, password, _method: 'GET' } -> user + sessionToken
 *   POST /logout      {} (session token header)              -> {}
 *   POST /users       signup { username, password, email, ...props } -> 201
 *   GET  /users/me    (session token header)                 -> user + sessionToken
 *   PUT  /users/:id   (session token header, own user only)  -> { updatedAt }
 *
 * Password-reset / email-verification endpoints live in ./email-routes.ts
 * (BAK-002) — this file only carries the per-backend LOGIN POLICY those flows
 * gate on (`emailConfig.config.verification.requireForLogin`) and the
 * best-effort verification-email send on signup (opt-in per backend,
 * `emailConfig.config.verification.sendOnSignup`).
 *
 * Storage: `_User` rows via the same adapter as everything else, passwords as
 * `scrypt$<salt>$<hash>` in `_hashed_password` (never sent over the wire —
 * AdapterFacade strips it). Sessions in `_Session` rows with Parse-style
 * revocable tokens (`r:<random>`). Error code 209 (invalid session) is
 * load-bearing: it is what makes the client drop a stale local session.
 *
 * @module nodegx-backend/server/users
 */

import * as crypto from 'crypto';
import type * as http from 'http';

import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { SecurityState } from '../security/state';
import type { EmailConfigState } from '../email/EmailConfigState';
import type { EmailRoutes } from './email-routes';
import { HttpError, readJSONBody, sendJSON } from './http-util';

function safeLog(...args: unknown[]): void {
  try {
    // eslint-disable-next-line no-console
    console.warn('[nodegx-backend/users]', ...args);
  } catch {
    // Ignore EPIPE
  }
}

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function newSessionToken(): string {
  return 'r:' + crypto.randomBytes(24).toString('hex');
}

/**
 * When does this `_Session` row stop being valid? `null` = never.
 *
 * CWF-015 filed this as "`impersonate()` writes `expiresAt` and `findSession`
 * never reads it", and that was exactly true: an impersonation session minted
 * with a one-hour duration outlived the process. This is the read half.
 *
 * It is deliberately liberal about the stored shape, because the writers do not
 * agree and never did. `POST /login` and `POST /users` write no `expiresAt` at
 * all. The cloud runtime's `Users.impersonate()` writes a real `Date` through
 * `Records.create`, which reaches the adapter as an ISO string, and a
 * Parse-wire client can send `{__type: 'Date', iso}`. A hand-written admin row
 * may carry epoch milliseconds. All four are legible here.
 *
 * ⚠️ **An unreadable value means "no expiry", not "expired".** Every session
 * this backend has ever minted has a null `expiresAt`, and the whole point of
 * making expiry real is that it must not log those users out. The failure mode
 * of guessing wrong in the other direction is every account on every existing
 * backend signed out at once by a deploy — so an absent, null, empty or
 * unparseable value keeps the session alive and only a value we can genuinely
 * read as a past instant kills it.
 */
export function sessionExpiryMs(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object') {
    const iso = (value as Record<string, unknown>).iso;
    if (typeof iso === 'string') {
      const t = Date.parse(iso);
      return Number.isNaN(t) ? null : t;
    }
  }
  return null;
}

/** True only when the row carries a readable `expiresAt` that has passed. */
export function isSessionExpired(session: Record<string, unknown>, now: number = Date.now()): boolean {
  const expiry = sessionExpiryMs(session.expiresAt);
  return expiry !== null && expiry <= now;
}

export class UserRoutes {
  private readonly facade: AdapterFacade;
  // Reserved for session-policy decisions (the signup rule itself is enforced
  // by the dispatcher's route gate).
  private readonly security: SecurityState | null;
  // BAK-002: login policy (requireForLogin) + best-effort signup verification
  // send. Both optional — a service built without email wiring (e.g. an older
  // test harness) just runs with no email policy at all.
  private readonly emailConfig: EmailConfigState | null;
  private readonly emailRoutes: EmailRoutes | null;

  constructor(facade: AdapterFacade, security?: SecurityState, emailConfig?: EmailConfigState, emailRoutes?: EmailRoutes) {
    this.facade = facade;
    this.security = security || null;
    this.emailConfig = emailConfig || null;
    this.emailRoutes = emailRoutes || null;
  }

  // ==========================================================================
  // Session resolution
  // ==========================================================================

  /**
   * Resolve a session token to its `_Session` row, or null.
   *
   * The expiry check is done on the ROW, not in the `where` — a predicate on
   * `expiresAt` would be a SQL error on every backend created before that
   * column existed, and would exclude the null-`expiresAt` rows that are, today,
   * every session this backend has ever issued. Reading the value back and
   * judging it here is the only version that is safe on an existing data dir.
   */
  private async findSession(token: string | undefined): Promise<Record<string, unknown> | null> {
    if (!token) return null;
    const { results } = await this.facade.rawQuery('_Session', { where: { sessionToken: token }, limit: 1 });
    const session = results[0] || null;
    if (!session) return null;
    if (isSessionExpired(session)) {
      // Best-effort tidy: an expired row is dead weight and keeping it around
      // only invites a future reader to resolve it. A failed delete must not
      // turn "your session expired" into a 500.
      try {
        await this.facade.rawDelete('_Session', session.objectId as string);
      } catch {
        /* the row stays; it is still refused above */
      }
      return null;
    }
    return session;
  }

  /** Resolve the request's session token header to a user record, or throw 209. */
  async requireUser(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    const token = req.headers['x-parse-session-token'] as string | undefined;
    const session = await this.findSession(token);
    if (!session) {
      throw new HttpError(400, 'Invalid session token', 209);
    }
    try {
      return await this.facade.rawFetch('_User', session.userId as string);
    } catch {
      throw new HttpError(400, 'Invalid session token', 209);
    }
  }

  // ==========================================================================
  // Handlers
  // ==========================================================================

  async login(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await readJSONBody(req);
    const username = body.username as string;
    const password = body.password as string;
    if (!username || !password) {
      throw new HttpError(400, 'Invalid username/password.', 101);
    }

    const { results } = await this.facade.rawQuery('_User', { where: { username }, limit: 1 });
    const user = results[0];
    if (!user || !verifyPassword(password, user._hashed_password as string)) {
      // Parse answers 404 with code 101 for a failed login.
      throw new HttpError(404, 'Invalid username/password.', 101);
    }

    // BAK-002 login policy: a backend can require a verified email before
    // login. 205 mirrors Parse's own EMAIL_NOT_FOUND-family numbering
    // (distinct from the 209 session-invalid code the client branches on).
    if (this.emailConfig && this.emailConfig.config.verification.requireForLogin && !user.emailVerified) {
      throw new HttpError(403, 'Please verify your email address before logging in.', 205);
    }

    const sessionToken = newSessionToken();
    await this.facade.rawCreate('_Session', { sessionToken, userId: user.objectId });

    const wire = await this.facade.wireRecord('_User', user);
    sendJSON(res, 200, { ...wire, sessionToken });
  }

  async logout(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const token = req.headers['x-parse-session-token'] as string | undefined;
    const session = await this.findSession(token);
    if (session) {
      await this.facade.rawDelete('_Session', session.objectId as string);
    }
    sendJSON(res, 200, {});
  }

  async signup(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await readJSONBody(req);
    const { username, password, ...rest } = body as Record<string, unknown> & {
      username?: string;
      password?: string;
    };
    if (!username) throw new HttpError(400, 'bad or missing username', 200);
    if (!password) throw new HttpError(400, 'password is required', 201);

    const { results } = await this.facade.rawQuery('_User', { where: { username }, limit: 1 });
    if (results.length > 0) {
      throw new HttpError(400, 'Account already exists for this username.', 202);
    }

    delete (rest as Record<string, unknown>).ACL;
    delete (rest as Record<string, unknown>)._method;
    const user = await this.facade.rawCreate('_User', {
      // ⚠️ **`emailVerified: false` is written here, and it is the close of a
      // defect BCN-006 could only half-fix from the client.**
      //
      // The column was absent from every response on this wire — `/users`,
      // `/login` and `/users/me` alike — because a password signup never wrote
      // it. So the `User` node's `emailVerified` output read `undefined` for
      // every account, and a graph doing `if (!user.emailVerified) show the
      // "please verify" banner` could not tell "not verified" from "this
      // backend does not track it". BCN-006 made the *client* default a
      // brand-new sign-up to `false`, which fixed the account it had just
      // created and nothing else: a user whose row predates that, or who signs
      // in on a fresh page load, still read `undefined`.
      //
      // Writing the column is the honest fix, because it makes the value a
      // fact rather than a client-side guess. It also matches what this server
      // already believes — `login` gates on `!user.emailVerified`, i.e. it has
      // been reading absent as false all along.
      //
      // `...rest` first, deliberately: a caller that supplies the field (an
      // admin-side import, say) outranks this default.
      emailVerified: false,
      ...rest,
      username,
      _hashed_password: hashPassword(password)
    });

    const sessionToken = newSessionToken();
    await this.facade.rawCreate('_Session', { sessionToken, userId: user.objectId });

    // BAK-002: opt-in verification email on signup. Best-effort and NEVER
    // fails the signup itself — an operator who enabled sendOnSignup without
    // finishing SMTP setup gets a loud server-log warning (Mailer.send's
    // notConfiguredReason), not a broken signup flow. If requireForLogin is
    // also on, the user simply can't log in until the operator fixes SMTP and
    // the user (re-)requests verification — a strong, visible nudge.
    if (this.emailConfig && this.emailConfig.config.verification.sendOnSignup && this.emailRoutes && user.email) {
      this.emailRoutes.sendVerificationEmail(user).catch((e) => safeLog('signup verification send failed:', e));
    }

    // Parse's signup response: objectId + createdAt + sessionToken. The client
    // merges its own username/properties over this, so keep it minimal.
    sendJSON(res, 201, { objectId: user.objectId, createdAt: user.createdAt, sessionToken });
  }

  async me(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const user = await this.requireUser(req);
    const wire = await this.facade.wireRecord('_User', user);
    // /users/me must echo the session token — the client stores this whole
    // response as its current user and reads sessionToken from it afterwards.
    sendJSON(res, 200, { ...wire, sessionToken: req.headers['x-parse-session-token'] });
  }

  async updateUser(req: http.IncomingMessage, res: http.ServerResponse, objectId: string): Promise<void> {
    const user = await this.requireUser(req);
    if (user.objectId !== objectId) {
      throw new HttpError(403, 'Cannot modify another user.', 206);
    }

    const body = await readJSONBody(req);
    delete body.ACL;
    delete body.objectId;
    delete body.sessionToken;
    delete body._hashed_password;
    const passwordChanged = typeof body.password === 'string' && body.password;
    if (passwordChanged) {
      body._hashed_password = hashPassword(body.password as string);
    }
    delete body.password;

    const updated = await this.facade.rawSave('_User', objectId, body);

    // A password change revokes every OTHER session for this user (the one
    // that authorized the change stays valid) — a stolen session must not
    // survive the victim rotating their password. Adversarial-suite item.
    if (passwordChanged) {
      const currentToken = req.headers['x-parse-session-token'] as string;
      const { results: sessions } = await this.facade.rawQuery('_Session', { where: { userId: objectId } });
      for (const session of sessions) {
        if (session.sessionToken !== currentToken) {
          await this.facade.rawDelete('_Session', session.objectId as string);
        }
      }
    }

    sendJSON(res, 200, { updatedAt: updated.updatedAt });
  }
}
