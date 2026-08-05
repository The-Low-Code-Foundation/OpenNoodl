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
import { PAGE_NODE_TYPE, describePageRegistration, looksLikePageComponent, resolvePageRegistration } from '../editor-deps';
import type { ComponentFiles } from '../graph';
import type { PageRegistrationSummary } from '../tools/responses';
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
