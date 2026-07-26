/**
 * Provider identities and the account-linking rule (BAK-004).
 *
 * This is the security core of the task. Everything else — discovery, PKCE,
 * signature verification — establishes *what the provider said*. This file
 * decides *which local account that entitles the visitor to*, and getting it
 * wrong is an account takeover rather than a bug.
 *
 * ## The model
 *
 * A `_UserIdentity` row is (provider, subject) → userId. The **subject** is the
 * provider's own immutable identifier, never the email: emails get reassigned,
 * corporate addresses get recycled between employees, and a provider that lets
 * a user change their address would otherwise silently move their account.
 * A user may hold several identities; that is the whole point of linking.
 *
 * ## The rule
 *
 * 1. **Known subject** → sign in as its user. No email is consulted; this is the
 *    only path that runs for a returning user, and it is unconditional.
 * 2. **Unknown subject, provider says the email is NOT verified** → the email is
 *    treated as decoration. Never matched against an existing account. Creates a
 *    new account if signup is allowed; refuses if an account already holds that
 *    address (see "why not a duplicate" below).
 * 3. **Unknown subject, provider says VERIFIED, no local account with that
 *    address** → create the account, mark it verified, link.
 * 4. **Unknown subject, VERIFIED, local account with that address, and that
 *    account's own `emailVerified` is true** → link. Both sides have proven
 *    control of the address; this is the ordinary "I signed up with a password
 *    last year and I'm using Google today" case.
 * 5. **Unknown subject, VERIFIED, local account with that address whose
 *    `emailVerified` is FALSE** → link, **and revoke that account's local
 *    credentials**: clear the password hash, delete every session, set
 *    `emailVerified`.
 *
 * Rule 5 is the interesting one, and it is deliberate. The attack it closes is
 * account pre-hijacking: an attacker signs up with `victim@example.com` and a
 * password of their choosing *before* the victim ever arrives. Later the victim
 * signs in with Google, the provider verifies the address, and a naive
 * implementation cheerfully links the victim's identity onto the attacker's
 * account — which the attacker can still log into with the password they set,
 * and now it contains the victim's data. Revoking the credentials of an
 * unverified account at the moment someone *proves* control of its address
 * hands the account to the person who can actually receive its mail.
 *
 * The cost is real and is not hidden: an honest user who signed up with a
 * password on a backend that never verifies addresses (BAK-002's default) and
 * then signs in with a provider loses their password and must reset it. That is
 * the safe direction to be wrong in, it is reported in the response and in the
 * audit trail, and it happens exactly once per account.
 *
 * ## Why not just create a second account
 *
 * Because BAK-002's `/requestPasswordReset` resolves an address with
 * `findUserBy('email', …)` and takes the first row. Two accounts sharing an
 * address make password reset target an arbitrary one of them — a quiet,
 * permanent, extremely confusing failure. So a colliding address is refused
 * loudly instead, with a message that tells the visitor what to do.
 *
 * @module nodegx-backend/auth/identities
 */

import * as crypto from 'crypto';

import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { ProviderIdentity } from './oidc';
import type { SchemaManagerLike } from '../persistence/SchemaManagerLike';

export const IDENTITY_COLLECTION = '_UserIdentity';

/**
 * Read a boolean column honestly.
 *
 * SQLite has no boolean type. A field written as `true` comes back from the
 * adapter as the NUMBER `1`, so `record.emailVerified === true` is false for a
 * user who is, in fact, verified. That is a harmless-looking mistake almost
 * everywhere and a serious one here: it would send every already-verified
 * account down rule 5 and destroy its password. It was caught by the linking
 * tests before it shipped, which is the only reason this function has a comment
 * this long — the next person to compare a persisted flag with `=== true`
 * should find it.
 */
export function isFlagSet(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Created up front like `_Session`/`_EmailToken`: a `where` on a missing table is a SQL error. */
export function ensureIdentityTable(schemaManager: SchemaManagerLike | undefined): void {
  if (!schemaManager) return;
  schemaManager.createTable({
    name: IDENTITY_COLLECTION,
    columns: [
      { name: 'provider', type: 'String' },
      { name: 'subject', type: 'String' },
      { name: 'userId', type: 'String' },
      { name: 'email', type: 'String' },
      { name: 'emailVerified', type: 'Boolean' },
      { name: 'displayName', type: 'String' },
      { name: 'lastLoginAt', type: 'Date' }
    ]
  });
}

/** What `resolveSignIn` did. Reported to the caller, the audit trail, and the client. */
export type SignInOutcome =
  /** Rule 1 — a returning identity. */
  | 'signed-in'
  /** Rules 3 — a brand-new account. */
  | 'created'
  /** Rule 4 — joined an existing, email-verified account. */
  | 'linked'
  /** Rule 5 — joined an unverified account, whose password and sessions were revoked. */
  | 'linked-credentials-revoked';

export interface SignInResult {
  userId: string;
  outcome: SignInOutcome;
  /** A message the app should show the user when the outcome needs explaining (rule 5). */
  notice: string | null;
}

/** A refusal the visitor is meant to read — every message says what to do next. */
export class AuthLinkError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthLinkError';
    this.code = code;
  }
}

