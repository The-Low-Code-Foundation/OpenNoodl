/**
 * D45 — is the unconfirmed realtime subscription the PRODUCT or the HARNESS?
 *
 * SBR-011's drive saw three subscriptions time out at 15s and retry, leaving a
 * stream behind on each attempt: **six open streams for three subscriptions on
 * one run, fifteen on the next**, with the identical code. The register refused
 * to attribute that, and named the discriminating test:
 *
 * > time the hello frame through the `/__backend` proxy against direct, **in one
 * > run**. If the proxy is slow it is the harness; if both are fast the delay is
 * > in `RealtimeSubscription`'s POST and the row is the product's.
 *
 * That is §1 below, and it is deliberately the *whole* comparison rather than an
 * inspection of either side: the two numbers are read from the same backend, in
 * the same process, seconds apart, so "the proxy is slow" and "the machine was
 * busy" cannot produce the same reading.
 *
 * 🔴 **§2 is the other half of the row, and the register asked for it in the same
 * breath**: *why is the abandoned stream still open?* That question is not about
 * timing at all, so it does not share §1's instrument. `RealtimeHub` reaps a
 * connection on its response's `close` event, and the runtime's retry really does
 * call `EventSource.close()` (`RealtimeSubscription.transportDownFrom` →
 * `_safeClose`) — so a browser that gives up has done its part. §2 asks whether
 * the *proxy* passes that up: it opens a stream through `/__backend`, closes the
 * downstream, and reads the hub's own `connectionCount`.
 *
 * ⚠️ **The control is read first and it is the same measurement**, because an
 * absence is the easy thing to get wrong here: a `connectionCount` that never
 * drops for a *direct* client either would mean the hub does not reap at all, and
 * that is a different defect with a different owner. Direct-then-proxied, one
 * run, same counter.
 *
 * ⚠️ What this file cannot see: it drives the proxy with Node's `http`, not with
 * Chrome. It therefore prices the proxy and the hub, and says nothing about a
 * browser's per-origin connection limit — which is a live hypothesis for the
 * same symptom and needs a browser to test. §3 is the nearest thing this
 * instrument can offer: the proxy's own behaviour with several streams already
 * open, which is the part a browser limit would sit on top of.
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import { withRenderedPage, RenderedPage } from './helpers/site-drive';
import { openStream, SseHandle } from './helpers/sse';

jest.setTimeout(180000);

const RENDER_SCRIPT = path.resolve(__dirname, '../../../scripts/devtools/render-from-disk.js');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait until the hub's connection count has stopped moving.
 *
 * ⚠️ Not a nicety — the first run of this file failed its own CONTROL on it.
 * `§1` closes two streams and returns; the reap of the direct one lands
 * asynchronously, so `§2` read `before` while the count was still falling and
 * its `before + 1` never arrived. A baseline taken during someone else's
 * teardown is a baseline for no moment at all.
 */
async function settled(read: () => number, quietMs = 750, maxMs = 15000): Promise<number> {
  const deadline = Date.now() + maxMs;
  let last = read();
  let since = Date.now();
  for (;;) {
    await wait(100);
    const now = read();
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) return now;
    if (Date.now() > deadline) return now;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

/**
 * The smallest thing `render-from-disk.js` will serve.
 *
 * It only refuses on a missing `nodegx.project.json`, and the proxy branch runs
 * before any project data is touched — but the `metadata.cloudservices` block is
 * written anyway, because that is the key whose presence makes the server rewrite
 * the endpoint to `/__backend` at all. A project without it is a project the
 * drive would not have proxied, and measuring the proxy on one would be measuring
 * a configuration the defect cannot occur in.
 */
function makeMinimalProject(backendPort: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd45-project-'));
  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify(
      {
        name: 'd45-proxy-timing',
        version: 2,
        rootNodeId: null,
        metadata: {
          cloudservices: { appId: 'd45_app', endpoint: `http://127.0.0.1:${backendPort}` }
        }
      },
      null,
      2
    )
  );
  // `buildProjectData` runs to completion before the server listens, and it
  // dereferences `components[0]` — so one real component is the floor, not a
  // nicety. It draws nothing anyone reads: this file never opens a browser, and
  // the proxy branch returns before any project data is touched.
  const appDir = path.join(dir, 'components', 'App');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'components', '_registry.json'),
    JSON.stringify({ components: { App: { path: 'App' } } })
  );
  fs.writeFileSync(path.join(appDir, 'component.json'), JSON.stringify({ path: '/App' }));
  fs.writeFileSync(
    path.join(appDir, 'nodes.json'),
    JSON.stringify({ nodes: [{ id: 'root', type: 'Group', parameters: {}, children: [] }] })
  );
  return dir;
}

