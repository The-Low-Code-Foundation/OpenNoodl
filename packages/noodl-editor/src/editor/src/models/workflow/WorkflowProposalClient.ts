/**
 * The renderer's door to the workflow proposal queue (WFA-007).
 *
 * A thin proxy over the `backend:*-workflow-proposal(s)` channels, which read
 * the directory an agent staged into. Same shape as `WorkflowBackendClient` and
 * for the same reasons — every call names a backend, and nothing is bundled.
 *
 * One difference worth stating: the proposals themselves come off disk, not off
 * the backend's HTTP surface, so they are readable even when the backend is
 * having a bad day. The *review* still needs it running — the cards are drawn
 * from its served step-kind catalog and the candidate is checked against its own
 * validator — which is why the list is scoped to running backends in the main
 * process rather than filtered here.
 *
 * @module models/workflow/WorkflowProposalClient
 */

import { ipcInvoke } from '@noodl-utils/ipc';

import type { WorkflowDefinition, WorkflowInput } from './types';

/** One staged proposal, as written by `noodl-mcp`. */
export interface WorkflowProposal {
  version: number;
  proposalId: string;
  backendId: string;
  /** 'create' when the backend has no workflow with this id. */
  mode: 'create' | 'update';
  workflowId: string;
  createdAt: string;
  /** What staged it, shown to the reviewer as provenance. */
  origin: string;
  /** The agent's one or two sentences about what this changes and why. */
  note?: string;
  workflow: WorkflowInput;
  /** Where it is on disk; stamped by the reader. */
  file?: string;
}

export interface BackendProposals {
  backendId: string;
  backendName: string;
  proposals: WorkflowProposal[];
  error?: string;
}

/** Every running backend's pending proposals, each keeping its backend. */
export async function listWorkflowProposals(): Promise<BackendProposals[]> {
  try {
    return (await ipcInvoke<BackendProposals[]>('backend:list-workflow-proposals')) || [];
  } catch {
    return [];
  }
}

export async function getWorkflowProposal(
  backendId: string,
  proposalId: string
): Promise<WorkflowProposal | null> {
  return (await ipcInvoke<WorkflowProposal | null>('backend:get-workflow-proposal', backendId, proposalId)) || null;
}

/**
 * Drop a proposal. Both outcomes end here — reject drops it, accept drops it
 * after the definition is written — because a proposal that survived its own
 * acceptance would be offered again as a diff against the state it produced,
 * i.e. as no change at all.
 */
export async function discardWorkflowProposal(backendId: string, proposalId: string): Promise<void> {
  await ipcInvoke('backend:discard-workflow-proposal', backendId, proposalId);
}

export interface WorkflowValidation {
  valid: boolean;
  errors: string[];
  /**
   * CWF-005: the definition the backend would STORE, when it would accept one.
   *
   * Not always what was submitted. A definition written against an older step
   * vocabulary is migrated on the way in — `retry` became a `call-function`
   * carrying a retry policy — so a surface that DRAWS a candidate before it is
   * saved has to draw this.
   *
   * Absent from a backend older than the field. That degrades correctly rather
   * than by luck: such a backend still serves the old kinds in its catalog, so
   * the submitted form is exactly what it would store and exactly what its node
   * library can draw.
   */
  definition?: WorkflowDefinition | null;
}

/**
 * Would this backend accept this definition? Nothing is written either way.
 *
 * The route this reaches (WFA-007) exists because "check" and "write" used to be
 * the same call. A rejection comes back as `{valid: false, errors}` rather than
 * as a throw — the caller asked a question.
 */
export async function validateWorkflow(backendId: string, workflow: WorkflowInput): Promise<WorkflowValidation> {
  const result = await ipcInvoke<WorkflowValidation>('backend:validate-workflow-def', backendId, workflow);
  if (!result || typeof result.valid !== 'boolean') {
    throw new Error('The backend answered the validation check with something that is not a verdict.');
  }
  return { valid: result.valid, errors: result.errors || [], definition: result.definition ?? null };
}