export interface IdentityRow {
  objectId: string;
  provider: string;
  subject: string;
  userId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface ResolveOptions {
  /** `linking.autoLinkVerifiedEmail` — when false, rules 4 and 5 never run. */
  autoLinkVerifiedEmail: boolean;
  /** May this flow create an account at all? The provider's `allowSignup` AND the backend's signup rule. */
  allowSignup: boolean;
  /** What the flow is called in refusal messages ("Google", "magic link"). */
  displayLabel: string;
}

export class IdentityStore {
  constructor(private readonly facade: AdapterFacade) {}

  async findBySubject(provider: string, subject: string): Promise<IdentityRow | null> {
    const { results } = await this.facade.rawQuery(IDENTITY_COLLECTION, {
      where: { provider, subject },
      limit: 1
    });
    return (results[0] as unknown as IdentityRow) || null;
  }

  async listForUser(userId: string): Promise<IdentityRow[]> {
    const { results } = await this.facade.rawQuery(IDENTITY_COLLECTION, { where: { userId } });
    return results as unknown as IdentityRow[];
  }

  private async findUserByEmail(email: string): Promise<Record<string, unknown> | null> {
    const { results } = await this.facade.rawQuery('_User', { where: { email }, limit: 1 });
    return results[0] || null;
  }

  private async findUserByUsername(username: string): Promise<Record<string, unknown> | null> {
    const { results } = await this.facade.rawQuery('_User', { where: { username }, limit: 1 });
    return results[0] || null;
  }

  /**
   * A unique `username` for an account nobody chose one for.
   *
   * Derived from the email local part (or the provider and a slice of the
   * subject hash when there is no address) and suffixed until it is free. The
   * subject itself never becomes a username: it is often a raw provider id and
   * would leak into any UI that shows usernames.
   */
  private async synthesizeUsername(identity: ProviderIdentity): Promise<string> {
    const fromEmail = identity.email ? identity.email.split('@')[0] : '';
    const base =
      (fromEmail || `${identity.providerId}-${crypto.createHash('sha256').update(identity.subject).digest('hex').slice(0, 8)}`)
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 24) || 'user';

