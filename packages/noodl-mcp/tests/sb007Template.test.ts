/**
 * SB-007 — the site builder ships as a template, and the template is the app.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## What this file is for, given five suites already grade these components
 *
 * `sb004Authoring`, `sb005AdminPanel` and `sb006PublicSite` grade the graphs;
 * `sb008-public-site-drive` grades the running site in a browser. All four read
 * the **component sets**. None of them reads the thing a person actually gets,
 * which is a `project.json` with nineteen components in it — and the difference
 * between those two populations is where a template breaks:
 *
 *  - the four suites author into `tests/fixtures/demo-app`, which **already
 *    contains** an `App` component holding a `Router` named `Main`. Nothing in
 *    the three component sets writes one. A template has no fixture.
 *  - the door checks a reference against **what is on disk when the write
 *    happens**. A shipped artefact is a different population: a component
 *    dropped from the emitted set is a reference the door once resolved and the
 *    project no longer contains.
 *  - `checkNavigation` resolves a Navigate target against **component names**,
 *    not against router registration — `pageRegistration.ts`'s own header calls
 *    that out (*"Gate parity without apply parity is a gate that lies"*). A page
 *    that exists and is not routed is a button that does nothing, and it is
 *    green everywhere else.
 *
 * So every assertion below is over `site-builder.content.json` — the committed
 * artefact — and §1 is what stops that artefact drifting away from the graphs
 * the other five suites measure.
 *
 * ⚠️ Reading the JSON rather than importing the editor's `.template.ts`: this
 * package's `tsconfig` is its own, and the editor module adds nothing to grade
 * (an id, a name, a category — the editor's own spec has those, where the
 * provider that reads them lives).
 */
import * as fs from 'fs';
import * as path from 'path';

import { ROUTER } from './sb005Components';
import { SITE_URL_PATH } from './sb006Components';
import { APP_COMPONENT, buildSiteTemplateProject, toTemplateContent } from './sb007Template';

jest.setTimeout(600000);

const ARTEFACT = path.join(
  __dirname,
  '..',
  '..',
  'noodl-editor',
  'src',
  'editor',
  'src',
  'models',
  'template',
  'templates',
  'site-builder.content.json'
);

const REGENERATE = 'npm run template:site-builder';

// ── Reading the artefact ─────────────────────────────────────────────────────

interface Node {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  children?: Node[];
}
interface Component {
  name: string;
  graph: { roots: Node[]; connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }> };
}
interface Content {
  name: string;
  rootComponent?: string;
  components: Component[];
}

const shipped = JSON.parse(fs.readFileSync(ARTEFACT, 'utf-8')) as Content;

/** Every node in a component, roots and descendants alike. */
function nodesOf(component: Component): Node[] {
  const out: Node[] = [];
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(component.graph.roots ?? []);
  return out;
}

/** Every node in the whole project, tagged with the component holding it. */
function allNodes(): Array<{ component: string; node: Node }> {
  return shipped.components.flatMap((c) => nodesOf(c).map((node) => ({ component: c.name, node })));
}

function componentNamed(name: string): Component | undefined {
  return shipped.components.find((c) => c.name === name);
}

const APP_LEGACY = `/${APP_COMPONENT}`;

/** The one Router node the app has. */
function routerNode(): Node {
  const app = componentNamed(APP_LEGACY);
  if (!app) throw new Error(`the shipped project has no ${APP_LEGACY} component`);
  const router = nodesOf(app).find((n) => n.type === 'Router');
  if (!router) throw new Error(`${APP_LEGACY} holds no Router node`);
  return router;
}

interface Pages {
  startPage?: string;
  routes?: string[];
}

function routerPages(): Pages {
  return (routerNode().parameters?.pages as Pages) ?? {};
}

// ── 1. The artefact is what the door writes, and not a twin of it ────────────

