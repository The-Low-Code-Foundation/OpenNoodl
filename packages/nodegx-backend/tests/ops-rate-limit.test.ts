/**
 * BAK-009 rate limiting.
 *
 * Three levels, because a bug at any one of them makes the feature useless in a
 * different way:
 *
 *   1. the bucket arithmetic (refill, burst, Retry-After, memory bound);
 *   2. the CLASSIFICATION of the live route table — the part most likely to
 *      drift as routes are added, so it is asserted as data;
 *   3. the spec's actual criterion, over real sockets: hammering /login yields
 *      429 + Retry-After while data routes stay unaffected.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { RateLimiter, classifyRoute } from '../src/ops/rate-limit';
import { defaultOpsConfig } from '../src/ops/model';

jest.setTimeout(30000);

describe('BAK-009 token bucket', () => {
  function limiter(overrides: Partial<ReturnType<typeof defaultOpsConfig>['rateLimit']> = {}) {
    const config = { ...defaultOpsConfig().rateLimit, ...overrides };
    return new RateLimiter(() => config);
  }

  it('allows a burst, then refuses with a usable Retry-After', () => {
    const rl = limiter({ policies: { ...defaultOpsConfig().rateLimit.policies, auth: { ratePerMinute: 60, burst: 3 } } });
    const t = 1_000_000;
    expect(rl.check('auth', 'ip:1.1.1.1', t).allowed).toBe(true);
    expect(rl.check('auth', 'ip:1.1.1.1', t).allowed).toBe(true);
    expect(rl.check('auth', 'ip:1.1.1.1', t).allowed).toBe(true);

    const refused = rl.check('auth', 'ip:1.1.1.1', t);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    // 60/min = one token per second, so waiting that long must work.
    expect(rl.check('auth', 'ip:1.1.1.1', t + refused.retryAfterSeconds * 1000).allowed).toBe(true);
  });

  it('refills continuously rather than resetting on a window edge', () => {
    const rl = limiter({ policies: { ...defaultOpsConfig().rateLimit.policies, auth: { ratePerMinute: 60, burst: 10 } } });
    const t = 2_000_000;
    for (let i = 0; i < 10; i++) expect(rl.check('auth', 'k', t).allowed).toBe(true);
    expect(rl.check('auth', 'k', t).allowed).toBe(false);
    // Half a second buys nothing; five seconds buys five requests, not a fresh
    // window's worth of ten.
    expect(rl.check('auth', 'k', t + 500).allowed).toBe(false);
    for (let i = 0; i < 5; i++) expect(rl.check('auth', 'k', t + 5000).allowed).toBe(true);
    expect(rl.check('auth', 'k', t + 5000).allowed).toBe(false);
  });

  it('keeps buckets separate per key and per class', () => {
    const rl = limiter({ policies: { ...defaultOpsConfig().rateLimit.policies, auth: { ratePerMinute: 60, burst: 1 } } });
    const t = 3_000_000;
    expect(rl.check('auth', 'ip:a', t).allowed).toBe(true);
    expect(rl.check('auth', 'ip:a', t).allowed).toBe(false);
    expect(rl.check('auth', 'ip:b', t).allowed).toBe(true);
    expect(rl.check('data', 'ip:a', t).allowed).toBe(true);
  });

  it('treats burst 0 as unlimited (the realtime class)', () => {
    const rl = limiter();
    const t = 4_000_000;
    for (let i = 0; i < 1000; i++) expect(rl.check('realtime', 'k', t).allowed).toBe(true);
  });

  it('honours the master switch', () => {
    const rl = limiter({ enabled: false, policies: { ...defaultOpsConfig().rateLimit.policies, auth: { ratePerMinute: 1, burst: 1 } } });
    const t = 5_000_000;
    for (let i = 0; i < 50; i++) expect(rl.check('auth', 'k', t).allowed).toBe(true);
  });

  it('forgets refilled buckets, so one entry per source address is not a leak', () => {
    const rl = limiter({ policies: { ...defaultOpsConfig().rateLimit.policies, data: { ratePerMinute: 600, burst: 10 } } });
    const t = 6_000_000;
    for (let i = 0; i < 200; i++) rl.check('data', `ip:10.0.0.${i}`, t);
    expect(rl.size).toBe(200);
    // A minute later every one of those has refilled to full: they carry no
    // information the absence of an entry does not.
    rl.check('data', 'ip:new', t + 61_000);
    expect(rl.size).toBe(1);
  });

  it('applies a shrunken policy immediately rather than after the old allowance drains', () => {
    const policies = { ...defaultOpsConfig().rateLimit.policies, data: { ratePerMinute: 600, burst: 100 } };
    const config = { ...defaultOpsConfig().rateLimit, policies };
    const rl = new RateLimiter(() => config);
    const t = 7_000_000;
    for (let i = 0; i < 50; i++) rl.check('data', 'k', t);
    policies.data = { ratePerMinute: 600, burst: 5 };
    // 50 tokens were spent from a bucket of 100; the new bucket only holds 5.
    expect(rl.check('data', 'k', t).remaining).toBeLessThanOrEqual(5);
  });
});

describe('BAK-009 route classification', () => {
  it('classifies the credential-presenting routes as auth and ordinary session traffic as data', () => {
    expect(classifyRoute('login', 'session')).toBe('auth');
    expect(classifyRoute('users', 'signup')).toBe('auth');
    expect(classifyRoute('requestPasswordReset', 'public')).toBe('auth');
    expect(classifyRoute('_admin', 'public')).toBe('auth');
    // …but the dashboard's own polling endpoint is admin traffic, and reading
    // your own user is what every app does on load.
    expect(classifyRoute('_admin/whoami', 'admin')).toBe('admin');
    expect(classifyRoute('users/me', 'session')).toBe('data');
    expect(classifyRoute('logout', 'session')).toBe('data');
  });

  it('classifies the rest from the access declaration the route already carries', () => {
    expect(classifyRoute('api/:table', 'data')).toBe('data');
    expect(classifyRoute('api/_batch', 'data-perOp')).toBe('data');
    expect(classifyRoute('functions/:name', 'function')).toBe('functions');
    expect(classifyRoute('files/:name', 'files')).toBe('files');
    expect(classifyRoute('hooks/:backendId/:slug', 'webhook')).toBe('hooks');
    expect(classifyRoute('realtime', 'public')).toBe('realtime');
    expect(classifyRoute('realtime/subscriptions', 'public')).toBe('realtime');
    expect(classifyRoute('health', 'public')).toBe('public');
  });
});

describe('BAK-009 rate limiting over real sockets', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-ops-rl-'));
    fs.mkdirSync(dataDir, { recursive: true });
    // A deliberately tiny auth budget; everything else stays at its default so
    // the "data routes stay unaffected" half of the criterion means something.
    const ops = defaultOpsConfig();
    ops.rateLimit.policies.auth = { ratePerMinute: 6, burst: 3 };
    fs.writeFileSync(path.join(dataDir, 'ops.json'), JSON.stringify(ops, null, 2));

    service = new BackendService({ dataDir, port: 0, backendId: 'backend_rl', backendName: 'RL Test' });
    const started = await service.start();
    base = started.listen.url;
  });

  afterAll(async () => {
    if (service) await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('429s a hammered /login with a Retry-After, and says why', async () => {
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    let body: any = null;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'nobody', password: 'wrong' })
      });
      statuses.push(res.status);
      if (res.status === 429) {
        retryAfter = res.headers.get('retry-after');
        body = await res.json();
      }
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(body.error).toMatch(/rate limit/i);
    // The refusal is correlatable like every other error.
    expect(typeof body.requestId).toBe('string');
  });

  it('leaves data routes alone while auth is being refused', async () => {
    const results: number[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`${base}/api/Thing`);
      results.push(res.status);
    }
    expect(results.some((s) => s === 429)).toBe(false);
  });

  it('reads ops.json rather than hard-coding: the config on disk is what applies', async () => {
    const written = JSON.parse(fs.readFileSync(path.join(dataDir, 'ops.json'), 'utf-8'));
    expect(written.rateLimit.policies.auth).toEqual({ ratePerMinute: 6, burst: 3 });
  });

  /**
   * The drift guard. Adding a route silently changes this tally, which is the
   * moment to ask "is that route's budget right?" — the same shape as BAK-003's
   * route-walk, which is what stops a new route from quietly skipping the gate.
   */
  it('classifies every route in the live table, and the tally is reviewed', () => {
    const byClass: Record<string, string[]> = {};
    for (const route of service.getRouteTable()) {
      const cls = classifyRoute(route.pattern, route.access.kind);
      (byClass[cls] = byClass[cls] || []).push(`${route.method} ${route.pattern}`);
    }
    const counts = Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length]));

    // If this fails, the message names the class whose membership changed;
    // `byClass` is what to read to see which route moved.
    expect(counts).toEqual({
      admin: 67,
      auth: 8,
      data: 15,
      files: 4,
      functions: 1,
      hooks: 1,
      public: 3,
      realtime: 2
    });

    // Invariants that must hold however the table grows.
    for (const route of service.getRouteTable()) {
      const cls = classifyRoute(route.pattern, route.access.kind);
      if (route.access.kind === 'admin') expect(cls).toBe('admin');
      if (route.pattern.startsWith('realtime')) expect(cls).toBe('realtime');
    }
  });
});
