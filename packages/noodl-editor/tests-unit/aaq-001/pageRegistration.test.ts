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
  looksLikePageComponent,
  pageDisplayName,
  planPageRegistration,
  type RouterLocation
} from '../../src/editor/src/models/AiAssistant/authoring/pageRegistration';
import { checkNavigation } from '../../src/editor/src/validation/navigation';
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
