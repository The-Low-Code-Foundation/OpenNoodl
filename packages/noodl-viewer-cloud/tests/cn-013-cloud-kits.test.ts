/**
 * CN-013 / D18 — a kit's logic nodes in the cloud runtime.
 *
 * ## The measurement this suite is built on top of
 *
 * CN-012's M4 ran three arms and they are the reason this feature is shaped the way it is:
 *
 * | Arm | Result |
 * |---|---|
 * | kit logic node in a cloud function, as shipped | ⏱ `CloudFunctionTimeoutError` — never answers |
 * | built-in `Counter`, same graph shape (control) | ✅ `200` |
 * | the same kit node after a hand-written `runtime.registerModule` | ✅ `200` |
 *
 * So the runtime was never the blocker; there was no caller. **The control arm is reproduced here
 * as a test row rather than cited**, because "the kit node answers 200" is equally true of a graph
 * that was answering all along, and this suite would otherwise be unable to tell a working loader
 * from a graph whose Response node fires without the kit.
 *
 * 🔴 **The absence row is asserted beside a known-firing one.** A bundle with no `modules` must
 * time out and the same bundle *with* `modules` must answer — same graph, same kit, one variable.
 * An absence asserted on its own here would also be satisfied by a graph that never ran.
 *
 * ## What "the build shape" means for this file
 *
 * These tests import `../src`, which is the **source** shape — what `nodegx-backend`'s jest suites
 * get through the `@cloud-runtime` alias. The loader evaluates kit source with `new Function`, which
 * is exactly the construct a bundler can change the meaning of, so the **bundled** shape
 * (`nodegx-backend/dist/cli.js`, what the editor spawns and what a deploy target runs) is covered
 * separately in `nodegx-backend/tests/cn-013-cloud-kit-function.test.ts` over real HTTP.
 * ⚠️ Neither file is evidence about the other.
 */

/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CloudRunner, isCloudFunctionTimeout, loadCloudKitModules, REQUIRE_LIMIT } from '../src';
import type { CloudKitModule } from '../src';

jest.setTimeout(30000);

/**
 * A pure-JS logic kit: one node, one signal in, a value and a signal out.
 *
 * Deliberately in the shape a real kit is written in — an IIFE that guards on `typeof Noodl` and
 * falls back to `window.Noodl` — because the guard is what a kit written for a browser actually
 * carries, and a fixture without it would not exercise the thing most likely to go wrong in a
 * runtime that has no `window`.
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
        group: 'Actions',
        displayName: 'Add',
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

/** The cloud-enabled bundle entry for {@link TALLY_KIT}. */
const tallyModule = (): CloudKitModule => ({
  name: 'Tally Kit',
  runtimes: ['browser', 'cloud'],
  cloud: true,
  source: TALLY_KIT
});

/**
 * `request → <type> → response`, with `step` as a parameter.
 *
 * `totalChanged → send` rather than `receive → send`: the Response fires only after the kit node
 * ran its own signal out, so a 200 here cannot come from a graph that skipped the kit. `pm-total`
 * carries the value, so the answer's *content* is the kit's arithmetic and not a constant.
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

/** A bundle in the shape `exportCloudFunctionsToJSON` produces. */
function bundle(components: unknown[], modules?: CloudKitModule[]) {
  const b: Record<string, unknown> = { components, settings: {}, metadata: {} };
  if (modules) b.modules = modules;
  return b;
}

/** A runtime double: `registerModule` is the only thing the loader calls on it. */
function fakeRuntime() {
  const registered: any[] = [];
  return {
    registered,
    registerModule(m: any) {
      registered.push(m);
    }
  };
}

