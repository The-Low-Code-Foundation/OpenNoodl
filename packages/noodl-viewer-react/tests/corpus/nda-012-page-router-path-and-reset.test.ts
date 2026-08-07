/**
 * NDA-012 (Visual) — `Page Router`'s last two cells, `A2` and `D1`.
 *
 * `nda-012-page-router-reset.test.ts` covers RT-1/RT-2/RT-3, the three defects inside
 * `resetAsync`. These two are the ones that pass were explicitly told not to touch:
 *
 * - **`A2`** — an explicit `Reset` does not notice a page edited *in place*.
 * - **`D1`** — the location path is decoded **twice, by two different functions**.
 *
 * ## Both cells named the wrong mechanism, and in `A2`'s case fatally
 *
 * ⚠️ **`A2` was filed as identity-versus-value: "`resetAsync` compares page-info by identity".**
 * Changing `===` to a value comparison would have closed the cell and fixed **nothing**.
 * `RouterHandler.getPageInfoForComponent` returns the live entry out of
 * `graphModel.routerIndex.pages`, and `_internal.currentPage` was assigned *that same object* —
 * so an in-place edit mutates both sides of the comparison at once. Identity and value agree,
 * because there is only one object. What was missing was a **record of what had been rendered**,
 * which is what `currentPageSnapshot` is. Same shape as the `Group` `A3` cell in stream C:
 * a cell can be confident about which half is broken and be wrong.
 *
 * ⚠️ **`D1` was filed as "decoded twice and by two different rules".** True, and the sharp end
 * is that the second decode **throws**. `Navigate` encodes with `encodeURIComponent`, so a
 * parameter containing a literal `%` leaves as `a%25b`; `decodeURI` decodes `%25` because it is
 * not in the reserved set it protects; and `decodeURIComponent('a%b')` then raises
 * `URIError: URI malformed`. A page parameter with a percent sign in it took the router's whole
 * match down, uncaught.
 */

/* eslint-env jest */

import type { TSFixme } from '../../typings/global';

import NoodlRuntime from '@noodl/runtime';
import RouterModule from '../../src/nodes/navigation/router';

type AnyFn = (...args: unknown[]) => unknown;
type Probe = Record<string, TSFixme>;

const titles: Array<string | undefined> = [];
beforeAll(() => {
  (globalThis as unknown as { Noodl: unknown }).Noodl = {
    SEO: { setTitle: (v: string | undefined) => titles.push(v) },
    Env: {}
  };
});

