/**
 * NDA-004 §2, register ⏳ item 4 — the two navigation nodes that could not say they had not moved.
 *
 * Both take an author `Do` (`Navigate`, group `Actions`) and both had exactly one output,
 * `Navigated`. Every way the navigation could be dropped was a bare `return` one or two layers
 * down, in a collaborator the node never heard back from — so a Navigate button that pointed
 * somewhere invalid was, from the canvas, a button that did nothing.
 *
 * ## Five drops, and where they lived
 *
 * **Push Component To Stack** (`PageStackNavigate` → `navigation-stack.tsx`):
 *
 * - the Component Stack has no components configured — `navigateAsync`/`replaceAsync` line 1;
 * - a navigation is still animating — the *same* case NDA-008 §3 fixed for the Pop node, where
 *   it was described as "the one authors actually hit", left unfixed on the push side;
 * - the Target Page does not resolve. This is the headline. `target` is an **enum** input, and
 *   a wire can feed an enum any string at all — the States lesson from batch 3 — so a component
 *   renamed in the editor while something upstream still spells it the old way stops navigating
 *   and nothing anywhere says so.
 *
 * **Navigate** (`RouterNavigate` → `router.tsx`):
 *
 * - no Target Page set;
 * - the target is not a page of this Router. That return carried the author's own admission:
 *   `//TODO: send error to editor, "invalid page component name"`.
 *
 * ## Why the report goes to the node and not the stack
 *
 * NDA-008 §3 settled this for `back()`: the Component Stack did not fail, the node that asked
 * it to act did, and that node is the one carrying the `Failure` port and the provenance an
 * author can act on. The one difference is the call shape — `back()` is synchronous and returns
 * a `StackBackResult`, while `navigate`/`replace` go through the stack's `asyncQueue`, so by the
 * time the outcome is known the caller's frame is gone. Hence a `hasFailed` callback, sitting
 * beside the `hasNavigated` that was already there.
 *
 * `hasFailed` is optional on both arg types, and the reason is not politeness: a project's own
 * JavaScript reaches both handlers (`Noodl.Navigation.navigate`, `api/navigation.ts`) and
 * supplies neither callback. Falling back to raising on the *stack* would put the diagnosis for
 * a script's mistake onto a node the author did not write.
 *
 * ## ⚠️ Updated by ERG-001 §4
 *
 * The navigation family adopted the outcome contract, so every invocation now also emits
 * `Completed`, and `navigated` became `done` — §0.2 Result 2's one concept under a fifth wire
 * name. The claims these rows make are unchanged; the port names and the extra pulse are not.
 * `erg-001-navigation-outcomes.test.ts` pins the contract itself.
 *
 * ## Not fixed, deliberately
 *
 * A Stack (or Router) **name** that matches nothing is *queued*, not dropped —
 * `NavigationHandler._performNavigation` holds it for a stack that may still mount. At the
 * instant of the call a typo and a not-yet-mounted stack are indistinguishable, so there is
 * nothing honest to raise. That is the Component Stack's own 🔵 reasoning, one level out.
 */

/* eslint-env jest */

/**
 * The transition registry, faked — `nda-008-stack-replace-transition.test.ts`'s reason exactly.
 * Under `testEnvironment: node` there is no `window.performance`, so a real transition completes
 * synchronously and `isTransitioning` is never observably true. The transitioning row below needs
 * to hold one open.
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
      // Held open deliberately.
      this.record.end = args.end;
    }
  }
  return { __esModule: true, default: { None: FakeTransition, Push: FakeTransition, Popup: FakeTransition } };
});

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NavigateModule from '../../src/nodes/navigation/navigate';
import NavigationHandler from '../../src/nodes/navigation/navigation-handler';
import PageStackModule from '../../src/nodes/navigation/navigation-stack';
import { RouterHandler } from '../../src/nodes/navigation/router-handler';
import RouterModule from '../../src/nodes/navigation/router';
import RouterNavigateModule from '../../src/nodes/navigation/router-navigate';

type AnyFn = (...args: any[]) => any;

interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

/** A `Do` pulse and one settable value output, the corpus's usual pair. */
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

// ---------------------------------------------------------------------------------------------
// Push Component To Stack
// ---------------------------------------------------------------------------------------------

