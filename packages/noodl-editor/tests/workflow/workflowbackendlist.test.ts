/**
 * POL-015 — the first workflow on a backend could not be created.
 *
 * The Workflows panel derived the list of backends you may create a workflow on
 * from the workflows that already existed:
 *
 *   const backendId = newBackendId || workflows[0]?.backendId || '';
 *
 * With zero workflows all three sources are empty, so `''` reached
 * `WorkflowDocument.create` → `backend:workflow-step-kinds` → "Backend must be
 * running". Every other workflow path worked; only creation was broken, and only
 * for someone who had never made one — which is everyone, once.
 *
 * The list now comes from the running backends themselves. That is a property of
 * one pure reduction, so it is provable here.
 */
import { reduceWorkflowDefs, type BackendWorkflowDefs } from '../../src/editor/src/models/workflow/WorkflowBackendClient';

const RUNNING_EMPTY: BackendWorkflowDefs = {
  backendId: 'be_alpha',
  backendName: 'Alpha',
  workflows: []
};

const RUNNING_WITH_ONE: BackendWorkflowDefs = {
  backendId: 'be_beta',
  backendName: 'Beta',
  workflows: [{ id: 'wf_1', name: 'Nightly', steps: [{ id: 's1' }, { id: 's2' }] } as TSFixme]
};

const UNREACHABLE: BackendWorkflowDefs = {
  backendId: 'be_gamma',
  backendName: 'Gamma',
  workflows: [],
  error: 'connect ECONNREFUSED'
};

describe('POL-015 the backend list for creating a workflow', () => {
  it('lists a running backend that holds NO workflows', () => {
    const result = reduceWorkflowDefs([RUNNING_EMPTY]);
    expect(result.workflows.length).toBe(0);
    // The regression: this used to be empty, so there was nothing to create on.
    expect(result.backends).toEqual([{ id: 'be_alpha', name: 'Alpha', reachable: true }]);
    expect(result.backendCount).toBe(1);
  });

  it('offers BOTH backends when only one of them has workflows', () => {
    // The quieter half of the same bug: the picker rendered on `backends.length > 1`
    // against a list built from workflows, so a second, empty backend was invisible
    // and a workflow could only ever be created on the first.
    const result = reduceWorkflowDefs([RUNNING_WITH_ONE, RUNNING_EMPTY]);
    expect(result.backends.map((b) => b.id)).toEqual(['be_beta', 'be_alpha']);
    expect(result.workflows.length).toBe(1);
  });

  it('marks a running-but-unanswering backend unreachable, and still names it', () => {
    const result = reduceWorkflowDefs([RUNNING_EMPTY, UNREACHABLE]);
    expect(result.unreachable).toEqual(['Gamma']);
    expect(result.backends.find((b) => b.id === 'be_gamma')?.reachable).toBe(false);
    // It is offered to nobody, but the panel can still say why.
    expect(result.backends.filter((b) => b.reachable).map((b) => b.id)).toEqual(['be_alpha']);
  });

  it('reports no backends when none are running — which is a different thing from no workflows', () => {
    const result = reduceWorkflowDefs([]);
    expect(result.backends).toEqual([]);
    expect(result.backendCount).toBe(0);
  });

  it('keeps every workflow attributed to the backend it came from', () => {
    const result = reduceWorkflowDefs([RUNNING_WITH_ONE]);
    expect(result.workflows[0].backendId).toBe('be_beta');
    expect(result.workflows[0].backendName).toBe('Beta');
    expect(result.workflows[0].stepCount).toBe(2);
  });
});
