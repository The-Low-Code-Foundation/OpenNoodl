/**
 * ERG-001 §4 — the navigation family, and the contract's one named exception.
 *
 * > **Navigation destroys the graph that would observe the signal.** `Navigate` and friends may
 * > complete in a context where no downstream node still exists. — `OUTCOME-CONTRACT.md`
 *
 * Six nodes, one file set, one design. What makes this slice different from the four before it
 * is that a corpus row genuinely cannot see the consequence of the successful path: the point of
 * a navigation is that the page goes away. So the rows below pin the paths that *do not*
 * navigate — the no-op re-selection, the failures, the mount path — and the live QA pass pins
 * the one they cannot.
 *
 * ## The three things that make the Reset half hard, each with a row
 *
 * 1. **`reset()` is called on mount, not only from the `Reset` input.** `router-handler.ts:83`
 *    and `navigation-handler.ts:90,106` both call it so the start page is created. A mount that
 *    fired `Done` would pulse every chain in the app at boot, so the mount path must report
 *    **nothing** — while still raising its diagnosis, which is what NDA-012 put there.
 * 2. **It is async through an `ASyncQueue`.** The token has to survive `await createNode`, which
 *    is exactly why `beginOutcome` returns a token rather than setting a flag on the node.
 * 3. **`resetAsync` already had four raise-and-return paths.** Each becomes `failure` carrying
 *    the code it already raised — through `reportOutcome`, not beside it, or the raise happens
 *    twice.
 *
 * ## ⚠️ `Navigated` / `Popped` became `Done`
 *
 * §0.2 Result 2 found eight ports displaying "Done" under four wire names. The navigation family
 * was a fifth and sixth: `navigated` on both Navigate nodes, `success` (displaying "Popped") on
 * the Pop node. Richard's 2026-08-02 decision — unify on `done` — applies, and the rows that
 * used to assert `'navigated'` are updated here rather than left as a second vocabulary.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | drop the token from `Router`'s `Reset` input | the four Router `Reset` outcome rows; the mount-path row stays green |
 * | `Router.resetAsync`'s already-showing branch back to a bare `return` | the two `Unchanged` rows only |
 * | `_navigateInCurrentWindow`'s already-showing check back out | the Navigate `Unchanged` rows; the real-navigation control stays green |
 * | `back()`'s `stack-at-root` back to `{ok:false}` | the Pop `Unchanged` row; the transitioning-`Failure` row stays green |
 */

/* eslint-env jest */

/**
 * The transition registry, faked — `nda-004-navigation-failure.test.ts`'s reason exactly. Under
 * `testEnvironment: node` there is no `window.performance`, so a real transition completes
 * synchronously and `isTransitioning` is never observably true.
 */
const constructed: Array<{ end?: () => void }> = [];

jest.mock('../../src/nodes/navigation/transitions', () => {
  class FakeTransition {
    record: { end?: () => void };
    constructor() {
      this.record = {};
      constructed.push(this.record);
    }
    forward() {
      /* the animated frame; nothing here reads styles */
    }
    start(args: { end?: () => void }) {
      this.record.end = args.end;
    }
  }
  return { __esModule: true, default: { None: FakeTransition, Push: FakeTransition, Popup: FakeTransition } };
});

