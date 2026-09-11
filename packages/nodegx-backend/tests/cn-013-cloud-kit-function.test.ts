/**
 * CN-013 / D18 — a kit's logic node answering a real HTTP request, through the whole service.
 *
 * `noodl-viewer-cloud/tests/cn-013-cloud-kits.test.ts` proves the loader and drives `CloudRunner`
 * directly. This file is the other half: a `.workflow.json` on disk, `BackendService` starting and
 * loading it exactly as it does at boot, and `POST /functions/:name` over a real socket. Between
 * them they cover the two things a unit test of the loader cannot:
 *
 * 1. **The bundle shape actually travels.** `modules` has to survive being written to disk as JSON,
 *    read back, and handed to `CloudRunner.load` by `WorkflowRunner` — three hops the loader's own
 *    suite never takes.
 * 2. **The failure is spoken aloud.** D18 obliges the cloud half to *"say what it does not cover,
 *    in the diagnostic"*. A diagnostic that exists on a result object nobody prints is not a
 *    diagnostic, so the log line is asserted here rather than the return value.
 *
 * ⚠️ **This is still not the bundled build shape.** Jest maps `@cloud-runtime` to
 * `noodl-viewer-cloud/src`; the editor and a deploy target run `dist/cli.js`, an esbuild bundle of
 * the same source. `new Function` is exactly the construct that can mean something different once
 * bundled, so the bundle is checked separately — see `notes/cn-013-cloud-drive.md`. Neither run is
 * evidence about the other.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { logger } from '../src/ops/logger';
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/**
 * A pure-JS logic kit — the class D18 rules in. No DOM, no React, no `require`.
 *
 * Guarded on `typeof Noodl` with a `window.Noodl` fallback, which is how a kit written for a
 * browser is actually written; a fixture without that guard would not exercise the thing most
 * likely to go wrong in a runtime that has no `window`.
 */
const TALLY_KIT = `
(function () {
  var Accumulator = {
    name: 'tally.kit.Accumulator',
    displayNodeName: 'Tally Accumulator',
    category: 'Math',
    color: 'data',
    initialize: function () { this._internal.total = 0; this._internal.step = 1; },
    inputs: {
      add: {
        group: 'Actions', displayName: 'Add',
        valueChangedToTrue: function () {
          this._internal.total += this._internal.step;
          this.flagOutputDirty('total');
          this.sendSignalOnOutput('totalChanged');
        }
      },
      step: {
        group: 'Values', type: 'number', displayName: 'Step', default: 1,
        set: function (value) { this._internal.step = Number(value); }
      }
    },
    outputs: {
      total: { group: 'Values', type: 'number', displayName: 'Total', getter: function () { return this._internal.total; } },
      totalChanged: { group: 'Events', type: 'signal', displayName: 'Total Changed' }
    }
  };
  function defineNodes(N) { N.defineModule({ nodes: [Accumulator] }); }
  if (typeof Noodl !== 'undefined') defineNodes(Noodl);
  else if (typeof window !== 'undefined' && window.Noodl) defineNodes(window.Noodl);
})();
`;

/** A kit that reaches for an npm SDK — the case D18 rules OUT, and must name. */
const STRIPE_KIT = `
var Stripe = require('stripe');
Noodl.defineModule({ nodes: [] });
`;

/**
 * `request → <type> → response`, with the middle node's own output carrying the answer.
 *
 * `totalChanged → send` rather than `receive → send`: a 200 here cannot come from a graph that
 * skipped the kit, because the Response only fires on a signal the kit node emits. `pm-total`
 * carries the kit's arithmetic, so the body is evidence about the node and not about the wiring.
 */
function tallyFunction(name: string, type = 'tally.kit.Accumulator', step = 7) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      { id: 'req', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true }, ports: [], children: [] },
      { id: 'acc', type, x: 0, y: 100, parameters: { step }, ports: [], children: [] },
      {
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'total' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: 'req', sourcePort: 'receive', targetId: 'acc', targetPort: 'add' },
      { sourceId: 'acc', sourcePort: 'total', targetId: 'res', targetPort: 'pm-total' },
      { sourceId: 'acc', sourcePort: 'totalChanged', targetId: 'res', targetPort: 'send' }
    ],
    roots: []
  };
}