describe('loadCloudKitModules — what registers, what does not, and why', () => {
  it('registers a pure-JS kit and reports its node types', () => {
    const rt = fakeRuntime();
    const result = loadCloudKitModules(rt, [tallyModule()], new Set());

    expect(result.registered).toEqual(['Tally Kit']);
    expect(result.nodeTypes).toEqual(['tally.kit.Accumulator']);
    expect(result.failures).toEqual([]);
    expect(rt.registered).toHaveLength(1);
  });

  it('adopts the manifest name, so a kit node is not "Unknown Module" in the cloud either', () => {
    // CN-003's defect, in the one bootstrap that did not exist when CN-003 was fixed: a kit calls
    // `defineModule({nodes})` with no `name`, so `registerModule` stamps `'Unknown Module'` on
    // every node unless something adopts the manifest name first.
    const rt = fakeRuntime();
    loadCloudKitModules(rt, [tallyModule()], new Set());
    expect(rt.registered[0].name).toBe('Tally Kit');
  });

  it('names the limit when a kit reaches for a module loader, instead of a bare ReferenceError', () => {
    const rt = fakeRuntime();
    const result = loadCloudKitModules(
      rt,
      [{ name: 'Stripe Kit', runtimes: ['cloud'], cloud: true, source: `var stripe = require('stripe');` }],
      new Set()
    );

    expect(result.registered).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].module).toBe('Stripe Kit');
    expect(result.failures[0].reason).toBe('needs-require');
    // D18's obligation is the *sentence*, not the failure: the author has to learn what is not
    // covered, and "require is not defined" does not say it.
    expect(result.failures[0].message).toContain(REQUIRE_LIMIT);
    expect(result.failures[0].message).toContain('no node_modules');
  });

  it('reports a kit that is not cloud-enabled as exactly that, rather than as nothing', () => {
    // The row that turns an unregistered node type into something an author can act on. Without
    // it, `runtimes: ["browser"]` and "no such kit" are the same observation with opposite fixes.
    const result = loadCloudKitModules(
      fakeRuntime(),
      [{ name: 'Cashflow Kit', runtimes: ['browser'], cloud: false, source: null }],
      new Set()
    );

    expect(result.registered).toEqual([]);
    expect(result.failures[0].reason).toBe('not-cloud-enabled');
    expect(result.failures[0].message).toContain('Cashflow Kit');
    expect(result.failures[0].message).toContain('Add "cloud"');
  });

  it('keeps a kit that throws from taking the kits after it with it', () => {
    const rt = fakeRuntime();
    const result = loadCloudKitModules(
      rt,
      [
        { name: 'Broken Kit', runtimes: ['cloud'], cloud: true, source: `throw new Error('kaboom');` },
        tallyModule()
      ],
      new Set()
    );

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toBe('threw');
    expect(result.failures[0].message).toContain('kaboom');
    // The one that matters: the healthy kit after it still registered.
    expect(result.registered).toEqual(['Tally Kit']);
  });

  it('reports a kit that ran and defined nothing, which is what a window-guarded kit does here', () => {
    const result = loadCloudKitModules(
      fakeRuntime(),
      [
        {
          name: 'Browser Only Kit',
          runtimes: ['cloud'],
          cloud: true,
          source: `if (typeof window !== 'undefined' && window.Noodl) { window.Noodl.defineModule({nodes: []}); }`
        }
      ],
      new Set()
    );

    expect(result.registered).toEqual([]);
    expect(result.failures[0].reason).toBe('no-module-defined');
  });

  it('registers a kit\'s logic half and skips its React half, reporting the skip', () => {
    // A kit may legitimately carry both. `reactNodes` are not nodes until
    // `createNodeFromReactComponent` has run, and that lives in the browser viewer.
    const rt = fakeRuntime();
    const result = loadCloudKitModules(
      rt,
      [
        {
          name: 'Mixed Kit',
          runtimes: ['cloud'],
          cloud: true,
          source: `Noodl.defineModule({ nodes: [{name: 'mixed.Logic', category: 'Math'}], reactNodes: [{name: 'mixed.Visual'}, {name: 'mixed.Visual2'}] });`
        }
      ],
      new Set()
    );

    expect(result.registered).toEqual(['Mixed Kit']);
    expect(result.nodeTypes).toEqual(['mixed.Logic']);
    expect(result.skippedReactNodes).toEqual([{ module: 'Mixed Kit', count: 2 }]);
    // Dropped before `registerModule` sees it, or `defineNode` gets a definition that is not one.
    expect(rt.registered[0].reactNodes).toBeUndefined();
  });

  it("runs a kit's `setup`, which is what registering before `setData` actually buys", async () => {
    /**
     * 🔴 This row exists because a mutation survived without it, and the comment it was defending
     * was wrong.
     *
     * `load()` registers kits before `setData`, and the reason written down first was
     * *"`importEditorData` resolves node types as it imports, so a type not in the register at that
     * moment is skipped with its connections"*. **Moving the registration after `setData` reddened
     * nothing** — because `CloudRunner` is constructed with `dontCreateRootComponent: true` and
     * builds its graph per request in `run()` via `createComponentInstanceNode`, long after
     * `setData` returned. Type resolution does not happen at load here.
     *
     * What the order *does* buy is this: `NoodlRuntime.setData` loops `this.noodlModules` and calls
     * each module's `setup`. A kit registered afterwards is not in that list yet, so its `setup`
     * never runs at all — silently, since nothing else refers to it.
     */
    const runner = new CloudRunner({});
    await runner.load(
      bundle(
        [],
        [
          {
            name: 'Setup Kit',
            runtimes: ['cloud'],
            cloud: true,
            source: `Noodl.defineModule({ nodes: [], setup: function () { this.__setupRan = true; } });`
          }
        ]
      )
    );

    const registered = (runner as any).runtime.noodlModules.filter((m: any) => m.name === 'Setup Kit');
    expect(registered).toHaveLength(1);
    expect(registered[0].__setupRan).toBe(true);
  });

  it('evaluates a kit once per runner even when two bundles carry it', () => {
    // `WorkflowRunner.loadWorkflow` rebuilds a candidate runner from EVERY loaded bundle, so one
    // runner sees the same kit once per project it serves. Re-running an entry script is a side
    // effect nobody asked for, and it pushes a duplicate into `noodlModules` whose `setup` then
    // runs twice.
    const rt = fakeRuntime();
    const seen = new Set<string>();
    const first = loadCloudKitModules(rt, [tallyModule()], seen);
    const second = loadCloudKitModules(rt, [tallyModule()], seen);

    expect(first.registered).toEqual(['Tally Kit']);
    expect(second.registered).toEqual([]);
    expect(rt.registered).toHaveLength(1);
  });
});

