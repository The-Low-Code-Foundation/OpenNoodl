/**
 * AIB-003 slice 4 — a restart is a stop.
 *
 * Slices 1–3 survived a tab click, a panel close and a project switch. This is
 * the one the phase's own rule names and they did not cover: *no navigation,
 * failure, or **restart** may destroy authored output without the user saying
 * so.*
 *
 * What is asserted here is the same kind of thing slices 1–2 asserted — the
 * decisions, not the plumbing. `PlanSessionSidecar` writes the file and is a
 * hundred lines of debounce and `console.warn`; the interesting questions are
 * which operation comes back retryable, what a hand-edited file is allowed to
 * introduce, and what is deliberately *not* restored. Those are pure, so they
 * are here rather than in a runner that needs Electron.
 */

import {
  describeRestore,
  isWorthPersisting,
  parsePlanSessionSnapshot,
  PLAN_SNAPSHOT_VERSION,
  restoreOperations,
  snapshotSession,
  type PlanRunSnapshot,
  type PlanSessionSnapshot
} from '../../src/editor/src/models/AiAssistant/authoring/planSessionSnapshot';
import type { PlanOperationState } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import type { PlanSession } from '../../src/editor/src/models/AiAssistant/authoring/PlanSessionStore';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';

const PLAN: AuthoringPlan = {
  request: 'A chat app with signup',
  operations: [
    { id: 'op-1', kind: 'create', target: 'Pages/Sign Up', intent: 'The signup page.' },
    { id: 'op-2', kind: 'create', target: 'Pages/Chats', intent: 'The chat list.' },
    { id: 'op-3', kind: 'create', target: 'Pages/Chat', intent: 'One conversation.' },
    { id: 'op-4', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'Record the pages.' }
  ]
};

function operation(id: string, status: PlanOperationState['status']): PlanOperationState {
  const op = PLAN.operations.find((o) => o.id === id);
  if (!op) throw new Error(`no operation ${id}`);
  return { operation: op, status };
}

/** A candidate shaped enough for the parser; the real thing is far bigger. */
function files(name: string) {
  return {
    component: { name },
    nodes: { nodes: [{ id: 'n1', type: 'Group' }] },
    connections: { connections: [] }
  } as never;
}

function runSnapshot(overrides: Partial<PlanRunSnapshot> = {}): PlanRunSnapshot {
  return {
    operations: [operation('op-1', 'staged'), operation('op-2', 'authoring'), operation('op-3', 'pending')],
    files: { 'op-1': files('Sign Up') },
    sampleData: {},
    docs: {},
    costUsd: 0.42,
    startedAt: 1000,
    endedAt: 5000,
    ...overrides
  };
}

function sessionSnapshot(overrides: Partial<PlanSessionSnapshot> = {}): PlanSessionSnapshot {
  return {
    version: PLAN_SNAPSHOT_VERSION,
    savedAt: '2026-08-03T12:00:00.000Z',
    description: 'A chat app with signup',
    plan: PLAN,
    note: null,
    excluded: [],
    applyFailure: null,
    origin: 'scoping',
    announcementDismissed: false,
    run: runSnapshot(),
    ...overrides
  };
}

describe('what is worth writing to disk', () => {
  const base: Pick<PlanSession, 'plan' | 'run' | 'applyFailure'> = { plan: null, run: null, applyFailure: null };

  it('persists a plan, a run, or a failure the user still has to act on', () => {
    expect(isWorthPersisting({ ...base, plan: PLAN })).toBe(true);
    expect(isWorthPersisting({ ...base, run: {} as never })).toBe(true);
    expect(isWorthPersisting({ ...base, applyFailure: { id: 'op-1', target: 'x', reason: 'y' } })).toBe(true);
  });

  it('does not persist an empty session', () => {
    expect(isWorthPersisting(base)).toBe(false);
  });
});

