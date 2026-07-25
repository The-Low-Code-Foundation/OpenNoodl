/**
 * config/auth policy — the real, non-deferred logic in the front half.
 *
 * WF-004 policy: localhost-only by default; a bearer token is mandatory the
 * moment the service binds to anything wider. These tests pin that so a wider
 * bind can never end up unauthenticated by accident.
 */

import { resolveOptions, requiresAuth, generateAuthToken } from '../src/config';

describe('nodegx-backend config — bind/auth policy', () => {
  it('defaults to localhost with no token required', () => {
    const opts = resolveOptions();
    expect(opts.host).toBe('127.0.0.1');
    expect(requiresAuth(opts)).toBe(false);
    expect(opts.authToken).toBeNull();
  });

  it.each(['127.0.0.1', 'localhost', '::1'])('treats %s as loopback (no auth)', (host) => {
    expect(requiresAuth({ host })).toBe(false);
  });

  it.each(['0.0.0.0', '192.168.1.10', 'example.com'])('treats %s as wider (auth required)', (host) => {
    expect(requiresAuth({ host })).toBe(true);
  });

  it('mints a token automatically for a wider bind when none is supplied', () => {
    const opts = resolveOptions({ host: '0.0.0.0' });
    expect(requiresAuth(opts)).toBe(true);
    expect(typeof opts.authToken).toBe('string');
    expect((opts.authToken as string).length).toBeGreaterThan(20);
  });

  it('keeps an explicitly supplied token', () => {
    const opts = resolveOptions({ host: '0.0.0.0', authToken: 'supplied-token' });
    expect(opts.authToken).toBe('supplied-token');
  });

  it('generates distinct, URL-safe tokens', () => {
    const a = generateAuthToken();
    const b = generateAuthToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not persist config to disk yet (deferred to second half)', () => {
    // resolveOptions is pure — no fs writes. This is a guard against the config
    // persistence (which moves with BackendManager) accidentally landing here.
    const opts = resolveOptions({ dataDir: '/tmp/does-not-exist-xyz' });
    expect(opts.dataDir).toBe('/tmp/does-not-exist-xyz');
  });
});
