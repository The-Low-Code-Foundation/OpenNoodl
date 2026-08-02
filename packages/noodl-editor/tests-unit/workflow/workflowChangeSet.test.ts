/**
 * WFA-007 — a workflow proposal as a reviewable change set, and what a partial
 * accept actually writes.
 *
 * This is the file that makes partial accept shippable. The task's §2 offers an
 * out — "ship accept-all only if the closures cannot be computed cheaply and
 * correctly" — and the reason it is not taken is that the closures are here,
 * derived from the engine's own validator, and asserted against the definitions
 * they produce rather than against the rules they were written from.
 *
 * Every "invalid" case below is a real refusal from `validateWorkflowDefinition`:
 * a dangling edge target, an entry that names no step, a `$path` that references
 * a step that is not there. The point of a closure is that a reader cannot
 * assemble one of those by excluding things.
 *
 * Runs in plain Node (tests-unit/), which is only possible because the modules
 * under test import nothing from the editor but `@noodl-versioning`. If someone
 * later reaches for a canvas symbol in there, this suite stops running — which
 * is the boundary doing its job rather than an inconvenience.
 */
import {
  buildWorkflowChangeSet,
  materializeWorkflowSelection,
  upstreamReferences
} from '../../src/editor/src/models/workflow/workflowChangeSet';
import { edgesOf, workflowToSnapshot } from '../../src/editor/src/models/workflow/workflowGraphSnapshot';

import type { WorkflowDefinition, WorkflowInput, WorkflowStep } from '../../src/editor/src/models/workflow/types';

