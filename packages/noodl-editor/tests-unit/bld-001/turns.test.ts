/**
 * BLD-001 — three producers, one thread.
 *
 * The mapping is exactly the part where a mistake is invisible on screen: a
 * turn attributed to the wrong request, or a staged candidate hung off a round
 * that did not produce it, both render as a perfectly ordinary feed. So these
 * pin attribution, not appearance.
 */

import {
  acceptedTurn,
  componentTurns,
  composeThread,
  docsTurns,
  freezeTurns,
  planTurns,
  sessionNote
} from '@noodl-models/AiAssistant/thread';
import type { Turn } from '@noodl-models/AiAssistant/thread';
import type {
  AuthoringActivity,
  AuthoringSessionState,
  PlanOperationState,
  PlanRunState,
  PlanSession
} from '@noodl-models/AiAssistant/authoring';
import type { ProjectReviewState } from '@noodl-models/AiAssistant/review';

function sessionState(partial: Partial<AuthoringSessionState> = {}): AuthoringSessionState {
  return {
    busy: false,
    phase: 'idle',
    activities: [],
    legacyName: '/Pages/Customers',
    mode: 'create',
    stagedRevision: 0,
    ...partial
  };
}

const USER = (text: string): AuthoringActivity => ({ kind: 'user', text });
const PROSE = (text: string): AuthoringActivity => ({ kind: 'assistant', text });
const TOOL = (label: string): AuthoringActivity => ({ kind: 'tool', label });

describe('BLD-001 — componentTurns', () => {
  it('opens a turn at each user activity and gives it everything that followed', () => {
    const turns = componentTurns(
      sessionState({
        phase: 'staged',
        staged: { nodeCount: 7, connectionCount: 4 },
        activities: [
          USER('a customers page'),
          TOOL('Read node documentation: Group'),
          PROSE('Building it now'),
          USER('add a search field'),
          PROSE('Adding the field')
        ]
      })
    );

    expect(turns).toHaveLength(2);
    expect(turns[0].request).toBe('a customers page');
    expect(turns[0].activities).toHaveLength(2);
    expect(turns[1].request).toBe('add a search field');
    expect(turns[1].activities).toHaveLength(1);
    // The user's sentence opens the turn; it is never also an activity inside
    // it, or the thread renders it twice.
    for (const turn of turns) {
      expect(turn.activities.some((a) => (a as { kind: string }).kind === 'user')).toBe(false);
    }
  });

  it('hangs a staged candidate on the LAST turn, not the one that made it', () => {
    // `state.staged` outlives a failed refinement — attributing it to the round
    // that produced it would put a live Accept halfway up a scrolled thread
    // with a newer failed round below it.
    const turns = componentTurns(
      sessionState({
        phase: 'exhausted',
        staged: { nodeCount: 7, connectionCount: 4 },
        activities: [USER('a customers page'), PROSE('done'), USER('make it purple'), PROSE('could not')]
      })
    );

    expect(turns[0].outcome).toBeUndefined();
    expect(turns[1].outcome).toEqual({
      kind: 'staged-component',
      legacyName: '/Pages/Customers',
      mode: 'create',
      nodeCount: 7,
      connectionCount: 4
    });
  });

  it('marks only the last turn busy, and gives a busy turn no outcome', () => {
    const turns = componentTurns(
      sessionState({ busy: true, phase: 'working', activities: [USER('one'), USER('two'), PROSE('…')] })
    );
    expect(turns[0].busy).toBeUndefined();
    expect(turns[1].busy).toBe(true);
    expect(turns[1].outcome).toBeUndefined();
  });

  it('carries an error phase through as a danger note', () => {
    const turns = componentTurns(
      sessionState({ phase: 'error', error: 'The provider refused.', activities: [USER('one')] })
    );
    expect(turns[0].outcome).toEqual({ kind: 'note', tone: 'danger', text: 'The provider refused.' });
  });

  it('returns nothing for no session', () => {
    expect(componentTurns(null)).toEqual([]);
  });

  it('keeps prose that arrived before any request rather than dropping it', () => {
    const turns = componentTurns(sessionState({ activities: [PROSE('orphaned')] }));
    expect(turns).toHaveLength(1);
    expect(turns[0].request).toBeUndefined();
    expect(turns[0].activities).toHaveLength(1);
  });

  it("states the agent's intent on the first turn only, ahead of the session's own prose", () => {
    const turns = componentTurns(
      sessionState({ activities: [USER('a customers page'), PROSE('building'), USER('again'), PROSE('ok')] }),
      { sentence: "I'll build this as one component — Pages/Customers.", intent: 'component' }
    );
    expect(turns[0].intent).toBe('component');
    expect(turns[0].activities[0]).toEqual({
      kind: 'assistant',
      text: "I'll build this as one component — Pages/Customers."
    });
    // A refinement is not a fresh decision about the request.
    expect(turns[1].intent).toBeUndefined();
    expect(turns[1].activities[0]).toEqual({ kind: 'assistant', text: 'ok' });
  });

  it('namespaces ids so two producers in one thread cannot collide', () => {
    const a = componentTurns(sessionState({ activities: [USER('one')] }), { idPrefix: 'first' });
    const b = componentTurns(sessionState({ activities: [USER('one')] }), { idPrefix: 'second' });
    expect(a[0].id).not.toBe(b[0].id);
  });
});

