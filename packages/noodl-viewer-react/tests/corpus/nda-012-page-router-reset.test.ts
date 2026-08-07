/**
 * NDA-012 (Visual) — `Page Router`'s **reset** path, which is the one that runs on first load.
 *
 * NDA-004 §2 gave `navigateAsync` a full failure channel: both of its early returns now call
 * `args.hasFailed` with a code and a message
 * ([`router.tsx:577-591`](../../src/nodes/navigation/router.tsx)). `resetAsync` — the path
 * `RouterHandler.registerRouter` calls when a router mounts and nothing was queued — was not
 * touched, and it is the path every app takes before any Navigate node fires.
 *
 * Three defects, all in one 60-line method, and all of the same family: **the same value is
 * guarded on one line and dereferenced on another.**
 *
 * ✅ **Fixed 2026-08-01.** Every row below was written against the *defect* and has been flipped
 * to assert the fix; each defect's control row is kept beside it, because a control that still
 * passes is what says the fix did not simply short-circuit the method. `resetAsync` has no
 * `args` to carry a `hasFailed`, so it reports on the runtime error bus
 * (`FAILURE-CONTRACT.md`) — hence `raises` on the probe.
 *
 * ⚠️ **No outcome ports were added.** `OUTCOME-CONTRACT.md` / phase 35 `ERG-001` owns completion
 * signals for the Visual family as one collision sweep.
 *
 * The instance is hand-built with the definition's own methods bound onto it — the approach
 * `nda-004-navigation-failure.test.ts` established, and for its reason: `resetAsync` reaches
 * `NoodlRuntime.instance.graphModel` through `RouterHandler`, which a corpus graph does not
 * stand up. ⚠️ Bind the real methods **first** and the collaborators after, or a fake is
 * overwritten and every row passes by returning early.
 */

/* eslint-env jest */

import type { TSFixme } from '../../typings/global';

import RouterModule from '../../src/nodes/navigation/router';

type AnyFn = (...args: unknown[]) => unknown;

/** The hand-built instance: a bag of whatever `resetAsync` reaches for. */
type Probe = Record<string, TSFixme>;

/**
 * `resetAsync` reaches `Noodl.SEO.setTitle` as a bare global (router.tsx:328). The runtime
 * bootstrap puts it on `globalThis`; nothing here is about SEO, but the line has to be
 * reachable for the rows past it to mean anything.
 */
const titles: Array<string | undefined> = [];
beforeAll(() => {
  (globalThis as unknown as { Noodl: unknown }).Noodl = {
    SEO: { setTitle: (v: string | undefined) => titles.push(v) },
    Env: {}
  };
});

interface RouterProbe {
  instance: Probe;
  /** Ids passed to `nodeScope.createNode`, in order. */
  created: string[];
  /** Nodes passed to `nodeScope.deleteNode`, in order. */
  deleted: unknown[];
  /** `[code, message]` pairs raised on the runtime error bus, in order. */
  raises: Array<[string, string]>;
  /** The one node `nodeScope.createNode` hands back, so a row can assert identity. */
  content: unknown;
}

/**
 * A Page Router reduced to what `resetAsync` touches.
 *
 * `pageNodeCount` is how many `Page` nodes the routed component turns out to contain —
 * `resetAsync` requires exactly one and bails otherwise, which is the RT-1 row.
 */