describe('SB-007 — the committed template is a regeneration, not a copy', () => {
  /**
   * 🔴 **THE ONE ASSERTION THE WHOLE FILE STANDS ON.**
   *
   * Everything below reads the committed JSON. If that JSON can drift from the
   * component sets, then every claim below is a claim about a stale file and the
   * four suites that grade the sets are measuring something else. This regenerates
   * through the real MCP server and compares bytes.
   *
   * ⚠️ Regeneration is deterministic and that is a property, not luck: the door's
   * id remapping, its auto-placement and its page registration are all functions
   * of the authoring order, and the three per-write fields that are not
   * (`created`, `modifiedBy`, a component `id`) are dropped by `toTemplateContent`
   * precisely so this comparison can be over the whole artefact rather than over
   * a chosen part of it.
   */
  it('regenerating from the component sets reproduces the committed file byte for byte', async () => {
    const built = await buildSiteTemplateProject();
    const regenerated = JSON.stringify(toTemplateContent(built.project), null, 2) + '\n';
    const committed = fs.readFileSync(ARTEFACT, 'utf-8');

    if (regenerated !== committed) {
      const a = committed.split('\n');
      const b = regenerated.split('\n');
      const first = a.findIndex((line, i) => line !== b[i]);
      throw new Error(
        `site-builder.content.json is not what the door writes today.\n` +
          `  first difference at line ${first + 1}:\n` +
          `    committed:    ${a[first]}\n` +
          `    regenerated:  ${b[first]}\n` +
          `  If a component set changed on purpose, run \`${REGENERATE}\` and commit the result.`
      );
    }
    expect(regenerated).toBe(committed);
  });

  it('control: the generation really ran — it produced nineteen components, not an empty project', async () => {
    // 🔴 Without this, the comparison above is satisfiable by two empty strings,
    // and a build that silently authored nothing would read as agreement.
    const built = await buildSiteTemplateProject();
    expect(built.project.components).toHaveLength(19);
    expect(built.order[0]).toBe(APP_COMPONENT);
  });
});

// ── 2. The finding: a page can be written into no router, silently ───────────

/**
 * 🔴 **THE ONE-EDGE ARM, AND IT IS THE REASON THIS TASK HAS AN `App` COMPONENT
 * AT ALL.**
 *
 * `pageRegistration.ts` states the behaviour outright — *"A project with no
 * router is not an error. Single-screen apps exist, and refusing an
 * otherwise-good write over a missing router would be this phase's mistake in
 * the other direction."* That is a defensible rule for `create_component`. What
 * it means for anything **assembling a project** is that six page writes can
 * come back green, with `registeredPages` simply absent from the payload, and
 * the app opens on nothing.
 *
 * An absence is not evidence on its own: `registeredPages` could be missing
 * because the write failed, because the response shape changed, because the
 * pages were not pages. So the two arms below differ in **one component** —
 * everything else, the skeleton, the order, the door, the eighteen component
 * sets, is held constant — and they disagree.
 */
describe('SB-007 — the App component is the difference between a router and none', () => {
  it('🔴 with no App: every page is written, every write succeeds, and NOTHING is registered', async () => {
    const built = await buildSiteTemplateProject({ omitApp: true });

    // The pages were written. This is not a run that fell over.
    expect(built.order.filter((key) => key.startsWith('Pages/'))).toHaveLength(5);
    expect(built.project.components).toHaveLength(18);

    // And not one of them landed in a router, with no diagnostic anywhere.
    expect(built.registrations).toEqual({});
  });

  it('control: with the App, the same eighteen components register five pages', async () => {
    // 🔴 The arm that turns the absence above into a measurement. Without it,
    // `registrations === {}` is consistent with a builder that never populates
    // that map at all — which is the same reading, and the opposite fix.
    const built = await buildSiteTemplateProject();
    expect(Object.keys(built.registrations).sort()).toEqual([
      'Pages/Admin',
      'Pages/PageEditor',
      'Pages/Setup',
      'Pages/Site',
      'Pages/ThemeEditor'
    ]);
    expect(built.registrations['Pages/Site'].startPage).toBe('/Pages/Site');
  });
});

// ── 3. The app has an entry point ────────────────────────────────────────────

