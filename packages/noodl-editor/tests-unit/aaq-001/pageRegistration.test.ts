/**
 * AAQ-001 — the two pure halves: what registration would change, and which
 * navigations cannot land.
 *
 * Here rather than in the jasmine suite because both modules are pure by
 * construction (no `ProjectModel`, no Electron) and because `noodl-mcp` is the
 * other client of the same contract — a runner that needs a renderer would be
 * testing them in the one environment they do not have to work in.
 *
 * The apply path itself — the undo group, the byte-for-byte reversal — is
 * `tests/ai/authoring-plan-staging.test.ts`, against a real project.
 */

import {
  chooseRouter,
  describePageRegistration,
  findRoutersInComponents,
  isPlaceholderPageGraph,
  looksLikePageComponent,
  pageDisplayName,
  planPageRegistration,
  readRouterPagesValue,
  resolvePageRegistration,
  type RouterLocation
} from '../../src/editor/src/models/AiAssistant/authoring/pageRegistration';
import { checkNavigation, checkPageShape } from '../../src/editor/src/validation/navigation';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';

function router(overrides: Partial<RouterLocation> = {}): RouterLocation {
  return {
    component: 'App',
    nodeId: 'router-1',
    name: 'Main',
    pages: { startPage: '/#__page__/Home', routes: ['/#__page__/Home'] },
    isRoot: true,
    ...overrides
  };
}

describe('AAQ-001 — planPageRegistration', () => {
  it('adds the pages the plan created, keeping the routes that were already there', () => {
    const registration = planPageRegistration([router()], ['/Pages/Puppies', '/Pages/Admin']);

    expect(registration).toBeDefined();
    expect(registration!.pages.routes).toEqual(['/#__page__/Home', '/Pages/Puppies', '/Pages/Admin']);
    expect(registration!.added).toEqual(['/Pages/Puppies', '/Pages/Admin']);
  });

  it('is idempotent: a page the agent already routed is not listed twice, and nothing is returned', () => {
    const already = router({
      pages: { startPage: '/Pages/Puppies', routes: ['/#__page__/Home', '/Pages/Puppies'] }
    });

    expect(planPageRegistration([already], ['/Pages/Puppies'])).toBeUndefined();
  });

  it('tolerates the name shapes the rest of the stack tolerates', () => {
    const already = router({ pages: { startPage: '/Pages/Puppies', routes: ['Pages/Puppies'] } });

    expect(planPageRegistration([already], ['/Pages/Puppies'])).toBeUndefined();
  });

  it('leaves a start page that resolves alone, however many pages arrive', () => {
    const built = router({
      pages: { startPage: '/Pages/Library', routes: ['/Pages/Library'] }
    });

    const registration = planPageRegistration(built ? [built] : [], ['/Pages/Contact']);

    expect(registration!.pages.startPage).toBe('/Pages/Library');
    expect(registration!.startPage).toBeUndefined();
  });

  it('moves the start page off the placeholder the caller identified', () => {
    const registration = planPageRegistration([router()], ['/Pages/Puppies', '/Pages/Admin'], {
      placeholderStartPage: '/#__page__/Home'
    });

    expect(registration!.pages.startPage).toBe('/Pages/Puppies');
    expect(registration!.startPage).toBe('/Pages/Puppies');
    // The placeholder stays routed: unregistering a component is a destructive
    // decision the apply deliberately does not make.
    expect(registration!.pages.routes).toContain('/#__page__/Home');
  });

  it('sets a start page when the router has none, and when it dangles', () => {
    const none = router({ pages: { routes: [] } });
    expect(planPageRegistration([none], ['/Pages/Puppies'])!.pages.startPage).toBe('/Pages/Puppies');

    const dangling = router({ pages: { startPage: '/Pages/Deleted', routes: ['/#__page__/Home'] } });
    expect(planPageRegistration([dangling], ['/Pages/Puppies'])!.pages.startPage).toBe('/Pages/Puppies');
  });

  it('returns nothing when there is no router at all — a single-screen app is not a defect', () => {
    expect(planPageRegistration([], ['/Pages/Puppies'])).toBeUndefined();
  });

  it('prefers the router in the project root component when there are several', () => {
    const nested = router({ component: '/Visual Components/Widget', isRoot: undefined, nodeId: 'router-2' });
    const app = router();

    expect(chooseRouter([nested, app])!.component).toBe('App');
    // With no root among them the order is the caller's, and it is stable.
    expect(chooseRouter([nested])!.nodeId).toBe('router-2');
  });

  it('describes itself in the tense of the thing that is happening', () => {
    const registration = planPageRegistration([router()], ['/Pages/Puppies'], {
      placeholderStartPage: '/#__page__/Home'
    })!;

    const before = describePageRegistration(registration);
    expect(before).toContain('will be registered in the "Main" router in App');
    expect(before).toContain('Puppies becomes the page the app opens on');

    const after = describePageRegistration(registration, { applied: true });
    expect(after).toContain('registered in the "Main" router in App');
    expect(after.includes('will be')).toBe(false);
  });

  it('knows a page component by its name', () => {
    expect(looksLikePageComponent('/Pages/Puppies')).toBe(true);
    expect(looksLikePageComponent('/#__page__/Home')).toBe(true);
    expect(looksLikePageComponent('/Visual Components/Card')).toBe(false);
    expect(pageDisplayName('/#__page__/Home')).toBe('Home');
    expect(pageDisplayName('/Pages/Puppies')).toBe('Puppies');
  });
});

