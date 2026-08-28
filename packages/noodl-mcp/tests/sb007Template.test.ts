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
import {
  planRunOnValueChangeMigration,
  type MigrationProjectLike
} from '../../noodl-editor/src/editor/src/models/ProjectPatches/runOnValueChangeMigration';

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
    // 19 → 21: SBR-006 adds `/Admin/Shell` and `/Admin/NewPageDialog`.
    expect(built.project.components).toHaveLength(21);
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
    // 18 → 20, same two components, minus the App this arm deliberately omits.
    expect(built.project.components).toHaveLength(20);

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

// ── 3. The migration fires on this artefact, and one shape of node it silences
//       is a defect rather than a no-op ─────────────────────────────────────────

/**
 * 🔴 **SBR-004 §9.2 and §10. This is the check that would have found the root
 * URL, and it is artefact-wide because the defect was never SBR-004's.**
 *
 * Nothing in the component sets authors `runOnChange-*: false`. The NDA-017
 * back-compat migration writes it on **every project load** (`applypatches.js`),
 * for the value inputs of any node in the fifteen families whose control signal
 * is wired — and it cannot tell a graph authored before NDA-017 §2 from one this
 * template minted this morning. Over the shipped artefact it silences 27 nodes.
 *
 * Most of those are harmless: the control signal is a *consequence* — a query's
 * `fetched`, a button's `onClick`, a request's `receive` — and a consequence
 * arrives after the values that caused it. **The exception is a control signal
 * that fires on a clock the values do not share, and the template has exactly one
 * such signal: `Page.didMount`.** A node triggered by mount, whose value comes
 * from something asynchronous, hits its own `undefined` guard once and never runs
 * again. That was `/Pages/Site`'s `The slug to show`, whose `in-homeSlug` comes
 * from the `SiteSettings` fetch — driven at `/`: zero variables, empty `h1`, no
 * page (§9.2).
 *
 * ✅ **Graded, not exempted.** The rule is not a list of forgiven node names — it
 * is a property of the producer. `PageInputs` is the one producer guaranteed to
 * have delivered before mount: `router.tsx:586` calls `_updatePageInputs` before
 * `addChild(group)` puts the page in the tree. Every other producer into a
 * mount-triggered node has to answer for itself, which is what a reason column
 * that cannot fail would not have made anyone do.
 */
