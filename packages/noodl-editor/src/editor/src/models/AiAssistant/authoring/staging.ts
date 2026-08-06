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
import { currentNodeIds, deconflictNodeIds, type NodeIdRemap } from './nodeIds';
import type { PageRegistration, RegistrationComponent, RegistrationNode, RouterLocation } from './pageRegistration';
import {
  findRoutersInComponents,
  isPlaceholderPageGraph,
  looksLikePageComponent,
  PAGE_NODE_TYPE,
  resolvePageRegistration
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
  /**
   * AAQ-011 F12 — called when the candidate's node ids had to move to stay
   * unique project-wide. Never called when nothing collided, which is the
   * ordinary case.
   *
   * The rewrite is silent by design (see `nodeIds.ts`: a node id is never
   * referenced from outside its own component, so nothing downstream can
   * notice), but it must not be *unobservable* — a panel, a log line or a
   * telemetry event should be able to say it happened.
   */
  onNodeIdsRemapped?: (remapped: readonly NodeIdRemap[]) => void;
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
  // AAQ-011 F12: one mutation, not two. This used to reimplement
  // `addAuthoredComponentToGroup` inline (same collision check, same
  // reconstruct, same add) and the two copies were the reason the node-id fix
  // would have had to be written twice. `project.addComponent({ undo: true })`
  // builds exactly this group internally, so the behaviour is unchanged.
  const legacyName = stagedLegacyName(files);
  const undo = new UndoActionGroup({ label: options.label ?? `add AI component ${legacyName}` });
  const component = addAuthoredComponentToGroup(project, files, undo, options);
  UndoQueue.instance.push(undo);
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
  const component = updateAuthoredComponentInGroup(project, files, undo, options);
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
  undo: UndoActionGroup,
  options: AcceptOptions = {}
): ComponentModel {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const legacyName = toLegacyName(files.component, registryPath);

  if (project.getComponentWithName(legacyName)) {
    throw new StagingError(
      `Component "${legacyName}" already exists in the project — it was created after authoring started.`
    );
  }

  // AAQ-011 F12. Nothing preserved: every id in a create is introduced by this
  // write, so every one of them is a candidate for reallocation.
  const staged = deconflict(project, legacyName, files, new Set(), options);

  const legacy = reconstructLegacyComponent(registryPath, staged.component, staged.nodes, staged.connections);
  const component = ComponentModel.fromJSON(legacy);
  project.addComponent(component, { undo });
  return component;
}

/**
 * AAQ-011 F12 — the one place an AI write's node ids are made collision-free.
 *
 * ## Why here, and not at the authoring gate
 *
 * The MCP twin deconflicts in its write gate. The editor's analogous moment
 * would be `AuthoringSession.handleSubmit`, and it was rejected for a reason
 * worth recording: the session validates against an `ExplainGraph` snapshot
 * taken when authoring *started*, and the apply is the only moment that sees the
 * project as it actually is. Every entry point converges here — a single accept,
 * an update, a plan transaction, and a plan session restored from disk days
 * later (`PlanSessionStore`), which reaches `applyAuthoredPlan` with candidates
 * that were authored against a project that has since moved. A gate-time pass
 * would have covered the first three and silently missed the fourth.
 *
 * It also gets the multi-operation case for free. `applyAuthoredPlan` applies
 * component operations in sequence through these two functions, so by the time
 * the second page is staged the first one's ids are already in the project and
 * already count as taken. No overlay bookkeeping, because the project is the
 * overlay.
 *
 * ⚠️ The cost of choosing here is that review sees the pre-remap ids. That is
 * acceptable and would not be at the gate: the review renders nodes by label and
 * type (`ChangeSet` → SUB-007's diff), node ids appear nowhere a user reads, and
 * an update preserves every id the component already had — which is precisely
 * the set the diff keys on. A remap can therefore never turn a modification into
 * a remove+add in the review the user approved.
 */
function deconflict(
  project: ProjectModel,
  legacyName: string,
  files: ComponentFiles,
  preserved: ReadonlySet<string>,
  options: AcceptOptions
): ComponentFiles {
  const result = deconflictNodeIds(project.getComponents(), legacyName, files, preserved);
  if (result.remapped.length > 0) options.onNodeIdsRemapped?.(result.remapped);
  return result.files;
}

