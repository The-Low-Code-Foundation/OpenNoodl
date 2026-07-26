/**
 * BAK-004 — the GitHub adapter, against a local stand-in for GitHub's API.
 *
 * GitHub is the one provider whose endpoints are hard-coded (it has no
 * discovery document), so without the `GITHUB_ENDPOINTS` seam it would also be
 * the one provider never exercised. It is the provider MOST worth exercising:
 * every one of its three quirks — a failed exchange arriving as HTTP 200, the
 * mandatory User-Agent, and the email living behind a second call — is a place
 * where the obvious implementation is wrong.
 *
 * The stand-in enforces those quirks rather than tolerating them, so a
 * regression that drops the User-Agent or stops checking the `error` field
 * fails here instead of in production.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import { AuthSpecBody, identitiesOf, sessionHeader } from './helpers/http';
import { BackendService } from '../src/service';
import { GITHUB_ENDPOINTS, selectGithubEmail } from '../src/auth/github';

jest.setTimeout(30000);

const APP_ORIGIN = 'https://app.example.test';

describe('BAK-004 GitHub adapter — email selection', () => {
  it('prefers a verified primary address', () => {
    expect(
      selectGithubEmail(
        [
          { email: 'Old@Example.com', primary: false, verified: true },
          { email: 'Primary@Example.com', primary: true, verified: true }
        ],
        null
      )
    ).toEqual({ email: 'primary@example.com', verified: true });
  });

  it('prefers a VERIFIED non-primary over an UNVERIFIED primary — verified is the security property', () => {
    expect(
      selectGithubEmail(
        [
          { email: 'unverified@example.com', primary: true, verified: false },
          { email: 'verified@example.com', primary: false, verified: true }
        ],
        null
      )
    ).toEqual({ email: 'verified@example.com', verified: true });
  });

  it('falls back to an unverified primary, reported honestly as unverified', () => {
    expect(selectGithubEmail([{ email: 'only@example.com', primary: true, verified: false }], null)).toEqual({
      email: 'only@example.com',
      verified: false
    });
  });

  it('falls back to the public profile address when /user/emails is empty', () => {
    expect(selectGithubEmail([], 'Public@Example.com')).toEqual({ email: 'public@example.com', verified: false });
  });

  it('reports no address at all rather than inventing one', () => {
    expect(selectGithubEmail([], null)).toEqual({ email: null, verified: false });
  });
});

describe('BAK-004 GitHub sign-in over HTTP', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let github: http.Server;
  let githubOrigin: string;
  const original = { ...GITHUB_ENDPOINTS };

  /** What the stand-in should answer next. */
  const state = {
    tokenError: null as string | null,
    userAgentSeen: [] as (string | undefined)[],
    user: { id: 4242, login: 'octocat', name: 'The Octocat', email: null as string | null },
    emails: [{ email: 'octocat@example.com', primary: true, verified: true }] as {
      email: string;
      primary: boolean;
      verified: boolean;
    }[],
    emailsStatus: 200
  };

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

  beforeAll(async () => {
    github = http.createServer((request, response) => {
      const url = new URL(request.url || '/', 'http://gh.local');
      state.userAgentSeen.push(request.headers['user-agent']);
      const send = (status: number, body: unknown) => {
        const text = JSON.stringify(body);
        response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
        response.end(text);
      };

      // Fact 2: GitHub 403s a request with no User-Agent. Enforced, so a
      // regression that drops the header fails here.
      if (!request.headers['user-agent']) {
        send(403, { message: 'Request forbidden by administrative rules. Please make sure your request has a User-Agent header.' });
        return;
      }

      if (url.pathname === '/login/oauth/access_token') {
        // Fact 1: the failure is an HTTP 200 carrying an `error` field.
        if (state.tokenError) {
          send(200, { error: state.tokenError, error_description: 'the code passed is incorrect or expired' });
          return;
        }
        send(200, { access_token: 'gho_faketoken', token_type: 'bearer', scope: 'read:user,user:email' });
        return;
      }
      if (url.pathname === '/user') {
        send(200, state.user);
        return;
      }
      if (url.pathname === '/user/emails') {
        // Fact 3: without `user:email`, this is a 403 rather than an empty list.
        if (state.emailsStatus !== 200) {
          send(state.emailsStatus, { message: 'Requires authentication' });
          return;
        }
        send(200, state.emails);
        return;
      }
      send(404, { message: 'Not Found' });
    });
    await new Promise<void>((resolve) => github.listen(0, '127.0.0.1', () => resolve()));
    const address = github.address();
    githubOrigin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

    GITHUB_ENDPOINTS.authorize = `${githubOrigin}/login/oauth/authorize`;
    GITHUB_ENDPOINTS.token = `${githubOrigin}/login/oauth/access_token`;
    GITHUB_ENDPOINTS.user = `${githubOrigin}/user`;
    GITHUB_ENDPOINTS.emails = `${githubOrigin}/user/emails`;

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak004-gh-'));
    fs.writeFileSync(path.join(dataDir, 'ops.json'), JSON.stringify({ version: 1, rateLimit: { enabled: false } }));
    service = new BackendService({ dataDir, port: 0, backendId: 'gh', backendName: 'GH', authToken: 'admin-token' });
    const started = await service.start();
    base = started.listen.url;
    const admin = { authorization: 'Bearer admin-token' };

    await req('PUT', '/admin/email/config', { baseUrl: base }, admin);
    const put = await req('PUT', '/admin/auth/providers/github', {
      preset: 'github',
      enabled: true,
      clientId: 'Iv1.fakeclientid',
      clientSecret: 'fake-client-secret'
    }, admin);
    expect(put.status).toBe(200);
    expect(put.json.provider?.kind).toBe('github');
    expect(put.json.provider?.scopes).toEqual(['read:user', 'user:email']);
    await req('PUT', '/admin/auth', { redirectAllowList: [APP_ORIGIN] }, admin);
  });

  afterAll(async () => {
    Object.assign(GITHUB_ENDPOINTS, original);
    await service.stop();
    await new Promise<void>((resolve) => github.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  async function signIn() {
    const start = await req('GET', `/oauth/github/start?redirect=${encodeURIComponent(`${APP_ORIGIN}/done`)}`);
    expect(start.status).toBe(302);
    const url = new URL(start.location as string);
    const cookie = (start.setCookie as string).split(';')[0];
    return req(
      'GET',
      `/oauth/github/callback?code=fake-code&state=${encodeURIComponent(url.searchParams.get('state') as string)}`,
      undefined,
      { cookie }
    );
  }

  it('builds an authorization URL with state and no PKCE (GitHub does not implement it)', async () => {
    const start = await req('GET', '/oauth/github/start');
    expect(start.status).toBe(302);
    const url = new URL(start.location as string);
    expect(url.origin).toBe(githubOrigin);
    expect(url.searchParams.get('client_id')).toBe('Iv1.fakeclientid');
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeNull();
  });

  it('signs in end to end, keying the account on the numeric GitHub id', async () => {
    state.userAgentSeen.length = 0;
    const callback = await signIn();
    expect(callback.status).toBe(302);
    const handoff = new URL(callback.location as string).searchParams.get('nodegx_auth');
    const exchange = await req('POST', '/oauth/exchange', { code: handoff });

    expect(exchange.status).toBe(200);
    expect(exchange.json.authOutcome).toBe('created');
    expect(exchange.json.email).toBe('octocat@example.com');
    expect(exchange.json.emailVerified).toBe(true);

    // Every call carried a User-Agent (fact 2) — the stand-in 403s otherwise,
    // so this also proves the calls reached it.
    expect(state.userAgentSeen.length).toBeGreaterThanOrEqual(3);
    expect(state.userAgentSeen.every((ua) => Boolean(ua))).toBe(true);

    // The subject is namespaced by kind so a numeric GitHub id can never
    // collide with an OIDC `sub` of the same digits.
    const identities = await req('GET', '/users/me/identities', undefined, sessionHeader(exchange.json));
    expect(identitiesOf(identities.json)[0].provider).toBe('github');
  });

  it('treats an HTTP 200 carrying an `error` field as the failure it is', async () => {
    state.tokenError = 'bad_verification_code';
    try {
      const callback = await signIn();
      expect(callback.status).toBe(302);
      const location = new URL(callback.location as string);
      expect(location.searchParams.get('nodegx_auth')).toBeNull();
      expect(location.searchParams.get('nodegx_auth_error')).toMatch(/could not be completed/i);
    } finally {
      state.tokenError = null;
    }
  });

  it('refuses rather than proceeding email-less when /user/emails is forbidden (missing user:email scope)', async () => {
    state.emailsStatus = 403;
    try {
      const callback = await signIn();
      const location = new URL(callback.location as string);
      expect(location.searchParams.get('nodegx_auth')).toBeNull();
      expect(location.searchParams.get('nodegx_auth_error')).toBeTruthy();
    } finally {
      state.emailsStatus = 200;
    }
  });

  it('an UNVERIFIED GitHub address does not link to an existing account', async () => {
    await req('POST', '/users', { username: 'ghvictim', email: 'ghvictim@example.com', password: 'pw' });
    state.user = { id: 9999, login: 'impostor', name: 'Impostor', email: null };
    state.emails = [{ email: 'ghvictim@example.com', primary: true, verified: false }];
    try {
      const callback = await signIn();
      const location = new URL(callback.location as string);
      expect(location.searchParams.get('nodegx_auth')).toBeNull();
      expect(location.searchParams.get('nodegx_auth_error')).toMatch(/did not confirm/i);
    } finally {
      state.user = { id: 4242, login: 'octocat', name: 'The Octocat', email: null };
      state.emails = [{ email: 'octocat@example.com', primary: true, verified: true }];
    }
  });
});
