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
 * contract (an agent authoring an App update by hand must write a valid `pages`
 * value, and `noodl-mcp` has no plan transaction at all) — this is the floor
 * under that, not a replacement for it.
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

/** Node types that mount pages. Mirrors `review/pageMap.ts`, which reads the same parameter. */
export const ROUTER_NODE_TYPES: ReadonlySet<string> = new Set(['Router', 'Page Stack']);

/** The node a page component puts at its root to declare its title and url. */
export const PAGE_NODE_TYPE = 'Page';

/** Component-name shapes that mean "page": `/Pages/Puppies`, `/#__page__/Home`. */
const PAGE_NAME_PATTERNS = [/__page__/i, /(^|\/)pages\//i];

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

/** Whether a component's name says "page" — the convention both plan paths write. */
export function looksLikePageComponent(legacyName: string): boolean {
  return PAGE_NAME_PATTERNS.some((pattern) => pattern.test(legacyName));
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
