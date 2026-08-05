/**
 * AAQ-001 — a created page is reachable.
 *
 * A page component is not a page. It is a component that some Router node lists
 * in its `pages` parameter:
 *
 *     Router.pages = { startPage: "/Pages/Puppies", routes: ["/Pages/Puppies", …] }
 *
 * Nothing in the AI stack knew that. The word "Router" appeared nowhere in
 * scoping, planning or authoring, `planFromScope` never planned the App update
 * that would register anything, and so a plan that created three pages produced
 * three components the app could not reach and a router that still listed only
 * the template's Home. From the user's side: *"page router has no pages even
 * after I accepted all the plan"*.
 *
 * Registration is computed here and applied by the plan transaction, rather than
 * asked of the model, for the reason the provision row exists: which components
 * the plan created and which of them are pages is something the apply *knows*,
 * exactly, and a fact the apply knows should not be re-derived by a language
 * model that has to be told, believed, and checked. The prompts still carry the
 * contract — an agent authoring an App update by hand must write a valid `pages`
 * value — so this is the floor under that, not a replacement for it.
 *
 * ⚠️ This header used to add *"and `noodl-mcp` has no plan transaction at all"*.
 * That was wrong when it was written: `noodl-mcp` has had one since AIX-011
 * (`create_plan`/`stage_plan_operation`/`apply_plan`), built on this very
 * package's `authoring/plan` module. What it lacked was not a transaction but
 * this module — so AAQ-005 binds it there too, and the belief that it could not
 * be bound is part of why nobody looked for a year.
 *
 * Idempotent by construction: a page already listed is not listed twice, so an
 * agent that *did* write the router update loses nothing and collides with
 * nothing.
 *
 * Pure — no `ProjectModel`, no Electron. The caller supplies the routers it
 * found and the pages it is about to create; the editor's apply path binds it in
 * `planStaging.ts`.
 *
 * @module AiAssistant/authoring/pageRegistration
 */

// AAQ-005 moved these two to `validation/navigation.ts`, beside `checkPageShape`,
// because the gate now has three bindings (this editor, the MCP write tools, the
// MCP plan tools) and all three must answer "is this a page" identically. They
// are re-exported here so every existing caller of this module is unchanged.
export { looksLikePageComponent, PAGE_NODE_TYPE } from '../../../validation';

/** Node types that mount pages. Mirrors `review/pageMap.ts`, which reads the same parameter. */
export const ROUTER_NODE_TYPES: ReadonlySet<string> = new Set(['Router', 'Page Stack']);

/** A Router's `pages` parameter, as it is serialised in `project.json`. */
export interface RouterPagesValue {
  startPage?: string;
  routes: string[];
}

/** One Router node found in the project, with where it lives and what it lists. */
export interface RouterLocation {
  /** Legacy name of the component holding the router ("App"). */
  component: string;
  /** Node id, so the caller can find it again to write the value. */
  nodeId: string;
  /** The router's `name` parameter, when it has one — what Navigate nodes address it by. */
  name?: string;
  /** What it lists today. */
  pages: RouterPagesValue;
  /** True for the router in the project's root component — the app's main router. */
  isRoot?: boolean;
}

/** What the apply is about to do to one router. */
export interface PageRegistration {
  router: RouterLocation;
  /** The `pages` value to write. */
  pages: RouterPagesValue;
  /** Legacy names added to `routes`, in plan order. Never empty when this is returned. */
  added: string[];
  /** Set when this registration also moves the start page, to what it moves it to. */
  startPage?: string;
}

export interface PageRegistrationOptions {
  /**
   * The start page is only *moved* onto a new page when the current one is a
   * placeholder — an empty page component nobody has built anything in, which is
   * what a freshly created project's Home is.
   *
   * Passed rather than inferred because "is this page empty" is a question about
   * the live project, and this module holds no graph. Absent means "never move a
   * start page that resolves", which is the safe answer: stealing home from a
   * page someone built is worse than opening on the wrong one.
   */
  placeholderStartPage?: string;
}