/** Milliseconds from `t0` to the hello frame, and to the response headers before it. */
interface HelloTiming {
  label: string;
  headersMs: number;
  helloMs: number;
  clientId: string;
  stream: SseHandle;
}

async function timeHello(label: string, base: string): Promise<HelloTiming> {
  const t0 = Date.now();
  const stream = await openStream(base);
  const headersMs = Date.now() - t0;
  const hello = await stream.waitFor('connected', undefined, 30000);
  return { label, headersMs, helloMs: Date.now() - t0, clientId: hello.data.clientId, stream };
}

describe('D45 — the realtime delay: proxy or product', () => {
  let dataDir: string;
  let projectDir: string;
  let service: BackendService;
  let backendPort: number;
  let directBase: string;
  let proxyBase: string;
  let server: ChildProcess;
  let servePort: number;
  const serverLog: string[] = [];

  const hub = () =>
    (service as unknown as { realtime: { connectionCount: number } }).realtime;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd45-data-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'd45_proxy',
      backendName: 'D45 proxy timing'
    });
    const started = await service.start();
    directBase = started.listen.url;
    backendPort = Number(new URL(directBase).port);

    projectDir = makeMinimalProject(backendPort);
    servePort = await freePort();
    proxyBase = `http://127.0.0.1:${servePort}/__backend`;

    server = spawn(
      process.execPath,
      [RENDER_SCRIPT, projectDir, '--port', String(servePort), '--backend-port', String(backendPort)],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    server.stdout?.on('data', (b: Buffer) => serverLog.push(b.toString()));
    server.stderr?.on('data', (b: Buffer) => serverLog.push(b.toString()));

    // Wait for the port to answer rather than for a log line: the server prints
    // its URL to stderr, but a warning about a missing viewer bundle prints
    // there too and this file does not need the bundle at all.
    const deadline = Date.now() + 30000;
    for (;;) {
      const up = await new Promise<boolean>((resolve) => {
        const s = net.connect(servePort, '127.0.0.1');
        s.on('connect', () => {
          s.destroy();
          resolve(true);
        });
        s.on('error', () => resolve(false));
      });
      if (up) break;
      if (Date.now() > deadline) throw new Error('render-from-disk did not listen: ' + serverLog.join(''));
      await wait(200);
    }
  });

  afterAll(async () => {
    server?.kill('SIGKILL');
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // ── §1 the named discriminating test ────────────────────────────────────

  it('§1 times the hello frame through the proxy and direct, in one run', async () => {
    // Direct FIRST, so the number the comparison leans on is the one taken
    // before the proxy has had a chance to do anything to this backend.
    const direct = await timeHello('direct', directBase);
    const proxied = await timeHello('proxied', proxyBase);

    // eslint-disable-next-line no-console
    console.log(
      '[D45 §1] ' +
        JSON.stringify(
          {
            direct: { headersMs: direct.headersMs, helloMs: direct.helloMs },
            proxied: { headersMs: proxied.headersMs, helloMs: proxied.helloMs }
          },
          null,
          2
        )
    );

    // The control has to have fired for the subject's number to mean anything.
    expect(direct.clientId).toBeTruthy();
    expect(proxied.clientId).toBeTruthy();
    // Two different connections, not one read twice.
    expect(proxied.clientId).not.toBe(direct.clientId);

    direct.stream.close();
    proxied.stream.close();

    // 15000ms is the deadline that produced the finding. A proxy that delays the
    // hello frame anywhere near it is the harness; one that does not, is not.
    expect(`proxied hello ms < 15000: ${proxied.helloMs < 15000}`).toBe('proxied hello ms < 15000: true');
    expect(`proxied hello ms < 1000: ${proxied.helloMs < 1000}`).toBe('proxied hello ms < 1000: true');
  });

  // ── §2 the abandoned stream ─────────────────────────────────────────────

  it('§2 reaps a DIRECT stream when the client closes — the control, read first', async () => {
    const before = await settled(() => hub().connectionCount);
    const stream = await openStream(directBase);
    await stream.waitFor('connected', undefined, 30000);
    expect(hub().connectionCount).toBe(before + 1);

    stream.close();
    const deadline = Date.now() + 10000;
    while (hub().connectionCount > before && Date.now() < deadline) await wait(100);

    // If THIS fails the row is about the hub, not the proxy, and §3 is moot.
    expect(`direct reaped: ${hub().connectionCount === before}`).toBe('direct reaped: true');
  });

  it('§2 reaps a PROXIED stream when the client closes', async () => {
    const before = await settled(() => hub().connectionCount);
    const stream = await openStream(proxyBase);
    await stream.waitFor('connected', undefined, 30000);
    expect(hub().connectionCount).toBe(before + 1);

    stream.close();
    const deadline = Date.now() + 10000;
    while (hub().connectionCount > before && Date.now() < deadline) await wait(100);

    // eslint-disable-next-line no-console
    console.log(`[D45 §2] proxied close → connectionCount ${before} → ${hub().connectionCount}`);
    expect(`proxied reaped: ${hub().connectionCount === before}`).toBe('proxied reaped: true');
  });

  // ── §3 several streams, which is the shape the drive was in ─────────────

  it('§3 confirms a subscription through the proxy with three streams already open', async () => {
    const before = await settled(() => hub().connectionCount);
    const streams: SseHandle[] = [];
    const timings: { headersMs: number; helloMs: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const t = await timeHello(`proxied-${i}`, proxyBase);
      streams.push(t.stream);
      timings.push({ headersMs: t.headersMs, helloMs: t.helloMs });
    }
    expect(hub().connectionCount).toBe(before + 3);

    // The POST the runtime makes after each hello frame, through the same proxy,
    // read for its BODY: the backend answers 200 to a rejected subscription, so
    // `accepted[]` is the confirmation and the status is not.
    const proxied = httpClient(() => proxyBase);
    const t0 = Date.now();
    const sub = await proxied.post<{ accepted: unknown[]; rejected: unknown[] }>(
      '/realtime/subscriptions',
      { clientId: (await streams[0].waitFor('connected')).data.clientId, subscriptions: [{ collection: 'Page' }] }
    );
    const subMs = Date.now() - t0;

    // eslint-disable-next-line no-console
    console.log('[D45 §3] ' + JSON.stringify({ streams: timings, subscribeMs: subMs, accepted: sub.json.accepted.length }));

    expect(sub.status).toBe(200);
    expect(sub.json.accepted).toHaveLength(1);
    expect(`subscribe ms < 15000: ${subMs < 15000}`).toBe('subscribe ms < 15000: true');

    for (const s of streams) s.close();
  });

  // ── §4 the browser's connection pool, which is where the 15 seconds went ──

  /**
   * 🔴 The delay is not on either side of the wire — it is the BROWSER refusing
   * to send.
   *
   * SBR-011's drive, instrumented with Resource Timing, reads the subscription
   * POST as `queued 15007ms, waited 5ms`: the request sat in Chrome's queue for
   * exactly the confirmation deadline, and the backend then answered it in five
   * milliseconds. The queue drained at the instant the deadline closed the SSE
   * streams. Three cycles of that, identically, then a fourth.
   *
   * `SseTransport` opens **one never-ending stream per subscription** — its own
   * header calls that "the honest trade" and notes the cost is "one connection
   * per subscribing node" — and the registration POST that every one of those
   * streams requires competes for the same per-origin pool the streams are
   * holding. Three subscriptions on one origin is enough to deadlock it: the
   * POSTs cannot go out until the streams are closed, and the streams are only
   * closed by the timeout that the POSTs would have prevented.
   *
   * This arm prices that pool directly, because the SIZE of it is what says
   * whether the fix must share one stream across subscriptions or merely stagger
   * them. It opens streams one at a time and times an ordinary request after
   * each, in the product's own browser against the product's own proxy.
   */
  it('§4 prices the browser pool: an ordinary request after each extra open stream', async () => {
    const readings = await withRenderedPage({ projectDir, backendPort }, async (page: RenderedPage) => {
      return (await page.evaluate(`(async function () {
        const held = [];
        const rows = [];
        function openOne() {
          return new Promise(function (resolve) {
            const es = new EventSource('/__backend/realtime');
            held.push(es);
            const done = setTimeout(function () { resolve('timeout'); }, 20000);
            es.addEventListener('connected', function () { clearTimeout(done); resolve('connected'); });
          });
        }
        for (let k = 1; k <= 8; k++) {
          const opened = await openOne();
          // GET /realtime WITHOUT an SSE Accept is a finite JSON hint — a real
          // route on the real backend that answers immediately, so a slow
          // reading here is the pool and never the server having work to do.
          // Capped, and the cap is recorded as the reading rather than waited
          // out: the uncapped version of this arm sat 174 SECONDS on the sixth
          // stream and killed the suite on its own timeout. A starved request is
          // not slow, it is not sent.
          const t0 = performance.now();
          const timed = await Promise.race([
            fetch('/__backend/realtime', { headers: { accept: 'application/json' } })
              .then(function (r) { return r.status; })
              .catch(function () { return -1; }),
            new Promise(function (r) { setTimeout(function () { r('starved'); }, 8000); })
          ]);
          rows.push({
            streams: k,
            opened: opened,
            fetchMs: timed === 'starved' ? -1 : Math.round(performance.now() - t0),
            status: timed === 'starved' ? 'starved' : timed
          });
          if (timed === 'starved') break;
        }
        for (const es of held) es.close();
        return JSON.stringify(rows);
      })()`)) as string;
    });

    const rows = JSON.parse(readings) as {
      streams: number;
      opened: string;
      fetchMs: number;
      status: number | string;
    }[];
    // eslint-disable-next-line no-console
    console.log('[D45 §4] ' + JSON.stringify(rows));

    // The control: with one stream open an ordinary request is instant. If THIS
    // is slow the reading is about the machine and the column says nothing.
    expect(rows[0].opened).toBe('connected');
    expect(`1 stream, prompt: ${rows[0].fetchMs >= 0 && rows[0].fetchMs < 1000}`).toBe('1 stream, prompt: true');

    // Every stream opens — the starvation is of OTHER requests, not of the
    // streams themselves, and that distinction is the whole diagnosis.
    for (const r of rows) expect(`stream ${r.streams} opened: ${r.opened}`).toBe(`stream ${r.streams} opened: connected`);

    const starved = rows.find((r) => r.status === 'starved');
    // eslint-disable-next-line no-console
    console.log('[D45 §4] first starved at: ' + (starved ? starved.streams : 'never, up to ' + rows.length));

    // 🔴 The finding, as the number the fix has to beat. Chrome's per-origin
    // HTTP/1.1 pool is six, and a never-ending stream never gives its slot back —
    // so the SIXTH subscription on an origin silences every other request the app
    // makes to it, the registration POST for that very subscription included.
    expect(`starves at: ${starved ? starved.streams : 'never'}`).toBe('starves at: 6');
  });
});