import type { NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NavigateModule from '../../src/nodes/navigation/navigate';
import NavigateBackModule from '../../src/nodes/navigation/navigate-back';
import NavigationHandler from '../../src/nodes/navigation/navigation-handler';
import PageModule from '../../src/nodes/navigation/page';
import PageStackModule from '../../src/nodes/navigation/navigation-stack';
import { RouterHandler } from '../../src/nodes/navigation/router-handler';
import RouterModule from '../../src/nodes/navigation/router';
import RouterNavigateModule from '../../src/nodes/navigation/router-navigate';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;
type Probe = Record<string, any>;

// `Node.prototype` is what carries the real `beginOutcome` / `reportOutcome`. A hand-built probe
// does not inherit it, and stubbing the pair would test the harness rather than the contract —
// "exactly one per invocation" is the load-bearing half and it lives in `reportOutcome`.
/* eslint-disable @typescript-eslint/no-var-requires */
const RuntimeNode = require('@noodl/runtime/src/node');
/* eslint-enable @typescript-eslint/no-var-requires */

const OUTCOME_PORTS = ['done', 'unchanged', 'failure', 'completed'];

beforeAll(() => {
  (globalThis as unknown as { Noodl: unknown }).Noodl = {
    SEO: { setTitle: () => undefined },
    Env: {},
    Events: { emit: () => undefined }
  };
});

/** Everything a probe records, so a row can assert on the outcome *and* the error channel. */
interface Recorder {
  signals: string[];
  raises: Array<[string, string]>;
}

function attachOutcome(instance: Probe, recorder: Recorder, ports: string[] = OUTCOME_PORTS) {
  instance.hasOutput = (name: string) => ports.indexOf(name) !== -1;
  instance.sendSignalOnOutput = (name: string) => recorder.signals.push(name);
  instance.raiseRuntimeError = (code: string, message: string) => recorder.raises.push([code, message]);
  instance.beginOutcome = RuntimeNode.prototype.beginOutcome.bind(instance);
  instance.reportOutcome = RuntimeNode.prototype.reportOutcome.bind(instance);
}

/** The terminal outcomes only, in order — `completed` is asserted separately and on purpose. */
function outcomes(recorder: Recorder): string[] {
  return recorder.signals.filter((s) => s !== 'completed');
}

function countOf(recorder: Recorder, signal: string): number {
  return recorder.signals.filter((s) => s === signal).length;
}

// =================================================================================================
// Page Router — Reset
// =================================================================================================

const PAGE = { path: 'home', title: 'Home', component: '/Home' };

/**
 * A Page Router reduced to what `resetAsync` touches — `nda-012-page-router-reset.test.ts`'s
 * probe, extended with the outcome machinery.
 *
 * ⚠️ Bind the definition's real methods **first** and the collaborators after, or a fake is
 * overwritten and every row passes by returning early.
 */
function makeRouter(options: {
  pages?: { startPage?: string };
  matchFromUrl?: unknown;
  pageNodeCount?: number;
}): { instance: Probe; recorder: Recorder; created: string[] } {
  const created: string[] = [];
  const recorder: Recorder = { signals: [], raises: [] };

  const content = {
    nodeScope: {
      getNodesWithType: () => new Array(options.pageNodeCount === undefined ? 1 : options.pageNodeCount).fill({})
    }
  };

  const instance: Probe = {
    _internal: { pages: options.pages, currentPage: undefined, currentParams: undefined },
    children: [] as unknown[],
    nodeScope: {
      createNode: async (component: string) => {
        created.push(component);
        return content;
      },
      deleteNode: () => undefined,
      createPrimitiveNode: () => ({ setStyle() {}, addChild() {} })
    },
    flagOutputDirty: () => undefined
  };

  const methods = (RouterModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
  for (const key of Object.keys(methods)) instance[key] = methods[key].bind(instance);

  attachOutcome(instance, recorder);

  // Collaborators AFTER the real methods, so these win.
  instance.getChildren = () => instance.children;
  instance.addChild = (child: unknown) => instance.children.push(child);
  instance.removeChild = (child: unknown) => {
    const i = instance.children.indexOf(child);
    if (i !== -1) instance.children.splice(i, 1);
  };
  instance.scrollToTop = () => undefined;
  instance.matchPageFromUrl = () => options.matchFromUrl;
  instance._updatePageInputs = () => undefined;
  instance.createPageContainer = () => ({ addChild() {} });

  return { instance, recorder, created };
}

function withPageInfo(info: unknown, run: () => Promise<void>) {
  const original = RouterHandler.instance.getPageInfoForComponent;
  RouterHandler.instance.getPageInfoForComponent = () => info as never;
  return run().finally(() => {
    RouterHandler.instance.getPageInfoForComponent = original;
  });
}

/** One `Reset` pulse's worth of tokens, as the input handler mints them. */
function resetTokens(instance: Probe, count = 1): OutcomeToken[] {
  const tokens: OutcomeToken[] = [];
  for (let i = 0; i < count; i++) tokens.push(instance.beginOutcome());
  return tokens;
}

describe('ERG-001 §4: Page Router — Reset', () => {
  it('declares the contract ports, and an Unchanged it can genuinely reach', async () => {
    const definition = (RouterModule as unknown as { node: { outputs: Record<string, unknown> } }).node;
    for (const port of OUTCOME_PORTS) {
      expect(Object.keys(definition.outputs)).toContain(port);
    }
  });

  it('a rebuilt page is Done, then Completed, in that order', async () => {
    const { instance, recorder, created } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(PAGE, () => instance.resetAsync(resetTokens(instance)));

    expect(created).toEqual(['/Home']);
    expect(outcomes(recorder)).toEqual(['done']);
    expect(recorder.signals).toEqual(['done', 'completed']);
    expect(recorder.raises).toEqual([]);
  });

  it('a Reset onto the page already showing is Unchanged, not a Done that lies', async () => {
    const { instance, recorder, created } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });
    instance._internal.currentPageSnapshot = { ...PAGE };
    instance._internal.currentParams = {};

    await withPageInfo(PAGE, () => instance.resetAsync(resetTokens(instance)));

    // Nothing was rebuilt — that is the whole point of the branch, and until now it was silence.
    expect(created).toEqual([]);
    expect(outcomes(recorder)).toEqual(['unchanged']);
    expect(recorder.signals).toContain('completed');
    // "`Unchanged` does not raise." It is not an error.
    expect(recorder.raises).toEqual([]);
  });

  it('the same page with different parameters is Done — the Page Inputs really did change', async () => {
    const { instance, recorder, created } = makeRouter({
      pages: { startPage: '/Home' },
      matchFromUrl: { page: PAGE, params: { id: '7' }, query: {} }
    });
    instance._internal.currentPageSnapshot = { ...PAGE };
    instance._internal.currentParams = { id: '3' };
    // A router that is already showing a page always has the component too — the pair is
    // assigned together on the success path — and the parameter branch dereferences it.
    instance._internal.currentPageComponent = { nodeScope: {} };

    await withPageInfo(PAGE, () => instance.resetAsync(resetTokens(instance)));

    expect(created).toEqual([]);
    expect(outcomes(recorder)).toEqual(['done']);
  });

  it.each([
    ['no Pages list at all', undefined as unknown as { startPage?: string }, 'router/no-pages'],
    ['a Pages list with no start page', { startPage: undefined }, 'router/no-start-page']
  ])('%s is a Failure carrying the code it already raised, raised once', async (_label, pages, code) => {
    const { instance, recorder } = makeRouter({ pages, matchFromUrl: undefined });

    await instance.resetAsync(resetTokens(instance));

    expect(outcomes(recorder)).toEqual(['failure']);
    expect(recorder.signals).toContain('completed');
    // ⚠️ Once. `resetAsync` raised these itself before ERG-001; leaving that raise beside
    // `reportOutcome` — which raises too — would put two events on the channel for one drop.
    expect(recorder.raises.map((r) => r[0])).toEqual([code]);
  });

  it('a start page the Router does not serve is a Failure, not a silent blank router', async () => {
    const { instance, recorder } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(undefined, () => instance.resetAsync(resetTokens(instance)));

    expect(outcomes(recorder)).toEqual(['failure']);
    expect(recorder.raises.map((r) => r[0])).toEqual(['router/page-not-found']);
  });

  it('a routed component that is not a page is a Failure, and still torn down', async () => {
    const { instance, recorder, created } = makeRouter({
      pages: { startPage: '/Home' },
      matchFromUrl: undefined,
      pageNodeCount: 0
    });

    await withPageInfo(PAGE, () => instance.resetAsync(resetTokens(instance)));

    expect(created).toEqual(['/Home']);
    expect(outcomes(recorder)).toEqual(['failure']);
    expect(recorder.raises.map((r) => r[0])).toEqual(['router/component-is-not-a-page']);
  });

  /**
   * ⚠️ The row this whole design exists for.
   *
   * `RouterHandler.registerRouter` calls `router.reset()` with no token so the start page is
   * created. That is not an invocation of the author's `Reset` port, and a `Done` here would
   * pulse every chain in the app at boot.
   */
  it('the mount path reports nothing at all — and still raises its diagnosis', async () => {
    const { instance, recorder } = makeRouter({ pages: undefined, matchFromUrl: undefined });

    await instance.resetAsync();

    expect(recorder.signals).toEqual([]);
    // NDA-012 put this raise here and it must survive the adoption: an unconfigured Page Router
    // dropped on a canvas is diagnosed on mount, which is the only time anyone sees it.
    expect(recorder.raises.map((r) => r[0])).toEqual(['router/no-pages']);
  });

  it('the mount path reports nothing on the success path either', async () => {
    const { instance, recorder, created } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(PAGE, () => instance.resetAsync());

    expect(created).toEqual(['/Home']);
    expect(recorder.signals).toEqual([]);
  });

  /**
   * Undo's lesson, one node along: coalescing the *work* is right, coalescing the *outcomes*
   * loses invocations. Two `Reset` pulses in a frame rebuild once and report twice.
   */
  it('two Reset pulses coalesced into one rebuild still report two outcomes', async () => {
    const { instance, recorder, created } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(PAGE, () => instance.resetAsync(resetTokens(instance, 2)));

    expect(created).toEqual(['/Home']);
    expect(outcomes(recorder)).toEqual(['done', 'done']);
    expect(countOf(recorder, 'completed')).toBe(2);
  });

  it('the Reset input opens an invocation, and the mount path does not', async () => {
    const { instance } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });
    const scheduled: AnyFn[] = [];
    instance.scheduleAfterInputsHaveUpdated = (fn: AnyFn) => scheduled.push(fn);

    const seen: unknown[] = [];
    instance.reset = (tokens: unknown) => seen.push(tokens);

    const inputs = (RouterModule as unknown as { node: { inputs: Record<string, AnyFn & { valueChangedToTrue: AnyFn }> } })
      .node.inputs;
    inputs.reset.valueChangedToTrue.call(instance);
    scheduled.forEach((fn) => fn());

    expect(Array.isArray(seen[0])).toBe(true);
    expect((seen[0] as unknown[]).length).toBe(1);
  });
});