const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;
afterAll(() => {
  (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
});

/**
 * A Page Router reduced to what these two methods touch.
 *
 * `useRealMatch` keeps the genuine `matchPageFromUrl` — the `D1` rows are about what that
 * method does to the URL, so stubbing it would measure nothing.
 */
function makeRouter(options: {
  pages?: { startPage?: string };
  matchFromUrl?: unknown;
  useRealMatch?: boolean;
  urlPath?: string;
}) {
  const created: string[] = [];
  const raises: Array<[string, string]> = [];

  const content = { nodeScope: { getNodesWithType: () => [{}] } };

  const instance: Probe = {
    _internal: {
      pages: options.pages,
      name: undefined,
      urlPath: options.urlPath,
      currentPage: undefined,
      currentPageSnapshot: undefined,
      currentParams: undefined
    },
    children: [] as unknown[],
    parent: undefined,
    nodeScope: {
      createNode: async (component: string) => {
        created.push(component);
        return content;
      },
      deleteNode: () => undefined,
      createPrimitiveNode: () => ({ setStyle() {}, addChild() {} })
    },
    flagOutputDirty() {
      /* currentPageTitle / currentPageComponent */
    },
    raiseRuntimeError: (code: string, message: string) => raises.push([code, message])
  };

  const methods = (RouterModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
  for (const key of Object.keys(methods)) instance[key] = methods[key].bind(instance);

  instance.getChildren = () => instance.children;
  instance.addChild = (child: unknown) => instance.children.push(child);
  instance.removeChild = (child: unknown) => {
    const i = instance.children.indexOf(child);
    if (i !== -1) instance.children.splice(i, 1);
  };
  instance.scrollToTop = () => undefined;
  instance._updatePageInputs = () => undefined;
  instance.createPageContainer = () => ({ addChild() {} });
  instance.getVisualParentNode = () => undefined;
  if (!options.useRealMatch) instance.matchPageFromUrl = () => options.matchFromUrl;

  return { instance, created, raises };
}

function withPageInfo(info: unknown, run: () => Promise<void>) {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const handler = require('../../src/nodes/navigation/router-handler').RouterHandler;
  /* eslint-enable @typescript-eslint/no-var-requires */
  const original = handler.instance.getPageInfoForComponent;
  handler.instance.getPageInfoForComponent = () => info;
  return run().finally(() => {
    handler.instance.getPageInfoForComponent = original;
  });
}

describe('A2 — an explicit Reset notices a page that was edited in place', () => {
  it('rebuilds when the page path is changed on the object the index holds', async () => {
    // ⚠️ One object, deliberately. This is the whole finding: the router held a reference to the
    // index entry, so after this mutation `currentPage === targetPage` *and*
    // `currentPage.path === targetPage.path` — the edit is invisible to both comparisons.
    const pageInfo = { path: 'home', title: 'Home', component: '/Home' };
    const { instance, created } = makeRouter({ pages: { startPage: '/Home' } });

    await withPageInfo(pageInfo, async () => {
      await instance.resetAsync();
      expect(created).toEqual(['/Home']);

      pageInfo.path = 'home-page';
      await instance.resetAsync();
    });

    expect(created).toEqual(['/Home', '/Home']);
  });

  it('rebuilds for a title edited in place, so the document title catches up', async () => {
    const pageInfo = { path: 'home', title: 'Home', component: '/Home' };
    const { instance } = makeRouter({ pages: { startPage: '/Home' } });

    await withPageInfo(pageInfo, async () => {
      await instance.resetAsync();
      titles.length = 0;

      pageInfo.title = 'Welcome';
      await instance.resetAsync();
    });

    expect(titles).toEqual(['Welcome']);
  });

  // ⚠️ The control, and the one that matters most: a `Reset` with nothing changed must still be
  // a no-op. Without it, "always rebuild" passes both rows above and turns every reset into a
  // full teardown — losing component state on a page that did not change.
  it('does not rebuild when nothing changed', async () => {
    const pageInfo = { path: 'home', title: 'Home', component: '/Home' };
    const { instance, created } = makeRouter({ pages: { startPage: '/Home' } });

    await withPageInfo(pageInfo, async () => {
      await instance.resetAsync();
      await instance.resetAsync();
      await instance.resetAsync();
    });

    expect(created).toEqual(['/Home']);
  });

  it('the snapshot is a copy, not the index entry', async () => {
    const pageInfo = { path: 'home', title: 'Home', component: '/Home' };
    const { instance } = makeRouter({ pages: { startPage: '/Home' } });

    await withPageInfo(pageInfo, async () => {
      await instance.resetAsync();
    });

    expect(instance._internal.currentPageSnapshot).not.toBe(pageInfo);
    expect(instance._internal.currentPageSnapshot).toEqual(pageInfo);
  });
});

describe('D1 — the location path is decoded exactly once', () => {
  /** Point the router at a URL and a set of pages, then run the real `matchPageFromUrl`. */
  function matchAt(hash: string, pages: Array<{ path: string; title: string; component: string }>) {
    (NoodlRuntime as unknown as { instance: unknown }).instance = {
      getProjectSettings: () => ({ navigationPathType: 'hash' })
    };
    (globalThis as unknown as { location: unknown }).location = { hash: '#/' + hash, search: '' };

    /* eslint-disable @typescript-eslint/no-var-requires */
    const handler = require('../../src/nodes/navigation/router-handler').RouterHandler;
    /* eslint-enable @typescript-eslint/no-var-requires */
    const original = handler.instance.getPagesForRouter;
    handler.instance.getPagesForRouter = () => pages;

    const { instance } = makeRouter({ useRealMatch: true });
    try {
      return instance.matchPageFromUrl();
    } finally {
      handler.instance.getPagesForRouter = original;
    }
  }

  const PRODUCT = { path: 'products/{id}', title: 'Product', component: '/Product' };

  it('does not throw on a parameter containing an encoded percent sign', () => {
    // `encodeURIComponent('a%b')` is `'a%25b'` — what `Navigate` puts in the URL for that value.
    expect(() => matchAt('products/' + encodeURIComponent('a%b'), [PRODUCT])).not.toThrow();
  });

  it('decodes that parameter back to exactly what was navigated with', () => {
    const match = matchAt('products/' + encodeURIComponent('a%b'), [PRODUCT]);

    expect(match.page.component).toBe('/Product');
    expect(match.params.id).toBe('a%b');
  });

  it('does not throw on a hand-typed malformed escape', () => {
    // `decodeURI` raises on this too, so the old code threw before `_matchPathParts` was reached.
    // A bad address-bar entry is not an author mistake and must not take the router down.
    expect(() => matchAt('products/%zz', [PRODUCT])).not.toThrow();
  });

  it('an encoded slash stays inside the parameter instead of splitting the path', () => {
    const match = matchAt('products/' + encodeURIComponent('a/b'), [PRODUCT]);

    // Decoding after the split is what makes this work: `%2F` was encoded as data, not as a
    // separator, and must not become one.
    expect(match.params.id).toBe('a/b');
  });

  it.each([
    ['a plain value', 'widget'],
    ['a space', 'blue widget'],
    ['an ampersand', 'salt & pepper'],
    ['a question mark', 'why?'],
    ['non-ASCII', 'café']
  ])('round-trips %s', (_label, value) => {
    const match = matchAt('products/' + encodeURIComponent(value), [PRODUCT]);

    expect(match.params.id).toBe(value);
  });

  // The controls: a literal segment must still match, including one that needed decoding to do
  // so, and a path that matches nothing must still report no match rather than a wrong one.
  it('still matches a literal page path', () => {
    const match = matchAt('about', [{ path: 'about', title: 'About', component: '/About' }]);

    expect(match.page.component).toBe('/About');
  });

  it('still matches a literal page path that was encoded in the URL', () => {
    const match = matchAt('my%20page', [{ path: 'my page', title: 'My Page', component: '/MyPage' }]);

    expect(match.page.component).toBe('/MyPage');
  });

  it('reports no page for a path that matches nothing', () => {
    const match = matchAt('nowhere', [PRODUCT]);

    expect(match === undefined || match.page === undefined).toBe(true);
  });
});