function makeRouter(options: {
  pages?: { startPage?: string };
  matchFromUrl?: unknown;
  pageInfo?: { path: string; title: string; component: string };
  pageNodeCount?: number;
}): RouterProbe {
  const created: string[] = [];
  const deleted: unknown[] = [];
  const raises: Array<[string, string]> = [];

  const content = {
    nodeScope: {
      getNodesWithType: () => new Array(options.pageNodeCount === undefined ? 1 : options.pageNodeCount).fill({})
    }
  };

  const instance: Probe = {
    _internal: {
      pages: options.pages,
      currentPage: undefined,
      currentParams: undefined
    },
    children: [] as unknown[],
    nodeScope: {
      createNode: async (component: string) => {
        created.push(component);
        return content;
      },
      deleteNode: (node: unknown) => deleted.push(node),
      createPrimitiveNode: () => ({ setStyle() {}, addChild() {} })
    },
    flagOutputDirty() {
      /* currentPageTitle / currentPageComponent */
    },
    // `raiseRuntimeError` lives on `Node.prototype`, which a hand-built instance does not
    // inherit. Recording it here is what lets a row assert the code *and* that nothing threw.
    raiseRuntimeError: (code: string, message: string) => {
      raises.push([code, message]);
    }
  };

  const methods = (RouterModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
  for (const key of Object.keys(methods)) instance[key] = methods[key].bind(instance);

  // Collaborators AFTER the real methods, so these win.
  instance.getChildren = () => instance.children;
  instance.addChild = (child: unknown) => instance.children.push(child);
  instance.removeChild = (child: unknown) => {
    const i = instance.children.indexOf(child);
    if (i !== -1) instance.children.splice(i, 1);
  };
  instance.scrollToTop = () => {
    /* needs a DOM */
  };
  instance.matchPageFromUrl = () => options.matchFromUrl;
  instance._updatePageInputs = () => {
    /* Page Inputs nodes */
  };
  instance.createPageContainer = () => ({ addChild() {} });

  return { instance, created, deleted, raises, content };
}

/**
 * `getPageInfoForComponent` is a `RouterHandler` singleton method reaching
 * `NoodlRuntime.instance`. Every row controls what it returns.
 */
function withPageInfo(info: unknown, run: () => Promise<void>) {
  const handler = require('../../src/nodes/navigation/router-handler').RouterHandler;
  const original = handler.instance.getPageInfoForComponent;
  handler.instance.getPageInfoForComponent = () => info;
  return run().finally(() => {
    handler.instance.getPageInfoForComponent = original;
  });
}

const PAGE = { path: 'home', title: 'Home', component: '/Home' };

describe('RT-3 — an unconfigured Pages list reports instead of throwing', () => {
  // `pages` has no `default` (router.tsx:141-152), so `_internal.pages` is `undefined` until
  // an author fills the Pages list. `resetAsync` guarded exactly that read on line 280 —
  // `this._internal.pages !== undefined ? … : undefined` — and then dereferenced it bare on
  // line 292, in the else branch of the very same `if`.
  //
  // ⚠️ The finding cited `:272`/`:284`; the pair had shifted to `:280`/`:292` by the time it was
  // fixed. Same two reads, same `if`/`else`, and they are now **one** read.
  //
  // The bare branch was reached whenever `matchPageFromUrl()` returned undefined, which it does
  // when the router has no pages to match against (router.tsx:503). So this was not an exotic
  // path: it is a Page Router that has been dropped on a canvas and not configured yet.
  it('says the Pages list is empty rather than throwing a TypeError', async () => {
    const { instance, created, raises } = makeRouter({ pages: undefined, matchFromUrl: undefined });

    await expect(instance.resetAsync()).resolves.toBeUndefined();

    expect(raises).toEqual([['router/no-pages', expect.stringContaining('no Pages configured')]]);
    expect(created).toEqual([]);
  });

  // The control: the once-guarded branch reached the same undefined by a different route, and
  // still must not throw — nor be silent about it, which it used to be.
  it('the other route to the same undefined reports identically', async () => {
    const { instance, created, raises } = makeRouter({
      pages: undefined,
      matchFromUrl: { page: undefined, params: {} }
    });

    await expect(instance.resetAsync()).resolves.toBeUndefined();

    expect(raises).toEqual([['router/no-pages', expect.stringContaining('no Pages configured')]]);
    expect(created).toEqual([]);
  });

  // Configured but with no start page picked is a different mistake with a different fix, so it
  // gets its own code rather than being folded into "no Pages".
  it('a Pages list with no start page is reported separately', async () => {
    const { instance, created, raises } = makeRouter({ pages: { startPage: undefined }, matchFromUrl: undefined });

    await expect(instance.resetAsync()).resolves.toBeUndefined();

    expect(raises).toEqual([['router/no-start-page', expect.stringContaining('no start page')]]);
    expect(created).toEqual([]);
  });
});

describe('RT-2 — a start page that is not in the router index is read as "already there"', () => {
  // `getPageInfoForComponent` is typed `ComponentPageInfo | undefined` and returns
  // `routerIndex.pages.find(…)`. `resetAsync` compares its result against the current page by
  // **identity** (`:292`) to decide whether anything needs doing — and on a fresh router both
  // sides are `undefined`, so a start page that resolves to nothing is indistinguishable from
  // "we are already showing it".
  //
  // ⚠️ This was predicted as a throw and was not one. It was worse: the router returned having
  // built nothing, rendered nothing and said nothing, and it did so on every subsequent
  // reset for the same reason. An app whose start page component is missing from the router
  // index showed a permanently blank router.
  //
  // The fix resolves the target *before* comparing, and a target that resolves to nothing is
  // now its own reported outcome rather than being absorbed by an identity test against
  // `undefined`. The variable is named `targetPage` for the same reason — calling it
  // `currentPage` is what made the comparison read as correct.
  it('the first reset still builds nothing, and now says why', async () => {
    const { instance, created, raises } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(undefined, async () => {
      await expect(instance.resetAsync()).resolves.toBeUndefined();
    });

    expect(raises).toEqual([['router/page-not-found', expect.stringContaining('"/Home" is not a page of this Router')]]);
    expect(created).toEqual([]);
    expect(instance.children).toEqual([]);
    expect(instance._internal.currentPage).toBeUndefined();
  });

  // Once a page HAS been shown, the identity comparison no longer absorbed it, and the bare
  // dereference of `currentPage.title` further down was reached. Both rows are the same missing
  // guard, so both are closed by resolving the target once and reporting when it is undefined.
  it('a later reset that resolves to nothing reports rather than throwing on `.title`', async () => {
    const { instance, raises } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });
    instance._internal.currentPage = PAGE;

    await withPageInfo(undefined, async () => {
      await expect(instance.resetAsync()).resolves.toBeUndefined();
    });

    expect(raises).toEqual([['router/page-not-found', expect.stringContaining('"/Home" is not a page of this Router')]]);
    // It reported instead of navigating, so the page already on screen is left alone.
    expect(instance._internal.currentPage).toBe(PAGE);
  });

  it('the control: with page info present the same call completes silently', async () => {
    const { instance, created, raises } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(PAGE, async () => {
      await expect(instance.resetAsync()).resolves.toBeUndefined();
    });
    expect(created).toEqual(['/Home']);
    expect(raises).toEqual([]);
  });
});

