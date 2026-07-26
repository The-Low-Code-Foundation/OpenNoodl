/**
 * BAK-009: metrics exposition, CORS/security headers.
 *
 * The metrics assertions check the two things that make a metrics endpoint
 * useful rather than decorative: that it PARSES as Prometheus exposition (a
 * malformed line makes a scraper drop the whole scrape, so "it returns 200" is
 * not the bar), and that the backup-age gauge is ABSENT rather than zero when
 * no backup has succeeded — a zero there reads as "backed up just now", which
 * is the exact opposite of the truth.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { MetricsRegistry } from '../src/ops/metrics';
import { allowedOrigin } from '../src/ops/headers';
import { defaultOpsConfig } from '../src/ops/model';

jest.setTimeout(30000);

/** A minimal Prometheus text-format parser — enough to prove the output is legal. */
function parseExposition(text: string): { samples: Map<string, number>; types: Map<string, string> } {
  const samples = new Map<string, number>();
  const types = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (line === '') continue;
    if (line.startsWith('# TYPE ')) {
      const [, , name, type] = line.split(' ');
      types.set(name, type);
      continue;
    }
    if (line.startsWith('# HELP ')) continue;
    if (line.startsWith('#')) throw new Error(`unknown comment line: ${line}`);
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})? (-?[0-9.eE+]+|NaN|\+Inf|-Inf)$/.exec(line);
    if (!match) throw new Error(`malformed sample line: ${JSON.stringify(line)}`);
    samples.set(match[1] + (match[2] || ''), Number(match[3]));
  }
  return { samples, types };
}

describe('BAK-009 metrics registry', () => {
  it('renders counters, histograms and gauges as legal exposition', () => {
    const registry = new MetricsRegistry();
    registry.counter('nodegx_requests_total', 'Requests.', { class: 'data', status: '200' });
    registry.counter('nodegx_requests_total', 'Requests.', { class: 'data', status: '200' });
    registry.counter('nodegx_requests_total', 'Requests.', { class: 'auth', status: '429' });
    registry.observe('nodegx_request_duration_seconds', 'Duration.', { class: 'data' }, 0.03);
    registry.gauge('nodegx_thing', 'A thing.', () => 42);

    const parsed = parseExposition(registry.render());
    expect(parsed.samples.get('nodegx_requests_total{class="data",status="200"}')).toBe(2);
    expect(parsed.samples.get('nodegx_requests_total{class="auth",status="429"}')).toBe(1);
    expect(parsed.types.get('nodegx_request_duration_seconds')).toBe('histogram');
    expect(parsed.samples.get('nodegx_request_duration_seconds_count{class="data"}')).toBe(1);
    // 0.03 falls in the 0.05 bucket but not the 0.025 one.
    expect(parsed.samples.get('nodegx_request_duration_seconds_bucket{class="data",le="0.025"}')).toBe(0);
    expect(parsed.samples.get('nodegx_request_duration_seconds_bucket{class="data",le="0.05"}')).toBe(1);
    expect(parsed.samples.get('nodegx_thing')).toBe(42);
  });

  it('omits a gauge with nothing to say rather than reporting zero', () => {
    const registry = new MetricsRegistry();
    registry.gauge('nodegx_backup_age_seconds', 'Age.', () => null);
    expect(registry.render()).not.toContain('nodegx_backup_age_seconds');
  });

  it('survives a gauge whose source is broken', () => {
    const registry = new MetricsRegistry();
    registry.gauge('nodegx_broken', 'Broken.', () => {
      throw new Error('the database file vanished');
    });
    registry.gauge('nodegx_fine', 'Fine.', () => 1);
    expect(parseExposition(registry.render()).samples.get('nodegx_fine')).toBe(1);
  });

  it('escapes label values rather than emitting an unparsable line', () => {
    const registry = new MetricsRegistry();
    registry.counter('nodegx_odd_total', 'Odd.', { name: 'a"b\\c' });
    expect(() => parseExposition(registry.render())).not.toThrow();
  });
});

describe('BAK-009 CORS decisions', () => {
  const wildcard = defaultOpsConfig().cors;

  it('answers * by default', () => {
    expect(allowedOrigin('https://app.example.com', wildcard)).toBe('*');
    expect(allowedOrigin(undefined, wildcard)).toBe('*');
  });

  it('echoes an allow-listed origin and refuses others', () => {
    const config = { origins: ['https://app.example.com'], credentials: false };
    expect(allowedOrigin('https://app.example.com', config)).toBe('https://app.example.com');
    expect(allowedOrigin('https://evil.example.com', config)).toBeNull();
    expect(allowedOrigin(undefined, config)).toBeNull();
  });

  it('echoes rather than wildcards when credentials are in play', () => {
    // A browser refuses `*` on a credentialed request, so answering `*` there
    // is the same as answering nothing — only harder to debug.
    const config = { origins: ['*'], credentials: true };
    expect(allowedOrigin('https://app.example.com', config)).toBe('https://app.example.com');
  });
});