describe('SB-007 — the router the component sets never author', () => {
  it('ships an App component holding exactly one Router', () => {
    const app = componentNamed(APP_LEGACY);
    expect(app).toBeDefined();
    expect(nodesOf(app as Component).filter((n) => n.type === 'Router')).toHaveLength(1);
  });

  it('🔴 names that router what every RouterNavigate in both panels asks for', () => {
    // 🔴 UNCHECKED AT THE DOOR, and unchecked for a reason that is visible in
    // every authoring run: `RouterNavigate`'s ports are derived from the target
    // router, so all eleven of them raise `dynamic-port-skipped` — "unverified by
    // that check rather than verified as correct", in the diagnostic's own words.
    // A router named anything else is eleven buttons that do nothing, on a green
    // authoring run and a green deploy.
    expect(routerNode().parameters?.name).toBe(ROUTER);
  });

  it('lists every page component in the routes', () => {
    const pages = shipped.components.map((c) => c.name).filter((n) => n.startsWith('/Pages/'));
    expect(pages.length).toBeGreaterThan(0);
    expect([...(routerPages().routes ?? [])].sort()).toEqual([...pages].sort());
  });

  it('🔴 opens on the public site, not on an editor for no record', () => {
    // SB-006 F17: the door makes the FIRST page written the start page, so the
    // authoring order decides where the app opens. The panel-first order that
    // built SB-005 left `startPage: /Pages/PageEditor` — an editor with no page
    // selected — which is why `buildSiteTemplateProject` authors the site first.
    expect(routerPages().startPage).toBe('/Pages/Site');
  });

  it('control: the routes list is not simply everything', () => {
    // Without this, "every page is routed" passes on a router that lists all
    // nineteen components, including the seven cloud ones a browser cannot show.
    const routes = routerPages().routes ?? [];
    expect(routes.length).toBeLessThan(shipped.components.length);
    expect(routes.some((r) => r.startsWith('/#__cloud__/'))).toBe(false);
  });
});

// ── 3. Nothing in the shipped project points outside it ──────────────────────

describe('SB-007 — the artefact is closed under its own references', () => {
  const names = new Set(shipped.components.map((c) => c.name));

  it('every component an instance node names is in the project', () => {
    // An instance uses the target's legacy name as its node `type`. The door
    // resolved each of these against the disk at write time; this is the same
    // question asked of the population that ships.
    const missing = allNodes()
      .filter(({ node }) => node.type.startsWith('/') && !names.has(node.type))
      .map(({ component, node }) => `${component} › ${node.id} (${node.type})`);
    expect(missing).toEqual([]);
  });

  it('every repeater template is in the project', () => {
    const missing = allNodes()
      .filter(({ node }) => node.type === 'For Each')
      .map(({ component, node }) => ({ component, node, template: node.parameters?.template as string | undefined }))
      .filter((row) => !row.template || !names.has(row.template))
      .map((row) => `${row.component} › ${row.node.id} → ${String(row.template)}`);
    expect(missing).toEqual([]);
  });

  it('🔴 every page a RouterNavigate targets is REGISTERED, not merely present', () => {
    // 🔴 THE GAP `pageRegistration.ts` NAMES IN ITS OWN HEADER: `checkNavigation`
    // resolves a target against the project's component names, and it is sound in
    // the editor only because the editor's apply registers the page immediately
    // afterwards. A page component that exists and is not in `routes` passes every
    // gate in the repository and does nothing when clicked.
    const routes = new Set(routerPages().routes ?? []);
    const unrouted = allNodes()
      .filter(({ node }) => node.type === 'RouterNavigate')
      .map(({ component, node }) => ({ component, node, target: node.parameters?.target as string | undefined }))
      .filter((row) => !row.target || !routes.has(row.target))
      .map((row) => `${row.component} › ${row.node.id} → ${String(row.target)}`);
    expect(unrouted).toEqual([]);
  });

  it('control: there are RouterNavigate nodes to grade, and they name pages', () => {
    // 🔴 The three assertions above are all `toEqual([])`, which is what an empty
    // population also produces. This is the arm that says the population is not
    // empty — the failure mode that would make all three vacuous at once.
    const navigates = allNodes().filter(({ node }) => node.type === 'RouterNavigate');
    expect(navigates.length).toBeGreaterThan(0);
    expect(allNodes().filter(({ node }) => node.type === 'For Each').length).toBeGreaterThan(0);
    expect(allNodes().filter(({ node }) => node.type.startsWith('/')).length).toBeGreaterThan(0);
  });

  it('control: an invented target would be caught — the matcher discriminates', () => {
    const routes = new Set(routerPages().routes ?? []);
    expect(routes.has('/Pages/NoSuchPage')).toBe(false);
  });
});

