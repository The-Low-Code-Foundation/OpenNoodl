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

import {
  EMPTY_PAGE_LIST_TEXT,
  PAGE_LIST_ERROR_TEXT,
  ROUTER,
  SIGNED_OUT_TEXT,
  SIGNIN_REFUSAL_TEXT
} from './sb005Components';
import { SITE_URL_PATH } from './sb006Components';
import { APP_COMPONENT, buildSiteTemplateProject, toTemplateContent } from './sb007Template';
import {
  planRunOnValueChangeMigration,
  RUN_ON_CHANGE_FAMILIES,
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
    // 21 → 22: SBR-017 adds `/Pages/SignIn`.
    // 22 → 24: SBR-007 AC2 adds `/#__cloud__/reorderSection` and the worker it
    // runs, `/#__cloud__/site/SetSectionOrder`.
    expect(built.project.components).toHaveLength(24);
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
    expect(built.order.filter((key) => key.startsWith('Pages/'))).toHaveLength(6);
    // 18 → 20, same two components, minus the App this arm deliberately omits.
    // 20 → 21 with SBR-017's sign-in page.
    // 21 → 23 with AC2's endpoint and its worker — both cloud components, which
    // this arm writes exactly as the other one does. That they are here at all is
    // the point of the assertion below: written, and registered nowhere.
    expect(built.project.components).toHaveLength(23);

    // And not one of them landed in a router, with no diagnostic anywhere.
    expect(built.registrations).toEqual({});
  });

  it('control: with the App, the same components register six pages', async () => {
    // 🔴 The arm that turns the absence above into a measurement. Without it,
    // `registrations === {}` is consistent with a builder that never populates
    // that map at all — which is the same reading, and the opposite fix.
    const built = await buildSiteTemplateProject();
    expect(Object.keys(built.registrations).sort()).toEqual([
      'Pages/Admin',
      'Pages/PageEditor',
      'Pages/Setup',
      'Pages/SignIn',
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
    // 7 → 9: SBR-007 AC2's `reorderSection` and its `site/SetSectionOrder` worker.
    expect(cloud).toHaveLength(9);
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
      // 🔴 DEEP clone, and D32's control arm is why. The spread below used to be
      // shallow, so every node's `parameters` was the SAME object as the
      // module-level `shipped` artefact's — and the two mutant arms in this
      // block `delete` from it. The mutation outlived the test that made it and
      // leaked into every later reader of `shipped`, which is how a fresh
      // `migrationProject()` came back with the mutant's damage already applied.
      graph: {
        roots: nodesOf(c).map(({ children, ...node }) => ({
          ...node,
          parameters: node.parameters ? { ...node.parameters } : node.parameters
        })),
        connections: (c.graph.connections ?? []).map((w) => ({ ...w }))
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

  /**
   * 🔴 **D32 — what the pass above REACHES, asserted as a number.**
   *
   * `gradeMountTriggered` opens with a `continue`, so it examines a write only
   * when the node is triggered by `didMount`. Over the shipped artefact that is
   * **one write of sixty-five**. The pass is not wrong — it grades a real hazard
   * correctly — but it reads as coverage of the migration and is coverage of
   * 1.5% of it, and that is how D31 shipped past a suite that already knew about
   * the migration.
   *
   * The number is pinned here so it cannot drift silently. If the artefact grows
   * a second mount-triggered node this arm fails and someone reads the reason.
   * ✅ *A pass whose first line is a `continue` is not coverage until you have
   * counted what it REACHED.*
   */
  it('D32 — the mount pass reaches 1 of 65 writes, and the rest are graded below', () => {
    const project = migrationProject();
    const plan = planRunOnValueChangeMigration(project as MigrationProjectLike);
    const { graded, offenders } = gradeMountTriggered(project);

    expect(plan.writes.length).toBe(65);
    // Cardinality: every write is either reached by the mount pass or skipped by
    // it. Asserted where the two meet, so "graded" can never quietly mean "few".
    expect(graded.length + offenders.length).toBe(1);
  });

  // ── D32's second pass: the failure mode nothing graded ──────────────────────

  /** The nodes that write a record. A write is what closes the loop below. */
  const RECORD_WRITE_TYPES = ['SetDbModelProperties', 'NewDbModelProperties'];
  /** The node that reads a collection back out. */
  const COLLECTION_TYPES = ['DbCollection2'];
  const COMPONENT_INPUTS = 'Component Inputs';
  const FOR_EACH = 'For Each';

  /**
   * 🔴 **D32's repair: the OTHER failure mode, and the one D31 actually was.**
   *
   * `gradeMountTriggered` asks whether silencing an input BREAKS the node. This
   * asks the mirror question — whether silencing it is the only thing STOPPING
   * the node from running forever: the node's output reaches a record write on
   * collection `K`, and the silenced input is fed from `K`.
   *
   * 🔴 **Why an offender is a TEMPLATE defect, not a migration one.** NDA-017
   * writes these flags on **editor load only**. A headless render, a deploy taken
   * from the artefact, or an agent reading through the MCP door never runs it. A
   * load-bearing flag the template leaves to the migration is therefore present
   * exactly for the consumer that was going to be fine and absent for the three
   * that were not. D31 was 115,755 write errors in eleven seconds of a page
   * nobody touched.
   *
   * ⚠️ This does NOT require the template to state all 65. It reaches a write
   * only when that write's node both reads and writes one collection.
   *
   * **Two confidences, kept apart on purpose** — see the arms below:
   *  - `repeaterItem` — the input is a **repeater item** and the node writes the
   *    very collection the repeater draws from. This is D31 exactly: the write
   *    lands on the item's own model, so the item changes, so the node re-runs.
   *    A **confirmed** hazard, and the mutant restores it.
   *  - `sameCollection` — the node reads and writes one collection by any other
   *    route. **Plausible, unconfirmed**: whether the value actually cycles
   *    depends on whether the write reaches the input again at runtime, and D31
   *    needed the runtime's own `[runtime/cyclic-loop]` to settle that. Pinned as
   *    a census rather than asserted as a defect.
   */
  function gradeWriteBackCycle(project: GradableProject): {
    repeaterItem: string[];
    sameCollection: string[];
    cleared: string[];
    reached: number;
  } {
    const plan = planRunOnValueChangeMigration(project as MigrationProjectLike);
    const byComponent = new Map(project.components.map((c) => [c.name, c]));

    /** Every collection a node's output reaches a record write on, transitively. */
    function collectionsWritten(component: GradableComponent, nodeId: string): Set<string> {
      const nodes = new Map(component.graph.roots.map((n) => [n.id, n]));
      const found = new Set<string>();
      const seen = new Set<string>([nodeId]);
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const wire of component.graph.connections) {
          if (wire.fromId !== current || seen.has(wire.toId)) continue;
          seen.add(wire.toId);
          const target = nodes.get(wire.toId);
          if (target && RECORD_WRITE_TYPES.includes(target.type)) {
            const name = target.parameters?.['collectionName'];
            if (typeof name === 'string') found.add(name);
          }
          queue.push(wire.toId);
        }
      }
      return found;
    }

    /** Collections that reach this component as a `For Each` item, project-wide. */
    function collectionsFeedingTemplate(templateName: string): Set<string> {
      const found = new Set<string>();
      for (const carrier of project.components) {
        const nodes = new Map(carrier.graph.roots.map((n) => [n.id, n]));
        for (const each of carrier.graph.roots) {
          if (each.type !== FOR_EACH) continue;
          if (each.parameters?.['template'] !== templateName) continue;
          for (const wire of carrier.graph.connections) {
            if (wire.toId !== each.id || wire.toProperty !== 'items') continue;
            const source = nodes.get(wire.fromId);
            if (!source || !COLLECTION_TYPES.includes(source.type)) continue;
            const name = source.parameters?.['collectionName'];
            if (typeof name === 'string') found.add(name);
          }
        }
      }
      return found;
    }

    /**
     * Every collection whose contents can reach this input, walking BACKWARDS,
     * and whether the route was the component's own interface (a repeater item).
     */
    function feeding(
      component: GradableComponent,
      nodeId: string,
      input: string
    ): { collections: Set<string>; viaInterface: Set<string> } {
      const nodes = new Map(component.graph.roots.map((n) => [n.id, n]));
      const collections = new Set<string>();
      const viaInterface = new Set<string>();
      const seen = new Set<string>();
      const queue: Array<{ id: string; port?: string }> = [{ id: nodeId, port: input }];
      while (queue.length > 0) {
        const current = queue.shift() as { id: string; port?: string };
        for (const wire of component.graph.connections) {
          if (wire.toId !== current.id) continue;
          if (current.port !== undefined && wire.toProperty !== current.port) continue;
          if (seen.has(wire.fromId)) continue;
          seen.add(wire.fromId);
          const source = nodes.get(wire.fromId);
          if (source && COLLECTION_TYPES.includes(source.type)) {
            const name = source.parameters?.['collectionName'];
            if (typeof name === 'string') collections.add(name);
          }
          if (source && source.type === COMPONENT_INPUTS) {
            for (const name of collectionsFeedingTemplate(component.name)) {
              collections.add(name);
              viaInterface.add(name);
            }
          }
          queue.push({ id: wire.fromId });
        }
      }
      return { collections, viaInterface };
    }

    const repeaterItem: string[] = [];
    const sameCollection: string[] = [];
    const cleared: string[] = [];
    let reached = 0;

    for (const write of plan.writes) {
      const component = byComponent.get(write.component);
      if (!component) continue;
      const nodes = new Map(component.graph.roots.map((n) => [n.id, n]));

      const written = collectionsWritten(component, write.nodeId);
      if (written.size === 0) continue;
      reached++;

      const { collections, viaInterface } = feeding(component, write.nodeId, write.input);
      const shared = [...written].filter((k) => collections.has(k)).sort();
      const label = `${write.component} ${nodes.get(write.nodeId)?.type}#${write.nodeId}.${write.input}`;
      if (shared.length === 0) {
        cleared.push(`${label} — writes "${[...written].sort().join(', ')}", which does not feed it`);
        continue;
      }
      if (shared.some((k) => viaInterface.has(k))) {
        repeaterItem.push(`${label} — writes "${shared.join(', ')}" and is fed it AS A REPEATER ITEM`);
      } else {
        sameCollection.push(`${label} — reads and writes "${shared.join(', ')}"`);
      }
    }
    return {
      repeaterItem: repeaterItem.sort(),
      sameCollection: sameCollection.sort(),
      cleared: cleared.sort(),
      reached
    };
  }

  /**
   * 🔴 **D32's own number, applied to D32's own repair.** The pass above must not
   * be graded the way `gradeMountTriggered` was — by its offender count, with
   * nobody asking what it examined. It reaches **29 of 65**, against the mount
   * pass's **1**, and every one of the 29 is either named as a hazard or cleared
   * with a stated reason.
   */
  it('D32 — the second pass reaches 29 of 65, and clears the rest by name', () => {
    const project = migrationProject();
    const plan = planRunOnValueChangeMigration(project as MigrationProjectLike);
    const { repeaterItem, sameCollection, cleared, reached } = gradeWriteBackCycle(project);

    expect(plan.writes.length).toBe(65);
    expect(reached).toBe(29);
    // Cardinality where the three buckets meet: nothing reached is unaccounted for.
    expect(repeaterItem.length + sameCollection.length + cleared.length).toBe(reached);
  });

  it('D32 — no write the migration must make stands in a REPEATER-ITEM write-back cycle', () => {
    // 🟢 Green because the template states D31's three flags itself since s32, so
    // the migration no longer plans them. The mutant below is what proves this
    // arm can fail.
    expect(gradeWriteBackCycle(migrationProject()).repeaterItem).toEqual([]);
  });

  it('D32 MUTANT: D31 as it shipped — the three flags back off the template', () => {
    const project = migrationProject();
    const row = project.components.find((c) => c.name === '/Admin/SectionRow')!;
    const merge = row.graph.roots.find((n) => n.parameters?.['runOnChange-in-data'] === false)!;
    expect(merge).toBeDefined();
    for (const input of ['in-data', 'in-body', 'in-image']) {
      delete (merge.parameters as Record<string, unknown>)[`runOnChange-${input}`];
    }

    // 🔴 TWO of the three, and which two is the finding rather than a detail.
    // `in-data` is the repeater item itself; `in-body` traces back to it through
    // `unpack-2 → bodyField.startValue → bodyField.onTextChanged`, which is why
    // D31's fix needed three flags and not one. `in-image` is absent because it
    // comes from `upload.cloudFile` — the upload, not the collection — so it is
    // in the migration's write set without being in the cycle. A grader that
    // named all three would be naming the port list, not the loop.
    expect(gradeWriteBackCycle(project).repeaterItem).toEqual([
      `/Admin/SectionRow JavaScriptFunction#${merge.id}.in-body — writes "Section" and is fed it AS A REPEATER ITEM`,
      `/Admin/SectionRow JavaScriptFunction#${merge.id}.in-data — writes "Section" and is fed it AS A REPEATER ITEM`
    ]);
  });

  it('D32 CONTROL: the second pass reaches a write the mount pass cannot see', () => {
    // 🔴 The two passes must not be the same pass. The mount arm reaches ONE
    // write, and it is not this one — so if this arm ever started agreeing with
    // it, the mutant above would be passing for the wrong reason.
    const project = migrationProject();
    const row = project.components.find((c) => c.name === '/Admin/SectionRow')!;
    const merge = row.graph.roots.find((n) => n.parameters?.['runOnChange-in-data'] === false)!;
    for (const input of ['in-data', 'in-body', 'in-image']) {
      delete (merge.parameters as Record<string, unknown>)[`runOnChange-${input}`];
    }
    const mount = gradeMountTriggered(project);
    const cycle = gradeWriteBackCycle(project);

    expect([...mount.offenders, ...mount.graded].some((line) => line.includes('.in-data'))).toBe(false);
    expect(cycle.repeaterItem.some((line) => line.includes('.in-data'))).toBe(true);
  });

  /**
   * 🔴 **The unconfirmed six, pinned rather than hidden.**
   *
   * These reach a record write on a collection they also read, but NOT as a
   * repeater item — so whether the written value comes back round to the input
   * is a runtime question this artefact cannot answer. Every one is on
   * `/Pages/ThemeEditor`, and the plausible reading is benign: `startValue` on a
   * text input does not emit `onTextChanged`, so the write may never re-enter.
   *
   * ⚠️ **Plausible is not measured.** D31 looked benign by the same reasoning
   * until the runtime named it — `[noodl] JavaScriptFunction (/Admin/SectionRow):
   * Cyclic loop detected [runtime/cyclic-loop]`. These are owed a drive on the
   * theme editor, filed as phase 77 **D33**.
   *
   * The census is asserted exactly so a SEVENTH cannot appear quietly. A new
   * entry fails this arm and someone reads the reason.
   */
  it('D32 — the unconfirmed same-collection census is exactly the six known rows', () => {
    expect(gradeWriteBackCycle(migrationProject()).sameCollection).toEqual([
      '/Pages/ThemeEditor JavaScriptFunction#buildTokens.in-background — reads and writes "Theme"',
      '/Pages/ThemeEditor JavaScriptFunction#buildTokens.in-fontDisplay — reads and writes "Theme"',
      '/Pages/ThemeEditor JavaScriptFunction#buildTokens.in-primary — reads and writes "Theme"',
      '/Pages/ThemeEditor JavaScriptFunction#buildTokens.in-text — reads and writes "Theme"',
      '/Pages/ThemeEditor JavaScriptFunction#readSettings-2.in-rows — reads and writes "SiteSettings"',
      '/Pages/ThemeEditor JavaScriptFunction#readTheme.in-rows — reads and writes "Theme"'
    ]);
  });

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

// ── 4. SBR-016: a query in a page nobody has edited yet ──────────────────────

/**
 * 🔴 **SBR-016. The defect: `/admin/pages` rendered the shell, the heading and
 * `New page`, and no rows — while the session the panel itself held read the row
 * over HTTP in 2 ms.** Not refused, not empty: the collection never asked.
 *
 * ## Why the gate SB-005 already had could not see it
 *
 * `assertUnfilteredQuery` (`sb005AdminPanel.test.ts`) asserts precisely the right
 * thing about the page list — that the author did **not** write
 * `runOnChange-collectionName: false` — and it was green throughout. It reads the
 * parameters the door wrote. The runtime does not read those parameters: it reads
 * them after `applyPatches` has run the NDA-017 migration over them, and the
 * migration writes that exact `false` into any node in the fifteen families whose
 * control signal is wired. The page list's `storageFetch` is wired — from a
 * create and from a row edit, both *consequences of an edit* — so every load
 * silenced the one trigger that fires without one.
 *
 * **The gate and the runtime were reading two different graphs, and only one of
 * them was the one that runs.** Every check in this file that reads
 * `node.parameters` directly has the same blind spot; this one closes it for the
 * query family by grading the artefact **after** the migration has had it.
 *
 * ## What is graded
 *
 * Every `DbCollection2` in the artefact — no population split, no exemptions.
 * A query is asked one question: *after the migration, is there any way for you
 * to run that does not require a person to have already edited something?* The
 * answer must be yes, and the **reason** is asserted by name, because a pass with
 * no reason is what an exclusion list produces.
 *
 * Triggers come in two shapes and both are graded:
 *
 * - a wire into `storageFetch` — the shape the acceptance criterion names;
 * - a **value input whose checkbox survived the migration**, which is the shape
 *   the whole template is actually built on. `/Pages/Admin` fetches because
 *   `collectionName` lands at load; `/Pages/PageEditor` fetches because
 *   `qp-pageId` arrives. Neither is a wire into `storageFetch`, and a gate that
 *   only looked for wires would have demanded a mount fetch on the filtered
 *   query — which is F12, the defect `NO_LOAD_TIME_FETCH` exists to prevent.
 *
 * ## The producers are classified, never listed
 *
 * A source is edit-free, edit-driven, or **transparent** — a node that merely
 * passes its own trigger along, graded by recursing into whatever makes *it* run.
 * The control signal it recurses through is read from `RUN_ON_CHANGE_FAMILIES`
 * rather than restated, so a family whose control signal is renamed cannot leave
 * this walk quietly reading the wrong port. Anything the classifier does not
 * recognise is an **offender**, named with its type and port: an unknown producer
 * reds the gate rather than being skipped, which is the difference between a rule
 * and a list of the cases somebody happened to think of.
 */
describe('SBR-016 — every query can run before anybody has edited anything', () => {
  interface GNode {
    id: string;
    type: string;
    parameters?: Record<string, unknown>;
  }
  interface GWire {
    fromId: string;
    fromProperty: string;
    toId: string;
    toProperty: string;
  }
  interface GComponent {
    name: string;
    graph: { roots: GNode[]; connections: GWire[] };
  }
  interface GProject {
    components: GComponent[];
  }

  /**
   * The artefact flattened, exactly as the migration reads it — and **deep-copied**.
   *
   * ⚠️ A shallow `{ children, ...node }` spread shares the `parameters` object with
   * `shipped`, so a mutant's `delete` reached the module-level artefact and every
   * later test in this block inherited it. Measured, not imagined: the page-editor
   * mutant reported the page list as an offender too, because the mutant before it
   * had already removed the page list's checkbox from the shared object.
   */
  const flatProject = (): GProject =>
    JSON.parse(
      JSON.stringify({
        components: shipped.components.map((c) => ({
          name: c.name,
          graph: {
            roots: nodesOf(c).map(({ children, ...node }) => node),
            connections: c.graph.connections ?? []
          }
        }))
      })
    ) as GProject;

  /**
   * The artefact **as the runtime gets it** — the migration's writes applied.
   *
   * This single call is the whole difference between this gate and the one that
   * was green while the panel was blank.
   */
  function migrated(project: GProject): GProject {
    const out: GProject = JSON.parse(JSON.stringify(project));
    const plan = planRunOnValueChangeMigration(out as MigrationProjectLike);
    const index = new Map<string, GNode>();
    for (const c of out.components) for (const n of c.graph.roots) index.set(`${c.name}::${n.id}`, n);
    for (const write of plan.writes) {
      const node = index.get(`${write.component}::${write.nodeId}`);
      if (!node) continue;
      (node.parameters ??= {})[write.parameter] = false;
    }
    return out;
  }

  /**
   * Which stored parameter names carry a value for which checkbox.
   *
   * `dbcollectionnode2.ts`: `setCollectionName` (`:561`) asks about
   * `collectionName`; `setVisualFilter` (`:1047`) and `setVisualSorting`
   * (`:1052`) both ask about `querySettings`. A parameter here means the value is
   * in the file, so it lands at load with no wire and no person involved.
   */
  const PARAMETER_CHECKBOX: Record<string, string> = {
    collectionName: 'collectionName',
    visualFilter: 'querySettings',
    visualSort: 'querySettings'
  };

  /**
   * The population, derived twice and cross-checked.
   *
   * 🔴 **A cloud component is invoked, not arrived at**, and the difference is not
   * cosmetic: inside `duplicatePage` a `Create Record`'s `done` is a step in
   * answering a request, while on `/Pages/Admin` the identical port means *a
   * person has already made a page*. One rule cannot read both, and running the
   * browser rule over the cloud half produced three rows that were about the
   * classifier rather than the template. The cloud half has its own gate — every
   * terminal path reaches a Response, below.
   *
   * 🔴 **The split is the name prefix, and the attempt to derive it twice is what
   * proved that.** The first draft of this gate called a component cloud if it held
   * a `noodl.cloud.request` or a `Component Outputs` — and the control below caught
   * it immediately: `/Admin/PageRow` and `/Admin/SectionRow` have `Component
   * Outputs` too, because that is how a repeater row signals `Changed`. Worse, two
   * of the three worker components hold **no** `noodl.cloud.*` node at all
   * (`SetSectionAccess`, `CopySectionToPage`), so there is no graph property that
   * separates them from a browser component. `/#__cloud__/` is not a naming habit
   * here; it is what the door reads to decide where a component is deployed.
   *
   * ⚠️ So the control below is **one-directional, and says so**: a cloud-only node
   * may never appear outside the prefix. It does not prove the prefixed set is
   * exactly the cloud set — nothing in the artefact can — and the mis-classification
   * it caught was invisible to the rule itself, because neither row component holds
   * a query. A control that only ran over the graded rows would have stayed green.
   */
  const CLOUD_PREFIX = '/#__cloud__/';
  const isCloud = (c: GComponent) => c.name.startsWith(CLOUD_PREFIX);

  /**
   * Signal and value ports that fire because the app *arrived*, not because
   * somebody did something. Each carries the reason it is one.
   */
  const ARRIVAL: Array<{ type: string; port: RegExp; why: string }> = [
    { type: 'Page', port: /^didMount$/, why: 'the page mounted' },
    { type: 'PageInputs', port: /^pm-/, why: 'the router set it before addChild (router.tsx:586)' },
    { type: 'noodl.cloud.request', port: /./, why: 'the request is the arrival' }
  ];

  /**
   * Ports that exist only because a person acted, or because a write they caused
   * finished. A query whose only triggers are these is the defect.
   */
  const EDIT: Array<{ type: RegExp; port: RegExp; why: string }> = [
    { type: /^net\.noodl\.controls\./, port: /./, why: 'a control the person operated' },
    { type: /^(New|Set|Delete)DbModelProperties$/, port: /./, why: 'a write the person caused' },
    { type: /^For Each$/, port: /^itemOutputSignal-/, why: 'a row signalled a change' },
    { type: /^NavigationShowPopup$/, port: /^close/, why: 'the person closed the dialog' }
  ];

  /**
   * Families that pass a trigger along rather than originating one. Graded by
   * recursing into what makes them run — their control signal where they have
   * one, and their own value inputs where they do not.
   */
  const TRANSPARENT = new Set([
    'JavaScriptFunction',
    'Expression',
    'Condition',
    'States',
    'DbCollection2',
    'DbModel2',
    'CloudFunction2',
    'Component Inputs'
  ]);

  /**
   * 🔴 **Node types that cannot emit anything without being invoked, and the port
   * that invokes them.** `nodeIsFree`'s fallback — *"it is not signal-driven, so
   * a value landing runs it"* — reads `RUN_ON_CHANGE_FAMILIES` to decide whether
   * a node has a control signal, and a type absent from that registry falls
   * through to being graded by its VALUE inputs. For `CloudFunction2` that is
   * simply untrue: `scheduleCall` is *"the only method the `Call` port reaches"*
   * (`cloudfunction2.ts:225-227`), so a cloud call with an edit-free `in-pageId`
   * and a button on its `Call` was being graded edit-free.
   *
   * It went unnoticed because nothing had ever reached it: `CloudFunction2` is in
   * `TRANSPARENT`, but until SBR-007 AC2 wired `reorder.done → storageFetch` no
   * cloud call had ever sat on a query's trigger path. The walk then reported
   * `/Pages/PageEditor sections-2` as running because *"the page mounted"* —
   * true of the value it followed, and false of the trigger it was grading.
   *
   * The registry cannot answer this on its own, and should not be made to: it
   * describes which value inputs re-run a node, and these types have none. So
   * the assumption is written here, where the rule that depends on it lives.
   */
  const INVOCATION_ONLY: Record<string, string> = {
    CloudFunction2: 'call'
  };

  interface Verdict {
    free: boolean;
    why: string;
  }

  /** Grade one query, and every producer behind it. */
  function gradeQueries(project: GProject): { offenders: string[]; graded: string[] } {
    const offenders: string[] = [];
    const graded: string[] = [];

    for (const component of project.components.filter((c) => !isCloud(c))) {
      const nodes = new Map(component.graph.roots.map((n) => [n.id, n]));
      const wires = component.graph.connections;
      const incoming = (id: string, port?: string) =>
        wires.filter((w) => w.toId === id && (port === undefined || w.toProperty === port));

      /** Guard against a cycle: a node already being graded cannot vouch for itself. */
      const inFlight = new Set<string>();

      /** Does this node produce anything without a person having acted? */
      function nodeIsFree(node: GNode): Verdict {
        if (inFlight.has(node.id)) return { free: false, why: 'a cycle' };
        inFlight.add(node.id);
        try {
          const family = RUN_ON_CHANGE_FAMILIES[node.type];
          // 🔴 `INVOCATION_ONLY` first. A type in it has no value-driven run at
          // all, so falling through to the value-input branch below would grade
          // it by something that cannot make it produce. See the map's note.
          const control = INVOCATION_ONLY[node.type] ?? family?.controlSignal;
          const controlWires = control ? incoming(node.id, control) : [];

          // An invocation-only node with nothing on its invoking port never runs,
          // so it cannot vouch for anything — and saying so is not the same
          // sentence as "run only by an edit".
          if (INVOCATION_ONLY[node.type] && controlWires.length === 0) {
            return { free: false, why: `${node.type} is never invoked` };
          }

          // Its control signal is wired: that signal is the only thing that runs it.
          if (controlWires.length > 0) {
            for (const w of controlWires) {
              const v = sourceIsFree(w);
              if (v.free) return { free: true, why: `${node.type} run by ${v.why}` };
            }
            return { free: false, why: `${node.type} run only by an edit` };
          }

          // It is not signal-driven, so a value landing runs it. A stored
          // parameter lands at load; a wired value inherits its producer.
          const stored = Object.keys(node.parameters ?? {}).filter((k) => !k.startsWith('runOnChange-'));
          if (stored.length > 0 && incoming(node.id).length === 0) {
            return { free: true, why: `${node.type} has only stored parameters` };
          }
          for (const w of incoming(node.id)) {
            const v = sourceIsFree(w);
            if (v.free) return { free: true, why: `${node.type} fed by ${v.why}` };
          }
          if (stored.length > 0) return { free: true, why: `${node.type} has stored parameters` };
          return { free: false, why: `${node.type} fed only by an edit` };
        } finally {
          inFlight.delete(node.id);
        }
      }

      /** Grade one wire by what is on the far end of it. */
      function sourceIsFree(wire: GWire): Verdict {
        const from = nodes.get(wire.fromId);
        if (!from) return { free: false, why: `a wire from a node that is gone (${wire.fromId})` };

        for (const rule of ARRIVAL) {
          if (from.type === rule.type && rule.port.test(wire.fromProperty)) {
            return { free: true, why: `${from.type}.${wire.fromProperty} — ${rule.why}` };
          }
        }
        for (const rule of EDIT) {
          if (rule.type.test(from.type) && rule.port.test(wire.fromProperty)) {
            return { free: false, why: `${from.type}.${wire.fromProperty} — ${rule.why}` };
          }
        }
        if (TRANSPARENT.has(from.type)) {
          const v = nodeIsFree(from);
          return { free: v.free, why: `${from.type}.${wire.fromProperty} <= ${v.why}` };
        }
        // 🔴 Not recognised. This is an offender rather than a skip.
        return { free: false, why: `UNCLASSIFIED ${from.type}.${wire.fromProperty}` };
      }

      for (const query of component.graph.roots.filter((n) => n.type === 'DbCollection2')) {
        const where = `${component.name} ${query.id}`;
        const parameters = query.parameters ?? {};
        const ticked = (input: string) => parameters[`runOnChange-${input}`] !== false;

        let verdict: Verdict | undefined;
        /** Every trigger considered and why it did not count — an offender must be actionable. */
        const tried: string[] = [];

        // Shape 1 — a wire into `storageFetch` from something that is not an edit.
        for (const w of incoming(query.id, 'storageFetch')) {
          const v = sourceIsFree(w);
          if (v.free) {
            verdict = { free: true, why: `storageFetch <= ${v.why}` };
            break;
          }
          tried.push(`storageFetch <= ${v.why}`);
        }

        // Shape 2 — a value input whose checkbox survived the migration, holding a
        // value that arrives without a person: a stored parameter, or an
        // edit-free producer.
        if (!verdict) {
          for (const [parameter, checkbox] of Object.entries(PARAMETER_CHECKBOX)) {
            if (!(parameter in parameters)) continue;
            if (incoming(query.id, parameter).length > 0) continue;
            if (!ticked(checkbox)) {
              tried.push(`${parameter} is stored but the migration silenced runOnChange-${checkbox}`);
              continue;
            }
            verdict = { free: true, why: `${parameter} is stored and runOnChange-${checkbox} survived the migration` };
            break;
          }
        }
        if (!verdict) {
          for (const w of incoming(query.id)) {
            if (w.toProperty === 'storageFetch') continue;
            if (!ticked(w.toProperty)) {
              tried.push(`${w.toProperty} arrives but the migration silenced runOnChange-${w.toProperty}`);
              continue;
            }
            const v = sourceIsFree(w);
            if (v.free) {
              verdict = { free: true, why: `${w.toProperty} <= ${v.why}` };
              break;
            }
            tried.push(`${w.toProperty} <= ${v.why}`);
          }
        }

        if (verdict?.free) graded.push(`${where} — ${verdict.why}`);
        else offenders.push(`${where} — no trigger that predates an edit: ${tried.join('; ') || 'nothing wired and nothing stored'}`);
      }
    }
    return { offenders: offenders.sort(), graded: graded.sort() };
  }

  it('CONTROL: no cloud-only node lives outside the cloud prefix', () => {
    // The one direction that IS provable from the graph. A browser component that
    // grew a `noodl.cloud.*` node would mean the prefix had stopped deciding where
    // things run, and this rule would be grading the wrong half.
    const strays = flatProject()
      .components.filter((c) => !isCloud(c))
      .flatMap((c) => c.graph.roots.filter((n) => n.type.startsWith('noodl.cloud.')).map((n) => `${c.name} ${n.type}`));
    expect(strays).toEqual([]);

    // …beside the signal that makes that emptiness mean something: those nodes do
    // exist in this artefact, on the other side of the split.
    const inCloud = flatProject()
      .components.filter(isCloud)
      .flatMap((c) => c.graph.roots.filter((n) => n.type.startsWith('noodl.cloud.')));
    expect(inCloud.length).toBeGreaterThan(0);
  });

  it('CONTROL: the graded half is not empty, and holds the two screens this task is about', () => {
    // A rule over nothing passes. This is what makes every green below mean
    // "checked" rather than "not present".
    const withQueries = flatProject()
      .components.filter((c) => !isCloud(c))
      .filter((c) => c.graph.roots.some((n) => n.type === 'DbCollection2'))
      .map((c) => c.name);
    expect(withQueries.sort()).toEqual(['/Pages/Admin', '/Pages/PageEditor', '/Pages/Site', '/Pages/ThemeEditor', '/Site/Nav']);
  });

  it('CONTROL: the mapping above covers every parameter a query in this artefact carries', () => {
    // 🔴 An unmapped parameter would be silently ignored by shape 2, and the rule
    // would then be about the parameters somebody remembered. This is what makes
    // `PARAMETER_CHECKBOX` a mapping rather than an exclusion list.
    const seen = new Set<string>();
    for (const c of shipped.components) {
      for (const n of nodesOf(c)) {
        if (n.type !== 'DbCollection2') continue;
        for (const key of Object.keys(n.parameters ?? {})) {
          if (!key.startsWith('runOnChange-')) seen.add(key);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(PARAMETER_CHECKBOX).sort());
  });

  it('CONTROL: the migration really does rewrite this artefact before it is graded', () => {
    // Every green below is a claim about the MIGRATED graph. If the migration
    // wrote nothing, this gate would be the old one wearing a new name.
    const before = flatProject();
    const plan = planRunOnValueChangeMigration(before as MigrationProjectLike);
    expect(plan.writes.filter((w) => w.nodeType === 'DbCollection2').length).toBeGreaterThan(0);
  });

  it('every query has a trigger that predates any edit, and the reason is named', () => {
    const { offenders, graded } = gradeQueries(migrated(flatProject()));

    // 🔴 The reasons, in full. `offenders: []` is satisfied just as well by a walk
    // that graded nothing, and the two are not the same claim — so the census is
    // the reason column itself.
    expect(graded).toEqual([
      // 🔴 The two SBR-016 fixed. Neither is a wire into `storageFetch`, and that
      // is the finding the acceptance criterion's wording did not anticipate:
      // this template's queries run because a VALUE lands, and the migration is
      // what takes those values away.
      '/Pages/Admin pages-2 — collectionName is stored and runOnChange-collectionName survived the migration',
      '/Pages/PageEditor sections-2 — qp-pageId <= JavaScriptFunction.out-pageId <= JavaScriptFunction run by Page.didMount — the page mounted',
      // The seven that were already right, and why — three hops deep on the last
      // one, which is the chain a list of forgiven node names would never have said.
      '/Pages/Site pageQuery — qp-slug <= JavaScriptFunction.out-slug <= JavaScriptFunction run by Page.didMount — the page mounted',
      '/Pages/Site sections — qp-pageId <= JavaScriptFunction.out-pageId <= JavaScriptFunction run by DbCollection2.fetched <= DbCollection2 fed by JavaScriptFunction.out-slug <= JavaScriptFunction run by Page.didMount — the page mounted',
      '/Pages/Site settings — collectionName is stored and runOnChange-collectionName survived the migration',
      '/Pages/Site theme — collectionName is stored and runOnChange-collectionName survived the migration',
      '/Pages/ThemeEditor settings-2 — collectionName is stored and runOnChange-collectionName survived the migration',
      '/Pages/ThemeEditor theme-2 — collectionName is stored and runOnChange-collectionName survived the migration',
      '/Site/Nav pages — collectionName is stored and runOnChange-collectionName survived the migration'
    ]);
    expect(offenders).toEqual([]);
  });

  it('MUTANT: the defect exactly as it shipped — the page list without its explicit checkbox', () => {
    // 🔴 Not "delete the trigger": the trigger was never deleted. The author wrote
    // the graph that wants a load-time fetch and left the checkbox to its default,
    // and the migration did the rest. Removing the one explicit `true` is the
    // whole of the regression, and it is what every project minted before this
    // session actually holds.
    const project = flatProject();
    const admin = project.components.find((c) => c.name === '/Pages/Admin')!;
    const pages = admin.graph.roots.find((n) => n.type === 'DbCollection2')!;
    expect(pages.parameters?.['runOnChange-collectionName']).toBe(true);
    delete (pages.parameters as Record<string, unknown>)['runOnChange-collectionName'];

    const { offenders } = gradeQueries(migrated(project));
    // 🔴 The offender says what it tried. A red with nothing to act on is what
    // sent three sessions looking at the network tab instead of the parameter bag.
    expect(offenders).toEqual([
      '/Pages/Admin pages-2 — no trigger that predates an edit: storageFetch <= NewDbModelProperties.done — a write the person caused; ' +
        'storageFetch <= For Each.itemOutputSignal-Changed — a row signalled a change; ' +
        'collectionName is stored but the migration silenced runOnChange-collectionName'
    ]);
  });

  it('MUTANT: the same defect on the page editor, which had it too', () => {
    const project = flatProject();
    const editor = project.components.find((c) => c.name === '/Pages/PageEditor')!;
    const sections = editor.graph.roots.find((n) => n.type === 'DbCollection2')!;
    expect(sections.parameters?.['runOnChange-qp-pageId']).toBe(true);
    delete (sections.parameters as Record<string, unknown>)['runOnChange-qp-pageId'];

    const { offenders } = gradeQueries(migrated(project));
    expect(offenders).toEqual([
      '/Pages/PageEditor sections-2 — no trigger that predates an edit: storageFetch <= NewDbModelProperties.done — a write the person caused; ' +
        'storageFetch <= For Each.itemOutputSignal-Changed — a row signalled a change; ' +
        // 🔴 AC2's third producer, and the reason it reads this way rather than
        // vouching for the query is `INVOCATION_ONLY` — see that map's note. A
        // cloud call is only ever run by whatever presses its `Call`.
        'storageFetch <= CloudFunction2.done <= CloudFunction2 run only by an edit; ' +
        'collectionName is stored but the migration silenced runOnChange-collectionName; ' +
        'visualFilter is stored but the migration silenced runOnChange-querySettings; ' +
        // D30's `visualSort`, reported by the same clause and for the same reason: it is
        // governed by `runOnChange-querySettings`, which `NO_LOAD_TIME_FETCH` switches off. It
        // is a stored parameter, never a trigger — which is why the spec above still grades
        // this query as having one, and `offenders` there is still empty.
        'visualSort is stored but the migration silenced runOnChange-querySettings; ' +
        'qp-pageId arrives but the migration silenced runOnChange-qp-pageId'
    ]);
  });

  /**
   * AC2's structural half — the words.
   *
   * 🔴 The point of the criterion is that an empty list and a populated one must
   * not be told apart only by row count. The old sentence for zero rows was `No
   * pages, no published`, which is the count sentence with a zero in it; and it
   * was never rendered anyway, because the query never ran. **Three states, three
   * sentences**, and each is asserted by the constant's own name so a reworded
   * message cannot pass by being *a* string.
   */
  it('AC2 (words): the empty list says so, and the refused list says something else', () => {
    const admin = componentNamed('/Pages/Admin') as Component;
    const nodes = nodesOf(admin);

    // 1. Empty — inside the script that derives the count sentence, on its own branch.
    const counter = nodes.find(
      (n) => n.type === 'JavaScriptFunction' && String(n.parameters?.functionScript).includes('Outputs.sentence')
    ) as Node;
    const script = String(counter.parameters?.functionScript);
    expect(script).toContain('rows.length === 0');
    expect(script).toContain(JSON.stringify(EMPTY_PAGE_LIST_TEXT));
    // …and the other branch still exists, so "says so when empty" was not bought
    // by saying the same thing always.
    expect(script).toContain("word(published).toLowerCase() + ' published'");

    // 2. Refused — a different sentence, absent until a query actually fails.
    const error = nodes.find((n) => n.parameters?.text === PAGE_LIST_ERROR_TEXT) as Node;
    expect(error?.type).toBe('Text');
    expect(error.parameters?.mounted).toBe(false);
    expect(error.parameters?.color).toBe('var(--destructive)');

    // 3. It is raised by `failure` and lowered by `fetched` — two ports of the one
    // query, so the refusal cannot outlive the query it was about.
    const raised = admin.graph.connections.filter((w) => w.toId === error.id && w.toProperty === 'mounted');
    expect(raised).toHaveLength(1);
    const state = nodes.find((n) => n.id === raised[0].fromId) as Node;
    expect(state.type).toBe('States');
    const into = admin.graph.connections
      .filter((w) => w.toId === state.id)
      .map((w) => `${(nodes.find((n) => n.id === w.fromId) as Node).type}.${w.fromProperty} -> ${w.toProperty}`)
      .sort();
    expect(into).toEqual(['DbCollection2.failure -> to-Refused', 'DbCollection2.fetched -> to-Quiet']);
  });

  it('MUTANT: a refusal raised by `fetched` would stand beside a working list', () => {
    // The mistake this shape exists to prevent, and the one `completed` made on
    // the sign-in page: a port that fires on every outcome cannot mean failure.
    const admin = componentNamed('/Pages/Admin') as Component;
    const error = nodesOf(admin).find((n) => n.parameters?.text === PAGE_LIST_ERROR_TEXT) as Node;
    const raised = admin.graph.connections.find((w) => w.toId === error.id && w.toProperty === 'mounted')!;
    const into = admin.graph.connections.filter((w) => w.toId === raised.fromId);
    // Both arms present, and they are different ports. If a future edit drove both
    // states from one port this equality is what reds.
    expect(new Set(into.map((w) => w.fromProperty)).size).toBe(2);
  });

  it('MUTANT: an unrecognised producer reds rather than being skipped', () => {
    // The property that makes this a rule and not a list. A query triggered by a
    // node type the classifier has never heard of must fail loudly.
    const project = flatProject();
    const nav = project.components.find((c) => c.name === '/Site/Nav')!;
    const pages = nav.graph.roots.find((n) => n.type === 'DbCollection2')!;
    delete (pages.parameters as Record<string, unknown>).collectionName;
    nav.graph.roots.push({ id: 'inventedProducer', type: 'A Node Nobody Classified' });
    nav.graph.connections.push({
      fromId: 'inventedProducer',
      fromProperty: 'somethingHappened',
      toId: pages.id,
      toProperty: 'storageFetch'
    });

    const { offenders } = gradeQueries(migrated(project));
    expect(offenders).toEqual([
      '/Site/Nav pages — no trigger that predates an edit: ' +
        'storageFetch <= UNCLASSIFIED A Node Nobody Classified.somethingHappened; ' +
        // Wiring `storageFetch` brought this node into the migration's population,
        // which is what silenced its two stored parameters as well — the same
        // mechanism as the real defect, arriving here as a side effect.
        'visualFilter is stored but the migration silenced runOnChange-querySettings; ' +
        'visualSort is stored but the migration silenced runOnChange-querySettings'
    ]);
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
      // SBR-007 AC2. Its worker `site/SetSectionOrder` is deliberately NOT here,
      // which is the half of this assertion that keeps the split honest.
      '/#__cloud__/reorderSection',
      '/#__cloud__/submitContactForm'
    ]);
    const workers = shipped.components.filter(
      (c) => c.name.startsWith('/#__cloud__/') && !nodesOf(c).some((n) => n.type === 'noodl.cloud.request')
    );
    // 3 → 4: SBR-007 AC2's `site/SetSectionOrder`, which is a worker for the same
    // reason the other three are — Run Tasks drives it, and it answers through
    // Component Outputs rather than a Response.
    expect(workers).toHaveLength(4);
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

  /**
   * 🔴 SBR-015 AC1 — the population this file's other rules structurally cannot see.
   *
   * The rules above derive their population as *a component holding a
   * `noodl.cloud.request`*: cloud endpoints. That is a better rule than a hand
   * list and it **still** could not see the same defect one layer up, in the
   * browser components that CALL those endpoints. `/Admin/PageRow`'s three
   * `CloudFunction2` nodes wired `done` only, so after the endpoints were fixed
   * the backend answered `400` in 19 ms with a correct refusal and the browser
   * threw it away — measured with a `MutationObserver`: zero text changes in 47 s.
   *
   * Deriving a population removes the "I forgot one" failure and leaves the
   * "I framed it too narrowly" one. The consumer of a fixed producer is the
   * first place to look next.
   */
  it('🔴 every browser call to a cloud function handles its Failure', () => {
    const offenders = shipped.components
      .filter((c) => !c.name.startsWith('/#__cloud__/'))
      .flatMap((c) => {
        const calls = nodesOf(c).filter((n) => n.type === 'CloudFunction2');
        return calls
          .filter(
            (n) =>
              !c.graph.connections.some(
                (w) => w.fromId === n.id && (w.fromProperty === 'failure' || w.fromProperty === 'error')
              )
          )
          .map((n) => `${c.name} ${(n as { label?: string }).label ?? n.id}`);
      })
      .sort();
    expect(offenders).toEqual([]);
  });

  it('control: there are browser cloud calls to grade, and the rule can red', () => {
    // ⚠️ Necessary, not sufficient: this asserts the failure signal LEAVES the
    // node, not that a person ever sees it. The browser has no Response node to
    // aim at, so there is no structural equivalent of the endpoint rule — the
    // person-facing half is AC1's drive, not a spec.
    const calls = shipped.components
      .filter((c) => !c.name.startsWith('/#__cloud__/'))
      .flatMap((c) => nodesOf(c).filter((n) => n.type === 'CloudFunction2'));
    expect(calls.length).toBeGreaterThan(0);

    const pageRow = shipped.components.find((c) => c.name === '/Admin/PageRow') as Component;
    const mutant = JSON.parse(JSON.stringify(pageRow)) as Component;
    mutant.graph.connections = mutant.graph.connections.filter(
      (w) => w.fromProperty !== 'failure' && w.fromProperty !== 'error'
    );
    const unhandled = nodesOf(mutant)
      .filter((n) => n.type === 'CloudFunction2')
      .filter(
        (n) =>
          !mutant.graph.connections.some(
            (w) => w.fromId === n.id && (w.fromProperty === 'failure' || w.fromProperty === 'error')
          )
      );
    expect(unhandled.length).toBe(3);
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

// ── 8. SBR-017: there is a way back in ───────────────────────────────────────

/**
 * SBR-017 AC4. The finding this gate exists to make impossible to reintroduce:
 * the shipped template held **one** authentication node across twenty-one
 * components — `SignUp`, on `/Pages/Setup` — and no `Log In` anywhere. An owner
 * who claimed their site and later lost the session had no screen that would
 * take their password.
 *
 * 🔴 **"Contains a `LogIn`" is not the criterion, and grading it would be the
 * hole shaped like the defect.** A `net.noodl.user.LogIn` sitting in a component
 * no router names is a node in a file, not a way back in — and it is exactly
 * what a well-meaning later edit produces (author the page, forget that a page
 * is only reachable when a Router lists it). So the gate walks the router's own
 * `routes`, closes over what those pages **place**, and asks whether the LogIn
 * is inside that set. The mutant below removes the one route and the gate reds,
 * which is what says the walk is load-bearing rather than decoration.
 */
describe('SBR-017 — the owner can get back in', () => {
  /**
   * The components a person can actually arrive at: every page the Router lists,
   * plus everything those pages place, transitively.
   *
   * A component instance is a node whose `type` IS another component's legacy
   * name (the MCP guidance's own rule), and a `For Each` names its row component
   * in `template` — both are placements, and both are how `/Admin/Shell` and
   * `/Admin/PageRow` get on screen at all.
   *
   * ⚠️ Navigation targets are deliberately NOT followed. A `RouterNavigate`
   * pointing at a page proves the page can be *asked for*, not that the Router
   * will answer — and a page reachable only that way is the defect one step
   * along. Every page must earn its place in `routes`.
   */
  function reachableComponents(content: Content): Set<string> {
    const byName = new Map(content.components.map((c) => [c.name, c]));
    const app = content.components.find((c) => c.name === APP_LEGACY);
    const router = app && nodesOf(app).find((n) => n.type === 'Router');
    const pages = (router?.parameters?.pages as Pages) ?? {};

    const seen = new Set<string>();
    const queue = [...(pages.routes ?? []), ...(pages.startPage ? [pages.startPage] : []), APP_LEGACY];
    while (queue.length) {
      const name = queue.shift() as string;
      if (seen.has(name)) continue;
      const component = byName.get(name);
      if (!component) continue;
      seen.add(name);
      for (const node of nodesOf(component)) {
        if (byName.has(node.type)) queue.push(node.type);
        const template = node.parameters?.template;
        if (typeof template === 'string' && byName.has(template)) queue.push(template);
      }
    }
    return seen;
  }

  const AUTH_TYPES = ['net.noodl.user.LogIn', 'net.noodl.user.LogOut', 'net.noodl.user.SignUp'] as const;

  it('CONTROL: the census the rest of this block reads — three auth nodes, and where they are', () => {
    // 🔴 Read first, so the assertions below are about a population that exists.
    // Before SBR-017 this census was ONE row (`SignUp`), and every check under it
    // would have been vacuously satisfiable by looking somewhere else.
    const census = allNodes()
      .filter((n) => (AUTH_TYPES as readonly string[]).includes(n.node.type))
      .map((n) => `${n.node.type} in ${n.component}`)
      .sort();
    expect(census).toEqual([
      'net.noodl.user.LogIn in /Pages/SignIn',
      'net.noodl.user.LogOut in /Admin/Shell',
      'net.noodl.user.SignUp in /Pages/Setup'
    ]);
  });

  it('AC4: the LogIn is inside a component the Router can actually reach', () => {
    const reachable = reachableComponents(shipped);
    const holders = allNodes()
      .filter((n) => n.node.type === 'net.noodl.user.LogIn')
      .map((n) => n.component);
    expect(holders).toEqual(['/Pages/SignIn']);
    for (const holder of holders) expect(`${holder}:${reachable.has(holder)}`).toBe(`${holder}:true`);
  });

  it('MUTANT: drop the sign-in page from the router and the same gate reds', () => {
    // The half that turns "contains a LogIn" into "there is a way back in".
    // Without this, a page authored into no router would pass the check above by
    // simply existing on disk.
    const mutant = JSON.parse(JSON.stringify(shipped)) as Content;
    const app = mutant.components.find((c) => c.name === APP_LEGACY) as Component;
    const router = nodesOf(app).find((n) => n.type === 'Router') as Node;
    const pages = router.parameters?.pages as Pages;
    pages.routes = (pages.routes ?? []).filter((r) => r !== '/Pages/SignIn');

    expect(reachableComponents(mutant).has('/Pages/SignIn')).toBe(false);
    // …and the control that the mutation was surgical: everything else still is.
    expect(reachableComponents(mutant).has('/Pages/Admin')).toBe(true);
  });

  /**
   * 🔴 SBR-017 §3's ordering trap, as a gate rather than a comment: *"Do not add
   * sign-out without adding sign-in first."* A rail that can end a session on a
   * template that cannot start one is the original defect made one click easier
   * to reach, and it is a plausible future edit — sign-out is the easy half.
   */
  it("a LogOut may only ship where a reachable LogIn ships too", () => {
    const reachable = reachableComponents(shipped);
    const has = (type: string) =>
      allNodes().some((n) => n.node.type === type && reachable.has(n.component));
    expect(`logOut:${has('net.noodl.user.LogOut')}`).toBe(`logOut:${has('net.noodl.user.LogIn')}`);
    // Asserted positively as well, so the rule cannot be satisfied by there being
    // neither — which is the state SBR-017 found.
    expect(has('net.noodl.user.LogIn')).toBe(true);
  });

  /**
   * AC2, as far as the artefact can carry it: **the refused path and the accepted
   * path are not the same screen.** The drive is what grades the person sentence;
   * this is what stops the wiring silently collapsing back into one.
   */
  it('AC2 (structure): success navigates, refusal reveals, and neither is `completed`', () => {
    const signIn = componentNamed('/Pages/SignIn') as Component;
    expect(signIn).toBeDefined();
    const nodes = nodesOf(signIn);
    const login = nodes.find((n) => n.type === 'net.noodl.user.LogIn') as Node;
    const from = (property: string) =>
      signIn.graph.connections.filter((w) => w.fromId === login.id && w.fromProperty === property);

    // The accepted path leaves the screen.
    const done = from('done').map((w) => nodes.find((n) => n.id === w.toId)?.type).sort();
    expect(done).toEqual(['RouterNavigate', 'States']);

    // The refused path changes something on it, and reaches the refusal's
    // `mounted` — the port that makes an absent refusal take no space.
    const refusedInto = from('failure').map((w) => `${nodes.find((n) => n.id === w.toId)?.type}.${w.toProperty}`);
    expect(refusedInto).toEqual(['States.to-Refused']);
    const states = nodes.find((n) => n.type === 'States') as Node;
    // Named by its WORDS rather than by a label, so this cannot go green against
    // some other Text that happens to be wired to the same node.
    const refusal = nodes.find((n) => n.parameters?.text === SIGNIN_REFUSAL_TEXT) as Node;
    expect(refusal).toBeDefined();
    const revealed = signIn.graph.connections
      .filter((w) => w.fromId === states.id)
      .map((w) => `${w.toId === refusal.id ? 'the refusal' : w.toId}.${w.toProperty}`);
    expect(revealed).toEqual(['the refusal.mounted']);

    // 🔴 And `completed` is wired nowhere on this node. It fires on EVERY
    // outcome, so a `completed` here would raise the refusal on the successful
    // sign-in too — the two paths would be one screen again, and the drive would
    // still pass its first arm.
    expect(from('completed')).toEqual([]);
  });

  it('AC3 (words): a signed-out visitor to an admin screen is told so, in the shell every screen places', () => {
    // 🔴 The words, not the absence of rows. SBR-016's finding is that a refused
    // query, an empty collection and a collection that never asked all render the
    // same blank panel; "signed out" used to be a FOURTH state rendering
    // identically, and asserting "no rows" would grade none of them apart.
    const shell = componentNamed('/Admin/Shell') as Component;
    const notice = nodesOf(shell).find((n) => n.parameters?.text === SIGNED_OUT_TEXT);
    expect(notice?.type).toBe('Text');
    // It starts absent and something raises it — a standing sentence would say
    // "you are not signed in" to a signed-in admin.
    expect(notice?.parameters?.mounted).toBe(false);
    const raised = shell.graph.connections.filter((w) => w.toId === notice?.id && w.toProperty === 'mounted');
    expect(raised).toHaveLength(1);

    // …and what raises it is the INVERSE of `authenticated`, not `authenticated`
    // itself. That one wire is the difference between the notice appearing for
    // the person who needs it and appearing for everybody else.
    const inverter = nodesOf(shell).find((n) => n.id === raised[0].fromId) as Node;
    expect(inverter.type).toBe('Inverter');
    const source = shell.graph.connections.find((w) => w.toId === inverter.id && w.toProperty === 'value');
    const user = nodesOf(shell).find((n) => n.id === source?.fromId) as Node;
    expect(`${user.type}.${source?.fromProperty}`).toBe('net.noodl.user.User.authenticated');
  });
});

// ── D18 — the header row a client on a narrow window could not reach ─────────

/**
 * 🔴 **D18**: `/Pages/PageEditor`'s header row — `Editing · <title>`, the status
 * pill, the unsaved mark, `Preview` and `Save page` — was clipped below 1001px
 * and `Save page` was **unreachable** below 897px, with no gesture that got to
 * it (`document.scrollWidth === innerWidth` at every width, SBR-007 §14).
 *
 * The mechanism is `layout.ts:82`: every node starts `flexShrink: 0`, and only a
 * percentage size ALONG the parent's direction opts back in to shrinking. Every
 * child of this row is `IN_A_ROW` (`contentSize`), which assigns a percentage on
 * NEITHER axis — so no child can shrink, and under the default `nowrap` the row
 * overflows its container and is clipped. 🔴 This is also why `flex-grow` was
 * never the lever (SBR-004 §8.2): growing a child that cannot shrink changes
 * nothing about overflow.
 *
 * ⚠️ **What the population is, and why it is not "every row".** Eleven
 * row-direction Groups ship in this artefact, and five are `nowrap` with every
 * graded child non-shrinking — but SBR-007 §14 MEASURED two of those five
 * reflowing correctly on the driven screen (`/Admin/PageRow`'s buttons track the
 * viewport 1336 → 884 → 496; `/Pages/Admin`'s header is fine at every width). A
 * rule reading "row + cannot shrink ⇒ broken" would contradict readings already
 * taken. What actually separates this row is that it carries a **wire-fed** Text
 * at a **display** font size: its width is a user's page title, unknown when the
 * template is authored. That is the property graded below, so a future row built
 * the same way is caught — and a row whose contents are all author-fixed is not
 * flagged on a guess.
 */
const NON_SHRINKING = ['contentSize', 'contentHeight'];
const DISPLAY_SIZES = ['var(--text-2xl)', 'var(--text-3xl)', 'var(--text-4xl)', 'var(--text-5xl)'];

/**
 * 🔴 **D20 corrected this rule, and the correction is the point.** `sizeMode`
 * ALONE cannot say whether a child shrinks. `layout.ts:82` opts a node back in
 * only where it converts a percentage size ALONG THE PARENT'S DIRECTION into
 * `flexGrow` + `flexShrink: 1` — so for a ROW the question is whether the child
 * has a **percentage `width`**, and the mode only decides whether a width is
 * assigned at all (`explicit` and `contentHeight` assign one; `contentSize` and
 * `contentWidth` do not).
 *
 * Graded against the driven readings of SBR-007 §30: the page-editor heading is
 * `contentHeight` — a member of `NON_SHRINKING` — and measured `flexShrink: 1`,
 * `flexGrow: 60` on the rendered screen, tracking the viewport 1296 → 193px.
 * The old list-only test called that node non-shrinking and stayed GREEN while
 * saying so, which is the failure mode this suite has hit before: the literal
 * did not move, the sentence beside it stopped being true.
 */
function childCanShrinkInARow(child: { parameters?: Record<string, unknown> }): boolean {
  const p = child.parameters ?? {};
  const mode = p.sizeMode;
  const assignsWidth = typeof mode === 'string' && !['contentSize', 'contentWidth'].includes(mode);
  if (!assignsWidth) return false;
  const w = p.width as { unit?: string } | undefined;
  return typeof w === 'object' && w !== null && w.unit === '%';
}

/**
 * Rows whose width depends on a string nobody has typed yet. Grades the reason,
 * not just the emptiness — a pass that graded no rows at all would satisfy
 * `unreachable == []` exactly as well as one that cleared every row, and those
 * are not the same claim.
 */
function gradeUnboundedRows(project: Content): { graded: string[]; unreachable: string[] } {
  const graded: string[] = [];
  const unreachable: string[] = [];

  for (const component of project.components) {
    for (const node of nodesOf(component)) {
      const p = node.parameters ?? {};
      if (p.flexDirection !== 'row') continue;

      const children = node.children ?? [];
      const modes = children
        .map((c) => (c.parameters ?? {}).sizeMode)
        .filter((m): m is string => typeof m === 'string');
      if (modes.length === 0) continue;

      // A child whose text arrives over a wire has no width the template can know.
      const unbounded = children.filter((c) => {
        const cp = c.parameters ?? {};
        return c.type === 'Text' && DISPLAY_SIZES.includes(cp.fontSize as string) && cp.text === '';
      });
      if (unbounded.length === 0) continue;

      const label = `${component.name} #${node.id}`;
      const canShrink = children.some((c) => childCanShrinkInARow(c));
      const wraps = p.flexWrap === 'wrap' || p.flexWrap === 'wrap-reverse';
      const scrolls = p.scrollEnabled === true;

      if (canShrink) graded.push(`${label} — a child can shrink, so the row reflows`);
      else if (wraps) graded.push(`${label} — flexShrink:0 throughout, and the row wraps (D18's lever)`);
      else if (scrolls) graded.push(`${label} — flexShrink:0 throughout, but the row scrolls`);
      else unreachable.push(`${label} — flexShrink:0 throughout, and it neither wraps nor scrolls`);
    }
  }
  return { graded: graded.sort(), unreachable: unreachable.sort() };
}

/**
 * The wire-fed display Text inside a row — the child whose width nobody can know
 * when the template is authored, and the one both mutants below operate on.
 * Resolved through the row's own `children`, never by authored id.
 */
function unboundedChildOf(row: { children?: { type?: string; parameters?: Record<string, unknown> }[] }) {
  const child = (row.children ?? []).find(
    (c) => c.type === 'Text' && DISPLAY_SIZES.includes((c.parameters ?? {}).fontSize as string) && (c.parameters ?? {}).text === ''
  );
  if (!child) throw new Error('the header row no longer carries a wire-fed display Text — D18/D20 cannot be graded');
  child.parameters = child.parameters ?? {};
  return child as { parameters: Record<string, unknown> };
}

describe('D18 — a row sized by a string nobody has typed yet stays reachable', () => {
  it('the page editor header wraps rather than clipping its actions away', () => {
    const { graded, unreachable } = gradeUnboundedRows(shipped);

    // 🔴 The reason moved with D20, and the reason is what this grades. The row
    // no longer relies on wrapping alone: its heading carries a percentage width,
    // so a child genuinely shrinks (`flexShrink: 1`, measured on the screen).
    expect(graded).toEqual(['/Pages/PageEditor #headerRow — a child can shrink, so the row reflows']);
    expect(unreachable).toEqual([]);
  });

  it('MUTANT: the row as it actually shipped reddens the grader', () => {
    // 🔴 **The mutant needs BOTH levers dropped now, and that is the finding.**
    // Before D20 this test removed `flexWrap` alone and the row went unreachable.
    // It no longer does — with a shrinkable heading the row reflows without
    // wrapping at all — so removing wrap by itself would leave the grader GREEN
    // and this mutant would have quietly stopped testing anything.
    const mutant = JSON.parse(JSON.stringify(shipped)) as Content;
    const row = mutant.components.flatMap((c) => nodesOf(c)).find((n) => n.id === 'headerRow');
    if (!row) throw new Error('the artefact no longer holds #headerRow — D18 cannot be graded');
    // 🔴 By the row's OWN CHILD, never by a global id: the door rewrites ids on
    // write (`heading` ships as `heading-2`), and a `find` on the authored id
    // silently matches a DIFFERENT component's node — which is what made the
    // first version of this mutant mutate nothing and still read green.
    const heading = unboundedChildOf(row);
    delete (row.parameters as Record<string, unknown>).flexWrap;
    delete (heading.parameters as Record<string, unknown>).width;
    (heading.parameters as Record<string, unknown>).sizeMode = 'contentSize';

    const { graded, unreachable } = gradeUnboundedRows(mutant);
    expect(unreachable).toEqual(['/Pages/PageEditor #headerRow — flexShrink:0 throughout, and it neither wraps nor scrolls']);
    expect(graded).toEqual([]);
  });

  it('MUTANT: dropping D20 alone still reddens nothing, because D18 wrap remains', () => {
    // The other half of the pair — it proves the two levers are INDEPENDENT, and
    // that the green above is not being carried by wrap alone.
    const mutant = JSON.parse(JSON.stringify(shipped)) as Content;
    const row = mutant.components.flatMap((c) => nodesOf(c)).find((n) => n.id === 'headerRow');
    if (!row) throw new Error('the artefact no longer holds #headerRow');
    const heading = unboundedChildOf(row);
    delete (heading.parameters as Record<string, unknown>).width;
    (heading.parameters as Record<string, unknown>).sizeMode = 'contentSize';

    const { graded, unreachable } = gradeUnboundedRows(mutant);
    expect(graded).toEqual(['/Pages/PageEditor #headerRow — flexShrink:0 throughout, and the row wraps (D18\'s lever)']);
    expect(unreachable).toEqual([]);
  });
});