/**
 * The live pass's headline finding. Registration worked, the panel truthfully
 * said "The app opens on Puppies", and the app rendered a blank screen: the
 * runtime's page index comes only from `Page` nodes, so a routed component
 * without one resolves to nothing and the Router mounts nothing.
 */
describe('AAQ-001 — checkPageShape', () => {
  const pageNode = { id: 'page', type: 'Page' };
  const group = { id: 'root', type: 'Group' };

  it('reports a page component with no Page node — the blank-screen case', () => {
    const diagnostics = checkPageShape([group, { id: 't', type: 'Text' }], {
      component: '/Pages/Puppies',
      isRoutedPage: true
    });

    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].code).toBe(DiagnosticCode.PageWithoutPageNode);
    expect(diagnostics[0].message).toContain('blank screen');
    expect(diagnostics[0].suggestion).toContain('Page node');
  });

  it('says nothing when the component has a Page node', () => {
    expect(checkPageShape([pageNode, group], { component: '/Pages/Puppies', isRoutedPage: true })).toEqual([]);
  });

  it('says nothing about a component the project will not route as a page', () => {
    expect(
      checkPageShape([group], { component: '/Visual Components/Badge', isRoutedPage: false })
    ).toEqual([]);
  });
});

describe('AAQ-001 — checkNavigation', () => {
  const components = ['/App', '/Pages/Puppies', '/Pages/Admin'];

  it('accepts a target that names a component of this project', () => {
    const diagnostics = checkNavigation(
      [{ id: 'nav', type: 'RouterNavigate', parameters: { target: '/Pages/Puppies' } }],
      { component: '/Pages/Admin', components }
    );

    expect(diagnostics).toEqual([]);
  });

  it('reports the invented URL path Richard actually got', () => {
    const diagnostics = checkNavigation(
      [{ id: 'nav', type: 'RouterNavigate', label: 'See the puppies', parameters: { target: '/puppies' } }],
      { component: '/Pages/Home', components }
    );

    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].code).toBe(DiagnosticCode.UnresolvedNavigation);
    expect(diagnostics[0].message).toContain('"/puppies"');
    expect(diagnostics[0].message).toContain('URL path');
    expect(diagnostics[0].suggestion).toContain('/Pages/Puppies');
  });

  /**
   * Found in the AAQ live pass, not by reading the code. `validate.ts` builds the
   * offered list from three overlapping sources — the project's components, the
   * candidate's own name, and the plan's other targets — so the component being
   * authored was in it twice, and the repair message the agent read said
   * `/Pages/Admin` twice in one sentence.
   */
  it('offers each component once, however many sources the caller assembled it from', () => {
    const diagnostics = checkNavigation(
      [{ id: 'nav', type: 'RouterNavigate', parameters: { target: 'Admin' } }],
      // Exactly the shape `navigationDiagnostics` produces while authoring
      // /Pages/Admin as part of a plan that also creates /Pages/Puppies.
      { component: '/Pages/Admin', components: [...components, '/Pages/Admin', '/Pages/Puppies'] }
    );

    expect(diagnostics.length).toBe(1);
    const occurrences = diagnostics[0].suggestion.split('/Pages/Admin').length - 1;
    expect(occurrences).toBe(1);
  });

  /**
   * The same message used to open "Pages in this project:" over a list whose
   * first entry was `/App`. A repairing agent that believes that is one wrong
   * target away from a second failed round.
   */
  it('does not call the offered components pages, and says when the list is cut short', () => {
    const many = Array.from({ length: 11 }, (_, i) => `/Pages/P${i}`);
    const diagnostics = checkNavigation(
      [{ id: 'nav', type: 'RouterNavigate', parameters: { target: 'nowhere' } }],
      { component: '/Pages/Home', components: ['/App', ...many] }
    );

    expect(diagnostics[0].suggestion).toContain('component names');
    expect(diagnostics[0].suggestion).not.toContain('Pages in this project');
    expect(diagnostics[0].suggestion).toContain('4 more');
  });

  it('reports a Navigate with no target at all — the dead button', () => {
    const diagnostics = checkNavigation([{ id: 'nav', type: 'RouterNavigate', parameters: {} }], {
      component: '/Pages/Home',
      components
    });

    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain('navigates nowhere');
    expect(diagnostics[0].location.port).toBe('target');
  });

  it('accepts a page the plan has not authored yet, because the caller said it is coming', () => {
    const diagnostics = checkNavigation(
      [{ id: 'nav', type: 'RouterNavigate', parameters: { target: '/Pages/Checkout' } }],
      { component: '/Pages/Cart', components: [...components, '/Pages/Checkout'] }
    );

    expect(diagnostics).toEqual([]);
  });

  it('checks a path against the urlPaths pages declare, and only when it is given them', () => {
    const node = { id: 'nav', type: 'PageStackNavigateToPath', parameters: { path: '/puppies' } };

    expect(checkNavigation([node], { component: '/Pages/Home', components })).toEqual([]);
    expect(
      checkNavigation([node], { component: '/Pages/Home', components, urlPaths: ['puppies'] })
    ).toEqual([]);
    const missing = checkNavigation([node], { component: '/Pages/Home', components, urlPaths: ['home'] });
    expect(missing.length).toBe(1);
    expect(missing[0].message).toContain('no page in this project declares');
  });

  it('never reports a path with a runtime placeholder in it', () => {
    const diagnostics = checkNavigation(
      [{ id: 'nav', type: 'PageStackNavigateToPath', parameters: { path: '/product/{id}' } }],
      { component: '/Pages/Home', components, urlPaths: ['home'] }
    );

    expect(diagnostics).toEqual([]);
  });

  it('says nothing about an External Link — where it points is not a question about this project', () => {
    const diagnostics = checkNavigation(
      [{ id: 'link', type: 'net.noodl.externallink', parameters: { link: 'https://example.com' } }],
      { component: '/Pages/Home', components }
    );

    expect(diagnostics).toEqual([]);
  });
});

