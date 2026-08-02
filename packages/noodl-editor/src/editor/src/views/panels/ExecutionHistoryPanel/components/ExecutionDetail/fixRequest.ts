/**
 * WFA-007 §6 — from a failed run to a fix request.
 *
 * The phase's strongest loop is: a run fails in the inspector → you ask for a
 * fix with that run as context → the proposal arrives on the canvas as a diff →
 * accept → re-run → watch it pass. The task asks for at least the first hop.
 *
 * ## Why the first hop is text, not a chat box
 *
 * The agent that can author a workflow is **not inside the editor**. The
 * editor's own AI loop has three component-scoped tools and has never heard of a
 * backend (WFA-007-ASSESSMENT §1c); the thing holding `update_backend_workflow`
 * is whatever MCP client the user is running. So the honest first hop is to
 * produce the request that agent needs and put it where it can be handed over.
 *
 * A chat box here would imply an agent this editor does not have. The rest of
 * the loop is real: the proposal comes back to the Workflows panel and lands on
 * the canvas as a diff.
 *
 * This module is pure text-building — no clipboard, no React — so what the
 * request says can be asserted.
 *
 * @module ExecutionHistoryPanel/components/ExecutionDetail/fixRequest
 */

/** Only what this module reads, so it does not need `@noodl-viewer-cloud`. */
export interface FixRequestStep {
  nodeId?: string;
  nodeType?: string;
  status: string;
  errorMessage?: string;
}

export interface FixRequestExecution {
  executionId: string;
  workflowId?: string;
  workflowName?: string;
  status: string;
  errorMessage?: string;
  steps?: FixRequestStep[];
  metadata?: Record<string, unknown>;
}

/**
 * Is there anything to ask about?
 *
 * Only a failed **workflow** run. A cloud function call records no steps
 * (WFA-002's Finding 2), so there is no step to name and no workflow definition
 * to propose against — offering the button there would be a door onto nothing.
 */
export function canRequestFix(execution: FixRequestExecution | null | undefined): boolean {
  if (!execution) return false;
  if (execution.status !== 'error') return false;
  return Boolean(execution.workflowId) && (execution.steps?.length ?? 0) > 0;
}

/** The first step that failed — what the request is actually about. */
export function failingStep(execution: FixRequestExecution): FixRequestStep | undefined {
  return (execution.steps || []).find((step) => step.status === 'error');
}

/**
 * The request, as text a user hands to whatever agent they are talking to.
 *
 * It carries everything the agent cannot guess and would otherwise ask for — the
 * backend id, the workflow id, the failing step and its message, the execution
 * id for cross-reference — and it names the exact tools, including `propose:
 * true`, so the answer comes back as a reviewable diff rather than as a silent
 * write to a running backend.
 */
export function buildFixRequest(execution: FixRequestExecution): string {
  const backendId = (execution.metadata?.backendId as string) || (execution.metadata?.sourceId as string) || '';
  const backendName = (execution.metadata?.sourceName as string) || backendId || 'the backend';
  const step = failingStep(execution);
  const name = execution.workflowName || execution.workflowId;

  const lines = [
    `The workflow "${name}" failed on ${backendName} and I need it fixed.`,
    '',
    `Backend id: ${backendId || '(unknown — call list_backends)'}`,
    `Workflow id: ${execution.workflowId}`,
    `Execution id: ${execution.executionId}`
  ];

  if (step) {
    lines.push(`Failing step: ${step.nodeId}${step.nodeType ? ` (${step.nodeType})` : ''}`);
    if (step.errorMessage) lines.push(`Step error: ${step.errorMessage}`);
  }
  if (execution.errorMessage) lines.push(`Run error: ${execution.errorMessage}`);

  lines.push(
    '',
    'Please:',
    '  1. read the current definition with get_backend_workflow, and the step vocabulary this',
    '     backend actually serves with list_backend_step_kinds;',
    '  2. work out why that step failed;',
    '  3. answer with update_backend_workflow using `propose: true`, REUSING the existing step ids',
    '     so I can read the diff as changes rather than as a replacement, and a short `note` saying',
    '     what you changed and why.',
    '',
    'Do not write to the backend directly. `propose: true` puts it on my canvas as a diff and nothing',
    'is saved until I accept it.'
  );

  return lines.join('\n');
}