describe('BLD-001 — sessionNote', () => {
  it('says nothing for a staged phase — the outcome card says it better', () => {
    expect(sessionNote(sessionState({ phase: 'staged' }))).toBeUndefined();
  });

  it('distinguishes a cancel that kept a candidate from one that did not', () => {
    const kept = sessionNote(sessionState({ phase: 'cancelled', staged: { nodeCount: 1, connectionCount: 0 } }));
    const lost = sessionNote(sessionState({ phase: 'cancelled' }));
    expect(kept).not.toEqual(lost);
    expect((kept as { text: string }).text).toContain('untouched');
    expect((lost as { text: string }).text).toContain('Nothing was written');
  });
});

// ── Plan ──────────────────────────────────────────────────────────────────────

function planSession(partial: Partial<PlanSession> = {}): PlanSession {
  return {
    description: '',
    plan: null,
    note: null,
    excluded: new Set(),
    applied: null,
    applyFailure: null,
    run: null,
    origin: null,
    announcementDismissed: false,
    ...partial
  };
}

function operationState(
  target: string,
  status: PlanOperationState['status'],
  extra: Partial<PlanOperationState> = {}
): PlanOperationState {
  return {
    operation: { id: `op-${target}`, kind: 'create', target, intent: 'build it' },
    status,
    ...extra
  };
}

function runState(partial: Partial<PlanRunState> = {}): PlanRunState {
  return { busy: false, phase: 'done', operations: [], costUsd: null, ...partial };
}

describe('BLD-001 — planTurns', () => {
  const twoOps = {
    request: 'wire checkout in',
    operations: [
      { id: 'op-1', kind: 'create' as const, target: 'Pages/Checkout', intent: 'the page' },
      { id: 'op-2', kind: 'update' as const, target: 'Pages/Cart', intent: 'link to it' }
    ]
  };

  it('offers the plan for approval while no run exists', () => {
    const turns = planTurns(planSession({ plan: twoOps }), null, { sentence: 'This touches 2 components.' });
    expect(turns).toHaveLength(1);
    expect(turns[0].request).toBe('wire checkout in');
    expect(turns[0].intent).toBe('plan');
    expect(turns[0].activities[0]).toEqual({ kind: 'assistant', text: 'This touches 2 components.' });
    expect(turns[0].outcome).toEqual({
      kind: 'plan',
      plan: { operationCount: 2, targets: ['Pages/Checkout', 'Pages/Cart'], provisions: false }
    });
  });

  it('withdraws the plan decision once the run has started', () => {
    // Re-offering Approve beside a running build is exactly the duplicated
    // control this phase is measured on.
    const turns = planTurns(planSession({ plan: twoOps }), runState({ busy: true, phase: 'running' }));
    expect(turns[0].outcome).toBeUndefined();
    expect(turns[1].busy).toBe(true);
  });

  it('records only what finished, never what is pending or in flight', () => {
    const turns = planTurns(
      planSession({ plan: twoOps }),
      runState({
        operations: [
          operationState('Pages/Checkout', 'staged'),
          operationState('Pages/Cart', 'authoring'),
          operationState('Pages/Home', 'pending')
        ]
      })
    );
    const labels = turns[1].activities.map((a) => (a as { label?: string }).label);
    expect(labels).toEqual(['Built Pages/Checkout']);
  });

  it('distinguishes a skip the agent chose from a skip a Stop caused', () => {
    const turns = planTurns(
      planSession({ plan: twoOps }),
      runState({
        operations: [
          operationState('docs/BRIEF.md', 'skipped'),
          operationState('docs/CONVENTIONS.md', 'skipped', { skippedByCancel: true })
        ]
      })
    );
    const labels = turns[1].activities.map((a) => (a as { label?: string }).label);
    expect(labels[0]).toBe('Skipped docs/BRIEF.md');
    expect(labels[1]).toContain('the run was stopped');
  });

  it('appends the applied receipt, with the backend named', () => {
    const turns = planTurns(
      planSession({
        plan: twoOps,
        applied: {
          count: 2,
          docs: ['docs/BRIEF.md'],
          backend: { name: 'Shop', endpoint: 'http://localhost:8577', collections: [], warnings: [] }
        }
      }),
      runState()
    );
    expect(turns[turns.length - 1].outcome).toEqual({
      kind: 'plan-applied',
      componentCount: 2,
      docs: ['docs/BRIEF.md'],
      backendName: 'Shop'
    });
  });

  it('reports an apply failure as a danger note naming the operation', () => {
    const turns = planTurns(
      planSession({ plan: twoOps, applyFailure: { id: 'op-2', target: 'Pages/Cart', reason: 'it moved' } }),
      runState()
    );
    const outcome = turns[turns.length - 1].outcome as { kind: string; text: string };
    expect(outcome.kind).toBe('note');
    expect(outcome.text).toContain('Pages/Cart');
    expect(outcome.text).toContain('it moved');
  });

  it('produces nothing for an empty session', () => {
    expect(planTurns(planSession(), null)).toEqual([]);
  });
});