/**
 * A Component Stack reduced to what `navigateAsync`/`replaceAsync` touch, with the definition's
 * own methods bound on — `nda-008-stack-replace-transition.test.ts`'s approach, and its warning
 * applies here too: bind the real methods **first**, then the collaborators, or the fakes are
 * overwritten and every row passes by returning early on a page it cannot find.
 *
 * `_findPage` is deliberately *not* faked here. It is the function under test on the headline
 * row, and the nda-008 harness replaces it with one that always succeeds.
 */
function makeStack(pages: Array<{ id: string; label: string }>) {
  const stack: Record<string, any> = {
    _internal: {
      pages,
      pageInfo: Object.fromEntries(pages.map((p) => [p.id, { component: '/' + p.label }])),
      stack: [{ from: null, page: { id: 'root' }, pageId: 'root', pageInfo: { id: 'root' }, params: {} }],
      isTransitioning: false,
      // `navigate()`/`replace()` enqueue onto this; `settle`'s per-frame microtask+macrotask
      // yield is what lets the resulting promise land before a row asserts.
      asyncQueue: { enqueue: (fn: AnyFn) => fn() }
    },
    children: [] as unknown[],
    nodeScope: {
      createNode: async () => ({
        setInputValue() {
          /* page params */
        },
        addChild() {
          /* page content */
        },
        nodeScope: { getNodesWithType: () => [] }
      }),
      deleteNode() {
        /* teardown */
      }
    }
  };

  const methods = (PageStackModule as any).node.methods as Record<string, AnyFn>;
  for (const key of Object.keys(methods)) stack[key] = methods[key].bind(stack);

  stack.getChildren = () => stack.children;
  stack.addChild = (child: unknown) => stack.children.push(child);
  stack.removeChild = (child: unknown) => {
    const i = stack.children.indexOf(child);
    if (i !== -1) stack.children.splice(i, 1);
  };
  stack.createPageContainer = () => ({
    setInputValue() {
      /* position */
    },
    addChild() {
      /* page content */
    }
  });
  stack.setPageOutputs = () => {
    /* topPageName / stackDepth */
  };
  stack._updateUrlWithTopPage = () => {
    /* history */
  };
  stack.reset = () => {
    // `registerPageStack` calls this when nothing was queued; the real one builds a start page.
  };

  return stack;
}

let stackCounter = 0;
const registered: Array<{ name: string; stack: any }> = [];

/**
 * A Push Component To Stack node wired to a Trigger, and a Component Stack registered under a
 * name of its own.
 *
 * The name is per-graph because `NavigationHandler.instance` is a module singleton: reuse it and
 * the stack one row registered is the stack the next row navigates.
 */