// =================================================================================================
// Component Stack — Reset
// =================================================================================================

/**
 * ⚠️ **No `Unchanged` port, deliberately.** "A node that cannot be a no-op gets no `Unchanged`
 * port." `PageStack.resetAsync` tears every child down and rebuilds the start component
 * unconditionally — even a reset that lands on the component already showing destroys and
 * recreates it, which is a change. An `Unchanged` here would be a port that can never fire, and
 * §5's dead-end check would then be right to complain about it.
 */
function makeStack(options: {
  pages?: Array<{ id: string; label: string }>;
  startPageId?: string;
}): { instance: Probe; recorder: Recorder; created: string[] } {
  const created: string[] = [];
  const recorder: Recorder = { signals: [], raises: [] };
  const pages = options.pages === undefined ? [{ id: 'p1', label: 'One' }] : options.pages;

  const instance: Probe = {
    _internal: {
      pages,
      pageInfo: Object.fromEntries(pages.map((p) => [p.id, { component: '/' + p.label }])),
      stack: [],
      startPageId: options.startPageId
    },
    children: [] as unknown[],
    nodeScope: {
      createNode: async (component: string) => {
        created.push(component);
        return { setInputValue() {}, addChild() {}, nodeScope: { getNodesWithType: () => [] } };
      },
      deleteNode: () => undefined
    }
  };

  const methods = (PageStackModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
  for (const key of Object.keys(methods)) instance[key] = methods[key].bind(instance);

  attachOutcome(instance, recorder, ['done', 'failure', 'completed']);

  instance.getChildren = () => instance.children;
  instance.addChild = (child: unknown) => instance.children.push(child);
  instance.removeChild = (child: unknown) => {
    const i = instance.children.indexOf(child);
    if (i !== -1) instance.children.splice(i, 1);
  };
  instance.matchPageFromUrl = () => undefined;
  instance.createPageContainer = () => ({ addChild() {} });
  instance.setPageOutputs = () => undefined;

  return { instance, recorder, created };
}

describe('ERG-001 §4: Component Stack — Reset', () => {
  it('declares Done, Failure and Completed — and no Unchanged it could never reach', () => {
    const outputs = (PageStackModule as unknown as { node: { outputs: Record<string, unknown> } }).node.outputs;

    expect(Object.keys(outputs)).toEqual(expect.arrayContaining(['done', 'failure', 'completed']));
    expect(Object.keys(outputs)).not.toContain('unchanged');
  });

  it('a rebuilt start component is Done, then Completed', async () => {
    const { instance, recorder, created } = makeStack({});

    await instance.resetAsync(resetTokens(instance));

    expect(created).toEqual(['/One']);
    expect(recorder.signals).toEqual(['done', 'completed']);
    expect(recorder.raises).toEqual([]);
  });

  it('an empty Components list is a Failure — it used to be a bare return', async () => {
    const { instance, recorder, created } = makeStack({ pages: [] });

    await instance.resetAsync(resetTokens(instance));

    expect(created).toEqual([]);
    expect(outcomes(recorder)).toEqual(['failure']);
    expect(recorder.raises.map((r) => r[0])).toEqual(['component-stack/no-components']);
  });

  it('a start component that does not resolve is a separately coded Failure', async () => {
    const { instance, recorder } = makeStack({ startPageId: 'nope' });

    await instance.resetAsync(resetTokens(instance));

    expect(outcomes(recorder)).toEqual(['failure']);
    expect(recorder.raises.map((r) => r[0])).toEqual(['component-stack/component-not-found']);
    expect(recorder.raises[0][1]).toContain('nope');
  });

  it('the mount path reports nothing, and still raises', async () => {
    const { instance, recorder } = makeStack({ pages: [] });

    await instance.resetAsync();

    expect(recorder.signals).toEqual([]);
    expect(recorder.raises.map((r) => r[0])).toEqual(['component-stack/no-components']);
  });
});

// =================================================================================================
// Navigate / Push Component To Stack / Pop Component Stack
// =================================================================================================

interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      go: { type: 'signal' },
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

// --- Navigate ------------------------------------------------------------------------------------

let routerCounter = 0;
const registeredRouters: Array<{ name: string; router: Probe }> = [];
const realGetPageInfo = RouterHandler.instance.getPageInfoForComponent;

/**
 * A Router whose `_navigateInCurrentWindow` is the **real** one down to the already-showing
 * check, so the `Unchanged` rows exercise the branch rather than a stand-in for it.
 */
function makeNavigableRouter(current?: { page: unknown; params: Record<string, unknown> }): Probe {
  const router: Probe = {
    _internal: {
      name: 'Main',
      currentPage: current && current.page,
      currentPageSnapshot: current && { ...(current.page as Record<string, unknown>) },
      currentParams: current && current.params
    },
    navigated: [] as unknown[]
  };

  const methods = (RouterModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
  for (const key of Object.keys(methods)) router[key] = methods[key].bind(router);

  router._internal.asyncQueue = { enqueue: (fn: AnyFn) => fn() };
  router.navigate = (args: unknown) => router.navigateAsync(args);
  router.reset = () => undefined;

  // Only the *rebuild* is faked. The guard under test sits above it, in the real method.
  router._buildPage = async (page: unknown, args: { hasNavigated?: () => void }) => {
    router.navigated.push(page);
    args.hasNavigated && args.hasNavigated();
  };

  return router;
}

async function navigateGraph(options: {
  pages?: string[];
  target?: string;
  current?: { page: unknown; params: Record<string, unknown> };
}): Promise<CorpusGraph> {
  const name = 'ErgRouter' + ++routerCounter;
  const router = makeNavigableRouter(options.current);
  router._internal.name = name;
  RouterHandler.instance.registerRouter(name, router as never);
  registeredRouters.push({ name, router });

  const pages = options.pages || [];
  RouterHandler.instance.getPageInfoForComponent = ((component: string) =>
    pages.indexOf(component) !== -1
      ? { path: '/' + component, title: component, component }
      : undefined) as never;

  return createCorpusGraph({
    modules: [TriggerModule, RouterNavigateModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            {
              id: 'nav',
              type: 'RouterNavigate',
              parameters: options.target === undefined ? { router: name } : { router: name, target: options.target }
            }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'nav', targetPort: 'navigate' }]
        }
      ]
    } as never
  });
}