// ── AAQ-005: the pieces the MCP door binds too ────────────────────────────────
//
// These four moved out of the editor's `staging.ts` when `noodl-mcp` gained a
// second binding of the same decision. They are covered here because "the two
// clients register identically" is now a property of THESE functions — the
// editor's apply and the MCP write tools each supply plain nodes and do nothing
// else. A drift in `staging.ts` alone would show up in the jasmine apply specs;
// a drift here would show up in both clients at once, silently.

describe('AAQ-005 — readRouterPagesValue', () => {
  it('reads the shape a router actually carries', () => {
    expect(readRouterPagesValue({ pages: { startPage: '/Pages/Home', routes: ['/Pages/Home'] } })).toEqual({
      startPage: '/Pages/Home',
      routes: ['/Pages/Home']
    });
  });

  it('treats a router with no pages parameter as one listing nothing', () => {
    // noodl-mcp's own fixture is exactly this, and so is a Router a model just
    // dropped on a canvas.
    expect(readRouterPagesValue({ name: 'Main' })).toEqual({ routes: [] });
    expect(readRouterPagesValue(undefined)).toEqual({ routes: [] });
  });

  it('replaces a malformed value rather than throwing on it', () => {
    // Hand-edited projects, older exports and a model that half-understood the
    // shape all reach this. An apply must never die on a value it could replace.
    expect(readRouterPagesValue({ pages: 'Home' })).toEqual({ routes: [] });
    expect(readRouterPagesValue({ pages: { routes: ['/Pages/A', 42, '', null] } })).toEqual({
      routes: ['/Pages/A']
    });
  });
});

describe('AAQ-005 — findRoutersInComponents', () => {
  it('finds routers wherever they live and records what each lists', () => {
    const routers = findRoutersInComponents([
      {
        name: '/App',
        isRoot: true,
        nodes: [
          { id: 'g', type: 'Group' },
          { id: 'r', type: 'Router', parameters: { name: 'Main', pages: { routes: ['/Pages/Home'] } }, parent: 'g' }
        ]
      },
      { name: '/Widgets/Panel', nodes: [{ id: 'ps', type: 'Page Stack' }] }
    ]);

    expect(routers).toHaveLength(2);
    expect(routers[0]).toMatchObject({ component: '/App', nodeId: 'r', name: 'Main', isRoot: true });
    expect(routers[0].pages.routes).toEqual(['/Pages/Home']);
    // Page Stack mounts pages too, and carries no name here.
    expect(routers[1]).toMatchObject({ component: '/Widgets/Panel', nodeId: 'ps' });
    expect(routers[1].name).toBeUndefined();
  });

  it('finds nothing in a project with no router, which is not an error', () => {
    expect(findRoutersInComponents([{ name: '/App', nodes: [{ id: 'g', type: 'Group' }] }])).toEqual([]);
  });
});