describe('BAK-009 metrics + headers over real sockets', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-ops-metrics-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'backend_metrics', backendName: 'Metrics Test' });
    const started = await service.start();
    base = started.listen.url;
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(async () => {
    if (service) await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('scrapes cleanly and counts the traffic it has actually seen', async () => {
    await fetch(`${base}/health`);
    await fetch(`${base}/health`);

    const res = await fetch(`${base}/metrics`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain; version=0\.0\.4/);

    const parsed = parseExposition(await res.text());
    expect(parsed.samples.get('nodegx_requests_total{class="public",method="GET",status="200"}')).toBeGreaterThanOrEqual(
      2
    );
    expect(parsed.samples.get('nodegx_realtime_connections')).toBe(0);
    expect(parsed.samples.get('nodegx_uptime_seconds')).toBeGreaterThan(0);
    expect(parsed.samples.get('nodegx_db_file_bytes')).toBeGreaterThan(0);
  });

  it('has no backup-age series until a backup succeeds, and one after', async () => {
    const before = await (await fetch(`${base}/metrics`)).text();
    expect(before).not.toContain('nodegx_backup_age_seconds');

    await fetch(`${base}/admin/backups`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });

    const after = await (await fetch(`${base}/metrics`)).text();
    expect(after).toContain('nodegx_backup_age_seconds');
    const age = parseExposition(after).samples.get('nodegx_backup_age_seconds')!;
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(60);
  });

  it('can be switched off, and then 404s like any unknown path', async () => {
    await fetch(`${base}/admin/ops`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ metrics: { enabled: false } })
    });
    expect((await fetch(`${base}/metrics`)).status).toBe(404);

    await fetch(`${base}/admin/ops`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ metrics: { enabled: true } })
    });
    expect((await fetch(`${base}/metrics`)).status).toBe(200);
  });

  it('sends CORS headers on API responses and honours a configured allow-list', async () => {
    const wildcard = await fetch(`${base}/health`, { headers: { origin: 'https://anywhere.example' } });
    expect(wildcard.headers.get('access-control-allow-origin')).toBe('*');
    // The request id must be readable by the browser code that would report it.
    expect(wildcard.headers.get('access-control-expose-headers')).toMatch(/X-Request-Id/);

    await fetch(`${base}/admin/ops`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ cors: { origins: ['https://app.example.com'] } })
    });

    const allowed = await fetch(`${base}/health`, { headers: { origin: 'https://app.example.com' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(allowed.headers.get('vary')).toMatch(/Origin/);

    const refused = await fetch(`${base}/health`, { headers: { origin: 'https://evil.example.com' } });
    expect(refused.headers.get('access-control-allow-origin')).toBeNull();
    // The REQUEST still succeeds — CORS is the browser's rule, not the
    // server's access control, and conflating the two would break every
    // non-browser client.
    expect(refused.status).toBe(200);

    await fetch(`${base}/admin/ops`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ cors: { origins: ['*'] } })
    });
  });

  it('answers a preflight with the configured policy', async () => {
    const res = await fetch(`${base}/api/Thing`, {
      method: 'OPTIONS',
      headers: { origin: 'https://app.example.com', 'access-control-request-method': 'POST' }
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toMatch(/POST/);
    expect(res.headers.get('access-control-max-age')).toBe('86400');
  });

  it('names itself honestly, and hardens the dashboard document only', async () => {
    const api = await fetch(`${base}/health`);
    expect(api.headers.get('server')).toMatch(/^nodegx-backend\//);
    expect(api.headers.get('x-frame-options')).toBeNull();

    const dashboard = await fetch(`${base}/_admin`);
    expect(dashboard.headers.get('x-frame-options')).toBe('DENY');
    expect(dashboard.headers.get('x-content-type-options')).toBe('nosniff');
    expect(dashboard.headers.get('referrer-policy')).toBe('no-referrer');
    expect(dashboard.headers.get('content-security-policy')).toMatch(/default-src 'none'/);
  });
  /**
   * Last on purpose: it deliberately empties the `auth` bucket for 127.0.0.1,
   * and every test in this file shares that address. Running it earlier would
   * 429 the /_admin request above — cross-test coupling that looks like a
   * header bug (it did, once).
   */
  it('counts rate-limit refusals', async () => {
    await fetch(`${base}/admin/ops`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rateLimit: { policies: { auth: { ratePerMinute: 1, burst: 1 } } } })
    });
    for (let i = 0; i < 4; i++) {
      await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'x', password: 'y' })
      });
    }
    const parsed = parseExposition(await (await fetch(`${base}/metrics`)).text());
    expect(parsed.samples.get('nodegx_ratelimit_refusals_total{class="auth"}')).toBeGreaterThan(0);

    await fetch(`${base}/admin/ops`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rateLimit: { policies: { auth: defaultOpsConfig().rateLimit.policies.auth } } })
    });
  });

});
