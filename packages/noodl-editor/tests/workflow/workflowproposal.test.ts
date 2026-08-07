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

/** The proposal: charge with a retry policy, and route its failure to a handler. */
const PROPOSED: WorkflowInput = {
  id: 'wf_orders',
  name: 'Order pipeline',
  entry: 'receive',
  concurrency: 1,
  steps: [
    { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
    {
      id: 'charge',
      kind: 'call-function',
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
    expect(charge.type).toBe('workflow.call-function');
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
    expect(workflow.steps[1].kind).toBe('call-function');
    expect(workflow.steps[1].onError).toEqual(['logfail']);
  });

  /**
   * CWF-005 — a proposal written against the OLD step vocabulary.
   *
   * A proposal comes off DISK, written by `noodl-mcp`. It never passes through
   * the backend read path that migrates, so an agent that still writes
   * `kind: "retry"` used to produce a review that drew a `workflow.retry` card
   * the node library no longer contains, and reported a `node-type-changed` for
   * a proposal the backend would migrate straight back — a semantic change
   * announced for a change that is not being made.
   *
   * `openWorkflowProposal` now diffs what the backend says it WOULD STORE
   * (`validateWorkflow(...).definition`), which is the same dry run it already
   * made. These specs pin the two halves of that: what the old form does, and
   * that the stored form is a no-op against a base that already migrated.
   */
  describe('a proposal in the pre-fold vocabulary', () => {
    /** What the backend answers the dry run with — see its own `preview` spec. */
    const WOULD_STORE: WorkflowDefinition = {
      ...BASE,
      steps: [
        { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
        { id: 'charge', kind: 'call-function', ref: 'chargeCard', params: { maxAttempts: 3 }, ui: { x: 340, y: 80 } }
      ]
    };

    /** The base, as the backend already holds it: migrated on read. */
    const MIGRATED_BASE: WorkflowDefinition = { ...WOULD_STORE };

    it('reports NOTHING for a proposal that only restates what is stored', () => {
      // The whole point. Diffing the submission instead reported a type change
      // from call-function to retry.
      expect(buildWorkflowChangeSet(MIGRATED_BASE, WOULD_STORE).changes.length).toBe(0);
    });

    it('draws the folded card, not a kind the node library no longer has', () => {
      // Built into a real ComponentModel, because the claim is about what the
      // review canvas RENDERS. `typename` is the name as authored; `type` on a
      // built node is the resolved library entry, which for an unregistered kind
      // is `UnknownNodeType` — i.e. exactly the red card this closes.
      const model = ComponentModel.fromJSON(
        buildReviewComponent(buildWorkflowChangeSet(MIGRATED_BASE, WOULD_STORE)) as TSFixme
      );
      const charge = model.graph.roots.find((n: TSFixme) => n.id === 'charge');
      expect(charge.typename).toBe('workflow.call-function');
      // And the policy the old kind carried is on the step it became, so the
      // review shows a retry that will actually happen.
      expect(charge.parameters.maxAttempts).toBe(3);
    });

    it('shows what the submitted form WOULD have done, so the fix is not mistaken for luck', () => {
      const submitted: WorkflowInput = {
        ...BASE,
        steps: [
          { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
          { id: 'charge', kind: 'retry' as 'call-function', ref: 'chargeCard', params: { maxAttempts: 3 }, ui: { x: 340, y: 80 } }
        ]
      };
      const changes = buildWorkflowChangeSet(MIGRATED_BASE, submitted).changes;
      expect(changes.some((c: TSFixme) => c.id === 'node-type-changed:charge')).toBe(true);
    });
  });
});