describe('SB-007 — the NDA-017 migration cannot silence a mount-triggered node', () => {
  /**
   * The artefact in the shape the migration reads — concrete rather than
   * `MigrationProjectLike`, whose fields are all optional because it also has to
   * describe a half-loaded project. Grading needs them present, and
   * `typecheck:mcp` is right to insist.
   */
  interface GradableNode {
    id: string;
    type: string;
    parameters?: Record<string, unknown>;
  }
  interface GradableComponent {
    name: string;
    graph: {
      roots: GradableNode[];
      connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
    };
  }
  interface GradableProject {
    components: GradableComponent[];
  }

  const migrationProject = (): GradableProject => ({
    components: shipped.components.map((c) => ({
      name: c.name,
      // `eachNode` recurses through `children`, and a saved v2 graph's `children`
      // are id strings rather than nodes. The migration decides per node and never
      // per subtree, so a flat list of every node is the whole graph to it.
      graph: {
        roots: nodesOf(c).map(({ children, ...node }) => node),
        connections: c.graph.connections ?? []
      } as GradableComponent['graph']
    }))
  });

  /** The signals that fire on the page lifecycle rather than on a value. */
  const MOUNT_SIGNALS = ['didMount'];

  /**
   * The one producer that is ordered before mount by the runtime itself, so a
   * value from it is present when `didMount` fires. Anything else is a race.
   */
  const ORDERED_BEFORE_MOUNT = ['PageInputs'];

  it('the migration really does fire on this template, in bulk', () => {
    // 🔴 THE KNOWN-FIRING SIGNAL. Every absence asserted below passes for free on
    // a plan that writes nothing, and a plan that writes nothing is what a broken
    // import or a renamed family would produce.
    const plan = planRunOnValueChangeMigration(migrationProject() as MigrationProjectLike);
    expect(plan.signalDrivenNodes).toBeGreaterThan(0);
    expect(plan.writes.length).toBeGreaterThan(0);
  });

  /**
   * The grading pass itself, as a function, so the mutant below can call **this**
   * rather than a restatement of it. A mutant that re-implements the rule proves
   * the rule is writable, not that the check runs.
   */
  function gradeMountTriggered(project: GradableProject): { offenders: string[]; graded: string[] } {
    const plan = planRunOnValueChangeMigration(project as MigrationProjectLike);
    const byComponent = new Map(project.components.map((c) => [c.name, c]));
    const nodeIndex = new Map<string, { id: string; type: string }>();
    for (const c of project.components) for (const n of c.graph.roots) nodeIndex.set(`${c.name}::${n.id}`, n);

    const offenders: string[] = [];
    const graded: string[] = [];

    for (const write of plan.writes) {
      const component = byComponent.get(write.component);
      if (!component) continue;
      const incoming = component.graph.connections.filter((w) => w.toId === write.nodeId);

      // Is this node triggered by the page lifecycle at all? If not, its control
      // signal is a consequence and arrives after the values that caused it.
      if (!incoming.some((w) => MOUNT_SIGNALS.includes(w.fromProperty))) continue;

      // It is. Then every producer of the input being silenced must be one the
      // runtime orders before mount — or there must be no producer at all, in
      // which case a stored parameter is the only value there ever was and
      // silencing the port changes nothing.
      const producers = incoming.filter((w) => w.toProperty === write.input);
      const target = nodeIndex.get(`${write.component}::${write.nodeId}`);
      const label = `${write.component} ${target?.type}#${write.nodeId}.${write.input}`;

      if (producers.length === 0) {
        graded.push(`${label} — no wire, a stored parameter is its only value`);
        continue;
      }
      for (const producer of producers) {
        const type = nodeIndex.get(`${write.component}::${producer.fromId}`)?.type ?? '(missing)';
        if (ORDERED_BEFORE_MOUNT.includes(type)) {
          graded.push(`${label} <= ${type} — set before addChild, router.tsx:586`);
        } else {
          offenders.push(`${label} <= ${type}.${producer.fromProperty}`);
        }
      }
    }
    return { offenders: offenders.sort(), graded: graded.sort() };
  }

  it('no node the migration silences is triggered by mount off an unordered producer', () => {
    const { offenders, graded } = gradeMountTriggered(migrationProject());

    // 🔴 The reason column is asserted, not just the emptiness. A grading pass that
    // graded nothing satisfies `offenders == []` exactly as well as one that
    // cleared every row for a stated reason, and those are not the same claim.
    expect(graded).toEqual([
      '/Pages/PageEditor JavaScriptFunction#hold.in-pageId <= PageInputs — set before addChild, router.tsx:586'
    ]);
    expect(offenders).toEqual([]);
  });

  it('MUTANT: the defect as it actually shipped reddens the grader', () => {
    // `/Pages/Site`'s slug resolver with its explicit checkboxes dropped — which is
    // exactly what the migration converts, and exactly the state the site shipped
    // in when `/` rendered no page. Calls the same grader the green arm calls.
    const project = migrationProject();
    const site = project.components.find((c) => c.name === '/Pages/Site')!;
    const resolver = site.graph.roots.find((n) => n.parameters?.['runOnChange-in-homeSlug'] !== undefined)!;
    expect(resolver).toBeDefined();
    delete (resolver.parameters as Record<string, unknown>)['runOnChange-in-homeSlug'];
    delete (resolver.parameters as Record<string, unknown>)['runOnChange-in-slug'];

    const { offenders, graded } = gradeMountTriggered(project);

    // 🔴 It reds on `in-homeSlug` alone, and that is the finding rather than a
    // detail: the migration silences BOTH of this node's inputs, and only one of
    // them is a race. `in-slug` comes from `PageInputs`, which the router sets
    // before the page is in the tree, so mount genuinely has it. `in-homeSlug`
    // comes from the settings read, which answers when the backend answers.
    // A grader that named both would be naming the port list, not the defect.
    expect(offenders).toEqual([
      `/Pages/Site JavaScriptFunction#${resolver.id}.in-homeSlug <= JavaScriptFunction.out-homeSlug`
    ]);
    expect(graded).toContain(
      `/Pages/Site JavaScriptFunction#${resolver.id}.in-slug <= PageInputs — set before addChild, router.tsx:586`
    );
  });
});

