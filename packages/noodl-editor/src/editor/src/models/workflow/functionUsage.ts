/**
 * "What calls this function?" (WFA-006 §1, step 6).
 *
 * The reverse of the descent, and the question you ask right before editing a
 * cloud function. It is answered from the workflow definitions themselves —
 * every step of a kind that invokes a function carries the bare name in
 * `step.ref` — so nothing has to be indexed or kept in sync.
 *
 * WHY NOT `NodeReferencesPanel`. Step 1 asks; the answer is in WFA-006-ASSESSMENT
 * §1. In one line: that panel indexes `ProjectModel` synchronously by node type,
 * and a workflow is not in `ProjectModel`, has no nodes, is fetched per backend
 * over IPC and may be unreachable. Reusing it would mean replacing every part of
 * it except its name.
 *
 * A caller must be able to tell **"no workflow calls this"** from **"the
 * backends could not be asked"** — the same distinction WFA-005's
 * `isTargetResolved` draws, for the same reason.
 *
 * @module models/workflow/functionUsage
 */

import { listWorkflowDefinitions } from './WorkflowBackendClient';

import type { WorkflowDefinition, WorkflowRef } from './types';

export interface FunctionCaller {
  /** Enough to open it. */
  ref: WorkflowRef;
  /** The steps in that workflow that call this function, by step id. */
  stepIds: string[];
}

export interface FunctionUsage {
  functionName: string;
  callers: FunctionCaller[];
  /** Backends that answered. Zero with `unreachable` non-empty is "we do not know". */
  backendsAsked: number;
  /** Running backends that could not be read, by name. */
  unreachable: string[];
}

/**
 * The step kinds that invoke a function are not hardcoded anywhere in the
 * editor — the served catalog marks them `invokesFunction`. Here, though, we are
 * reading a definition rather than a catalog, and `ref` is only ever set on a
 * step of such a kind (the backend rejects it on any other:
 * `kind "<k>" does not invoke a function — remove "ref"`). So the presence of
 * `ref` IS the test, and it stays correct if a tenth kind is added.
 */
export function callersInDefinition(definition: WorkflowDefinition, functionName: string): string[] {
  return (definition.steps || []).filter((step) => step.ref === functionName).map((step) => step.id);
}

/** Which workflows, on which running backends, call this function. */
export async function findFunctionCallers(functionName: string): Promise<FunctionUsage> {
  const empty: FunctionUsage = { functionName, callers: [], backendsAsked: 0, unreachable: [] };
  if (!functionName) return empty;

  const perBackend = await listWorkflowDefinitions();

  const callers: FunctionCaller[] = [];
  const unreachable: string[] = [];
  let backendsAsked = 0;

  for (const backend of perBackend) {
    if (backend.error) {
      unreachable.push(backend.backendName);
      continue;
    }
    backendsAsked++;

    for (const definition of backend.workflows || []) {
      const stepIds = callersInDefinition(definition, functionName);
      if (!stepIds.length) continue;

      callers.push({
        ref: {
          backendId: backend.backendId,
          backendName: backend.backendName,
          id: definition.id,
          name: definition.name || definition.id,
          stepCount: definition.steps?.length ?? 0
        },
        stepIds
      });
    }
  }

  return { functionName, callers, backendsAsked, unreachable };
}

/**
 * The chip's label. Says what is true, including when nothing is.
 *
 * "Used by no workflow" and "we could not ask" are different sentences, because
 * the first is a fact about your project and the second is a fact about the
 * editor's reach.
 */
export function usageLabel(usage: FunctionUsage): string {
  if (usage.callers.length === 1) {
    return `Used by 1 workflow`;
  }
  if (usage.callers.length > 1) {
    return `Used by ${usage.callers.length} workflows`;
  }
  if (usage.backendsAsked === 0) {
    return usage.unreachable.length ? 'Callers unknown' : 'No backend running';
  }
  return 'Used by no workflow';
}