async function pushGraph(options: {
  pages?: Array<{ id: string; label: string }>;
  mode?: 'push' | 'replace';
  register?: boolean;
}): Promise<{ graph: CorpusGraph; stack: any }> {
  const name = 'CorpusStack' + ++stackCounter;
  const stack = makeStack(options.pages === undefined ? [{ id: 'p1', label: 'One' }] : options.pages);

  if (options.register !== false) {
    NavigationHandler.instance.registerPageStack(name, stack as never);
    registered.push({ name, stack });
  }

  const graph = await createCorpusGraph({
    modules: [TriggerModule, NavigateModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            {
              id: 'nav',
              type: 'PageStackNavigate',
              parameters: { stack: name, mode: options.mode || 'push' }
            }
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

/** Put a Target Page on the wire, pulse `Navigate`, and let the async queue drain. */
async function press(graph: CorpusGraph, target?: string): Promise<void> {
  if (target !== undefined) graph.node<TriggerInstance>('trigger').send(target);
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(4);
}

afterEach(() => {
  for (const entry of registered) NavigationHandler.instance.deregisterPageStack(entry.name, entry.stack);
  registered.length = 0;
  constructed.length = 0;
});

describe('NDA-004 §2: Push Component To Stack', () => {
  test('a Target Page that does not resolve fires Failure instead of doing nothing quietly', async () => {
    const { graph } = await pushGraph({});
    await press(graph, 'no-such-page');

    expect(graph.signalsFor('nav')).toContain('failure');
    expect(graph.signalsFor('nav')).not.toContain('done');
  });

  test('the diagnosis reaches the runtime channel, with the name of the page it looked for', async () => {
    const { graph } = await pushGraph({});
    await press(graph, 'no-such-page');

    // Criterion 3 for this node. There was no message at all before — not an editor-only one,
    // as the Array mutators had; the return was bare.
    const raised = graph.errors.filter((e) => e.code === 'push-component-stack/component-not-found');
    expect(raised.length).toBe(1);
    expect(raised[0].message).toContain('no-such-page');
    expect(raised[0].nodeId).toBe('nav');
  });

  test('the Error output carries the message, so a graph can show it', async () => {
    const { graph } = await pushGraph({});
    await press(graph, 'no-such-page');

    // The contract forbids a bare `Failure` signal: "a bare signal reproduces 'no information'
    // one level up".
    expect(graph.node('nav').getOutput('error').value).toContain('no-such-page');
  });

  test('a Component Stack with nothing in its Components list is a distinct, separately coded failure', async () => {
    const { graph } = await pushGraph({ pages: [] });
    await press(graph, 'p1');

    expect(graph.signalsFor('nav')).toContain('failure');
    expect(graph.errors.map((e) => e.code)).toEqual(['push-component-stack/stack-has-no-components']);
  });

  /**
   * The symmetry row. NDA-008 §3 fixed exactly this on the Pop side and called it "the case
   * authors actually hit, because a double-tapped back button used to lose its second tap
   * without trace". The push side had the identical guard and was left silent.
   */
  test('a push while the stack is still animating reports, rather than losing the second tap', async () => {
    const { graph } = await pushGraph({});

    await press(graph, 'p1');
    expect(graph.signalsFor('nav')).toContain('done');
    expect(constructed).toHaveLength(1); // the transition is open, and stays open

    await press(graph, 'p1');

    expect(graph.signalsFor('nav')).toContain('failure');
    expect(graph.errors.map((e) => e.code)).toEqual(['push-component-stack/stack-transitioning']);
  });

  test('replace mode reports the same failures through the same port', async () => {
    const { graph } = await pushGraph({ mode: 'replace' });
    await press(graph, 'no-such-page');

    // `replaceAsync` is a separate function with its own copy of all three guards, which is
    // exactly how the push side stayed silent while the pop side was fixed.
    expect(graph.signalsFor('nav')).toContain('failure');
    expect(graph.errors.map((e) => e.code)).toEqual(['push-component-stack/component-not-found']);
  });

  // ✅ Pinned control. Without this every row above is equally consistent with a node that has
  // simply stopped navigating.
  test('(pinned control) a Target Page that resolves navigates, says Done, and raises nothing', async () => {
    const { graph, stack } = await pushGraph({});
    await press(graph, 'p1');

    expect(graph.signalsFor('nav')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);
    expect(stack._internal.stack).toHaveLength(2);
  });

  // ✅ Pinned control. The trigger is an author `Do`, so the port must be silent while the graph
  // boots and while a Target Page arrives on the wire — the Object node's trap, checked rather
  // than assumed.
  test('(pinned control) booting and receiving a Target Page raises nothing on their own', async () => {
    const { graph } = await pushGraph({});
    graph.node<TriggerInstance>('trigger').send('no-such-page');
    await graph.settle(4);

    expect(graph.signalsFor('nav')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  /**
   * `signalsFor` records a port name *before* delegating, and `sendSignalOnOutput` on a name the
   * node lacks only `console.log`s — so deleting the `failure` output leaves every row above
   * green. These are what actually hold the graph surface in place.
   */
  test('the ports exist on the node, not just in the signal log', async () => {
    const { graph } = await pushGraph({});
    const nav = graph.node('nav');

    expect(nav.hasOutput('done')).toBe(true);
    expect(nav.hasOutput('completed')).toBe(true);
    expect(nav.hasOutput('failure')).toBe(true);
    expect(nav.hasOutput('error')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Navigate
// ---------------------------------------------------------------------------------------------

/**
 * A Router reduced to what `navigateAsync` touches, the same binding trick as the stack above.
 *
 * `_navigateInCurrentWindow` is faked: the real one creates a page component, sets an SEO title
 * and pushes browser history, none of which the two guards under test reach.
 */
function makeRouter() {
  const router: Record<string, any> = { _internal: { name: 'Main', asyncQueue: undefined }, navigated: [] };

  const methods = (RouterModule as any).node.methods as Record<string, AnyFn>;
  for (const key of Object.keys(methods)) router[key] = methods[key].bind(router);

  // `navigate()` enqueues onto `_internal.asyncQueue`, which `initialize` builds; the rows below
  // call `navigateAsync` through the handler, so a queue that runs its thunk at once is enough.
  router._internal.asyncQueue = { enqueue: (fn: AnyFn) => fn() };
  router.navigate = (args: unknown) => router.navigateAsync(args);
  router.reset = () => {
    /* `registerRouter` calls this when nothing was queued */
  };
  // ERG-001 §4 split the already-showing guard out of `_navigateInCurrentWindow` into it and
  // `_buildPage`; these rows are about `navigateAsync`'s two drops, which sit above both.
  router._navigateInCurrentWindow = async (_page: unknown, args: { hasNavigated?: () => void }) => {
    router.navigated.push(_page);
    args.hasNavigated && args.hasNavigated();
  };

  return router;
}

let routerCounter = 0;
const registeredRouters: Array<{ name: string; router: any }> = [];
const realGetPageInfo = RouterHandler.instance.getPageInfoForComponent;

async function navigateGraph(options: { pages?: string[]; target?: string }): Promise<CorpusGraph> {
  const name = 'CorpusRouter' + ++routerCounter;
  const router = makeRouter();
  router._internal.name = name;
  RouterHandler.instance.registerRouter(name, router as never);
  registeredRouters.push({ name, router });

  // `getPageInfoForComponent` reads `NoodlRuntime.instance.graphModel.routerIndex`, a global the
  // corpus does not stand up. The pages this router serves are the input to the guard under test,
  // so they are supplied directly.
  const pages = options.pages || [];
  RouterHandler.instance.getPageInfoForComponent = (component: string) =>
    pages.includes(component) ? { path: '/' + component, title: component, component } : undefined;

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

/**
 * `RouterHandler.navigate` defers by 1ms so other nodes get a frame before the page is destroyed.
 * `settle`'s per-frame `setTimeout(0)` is a macrotask but not necessarily a millisecond, so the
 * wait is explicit rather than left to how fast the machine is.
 */
async function pressNavigate(graph: CorpusGraph): Promise<void> {
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(2);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await graph.settle(2);
}

afterEach(() => {
  for (const entry of registeredRouters) RouterHandler.instance.deregisterRouter(entry.name, entry.router);
  registeredRouters.length = 0;
  RouterHandler.instance.getPageInfoForComponent = realGetPageInfo;
});

describe('NDA-004 §2: Navigate', () => {
  test('a target that is not a page of this Router fires Failure instead of returning quietly', async () => {
    const graph = await navigateGraph({ pages: ['/Home'], target: '/Gone' });
    await pressNavigate(graph);

    expect(graph.signalsFor('nav')).toContain('failure');
    expect(graph.signalsFor('nav')).not.toContain('done');

    // The return this replaces carried `//TODO: send error to editor, "invalid page component
    // name"` — the diagnosis was known and simply had nowhere to go.
    const raised = graph.errors.filter((e) => e.code === 'navigate/page-not-found');
    expect(raised.length).toBe(1);
    expect(raised[0].message).toContain('/Gone');
    expect(graph.node('nav').getOutput('error').value).toContain('/Gone');
  });

  test('no Target Page at all is a distinct, separately coded failure', async () => {
    const graph = await navigateGraph({ pages: ['/Home'] });
    await pressNavigate(graph);

    expect(graph.signalsFor('nav')).toContain('failure');
    expect(graph.errors.map((e) => e.code)).toEqual(['navigate/no-target-page']);
  });

  // ✅ Pinned control.
  test('(pinned control) a target the Router serves navigates, says Done, and raises nothing', async () => {
    const graph = await navigateGraph({ pages: ['/Home'], target: '/Home' });
    await pressNavigate(graph);

    expect(graph.signalsFor('nav')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);
  });

  // ✅ Pinned control. An author `Do` again — nothing may fire before the button is pressed.
  test('(pinned control) booting raises nothing on its own', async () => {
    const graph = await navigateGraph({ pages: ['/Home'] });
    await graph.settle(4);

    expect(graph.signalsFor('nav')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  test('the ports exist on the node, not just in the signal log', async () => {
    const graph = await navigateGraph({ pages: ['/Home'], target: '/Home' });
    const nav = graph.node('nav');

    expect(nav.hasOutput('done')).toBe(true);
    expect(nav.hasOutput('completed')).toBe(true);
    expect(nav.hasOutput('failure')).toBe(true);
    expect(nav.hasOutput('error')).toBe(true);
  });
});
