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
 *    needs it running. ⚠️ Advisory: the backend creates a collection on first
 *    write anyway, so a failure here is a warning and the apply continues.
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
 * ## Idempotence
 *
 * Re-applying a plan (redo, or a second apply after an undo) must not leave two
 * backends behind. {@link findReusableBackend} matches on name, and the
 * collection creation is idempotent at the backend
 * (`SchemaManager.createTable` returns `created: false` for one that exists).
 * The one thing that is not re-done is the *binding* — that is the undo group's
 * job, and `redo()` re-runs exactly it.
 *
 * @module BackendServices/provisionBackend
 */

import { getIpc } from '@noodl-utils/ipc';

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

interface LocalBackendMeta {
  id: string;
  name: string;
  port: number;
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const ipc = getIpc();
  if (!ipc) {
    throw new Error('This build cannot create a backend — the editor has no connection to its main process.');
  }
  return (await ipc.invoke(channel, ...args)) as T;
}

/**
 * A backend this provision may reuse instead of creating a second one.
 *
 * Matched on **name**, which is the only stable thing a plan carries: ids are
 * assigned at creation, and matching on port would reuse whatever happened to
 * land on 8578. A user who renamed the backend gets a second one, which is the
 * right way round — reusing a backend the user has repurposed is the mistake
 * that costs data.
 */
export function findReusableBackend(existing: readonly LocalBackendMeta[], name: string): LocalBackendMeta | undefined {
  const wanted = name.trim().toLowerCase();
  return existing.find((b) => b.name.trim().toLowerCase() === wanted);
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
async function waitForRunning(id: string, timeoutMs = START_TIMEOUT_MS): Promise<{ port: number }> {
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

      const existing = await invoke<LocalBackendMeta[]>('backend:list');
      const reusable = findReusableBackend(existing ?? [], spec.name);
      const meta = reusable ?? (await invoke<LocalBackendMeta>('backend:create', spec.name));
      if (!meta?.id) throw new Error('the backend was not created');

      await invoke('backend:start', meta.id, {});
      const { port } = await waitForRunning(meta.id);
      const endpoint = `http://localhost:${port}`;

      // ── Collections. Advisory throughout — see the module note. ────────────
      const created: string[] = [];
      for (const collection of spec.collections) {
        try {
          await invoke('backend:createTable', meta.id, {
            name: collection.name,
            columns: collection.columns.map((c) => ({ name: c.name, type: c.type }))
          });
          created.push(collection.name);
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
