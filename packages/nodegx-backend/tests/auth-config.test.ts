/**
 * BAK-004 — the pieces that are pure functions or pure file handling: redirect
 * authorisation, config validation, and where the client secret does and does
 * not go. Plus one live check that the auth rate limits actually bite (the
 * flow suites turn limiting off so they can drive dozens of sign-ins; this is
 * the test that says the budget is real).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AuthConfigState } from '../src/auth/AuthConfigState';
import { completeProvider, applyPreset, validateAuthConfig, PROVIDER_PRESETS } from '../src/auth/model';
import { resolveRedirect, withError, withHandoffCode } from '../src/auth/redirect';
import type { UpsertProviderResponse } from '../src/server/admin-auth';
import { BackendService } from '../src/service';

jest.setTimeout(30000);

const BASE = 'https://api.example.com';

describe('BAK-004 redirect authorisation', () => {
  const allowList = ['https://app.example.com', 'http://localhost:3000'];

  it('defaults to the backend origin when nothing is asked for', () => {
    expect(resolveRedirect(undefined, BASE, allowList)).toEqual({ ok: true, url: `${BASE}/` });
  });

  it('allows a same-origin path without any allow-list entry', () => {
    expect(resolveRedirect('/welcome?x=1', BASE, [])).toEqual({ ok: true, url: `${BASE}/welcome?x=1` });
  });

  it('allows an absolute URL whose origin is on the list, keeping path and query', () => {
    const decision = resolveRedirect('https://app.example.com/after?next=%2Fhome', BASE, allowList);
    expect(decision.ok).toBe(true);
    expect(decision.url).toBe('https://app.example.com/after?next=%2Fhome');
  });

  it('allows the backend origin spelled absolutely, list or no list', () => {
    expect(resolveRedirect(`${BASE}/somewhere`, BASE, []).ok).toBe(true);
  });

  /**
   * The one that matters. `//evil.example` LOOKS like a path — it starts with a
   * slash — and a check written as `startsWith('/')` sends the browser to
   * another origin with the sign-in result in tow.
   */
  it('refuses a protocol-relative URL masquerading as a path', () => {
    const decision = resolveRedirect('//evil.example/steal', BASE, allowList);
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/absolute http\(s\) URL/);
  });

  it('refuses an origin that is not on the list, naming the fix', () => {
    const decision = resolveRedirect('https://evil.example/steal', BASE, allowList);
    expect(decision.ok).toBe(false);
    expect(decision.reason).toContain('redirectAllowList');
  });

  it('matches by origin, so a look-alike host is not a match', () => {
    expect(resolveRedirect('https://app.example.com.evil.test/x', BASE, allowList).ok).toBe(false);
    expect(resolveRedirect('https://app.example.com:8443/x', BASE, allowList).ok).toBe(false);
    // ...and scheme is part of the origin.
    expect(resolveRedirect('http://app.example.com/x', BASE, allowList).ok).toBe(false);
  });

  it('refuses a non-http scheme outright', () => {
    expect(resolveRedirect('javascript:alert(1)', BASE, allowList).ok).toBe(false);
    expect(resolveRedirect('data:text/html,<script>', BASE, allowList).ok).toBe(false);
  });

  it('adds the handoff code and the error without disturbing existing query parameters', () => {
    expect(withHandoffCode('https://app.example.com/x?a=1', 'nodegx_auth', 'CODE')).toBe(
      'https://app.example.com/x?a=1&nodegx_auth=CODE'
    );
    expect(withError('https://app.example.com/x', 'nodegx_auth_error', 'no & yes')).toBe(
      'https://app.example.com/x?nodegx_auth_error=no+%26+yes'
    );
  });
});