describe('AAQ-005 — isPlaceholderPageGraph', () => {
  const page = (nodes: Array<{ id: string; type: string; parent?: string; children?: string[] }>) => ({
    name: '/Pages/Home',
    nodes
  });

  it('calls the template Home a placeholder — one Page, one leaf Text', () => {
    // Both clients ship this exact shape: the editor's hello-world template and
    // noodl-mcp's writeProjectSkeleton. The rule exists for it, and an earlier
    // version of the rule never matched it — which is why every wizard-built app
    // opened on "Hello World!".
    expect(
      isPlaceholderPageGraph(
        page([
          { id: 'p', type: 'Page', children: ['t'] },
          { id: 't', type: 'Text', parent: 'p' }
        ])
      )
    ).toBe(true);
  });

  it('reads hierarchy from parent fields alone, which is how the editor submits it', () => {
    expect(
      isPlaceholderPageGraph(
        page([
          { id: 'p', type: 'Page' },
          { id: 't', type: 'Text', parent: 'p' }
        ])
      )
    ).toBe(true);
  });

  it('leaves a page somebody built alone', () => {
    expect(
      isPlaceholderPageGraph(
        page([
          { id: 'p', type: 'Page', children: ['g'] },
          { id: 'g', type: 'Group', parent: 'p' }
        ])
      )
    ).toBe(false);
    expect(
      isPlaceholderPageGraph(
        page([
          { id: 'p', type: 'Page', children: ['t1', 't2'] },
          { id: 't1', type: 'Text', parent: 'p' },
          { id: 't2', type: 'Text', parent: 'p' }
        ])
      )
    ).toBe(false);
  });

  it('counts logic nodes as roots, so a page with one is not a placeholder', () => {
    // ⚠️ The load-bearing case for reading parentless nodes rather than
    // `visualRoots`: a stray logic node is invisible to the visual roots and
    // would make this page look empty, letting an apply take home away from a
    // page somebody had started.
    expect(
      isPlaceholderPageGraph(
        page([
          { id: 'p', type: 'Page', children: ['t'] },
          { id: 't', type: 'Text', parent: 'p' },
          { id: 'nav', type: 'RouterNavigate' }
        ])
      )
    ).toBe(false);
  });
});

describe('AAQ-005 — resolvePageRegistration', () => {
  const app = (pages?: unknown) => ({
    name: '/App',
    isRoot: true,
    nodes: [{ id: 'r', type: 'Router', parameters: { name: 'Main', ...(pages ? { pages } : {}) } }]
  });
  const placeholderHome = {
    name: '/Pages/Home',
    nodes: [
      { id: 'p', type: 'Page', children: ['t'] },
      { id: 't', type: 'Text', parent: 'p' }
    ]
  };

  it('moves home off the template placeholder onto the first page built', () => {
    const registration = resolvePageRegistration(
      [app({ startPage: '/Pages/Home', routes: ['/Pages/Home'] }), placeholderHome],
      ['/Pages/Puppies', '/Pages/Admin']
    );

    expect(registration?.added).toEqual(['/Pages/Puppies', '/Pages/Admin']);
    expect(registration?.startPage).toBe('/Pages/Puppies');
  });

  it('keeps home where it is when the start page is a page somebody built', () => {
    const builtHome = {
      name: '/Pages/Home',
      nodes: [
        { id: 'p', type: 'Page', children: ['g'] },
        { id: 'g', type: 'Group', parent: 'p' }
      ]
    };
    const registration = resolvePageRegistration(
      [app({ startPage: '/Pages/Home', routes: ['/Pages/Home'] }), builtHome],
      ['/Pages/Puppies']
    );

    expect(registration?.added).toEqual(['/Pages/Puppies']);
    expect(registration?.startPage).toBeUndefined();
  });

  it('does not move home onto a page it is about to fill', () => {
    // Run before the apply the placeholder is still empty; run after it is not.
    // Without this clause the review would promise a move the apply declines.
    const registration = resolvePageRegistration(
      [app({ startPage: '/Pages/Home', routes: ['/Pages/Home'] }), placeholderHome],
      ['/Pages/Home']
    );

    expect(registration).toBeUndefined();
  });

  it('registers into an empty router and opens the app on the first page', () => {
    const registration = resolvePageRegistration([app()], ['/Pages/Puppies', '/Pages/Admin']);

    expect(registration?.pages).toEqual({
      startPage: '/Pages/Puppies',
      routes: ['/Pages/Puppies', '/Pages/Admin']
    });
  });

  it('returns nothing when there is no router to register into', () => {
    const registration = resolvePageRegistration(
      [{ name: '/App', isRoot: true, nodes: [{ id: 'g', type: 'Group' }] }],
      ['/Pages/Puppies']
    );

    expect(registration).toBeUndefined();
  });
});