/**
 * AIX-011: the update-accept mutation (replace-by-remove+add with order and
 * root fidelity — see `updateAuthoredComponent`), recorded into a caller-owned
 * undo group instead of pushing its own.
 */
export function updateAuthoredComponentInGroup(
  project: ProjectModel,
  files: ComponentFiles,
  undo: UndoActionGroup,
  options: AcceptOptions = {}
): ComponentModel {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const legacyName = toLegacyName(files.component, registryPath);

  const existing = project.getComponentWithName(legacyName);
  if (!existing) {
    throw new StagingError(
      `Component "${legacyName}" no longer exists in the project — it was removed after authoring started.`
    );
  }

  // AAQ-011 F12. An update preserves every id the live component already
  // carries, whatever it collides with: a pre-existing collision is not this
  // write's doing, and rewriting kept ids would turn the diff the user approved
  // into a wholesale remove-and-re-add.
  const staged = deconflict(project, legacyName, files, currentNodeIds(existing), options);

  const legacy = reconstructLegacyComponent(registryPath, staged.component, staged.nodes, staged.connections);
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
  // `staged`, not `files`: a remapped visual root must resolve on the component
  // that actually landed, or updating the home page would silently drop the
  // project root.
  const newRootId = staged.nodes.visualRoots?.[0] ?? originalRootNode?.id;
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

/**
 * The project as the registration core reads it — plain nodes, no `ProjectModel`.
 *
 * AAQ-005: the decision itself (which router, which pages, whether the start page
 * moves) lives in `pageRegistration.ts` so `noodl-mcp` computes the identical
 * answer. This function is the editor's half of that seam and deliberately holds
 * no policy.
 *
 * ⚠️ `graph.roots` rather than `getVisualRootIds()` — the placeholder rule counts
 * top-level nodes of every kind, and narrowing it to visual roots would widen
 * which pages count as placeholders. See {@link isPlaceholderPageGraph}.
 */
function registrationComponents(project: ProjectModel): RegistrationComponent[] {
  const rootComponent = project.getRootComponent();
  return project.getComponents().map((component) => {
    const nodes: RegistrationNode[] = [];
    component.graph.forEachNode((node: NodeGraphNode) => {
      nodes.push({
        id: node.id,
        type: node.typename,
        parameters: node.parameters ?? undefined,
        ...(node.parent ? { parent: node.parent.id } : {})
      });
    });
    return {
      name: component.name,
      nodes,
      ...(component === rootComponent ? { isRoot: true } : {})
    };
  });
}

/** Every Router node in the project, with where it lives and what it lists. */
export function findProjectRouters(project: ProjectModel): RouterLocation[] {
  return findRoutersInComponents(registrationComponents(project));
}

/**
 * A page nobody has built anything in — the shape a freshly created project's
 * Home has, and the only start page an apply is allowed to move away from.
 *
 * ⚠️ **This function's original premise was wrong, and the live pass is how we
 * found out.** It measured "empty" as the page's own root having **no children**,
 * on the stated belief that "the template's Home is one `Page` node with two
 * parameters". It is not: `hello-world.template.ts` builds Home as a `Page` node
 * with a `Text` child reading *"Hello World!"*. So the one case this whole
 * mechanism exists for never matched, and every app the wizard built registered
 * its pages correctly and then **opened on "Hello World!"** — the "nothing
 * happened" reading of a successful build that the start-page rule was written to
 * prevent. Registration worked; the thing the user sees did not.
 *
 * What is measured now is the template's actual shape, generalised only as far as
 * it honestly generalises: a single root, and under it at most one leaf `Text`.
 * The asymmetry the rule is built around is unchanged — taking home from a page
 * somebody built is worse than opening on the wrong one — and a page that is one
 * bare line of text with nothing under it is not a page somebody built. Anything
 * more (a Group, a second child, a nested tree) is left alone as before.
 */
export function isPlaceholderPage(project: ProjectModel, legacyName: string): boolean {
  const components = registrationComponents(project);
  const component = components.find((c) => c.name === legacyName);
  if (!component) return false;
  return isPlaceholderPageGraph(component);
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
  return resolvePageRegistration(registrationComponents(project), pages);
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