describe('a kit logic node inside a real cloud function (CN-012 M4, with the caller built)', () => {
  it('answers with the kit node\'s own arithmetic', async () => {
    const runner = new CloudRunner({});
    const load = await runner.load(bundle([tallyFunction('tally')], [tallyModule()]));

    expect(load.registered).toEqual(['Tally Kit']);

    const res: any = await runner.run('tally', { body: {}, headers: {} } as any, { timeoutMs: 4000 });

    expect(res.statusCode).toBe(200);
    // 7, not 1: the `step` parameter reached the kit node and its `add` ran once. A graph that
    // answered without the kit could not produce this number.
    expect(JSON.parse(res.body).result.total).toBe(7);
  });

  it('🔴 the control — the same graph with no `modules` never answers, which is the defect', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([tallyFunction('tallyNoKit')]));

    // CN-012 M4's first arm, reproduced: an unregistered type is logged and skipped WITH its
    // connections, so no Response node is ever reached. A hang, not an error.
    let thrown: unknown = null;
    try {
      await runner.run('tallyNoKit', { body: {}, headers: {} } as any, { timeoutMs: 1500 });
    } catch (e) {
      thrown = e;
    }
    expect(isCloudFunctionTimeout(thrown)).toBe(true);
  });

  it('🔴 the second control — a BUILT-IN in the same graph shape answers, so the harness is sound', async () => {
    // Without this, the timeout above would also be satisfied by a graph shape that never answers
    // for reasons unrelated to kits, and the passing row above would be the only evidence that the
    // wiring is right. `Counter`'s `increase` / `count` / `countChanged` are the same three plugs.
    const runner = new CloudRunner({});
    await runner.load(
      bundle([
        {
          name: '/#__cloud__/builtin',
          nodes: [
            {
              id: 'req',
              type: 'noodl.cloud.request',
              x: 0,
              y: 0,
              parameters: { allowNoAuth: true },
              ports: [],
              children: []
            },
            { id: 'c', type: 'Counter', x: 0, y: 100, parameters: {}, ports: [], children: [] },
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
            { sourceId: 'req', sourcePort: 'receive', targetId: 'c', targetPort: 'increase' },
            { sourceId: 'c', sourcePort: 'currentCount', targetId: 'res', targetPort: 'pm-total' },
            { sourceId: 'c', sourcePort: 'countChanged', targetId: 'res', targetPort: 'send' }
          ],
          roots: []
        }
      ])
    );

    const res: any = await runner.run('builtin', { body: {}, headers: {} } as any, { timeoutMs: 4000 });
    expect(res.statusCode).toBe(200);
    // ⚠️ The value is asserted, not just the status. A 200 alone would also be produced by a
    // `Count Changed` that fires at page load (the node's own docs say it does when Start Value is
    // set) — which would make this a control for "the Response node works", not for "the graph
    // shape carries a computed value out of the middle node".
    expect(JSON.parse(res.body).result.total).toBe(1);
  });

  it('serves the rest of a bundle when one kit cannot load', async () => {
    // A broken kit must not be an outage for functions that do not use it.
    const runner = new CloudRunner({});
    const load = await runner.load(
      bundle(
        [tallyFunction('tallyMixed')],
        [{ name: 'Broken Kit', runtimes: ['cloud'], cloud: true, source: `throw new Error('kaboom');` }, tallyModule()]
      )
    );

    expect(load.failures.map((f) => f.module)).toEqual(['Broken Kit']);

    const res: any = await runner.run('tallyMixed', { body: {}, headers: {} } as any, { timeoutMs: 4000 });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).result.total).toBe(7);
  });
});
