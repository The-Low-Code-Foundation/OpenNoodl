/**
 * BLD-001 — the intent is decided from the plan, and stated before it acts.
 *
 * These pin the classification boundary rather than the wording: which requests
 * take the fast single-component path, which stop for approval, and — the one
 * that is easy to get wrong and invisible on screen — that a backend never
 * takes the fast path, however small the plan around it is.
 */

import { classifyPlan, decideIntent, summarisePlan } from '@noodl-models/AiAssistant/thread';
import type { AuthoringPlan, PlanOperation } from '@noodl-models/AiAssistant/authoring';

function op(partial: Partial<PlanOperation> & Pick<PlanOperation, 'kind' | 'target'>): PlanOperation {
  return { id: partial.id ?? `op-${partial.target}`, intent: partial.intent ?? 'do the thing', ...partial };
}

function plan(operations: PlanOperation[]): AuthoringPlan {
  return { request: 'a request', operations };
}

describe('BLD-001 — classifyPlan', () => {
  it('routes one component operation to the fast path', () => {
    expect(classifyPlan(plan([op({ kind: 'create', target: 'Pages/Customers' })]))).toBe('component');
    expect(classifyPlan(plan([op({ kind: 'update', target: 'Pages/Cart' })]))).toBe('component');
  });

  it('routes anything that fans out to the plan', () => {
    expect(
      classifyPlan(plan([op({ kind: 'create', target: 'Pages/Cart' }), op({ kind: 'update', target: 'Pages/Home' })]))
    ).toBe('plan');
  });

  it('routes an all-document plan to the docs path', () => {
    expect(
      classifyPlan(plan([op({ kind: 'doc', target: 'docs/BRIEF.md' }), op({ kind: 'doc', target: 'docs/CONVENTIONS.md' })]))
    ).toBe('docs');
  });

  it('never fast-paths a provision, even beside a single component', () => {
    // A backend is a project-level side effect a person should read before
    // approving it — AIB-007's reason for putting it on the plan at all. One
    // component plus a database is not "one component".
    expect(
      classifyPlan(
        plan([
          op({ kind: 'provision', target: 'Puppy backend' }),
          op({ kind: 'create', target: 'Pages/Customers' })
        ])
      )
    ).toBe('plan');
    expect(classifyPlan(plan([op({ kind: 'provision', target: 'Puppy backend' })]))).toBe('plan');
  });

  it('treats a component beside a doc as a plan', () => {
    expect(
      classifyPlan(plan([op({ kind: 'create', target: 'Pages/Cart' }), op({ kind: 'doc', target: 'docs/BRIEF.md' })]))
    ).toBe('plan');
  });

  it('does not crash on an empty plan', () => {
    expect(classifyPlan(plan([]))).toBe('plan');
  });
});

describe('BLD-001 — decideIntent', () => {
  it('names the component it is about to build, and offers the plan', () => {
    const decision = decideIntent(plan([op({ kind: 'create', target: 'Pages/Customers' })]));
    expect(decision.intent).toBe('component');
    expect(decision.sentence).toContain('Pages/Customers');
    // The override exists exactly where the agent would otherwise act without
    // showing its work.
    expect(decision.override).toEqual({ intent: 'plan', label: 'Show me the plan first' });
  });

  it('distinguishes a revision from a build in the sentence', () => {
    const decision = decideIntent(plan([op({ kind: 'update', target: 'Pages/Cart' })]));
    expect(decision.sentence).toContain('revise');
    expect(decision.sentence).not.toContain('build this as one component');
  });

  it('counts what the plan actually contains, and offers no override beside a plan', () => {
    const decision = decideIntent(
      plan([
        op({ kind: 'create', target: 'Pages/Cart' }),
        op({ kind: 'update', target: 'Pages/Home' }),
        op({ kind: 'doc', target: 'docs/BRIEF.md' }),
        op({ kind: 'provision', target: 'Shop backend' })
      ])
    );
    expect(decision.intent).toBe('plan');
    expect(decision.sentence).toContain('2 components');
    expect(decision.sentence).toContain('1 document');
    expect(decision.sentence).toContain('a new backend');
    // The plan itself is on screen and prunable — a second "switch mode"
    // control beside it would be D1 with a new skin.
    expect(decision.override).toBeNull();
  });

  it('never interpolates a zero into the sentence', () => {
    // "this touches 2 components, 0 documents" is how a status line teaches
    // people to stop reading it.
    const decision = decideIntent(
      plan([op({ kind: 'create', target: 'Pages/Cart' }), op({ kind: 'create', target: 'Pages/Home' })])
    );
    expect(decision.sentence).not.toContain('0 ');
  });

  it('singularises', () => {
    const decision = decideIntent(
      plan([op({ kind: 'create', target: 'Pages/Cart' }), op({ kind: 'doc', target: 'docs/BRIEF.md' })])
    );
    expect(decision.sentence).toContain('1 component');
    expect(decision.sentence).not.toContain('1 components');
    expect(decision.sentence).toContain('1 document');
    expect(decision.sentence).not.toContain('1 documents');
  });

  it('names the documents it will draft', () => {
    const decision = decideIntent(plan([op({ kind: 'doc', target: 'docs/BRIEF.md' })]));
    expect(decision.intent).toBe('docs');
    expect(decision.sentence).toContain('docs/BRIEF.md');
  });
});

describe('BLD-001 — summarisePlan', () => {
  it('carries targets in authoring order and flags a provision', () => {
    const summary = summarisePlan(
      plan([op({ kind: 'provision', target: 'Shop backend' }), op({ kind: 'create', target: 'Pages/Cart' })])
    );
    expect(summary.operationCount).toBe(2);
    expect(summary.targets).toEqual(['Shop backend', 'Pages/Cart']);
    expect(summary.provisions).toBe(true);
  });
});