/** `/Pages/Puppies`, `Pages/Puppies`, `#Puppies` — the same tolerance `findComponent` has. */
export function isSamePage(a: string, b: string): boolean {
  const strip = (n: string) => n.replace(/^\//, '').replace(/^#/, '').toLowerCase();
  return a === b || strip(a) === strip(b);
}

/**
 * The one router a plan's pages belong to.
 *
 * The project's root component wins, because that is the app's own router and
 * the one a page created from a scope's `pages` list means. Below that, a single
 * router is unambiguous. With several and no root among them the first is taken
 * in the caller's order — deterministic, and stated in what the apply reports so
 * a wrong guess is visible rather than silent.
 */
export function chooseRouter(routers: readonly RouterLocation[]): RouterLocation | undefined {
  return routers.find((r) => r.isRoot) ?? routers[0];
}

/**
 * What registering `pages` in this project would change, or `undefined` when it
 * would change nothing.
 *
 * `pages` is the ordered list of page components the plan creates; the first is
 * the one that becomes home when home is up for grabs.
 */
export function planPageRegistration(
  routers: readonly RouterLocation[],
  pages: readonly string[],
  options: PageRegistrationOptions = {}
): PageRegistration | undefined {
  if (pages.length === 0) return undefined;
  const router = chooseRouter(routers);
  if (!router) return undefined;

  const routes = [...router.pages.routes];
  const added: string[] = [];
  for (const page of pages) {
    if (routes.some((route) => isSamePage(route, page))) continue;
    routes.push(page);
    added.push(page);
  }

  const startPage = nextStartPage(router, routes, pages, options);
  const moved = startPage !== undefined && !isSamePage(startPage, router.pages.startPage ?? '');
  if (added.length === 0 && !moved) return undefined;

  return {
    router,
    pages: { ...(startPage ? { startPage } : {}), routes },
    added,
    ...(moved ? { startPage } : {})
  };
}

/**
 * Where the app opens after this apply.
 *
 * Three cases move it, and nothing else does:
 *
 * 1. **There is no start page.** A router with routes and no `startPage` mounts
 *    nothing until something navigates.
 * 2. **The start page is dangling** — it names a component that is not in the
 *    router's own routes, so it is a leftover from a rename or a deletion.
 * 3. **The start page is the placeholder the caller identified** — an empty page
 *    component, which in a freshly created project is the template's Home. A
 *    plan that built the app's real first page should open on it; opening on an
 *    empty page instead is the "nothing happened" reading of a successful build.
 *
 * A start page that resolves to a page someone actually built is never touched,
 * however many pages the plan adds.
 */
function nextStartPage(
  router: RouterLocation,
  routes: readonly string[],
  pages: readonly string[],
  options: PageRegistrationOptions
): string | undefined {
  const current = router.pages.startPage?.trim();
  const first = pages[0];

  if (!current) return first;
  if (!routes.some((route) => isSamePage(route, current))) return first;
  if (options.placeholderStartPage && isSamePage(current, options.placeholderStartPage)) return first;
  return current;
}

/**
 * The sentence the plan review shows before Apply, and the apply reports after.
 *
 * The provision row is the precedent: a side effect the transaction performs on
 * the user's behalf has to be readable *before* they commit to it, in the terms
 * they think in — which pages, in whose router, and which one the app opens on.
 */
export function describePageRegistration(
  registration: PageRegistration,
  options: { applied?: boolean } = {}
): string {
  const where = registration.router.name
    ? `the "${registration.router.name}" router in ${registration.router.component}`
    : `${registration.router.component}'s page router`;
  const parts: string[] = [];
  if (registration.added.length > 0) {
    const names = registration.added.map(pageDisplayName).join(', ');
    parts.push(
      `${registration.added.length} page${registration.added.length === 1 ? '' : 's'} ` +
        `(${names}) ${options.applied ? 'registered' : 'will be registered'} in ${where}.`
    );
  }
  if (registration.startPage) {
    const page = pageDisplayName(registration.startPage);
    parts.push(options.applied ? `The app opens on ${page}.` : `${page} becomes the page the app opens on.`);
  }
  return parts.join(' ');
}

/** "/Pages/Puppies" → "Puppies"; "/#__page__/Home" → "Home". */
export function pageDisplayName(legacyName: string): string {
  return legacyName
    .replace(/^\//, '')
    .replace(/^#__page__\//, '')
    .replace(/^Pages\//i, '');
}

// ── AAQ-005: the same registration, over plain data ───────────────────────────
//
// Everything above is pure already; everything below is what the *editor's*
// binding used to hold privately in `staging.ts`, expressed over plain nodes
// instead of `ProjectModel`/`NodeGraphNode`. It is here because AAQ-005 gave
// this module a second client.
//
// ⚠️ The premise this module was written under is stale, and its own header
// still states it: *"`noodl-mcp` has no plan transaction at all"*. It has had
// one since AIX-011 (`create_plan`/`stage_plan_operation`/`apply_plan`), which
// imports this package's `authoring/plan` module. What `noodl-mcp` actually
// lacked was not a transaction but **this** — so a page written through the
// external door was created, validated, and never listed in any router. The
// unreachable page finding (#5), surviving in the other client after Layer 1
// closed it in this one.

/** One node, in the only shape registration reads it. */
export interface RegistrationNode {
  id: string;
  type: string;
  parameters?: Record<string, unknown> | null;
  children?: readonly string[];
  parent?: string;
}

/**
 * One component, in the only shape registration reads it.
 *
 * No `visualRoots`: the placeholder rule reads parentless nodes on purpose —
 * see {@link isPlaceholderPageGraph}. Carrying the field would invite a future
 * reader to use it.
 */
export interface RegistrationComponent {
  /** Legacy name ("/App"). */
  name: string;
  nodes: readonly RegistrationNode[];
  /** True for the project's root component — its router is the app's own. */
  isRoot?: boolean;
}

/**
 * A Router's `pages` parameter, defensively.
 *
 * Hand-edited projects, older exports and a model that half-understood the shape
 * all reach this, and the one thing that must never happen is a caller throwing
 * on a malformed value it could simply have replaced.
 */
export function readRouterPagesValue(parameters: Record<string, unknown> | null | undefined): RouterPagesValue {
  const value = parameters?.['pages'];
  if (!value || typeof value !== 'object') return { routes: [] };
  const record = value as Record<string, unknown>;
  const routes = Array.isArray(record['routes'])
    ? record['routes'].filter((route): route is string => typeof route === 'string' && Boolean(route.trim()))
    : [];
  const startPage = record['startPage'];
  return {
    routes,
    ...(typeof startPage === 'string' && startPage.trim() ? { startPage: startPage.trim() } : {})
  };
}

/** Every Router node in these components, with where it lives and what it lists. */
export function findRoutersInComponents(components: readonly RegistrationComponent[]): RouterLocation[] {
  const routers: RouterLocation[] = [];
  for (const component of components) {
    for (const node of component.nodes) {
      if (!ROUTER_NODE_TYPES.has(node.type)) continue;
      const name = node.parameters?.['name'];
      routers.push({
        component: component.name,
        nodeId: node.id,
        ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
        pages: readRouterPagesValue(node.parameters),
        ...(component.isRoot ? { isRoot: true } : {})
      });
    }
  }
  return routers;
}

/**
 * A page nobody has built anything in — the shape a freshly created project's
 * Home has, and the only start page an apply is allowed to move away from.
 *
 * ⚠️ **The editor's original version of this rule was wrong, and a live pass is
 * how we found out.** It measured "empty" as the page's root having no children,
 * on the stated belief that the template's Home is one `Page` node with two
 * parameters. It is not — `hello-world.template.ts` gives Home a `Text` child
 * reading *"Hello World!"* — so the one case the mechanism existed for never
 * matched, and every app the wizard built registered its pages correctly and
 * then **opened on "Hello World!"**.
 *
 * What is measured is the template's actual shape, generalised only as far as it
 * honestly generalises: a single root, and under it at most one leaf `Text`. The
 * asymmetry is unchanged — taking home from a page somebody built is worse than
 * opening on the wrong one — and a bare line of text with nothing under it is not
 * a page somebody built.
 *
 * `noodl-mcp`'s own skeleton (`writeProjectSkeleton`) builds Home the same way: a
 * `Page` with a single leaf `Text`. That is checked rather than assumed —
 * a placeholder rule calibrated on the other client's template is precisely the
 * mistake above, and it is why this takes the roots it is given.
 */
export function isPlaceholderPageGraph(component: RegistrationComponent): boolean {
  const byId = new Map(component.nodes.map((node) => [node.id, node]));
  const roots = rootNodesOf(component.nodes);

  if (roots.length === 0) return true;
  if (roots.length > 1) return false;

  const children = childIdsOf(roots[0], component.nodes);
  if (children.length === 0) return true;
  if (children.length > 1) return false;

  const only = byId.get(children[0]);
  return Boolean(only && only.type === 'Text' && childIdsOf(only, component.nodes).length === 0);
}

/**
 * A node's children, from whichever bookkeeping the source keeps.
 *
 * The two clients differ here and are both right: the editor's candidate builder
 * derives `children` arrays from `parent` fields, while `noodl-mcp` accepts
 * either and reconciles them. Reading both means this rule cannot depend on
 * which door the component came through.
 */
function childIdsOf(node: RegistrationNode, nodes: readonly RegistrationNode[]): string[] {
  if (node.children?.length) return [...node.children];
  return nodes.filter((n) => n.parent === node.id).map((n) => n.id);
}

/**
 * The graph's top-level nodes.
 *
 * ⚠️ **Parentless, not "visual roots"** — deliberately, and the difference is
 * load-bearing. `NodeGraphModel.roots` holds every top-level node, visual and
 * logic alike, and `visualRoots` is the `allowAsChild` subset of it
 * (`NodeGraphModel.getVisualRootIds`). Reading `visualRoots` here would quietly
 * *widen* the placeholder rule: a page carrying a stray logic node has two roots
 * and is not a placeholder today, and would become one — meaning an apply could
 * take the start page away from a page somebody had begun building. Preserving
 * the editor's exact answer is the whole point of lifting this function.
 */
function rootNodesOf(nodes: readonly RegistrationNode[]): RegistrationNode[] {
  const claimed = new Set<string>();
  for (const node of nodes) {
    for (const child of node.children ?? []) claimed.add(child);
  }
  return nodes.filter((node) => !node.parent && !claimed.has(node.id));
}

/**
 * What registering these pages would do to this project, without doing it —
 * the whole decision, including the placeholder start-page rule.
 *
 * The plan review shows this and the transaction performs exactly it: one
 * function, so the promise and the act cannot disagree. That is also why a page
 * the caller is about to *fill* is excluded from the placeholder test — run
 * before the apply the project's Home is still empty, run after it is not, and
 * without the clause the preview would offer to move the start page and the
 * apply would decline to.
 */
export function resolvePageRegistration(
  components: readonly RegistrationComponent[],
  pages: readonly string[]
): PageRegistration | undefined {
  const routers = findRoutersInComponents(components);
  const startPage = chooseRouter(routers)?.pages.startPage;
  const isBeingBuilt = startPage !== undefined && pages.some((page) => isSamePage(page, startPage));
  // ⚠️ Exact, not `isSamePage`. The editor resolved this through
  // `getComponentWithName`, which compares names verbatim, and a start page
  // recorded in a different form than its component simply found nothing and
  // moved nothing. Widening it here would be a real behaviour change (a start
  // page could become movable that was not) smuggled in under a refactor.
  const current = startPage ? components.find((component) => component.name === startPage) : undefined;

  return planPageRegistration(routers, pages, {
    ...(startPage && !isBeingBuilt && current && isPlaceholderPageGraph(current)
      ? { placeholderStartPage: startPage }
      : {})
  });
}