function definition(steps: WorkflowStep[], overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    version: 1,
    id: 'wf_orders',
    name: 'Order pipeline',
    entry: steps[0]?.id ?? '',
    concurrency: 1,
    steps,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function input(steps: WorkflowStep[], overrides: Partial<WorkflowInput> = {}): WorkflowInput {
  return { id: 'wf_orders', name: 'Order pipeline', entry: steps[0]?.id ?? '', concurrency: 1, steps, ...overrides };
}

/** The base every "update" case below starts from: receive → charge. */
const BASE = definition([
  { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
  { id: 'charge', kind: 'call-function', ref: 'chargeCard', ui: { x: 340, y: 80 } }
]);

/** Change ids for one change kind, so a spec can name what it excludes. */
function idsOfKind(changeSet: ReturnType<typeof buildWorkflowChangeSet>, kind: string, anchor?: string): string[] {
  return changeSet.changes
    .filter((entry) => entry.change.kind === kind)
    .filter((entry) => {
      if (!anchor) return true;
      const change = entry.change as { node?: { id: string }; connection?: { toId: string; fromId: string } };
      return change.node?.id === anchor || change.connection?.toId === anchor || change.connection?.fromId === anchor;
    })
    .map((entry) => entry.id);
}

describe('WFA-007 — a definition as a graph', () => {
  it('uses step ids as node ids, with no mapping table', () => {
    const snapshot = workflowToSnapshot(BASE);
    expect([...snapshot.nodes.keys()].sort()).toEqual(['charge', 'receive']);
    // The identity WFA-002's execution overlay keys on. A diff entry's canvas
    // anchor is a node id, and it has to be a step id or the walkthrough
    // centres on nothing.
    expect(snapshot.nodes.get('receive')!.type).toBe('workflow.call-function');
  });

  it('carries the workflow name prefix, which is what keeps its events off the viewer', () => {
    // `ViewerConnection.isWorkflowModelEvent` filters on this prefix. A review
    // component named anything else pushes model events at the viewer naming a
    // component it has never heard of — F44/F49's failure, one surface further
    // out.
    expect(workflowToSnapshot(BASE).name).toBe('/#__workflow__/wf_orders');
  });

  it('turns every edge kind into a wire from the right port', () => {
    const branched = definition([
      { id: 'decide', kind: 'branch', params: { condition: { left: 1, op: 'gt', right: 0 } }, routes: { ontrue: ['paid'], onfalse: ['refund'] } },
      { id: 'paid', kind: 'call-function', ref: 'markPaid', onError: ['refund'] },
      { id: 'refund', kind: 'call-function', ref: 'refundOrder' }
    ]);
    expect(edgesOf(branched.steps)).toEqual([
      { fromId: 'decide', fromProperty: 'route:ontrue', toId: 'paid' },
      { fromId: 'decide', fromProperty: 'route:onfalse', toId: 'refund' },
      { fromId: 'paid', fromProperty: 'onError', toId: 'refund' }
    ]);
  });

  it('lays out a step that has no stored position, so an agent’s proposal is readable', () => {
    // An agent has no idea where anything goes and never sends `ui`. WFA-004 §5:
    // the layout is deterministic, so a proposal reads as a graph rather than as
    // a pile at the origin — and reopening it produces the same picture.
    const unlaid = input([
      { id: 'a', kind: 'stop' },
      { id: 'b', kind: 'stop' }
    ]);
    const first = workflowToSnapshot(unlaid);
    const second = workflowToSnapshot(unlaid);
    const positions = [...first.nodes.values()].map((n) => `${n.x},${n.y}`);
    expect(new Set(positions).size).toBe(2);
    expect([...second.nodes.values()].map((n) => `${n.x},${n.y}`)).toEqual(positions);
  });
});

describe('WFA-007 — what the reviewer is shown', () => {
  it('a creation is every step added, against an empty base', () => {
    const changeSet = buildWorkflowChangeSet(null, input(BASE.steps));
    expect(changeSet.isNewComponent).toBe(true);
    expect(idsOfKind(changeSet, 'node-added').length).toBe(2);
    expect(idsOfKind(changeSet, 'connection-added').length).toBe(1);
  });

  it('an update reads as changes, not as a replacement', () => {
    const changeSet = buildWorkflowChangeSet(
      BASE,
      input([
        { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
        { id: 'charge', kind: 'retry', ref: 'chargeCard', params: { maxAttempts: 3 }, ui: { x: 340, y: 80 } }
      ])
    );
    // The whole point of §5's id-keeping: one step changed, nothing removed and
    // nothing added.
    expect(idsOfKind(changeSet, 'node-removed')).toEqual([]);
    expect(idsOfKind(changeSet, 'node-added')).toEqual([]);
    expect(idsOfKind(changeSet, 'node-type-changed', 'charge').length).toBe(1);
    expect(idsOfKind(changeSet, 'node-parameters-changed', 'charge').length).toBe(1);
  });

  it('files a moved step as cosmetic, so a re-layout is not presented as change', () => {
    const changeSet = buildWorkflowChangeSet(
      BASE,
      input([
        { ...BASE.steps[0], ui: { x: 500, y: 500 } },
        BASE.steps[1]
      ])
    );
    const moved = changeSet.changes.filter((c) => c.change.kind === 'node-moved');
    expect(moved.length).toBe(1);
    expect(moved[0].change.category).toBe('cosmetic');
  });

  it('files the workflow-level fields as component metadata, which review refuses to exclude', () => {
    const changeSet = buildWorkflowChangeSet(BASE, input(BASE.steps, { entry: 'charge', concurrency: 4 }));
    const paths = changeSet.changes
      .filter((c) => c.change.kind === 'component-metadata-changed')
      .map((c) => (c.change as { path: string }).path)
      .sort();
    // `isExcludable` in ChangeReviewDocument returns false for these: they are
    // the proposal's identity and come with it or not at all.
    //
    // The path is DOTTED AND ROOTED — `metadata.entry`, not `entry`. Reading it
    // raw made every accepted entry/concurrency/timeout change silently do
    // nothing, which is the defect this assertion exists to pin.
    expect(paths).toEqual(['metadata.concurrency', 'metadata.entry']);
  });
});

describe('WFA-007 — the dependency closures', () => {
  /** Adds a `notify` step wired from `charge`. */
  const withNotify = input([
    ...BASE.steps,
    { id: 'notify', kind: 'call-function', ref: 'sendReceipt', ui: { x: 600, y: 80 } }
  ]).steps;

  it('rejecting an added step also rejects the edge into it — no dangling target', () => {
    const target = input([
      BASE.steps[0],
      { ...BASE.steps[1], next: ['notify'] },
      withNotify[2]
    ]);
    const changeSet = buildWorkflowChangeSet(BASE, target);
    const addNotify = idsOfKind(changeSet, 'node-added', 'notify');
    expect(addNotify.length).toBe(1);

    const { workflow, rejected } = materializeWorkflowSelection(changeSet, addNotify);
    // The edge went with it.
    expect(rejected.size).toBeGreaterThan(1);
    expect(workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge']);
    // `next: ["notify"]` would be *step "charge": next target "notify" does not
    // exist* — a 400, and the definition an inherited-closure implementation
    // produces.
    expect(workflow.steps.find((s) => s.id === 'charge')!.next).toBeUndefined();
  });

  it('rejecting the step an upstream.<id> reference names also rejects the step that reads it', () => {
    // The rule with NO component analogue. `receipt` reads `upstream.notify`,
    // so keeping `receipt` while dropping `notify` is *"$path references step
    // notify, which is not a step in this workflow"*.
    const target = input([
      BASE.steps[0],
      { ...BASE.steps[1], next: ['notify'] },
      { id: 'notify', kind: 'call-function', ref: 'sendReceipt', next: ['receipt'] },
      {
        id: 'receipt',
        kind: 'call-function',
        ref: 'archive',
        params: { messageId: { $path: 'upstream.notify.result.id' } }
      }
    ]);
    const changeSet = buildWorkflowChangeSet(BASE, target);

    const { workflow } = materializeWorkflowSelection(changeSet, idsOfKind(changeSet, 'node-added', 'notify'));
    const ids = workflow.steps.map((s) => s.id);
    expect(ids).not.toContain('notify');
    expect(ids).not.toContain('receipt');
  });

  it('sees a reference nested inside a condition, not just a top-level param', () => {
    expect(
      upstreamReferences({
        id: 'x',
        kind: 'branch',
        params: { condition: { all: [{ left: { $path: 'upstream.charge.result.total' }, op: 'gt', right: 0 }] } }
      })
    ).toEqual(['charge']);
  });

  it('does not follow a $path that is escaped by $literal', () => {
    // `$literal` means "this is data" — a `$path` under it is a string somebody
    // wants passed through, not a reference. Treating it as one would make a
    // legitimate proposal un-acceptable.
    expect(
      upstreamReferences({
        id: 'x',
        kind: 'call-function',
        ref: 'f',
        params: { template: { $literal: { $path: 'upstream.notThere.value' } } }
      })
    ).toEqual([]);
  });

  it('rejecting a removal keeps the step, and the wires that survive with it', () => {
    const target = input([BASE.steps[0]], { entry: 'receive' });
    const changeSet = buildWorkflowChangeSet(BASE, target);

    const { workflow } = materializeWorkflowSelection(changeSet, idsOfKind(changeSet, 'node-removed', 'charge'));
    // Keeping the step means keeping the wire into it, or `charge` would be
    // stranded — the removal of the edge is required by the removal of the node.
    expect(workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge']);
    expect(workflow.steps[0].next).toEqual(['charge']);
  });
});

describe('WFA-007 — what an accept writes', () => {
  it('accepting everything reproduces the candidate', () => {
    const target = input([
      { id: 'receive', kind: 'call-function', ref: 'saveOrder', next: ['charge'], ui: { x: 80, y: 80 } },
      { id: 'charge', kind: 'retry', ref: 'chargeCard', params: { maxAttempts: 3 }, onError: ['logfail'], ui: { x: 340, y: 80 } },
      { id: 'logfail', kind: 'call-function', ref: 'logFailure', ui: { x: 600, y: 200 } }
    ]);
    const { workflow } = materializeWorkflowSelection(buildWorkflowChangeSet(BASE, target), []);

    expect(workflow.entry).toBe('receive');
    expect(workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge', 'logfail']);
    expect(workflow.steps[1]).toMatchObject({ kind: 'retry', ref: 'chargeCard', params: { maxAttempts: 3 } });
    expect(workflow.steps[1].onError).toEqual(['logfail']);
    // Positions survive — an accept must not re-lay-out what it accepted.
    expect(workflow.steps[2].ui).toEqual({ x: 600, y: 200 });
  });

  it('rejecting everything writes the base back, which is what rejecting means', () => {
    const target = input([{ id: 'only', kind: 'stop' }], { entry: 'only', name: 'Rewritten' });
    const changeSet = buildWorkflowChangeSet(BASE, target);
    const { workflow } = materializeWorkflowSelection(
      changeSet,
      changeSet.changes.map((c) => c.id)
    );
    expect(workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge']);
    expect(workflow.entry).toBe('receive');
    expect(workflow.steps[0].next).toEqual(['charge']);
  });

  it('repairs an entry the reader orphaned, the way deleting a step on the canvas does', () => {
    // The proposal moves the entry onto a step it also adds. Reject the add and
    // the entry names nothing — `entry "notify" must name one of the steps`.
    const target = input(
      [...BASE.steps, { id: 'notify', kind: 'call-function', ref: 'sendReceipt' }],
      { entry: 'notify' }
    );
    const changeSet = buildWorkflowChangeSet(BASE, target);

    const { workflow } = materializeWorkflowSelection(changeSet, idsOfKind(changeSet, 'node-added', 'notify'));
    expect(workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge']);
    // Falls back to what it was, because that step survived.
    expect(workflow.entry).toBe('receive');
  });

  it('falls back to the first unwired step when even the old entry is gone', () => {
    const target = input([{ id: 'charge', kind: 'call-function', ref: 'chargeCard' }], { entry: 'charge' });
    const { workflow } = materializeWorkflowSelection(buildWorkflowChangeSet(BASE, target), []);
    expect(workflow.steps.map((s) => s.id)).toEqual(['charge']);
    expect(workflow.entry).toBe('charge');
  });

  it('keeps unchanged steps in their original order, so the next diff is about change', () => {
    const target = input([
      { id: 'newfirst', kind: 'stop' },
      ...BASE.steps
    ], { entry: 'receive' });
    const { workflow } = materializeWorkflowSelection(buildWorkflowChangeSet(BASE, target), []);
    // Base order first, additions after — a step that did not change must not
    // move, or every subsequent review reads as churn.
    expect(workflow.steps.map((s) => s.id)).toEqual(['receive', 'charge', 'newfirst']);
  });

  it('a partial accept of one param change leaves the rest of the proposal out', () => {
    const target = input([
      { ...BASE.steps[0], name: 'Receive the order' },
      { ...BASE.steps[1], params: { timeoutMs: 5000 } }
    ]);
    const changeSet = buildWorkflowChangeSet(BASE, target);

    const { workflow } = materializeWorkflowSelection(changeSet, idsOfKind(changeSet, 'node-renamed', 'receive'));
    expect(workflow.steps[0].name).toBeUndefined();
    expect(workflow.steps[1].params).toEqual({ timeoutMs: 5000 });
  });
});