describe('a run read back off disk', () => {
  it('keeps every staged candidate — the thing the task exists for', () => {
    const { operations } = restoreOperations(runSnapshot());
    expect(operations.find((o) => o.operation.id === 'op-1')?.status).toBe('staged');
  });

  it('brings an interrupted component operation back as failed, with a reason that names the restart', () => {
    const { operations, interrupted } = restoreOperations(runSnapshot());

    const cutOff = operations.find((o) => o.operation.id === 'op-2');
    expect(cutOff?.status).toBe('failed');
    expect(cutOff?.error).toContain('editor closed');
    // AIB-001 slice 4's Retry is what a `failed` operation puts on screen. That
    // is the entire reason the status is `failed` and not `pending`.
    expect(interrupted).toBe(2);
  });

  it('drops the live feed of a session that no longer exists', () => {
    const snapshot = runSnapshot({
      operations: [{ ...operation('op-2', 'authoring'), session: { busy: true, phase: 'building' } as never }]
    });

    // A feed still saying "Writing…" under a row that says it failed is the
    // panel lying about a process that is gone.
    expect(restoreOperations(snapshot).operations[0].session).toBeUndefined();
  });

  it('brings an unwritten doc back the way a Stop leaves one', () => {
    const snapshot = runSnapshot({ operations: [operation('op-4', 'pending')] });
    const restored = restoreOperations(snapshot).operations[0];

    // `skippedByCancel` is what `docsAwaitingCancelledPass()` filters on, so
    // AIB-009 F4's "Write the documents" button appears with no new wiring.
    expect(restored.status).toBe('skipped');
    expect(restored.skippedByCancel).toBe(true);
  });

  it('leaves an operation that reached its own answer alone', () => {
    const snapshot = runSnapshot({
      operations: [
        { ...operation('op-1', 'failed'), error: 'The gate rejected three submissions.' },
        // A doc the agent read the finished work and declined. Re-running it buys
        // another model call and the same answer.
        { ...operation('op-4', 'skipped'), skippedByCancel: undefined }
      ]
    });
    const restored = restoreOperations(snapshot);

    expect(restored.operations[0].error).toBe('The gate rejected three submissions.');
    expect(restored.operations[1].skippedByCancel).toBeUndefined();
    expect(restored.interrupted).toBe(0);
  });
});

describe('reading a file that may not be one', () => {
  it('round-trips a session', () => {
    const session = {
      description: 'A chat app',
      plan: PLAN,
      note: { text: 'From the scoping conversation', type: 'notice' },
      excluded: new Set(['op-3']),
      applied: null,
      applyFailure: null,
      run: { snapshot: () => runSnapshot() },
      origin: 'scoping',
      announcementDismissed: true
    } as unknown as PlanSession;

    const parsed = parsePlanSessionSnapshot(JSON.parse(JSON.stringify(snapshotSession(session, 'when'))));

    expect(parsed?.excluded).toEqual(['op-3']);
    expect(parsed?.announcementDismissed).toBe(true);
    expect(parsed?.run?.files['op-1']).toBeDefined();
    expect(parsed?.run?.costUsd).toBe(0.42);
  });

  it('refuses a snapshot from another format version rather than guessing', () => {
    expect(parsePlanSessionSnapshot(sessionSnapshot({ version: 99 }))).toBeNull();
  });

  it('refuses anything without a plan — the plan is what a run is about', () => {
    expect(parsePlanSessionSnapshot(sessionSnapshot({ plan: null }))).toBeNull();
    expect(parsePlanSessionSnapshot({ version: PLAN_SNAPSHOT_VERSION, plan: { request: 1 } })).toBeNull();
    expect(parsePlanSessionSnapshot('not json at all')).toBeNull();
  });

  it('will not let a hand-edited file introduce an operation the plan does not have', () => {
    const parsed = parsePlanSessionSnapshot(
      sessionSnapshot({
        run: runSnapshot({
          operations: [operation('op-1', 'staged'), { operation: { id: 'op-9', kind: 'create' }, status: 'staged' }],
          files: { 'op-1': files('Sign Up'), 'op-9': files('Ghost') }
        } as never)
      })
    );

    // `.nodegx/` is a directory people can open. `PlanRun` has no state for an
    // operation the plan never had, and a staged candidate nothing can apply is
    // not recovery — so the files go with the operation.
    expect(parsed?.run?.operations.map((o) => o.operation.id)).toEqual(['op-1']);
    expect(parsed?.run?.files['op-9']).toBeUndefined();
  });

  it('survives a half-written run without losing the plan', () => {
    const parsed = parsePlanSessionSnapshot(sessionSnapshot({ run: { operations: 'truncated' } as never }));

    // The crash this feature exists to survive is exactly what produces a torn
    // file. Losing the run is a loss; failing to open the panel is a defect.
    expect(parsed?.plan).toEqual(PLAN);
    expect(parsed?.run).toBeNull();
  });
});

describe('what the panel says about a restore', () => {
  it('names what came back and what is waiting to be retried', () => {
    const text = describeRestore(sessionSnapshot());

    expect(text).toContain('1 operation still staged');
    expect(text).toContain('nothing has reached your project');
    expect(text).toContain('2 were cut off');
  });

  it('agrees every verb with the count', () => {
    // The phase has filed this exact defect twice — a number interpolated into a
    // sentence whose verb was not — and no diff shows it.
    const one = describeRestore(
      sessionSnapshot({ run: runSnapshot({ operations: [operation('op-2', 'authoring')], files: {} }) })
    );

    expect(one).toContain('1 was cut off');
    expect(one).toContain('is waiting to be retried');
    expect(describeRestore(sessionSnapshot())).toContain('are waiting to be retried');
  });

  it('says so when a plan was never authored', () => {
    expect(describeRestore(sessionSnapshot({ run: null }))).toContain('Nothing was authored yet');
  });
});