// ── Docs ──────────────────────────────────────────────────────────────────────

function reviewState(partial: Partial<ProjectReviewState> = {}): ProjectReviewState {
  return { phase: 'done', busy: false, drafts: [], costUsd: null, ...partial };
}

const draft = (path: string, status: string) =>
  ({ kind: 'brief', path, status, baseline: null, todoCount: 0, lintFindings: [], costUsd: null, turns: 1 } as never);

describe('BLD-001 — docsTurns', () => {
  it('says nothing before the run has started', () => {
    expect(docsTurns(null)).toEqual([]);
    expect(docsTurns(reviewState({ phase: 'idle' }))).toEqual([]);
  });

  it('counts what was drafted, declined and failed separately', () => {
    const turns = docsTurns(
      reviewState({
        drafts: [
          draft('docs/BRIEF.md', 'authored'),
          draft('docs/ARCHITECTURE.md', 'declined'),
          draft('docs/CONVENTIONS.md', 'error')
        ]
      })
    );
    expect(turns[0].outcome).toEqual({ kind: 'docs-drafts', authored: 1, declined: 1, errors: 1 });
  });

  it('leaves a pending draft out of the record', () => {
    const turns = docsTurns(reviewState({ busy: true, phase: 'drafting', drafts: [draft('docs/BRIEF.md', 'pending')] }));
    expect(turns[0].activities).toHaveLength(0);
    expect(turns[0].busy).toBe(true);
  });
});

// ── The thread ────────────────────────────────────────────────────────────────

describe('BLD-001 — composeThread', () => {
  const busyTurn = (id: string): Turn => ({ id, activities: [], busy: true });

  it('keeps order and lets at most one turn claim to be running', () => {
    // Two producers can legitimately be live at once — a plan run finishing as
    // a docs pass starts — but a thread showing two live turns is claiming two
    // things are being built.
    const thread = composeThread([busyTurn('a')], [busyTurn('b')]);
    expect(thread.map((t) => t.id)).toEqual(['a', 'b']);
    expect(thread[0].busy).toBe(false);
    expect(thread[1].busy).toBe(true);
  });

  it('does not mutate the turns it was given', () => {
    const original = busyTurn('a');
    composeThread([original], [busyTurn('b')]);
    expect(original.busy).toBe(true);
  });
});

describe('BLD-001 — history', () => {
  it('freezes a busy turn so a frozen thread grows no second spinner', () => {
    const frozen = freezeTurns([{ id: 'a', activities: [], busy: true }]);
    expect(frozen[0].busy).toBeUndefined();
    expect('busy' in frozen[0]).toBe(false);
  });

  it('appends a receipt rather than clearing the screen (D5)', () => {
    const receipt = acceptedTurn('/Pages/Customers', 'update');
    expect(receipt.outcome).toEqual({
      kind: 'accepted-component',
      legacyName: '/Pages/Customers',
      mode: 'update'
    });
  });
});
