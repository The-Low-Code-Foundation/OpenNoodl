/**
 * AAQ-005 — a page written through the external door is reachable too.
 *
 * ## The gap this closes
 *
 * AAQ-001 established the contract: a page component is not a page. It becomes
 * one by being listed in some Router node's `pages` parameter, and Layer 1 made
 * the editor's apply transaction do that on the author's behalf, because which
 * components an apply created and which of them are pages is something the apply
 * *knows* exactly.
 *
 * That fix landed in the editor's apply path and nowhere else. This package —
 * the door Claude Code writes through — created page components, validated them,
 * wrote them, and never listed them in any router. The result is Richard's
 * original finding #5 reproduced exactly: *"page router has no pages"*, a blank
 * screen, and no error anywhere.
 *
 * ⚠️ AAQ-005 slice 1 made this *worse before better*, which is why it is worth
 * stating. Slice 1 gave this package the shared gate, including `checkNavigation`
 * — and that check resolves a Navigate target against the project's **component
 * names**, not against router registration. It is sound in the editor only
 * because the editor's apply registers the page immediately afterwards. Bound to
 * a client that never registered anything, it certified as correct exactly the
 * button that would not work. Gate parity without apply parity is a gate that
 * lies.
 *
 * ## Why the decision is not re-implemented here
 *
 * Everything about *what* to register — which router wins, whether the app
 * should now open on the new page, whether the current start page is the
 * template's placeholder — is `pageRegistration.ts` in the editor, imported
 * through `editor-deps`. This module is only the binding: `ProjectStore` in,
 * plain nodes out, and one component write back. The BCN-003 rule the whole task
 * exists to honour is that the *semantics* live once; a second client is allowed
 * its own plumbing and nothing else.
 *
 * @module noodl-mcp/project/pageRegistration
 */

import type { NodeV2, PageRegistration, RegistrationComponent, RegistrationNode } from '../editor-deps';
import {
  PAGE_NODE_TYPE,
  describePageRegistration,
  findRoutersInComponents,
  isSamePage,
  looksLikePageComponent,
  pagesAfterComponentRemoved,
  resolvePageRegistration
} from '../editor-deps';
import type { ComponentFiles } from '../graph';
import type { PageRegistrationSummary, PageUnregistrationSummary } from '../tools/responses';
import type { ProjectStore } from './ProjectStore';

/**
 * Is this candidate a page? Same two-part answer the editor's
 * `stagedComponentIsPage` gives — the name says so, or a `Page` node does — and
 * deliberately the same order, because a component under `/Pages/` that forgot
 * its `Page` node is a page that renders blank (the `PageWithoutPageNode`
 * diagnostic), not a non-page.
 */
export function componentIsPage(legacyName: string, files: ComponentFiles): boolean {
  if (looksLikePageComponent(legacyName)) return true;
  return files.nodes.nodes.some((node) => node.type === PAGE_NODE_TYPE);
}

function toRegistrationNodes(nodes: readonly NodeV2[]): RegistrationNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    ...(node.parameters ? { parameters: node.parameters } : {}),
    ...(node.children ? { children: node.children } : {}),
    ...(node.parent ? { parent: node.parent } : {})
  }));
}

/**
 * The project as the registration core reads it, with `overlay` substituted for
 * whatever is on disk.
 *
 * The overlay is what makes this usable *before* a write as well as after: a
 * plan apply resolves registration across candidates that do not exist yet, and
 * `create_component` resolves it against the component it is about to write. A
 * registration computed from disk alone would miss the very page being created.
 *
 * ⚠️ The root component is the one owning `rootNodeId` — a **node** id, not a
 * component id (see `ProjectV2File.rootNodeId`). `settings.rootComponent` is the
 * fallback because the exporter derives it rather than requiring it, so a
 * project can legitimately carry one, the other, or neither. With neither,
 * `chooseRouter` falls back to the first router found, which is exactly its
 * documented behaviour for an ambiguous project.
 */