    if (!(await this.findUserByUsername(base))) return base;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${base}-${crypto.randomBytes(3).toString('hex')}`;
      if (!(await this.findUserByUsername(candidate))) return candidate;
    }
    // Ten collisions on a 24-bit suffix is not bad luck; something is wrong.
    throw new AuthLinkError(
      'USERNAME_UNAVAILABLE',
      'Could not allocate a username for the new account after ten attempts. This should not happen — check the _User collection.'
    );
  }

  /** Record (or refresh) the identity row that maps this subject to this user. */
  private async writeIdentity(userId: string, identity: ProviderIdentity, existing: IdentityRow | null): Promise<void> {
    const fields = {
      provider: identity.providerId,
      subject: identity.subject,
      userId,
      email: identity.email,
      emailVerified: identity.emailVerified,
      displayName: identity.displayName,
      lastLoginAt: new Date().toISOString()
    };
    if (existing) await this.facade.rawSave(IDENTITY_COLLECTION, existing.objectId, fields);
    else await this.facade.rawCreate(IDENTITY_COLLECTION, fields);
  }

  /** Delete every `_Session` for a user. Shared by rule 5 and by unlink-driven revocation. */
  private async revokeAllSessions(userId: string): Promise<number> {
    const { results } = await this.facade.rawQuery('_Session', { where: { userId } });
    for (const session of results) {
      await this.facade.rawDelete('_Session', session.objectId as string);
    }
    return results.length;
  }

  /**
   * THE LINKING RULE. See the module doc for the numbered cases and the attack
   * each one closes; this function is that list, in order.
   */
  async resolveSignIn(identity: ProviderIdentity, options: ResolveOptions): Promise<SignInResult> {
    // ---- Rule 1: a subject we have seen before. -----------------------------
    const existing = await this.findBySubject(identity.providerId, identity.subject);
    if (existing) {
      // The user row can have been deleted out from under an identity. Treat
      // that as an unknown subject rather than signing in as a ghost.
      let user: Record<string, unknown> | null = null;
      try {
        user = await this.facade.rawFetch('_User', existing.userId);
      } catch {
        user = null;
      }
      if (user) {
        await this.writeIdentity(existing.userId, identity, existing);
        return { userId: existing.userId, outcome: 'signed-in', notice: null };
      }
      await this.facade.rawDelete(IDENTITY_COLLECTION, existing.objectId);
    }

    const email = identity.email;

    // ---- Rule 2: the provider did not vouch for the address. ----------------
    if (!identity.emailVerified) {
      if (email) {
        const collision = await this.findUserByEmail(email);
        if (collision) {
          throw new AuthLinkError(
            'EMAIL_NOT_VERIFIED_BY_PROVIDER',
            `${options.displayLabel} did not confirm that ${email} is verified, and an account already uses that ` +
              'address. Sign in to that account directly, or verify the address with your provider and try again. ' +
              '(Linking on an unverified address is how accounts get stolen, so this backend refuses it.)'
          );
        }
      }
      return this.createAccount(identity, options);
    }

    // ---- Rules 3–5: the provider vouched for the address. -------------------
    if (!email) {
      // "Verified" with no address is meaningless; fall through to creation.
      return this.createAccount(identity, options);
    }

    const match = await this.findUserByEmail(email);
    if (!match) return this.createAccount(identity, options);

    if (!options.autoLinkVerifiedEmail) {
      throw new AuthLinkError(
        'LINKING_DISABLED',
        `An account already uses ${email}, and automatic account linking is turned off on this backend ` +
          '(auth.json: linking.autoLinkVerifiedEmail). Sign in to that account directly.'
      );
    }

    const userId = match.objectId as string;

    // Rule 4 — both sides verified.
    if (isFlagSet(match.emailVerified)) {
      await this.writeIdentity(userId, identity, null);
      return { userId, outcome: 'linked', notice: null };
    }

    // Rule 5 — the local account never proved control of this address.
    await this.writeIdentity(userId, identity, null);
    await this.facade.rawSave('_User', userId, { _hashed_password: null, emailVerified: true });
    await this.revokeAllSessions(userId);
    return {
      userId,
      outcome: 'linked-credentials-revoked',
      notice:
        `An account for ${email} already existed but its address had never been verified. It has been linked to ` +
        `your ${options.displayLabel} sign-in, and its old password has been removed for safety. Use ` +
        `${options.displayLabel} to sign in from now on, or set a new password with "forgot password".`
    };
  }

  private async createAccount(identity: ProviderIdentity, options: ResolveOptions): Promise<SignInResult> {
    if (!options.allowSignup) {
      throw new AuthLinkError(
        'SIGNUP_NOT_ALLOWED',
        `This backend does not create new accounts from ${options.displayLabel} sign-ins. Ask an administrator ` +
          'to create your account first, then sign in again.'
      );
    }

    const username = await this.synthesizeUsername(identity);
    const user = await this.facade.rawCreate('_User', {
      username,
      email: identity.email,
      // A provider-verified address arrives verified; anything else does not.
      emailVerified: identity.emailVerified === true,
      // No password is set. `verifyPassword` refuses a null/absent hash, so the
      // account genuinely cannot be logged into with a password until the owner
      // sets one via password reset.
      _hashed_password: null,
      ...(identity.displayName ? { name: identity.displayName } : {})
    });

    await this.writeIdentity(user.objectId as string, identity, null);
    return { userId: user.objectId as string, outcome: 'created', notice: null };
  }

  /**
   * Remove one identity from a user.
   *
   * Refuses to leave an account with no way back in — an account with no
   * password and no remaining identity is unreachable, and "unlink" quietly
   * meaning "delete my access forever" is not an acceptable reading of that
   * button. The check is deliberately on the account's REAL state (does it have
   * a password hash) rather than on a flag.
   */
  async unlink(userId: string, identityId: string): Promise<void> {
    const identities = await this.listForUser(userId);
    const target = identities.find((i) => i.objectId === identityId);
    if (!target) {
      throw new AuthLinkError('IDENTITY_NOT_FOUND', 'No such linked sign-in method on this account.');
    }

    if (identities.length === 1) {
      const user = await this.facade.rawFetch('_User', userId);
      const hasPassword = typeof user._hashed_password === 'string' && user._hashed_password.length > 0;
      if (!hasPassword) {
        throw new AuthLinkError(
          'LAST_SIGN_IN_METHOD',
          'This is the only way to sign in to this account, so it cannot be removed. Set a password first ' +
            '(use "forgot password" to receive a link), then unlink.'
        );
      }
    }

    await this.facade.rawDelete(IDENTITY_COLLECTION, identityId);
  }
}