describe('a kit logic node serving a real HTTP cloud function (CN-013, D18)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let previousLevel: string | undefined;
  let stdoutSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;
  const captured: string[] = [];

  const client = httpClient(() => base);
  const everything = () => captured.join('\n');

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cn013-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'kits.workflow.json'),
      JSON.stringify({
        components: [tallyFunction('tally')],
        settings: {},
        metadata: {},
        // Exactly what `exportCloudFunctionsWithKits` puts in the bundle: the cloud-enabled kit
        // with its source, and the ones that did not opt in carried by name only.
        modules: [
          { name: 'Tally Kit', runtimes: ['browser', 'cloud'], cloud: true, index: 'noodl_modules/tally-kit/index.js', source: TALLY_KIT, error: null },
          { name: 'Cashflow Kit', runtimes: ['browser'], cloud: false, index: 'noodl_modules/cashflow-kit/index.js', source: null, error: null },
          { name: 'Stripe Kit', runtimes: ['cloud'], cloud: true, index: 'noodl_modules/stripe-kit/index.js', source: STRIPE_KIT, error: null }
        ]
      })
    );

    // 🔴 `NODEGX_LOG_LEVEL` beats the `configure` option (`ops/logger.ts:78` reads
    // `envLogLevel() || options.level`), so `configure({level:'info'})` alone is a no-op while
    // `setup-logging.js`'s `silent` is still in the environment. The env var goes first, or every
    // presence assertion below fails for a reason unrelated to what it is testing.
    previousLevel = process.env.NODEGX_LOG_LEVEL;
    delete process.env.NODEGX_LOG_LEVEL;
    logger.configure({ level: 'info' });

    // Both doors, for the reason `cloud-logic-builder-log.test.ts` records: the structured logger
    // writes `process.stdout.write` directly, `safeLog` goes through `console`, and jest routes
    // the two differently in-band versus in a worker.
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      captured.push(String(chunk));
      return true;
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(' '));
    });

    service = new BackendService({ dataDir, port: 0, backendId: 'cn013', backendName: 'CN-013 kits' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
    if (previousLevel === undefined) delete process.env.NODEGX_LOG_LEVEL;
    else process.env.NODEGX_LOG_LEVEL = previousLevel;
    logger.configure({ level: 'silent' });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('answers 200 with the kit node’s own arithmetic', async () => {
    const res = await client.request<{ result: { total?: number } }>('POST', '/functions/tally', { body: {} });

    expect(res.status).toBe(200);
    // 🔴 `7`, not `1` and not `0`. The `step` parameter reached the kit node and its `add` ran
    // once. Before this task the same request timed out at 504 — CN-012 M4's measured first arm.
    expect(res.json.result.total).toBe(7);
  });

  it('names the kit it registered, in the service log, at load', () => {
    expect(everything()).toContain('registered 1 cloud kit(s)');
    expect(everything()).toContain('Tally Kit');
  });

  it('🔴 names the SDK limit for a kit that reached for require(), rather than failing silently', () => {
    // D18: "a logic kit node that reaches for an SDK must fail with a sentence naming the limit,
    // not with the hang that s24 just removed."
    expect(everything()).toContain('Stripe Kit');
    expect(everything()).toContain('no node_modules');
    expect(everything()).toContain('Server-side SDKs');
  });

  it('reports a browser-only kit as not cloud-enabled, which is a different fact from absent', () => {
    expect(everything()).toContain('Cashflow Kit');
    expect(everything()).toContain('Add "cloud"');
  });

  it('🔴 the control — one broken kit does not stop the other kit’s function serving', async () => {
    // The `Stripe Kit` above failed to load in the same bundle as the function asserted here. If a
    // load failure were fatal, the first row would already be red — but it would be red for a
    // reason indistinguishable from "the loader does not work", so this states the property.
    const res = await client.request<{ result: { total?: number } }>('POST', '/functions/tally', { body: {} });
    expect(res.status).toBe(200);
    expect(res.json.result.total).toBe(7);
  });
});