// ── 4. F14's tie, re-read on the shipped router ──────────────────────────────

describe('SB-007 — the public site catch-all does not compete with an admin path', () => {
  /**
   * SB-006 F14: `{slug}` matches any one-segment path, and the Router breaks a
   * pattern tie by the order its `pages` list happens to name (`router.tsx:775-783`,
   * the guard is `>` not `>=`). SB-005's four page paths moved under `admin/` so
   * the tie is removed rather than relied on — and *this* is the artefact where
   * that either holds or does not, because it is the one carrying both panels'
   * `urlPath`s and one router's ordering.
   */
  function urlPathOf(componentName: string): string | undefined {
    const component = componentNamed(componentName);
    if (!component) return undefined;
    return nodesOf(component).find((n) => n.type === 'Page')?.parameters?.urlPath as string | undefined;
  }

  const routed = () => routerPages().routes ?? [];

  it('the public site is the catch-all it is meant to be', () => {
    expect(urlPathOf('/Pages/Site')).toBe(SITE_URL_PATH);
  });

  it('🔴 every other page has more segments than the catch-all', () => {
    const segments = (p: string) => p.split('/').filter(Boolean).length;
    const site = segments(SITE_URL_PATH);

    for (const name of routed()) {
      if (name === '/Pages/Site') continue;
      const urlPath = urlPathOf(name);
      expect(urlPath).toBeDefined();
      // Distance is read before order (`router.tsx`), so a deeper path wins on
      // its own merits and never on where it sits in the list.
      expect(segments(urlPath as string)).toBeGreaterThan(site);
    }
  });

  it('control: the catch-all is one segment, so "more than" is a real bar', () => {
    // Without this the assertion above is satisfied by a catch-all of zero
    // segments, against which everything is deeper and nothing was tested.
    expect(SITE_URL_PATH.split('/').filter(Boolean)).toHaveLength(1);
  });

  it('every page carries a Page node, so it renders at all', () => {
    // A page component without one renders blank — the `PageWithoutPageNode`
    // diagnostic. Checked here over the routed set rather than the written set.
    for (const name of routed()) expect(urlPathOf(name)).toBeDefined();
  });
});

// ── 5. The halves that make it a site rather than a demo ─────────────────────

describe('SB-007 — what the template contains', () => {
  it('ships the cloud half, so a deploy has the publication flow', () => {
    const cloud = shipped.components.map((c) => c.name).filter((n) => n.startsWith('/#__cloud__/'));
    expect(cloud).toHaveLength(7);
    expect(cloud).toEqual(expect.arrayContaining(['/#__cloud__/publishPage', '/#__cloud__/claimSite']));
  });

  it('names a root component that the project actually contains', () => {
    // 🔴 `EmbeddedTemplateProvider.instantiateContent` resolves `rootComponent`
    // by an exact name match to set a concrete `rootNodeId`; the fallback it
    // exists to avoid — `ProjectModel.fromJSON`'s `setRootComponent()` name hint —
    // silently no-ops on the launcher's empty NodeLibrary. A `rootComponent` that
    // matches nothing is therefore a project with no home component, and no error.
    expect(shipped.rootComponent).toBe(APP_LEGACY);
    expect(componentNamed(shipped.rootComponent as string)).toBeDefined();
  });

  it('control: the bare name would NOT have matched', () => {
    // 🔴 The near-miss this is guarding. `hello-world.template.ts` names its root
    // `App` because its component is called `App`; every component the v2 door
    // writes is `/App`. One character, no diagnostic, no home component.
    expect(componentNamed(APP_COMPONENT)).toBeUndefined();
  });

  it('carries no per-write provenance, which is what makes it comparable at all', () => {
    for (const component of shipped.components) {
      expect(component).not.toHaveProperty('created');
      expect(component).not.toHaveProperty('modifiedBy');
    }
  });
});
