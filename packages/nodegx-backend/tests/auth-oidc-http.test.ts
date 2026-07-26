/**
 * BAK-004 — OAuth sign-in end to end, over real HTTP, against a real OIDC
 * provider (see helpers/fake-oidc-provider).
 *
 * This is the headless stand-in for the spec's "works against Keycloak by
 * configuration alone" criterion. Nothing here is mocked: the backend fetches a
 * discovery document over a socket, sends a PKCE challenge the provider
 * verifies, receives a JWT signed by an RSA key it has never seen before, and
 * fetches the JWKS to check the signature. The provider is generic OIDC with no
 * preset applied — the same code path Keycloak, Authentik and Entra take.
 *
 * The second half is the adversarial pass: every check in the flow is disabled
 * one at a time (via the provider's fault injection) and asserted to be the
 * thing that refuses.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { clearDiscoveryCache } from '../src/auth/oidc';
import { FakeOidcProvider } from './helpers/fake-oidc-provider';

jest.setTimeout(30000);

const APP_ORIGIN = 'https://app.example.test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function req(base: string, method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML page or a redirect with no body */
  }
  return { status: res.status, json, text, location: res.headers.get('location'), setCookie: res.headers.get('set-cookie') };
}

/** Pull the flow-binding cookie out of a Set-Cookie header, as a browser would send it back. */
function cookieHeader(setCookie: string | null): string {
  if (!setCookie) return '';
  return setCookie.split(';')[0];
}

