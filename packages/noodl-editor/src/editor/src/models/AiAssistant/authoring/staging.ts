/**
 * AIX-002 — The Authoring Loop: staging
 *
 * The bridge from a staged candidate to the live project — crossed only on
 * accept. Everything before this point is plain data: the session authors in
 * memory, the outcome carries `ComponentFiles`, and nothing has touched the
 * project. So "reject leaves no trace" is not implemented here — it is the
 * absence of a call to this module. Accept converts the staged v2 files
 * through the same `reconstructLegacyComponent` path the project loader uses
 * and adds the component with an undo group, so an accepted AI change is
 * undoable exactly like any hand-made edit.
 *
 * @module AiAssistant/authoring/staging
 */

import { legacyNameToPath } from '../../../io/ProjectExporter';
import { reconstructLegacyComponent, toLegacyName } from '../../../io/ProjectImporter';
import { ComponentModel } from '../../componentmodel';
import type { NodeGraphNode } from '../../nodegraphmodel';
import type { ProjectModel } from '../../projectmodel';
import { UndoActionGroup, UndoQueue } from '../../undo-queue-model';
import type { PageRegistration, RouterLocation, RouterPagesValue } from './pageRegistration';
import {
  chooseRouter,
  isSamePage,
  looksLikePageComponent,
  PAGE_NODE_TYPE,
  planPageRegistration,
  ROUTER_NODE_TYPES
} from './pageRegistration';
import type { ComponentFiles } from './types';

/** Thrown when accept cannot proceed; the project is untouched. */
export class StagingError extends Error {
  /**
   * AIB-001 slice 4 — which plan operation the transaction was applying when it
   * failed.
   *
   * A rollback is correct engineering and terrible product: it leaves the user
   * holding a red sentence and a dead plan. The transaction always knew which
   * operation it was mutating; it simply threw the knowledge away, so the panel
   * could offer nothing better than "the plan could not be applied". Carrying it
   * is what makes an apply failure a question ("retry just that one?") rather
   * than an outcome.
   *
   * Absent for the failures that are about the plan as a whole — an empty
   * accepted set, two operations writing one document.
   */
  readonly operation?: { id: string; target: string; kind: string };

  constructor(message: string, operation?: { id: string; target: string; kind: string }) {
    super(message);
    this.name = 'StagingError';
    this.operation = operation;
  }
}

export interface AcceptOptions {
  /** Undo stack label; defaults to naming the component. */
  label?: string;
}

/**
 * Accept a staged candidate into the live project, undoably.
 *
 * Returns the added `ComponentModel`. Throws `StagingError` — without touching
 * the project — when the component's name is already taken, which can happen
 * when the project changed between authoring and accept (the session checks
 * the same thing at creation).
 */
export function acceptAuthoredComponent(
  project: ProjectModel,
  files: ComponentFiles,
  options: AcceptOptions = {}
): ComponentModel {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const legacyName = toLegacyName(files.component, registryPath);

  if (project.getComponentWithName(legacyName)) {
    throw new StagingError(
      `Component "${legacyName}" already exists in the project — it was created after authoring started.`
    );
  }

  const legacy = reconstructLegacyComponent(registryPath, files.component, files.nodes, files.connections);
  const component = ComponentModel.fromJSON(legacy);

  project.addComponent(component, {
    undo: true,
    label: options.label ?? `add AI component ${legacyName}`
  });

  return component;
}

/**
 * Accept an update candidate by replacing the existing component, undoably.
 *
 * There is no in-place "set graph from JSON" mutation on a live component, so
 * the replacement is remove + add inside ONE undo group — a single undo step
 * restores the previous component exactly, mirroring `reloadComponentFromDisk`
 * with undo on. When the replaced component held the project's root node
 * (updating the home page), the root is re-derived on the replacement — and on
 * the old component again on undo — because `removeComponent` clears it.
 *
 * Returns the new `ComponentModel`. Throws `StagingError` — without touching
 * the project — when the component no longer exists (it was removed between
 * authoring and accept).
 */
