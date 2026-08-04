/**
 * AIX-011 — Project-scope authoring: the plan transaction
 *
 * The ONLY code that moves a plan into the live project, and it moves the
 * whole plan or nothing. The transaction property is structural, not
 * promised, at three levels:
 *
 *  1. There is no per-operation apply API. This function takes the complete
 *     accepted set — `AppliedPlanComponentOperation` *requires* `files` and
 *     `AppliedPlanDocOperation` *requires* `proposed`, and both exist only for
 *     candidates that passed their gate — so "apply operation 1 before
 *     operation 3 has validated" has no code path that could express it. The
 *     orchestrator (`PlanRun`) never imports this module; it produces plain
 *     data.
 *  2. Every check that can refuse (collision, missing target, missing doc
 *     writer, duplicate targets, a doc that changed on disk since it was read)
 *     runs in a preflight pass BEFORE the first mutation. A refusal throws
 *     `StagingError` with the project untouched.
 *  3. Every mutation records into ONE `UndoActionGroup`, pushed once — a
 *     single undo restores the project exactly (criterion 4 tests this on
 *     real files, not a mock), and redo reapplies the whole plan.
 *
 * Reject-before-apply needs no code here, for AIX-002's original reason: a
 * plan that is never passed to this function has touched nothing.
 *
 * **Why the doc writes go first.** They are the only part of an apply that
 * touches a disk, and therefore the only part that can still fail once
 * preflight has passed; component operations at this point are in-memory model
 * edits against a project preflight has just checked. Doing the fallible thing
 * first means its failure is a clean refusal with nothing else applied. The
 * remaining case — a component mutation throwing after a doc has been written
 * — is caught and the whole group is rolled back through the inverses it has
 * already recorded, so there is still no path that leaves half a plan behind.
 *
 * @module AiAssistant/authoring/planStaging
 */

import type { ComponentModel } from '../../componentmodel';
import type { ProjectModel } from '../../projectmodel';
import { UndoActionGroup, UndoQueue } from '../../undo-queue-model';
import type { PageRegistration } from './pageRegistration';
import type { PlanOperation, PlanProvisionSpec } from './plan';
import {
  addAuthoredComponentToGroup,
  registerAuthoredPagesInGroup,
  stagedComponentIsPage,
  stagedLegacyName,
  StagingError,
  updateAuthoredComponentInGroup
} from './staging';
import type { ComponentFiles } from './types';

/**
 * One accepted operation, ready to apply. `files` is not optional: the type
 * itself is the "everything staged first" gate — an operation that never
 * passed the validation gate has no `ComponentFiles` to put here.
 */
export interface AppliedPlanComponentOperation {
  kind: 'create' | 'update';
  operation: PlanOperation;
  files: ComponentFiles;
}

/**
 * A doc operation in the accepted set, carrying the body a `DocSession`
 * authored during the fan-out. `proposed` is required for exactly the reason
 * `files` is on a component operation: a doc operation that never authored
 * anything has nothing to put here, so "apply a doc op whose body does not
 * exist yet" is not expressible. `baseline` is the file as the authoring turn
 * read it, and is what the write path's optimistic-concurrency check compares
 * against — `null` means the file did not exist.
 */
export interface AppliedPlanDocOperation {
  kind: 'doc';
  operation: PlanOperation;
  proposed: string;
  baseline: string | null;
  /** The model's one-line description of its change, for logs and labels. */
  summary?: string;
}

/**
 * AIB-007 — the provision in the accepted set.
 *
 * `provision` is required for the same reason `files` and `proposed` are: an
 * operation with nothing to create cannot be expressed here.
 */
export interface AppliedPlanProvisionOperation {
  kind: 'provision';
  operation: PlanOperation;
  provision: PlanProvisionSpec;
}

export type AppliedPlanOperation =
  | AppliedPlanComponentOperation
  | AppliedPlanDocOperation
  | AppliedPlanProvisionOperation;

/**
 * The doc write path, injected.
 *
 * The write itself belongs to AIX-009 (`ProjectDocsModel` — optimistic
 * concurrency against `baseline`, temp-file + atomic rename), and this module
 * belongs to AIX-011; the interface is the seam between them, and it is also
 * what keeps the plan transaction free of the platform filesystem.
 * `createPlanDocWriter` in `models/ProjectDocs` is the editor's implementation.
 *
 * The contract:
 *
 *  - `preflight` may refuse — the file changed on disk since the doc turn read
 *    it, the path is not inside `docs/` — and runs with nothing yet mutated.
 *  - `apply` performs the write and records its inverse into `undoGroup`, so
 *    the doc change rides in the SAME single undo step as the plan's
 *    components (acceptance criterion 7).
 *  - Both must throw on failure, never swallow.
 *
 * Without a writer, `applyAuthoredPlan` REFUSES a plan containing doc
 * operations in preflight, loudly, before any mutation. It never fake-succeeds.
 */