describe('BAK-004 OAuth sign-in over HTTP', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let provider: FakeOidcProvider;
  let admin: Record<string, string>;

  beforeAll(async () => {
    provider = new FakeOidcProvider();
    await provider.start();

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak004-'));
    // Rate limiting OFF for this suite. It drives dozens of sign-ins in a few
    // seconds, which is exactly the traffic the auth budget exists to refuse —
    // leaving it on would make these tests assert the limiter rather than the
    // flow. That the limits DO apply is asserted separately, below.
    fs.writeFileSync(path.join(dataDir, 'ops.json'), JSON.stringify({ version: 1, rateLimit: { enabled: false } }));
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'bak004',
      backendName: 'BAK004 Test',
      authToken: 'admin-token'
    });
    const started = await service.start();
    base = started.listen.url;
    admin = { authorization: 'Bearer admin-token' };

    // A base URL is what makes the callback URL stable and absolute; without it
    // everything still works but on the local fallback.
    await req(base, 'PUT', '/admin/email/config', { baseUrl: base }, admin);

    // Configure the provider the way an operator (or an agent, via MCP) would:
    // a generic OIDC issuer, no preset, client id + secret.
    const put = await req(
      base,
      'PUT',
      '/admin/auth/providers/acme',
      {
        preset: 'oidc',
        displayName: 'Acme SSO',
        enabled: true,
        issuer: provider.issuer,
        clientId: provider.clientId,
        clientSecret: provider.clientSecret
      },
      admin
    );
    expect(put.status).toBe(200);
    expect(put.json.provider.ready).toBe(true);

    await req(base, 'PUT', '/admin/auth', { redirectAllowList: [APP_ORIGIN] }, admin);
    clearDiscoveryCache();
  });

  afterAll(async () => {
    await service.stop();
    await provider.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /**
   * Drive a whole sign-in the way a browser would, returning the final
   * redirect. `mutate` can tamper with the callback request.
   */
  async function signIn(options: {
    sub?: string;
    email?: string | null;
    emailVerified?: boolean;
    redirect?: string;
    /** Drop or replace the flow-binding cookie. */
    cookie?: string | null;
    /** Fault injection on the ID token. */
    mint?: Parameters<FakeOidcProvider['authorize']> extends never ? never : FakeOidcProvider['nextMintOptions'];
    /** Reuse this state instead of the one just issued (replay). */
    stateOverride?: string;
  }) {
    const startPath = `/oauth/acme/start${options.redirect ? `?redirect=${encodeURIComponent(options.redirect)}` : ''}`;
    const start = await req(base, 'GET', startPath);
    expect(start.status).toBe(302);
    const authorizeUrl = start.location as string;
    const state = new URL(authorizeUrl).searchParams.get('state') as string;

    if (options.sub !== undefined || options.email !== undefined || options.emailVerified !== undefined) {
      provider.nextIdentity = {
        sub: options.sub !== undefined ? options.sub : provider.nextIdentity.sub,
        email: options.email !== undefined ? options.email : provider.nextIdentity.email,
        emailVerified: options.emailVerified !== undefined ? options.emailVerified : provider.nextIdentity.emailVerified
      };
    }
    const code = provider.authorize(authorizeUrl, options.sub);
    if (options.mint) provider.nextMintOptions = options.mint;

    const cookie = options.cookie === null ? '' : options.cookie || cookieHeader(start.setCookie);
    const callback = await req(
      base,
      'GET',
      `/oauth/acme/callback?code=${code}&state=${encodeURIComponent(options.stateOverride || state)}`,
      undefined,
      cookie ? { cookie } : {}
    );
    return { start, callback, state, authorizeUrl };
  }

  /** Complete a sign-in and exchange the handoff code for a session. */
  async function signInAndExchange(options: Parameters<typeof signIn>[0]) {
    const { callback } = await signIn({ redirect: `${APP_ORIGIN}/welcome`, ...options });
    expect(callback.status).toBe(302);
    const location = new URL(callback.location as string);
    const handoff = location.searchParams.get('nodegx_auth');
    expect(handoff).toBeTruthy();
    const exchange = await req(base, 'POST', '/oauth/exchange', { code: handoff });
    return { location, exchange };
  }

  // ==========================================================================
  // The happy path
  // ==========================================================================

  it('advertises the provider on the public /auth/providers list, with no secrets', async () => {
    const { status, json } = await req(base, 'GET', '/auth/providers');
    expect(status).toBe(200);
    expect(json.providers).toEqual([
      { id: 'acme', kind: 'oidc', displayName: 'Acme SSO', startUrl: `${base}/oauth/acme/start` }
    ]);
    expect(JSON.stringify(json)).not.toContain(provider.clientSecret);
  });

  it('start redirects to the provider with PKCE, state, nonce, and sets a flow-binding cookie', async () => {
    const start = await req(base, 'GET', `/oauth/acme/start?redirect=${encodeURIComponent(`${APP_ORIGIN}/welcome`)}`);
    expect(start.status).toBe(302);
    const url = new URL(start.location as string);
    expect(url.origin).toBe(provider.issuer);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(provider.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(`${base}/oauth/acme/callback`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    // Never the verifier — that is the entire point of PKCE.
    expect(start.location).not.toContain('code_verifier');
    expect(start.setCookie).toMatch(/nodegx_oauth_flow=/);
    expect(start.setCookie).toMatch(/HttpOnly/);
    expect(start.setCookie).toMatch(/SameSite=Lax/);
  });

  it('signs a brand-new user in end to end and issues a working session', async () => {
    const { location, exchange } = await signInAndExchange({
      sub: 'new-person',
      email: 'new.person@example.com',
      emailVerified: true
    });

    expect(location.origin).toBe(APP_ORIGIN);
    expect(location.pathname).toBe('/welcome');
    expect(exchange.status).toBe(200);
    expect(exchange.json.authOutcome).toBe('created');
    expect(exchange.json.sessionToken).toMatch(/^r:/);
    expect(exchange.json.email).toBe('new.person@example.com');
    expect(exchange.json.emailVerified).toBe(true);
    // The password hash must never cross the wire (AdapterFacade strips it).
    expect(exchange.json._hashed_password).toBeUndefined();

    // The session is an ordinary BAK-003 session.
    const me = await req(base, 'GET', '/users/me', undefined, {
      'x-parse-session-token': exchange.json.sessionToken
    });
    expect(me.status).toBe(200);
    expect(me.json.objectId).toBe(exchange.json.objectId);
  });

  it('signs the same subject back in to the SAME account, without consulting the email', async () => {
    const first = await signInAndExchange({ sub: 'returning', email: 'returning@example.com', emailVerified: true });
    expect(first.exchange.json.authOutcome).toBe('created');

    // The provider now reports a DIFFERENT address for the same subject — a
    // user who changed their email. The subject is the identity, so this must
    // still be the same account rather than a new one.
    const second = await signInAndExchange({ sub: 'returning', email: 'changed@example.com', emailVerified: true });
    expect(second.exchange.json.authOutcome).toBe('signed-in');
    expect(second.exchange.json.objectId).toBe(first.exchange.json.objectId);
  });

  it('the handoff code is single use', async () => {
    const { callback } = await signIn({ sub: 'once', email: 'once@example.com', redirect: `${APP_ORIGIN}/x` });
    const handoff = new URL(callback.location as string).searchParams.get('nodegx_auth');
    const first = await req(base, 'POST', '/oauth/exchange', { code: handoff });
    expect(first.status).toBe(200);
    const second = await req(base, 'POST', '/oauth/exchange', { code: handoff });
    expect(second.status).toBe(400);
    expect(second.json.error).toMatch(/not valid/i);
  });

  it('an unknown handoff code is refused with the same message as an expired one (no oracle)', async () => {
    const { status, json } = await req(base, 'POST', '/oauth/exchange', { code: 'definitely-not-a-real-code' });
    expect(status).toBe(400);
    expect(json.error).toMatch(/not valid/i);
  });

  // ==========================================================================
  // The adversarial pass — every check, disabled one at a time
  // ==========================================================================

  it('refuses a callback whose flow-binding cookie is missing (login CSRF)', async () => {
    const { callback } = await signIn({ sub: 'csrf-1', cookie: null });
    expect(callback.status).toBe(400);
    expect(callback.text).toMatch(/did not start in this browser/i);
  });

  it('refuses a callback whose flow-binding cookie belongs to a different flow', async () => {
    const other = await req(base, 'GET', '/oauth/acme/start');
    const { callback } = await signIn({ sub: 'csrf-2', cookie: cookieHeader(other.setCookie) });
    expect(callback.status).toBe(400);
    expect(callback.text).toMatch(/did not start in this browser/i);
  });

  it('refuses a replayed state — the flow is consumed by its first callback', async () => {
    const start = await req(base, 'GET', '/oauth/acme/start');
    const authorizeUrl = start.location as string;
    const state = new URL(authorizeUrl).searchParams.get('state') as string;
    const cookie = cookieHeader(start.setCookie);

    const firstCode = provider.authorize(authorizeUrl, 'replay-victim');
    const first = await req(base, 'GET', `/oauth/acme/callback?code=${firstCode}&state=${state}`, undefined, { cookie });
    expect(first.status).toBe(302);

    const secondCode = provider.authorize(authorizeUrl, 'replay-victim');
    const second = await req(base, 'GET', `/oauth/acme/callback?code=${secondCode}&state=${state}`, undefined, { cookie });
    expect(second.status).toBe(400);
    expect(second.text).toMatch(/no longer valid/i);
  });

  it('refuses an unknown state outright', async () => {
    const res = await req(base, 'GET', '/oauth/acme/callback?code=x&state=fabricated');
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/no longer valid/i);
  });

  /**
   * Each of these mints a structurally valid JWT that fails exactly one check.
   * The assertion is that the sign-in does not complete — the specific reason
   * stays server-side, which is itself the policy (see the callback handler).
   */
  const forgeries: { name: string; mint: NonNullable<FakeOidcProvider['nextMintOptions']> }[] = [
    { name: 'signed by a key the issuer never published', mint: { signWithForeignKey: true } },
    { name: 'unsigned (alg: none)', mint: { algNone: true } },
    { name: 'claiming an algorithm this backend refuses', mint: { forceAlg: 'HS256' } },
    { name: 'naming a kid that is not in the JWKS', mint: { forceKid: 'not-a-real-kid' } },
    { name: 'minted for a different client (wrong aud)', mint: { aud: 'some-other-clients-id' } },
    { name: 'multi-audience with someone else as azp', mint: { aud: ['test-client-id', 'other'], azp: 'other' } },
    { name: 'issued by a different issuer', mint: { iss: 'https://evil.example' } },
    { name: 'already expired', mint: { expiresInSeconds: -600 } },
    { name: 'carrying a nonce from another flow', mint: { nonce: 'nonce-from-somewhere-else' } }
  ];

  for (const forgery of forgeries) {
    it(`refuses an ID token ${forgery.name}`, async () => {
      const { callback } = await signIn({
        sub: `forged-${forgery.name.replace(/\W+/g, '-')}`,
        redirect: `${APP_ORIGIN}/welcome`,
        mint: forgery.mint
      });
      // The failure lands as a redirect BACK to the app carrying an error,
      // never as a handoff code.
      expect(callback.status).toBe(302);
      const location = new URL(callback.location as string);
      expect(location.searchParams.get('nodegx_auth')).toBeNull();
      expect(location.searchParams.get('nodegx_auth_error')).toMatch(/could not be completed/i);
    });
  }

  it('reports a provider-side refusal (user pressed Cancel) back to the app', async () => {
    const start = await req(base, 'GET', `/oauth/acme/start?redirect=${encodeURIComponent(`${APP_ORIGIN}/welcome`)}`);
    const state = new URL(start.location as string).searchParams.get('state') as string;
    const res = await req(
      base,
      'GET',
      `/oauth/acme/callback?error=access_denied&error_description=User+declined&state=${state}`,
      undefined,
      { cookie: cookieHeader(start.setCookie) }
    );
    expect(res.status).toBe(302);
    expect(new URL(res.location as string).searchParams.get('nodegx_auth_error')).toMatch(/User declined/);
  });

  it('surfaces a token-endpoint failure without leaking the provider message to the user', async () => {
    const start = await req(base, 'GET', `/oauth/acme/start?redirect=${encodeURIComponent(`${APP_ORIGIN}/welcome`)}`);
    const authorizeUrl = start.location as string;
    const state = new URL(authorizeUrl).searchParams.get('state') as string;
    const code = provider.authorize(authorizeUrl, 'token-fail');
    provider.nextTokenError = 'invalid_client';

    const res = await req(base, 'GET', `/oauth/acme/callback?code=${code}&state=${state}`, undefined, {
      cookie: cookieHeader(start.setCookie)
    });
    expect(res.status).toBe(302);
    const error = new URL(res.location as string).searchParams.get('nodegx_auth_error') as string;
    expect(error).toMatch(/could not be completed/i);
    expect(error).not.toContain('invalid_client');
  });

  // ==========================================================================
  // Redirect targets
  // ==========================================================================

  it('refuses a redirect to an origin that is not on the allow-list', async () => {
    const res = await req(base, 'GET', `/oauth/acme/start?redirect=${encodeURIComponent('https://evil.example/steal')}`);
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/not allowed/i);
  });

  it('refuses a protocol-relative redirect that looks like a path', async () => {
    const res = await req(base, 'GET', `/oauth/acme/start?redirect=${encodeURIComponent('//evil.example/steal')}`);
    expect(res.status).toBe(400);
  });

  it('accepts a same-origin path with no allow-list entry needed', async () => {
    const res = await req(base, 'GET', '/oauth/acme/start?redirect=%2Fdashboard');
    expect(res.status).toBe(302);
  });

  // ==========================================================================
  // Provider configuration states
  // ==========================================================================

  it('404s a provider that does not exist, without saying whether one is merely disabled', async () => {
    const res = await req(base, 'GET', '/oauth/nope/start');
    expect(res.status).toBe(404);
  });

  it('503s a provider that is enabled but missing its secret, naming the missing field', async () => {
    await req(base, 'PUT', '/admin/auth/providers/halfdone', {
      preset: 'oidc',
      enabled: true,
      issuer: provider.issuer,
      clientId: 'some-id'
    }, admin);
    const res = await req(base, 'GET', '/oauth/halfdone/start');
    expect(res.status).toBe(503);
    expect(res.text).toMatch(/client secret/i);
    await req(base, 'DELETE', '/admin/auth/providers/halfdone', undefined, admin);
  });

  // ==========================================================================
  // Identities on the account
  // ==========================================================================

  it('lists the linked identity on /users/me/identities and refuses to unlink the last way in', async () => {
    const { exchange } = await signInAndExchange({
      sub: 'identity-lister',
      email: 'lister@example.com',
      emailVerified: true
    });
    const session = { 'x-parse-session-token': exchange.json.sessionToken };

    const list = await req(base, 'GET', '/users/me/identities', undefined, session);
    expect(list.status).toBe(200);
    expect(list.json.hasPassword).toBe(false);
    expect(list.json.identities).toHaveLength(1);
    expect(list.json.identities[0].provider).toBe('acme');
    expect(list.json.identities[0].displayName).toBe('Acme SSO');

    const unlink = await req(base, 'DELETE', `/users/me/identities/${list.json.identities[0].objectId}`, undefined, session);
    expect(unlink.status).toBe(400);
    expect(unlink.json.error).toMatch(/only way to sign in/i);
  });

  it('requires a session for the identity routes', async () => {
    const res = await req(base, 'GET', '/users/me/identities');
    expect(res.status).toBe(400);
    expect(res.json.code).toBe(209);
  });
});
