/**
 * AIB-007 — the editor's `PlanBackendProvisioner`.
 *
 * The half of "a scope that needs a backend gets one" that touches a real
 * machine. `planStaging.ts` owns the transaction and knows nothing about IPC;
 * this owns the IPC and knows nothing about plans beyond the operation it is
 * handed. Same seam as `createPlanDocWriter`.
 *
 * ## Four steps, and which of them can be undone
 *
 * 1. **Create the backend** — `backend:create`, a directory under userData with
 *    a `config.json` and an allocated port. Machine-level.
 * 2. **Start it** — a supervised `nodegx-backend` child process.
 * 3. **Create the collections** — `backend:createTable` per collection, which
 *    needs it running, and *reconcile* the ones that already exist
 *    ({@link planSchemaReconciliation}). ⚠️ Advisory: the backend creates a
 *    collection on first write anyway, so a failure here is a warning and the
 *    apply continues.
 * 4. **Bind the project** — `setCloudServices`, project metadata.
 *
 * **Only step 4 is in the undo group.** `UndoActionGroup`'s actions are
 * synchronous, and the other three are asynchronous work against a process and a
 * disk — but the real reason is that they *should not* be undone: deleting a
 * database because someone pressed Cmd+Z on "apply plan" destroys durable output
 * nobody asked to destroy, which is the defect phase 38 exists to fix, inverted.
 * The user is told so **before** pressing Apply — by the provision's row in the
 * Build panel's plan list, next to its Drop button, which is the screen where
 * the decision is actually made. See `planStaging.ts::PlanBackendProvisioner`
 * for why that sentence does not live here.
 *
 * ## Idempotence, and the bug that hid inside it
 *
 * Re-applying a plan (redo, or a second apply after an undo) must not leave two
 * backends behind. {@link findReusableBackend} is what prevents that — but for
 * two phases it matched on **name alone**, and since the name was the constant
 * "App backend", every AI-created project on a machine reused the first backend
 * ever provisioned there. Reuse now also requires that this project *owns* the
 * backend; see that function for the full account (AAQ-002/F4).
 *
 * Collection creation is idempotent at the backend — `SchemaManager.createTable`
 * returns `created: false` for one that exists — and that, too, was hiding
 * something: it adds nothing, so a collection that already existed kept whatever
 * schema it had, which for an auto-created one is no columns and therefore no
 * `prop-*` ports. {@link planSchemaReconciliation} closes that (AAQ-002/F5).
 *
 * The one thing that is not re-done is the *binding* — that is the undo group's
 * job, and `redo()` re-runs exactly it.
 *
 * @module BackendServices/provisionBackend
 */

import { getIpc } from '@noodl-utils/ipc';
import { findReusableBackend, type LocalBackendMeta } from './backendReuse';

export { findReusableBackend };
export type { LocalBackendMeta };

import type {
  AppliedPlanProvisionOperation,
  PlanBackendProvisioner,
  ProvisionedBackend
} from '../AiAssistant/authoring/planStaging';
import { ProjectModel } from '../projectmodel';
import { getCloudServices, setCloudServices } from '../projectmodel.editor';
import type { UndoActionGroup } from '../undo-queue-model';

/** How long to wait for a freshly started backend to answer. */
const START_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 250;


/** One column as the backend reports it, which is looser than a plan's. */
interface ExistingColumn {
  name: string;
  type?: string;
}

/** What a plan wants a collection to have. */
interface WantedColumn {
  name: string;
  type: string;
}

/**
 * The difference between a collection that already exists and the one the plan
 * describes — AAQ-002/F5.
 */
export interface SchemaReconciliation {
  /** Columns the plan wants that the collection does not have. */
  add: WantedColumn[];
  /** Columns that exist with the wrong type. `name` is the EXISTING spelling. */
  retype: { name: string; from: string; to: string }[];
}

/** The backend owns these; a plan that names one is not describing a column. */
const SYSTEM_COLUMNS = new Set(['objectid', 'createdat', 'updatedat', 'acl']);

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const ipc = getIpc();
  if (!ipc) {
    throw new Error('This build cannot create a backend — the editor has no connection to its main process.');
  }
  return (await ipc.invoke(channel, ...args)) as T;
}


/**
 * What has to happen to an existing collection to make it match the plan —
 * AAQ-002/F5, and pure so it can be asserted without a running backend.
 *
 * ## The defect this exists for
 *
 * `backend:createTable` returns `created: false` for a collection that already
 * exists **and adds nothing**. The docblock above calls that idempotence, and
 * for a table this provision made it is. For a table it did not, it means the
 * collection keeps whatever schema it had — usually none, because a collection
 * the backend auto-created on first write has no declared columns at all. A
 * collection with no columns yields no `prop-*` ports on the Record family,
 * forever, which is finding #7 exactly.
 *
 * ## Matching is case-insensitive, and that is not a nicety
 *
 * SQLite identifiers are case-insensitive, so `ADD COLUMN age` against a table
 * that has `Age` fails with `duplicate column name` — and `SchemaManager.addColumn`
 * **swallows precisely that error**. A case-sensitive comparison here would
 * therefore emit a column addition that silently does nothing and reports
 * success. Retypes carry the *existing* spelling for the same reason.
 */