describe('BAK-004 auth config validation', () => {
  function errorsFor(providers: unknown[]): string[] {
    return validateAuthConfig({ version: 1, providers });
  }

  it('accepts the default config', () => {
    expect(validateAuthConfig({ version: 1, providers: [] })).toEqual([]);
  });

  it('requires an issuer on an enabled OIDC provider', () => {
    expect(errorsFor([{ id: 'x', kind: 'oidc', enabled: true, scopes: ['openid'] }])).toContain(
      'providers[0].issuer is required for an enabled oidc provider'
    );
  });

  it('requires the openid scope on an OIDC provider', () => {
    const errors = errorsFor([{ id: 'x', kind: 'oidc', enabled: true, issuer: 'https://i.test', scopes: ['email'] }]);
    expect(errors).toContain('providers[0].scopes must include "openid" for an oidc provider');
  });

  it('refuses an issuer on a github provider — GitHub has no discovery document', () => {
    const errors = errorsFor([{ id: 'gh', kind: 'github', issuer: 'https://github.com' }]);
    expect(errors.join()).toMatch(/issuer must be empty/);
  });

  it('refuses a provider id that would collide with an /oauth route segment', () => {
    expect(errorsFor([{ id: 'exchange', kind: 'oidc', enabled: false }]).join()).toMatch(/reserved/);
  });

  it('refuses duplicate provider ids', () => {
    const errors = errorsFor([
      { id: 'dup', kind: 'oidc', enabled: false },
      { id: 'dup', kind: 'oidc', enabled: false }
    ]);
    expect(errors.join()).toMatch(/used more than once/);
  });

  it('refuses a provider id that is not a slug', () => {
    expect(errorsFor([{ id: 'Not A Slug', kind: 'oidc', enabled: false }]).join()).toMatch(/lowercase slug/);
  });

  it('caps the magic-link TTL — a long-lived link is a long-lived credential', () => {
    expect(validateAuthConfig({ magicLink: { ttlMinutes: 60 * 48 } }).join()).toMatch(/at most 1440/);
    expect(validateAuthConfig({ magicLink: { ttlMinutes: 0 } }).join()).toMatch(/positive number/);
  });

  it('requires redirect allow-list entries to be absolute origins', () => {
    expect(validateAuthConfig({ redirectAllowList: ['/relative'] }).join()).toMatch(/absolute http\(s\) origin/);
  });

  it('presets fill in the fields an operator should not have to know, and config still wins', () => {
    const google = completeProvider('google', applyPreset({ preset: 'google', clientId: 'abc' }));
    expect(google.kind).toBe('oidc');
    expect(google.issuer).toBe('https://accounts.google.com');
    expect(google.scopes).toEqual(['openid', 'email', 'profile']);

    const overridden = completeProvider('google', applyPreset({ preset: 'google', displayName: 'Work Google' }));
    expect(overridden.displayName).toBe('Work Google');
  });

  it('every preset produces a config that validates', () => {
    for (const [name, preset] of Object.entries(PROVIDER_PRESETS)) {
      const provider = completeProvider(name === 'oidc' ? 'sso' : name, applyPreset({ preset: name, clientId: 'id' }));
      // A generic-OIDC preset ships without an issuer by design, so enable only
      // the ones that have one; the rest are validated disabled.
      provider.enabled = Boolean(preset.issuer);
      expect(validateAuthConfig({ version: 1, providers: [provider] })).toEqual([]);
    }
  });
});