describe('RT-1 — a routed component with no Page node is dropped, reported, and not leaked', () => {
  // `resetAsync` creates the component and *then* checks that it contains exactly one `Page`
  // node. The bail used to be a bare `return`: the node it had just created was never added to
  // the tree and never deleted, and nothing was reported anywhere — no `hasFailed` (reset has
  // no args to carry one), no `sendWarning`, no runtime error. Worse, `currentPageComponent`
  // had already been assigned to it one line earlier, so the output went on pointing at a node
  // that was not in the tree.
  //
  // Contrast `navigateAsync`, which NDA-004 §2 gave a code and a message for both of its drops.
  // The reset path took the same class of mistake — a component wired as a page that is not
  // one — and said nothing, on the code path that runs before any Navigate node exists.
  it.each([
    ['no Page node', 0, 'has none'],
    ['two Page nodes', 2, 'has 2']
  ])('%s: the created node is torn down and the drop is reported', async (_label, count, expectedCount) => {
    const { instance, created, deleted, raises, content } = makeRouter({
      pages: { startPage: '/Home' },
      matchFromUrl: undefined,
      pageNodeCount: count as number
    });

    await withPageInfo(PAGE, async () => {
      await expect(instance.resetAsync()).resolves.toBeUndefined();
    });

    // It was built…
    expect(created).toEqual(['/Home']);
    // …correctly not attached, because it is not a page…
    expect(instance.children).toEqual([]);
    // …and now torn down rather than leaked.
    expect(deleted).toEqual([content]);
    // …and said so, with the count that makes the mistake diagnosable.
    expect(raises).toEqual([
      ['router/component-is-not-a-page', expect.stringContaining(`exactly one Page node, and this one ${expectedCount}`)]
    ]);
    // The children were torn down before the component was built, so the router shows nothing.
    // Leaving `currentPage` set would let the identity check absorb the next reset back to it.
    expect(instance._internal.currentPage).toBeUndefined();
    expect(instance._internal.currentPageComponent).toBeUndefined();
  });

  it('the control: one Page node and the component is attached', async () => {
    const { instance, created, deleted, raises } = makeRouter({
      pages: { startPage: '/Home' },
      matchFromUrl: undefined,
      pageNodeCount: 1
    });

    await withPageInfo(PAGE, async () => {
      await instance.resetAsync();
    });

    expect(created).toEqual(['/Home']);
    expect(instance.children).toHaveLength(1);
    expect(deleted).toEqual([]);
    expect(raises).toEqual([]);
  });
});