export function updateAuthoredComponent(
  project: ProjectModel,
  files: ComponentFiles,
  options: AcceptOptions = {}
): ComponentModel {
  const legacyName = stagedLegacyName(files);
  const undo = new UndoActionGroup({ label: options.label ?? `update AI component ${legacyName}` });
  const component = updateAuthoredComponentInGroup(project, files, undo);
  UndoQueue.instance.push(undo);
  return component;
}

/** The legacy name a staged candidate would occupy in the project. */
export function stagedLegacyName(files: ComponentFiles): string {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  return toLegacyName(files.component, registryPath);
}

/**
 * AIX-011: the create-accept mutation, recorded into a caller-owned undo
 * group instead of pushing its own — the primitive `applyAuthoredPlan`
 * composes so an N-operation apply is ONE undo step. `acceptAuthoredComponent`
 * is the single-component wrapper over the same path.
 */
export function addAuthoredComponentToGroup(
  project: ProjectModel,
  files: ComponentFiles,
  undo: UndoActionGroup
): ComponentModel {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const legacyName = toLegacyName(files.component, registryPath);

  if (project.getComponentWithName(legacyName)) {
    throw new StagingError(
      `Component "${legacyName}" already exists in the project — it was created after authoring started.`
    );
  }

  const legacy = reconstructLegacyComponent(registryPath, files.component, files.nodes, files.connections);
  const component = ComponentModel.fromJSON(legacy);
  project.addComponent(component, { undo });
  return component;
}

/**
 * AIX-011: the update-accept mutation (replace-by-remove+add with order and
 * root fidelity — see `updateAuthoredComponent`), recorded into a caller-owned
 * undo group instead of pushing its own.
 */
export function updateAuthoredComponentInGroup(
  project: ProjectModel,
  files: ComponentFiles,
  undo: UndoActionGroup
): ComponentModel {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const legacyName = toLegacyName(files.component, registryPath);

  const existing = project.getComponentWithName(legacyName);
  if (!existing) {
    throw new StagingError(
      `Component "${legacyName}" no longer exists in the project — it was removed after authoring started.`
    );
  }

  const legacy = reconstructLegacyComponent(registryPath, files.component, files.nodes, files.connections);
  const component = ComponentModel.fromJSON(legacy);
  const wasRoot = project.getRootComponent() === existing;

  // Two bookkeeping details make replace-by-remove+add a *faithful* swap:
  // `addComponent` appends, so the replacement (and the original, on undo) is
  // moved back to the original position — an update must not shuffle the
  // project file; and `removeComponent` clears the project root when the
  // replaced component held it, so the root must come back with whichever
  // component the direction of travel just put back. The root is restored by
  // NODE, not via `setRootComponent`: that helper filters on
  // `type.allowAsExportRoot`, which silently no-ops when the node library is
  // not loaded (the new-project-no-Home failure mode). The candidate declares
  // its visual root, and undo has the exact original node — neither needs a
  // type lookup.
  const index = project.getComponents().indexOf(existing);
  const originalRootNode = wasRoot ? project.getRootNode() : undefined;
  const newRootId = files.nodes.visualRoots?.[0] ?? originalRootNode?.id;
  const restoreOrder = (current: ComponentModel) => {
    const components = project.getComponents();
    const at = components.indexOf(current);
    if (at !== -1 && at !== index) {
      components.splice(at, 1);
      components.splice(index, 0, current);
    }
  };

  // The undo half sits first in the group (group undo runs in reverse), so in
  // BOTH directions settling runs only after its component is back in the
  // project.
  undo.push({
    undo: () => {
      restoreOrder(existing);
      if (originalRootNode) project.setRootNode(originalRootNode);
    }
  });
  project.removeComponent(existing, { undo });
  project.addComponent(component, { undo });
  undo.pushAndDo({
    do: () => {
      restoreOrder(component);
      if (wasRoot) {
        const node = newRootId ? component.graph.findNodeWithId(newRootId) : undefined;
        if (node) project.setRootNode(node);
        else project.setRootComponent(component);
      }
    }
  });

  return component;
}