/**
 * SBR-015 — every terminal path of a cloud function reaches a Response.
 *
 * The defect this gate exists for: `publishPage` and `duplicatePage` shipped with
 * **no `failure` wire at all**. Every node in both graphs had exactly one way out,
 * the happy path, so any error anywhere became a thirty-second 504 with no status,
 * no message and no node named — while `claimSite`, the same file and the same
 * mechanism, answered in 29 ms because all five of its failure edges land on a
 * `status: 'failure'` Response.
 *
 * 🔴 **The population is derived, not listed.** An endpoint is a component holding
 * a `noodl.cloud.request` node. The three worker components (`SetSectionAccess`,
 * `CopySectionToPage`, `ContactRecipient`) have no Response node at all — they
 * answer through the Run Tasks template contract's own `Failure` output — so they
 * are a genuinely different population, and the control below pins that the split
 * is two-and-not-one rather than letting the rule quietly widen to both.
 */
describe('SBR-015 — a cloud function has no silent exit', () => {
  /**
   * ⚠️ **Classified, not filtered.** A bare list of failure-capable types is an
   * exclusion list that cannot fail: a node type added to a cloud function later
   * would simply not appear, and the gate would go green by not looking. So every
   * type actually present in an endpoint is classified here, and the first test
   * is that the classification is TOTAL — an unclassified type reds before any
   * failure wire is graded.
   */
  const FAILURE_CAPABLE: Record<string, string> = {
    JavaScriptFunction: 'fires Failure when the script throws (simplejavascript.ts)',
    DbCollection2: 'query error → setError → Failure (dbcollectionnode2.ts:812)',
    DbModel2: 'modelcrudbase addFailure mixin',
    SetDbModelProperties: 'modelcrudbase addFailure mixin',
    NewDbModelProperties: 'modelcrudbase addFailure mixin',
    RunTasks: 'outcome contract — done / unchanged / failure',
    'noodl.cloud.secret': 'an unprovisioned secret is a Failure',
    'noodl.cloud.addusertorole': 'a role write can fail',
    'noodl.cloud.sendemail': 'a bounced or unconfigured mail service is a Failure',
    // A component instance answers through its own `Component Outputs`, which
    // this one declares a `Failure` signal on. Same obligation, different port.
    '/#__cloud__/site/ContactRecipient': 'its Component Outputs declares a Failure signal'
  };
  const CANNOT_FAIL: Record<string, string> = {
    'noodl.cloud.request': 'the entry point — it has no failure to report',
    'noodl.cloud.response': 'the exit itself'
  };

  /**
   * 🔴 **Graded, not skipped.** An exclusion list cannot fail — so each entry
   * carries a reason, the reason is asserted non-empty, and a stale entry (a node
   * that no longer exists, or one that now DOES answer) reds rather than sitting
   * there forever. That last half is the one that usually rots.
   */
  const EXEMPT: Record<string, string> = {
    '/#__cloud__/submitContactForm recipient':
      'its Failure is handled by CONTINUING rather than by answering: both Ready and Failure ' +
      'wire to save.store, so a recipient that cannot be resolved still records the message ' +
      'and the answer still comes from mail.completed / save.failure downstream.',
    '/#__cloud__/submitContactForm compose':
      'a throw here degrades the email rather than stalling: it does not gate save, ' +
      'stored still runs and mail.completed still answers. Answering on its failure ' +
      'would pre-empt the save and tell the visitor "received" before the row exists.'
  };

  const endpoints = shipped.components.filter((c) => nodesOf(c).some((n) => n.type === 'noodl.cloud.request'));

  it('control: there are endpoints to grade, and workers that are NOT endpoints', () => {
    // Both halves matter. The first says the population is not empty (a gate over
    // nothing is green for the wrong reason); the second says the split is real,
    // because a rule that had silently widened to the workers would demand a
    // Response node on components that correctly have none.
    expect(endpoints.map((c) => c.name).sort()).toEqual([
      '/#__cloud__/claimSite',
      '/#__cloud__/duplicatePage',
      '/#__cloud__/publishPage',
      '/#__cloud__/submitContactForm'
    ]);
    const workers = shipped.components.filter(
      (c) => c.name.startsWith('/#__cloud__/') && !nodesOf(c).some((n) => n.type === 'noodl.cloud.request')
    );
    expect(workers).toHaveLength(3);
    expect(workers.every((c) => nodesOf(c).every((n) => n.type !== 'noodl.cloud.response'))).toBe(true);
  });

  it('🔴 every node type inside an endpoint is classified — the rule cannot skip one by not knowing it', () => {
    const unclassified = [
      ...new Set(
        endpoints.flatMap((c) =>
          nodesOf(c)
            .map((n) => n.type)
            .filter((t) => FAILURE_CAPABLE[t] === undefined && CANNOT_FAIL[t] === undefined)
        )
      )
    ].sort();
    expect(unclassified).toEqual([]);
  });

  /** Nodes whose `failure` reaches a Response `send`, per endpoint. */
  function unanswered(component: Component): string[] {
    const nodes = nodesOf(component);
    const responses = new Set(nodes.filter((n) => n.type === 'noodl.cloud.response').map((n) => n.id));
    // 🔴 The edge, not the node. The first version of this grader asked "does
    // this node reach a Response's send?" — and every node on a happy path does,
    // so a node with `done -> res.send` and NO failure wire graded as answered.
    // That is a hole exactly the shape of the defect: it would have passed the
    // unfixed `publishPage`, whose `page.done -> res.send` was the one edge it
    // had. The mutant below is what caught it.
    //
    // `completed` counts as well as `failure`, and correctly: it "fires after
    // every invocation, whatever the outcome" (`outcome.ts`), so a node wired by
    // it does answer on its failure path — that is exactly why
    // `submitContactForm` uses it for the mail.
    const answered = new Set(
      component.graph.connections
        .filter(
          (w) =>
            responses.has(w.toId) &&
            w.toProperty === 'send' &&
            (w.fromProperty === 'failure' || w.fromProperty === 'completed')
        )
        .map((w) => w.fromId)
    );
    return nodes
      .filter((n) => FAILURE_CAPABLE[n.type] !== undefined && !answered.has(n.id))
      .filter((n) => EXEMPT[`${component.name} ${n.id}`] === undefined)
      .map((n) => `${component.name} ${n.type}#${n.id} ${(n as { label?: string }).label ?? ''}`.trim());
  }

  /** Every exempted node, whether it still exists and whether it still needs the exemption. */
  function exemptionState(): Array<{ key: string; exists: boolean; stillNeeded: boolean; reason: string }> {
    return Object.entries(EXEMPT).map(([key, reason]) => {
      const [componentName, nodeId] = [key.slice(0, key.lastIndexOf(' ')), key.slice(key.lastIndexOf(' ') + 1)];
      const component = shipped.components.find((c) => c.name === componentName);
      const node = component && nodesOf(component).find((n) => n.id === nodeId);
      if (!component || !node) return { key, exists: false, stillNeeded: false, reason };
      const responses = new Set(nodesOf(component).filter((n) => n.type === 'noodl.cloud.response').map((n) => n.id));
      const answers = component.graph.connections.some(
        (w) =>
          w.fromId === nodeId &&
          responses.has(w.toId) &&
          w.toProperty === 'send' &&
          (w.fromProperty === 'failure' || w.fromProperty === 'completed')
      );
      return { key, exists: true, stillNeeded: !answers, reason };
    });
  }

  it('🔴 every exemption still names a real node, still needs exempting, and says why', () => {
    // Three ways an exclusion list rots, all three graded: the node was deleted,
    // the node was fixed and the entry outlived it, and the entry never had a
    // reason in the first place.
    expect(exemptionState().filter((e) => !e.exists).map((e) => e.key)).toEqual([]);
    expect(exemptionState().filter((e) => !e.stillNeeded).map((e) => e.key)).toEqual([]);
    expect(exemptionState().filter((e) => e.reason.trim().length < 40).map((e) => e.key)).toEqual([]);
  });

  it('🔴 no failure-capable node in any endpoint fails into nothing', () => {
    const offenders = endpoints.flatMap(unanswered).sort();
    expect(offenders).toEqual([]);
  });

  it('control: the grader discriminates — removing one failure wire reds, and names the node', () => {
    // 🔴 The mutant is the point. `toEqual([])` on a list built by a filter is
    // green when the filter is wrong, when the population is empty, and when the
    // walk never reached the nodes — three ways to pass without measuring. This
    // proves the grader can go red, and that what it says when it does is the
    // offending node rather than a count.
    const publish = endpoints.find((c) => c.name === '/#__cloud__/publishPage') as Component;
    const mutant = JSON.parse(JSON.stringify(publish)) as Component;
    const nodes = nodesOf(mutant);
    const page = nodes.find((n) => (n as { label?: string }).label === 'Write the page: mirror + access rules');
    expect(page).toBeDefined();
    mutant.graph.connections = mutant.graph.connections.filter(
      (w) => !(w.fromId === page?.id && w.fromProperty === 'failure')
    );
    // It must red, and the node it names must be the one whose wire was cut —
    // not merely "something is wrong".
    const offenders = unanswered(mutant);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toContain('Write the page: mirror + access rules');
    // …and the unmutated original is clean, so the difference is the wire.
    expect(unanswered(publish)).toEqual([]);
  });

  it('🔴 Run Tasks is never wired by `completed` where the graph means success', () => {
    // `completed` "fires after every invocation, whatever the outcome"
    // (`outcome.ts`, COMPLETED_WITH_OTHER_OUTCOMES). Wired into a writer or a
    // Response it reports success after a run that FAILED — publishPage marked a
    // page published having set no section's access rules, and duplicatePage
    // answered with a page id after a section copy that failed, which is exactly
    // the partial-copy-that-looks-like-success its own graph warns about.
    //
    // ⚠️ `completed` is legitimate for "carry on regardless" and two wires use it
    // that way on purpose, so this grades WHERE it lands rather than banning it:
    // into a Response `send` or a record write is a success claim; into another
    // node's `run` is not.
    const claims = shipped.components
      .filter((c) => c.name.startsWith('/#__cloud__/'))
      .flatMap((c) => {
        const nodes = nodesOf(c);
        const type = new Map(nodes.map((n) => [n.id, n.type]));
        return c.graph.connections
          .filter(
            (w) =>
              w.fromProperty === 'completed' &&
              type.get(w.fromId) === 'RunTasks' &&
              (w.toProperty === 'send' || w.toProperty === 'store')
          )
          .map((w) => `${c.name} ${w.fromId}.completed -> ${w.toProperty}`);
      });
    expect(claims).toEqual([]);
  });

  it('control: the two deliberate `completed` wires survive — this rule did not ban the port', () => {
    // If the rule above had been "no `completed` anywhere" it would have gone
    // green by deleting two correct wires. Both are documented in
    // `sb004Components.ts`: an unprovisioned secret must still reach the picker,
    // and a bounced mail must still answer the visitor.
    const kept = shipped.components
      .filter((c) => c.name.startsWith('/#__cloud__/'))
      .flatMap((c) => c.graph.connections.filter((w) => w.fromProperty === 'completed').map(() => c.name))
      .sort();
    expect(kept).toEqual(['/#__cloud__/site/ContactRecipient', '/#__cloud__/submitContactForm']);
  });
});