export interface PlanDocWriter {
  preflight?(op: AppliedPlanDocOperation): Promise<void> | void;
  apply(op: AppliedPlanDocOperation, undoGroup: UndoActionGroup): Promise<void> | void;
}

/**
 * AIB-007 — the backend provisioner, injected, on the same seam as
 * {@link PlanDocWriter} and for the same reason: this module belongs to AIX-011
 * and knows nothing about IPC, child processes or `cloudservices`.
 *
 * ## The undo boundary, which is the whole design of this interface
 *
 * `UndoActionGroup`'s actions are **synchronous** `() => void`, and
 * `applyAuthoredPlan` calls `undo.undo()` synchronously in its rollback path.
 * Creating a backend is asynchronous IPC and creating a collection is an HTTP
 * request to a child process; neither can be a synchronous inverse.
 *
 * That is the mechanical objection. The stronger one is that **it should not
 * be**: undoing "apply plan" by deleting a database destroys durable output the
 * user never asked to destroy, which is the defect this whole phase exists to
 * fix, pointed the other way. And a backend is machine-level — `backends/<id>/`
 * in userData, with a `projectIds` array — not part of the project at all.
 *
 * So the transaction splits where the product already splits:
 *
 * - **`apply` records the project's *binding* into `undoGroup`** — the
 *   `cloudservices` pointer, synchronously, exactly. One undo puts the project
 *   back.
 * - **The backend itself survives the undo**, idempotently, visible and
 *   deletable in Backend Services.
 *
 * ⚠️ **This interface deliberately does NOT carry a `describeSideEffects`.**
 * There was one, and nothing called it: the sentence a user needs ("creates a
 * backend on this computer… undoing stops using it but does not delete it") has
 * to appear next to the **Drop** button in the plan list, which is a screen the
 * transaction never reaches. `ProjectAuthoringView`'s provision row owns that
 * copy. A method here would be a second place to write it and a first place to
 * forget it. What the rule "a step that cannot be undone must be declared in
 * preflight" actually needs is that the declaration reach the user *before* they
 * commit — and it does, one screen earlier than this module exists.
 */
export interface PlanBackendProvisioner {
  /**
   * Refuse before anything is mutated. Throw with a sentence the user can act
   * on — a port in use, no room on disk, an existing backend of that name that
   * this would not be allowed to reuse.
   */
  preflight?(op: AppliedPlanProvisionOperation): Promise<void> | void;
  /**
   * Create the backend and bind the project to it, recording **the binding's**
   * inverse into `undoGroup`. Must throw on failure, never swallow.
   *
   * Returns what actually happened, including the collections it could not
   * create — which are a warning, not a failure: `nodegx-backend` creates a
   * collection on first write, so a missing one costs a typed column, not the
   * ability to run.
   */
  apply(op: AppliedPlanProvisionOperation, undoGroup: UndoActionGroup): Promise<ProvisionedBackend>;
}

/** What a provision actually did. */
export interface ProvisionedBackend {
  /** The local backend id, as `backend:list` reports it. */
  backendId: string;
  name: string;
  endpoint: string;
  /** Collections that now exist. */
  collections: string[];
  /** Collections that did not get created, with why. Never fatal — see {@link PlanBackendProvisioner}. */
  warnings: string[];
}

export interface ApplyPlanOptions {
  label?: string;
  /**
   * Absent only when the project has nowhere to keep docs (an unsaved project
   * has no folder), in which case a plan carrying doc operations is refused
   * rather than silently applied without them.
   */
  docWriter?: PlanDocWriter;
  /**
   * AIB-007. Absent means a plan carrying a provision is **refused in
   * preflight**, the same shape as a missing `docWriter` — a headless caller
   * with no IPC must not silently apply the pages and leave them pointing at
   * nothing.
   */
  provisioner?: PlanBackendProvisioner;
  /**
   * AAQ-003 — project settings this plan agreed, applied inside the same undo
   * group as everything else.
   *
   * The only one so far is `bodyScroll`, and the defect it closes is that
   * nothing in the AI path ever set it: the default is off, an app root is then
   * `position: fixed` with `overflow: clip`, and every page the agent built was
   * clipped at the viewport with no scrollbar — deployed as well as in preview.
   *
   * A setting the project has ALREADY set is never overwritten (see
   * `applySettings`): the plan states what a new app needs, not what an existing
   * one should have chosen.
   */
  settings?: Record<string, unknown>;
}

