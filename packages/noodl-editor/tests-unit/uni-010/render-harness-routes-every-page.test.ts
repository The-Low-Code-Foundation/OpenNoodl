/**
 * UNI-010 §8.2 — the render harness must see every routed page, not the first one.
 *
 * 🔴 THE DEFECT THIS EXISTS FOR CERTIFIED BROKEN PAGES AS CLEAN.
 * ---------------------------------------------------------------------------
 * `render-report.js` rendered the Router's start page and nothing else, so a
 * defect on any other page was invisible — **and the report said `Rendered
 * clean` about it**. Measured on a five-route project at HEAD before the fix
 * (2026-08-20): the same `dead-placeholder-text` scored *2 errors* on the start
 * page and produced a **character-identical clean report** (`md5` equal, timing
 * stripped) when moved to a routed page. UNI-010's F4 grades through this chain,
 * so a lesson that *teaches building a second page* had its whole subject
 * unscored, and `create_lesson` wrote the bundle.
 *
 * ## 🔴 The blindness was NAVIGATION, not serving — and that correction matters
 *
 * CN-001 §"sharpened" recorded the mechanism as `render-from-disk.js` answering
 * exactly one path (`/home` → 404) and concluded that *"anything driven by
 * `urlPath` is unmeasurable by this instrument"*. The 404 is real and is fixed.
 * **It is not what blinded F4.** The runtime's default `navigationPathType` is
 * `hash` (`router.tsx:_getLocationPath`), and a hash is never sent to a server:
 * `/#thank-you` was always served and always rendered the right page. What was
 * missing is that nothing ever navigated. A session that fixed only the 404
 * would have changed no reading at all and closed the item.
 *
 * ## Why these assertions are shaped this way
 *
 * The end-to-end proof needs a browser, so it is not here: it is the control
 * pair in the task file — the previously-invisible defect now reported, against
 * the same project with no defect still clean. What is here is the part that
 * rots silently and needs no Chrome: **which pages the harness decides to
 * visit**, and **which probes it judges each one by**.
 *
 * The second is not a nicety. Rendering every page made a latent bug severe:
 * `listProbes` returns every knowable repeater in the *project*, so measuring
 * page four against page one's repeater accused it of failing to render rows it
 * never had. `phase55-replay-sonnet` — the build phase 55 calls **correct**, and
 * a pinned control recorded as reporting *none* — came back with **14
 * `empty-list` errors** before the scoping below existed. That is a gate
 * rejecting the correct answer, and it would have been F4 failing sound lessons.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { routedPages, reachableComponents } = require(path.join(REPO, 'scripts', 'devtools', 'render-report.js'));

type Node = { id: string; type: string; parameters?: Record<string, unknown>; children?: string[] };

/** Write a v2 project on disk — the only shape `readComponents` reads. */
function writeProject(
  dir: string,
  components: Array<{ name: string; nodes: Node[]; visualRoots?: string[] }>,
  settings: Record<string, unknown> = {}
): string {
  fs.mkdirSync(path.join(dir, 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify({ name: 'fixture', version: '4', structure: { componentsDir: 'components' }, settings })
  );
  const registry: Record<string, unknown> = {};
  for (const c of components) {
    const key = c.name.replace(/^\//, '');
    const cdir = path.join(dir, 'components', key);
    fs.mkdirSync(cdir, { recursive: true });
    fs.writeFileSync(path.join(cdir, 'nodes.json'), JSON.stringify({ nodes: c.nodes, visualRoots: c.visualRoots ?? [] }));
    fs.writeFileSync(path.join(cdir, 'component.json'), JSON.stringify({ path: c.name }));
    registry[key] = { path: key };
  }
  fs.writeFileSync(path.join(dir, 'components', '_registry.json'), JSON.stringify({ components: registry }));
  return dir;
}

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uni010-routes-'));
}

const router = (routes: string[], startPage: string): Node => ({
  id: 'router',
  type: 'Router',
  parameters: { pages: { startPage, routes } }
});

const page = (title: string, urlPath?: string): Node => ({
  id: 'page',
  type: 'Page',
  parameters: urlPath === undefined ? { title } : { title, urlPath }
});

describe('UNI-010 §8.2 — which pages the harness visits', () => {
  it('🔴 enumerates every routed page and gives each one a URL to navigate to', () => {
    const dir = writeProject(tmpdir(), [
      { name: '/App', nodes: [router(['/Pages/Home', '/Pages/About'], '/Pages/Home')] },
      { name: '/Pages/Home', nodes: [page('Home', 'home')] },
      { name: '/Pages/About', nodes: [page('About', 'about')] }
    ]);

    const result = routedPages(dir);

    expect(result.ok).toBe(true);
    expect(result.startPage).toBe('/Pages/Home');
    expect(result.pages.map((p: { component: string }) => p.component)).toEqual(['/Pages/Home', '/Pages/About']);

    // The start page is `/` — it is what the app boots into, so it needs no URL
    // of its own and must keep being measured exactly where it always was.
    const home = result.pages.find((p: { isStart: boolean }) => p.isStart);
    expect(home.url).toBe('/');

    // 🔴 The assertion the whole task turns on: the OTHER page is addressable.
    // Before this change there was no such field and nothing ever went there.
    const about = result.pages.find((p: { component: string }) => p.component === '/Pages/About');
    expect(about.isStart).toBe(false);
    expect(about.reachable).toBe(true);
    expect(about.url).toBe('/#about');
  });

  it('🔴 builds a path URL, not a hash one, when the project says so', () => {
    // Not cosmetic: navigating to `/#about` in a `path` project renders the
    // START page and measures it a second time under another page's name — a
    // false clean report for the page that was never visited, which is the
    // defect this task exists to remove rather than relocate.
    const dir = writeProject(
      tmpdir(),
      [
        { name: '/App', nodes: [router(['/Pages/Home', '/Pages/About'], '/Pages/Home')] },
        { name: '/Pages/Home', nodes: [page('Home', 'home')] },
        { name: '/Pages/About', nodes: [page('About', 'about')] }
      ],
      { navigationPathType: 'path' }
    );

    const about = routedPages(dir).pages.find((p: { component: string }) => p.component === '/Pages/About');
    expect(about.url).toBe('/about');
  });

  it('🔴 reports a page it cannot address instead of dropping it', () => {
    // A silent skip is the failure mode this whole file is about: the report
    // would say nothing, and "not measured" would read as "measured and fine".
    const dir = writeProject(tmpdir(), [
      {
        name: '/App',
        nodes: [router(['/Pages/Home', '/Pages/NoPath', '/Pages/Product', '/Pages/Ghost'], '/Pages/Home')]
      },
      { name: '/Pages/Home', nodes: [page('Home', 'home')] },
      { name: '/Pages/NoPath', nodes: [page('NoPath')] },
      { name: '/Pages/Product', nodes: [page('Product', 'product/{id}')] }
    ]);

    const byName = new Map<string, any>(routedPages(dir).pages.map((p: any) => [p.component, p]));

    // Every one is still LISTED — that is the point — and each says why.
    expect([...byName.keys()]).toEqual(['/Pages/Home', '/Pages/NoPath', '/Pages/Product', '/Pages/Ghost']);

    expect(byName.get('/Pages/NoPath').reachable).toBe(false);
    expect(byName.get('/Pages/NoPath').unreachable).toMatch(/urlPath/);

    // A route parameter needs a value this harness has no way to choose.
    expect(byName.get('/Pages/Product').reachable).toBe(false);
    expect(byName.get('/Pages/Product').unreachable).toMatch(/route parameter/);

    // Routed but absent from the project — a real misconfiguration, and one the
    // start-page-only harness could never report because it never looked.
    expect(byName.get('/Pages/Ghost').reachable).toBe(false);
    expect(byName.get('/Pages/Ghost').unreachable).toMatch(/no component of that name/);

    for (const p of byName.values()) if (!p.reachable) expect(p.url).toBeUndefined();
  });

  it('✅ CONTROL — a project with no router yields no pages rather than throwing', () => {
    // The arm that must NOT find anything. Without it, an enumerator that
    // returned every component would pass every assertion above.
    const dir = writeProject(tmpdir(), [{ name: '/App', nodes: [{ id: 'g', type: 'Group' }] }]);
    const result = routedPages(dir);
    expect(result.ok).toBe(true);
    expect(result.pages).toEqual([]);
    expect(result.startPage).toBeUndefined();
  });
});

describe('UNI-010 §8.2 — which probes each page is judged by', () => {
  /** The `phase55-replay-sonnet` shape: sections on Home, other pages bare. */
  const kilnAndCo = () =>
    writeProject(tmpdir(), [
      { name: '/App', nodes: [router(['/Pages/Home', '/Pages/Shop'], '/Pages/Home')] },
      {
        name: '/Pages/Home',
        nodes: [page('Home', 'home'), { id: 'feat', type: '/Sections/FeaturedProducts' }]
      },
      { name: '/Pages/Shop', nodes: [page('Shop', 'shop')] },
      {
        name: '/Sections/FeaturedProducts',
        nodes: [{ id: 'each', type: 'For Each', parameters: { template: '/Cards/Product Card' } }]
      },
      { name: '/Cards/Product Card', nodes: [{ id: 't', type: 'Text' }] }
    ]);

  it('🔴 a page is judged by the repeaters it can actually contain', () => {
    const dir = kilnAndCo();
    const components = requireComponents(dir);

    const fromHome = reachableComponents('/Pages/Home', components);

    // Reached through an instance, and then through a `For Each` template — the
    // two ways a component gets onto a page. `Product Card` is the one that
    // carries the rows, so missing it would put the probe back on every page.
    expect(fromHome.has('/Sections/FeaturedProducts')).toBe(true);
    expect(fromHome.has('/Cards/Product Card')).toBe(true);
  });

  it('🔴 CONTROL — and NOT by the ones it cannot: this is the 14-error regression', () => {
    const dir = kilnAndCo();
    const fromShop = reachableComponents('/Pages/Shop', requireComponents(dir));

    // Shop contains no featured-products section. Before the scoping this
    // returned true for every component in the project, so Shop was accused of
    // failing to render six rows it was never asked to render — 14 errors on a
    // project whose recorded reading is `Rendered clean`.
    expect(fromShop.has('/Sections/FeaturedProducts')).toBe(false);
    expect(fromShop.has('/Cards/Product Card')).toBe(false);
    expect(fromShop.has('/Pages/Shop')).toBe(true);
  });

  it('✅ a cycle between components terminates', () => {
    // Two pages that instance each other's sections is legal and is exactly the
    // shape that turns a naive walk into a hang — with no output to read,
    // because the render never returns.
    const dir = writeProject(tmpdir(), [
      { name: '/App', nodes: [router(['/Pages/A'], '/Pages/A')] },
      { name: '/Pages/A', nodes: [page('A', 'a'), { id: 'b', type: '/Pages/B' }] },
      { name: '/Pages/B', nodes: [{ id: 'a', type: '/Pages/A' }] }
    ]);

    const reached = reachableComponents('/Pages/A', requireComponents(dir));
    expect(reached.has('/Pages/A')).toBe(true);
    expect(reached.has('/Pages/B')).toBe(true);
  });
});

/** `reachableComponents` takes the map `renderReport` builds, so build it the same way. */
function requireComponents(dir: string): Map<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readComponents } = require(path.join(REPO, 'scripts', 'devtools', 'render-report.js'));
  return new Map(readComponents(dir).components.map((c: { name: string }) => [c.name, c]));
}
