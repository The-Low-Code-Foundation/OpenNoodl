/**
 * The renderer's door to a running backend's workflow surface (WFA-004).
 *
 * Everything here is a thin proxy over the `backend:*` IPC channels, which in
 * turn proxy `/admin/workflow-*` on a specific backend. Two properties matter
 * enough to state:
 *
 *  - **Every call names a backend.** A workflow belongs to the backend whose
 *    data directory holds it; there is no "the" backend. The canvas carries the
 *    backend id with the document for exactly this reason.
 *  - **Nothing is bundled.** The step-kind catalog is fetched, never shipped. A
 *    stale local copy could offer a kind the target backend cannot execute, and
 *    preventing that is the whole reason the registry is served (README).
 *
 * @module models/workflow/WorkflowBackendClient
 */

import type { StepKindCatalog, WorkflowDefinition, WorkflowInput, WorkflowRef } from './types';

function ipc() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).require('electron').ipcRenderer;
}

export interface BackendWorkflowDefs {
  backendId: string;
  backendName: string;
  workflows: WorkflowDefinition[];
  error?: string;
}

/**
 * Every running backend's workflow definitions, whole.
 *
 * `listWorkflows` below reduces these to `WorkflowRef`s for the panel; WFA-006's
 * reverse lookup ("which workflows call this function?") needs the steps, so it
 * reads the same answer rather than fetching each definition again. An
 * unreachable backend arrives with `error` set and an empty list — the caller
 * must be able to tell that from "this backend has no workflows".
 */
export async function listWorkflowDefinitions(): Promise<BackendWorkflowDefs[]> {
  try {
    return ((await ipc().invoke('backend:list-workflow-defs')) as BackendWorkflowDefs[]) || [];
  } catch {
    return [];
  }
}

export interface WorkflowListResult {
  workflows: WorkflowRef[];
  /** Running backends that could not be asked, by name. */
  unreachable: string[];
  /** How many backends were running at all — 0 is "start a backend", not "none exist". */
  backendCount: number;
}

/**
 * Every running backend's workflows, flattened but never anonymised — each row
 * keeps the backend it came from.
 */
export async function listWorkflows(): Promise<WorkflowListResult> {
  const result = await listWorkflowDefinitions();

  const workflows: WorkflowRef[] = [];
  const unreachable: string[] = [];
  for (const backend of result) {
    if (backend.error) unreachable.push(backend.backendName);
    for (const def of backend.workflows || []) {
      workflows.push({
        backendId: backend.backendId,
        backendName: backend.backendName,
        id: def.id,
        name: def.name || def.id,
        stepCount: def.steps?.length ?? 0
      });
    }
  }
  return { workflows, unreachable, backendCount: result.length };
}

/** The step vocabulary of ONE backend. Throws when that backend is not running. */
export async function fetchStepKinds(backendId: string): Promise<StepKindCatalog> {
  const catalog: StepKindCatalog = await ipc().invoke('backend:workflow-step-kinds', backendId);
  if (!catalog || !Array.isArray(catalog.kinds)) {
    throw new Error('The backend answered the step-kind catalog with something that is not a catalog.');
  }
  return catalog;
}

export async function fetchWorkflow(backendId: string, workflowId: string): Promise<WorkflowDefinition> {
  const result = await ipc().invoke('backend:get-workflow-def', backendId, workflowId);
  const workflow = result?.workflow;
  if (!workflow) throw new Error(`The backend has no workflow "${workflowId}".`);
  return workflow as WorkflowDefinition;
}

/**
 * Create or replace a definition.
 *
 * A rejected definition throws with the backend validator's own message. That
 * message is the thing to show the user verbatim: it names the step and the
 * problem, and it is the same text that would appear if this definition ever
 * stopped a backend from booting.
 */
export async function saveWorkflow(backendId: string, workflow: WorkflowInput): Promise<WorkflowDefinition> {
  const result = await ipc().invoke('backend:save-workflow-def', backendId, workflow);
  const saved = result?.workflow;
  if (!saved) throw new Error('The backend accepted the save but returned no workflow.');
  return saved as WorkflowDefinition;
}

export async function deleteWorkflow(backendId: string, workflowId: string): Promise<void> {
  await ipc().invoke('backend:delete-workflow-def', backendId, workflowId);
}

/** Run it now. `null` means the run outlived the request ceiling and is still going (F33). */
export async function runWorkflow(
  backendId: string,
  workflowId: string,
  payload: Record<string, unknown>
): Promise<string | null> {
  const result = await ipc().invoke('backend:run-workflow-def', backendId, workflowId, payload);
  if (result?.stillRunning) return null;
  const executionId = result?.run?.executionId;
  if (!executionId) {
    throw new Error(result?.error || 'The backend accepted the run but returned no execution id.');
  }
  return executionId as string;
}