/** `RouterHandler.navigate` defers by 1ms, so the wait is explicit rather than left to the machine. */
async function pressNavigate(graph: CorpusGraph): Promise<void> {
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(2);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await graph.settle(2);
}

afterEach(() => {
  for (const entry of registeredRouters) RouterHandler.instance.deregisterRouter(entry.name, entry.router as never);
  registeredRouters.length = 0;
  RouterHandler.instance.getPageInfoForComponent = realGetPageInfo;
  constructed.length = 0;
});

describe('ERG-001 §4: Navigate — the contract’s named exception', () => {
  it('the ports are the contract’s four, with Navigated renamed to Done', async () => {
    const graph = await navigateGraph({ pages: ['/Home'], target: '/Home' });
    const nav = graph.node('nav');

    for (const port of OUTCOME_PORTS) expect(nav.hasOutput(port)).toBe(true);
    expect(nav.hasOutput('error')).toBe(true);
    // §0.2 Result 2's fifth name for one concept.
    expect(nav.hasOutput('navigated')).toBe(false);
  });

  it('a real navigation is Done, then Completed', async () => {
    const graph = await navigateGraph({ pages: ['/Home'], target: '/Home' });
    await pressNavigate(graph);

    expect(graph.signalsFor('nav')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);
  });

  /**
   * The path the contract's exception is *about*: the one that does not navigate, so the graph
   * is still there to hear it. §0.3 filed this against `router.tsx:401-410` — which is
   * `resetAsync`, a different method. `navigateAsync` had no already-showing check at all: it
   * destroyed the page and rebuilt it, which is NDA-008 §2's finding on the Router side.
   */
  it('re-selecting the page already showing is Unchanged, and does not re-mount it', async () => {
    const graph = await navigateGraph({
      pages: ['/Home'],
      target: '/Home',
      current: { page: { path: '//Home', title: '/Home', component: '/Home' }, params: {} }
    });
    await pressNavigate(graph);

    expect(graph.signalsFor('nav')).toEqual(['unchanged', 'completed']);
    expect(graph.errors).toEqual([]);
    expect(registeredRouters[registeredRouters.length - 1].router.navigated).toEqual([]);
  });

  it('the same page with different parameters still navigates', async () => {
    const graph = await navigateGraph({
      pages: ['/Home'],
      target: '/Home',
      current: { page: { path: '//Home', title: '/Home', component: '/Home' }, params: { id: 3 } }
    });
    await pressNavigate(graph);

    expect(graph.signalsFor('nav')).toEqual(['done', 'completed']);
    expect(registeredRouters[registeredRouters.length - 1].router.navigated).toHaveLength(1);
  });

  it.each([
    ['no Target Page', undefined, 'navigate/no-target-page'],
    ['a target the Router does not serve', '/Gone', 'navigate/page-not-found']
  ])('%s is Failure then Completed, with the reason still on the channel', async (_label, target, code) => {
    const graph = await navigateGraph({ pages: ['/Home'], target: target as string | undefined });
    await pressNavigate(graph);

    expect(graph.signalsFor('nav')).toEqual(['failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual([code]);
    expect(graph.node('nav').getOutput('error').value).toBeTruthy();
  });

  it('(pinned control) booting fires nothing — the trigger is an author Do', async () => {
    const graph = await navigateGraph({ pages: ['/Home'], target: '/Home' });
    await graph.settle(4);

    expect(graph.signalsFor('nav')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});

// --- Push Component To Stack ---------------------------------------------------------------------

let stackCounter = 0;
const registeredStacks: Array<{ name: string; stack: Probe }> = [];

function makePushableStack(pages: Array<{ id: string; label: string }>, alreadyShowing?: string): Probe {
  const stack: Probe = {
    _internal: {
      pages,
      pageInfo: Object.fromEntries(pages.map((p) => [p.id, { component: '/' + p.label }])),
      stack: [
        {
          from: null,
          page: { id: 'root' },
          pageId: alreadyShowing || 'root',
          pageInfo: { id: alreadyShowing || 'root' },
          params: {}
        }
      ],
      isTransitioning: false,
      asyncQueue: { enqueue: (fn: AnyFn) => fn() }
    },
    children: [] as unknown[],
    nodeScope: {
      createNode: async () => ({
        setInputValue() {},
        addChild() {},
        nodeScope: { getNodesWithType: () => [] }
      }),
      deleteNode() {}
    }
  };

  const methods = (PageStackModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
  for (const key of Object.keys(methods)) stack[key] = methods[key].bind(stack);

  stack.getChildren = () => stack.children;
  stack.addChild = (child: unknown) => stack.children.push(child);
  stack.removeChild = (child: unknown) => {
    const i = stack.children.indexOf(child);
    if (i !== -1) stack.children.splice(i, 1);
  };
  stack.createPageContainer = () => ({ setInputValue() {}, addChild() {} });
  stack.setPageOutputs = () => undefined;
  stack._updateUrlWithTopPage = () => undefined;
  stack.reset = () => undefined;

  return stack;
}

async function pushGraph(options: {
  pages?: Array<{ id: string; label: string }>;
  mode?: 'push' | 'replace';
  alreadyShowing?: string;
}): Promise<{ graph: CorpusGraph; stack: Probe }> {
  const name = 'ErgStack' + ++stackCounter;
  const stack = makePushableStack(
    options.pages === undefined ? [{ id: 'p1', label: 'One' }] : options.pages,
    options.alreadyShowing
  );

  NavigationHandler.instance.registerPageStack(name, stack as never);
  registeredStacks.push({ name, stack });

  const graph = await createCorpusGraph({
    modules: [TriggerModule, NavigateModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'nav', type: 'PageStackNavigate', parameters: { stack: name, mode: options.mode || 'push' } }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'go', targetId: 'nav', targetPort: 'navigate' },
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'nav', targetPort: 'target' }
          ]
        }
      ]
    } as never
  });

  await graph.settle(3);
  return { graph, stack };
}