export function planSchemaReconciliation(
  existing: readonly ExistingColumn[],
  wanted: readonly WantedColumn[]
): SchemaReconciliation {
  const byName = new Map<string, ExistingColumn>();
  for (const col of existing) {
    if (col?.name) byName.set(col.name.trim().toLowerCase(), col);
  }

  const add: WantedColumn[] = [];
  const retype: SchemaReconciliation['retype'] = [];

  for (const col of wanted) {
    const key = col.name.trim().toLowerCase();
    if (!key || SYSTEM_COLUMNS.has(key)) continue;
    const found = byName.get(key);
    if (!found) {
      add.push(col);
      continue;
    }
    // An existing column whose type nobody recorded is a mismatch, not a match:
    // it is the shape an auto-created collection has, and leaving it is how the
    // ports stay wrong. `changeColumnType` corrects that one in metadata alone.
    if (found.type !== col.type) {
      retype.push({ name: found.name, from: found.type ?? 'untyped', to: col.type });
    }
  }

  return { add, retype };
}

/**
 * Whether a project already points somewhere.
 *
 * A provision **refuses** rather than repointing. Overwriting an endpoint is how
 * a user loses a deployed backend to a plan they approved for its pages, and the
 * repair (drop the provision) is one click; the repair for a silently repointed
 * project is finding out at runtime.
 */
export function endpointRefusal(current: { endpoint?: string }): string | undefined {
  if (!current.endpoint) return undefined;
  return (
    `this project already points at ${current.endpoint}. Drop the provision operation to apply the rest of ` +
    'the plan against that backend, or disconnect it in Backend Services first.'
  );
}