export interface AppliedPlanResult {
  /** Components created or replaced, in apply order, keyed by operation id. */
  components: Map<string, ComponentModel>;
  /** Doc paths written, in apply order. */
  docs: string[];
  /** AIB-007 — the backend this apply provisioned, when it provisioned one. */
  backend?: ProvisionedBackend;
  /**
   * AAQ-001 — the pages this apply registered in the project's router, when it
   * registered any. Absent when the plan created no pages, when they were
   * already listed, or when the project has no router.
   */
  registration?: PageRegistration;
  /** AAQ-003 — project settings this apply wrote, by name. Absent when it wrote none. */
  settings?: string[];
  undoLabel: string;
}

/**
 * Apply an accepted plan to the live project as one undoable step.
 *
 * Throws `StagingError` from preflight — project untouched — when any
 * operation could not apply; there is deliberately no path that applies some
 * operations and then discovers a refusal.
 */
export async function applyAuthoredPlan(
  project: ProjectModel,
  operations: readonly AppliedPlanOperation[],
  options: ApplyPlanOptions = {}
): Promise<AppliedPlanResult> {
  if (operations.length === 0) {
    throw new StagingError('The plan has no accepted operations to apply.');
  }

  const docOps = operations.filter((op): op is AppliedPlanDocOperation => op.kind === 'doc');
  const provisionOps = operations.filter((op): op is AppliedPlanProvisionOperation => op.kind === 'provision');
  const componentOps = operations.filter(
    (op): op is AppliedPlanComponentOperation => op.kind !== 'doc' && op.kind !== 'provision'
  );

  // ── Preflight: every refusal happens here, before any mutation. ────────────
  // AIB-007 first, because it is the only refusal that can be answered by
  // "drop that operation and apply the rest" without re-authoring anything.
  if (provisionOps.length > 1) {
    throw new StagingError(
      'This plan provisions two backends. A project has one, so fold them into a single operation.'
    );
  }
  for (const op of provisionOps) {
    if (!options.provisioner) {
      throw new StagingError(
        `"${op.operation.target}" cannot be provisioned here: this caller has no way to create a backend. ` +
          'Exclude the provision operation to apply the rest, and add a backend in Backend Services.'
      );
    }
    try {
      await options.provisioner.preflight?.(op);
    } catch (error) {
      throw new StagingError(
        `"${op.operation.target}" cannot be provisioned: ${
          error instanceof Error ? error.message : String(error)
        } Nothing was created.`
      );
    }
  }

  const seenDocs = new Set<string>();
  for (const op of docOps) {
    if (!options.docWriter) {
      throw new StagingError(
        `Doc operation "${op.operation.target}" cannot be applied: this project has no docs folder to write ` +
          'to (it has never been saved). Exclude the doc operation to apply the rest.'
      );
    }
    if (seenDocs.has(op.operation.target)) {
      throw new StagingError(
        `The plan writes "${op.operation.target}" twice — two operations cannot rewrite the same document.`
      );
    }
    seenDocs.add(op.operation.target);
    try {
      await options.docWriter.preflight?.(op);
    } catch (error) {
      throw new StagingError(
        `Doc operation "${op.operation.target}" cannot be applied: ${
          error instanceof Error ? error.message : String(error)
        } Nothing was written.`
      );
    }
  }

  const seen = new Set<string>();
  for (const op of componentOps) {
    const legacyName = stagedLegacyName(op.files);
    if (seen.has(legacyName)) {
      throw new StagingError(`The plan applies "${legacyName}" twice — operations must target distinct components.`);
    }
    seen.add(legacyName);
    const existing = project.getComponentWithName(legacyName);
    if (op.kind === 'create' && existing) {
      throw new StagingError(
        `Component "${legacyName}" already exists in the project — it was created after authoring started.`
      );
    }
    if (op.kind === 'update' && !existing) {
      throw new StagingError(
        `Component "${legacyName}" no longer exists in the project — it was removed after authoring started.`
      );
    }
  }

  // ── One group, every mutation inside it, pushed once. ──────────────────────
  const undoLabel =
    options.label ??
    `apply AI plan (${componentOps.length} component${componentOps.length === 1 ? '' : 's'}${
      docOps.length > 0 ? ` + ${docOps.length} doc${docOps.length === 1 ? '' : 's'}` : ''
    }${provisionOps.length > 0 ? ' + backend' : ''})`;
  const undo = new UndoActionGroup({ label: undoLabel });
  const components = new Map<string, ComponentModel>();
  const docs: string[] = [];
  let backend: ProvisionedBackend | undefined;
  let registration: PageRegistration | undefined;
  let settingsWritten: string[] = [];

  // AIB-001 slice 4: which operation the transaction is inside. A mutation that
  // throws is nearly always about ONE operation's candidate — the crash this
  // task is named for came from a single node's parameter — and the recovery
  // the user needs ("re-author that one") is unreachable without knowing which.
  let applying: AppliedPlanOperation | undefined;
  try {
    // AIB-007: the backend before the docs, because the docs describe it and
    // because it is the operation with a side effect outside the project — if
    // anything is going to refuse, the cheapest moment is before a file has
    // been rewritten. Its own failure still rolls the group back; what does
    // *not* roll back is a backend that was created before the failure, which
    // is stated on the interface and shown before apply rather than discovered.
    for (const op of provisionOps) {
      applying = op;
      backend = await options.provisioner!.apply(op, undo);
    }
    // Disk next — see the module note. Preflight guaranteed the writer exists.
    for (const op of docOps) {
      applying = op;
      await options.docWriter!.apply(op, undo);
      docs.push(op.operation.target);
    }
    for (const op of componentOps) {
      applying = op;
      components.set(
        op.operation.id,
        op.kind === 'create'
          ? addAuthoredComponentToGroup(project, op.files, undo)
          : updateAuthoredComponentInGroup(project, op.files, undo)
      );
    }
    // AAQ-001, last: a page component is not a page until a Router lists it, and
    // nothing in the AI stack knew that — so a plan that created three pages
    // produced three components the app could not reach. This runs after the
    // components are in, because "is the current start page an empty
    // placeholder" is a question about the project as it now stands, and because
    // a registration pointing at a component that failed to apply would be a
    // route to nowhere. It is inside the same group and the same try: one undo
    // takes the pages and their registration back together.
    applying = undefined;
    registration = registerAuthoredPagesInGroup(project, pageTargets(componentOps), undo);
    // AAQ-003, in the same group and for the same reason: a page that cannot
    // scroll is as unreachable as a page nobody routed.
    settingsWritten = applySettings(project, options.settings, undo);
  } catch (error) {
    // Roll back through the inverses recorded so far. This is not a
    // partial-apply path — it is the absence of one.
    try {
      undo.undo();
    } catch {
      /* a failed rollback must not hide the failure that caused it */
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new StagingError(
      applying
        ? `"${applying.operation.target}" could not be applied: ${reason} ` +
          'Nothing reached your project — everything the plan had already changed was rolled back.'
        : `The plan could not be applied: ${reason} Everything it had already changed was rolled back.`,
      applying
        ? { id: applying.operation.id, target: applying.operation.target, kind: applying.kind }
        : undefined
    );
  }

  UndoQueue.instance.push(undo);
  return {
    components,
    docs,
    ...(backend ? { backend } : {}),
    ...(registration ? { registration } : {}),
    ...(settingsWritten.length > 0 ? { settings: settingsWritten } : {}),
    undoLabel
  };
}

/**
 * AAQ-003 — write the project settings this plan agreed, undoably, and answer
 * which ones actually changed.
 *
 * **Only settings the project has no value for.** A project where someone has
 * been through Project Settings and switched Body Scroll off has decided; a plan
 * that overrode that would be the AI stack reaching past the user, which is the
 * failure this whole phase is about, pointed the other way. `undefined` — the
 * state every project starts in — is the absence of a decision, not a decision.
 */
function applySettings(
  project: ProjectModel,
  settings: Record<string, unknown> | undefined,
  undo: UndoActionGroup
): string[] {
  if (!settings) return [];
  const written: string[] = [];
  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    const before = project.getSettings()[name];
    if (before !== undefined) continue;
    undo.pushAndDo({
      do: () => project.setSetting(name, value),
      undo: () => project.setSetting(name, before)
    });
    written.push(name);
  }
  return written;
}

/**
 * AAQ-001 — the page components this apply puts into the project, in plan order.
 *
 * Updates count as well as creates: a page that exists but was never registered
 * is exactly the state this task is about, and re-listing one that is already
 * listed is a no-op. Plan order matters — the first page is the one that becomes
 * home when home is up for grabs — and it is the order the user approved.
 */
function pageTargets(componentOps: readonly AppliedPlanComponentOperation[]): string[] {
  return componentOps.filter((op) => stagedComponentIsPage(op.files)).map((op) => stagedLegacyName(op.files));
}
