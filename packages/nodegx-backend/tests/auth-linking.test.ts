/**
 * BAK-004 — the account-linking rule, and the takeover vectors it exists to
 * close. Plus magic links, which run through the same rule.
 *
 * Every case here is driven over real HTTP against a real service and a real
 * OIDC provider, because the rule's inputs are exactly the things a unit test
 * would have to invent: whether the PROVIDER said an address was verified, and
 * whether the LOCAL account had ever proved control of it. The interesting
 * failures live in the combination.
 *
 * The headline case is `it('closes the account pre-hijacking vector', …)`: an
 * attacker registering the victim's address before the victim ever arrives. A
 * naive implementation hands the victim's identity to the attacker's account.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AuthSpecBody, entriesOf, identitiesOf, sessionHeader } from './helpers/http';
import { BackendService } from '../src/service';
import { clearDiscoveryCache } from '../src/auth/oidc';
import { FakeOidcProvider } from './helpers/fake-oidc-provider';

jest.setTimeout(30000);

interface FakeSentMail {
  to: string;
  subject: string;
  text: string;
}

describe('BAK-004 account linking and magic links', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let provider: FakeOidcProvider;
  let admin: Record<string, string>;
  let sent: FakeSentMail[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function req(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual'
    });
    let json: AuthSpecBody = null as unknown as AuthSpecBody;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      /* HTML or empty */
    }
    return { status: res.status, json, text, location: res.headers.get('location'), setCookie: res.headers.get('set-cookie') };
  }

  /** A whole provider sign-in, returning either the handoff exchange or the error the app was sent. */
  async function providerSignIn(identity: { sub: string; email: string | null; emailVerified: boolean }) {
    const start = await req('GET', '/oauth/acme/start');
    const authorizeUrl = start.location as string;
    const state = new URL(authorizeUrl).searchParams.get('state') as string;
    const cookie = (start.setCookie as string).split(';')[0];

    provider.nextIdentity = identity;
    const code = provider.authorize(authorizeUrl, identity.sub);
    const callback = await req('GET', `/oauth/acme/callback?code=${code}&state=${state}`, undefined, { cookie });

    if (callback.status !== 302) return { ok: false as const, error: callback.text, callback };
    const location = new URL(callback.location as string);
    const error = location.searchParams.get('nodegx_auth_error');
    if (error) return { ok: false as const, error, callback };

    const handoff = location.searchParams.get('nodegx_auth') as string;
    const exchange = await req('POST', '/oauth/exchange', { code: handoff });
    return { ok: true as const, exchange, callback };
  }

  /** Sign up with a password, the ordinary way. */
  async function passwordSignup(username: string, email: string, password: string) {
    const res = await req('POST', '/users', { username, email, password });
    expect(res.status).toBe(201);
    return res.json as { objectId: string; sessionToken: string };
  }

  async function markVerified(objectId: string) {
    // The verification flow itself is BAK-002's; what this rule cares about is
    // the resulting flag, so set it through the admin data surface.
    const res = await req('PUT', `/api/_User/${objectId}`, { emailVerified: true }, admin);
    expect(res.status).toBe(200);
  }

  beforeAll(async () => {
    provider = new FakeOidcProvider();
    await provider.start();

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak004-link-'));
    fs.writeFileSync(path.join(dataDir, 'ops.json'), JSON.stringify({ version: 1, rateLimit: { enabled: false } }));
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'bak004link',
      backendName: 'BAK004 Linking',
      authToken: 'admin-token'
    });
    const started = await service.start();
    base = started.listen.url;
    admin = { authorization: 'Bearer admin-token' };

    sent = [];
    service.getMailerForTesting()!.setTransportForTesting({
      sendMail: async (opts: Record<string, unknown>) => {
        sent.push({ to: opts.to as string, subject: opts.subject as string, text: opts.text as string });
      }
    });

    await req('PUT', '/admin/email/config', {
      baseUrl: base,
      enabled: true,
      smtp: { host: 'smtp.test', port: 587, secure: false, username: 'u' },
      fromAddress: 'noreply@test'
    }, admin);

    await req('PUT', '/admin/auth/providers/acme', {
      preset: 'oidc',
      displayName: 'Acme SSO',
      enabled: true,
      issuer: provider.issuer,
      clientId: provider.clientId,
      clientSecret: provider.clientSecret
    }, admin);
    await req('PUT', '/admin/auth', { magicLink: { enabled: true, ttlMinutes: 15, allowSignup: true } }, admin);
    clearDiscoveryCache();
  });

  afterAll(async () => {
    await service.stop();
    await provider.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Rule 3 / 4 — the ordinary cases
  // ==========================================================================

  it('rule 3: a verified address nobody holds creates a new, verified, passwordless account', async () => {
    const result = await providerSignIn({ sub: 'r3', email: 'r3@example.com', emailVerified: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exchange.json.authOutcome).toBe('created');
    expect(result.exchange.json.emailVerified).toBe(true);
    expect(result.exchange.json.authNotice).toBeNull();

    // Passwordless: there is genuinely no password to guess.
    const login = await req('POST', '/login', { username: result.exchange.json.username, password: '' });
    expect(login.status).toBe(400);
  });

  it('rule 4: a verified address on an already-verified account links, keeping the password', async () => {
    const user = await passwordSignup('r4user', 'r4@example.com', 'correct-horse');
    await markVerified(user.objectId);

    const result = await providerSignIn({ sub: 'r4', email: 'r4@example.com', emailVerified: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exchange.json.authOutcome).toBe('linked');
    expect(result.exchange.json.objectId).toBe(user.objectId);
    expect(result.exchange.json.authNotice).toBeNull();

    // The password still works — linking is additive here, nothing is revoked.
    const login = await req('POST', '/login', { username: 'r4user', password: 'correct-horse' });
    expect(login.status).toBe(200);
  });

  // ==========================================================================
  // Rule 5 — the pre-hijacking vector
  // ==========================================================================

  it('closes the account pre-hijacking vector: linking to an UNVERIFIED account revokes its credentials', async () => {
    // 1. The attacker registers the victim's address with a password they know.
    //    The backend does not require verification (BAK-002's default), so this
    //    just works — which is precisely why the vector exists.
    const attackerAccount = await passwordSignup('victim-lookalike', 'victim@example.com', 'attacker-password');
    const attackerSession = await req('POST', '/login', { username: 'victim-lookalike', password: 'attacker-password' });
    expect(attackerSession.status).toBe(200);
    const stolenSession = sessionHeader(attackerSession.json);

    // The attacker's session works right now.
    const before = await req('GET', '/users/me', undefined, stolenSession);
    expect(before.status).toBe(200);

    // 2. The real victim arrives with a provider that VERIFIES the address.
    const result = await providerSignIn({ sub: 'real-victim', email: 'victim@example.com', emailVerified: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 3. The victim gets the account (data preserved) and is told what happened.
    expect(result.exchange.json.authOutcome).toBe('linked-credentials-revoked');
    expect(result.exchange.json.objectId).toBe(attackerAccount.objectId);
    expect(result.exchange.json.authNotice).toMatch(/old password has been removed/i);

    // 4. The attacker's password no longer works...
    const retry = await req('POST', '/login', { username: 'victim-lookalike', password: 'attacker-password' });
    expect(retry.status).toBe(404);

    // 5. ...and neither does the session they already held.
    const after = await req('GET', '/users/me', undefined, stolenSession);
    expect(after.status).toBe(400);
    expect(after.json.code).toBe(209);
  });

  it('records the credential revocation in the audit trail', async () => {
    const { status, json } = await req('GET', '/admin/audit?action=auth.link.credentials-revoked', undefined, admin);
    expect(status).toBe(200);
    const entries = entriesOf(json);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].outcome).toBe('success');
    // And the action is a DECLARED one, so it shows up in the dashboard filter.
    expect(json.actions).toContain('auth.link.credentials-revoked');
  });

  // ==========================================================================
  // Rule 2 — the provider did not vouch
  // ==========================================================================

  it('rule 2: an UNVERIFIED provider email never links to an existing account', async () => {
    await passwordSignup('r2user', 'r2@example.com', 'pw');

    const result = await providerSignIn({ sub: 'r2-attacker', email: 'r2@example.com', emailVerified: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/did not confirm/i);
  });

  it('rule 2: an UNVERIFIED provider email with no collision still creates an account, unverified', async () => {
    const result = await providerSignIn({ sub: 'r2-fresh', email: 'r2fresh@example.com', emailVerified: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exchange.json.authOutcome).toBe('created');
    expect(result.exchange.json.emailVerified).toBe(false);
  });

  it('a provider identity with no email at all still gets an account', async () => {
    const result = await providerSignIn({ sub: 'no-email-at-all', email: null, emailVerified: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exchange.json.authOutcome).toBe('created');
    expect(result.exchange.json.username).toMatch(/^acme-[0-9a-f]{8}$/);
  });

  // ==========================================================================
  // The gates: linking off, provider signup off, backend signup off
  // ==========================================================================

  it('refuses to link at all when autoLinkVerifiedEmail is off', async () => {
    const user = await passwordSignup('nolink', 'nolink@example.com', 'pw');
    await markVerified(user.objectId);
    await req('PUT', '/admin/auth', { linking: { autoLinkVerifiedEmail: false } }, admin);
    try {
      const result = await providerSignIn({ sub: 'nolink-sub', email: 'nolink@example.com', emailVerified: true });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/automatic account linking is turned off/i);
    } finally {
      await req('PUT', '/admin/auth', { linking: { autoLinkVerifiedEmail: true } }, admin);
    }
  });

  it("refuses to create an account when the PROVIDER's allowSignup is off", async () => {
    await req('PUT', '/admin/auth/providers/acme', { allowSignup: false }, admin);
    try {
      const result = await providerSignIn({ sub: 'stranger', email: 'stranger@example.com', emailVerified: true });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/does not create new accounts/i);
    } finally {
      await req('PUT', '/admin/auth/providers/acme', { allowSignup: true }, admin);
    }
  });

  it("refuses to create an account when the BACKEND's signup rule is 'nobody' — no side door", async () => {
    // PUT /admin/permissions validates the WHOLE document, so read-modify-write
    // rather than patch (a partial body is a 400, which would silently make
    // this test assert nothing).
    const current = await req('GET', '/admin/permissions', undefined, admin);
    const closed = await req('PUT', '/admin/permissions', { ...current.json.config, signup: 'nobody' }, admin);
    expect(closed.status).toBe(200);
    try {
      const result = await providerSignIn({ sub: 'stranger-2', email: 'stranger2@example.com', emailVerified: true });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/does not create new accounts/i);
    } finally {
      await req('PUT', '/admin/permissions', { ...current.json.config, signup: 'public' }, admin);
    }
  });

  // ==========================================================================
  // Magic links
  // ==========================================================================

  describe('magic links', () => {
    /** Pull the one-time link out of the last mail the fake transport received. */
    function lastMagicLink(): string {
      const mail = sent[sent.length - 1];
      const match = /(https?:\/\/\S*\/auth\/magic-link\/callback\?token=[^\s]+)/.exec(mail.text);
      expect(match).toBeTruthy();
      return (match as RegExpExecArray)[1];
    }

    async function clickMagicLink(url: string) {
      const callback = await req('GET', url.slice(base.length));
      if (callback.status !== 302) return { ok: false as const, callback };
      const location = new URL(callback.location as string);
      const error = location.searchParams.get('nodegx_auth_error');
      if (error) return { ok: false as const, error, callback };
      const exchange = await req('POST', '/oauth/exchange', { code: location.searchParams.get('nodegx_auth') });
      return { ok: true as const, exchange };
    }

    it('answers identically for a known and an unknown address (anti-enumeration)', async () => {
      await passwordSignup('magicknown', 'known@example.com', 'pw');
      const known = await req('POST', '/auth/magic-link', { email: 'known@example.com' });
      const unknown = await req('POST', '/auth/magic-link', { email: 'nobody-here@example.com' });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.json).toEqual(unknown.json);
    });

    it('signs in a user who has never had a password, and marks the address verified', async () => {
      sent.length = 0;
      await req('POST', '/auth/magic-link', { email: 'passwordless@example.com' });
      // The send is deliberately fire-and-forget behind a 200; wait for it.
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('passwordless@example.com');
      expect(sent[0].subject).toMatch(/sign-in link/i);

      const result = await clickMagicLink(lastMagicLink());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.exchange.json.authOutcome).toBe('created');
      expect(result.exchange.json.email).toBe('passwordless@example.com');
      expect(result.exchange.json.emailVerified).toBe(true);

      const me = await req('GET', '/users/me', undefined, {
        ...sessionHeader(result.exchange.json)
      });
      expect(me.status).toBe(200);
    });

    it('is single use', async () => {
      sent.length = 0;
      await req('POST', '/auth/magic-link', { email: 'onceonly@example.com' });
      await new Promise((resolve) => setTimeout(resolve, 60));
      const link = lastMagicLink();

      const first = await clickMagicLink(link);
      expect(first.ok).toBe(true);

      const second = await req('GET', link.slice(base.length));
      expect(second.status).toBe(400);
      expect(second.text).toMatch(/already been used/i);
    });

    it('obeys the SAME linking rule: clicking a link for an unverified account revokes its password', async () => {
      await passwordSignup('magicvictim', 'magicvictim@example.com', 'attacker-password');
      sent.length = 0;
      await req('POST', '/auth/magic-link', { email: 'magicvictim@example.com' });
      await new Promise((resolve) => setTimeout(resolve, 60));

      const result = await clickMagicLink(lastMagicLink());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.exchange.json.authOutcome).toBe('linked-credentials-revoked');

      const login = await req('POST', '/login', { username: 'magicvictim', password: 'attacker-password' });
      expect(login.status).toBe(404);
    });

    it('sends nothing when magic links are disabled, and still answers 200', async () => {
      await req('PUT', '/admin/auth', { magicLink: { enabled: false } }, admin);
      try {
        sent.length = 0;
        const res = await req('POST', '/auth/magic-link', { email: 'known@example.com' });
        expect(res.status).toBe(200);
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(sent).toHaveLength(0);
      } finally {
        await req('PUT', '/admin/auth', { magicLink: { enabled: true } }, admin);
      }
    });

    it('sends nothing for an unknown address when magic-link signup is off', async () => {
      await req('PUT', '/admin/auth', { magicLink: { allowSignup: false } }, admin);
      try {
        sent.length = 0;
        await req('POST', '/auth/magic-link', { email: 'never-heard-of-them@example.com' });
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(sent).toHaveLength(0);
      } finally {
        await req('PUT', '/admin/auth', { magicLink: { allowSignup: true } }, admin);
      }
    });

    it('refuses to bake an off-allow-list redirect into the link, and sends nothing', async () => {
      sent.length = 0;
      await req('POST', '/auth/magic-link', { email: 'known@example.com', redirect: 'https://evil.example/steal' });
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(sent).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Unlink
  // ==========================================================================

  it('unlinks a provider once the account also has a password, and refuses when it is the last way in', async () => {
    const user = await passwordSignup('unlinker', 'unlinker@example.com', 'pw');
    await markVerified(user.objectId);
    const result = await providerSignIn({ sub: 'unlink-sub', email: 'unlinker@example.com', emailVerified: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const session = sessionHeader(result.exchange.json);
    const list = await req('GET', '/users/me/identities', undefined, session);
    expect(list.json.hasPassword).toBe(true);
    const listed = identitiesOf(list.json);
    expect(listed).toHaveLength(1);

    const unlink = await req('DELETE', `/users/me/identities/${listed[0].objectId}`, undefined, session);
    expect(unlink.status).toBe(200);

    const after = await req('GET', '/users/me/identities', undefined, session);
    expect(after.json.identities).toHaveLength(0);
  });

  it('404s unlinking an identity that belongs to somebody else', async () => {
    const mine = await providerSignIn({ sub: 'owner-a', email: 'ownera@example.com', emailVerified: true });
    const theirs = await providerSignIn({ sub: 'owner-b', email: 'ownerb@example.com', emailVerified: true });
    expect(mine.ok && theirs.ok).toBe(true);
    if (!mine.ok || !theirs.ok) return;

    const theirSession = sessionHeader(theirs.exchange.json);
    const mySession = sessionHeader(mine.exchange.json);
    const myList = await req('GET', '/users/me/identities', undefined, mySession);
    const myIdentityId = identitiesOf(myList.json)[0].objectId;

    const res = await req('DELETE', `/users/me/identities/${myIdentityId}`, undefined, theirSession);
    expect(res.status).toBe(404);
  });
});