export function registrationComponents(
  store: ProjectStore,
  overlay: ReadonlyMap<string, ComponentFiles> = new Map()
): RegistrationComponent[] {
  const project = store.readProjectFile();
  const rootNodeId = project?.rootNodeId;
  const rootComponentName = project?.settings?.rootComponent;

  const components: RegistrationComponent[] = [];
  const seen = new Set<string>();

  const push = (legacyName: string, files: ComponentFiles) => {
    if (seen.has(legacyName)) return;
    seen.add(legacyName);
    const nodes = toRegistrationNodes(files.nodes.nodes);
    const isRoot =
      (rootNodeId !== undefined && nodes.some((node) => node.id === rootNodeId)) ||
      (typeof rootComponentName === 'string' && rootComponentName === legacyName);
    components.push({ name: legacyName, nodes, ...(isRoot ? { isRoot: true } : {}) });
  };

  for (const [legacyName, files] of overlay) push(legacyName, files);

  for (const row of store.listComponents()) {
    if (seen.has(row.legacyName)) continue;
    try {
      push(row.legacyName, store.readComponent(row.path).files);
    } catch {
      // A component the registry lists but whose files will not read is a
      // problem for the tools that read it, not a reason to refuse to register
      // a page. Skipping it can only cost us a router we could not have written
      // to anyway.
    }
  }

  return components;
}

/**
 * What registering `pages` would do to this project, without doing it.
 *
 * `undefined` means nothing to do: every page is already listed and the start
 * page is staying put, or the project has no router at all. A project with no
 * router is **not** an error — single-screen apps exist, and refusing an
 * otherwise-good write over a missing router would be this phase's mistake in
 * the other direction. `checkPageShape` is where that gets said.
 */
export function resolveRegistration(
  store: ProjectStore,
  pages: readonly string[],
  overlay?: ReadonlyMap<string, ComponentFiles>
): PageRegistration | undefined {
  if (pages.length === 0) return undefined;
  return resolvePageRegistration(registrationComponents(store, overlay), pages);
}

/**
 * Write the registration: set the chosen router's `pages` parameter and save the
 * component that holds it.
 *
 * Returns `undefined` when the router's component or node could not be found on
 * disk after all — the same "did nothing, said nothing broke" answer the editor
 * gives, and for the same reason.
 *
 * ⚠️ Deliberately no `ifRevision`. The caller has just validated and written a
 * *different* component; failing their write because the router changed
 * underneath would leave the page written and unregistered, which is the state
 * this module exists to prevent. Last-writer-wins on one parameter of one node
 * is the lesser of the two, and `planPageRegistration` is idempotent, so a
 * concurrent registration of the same page is a no-op rather than a duplicate.
 */
export function applyRegistration(store: ProjectStore, registration: PageRegistration): PageRegistration | undefined {
  const resolved = store.resolve(registration.router.component);
  if (!resolved) return undefined;

  const stored = store.readComponent(resolved.key);
  const files = stored.files;
  const node = files.nodes.nodes.find((n) => n.id === registration.router.nodeId);
  if (!node) return undefined;

  node.parameters = { ...(node.parameters ?? {}), pages: registration.pages };
  files.component.modified = new Date().toISOString();
  files.component.modifiedBy = 'noodl-mcp';
  store.writeComponent(stored.key, files);
  return registration;
}

/**
 * Resolve and apply in one step — the shape every call site wants.
 *
 * `pages` is the ordered list of page legacy names just written; the first is
 * the one that becomes home if home is up for grabs.
 */
export function registerPages(
  store: ProjectStore,
  pages: readonly string[],
  overlay?: ReadonlyMap<string, ComponentFiles>
): PageRegistration | undefined {
  const registration = resolveRegistration(store, pages, overlay);
  if (!registration) return undefined;
  return applyRegistration(store, registration);
}

/** One router that stopped listing a deleted component. */
export interface PageUnregistration {
  /** Legacy name of the component holding the router that was written. */
  router: string;
  nodeId: string;
  /** The route strings removed from `routes` — as they were spelled there. */
  removed: string[];
  /** True when the router's start page named the deleted component and was cleared. */
  startPageCleared: boolean;
}

