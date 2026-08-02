/**
 * Reviewing a workflow proposal (WFA-007) — the orchestration.
 *
 * Four things happen in order, and the order is the task:
 *
 *  1. **The step-kind catalog is fetched and installed** before anything else,
 *     or the diff canvas draws red unknowns instead of step cards. Same first
 *     move `WorkflowDocument.open` makes, for the same reason.
 *  2. **The candidate is validated against the target backend.** If it would not
 *     save, the review does NOT open — the user is shown the backend's own
 *     message as the AI's failure. §3: a proposal that could not be accepted is
 *     never offered as a choice.
 *  3. **The diff is rendered** on the read-only canvas, through AIX-003's review
 *     document, against the definition the backend has right now — not against
 *     whatever the agent thought it had.
 *  4. **Accept validates AGAIN, then writes.** The second check is the one that
 *     matters: a partial accept produces a definition neither the agent nor the
 *     user ever saw whole, and the authoritative validator sees it before disk
 *     does. Only then is the proposal discarded and the workflow opened on the
 *     canvas so the user lands on what they just accepted.
 *
 * The direct MCP path is untouched and still writes to a backend with nobody
 * looking. This makes a reviewable path exist; it does not close that one.
 *
 * @module models/workflow/workflowProposalReview
 */

import { AppRegistry } from '@noodl-models/app_registry';
import { NodeLibraryImporter } from '@noodl-models/nodelibrary/NodeLibraryImporter';

import { ChangeReviewDocumentProvider } from '../../views/documents/ChangeReviewDocument';
import { fetchStepKinds, fetchWorkflow, saveWorkflow } from './WorkflowBackendClient';
import { discardWorkflowProposal, validateWorkflow, type WorkflowProposal } from './WorkflowProposalClient';
import { buildWorkflowChangeSet, materializeWorkflowSelection } from './workflowChangeSet';
import { WorkflowEditorService } from './WorkflowEditorService';
import { buildWorkflowNodeLibrary } from './workflowNodeLibrary';

import type { WorkflowDefinition } from './types';

/** The message shown when a backend refuses the candidate outright. */
function refusalMessage(proposal: WorkflowProposal, errors: string[], backendName: string): string {
  return (
    `${backendName} would refuse to save this proposal, so it is not offered for review:\n` +
    errors.map((e) => `  • ${e}`).join('\n') +
    `\n\nThat is the proposal's fault, not yours. Ask for a corrected one — the agent can read the same ` +
    `errors from list_backend_step_kinds and the workflow it proposed (${proposal.workflowId}).`
  );
}

export class ProposalRefused extends Error {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(message);
    this.name = 'ProposalRefused';
  }
}

/**
 * Open a proposal as a diff on the canvas.
 *
 * Throws `ProposalRefused` when the candidate would not save — the caller shows
 * that verbatim, and nothing opens.
 */
export async function openWorkflowProposal(
  proposal: WorkflowProposal,
  context: { backendName: string; onDone?: () => void }
): Promise<void> {
  const { backendId } = proposal;
  const backendName = context.backendName;

  // (1) The node library first: a graph whose types are unregistered paints as
  // red unknowns, which is the symptom WFA-001 found when the cloud client
  // disappeared. Per backend, never cached across backends.
  const catalog = await fetchStepKinds(backendId);
  NodeLibraryImporter.instance.importWorkflowLibrary(buildWorkflowNodeLibrary(catalog));

  // (2) Validate before rendering.
  const verdict = await validateWorkflow(backendId, proposal.workflow);
  if (!verdict.valid) {
    throw new ProposalRefused(refusalMessage(proposal, verdict.errors, backendName), verdict.errors);
  }

  // The base is what the backend has RIGHT NOW. An agent's idea of the current
  // state can be stale — it may have read the definition minutes ago, and F61
  // means an out-of-process write does not reach an open canvas — so the diff is
  // computed against the live definition, not against anything the proposal
  // carries. A proposal that turns out to be a no-op is a legitimate answer.
  let base: WorkflowDefinition | null = null;
  if (proposal.mode === 'update') {
    base = await fetchWorkflow(backendId, proposal.workflowId).catch(() => null);
  }

  const changeSet = buildWorkflowChangeSet(base, proposal.workflow);

  // (3) Render.
  AppRegistry.instance.openDocument(ChangeReviewDocumentProvider.ID, {
    changeSet,
    title: `Review ${proposal.workflow.name || proposal.workflowId} — proposed on ${backendName}`,
    // The backend is named in the review because a definition validated against
    // one backend is not valid against another; that is the point of the served
    // registry, and it is a trap this task was told about explicitly.
    contextNote:
      `Proposed by ${proposal.origin} for ${backendName}. Nothing is written until you accept.` +
      (proposal.note ? ` — “${proposal.note}”` : ''),
    onAccept: (rejected: ReadonlySet<string>) => acceptWorkflowProposal(proposal, changeSet, rejected, backendName),
    onReject: () => {
      void discardWorkflowProposal(backendId, proposal.proposalId).then(() => context.onDone?.());
    }
  });
}

/**
 * Write the kept subset, or say why it cannot be written.
 *
 * Returns an error message for the review's rail, or `null` on success. It never
 * throws: the review document shows a string, and a thrown IPC failure there
 * would read as the accept having silently done nothing.
 */
async function acceptWorkflowProposal(
  proposal: WorkflowProposal,
  changeSet: ReturnType<typeof buildWorkflowChangeSet>,
  rejected: ReadonlySet<string>,
  backendName: string
): Promise<string | null> {
  const { workflow } = materializeWorkflowSelection(changeSet, rejected);

  try {
    // The check that matters. A partial selection is a definition nobody ever
    // reviewed as a whole — not the agent, which proposed something else, and
    // not the user, who reviewed a list of changes. The engine's own validator
    // is the only thing that has seen it.
    const verdict = await validateWorkflow(proposal.backendId, workflow);
    if (!verdict.valid) {
      return (
        `The changes you kept do not add up to a workflow ${backendName} will save:\n` +
        verdict.errors.map((e) => `  • ${e}`).join('\n') +
        `\n\nNothing has been written. Keep more of the proposal, or reject it.`
      );
    }

    await saveWorkflow(proposal.backendId, workflow);
  } catch (e) {
    // The backend validator's own message, verbatim — it names the step and the
    // problem, and it is the same text that would appear if this definition ever
    // stopped a backend from booting.
    return `Saving to ${backendName} failed.\n${e instanceof Error ? e.message : String(e)}`;
  }

  // Written, so the suggestion is spent. A proposal that survived acceptance
  // would come back as a diff against the state it just produced.
  await discardWorkflowProposal(proposal.backendId, proposal.proposalId).catch(() => undefined);

  // Land on what was just accepted, on the real canvas rather than the diff one.
  await WorkflowEditorService.instance
    .open({
      backendId: proposal.backendId,
      backendName,
      id: proposal.workflowId,
      name: workflow.name || proposal.workflowId,
      stepCount: workflow.steps.length
    })
    .catch(() => undefined);

  return null;
}
