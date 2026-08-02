/**
 * WFA-007 — the review canvas can draw a workflow proposal.
 *
 * The *logic* of the change set, the closures and the materializer is covered
 * in plain Node (`tests-unit/workflow/workflowChangeSet.test.ts`), because it
 * imports nothing from the editor. What is left, and what needs a renderer, is
 * the claim the assessment's §1 actually makes:
 *
 *   **AIX-003's annotated review component accepts a workflow change set and
 *   produces something `ComponentModel.fromJSON` will build.**
 *
 * That is the reuse decision, and it is only true if `buildReviewComponent` —
 * written for components, never touched for this — annotates a workflow diff
 * the same way. If it did not, the reuse-or-escalate rule would have been
 * decided the other way, so it is asserted rather than assumed.
 *
 * Jasmine, not Jest — the editor's suite runs inside a real Electron renderer.
 */

import { ComponentModel } from '../../src/editor/src/models/componentmodel';
import { buildReviewComponent } from '../../src/editor/src/models/AiAssistant/authoring/reviewComponent';
import {
  buildWorkflowChangeSet,
  materializeWorkflowSelection
} from '../../src/editor/src/models/workflow/workflowChangeSet';
import { getComponentModelRuntimeType } from '../../src/editor/src/utils/NodeGraph';
import { RuntimeType } from '../../src/editor/src/models/nodelibrary/NodeLibraryData';

import type { WorkflowDefinition, WorkflowInput } from '../../src/editor/src/models/workflow/types';

const BASE: WorkflowDefinition = {
  version: 1,
  id: 'wf_orders',
  name: 'Order pipeline',
  entry: 'receive',
  concurrency: 1,
  steps: [
    { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
    { id: 'charge', kind: 'call-function', ref: 'chargeCard', ui: { x: 340, y: 80 } }
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

/** The proposal: retry the charge, and route its failure to a handler. */
const PROPOSED: WorkflowInput = {
  id: 'wf_orders',
  name: 'Order pipeline',
  entry: 'receive',
  concurrency: 1,
  steps: [
    { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
    {
      id: 'charge',
      kind: 'retry',
      ref: 'chargeCard',
      params: { maxAttempts: 3 },
      onError: ['logfail'],
      ui: { x: 340, y: 80 }
    },
    { id: 'logfail', kind: 'call-function', ref: 'logFailure', ui: { x: 600, y: 220 } }
  ]
};

interface ReviewNode {
  id: string;
  type: string;
  annotation?: string;
  diffData?: { parent: unknown };
  children?: ReviewNode[];
}

function reviewGraph(): { roots: ReviewNode[]; connections: { annotation?: string; toId: string }[] } {
  const legacy = buildReviewComponent(buildWorkflowChangeSet(BASE, PROPOSED));
  return legacy.graph as { roots: ReviewNode[]; connections: { annotation?: string; toId: string }[] };
}

describe('WFA-007 — AIX-003’s review component takes a workflow', () => {
  it('annotates an added step as Created and a changed one as Changed', () => {
    const graph = reviewGraph();
    const byId = new Map(graph.roots.map((n) => [n.id, n]));

    expect(byId.get('logfail').annotation).toBe('Created');
    expect(byId.get('charge').annotation).toBe('Changed');
    // An untouched step carries no annotation at all — it is context, not change.
    expect(byId.get('receive').annotation).toBeUndefined();
  });

  it('carries the base step as parameter detail for a changed one', () => {
    // `diffData.parent` is what the diff canvas offers as before/after detail.
    // Without it a changed step is a coloured card that will not say what
    // changed, which is the "accepted blind" failure one surface further in.
    const charge = reviewGraph().roots.find((n) => n.id === 'charge');
    expect(charge.diffData).toBeDefined();
    expect((charge.diffData.parent as { type: string }).type).toBe('workflow.call-function');
    expect(charge.type).toBe('workflow.retry');
  });

  it('annotates the added error edge', () => {
    const added = reviewGraph().connections.filter((c) => c.annotation === 'Created');
    expect(added.length).toBe(1);
    expect(added[0].toId).toBe('logfail');
  });

  it('produces something ComponentModel.fromJSON builds, on the workflow runtime', () => {
    // The two facts the read-only canvas needs: it is a component it can bind,
    // and its runtime type resolves to Workflow — which it does by NAME PREFIX,
    // and which is also what keeps this graph's model events away from the
    // viewer (`ViewerConnection.isWorkflowModelEvent`). A review component
    // without the prefix would leak them; F44/F49's class, one surface out.
    const model = ComponentModel.fromJSON(buildReviewComponent(buildWorkflowChangeSet(BASE, PROPOSED)) as TSFixme);
    expect(model.name).toBe('/#__workflow__/wf_orders');
    expect(getComponentModelRuntimeType(model)).toBe(RuntimeType.Workflow);
    expect(model.graph.roots.length).toBe(3);
  });

  it('draws a creation as a graph with no before side', () => {
    const model = ComponentModel.fromJSON(
      buildReviewComponent(buildWorkflowChangeSet(null, PROPOSED)) as TSFixme
    );
    expect(model.graph.roots.length).toBe(3);
    for (const node of model.graph.roots) expect(node.annotation).toBe('Created');
  });

  it('an accept of everything writes the proposal the reviewer saw', () => {
    const changeSet = buildWorkflowChangeSet(BASE, PROPOSED);
    const { workflow } = materializeWorkflowSelection(changeSet, []);
    expect(workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge', 'logfail']);
    expect(workflow.steps[1].kind).toBe('retry');
    expect(workflow.steps[1].onError).toEqual(['logfail']);
  });
});
