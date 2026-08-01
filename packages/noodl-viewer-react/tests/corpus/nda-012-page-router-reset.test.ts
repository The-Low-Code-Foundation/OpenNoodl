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
 * The instance is hand-built with the definition's own methods bound onto it — the approach
 * `nda-004-navigation-failure.test.ts` established, and for its reason: `resetAsync` reaches
 * `NoodlRuntime.instance.graphModel` through `RouterHandler`, which a corpus graph does not
 * stand up. ⚠️ Bind the real methods **first** and the collaborators after, or a fake is
 * overwritten and every row passes by returning early.
 */

/* eslint-env jest */

import RouterModule from '../../src/nodes/navigation/router';

type AnyFn = (...args: any[]) => any;

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
  instance: Record<string, any>;
  /** Ids passed to `nodeScope.createNode`, in order. */
  created: string[];
  /** Nodes passed to `nodeScope.deleteNode`, in order. */
  deleted: unknown[];
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

  const content = {
    nodeScope: {
      getNodesWithType: () => new Array(options.pageNodeCount === undefined ? 1 : options.pageNodeCount).fill({})
    }
  };

  const instance: Record<string, any> = {
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
    }
  };

  const methods = (RouterModule as any).node.methods as Record<string, AnyFn>;
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

  return { instance, created, deleted };
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

describe('RT-3 — an unconfigured Pages list throws instead of reporting', () => {
  // `pages` has no `default` (router.tsx:140-150), so `_internal.pages` is `undefined` until
  // an author fills the Pages list. `resetAsync` guards exactly that read on line 272 —
  // `this._internal.pages !== undefined ? … : undefined` — and then dereferences it bare on
  // line 284, in the else branch of the very same `if`.
  //
  // The else branch is reached whenever `matchPageFromUrl()` returns undefined, which it does
  // when the router has no pages to match against (router.tsx:495). So this is not an exotic
  // path: it is a Page Router that has been dropped on a canvas and not configured yet.
  it('throws a TypeError rather than saying the Pages list is empty', async () => {
    const { instance } = makeRouter({ pages: undefined, matchFromUrl: undefined });

    await expect(instance.resetAsync()).rejects.toThrow(TypeError);
  });

  // The control: the guarded branch, same read, same undefined, no throw.
  it('the guarded branch on line 272 handles the identical value', async () => {
    const { instance, created } = makeRouter({ pages: undefined, matchFromUrl: { page: undefined, params: {} } });

    await expect(instance.resetAsync()).resolves.toBeUndefined();
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
  // ⚠️ This was predicted as a throw and is not one. It is worse: the router returns having
  // built nothing, rendered nothing and said nothing, and it will do so on every subsequent
  // reset for the same reason. An app whose start page component is missing from the router
  // index shows a permanently blank router.
  it('the first reset builds nothing and reports nothing', async () => {
    const { instance, created } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(undefined, async () => {
      await expect(instance.resetAsync()).resolves.toBeUndefined();
    });

    expect(created).toEqual([]);
    expect(instance.children).toEqual([]);
    expect(instance._internal.currentPage).toBeUndefined();
  });

  // Once a page HAS been shown, the identity comparison no longer absorbs it, and the bare
  // dereference at `:328` is reached. The same field is checked before use at `:209`, `:217`
  // and `:351`; `:328` is the one read that is not.
  it('a later reset that resolves to nothing throws on `.title`', async () => {
    const { instance } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });
    instance._internal.currentPage = PAGE;

    await withPageInfo(undefined, async () => {
      await expect(instance.resetAsync()).rejects.toThrow(TypeError);
    });
  });

  it('the control: with page info present the same call completes', async () => {
    const { instance, created } = makeRouter({ pages: { startPage: '/Home' }, matchFromUrl: undefined });

    await withPageInfo(PAGE, async () => {
      await expect(instance.resetAsync()).resolves.toBeUndefined();
    });
    expect(created).toEqual(['/Home']);
  });
});

describe('RT-1 — a routed component with no Page node is dropped, and leaks the node it made', () => {
  // `resetAsync` creates the component (`:314`) and *then* checks that it contains exactly one
  // `Page` node (`:318-321`). The bail is a bare `return`: the node it just created is never
  // added to the tree and never deleted, and nothing is reported anywhere — no `hasFailed`
  // (reset has no args to carry one), no `sendWarning`, no runtime error.
  //
  // Contrast `navigateAsync`, which NDA-004 §2 gave a code and a message for both of its drops.
  // The reset path takes the same class of mistake — a component wired as a page that is not
  // one — and says nothing, on the code path that runs before any Navigate node exists.
  it.each([
    ['no Page node', 0],
    ['two Page nodes', 2]
  ])('%s: the created node is neither mounted nor deleted', async (_label, count) => {
    const { instance, created, deleted } = makeRouter({
      pages: { startPage: '/Home' },
      matchFromUrl: undefined,
      pageNodeCount: count
    });

    await withPageInfo(PAGE, async () => {
      await expect(instance.resetAsync()).resolves.toBeUndefined();
    });

    // It was built…
    expect(created).toEqual(['/Home']);
    // …never attached…
    expect(instance.children).toEqual([]);
    // …and never torn down.
    expect(deleted).toEqual([]);
  });

  it('the control: one Page node and the component is attached', async () => {
    const { instance, created } = makeRouter({
      pages: { startPage: '/Home' },
      matchFromUrl: undefined,
      pageNodeCount: 1
    });

    await withPageInfo(PAGE, async () => {
      await instance.resetAsync();
    });

    expect(created).toEqual(['/Home']);
    expect(instance.children).toHaveLength(1);
  });
});