/**
 * P79 K1 — stop every router listing a component that is being deleted.
 *
 * The create side owns the router edit (`registerPages`), so the delete side has
 * to as well: before this, `create_component` then `delete_component` on a page
 * left a route aimed at three files that no longer existed, and the delete
 * result said `registry: "updated"` — which read as complete. Measured on the
 * render harness before it was fixed: the app still boots and draws its start
 * page with the dangling route in place (see the K1 row for the arms), so this
 * is a silent accumulation rather than a crash — the kind that is never found.
 *
 * The decision is the editor's own `pagesAfterComponentRemoved`, applied per
 * spelling: the editor matches exactly, this door tolerates `Pages/X` for
 * `/Pages/X` the way `registerPages` does, so each route `isSamePage` matches is
 * handed to the editor's rule under its own spelling.
 *
 * Called AFTER the store has deleted the component, and reads the routers off
 * disk, so it sees exactly the project the deletion left.
 */
export function unregisterPages(store: ProjectStore, legacyName: string): PageUnregistration[] {
  const done: PageUnregistration[] = [];

  for (const router of findRoutersInComponents(registrationComponents(store))) {
    const matching = router.pages.routes.filter((route) => isSamePage(route, legacyName));
    const startNamesIt = router.pages.startPage !== undefined && isSamePage(router.pages.startPage, legacyName);
    if (matching.length === 0 && !startNamesIt) continue;

    const resolved = store.resolve(router.component);
    if (!resolved) continue;
    const stored = store.readComponent(resolved.key);
    const node = stored.files.nodes.nodes.find((n) => n.id === router.nodeId);
    if (!node) continue;

    let pages = (node.parameters?.['pages'] ?? undefined) as { routes?: string[]; startPage?: string } | undefined;
    const spellings = new Set([...matching, ...(startNamesIt ? [router.pages.startPage as string] : [])]);
    let changed = false;
    for (const spelling of spellings) {
      const next = pagesAfterComponentRemoved(pages, spelling);
      if (next !== null) {
        pages = next;
        changed = true;
      } else if (pages?.startPage !== undefined && isSamePage(pages.startPage, legacyName)) {
        // The editor's rule only touches `startPage` while removing a route. A
        // start page naming a component no route lists is the state a delete
        // must not leave either.
        pages = { ...pages, startPage: undefined };
        changed = true;
      }
    }
    if (!changed) continue;

    const startPageCleared = router.pages.startPage !== undefined && pages?.startPage === undefined;
    const written: { routes: string[]; startPage?: string } = { routes: pages?.routes ?? [] };
    if (pages?.startPage !== undefined) written.startPage = pages.startPage;
    node.parameters = { ...(node.parameters ?? {}), pages: written };
    stored.files.component.modified = new Date().toISOString();
    stored.files.component.modifiedBy = 'noodl-mcp';
    store.writeComponent(stored.key, stored.files);
    done.push({ router: router.component, nodeId: router.nodeId, removed: matching, startPageCleared });
  }

  return done;
}

/** The unregistration, in the shape a tool response carries it — `{}` when no router listed the component. */
export function unregistrationSummary(unregistered: readonly PageUnregistration[]): PageUnregistrationSummary {
  if (unregistered.length === 0) return {};
  return {
    unregisteredPages: unregistered.map((u) => ({
      router: u.router,
      removed: u.removed,
      ...(u.startPageCleared ? { startPageCleared: true as const } : {})
    }))
  };
}

/**
 * The registration, in the shape a tool response carries it — `{}` when nothing
 * was registered, so it spreads into any payload.
 */
export function registrationSummary(registration: PageRegistration | undefined): PageRegistrationSummary {
  if (!registration) return {};
  return {
    registeredPages: {
      router: registration.router.component,
      added: registration.added,
      ...(registration.startPage ? { startPage: registration.startPage } : {}),
      summary: describePageRegistration(registration, { applied: true })
    }
  };
}