/** Poll `backend:status` until the process answers, or give up with a sentence. */
export async function waitForRunning(id: string, timeoutMs = START_TIMEOUT_MS): Promise<{ port: number }> {
  const deadline = Date.now() + timeoutMs;
  let lastError: string | undefined;
  for (;;) {
    try {
      const status = await invoke<{ running: boolean; port?: number }>('backend:status', id);
      if (status?.running && status.port) return { port: status.port };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `the backend did not finish starting within ${Math.round(timeoutMs / 1000)}s` +
          (lastError ? ` (${lastError})` : '') +
          '. It may still come up — check Backend Services.'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * Bring an already-existing collection up to what the plan describes, and say
 * what happened — AAQ-002/F5.
 *
 * Advisory like everything else in the collection phase: each column is its own
 * attempt, and a failure becomes a sentence rather than a thrown apply. The
 * sentences are the deliverable, not decoration — a type change **converts
 * stored values through `CAST`**, so a string column becoming a number turns
 * "sold out" into `0`. Richard chose full reconcile over additive-only knowing
 * that; what makes it defensible is F4, which means the collection being
 * reconciled now always belongs to *this* project rather than to some other app
 * that happened to provision first.
 */
async function reconcileCollection(
  backendId: string,
  collection: { name: string; columns: readonly { name: string; type: string }[] }
): Promise<string[]> {
  if (collection.columns.length === 0) return [];

  const table = await invoke<{ columns?: ExistingColumn[] } | null>(
    'backend:getTableSchema',
    backendId,
    collection.name
  );
  const plan = planSchemaReconciliation(table?.columns ?? [], collection.columns);
  if (plan.add.length === 0 && plan.retype.length === 0) return [];

  const warnings: string[] = [];
  const added: string[] = [];
  const changed: string[] = [];

  for (const column of plan.add) {
    try {
      await invoke('backend:addColumn', backendId, collection.name, { name: column.name, type: column.type });
      added.push(column.name);
    } catch (error) {
      warnings.push(
        `"${collection.name}" already existed and its "${column.name}" column could not be added ` +
          `(${error instanceof Error ? error.message : String(error)}).`
      );
    }
  }

  for (const change of plan.retype) {
    try {
      const result = await invoke<{ changed?: boolean; rebuilt?: boolean; convertedValues?: number }>(
        'backend:changeColumnType',
        backendId,
        collection.name,
        change.name,
        change.to
      );
      if (result?.changed === false) continue;
      changed.push(`${change.name} from ${change.from} to ${change.to}`);
      if (result?.rebuilt && (result.convertedValues ?? 0) > 0) {
        warnings.push(
          `"${collection.name}"."${change.name}" changed from ${change.from} to ${change.to}, converting ` +
            `${result.convertedValues} stored value${result.convertedValues === 1 ? '' : 's'} — any that were ` +
            `not valid ${change.to} values are now empty.`
        );
      }
    } catch (error) {
      warnings.push(
        `"${collection.name}"."${change.name}" is ${change.from} and the plan wants ${change.to}, but it could ` +
          `not be changed (${error instanceof Error ? error.message : String(error)}).`
      );
    }
  }

  // One line for the ordinary case, so a reused collection is never silent about
  // having been altered — the whole reason F5 was a decision and not a patch.
  const parts: string[] = [];
  if (added.length > 0) parts.push(`added ${added.join(', ')}`);
  if (changed.length > 0) parts.push(`changed ${changed.join(', ')}`);
  if (parts.length > 0) {
    warnings.unshift(`"${collection.name}" already existed — ${parts.join('; ')}.`);
  }

  return warnings;
}

export interface EditorProvisionerOptions {
  /** The project to bind. Defaults to the open one, read at apply time. */
  project?: ProjectModel;
}

/**
 * The provisioner the Build panel passes to `applyAuthoredPlan`.
 *
 * A factory rather than a singleton so a spec can bind a project without an
 * open editor — the IPC calls are the part that needs a real main process, and
 * they are all in this file rather than spread through the transaction.
 */
export function editorBackendProvisioner(options: EditorProvisionerOptions = {}): PlanBackendProvisioner {
  const projectOf = () => options.project ?? ProjectModel.instance;

  return {
    preflight(op: AppliedPlanProvisionOperation) {
      const project = projectOf();
      if (!project) throw new Error('there is no open project to give a backend to');
      const refusal = endpointRefusal(getCloudServices(project));
      if (refusal) throw new Error(refusal);
      if (!getIpc()) {
        throw new Error('the editor has no connection to its main process, so it cannot start a backend');
      }
      if (!op.provision.name.trim()) throw new Error('the backend has no name');
    },

    async apply(op: AppliedPlanProvisionOperation, undoGroup: UndoActionGroup): Promise<ProvisionedBackend> {
      const project = projectOf();
      if (!project) throw new Error('there is no open project to give a backend to');
      const spec = op.provision;
      const warnings: string[] = [];

      // AAQ-002/F4. The project id is the ownership key, so a project without
      // one can never reuse — it creates its own backend, which is the safe end
      // of that branch rather than the shared one.
      const projectId = project.id;
      const existing = await invoke<LocalBackendMeta[]>('backend:list');
      const reusable = findReusableBackend(existing ?? [], spec.name, projectId);
      const meta = reusable ?? (await invoke<LocalBackendMeta>('backend:create', spec.name, { projectId }));
      if (!meta?.id) throw new Error('the backend was not created');

      await invoke('backend:start', meta.id, {});
      const { port } = await waitForRunning(meta.id);
      const endpoint = `http://localhost:${port}`;

      // ── Collections. Advisory throughout — see the module note. ────────────
      const created: string[] = [];
      for (const collection of spec.collections) {
        try {
          const result = await invoke<{ created?: boolean }>('backend:createTable', meta.id, {
            name: collection.name,
            columns: collection.columns.map((c) => ({ name: c.name, type: c.type }))
          });
          created.push(collection.name);
          if (result?.created === false) {
            warnings.push(...(await reconcileCollection(meta.id, collection)));
          }
        } catch (error) {
          warnings.push(
            `"${collection.name}" was not created (${error instanceof Error ? error.message : String(error)}). ` +
              'The backend will create it the first time something writes to it.'
          );
        }
      }

      // ── The binding, and the ONLY thing in the undo group. ──────────────────
      //
      // ⚠️ The inverse is the **raw metadata**, not `getCloudServices`'s
      // projection, and the difference is a real one that a spec caught: that
      // pair reads and writes exactly `{instanceId, endpoint, appId, type}`, and
      // the corpus fixture carries a `workspaceId` alongside them. Snapshotting
      // through the projection and restoring through it dropped that field, so
      // undoing a provision on a Noodl Cloud project would have silently
      // unpicked its workspace binding. An inverse must restore what was there,
      // not what the reader happens to understand.
      //
      // Recorded with `push`, not `pushAndDo`: the write below has already
      // happened by the time the group is pushed onto the queue, and
      // `UndoActionGroup.push` advances the pointer without executing — the
      // `StyleTokensModel.pushAppliedUndo` shape. Getting this wrong makes the
      // whole plan's undo run from index -1 and silently do nothing.
      const before = project.getMetaData('cloudservices');
      setCloudServices(project, { id: meta.id, endpoint, appId: meta.id, type: 'nodegx' });
      const after = project.getMetaData('cloudservices');
      const restore = (value: unknown) => {
        project.setMetaData('cloudservices', value);
        // `setCloudServices` raises this and the whole Backend Services panel
        // listens for it; a bare `setMetaData` would leave the ACTIVE badge and
        // the endpoint card showing the undone binding.
        project.notifyListeners('cloudServicesChanged');
      };
      undoGroup.push({
        do: () => restore(after),
        undo: () => restore(before)
      });

      return { backendId: meta.id, name: spec.name, endpoint, collections: created, warnings };
    }
  };
}