async function press(graph: CorpusGraph, target?: string): Promise<void> {
  if (target !== undefined) graph.node<TriggerInstance>('trigger').send(target);
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(4);
}

afterEach(() => {
  for (const entry of registeredStacks) NavigationHandler.instance.deregisterPageStack(entry.name, entry.stack as never);
  registeredStacks.length = 0;
});

describe('ERG-001 §4: Push Component To Stack', () => {
  it('the ports are the contract’s four', async () => {
    const { graph } = await pushGraph({});
    const nav = graph.node('nav');

    for (const port of OUTCOME_PORTS) expect(nav.hasOutput(port)).toBe(true);
    expect(nav.hasOutput('navigated')).toBe(false);
  });

  it('a push that lands is Done, then Completed', async () => {
    const { graph } = await pushGraph({});
    await press(graph, 'p1');

    expect(graph.signalsFor('nav')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);
  });

  /**
   * ⚠️ This one was **already measured and already collapsed**. NDA-008 §2 added
   * `_isAlreadyShowing` and made the no-op call `hasNavigated`, with the reasoning that
   * "swallowing the completion callback here would turn a re-selected tab into a dead button".
   * That was right at the time and the contract's `Unchanged` is what it was reaching for —
   * `Insert Object Into Array`'s lie, in a second node.
   */
  it('re-selecting the component already on top is Unchanged, not a Done that lies', async () => {
    const { graph, stack } = await pushGraph({ alreadyShowing: 'p1' });
    await press(graph, 'p1');

    expect(graph.signalsFor('nav')).toEqual(['unchanged', 'completed']);
    expect(stack._internal.stack).toHaveLength(1);
    expect(graph.errors).toEqual([]);
  });

  it.each([
    ['a target that does not resolve', [{ id: 'p1', label: 'One' }], 'no-such-page', 'component-not-found'],
    ['an empty Components list', [], 'p1', 'stack-has-no-components']
  ])('%s is Failure then Completed', async (_label, pages, target, code) => {
    const { graph } = await pushGraph({ pages: pages as Array<{ id: string; label: string }> });
    await press(graph, target as string);

    expect(graph.signalsFor('nav')).toEqual(['failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['push-component-stack/' + code]);
  });

  it('a push while the stack is still animating reports Failure, and the first push kept its Done', async () => {
    const { graph } = await pushGraph({});

    await press(graph, 'p1');
    expect(graph.signalsFor('nav')).toEqual(['done', 'completed']);

    await press(graph, 'p1');
    expect(graph.signalsFor('nav')).toEqual(['done', 'completed', 'failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['push-component-stack/stack-transitioning']);
  });

  it('replace mode reports through the same four ports', async () => {
    const { graph } = await pushGraph({ mode: 'replace' });
    await press(graph, 'no-such-page');

    expect(graph.signalsFor('nav')).toEqual(['failure', 'completed']);
  });
});

// --- Pop Component Stack -------------------------------------------------------------------------

async function popGraph(back: AnyFn): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, NavigateBackModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'pop', type: 'PageStackNavigateBack' }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'pop', targetPort: 'navigate' }]
        }
      ]
    } as never
  });

  if (back) (graph.node('pop') as unknown as { _setBackCallback(cb: AnyFn): void })._setBackCallback(back);
  return graph;
}

