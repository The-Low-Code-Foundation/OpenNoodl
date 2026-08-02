/**
 * WFA-007 §6 — what the fix request actually says.
 *
 * The button is one click; the value is entirely in the text. It has to carry
 * what an agent cannot guess (which backend, which workflow, which step, what
 * the error was) and it has to ask for the answer as a PROPOSAL — because an
 * agent told "fix this workflow" with no further instruction will call
 * `update_backend_workflow` and write it, which is the exact behaviour this
 * whole task exists to give an alternative to.
 *
 * Also asserts where the button does NOT appear. A cloud function call records
 * no steps at all (WFA-002 Finding 2), so offering it there would be a door onto
 * nothing.
 */
import {
  buildFixRequest,
  canRequestFix,
  failingStep,
  type FixRequestExecution
} from '../../src/editor/src/views/panels/ExecutionHistoryPanel/components/ExecutionDetail/fixRequest';

const FAILED: FixRequestExecution = {
  executionId: 'exec_9f21',
  workflowId: 'wf_orders',
  workflowName: 'Order pipeline',
  status: 'error',
  errorMessage: 'Workflow run failed at step "charge"',
  metadata: { backendId: 'backend_abc', sourceName: 'SQLite backend' },
  steps: [
    { nodeId: 'receive', nodeType: 'function:saveOrder', status: 'success' },
    { nodeId: 'charge', nodeType: 'retry:chargeCard', status: 'error', errorMessage: 'chargeCard returned 502' },
    { nodeId: 'logfail', nodeType: 'function:logFailure', status: 'skipped' }
  ]
};

describe('WFA-007 — when a fix can be asked for', () => {
  it('offers it on a failed workflow run', () => {
    expect(canRequestFix(FAILED)).toBe(true);
  });

  it('does not offer it on a run that succeeded', () => {
    expect(canRequestFix({ ...FAILED, status: 'success' })).toBe(false);
  });

  it('does not offer it on a cloud function call, which records no steps', () => {
    // WFA-002 Finding 2: `ExecutionLogger.startNode` is called from exactly one
    // place, the workflow engine. A function call has `steps: 0`, so there is
    // no failing step to name and no definition to propose against.
    expect(canRequestFix({ ...FAILED, steps: [] })).toBe(false);
  });

  it('does not offer it for a record with no workflow id', () => {
    expect(canRequestFix({ ...FAILED, workflowId: undefined })).toBe(false);
    expect(canRequestFix(null)).toBe(false);
  });

  it('names the FIRST failure, not the last step', () => {
    expect(failingStep(FAILED)!.nodeId).toBe('charge');
  });
});

describe('WFA-007 — what the request carries', () => {
  const request = buildFixRequest(FAILED);

  it('carries what an agent cannot guess', () => {
    expect(request).toContain('Backend id: backend_abc');
    expect(request).toContain('Workflow id: wf_orders');
    expect(request).toContain('Execution id: exec_9f21');
    expect(request).toContain('Failing step: charge (retry:chargeCard)');
    expect(request).toContain('chargeCard returned 502');
  });

  it('asks for a PROPOSAL, and says not to write', () => {
    // Without this, an agent asked to fix a workflow writes it. The whole loop
    // this task builds depends on the request naming `propose: true`.
    expect(request).toContain('propose: true');
    expect(request).toContain('Do not write to the backend directly');
    expect(request).toContain('update_backend_workflow');
  });

  it('asks it to look before it authors, and to keep the ids', () => {
    expect(request).toContain('list_backend_step_kinds');
    expect(request).toContain('get_backend_workflow');
    // §5: a re-numbered proposal reviews as a wholesale replacement.
    expect(request).toMatch(/REUSING the existing step ids/);
  });

  it('says the backend is unknown rather than inventing one', () => {
    const noBackend = buildFixRequest({ ...FAILED, metadata: {} });
    expect(noBackend).toContain('(unknown — call list_backends)');
  });
});