// ── AAQ-001: registration ─────────────────────────────────────────────────────

/** Whether a staged candidate is a page: it says so by name, or by its root node. */
export function stagedComponentIsPage(files: ComponentFiles): boolean {
  if (looksLikePageComponent(stagedLegacyName(files))) return true;
  return files.nodes.nodes.some((node) => node.type === PAGE_NODE_TYPE);
}

/** Every Router node in the project, with where it lives and what it lists. */
export function findProjectRouters(project: ProjectModel): RouterLocation[] {
  const rootComponent = project.getRootComponent();
  const routers: RouterLocation[] = [];

  for (const component of project.getComponents()) {
    component.graph.forEachNode((node: NodeGraphNode) => {
      if (!ROUTER_NODE_TYPES.has(node.typename)) return;
      const name = node.parameters?.['name'];
      routers.push({
        component: component.name,
        nodeId: node.id,
        ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
        pages: readRouterPages(node),
        ...(component === rootComponent ? { isRoot: true } : {})
      });
    });
  }

  return routers;
}

/**
 * A Router's `pages` parameter, defensively.
 *
 * Hand-edited projects, older exports and a model that half-understood the shape
 * all reach this, and the one thing that must never happen is an apply throwing
 * on a malformed value it could simply have replaced.
 */
function readRouterPages(node: NodeGraphNode): RouterPagesValue {
  const value = node.parameters?.['pages'];
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

/**
 * A page nobody has built anything in — the shape a freshly created project's
 * Home has, and the only start page an apply is allowed to move away from.
 *
 * "Empty" is measured as the page's own root node having no children, rather
 * than as a node count: the template's Home is one `Page` node with two
 * parameters, and a page someone has started work in has something under it.
 */
export function isPlaceholderPage(project: ProjectModel, legacyName: string): boolean {
  const component = project.getComponentWithName(legacyName);
  if (!component) return false;
  const roots = component.graph.roots ?? [];
  if (roots.length === 0) return true;
  if (roots.length > 1) return false;
  return (roots[0].children ?? []).length === 0;
}

/**
 * What registering these pages would do to this project, without doing it.
 *
 * The plan review shows this sentence before Apply, and the transaction performs
 * exactly it — one function, so the promise and the act cannot disagree. That is
 * also why a page the plan is about to *fill* is excluded from the placeholder
 * test: run before the apply, the project's Home is still empty; run after, it
 * is not. Without that clause the preview would offer to move the start page and
 * the apply would decline to.
 */
export function prospectivePageRegistration(
  project: ProjectModel,
  pages: readonly string[]
): PageRegistration | undefined {
  const routers = findProjectRouters(project);
  const startPage = chooseRouter(routers)?.pages.startPage;
  const isBeingBuilt = startPage !== undefined && pages.some((page) => isSamePage(page, startPage));
  return planPageRegistration(routers, pages, {
    ...(startPage && !isBeingBuilt && isPlaceholderPage(project, startPage)
      ? { placeholderStartPage: startPage }
      : {})
  });
}

/**
 * Register the pages this apply created in the project's page router, recording
 * the change into the caller's undo group.
 *
 * Returns what it did, or `undefined` when it did nothing — the pages were
 * already listed (the agent wrote the router update itself), or the project has
 * no router to register them in. A project with no router is **not** an error
 * here: single-screen apps exist, and refusing an otherwise-good apply over a
 * missing router would be this phase's mistake in the other direction. The
 * unreachable-page diagnostic is where that gets said.
 */
export function registerAuthoredPagesInGroup(
  project: ProjectModel,
  pages: readonly string[],
  undo: UndoActionGroup
): PageRegistration | undefined {
  const registration = prospectivePageRegistration(project, pages);
  if (!registration) return undefined;

  const component = project.getComponentWithName(registration.router.component);
  const node = component?.graph.findNodeWithId(registration.router.nodeId);
  if (!node) return undefined;

  node.setParameter('pages', registration.pages, { undo, label: 'register pages' });
  return registration;
}