describe('BAK-004 client secrets never leave secrets.json', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak004-secret-'));
  });
  afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it('writes the secret to the auth namespace of secrets.json, never to auth.json', () => {
    const state = new AuthConfigState(dataDir);
    state.upsertProvider(completeProvider('google', applyPreset({ preset: 'google', clientId: 'cid', enabled: true })));
    state.setClientSecret('google', 'super-secret-value');

    const authJson = fs.readFileSync(path.join(dataDir, 'auth.json'), 'utf-8');
    expect(authJson).toContain('cid');
    expect(authJson).not.toContain('super-secret-value');

    const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    expect(secrets.auth['google.clientSecret']).toBe('super-secret-value');
  });

  it('preserves other subsystems\' namespaces in secrets.json', () => {
    fs.writeFileSync(
      path.join(dataDir, 'secrets.json'),
      JSON.stringify({ adminToken: 'keep-me', webhooks: { t1: 'hook-secret' }, email: { smtpPassword: 'smtp' } })
    );
    new AuthConfigState(dataDir).setClientSecret('google', 'oauth-secret');

    const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    expect(secrets.adminToken).toBe('keep-me');
    expect(secrets.webhooks.t1).toBe('hook-secret');
    expect(secrets.email.smtpPassword).toBe('smtp');
    expect(secrets.auth['google.clientSecret']).toBe('oauth-secret');
  });

  it('redacted() reports whether a secret exists but never what it is', () => {
    const state = new AuthConfigState(dataDir);
    state.upsertProvider(completeProvider('google', applyPreset({ preset: 'google', clientId: 'cid', enabled: true })));
    expect(state.redacted().providers[0].hasClientSecret).toBe(false);
    expect(state.redacted().providers[0].ready).toBe(false);
    expect(state.redacted().providers[0].notReadyReason).toMatch(/client secret/);

    state.setClientSecret('google', 'shhh');
    const after = state.redacted();
    expect(after.providers[0].hasClientSecret).toBe(true);
    expect(after.providers[0].ready).toBe(true);
    expect(JSON.stringify(after)).not.toContain('shhh');
  });

  it('deleting a provider forgets its secret', () => {
    const state = new AuthConfigState(dataDir);
    state.upsertProvider(completeProvider('gone', { kind: 'oidc', issuer: 'https://i.test', clientId: 'c' }));
    state.setClientSecret('gone', 'forget-me');
    expect(state.deleteProvider('gone')).toBe(true);

    const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    expect(secrets.auth['gone.clientSecret']).toBeUndefined();
  });

  it('refuses to start on a malformed auth.json rather than silently running with no providers', () => {
    fs.writeFileSync(path.join(dataDir, 'auth.json'), '{ not json');
    expect(() => new AuthConfigState(dataDir)).toThrow(/not valid JSON/);

    fs.writeFileSync(path.join(dataDir, 'auth.json'), JSON.stringify({ providers: [{ id: 'BAD ID' }] }));
    expect(() => new AuthConfigState(dataDir)).toThrow(/lowercase slug/);
  });
});

/**
 * The `--port 0` trap. Every test here, and the editor's own spawned backends,
 * ask for an ephemeral port; the local-URL fallback used to report the
 * REQUESTED port, so with no baseUrl configured every generated link said
 * `http://127.0.0.1:0`. Nothing crashed and no test noticed, because no test
 * had ever read a generated URL back on a port-0 backend. Found in BAK-004's
 * live pass; the bug pre-dated it (BAK-002's reset links had it too).
 */
describe('BAK-004 the local-URL fallback uses the port that was actually bound', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak004-port-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'p0', backendName: 'P0', authToken: 't' });
    base = (await service.start()).listen.url;
  });
  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('never reports port 0 in a callback URL', async () => {
    const res = await fetch(`${base}/admin/auth/providers/google`, {
      method: 'PUT',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      body: JSON.stringify({ preset: 'google', clientId: 'x', clientSecret: 'y', enabled: true })
    });
    const json = (await res.json()) as UpsertProviderResponse;
    expect(json.provider.callbackUrl).not.toContain(':0/');
    expect(json.provider.callbackUrl).toBe(`${base.replace('localhost', '127.0.0.1')}/oauth/google/callback`
      .replace(/^http:\/\/[^:]+:/, 'http://127.0.0.1:'));
  });
});

describe('BAK-004 the auth rate limits are real', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak004-rl-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'rl', backendName: 'RL' });
    base = (await service.start()).listen.url;
  });
  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('refuses a magic-link firehose with 429 + Retry-After', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${base}/auth/magic-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: `flood${i}@example.com` })
      });
      statuses.push(res.status);
      if (res.status === 429) expect(res.headers.get('retry-after')).toBeTruthy();
    }
    // The bucket is 5 with a slow refill, so a tight loop of 10 must be cut off.
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