describe('ERG-001 §4: Pop Component Stack', () => {
  it('a pop that happens is Done, then Completed — `success` was a sixth name for it', async () => {
    const graph = await popGraph(() => ({ ok: true }));
    await press(graph);

    expect(graph.signalsFor('pop')).toEqual(['done', 'completed']);
    expect(graph.node('pop').hasOutput('success')).toBe(false);
  });

  /**
   * ⚠️ **A behaviour change, and a deliberate one.** NDA-008 §3 made "the stack is already at
   * its first component" a `Failure`. Undo's end-of-history was the identical shape and Build 2b
   * made it `Unchanged`, on the contract's reasoning that "a `Failure` that fires on a graph
   * working exactly as written is how authors are trained to ignore the port". A Back button on
   * the root component is exactly that graph.
   */
  it('a pop at the root of the stack is Unchanged, and raises nothing', async () => {
    const graph = await popGraph(() => ({ ok: false, unchanged: true }));
    await press(graph);

    expect(graph.signalsFor('pop')).toEqual(['unchanged', 'completed']);
    expect(graph.errors).toEqual([]);
  });

  /**
   * The other half of the same claim: the *stack* is what decides an end-stop is an end-stop,
   * and a row that only drives the node's callback would pass against a stack still returning
   * `{ok:false, code:'pop-component-stack/stack-at-root'}`.
   */
  it('the Component Stack returns the end-stop shape, not a coded failure', () => {
    const methods = (PageStackModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
    const stack: Probe = { _internal: { stack: [{}], isTransitioning: false } };
    for (const key of Object.keys(methods)) stack[key] = methods[key].bind(stack);

    expect(stack.back({})).toEqual({ ok: false, unchanged: true });

    stack._internal.stack = [{}, {}];
    stack._internal.isTransitioning = true;
    expect(stack.back({})).toEqual({
      ok: false,
      code: 'pop-component-stack/transition-in-progress',
      message: expect.any(String)
    });
  });

  it('(control) a pop dropped by a running transition is still a Failure that raises', async () => {
    const graph = await popGraph(() => ({
      ok: false,
      code: 'pop-component-stack/transition-in-progress',
      message: 'Still animating'
    }));
    await press(graph);

    expect(graph.signalsFor('pop')).toEqual(['failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['pop-component-stack/transition-in-progress']);
  });

  it('a Pop node outside a pushed component is a Failure', async () => {
    const graph = await popGraph(undefined as unknown as AnyFn);
    await press(graph);

    expect(graph.signalsFor('pop')).toEqual(['failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['pop-component-stack/no-stack-in-scope']);
  });
});

// =================================================================================================
// Page — Page Ready
// =================================================================================================

describe('ERG-001 §4: Page — Page Ready', () => {
  it('reports Done then Completed, after the SSR event it announces', async () => {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, PageModule as never],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'page', type: 'Page' }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'page', targetPort: 'onPageReady' }]
          }
        ]
      } as never
    });
    (graph.context as unknown as { styles: unknown }).styles = {
      getTextStyle: () => ({}),
      resolveColor: (c: unknown) => c
    };

    const events: string[] = [];
    graph.context.eventEmitter.on('SSR_PageReady', () => events.push('ready'));

    await press(graph);

    expect(events).toEqual(['ready']);
    expect(graph.signalsFor('page')).toEqual(['done', 'completed']);
    // "A node that cannot fail gets no Failure port"; announcing an event cannot fail, and it
    // cannot be a no-op either — every pulse announces.
    expect(graph.node('page').hasOutput('failure')).toBe(false);
    expect(graph.node('page').hasOutput('unchanged')).toBe(false);
  });
});
