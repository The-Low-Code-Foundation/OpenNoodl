/**
 * AIB-003 slice 4 — a restart is a stop.
 *
 * Slices 1–3 made a build survive a tab click, a panel close and a project
 * switch, by moving it out of `useState` and into `PlanSessionStore`. What they
 * could not survive is the process ending: a crash, an HMR reload, the
 * one-second quit path, or the user simply closing the window on a plan they
 * meant to come back to. The staged candidates were in a `Map` on a `PlanRun`,
 * and the phase's own rule — *authored output is durable from the moment it
 * validates, and no navigation, failure, or restart may destroy it without the
 * user saying so* — names a restart explicitly.
 *
 * ## The whole design in one sentence
 *
 * **A restart is a stop**, so a restored run is restored into exactly the state
 * a cancelled run has, and every affordance AIB-009 F4 built for a stopped run
 * works on it unchanged.
 *
 * That is worth spelling out because the alternative was tempting and wrong:
 * resuming the run where it left off. A half-finished authoring turn cannot be
 * resumed — the model session is gone with the process, and its tokens with it —
 * so "resume" would have meant re-running the operation silently, spending money
 * the user did not ask to spend, on a screen they had just opened. Stopping is
 * the honest report, and `retryOperation` (AIB-001 slice 4) and `runDocPass`
 * (AIB-009 F4) are already the two ways forward from one.
 *
 * ## Why the rules live here and not on `PlanRun`
 *
 * `PlanRun` imports `AuthoringSession`, which reaches an `AiClient`; it cannot
 * be constructed in the plain-Node runner where the rest of AIB-003 is tested.
 * So the *decisions* — which operation comes back failed, what the run's phase
 * becomes, whether a file on disk is worth trusting — are pure functions in this
 * module, and `PlanRun` keeps only the field assignment. The same split AIB-001
 * used for its parameter rules, for the same reason.
 *
 * Nothing here touches a filesystem either; `PlanSessionSidecar` is the only
 * thing that does. This module would produce the same snapshot for an MCP caller
 * with no Electron around it.
 *
 * @module AiAssistant/authoring/planSessionSnapshot
 */

import type { AuthoringPlan, PlanOperation } from './plan';
import type { PlanOperationState, PlanOperationStatus, StagedDoc } from './PlanRun';
import type { PlanApplyFailure, PlanSession, PlanSessionNote } from './PlanSessionStore';
import type { AgentSampleData, ComponentFiles } from './types';

/**
 * Bumped when a change would make an older file restore *wrongly* rather than
 * merely incompletely. A snapshot from a different version is dropped, not
 * migrated: it is unapplied scratch, and re-planning costs one turn.
 */
export const PLAN_SNAPSHOT_VERSION = 1;

/** Everything a `PlanRun` holds that outlives the process. */
export interface PlanRunSnapshot {
  operations: PlanOperationState[];
  /** Staged candidates, by operation id — the expensive part. */
  files: Record<string, ComponentFiles>;
  sampleData: Record<string, AgentSampleData>;
  docs: Record<string, StagedDoc>;
  costUsd: number | null;
  startedAt?: number;
  endedAt?: number;
}

/** The on-disk shape of `<project>/.nodegx/plan/session.json`. */
export interface PlanSessionSnapshot {
  version: number;
  /** ISO 8601, so the restore note can say when the work was left. */
  savedAt: string;
  description: string;
  plan: AuthoringPlan | null;
  note: PlanSessionNote | null;
  /** A `Set` does not survive `JSON.stringify`; the store narrows it back. */
  excluded: string[];
  applyFailure: PlanApplyFailure | null;
  origin: 'scoping' | null;
  announcementDismissed: boolean;
  run: PlanRunSnapshot | null;
}

/**
 * Whether this session is worth a disk write at all.
 *
 * Deliberately excludes two things a session can hold on its own. A bare
 * `description` is a half-typed sentence, and persisting it would mean a write
 * per keystroke to restore something the user can retype in five seconds. An
 * `applied` summary is what a session becomes *after* a successful apply calls
 * `discard()` — the work is in the project by then, and greeting someone with
 * "you applied 3 components last Tuesday" a week later is noise, not recovery.
 */
export function isWorthPersisting(session: Pick<PlanSession, 'plan' | 'run' | 'applyFailure'>): boolean {
  return Boolean(session.plan || session.run || session.applyFailure);
}

/**
 * The session as JSON. `run` is read through the instance's own `snapshot()`
 * rather than reached into, which is what lets this module type-import `PlanRun`
 * and never load it.
 */
export function snapshotSession(session: PlanSession, savedAt: string): PlanSessionSnapshot {
  return {
    version: PLAN_SNAPSHOT_VERSION,
    savedAt,
    description: session.description,
    plan: session.plan,
    note: session.note,
    excluded: [...session.excluded],
    applyFailure: session.applyFailure,
    origin: session.origin,
    announcementDismissed: session.announcementDismissed,
    run: session.run ? session.run.snapshot() : null
  };
}

/**
 * A snapshot read back off disk, or `null` if it is not one.
 *
 * `.nodegx/` is a directory people can see, open and hand-edit, and a
 * half-written file is the normal consequence of the crash this feature exists
 * to survive. The rule is CodeHistoryStore's: take what is well formed, drop
 * the rest, never throw. A dropped snapshot costs a re-plan; a throw here would
 * break the panel for a project whose scratch file is malformed.
 */
export function parsePlanSessionSnapshot(raw: unknown): PlanSessionSnapshot | null {
  const value = raw as Partial<PlanSessionSnapshot> | null;
  if (!value || typeof value !== 'object') return null;
  if (value.version !== PLAN_SNAPSHOT_VERSION) return null;
  if (!isPlan(value.plan)) return null;

  return {
    version: PLAN_SNAPSHOT_VERSION,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
    description: typeof value.description === 'string' ? value.description : '',
    plan: value.plan,
    note: isNote(value.note) ? value.note : null,
    excluded: Array.isArray(value.excluded) ? value.excluded.filter((id): id is string => typeof id === 'string') : [],
    applyFailure: isApplyFailure(value.applyFailure) ? value.applyFailure : null,
    origin: value.origin === 'scoping' ? 'scoping' : null,
    announcementDismissed: value.announcementDismissed === true,
    run: parseRunSnapshot(value.run, value.plan)
  };
}

/**
 * What a run comes back as.
 *
 * Every operation lands in a terminal status, because nothing is running: the
 * process that was authoring it is gone. Which terminal status depends on what
 * the operation has, not on what it was doing —
 *
 * - it has staged files or a staged doc → `staged`, untouched. This is the
 *   output the whole task exists to keep.
 * - it was `authoring`, or never reached → the same shape a Stop produces. A
 *   component operation becomes `failed` with a reason that says so, which is
 *   what puts AIB-001's per-operation **Retry** in front of the user. A doc
 *   operation becomes `skipped` with `skippedByCancel`, which is what puts
 *   AIB-009 F4's **Write the documents** in front of them.
 * - it already failed, or was skipped for a reason of its own → left exactly as
 *   it was. A doc the agent read the work and declined has answered the
 *   question; re-asking costs a model call to be told the same thing.
 *
 * `interrupted` is what the caller needs to distinguish a run that finished
 * before the window closed from one that was cut off mid-flight — the first is
 * `done`, the second is `cancelled`, and the panel says different things about
 * them.
 */
export function restoreOperations(snapshot: PlanRunSnapshot): {
  operations: PlanOperationState[];
  interrupted: number;
} {
  let interrupted = 0;
  const operations = snapshot.operations.map((state) => {
    if (state.status !== 'pending' && state.status !== 'authoring') return { ...state };
    interrupted++;

    if (state.operation.kind === 'doc') {
      // Exactly what `cancel()` leaves behind, so `docsAwaitingCancelledPass()`
      // finds it and the existing doc-pass button appears with no new wiring.
      return { ...state, status: 'skipped' as PlanOperationStatus, skippedByCancel: true, session: undefined };
    }

    return {
      ...state,
      status: 'failed' as PlanOperationStatus,
      error:
        state.status === 'authoring'
          ? 'The editor closed while this was being authored. Nothing was lost from the rest of the plan — retry this one operation.'
          : 'The editor closed before this operation started. Retry it when you are ready.',
      // The live feed belonged to a session that no longer exists. Keeping it
      // would show rows still saying "Writing…" under a row that says it failed.
      session: undefined
    };
  });

  return { operations, interrupted };
}

/**
 * The line the panel shows when a build comes back from disk.
 *
 * A restore that says nothing is indistinguishable from a build that was never
 * lost, and the user has no reason to trust either. This names what came back
 * and what did not, which is also the sentence that tells them a retry is
 * waiting.
 */
export function describeRestore(snapshot: PlanSessionSnapshot): string {
  const operations = snapshot.run?.operations ?? [];
  const staged = operations.filter((op) => op.status === 'staged').length;
  // Derived from the snapshot rather than taken from `restoreOperations`, so the
  // sentence cannot disagree with the panel: both read the same field of the
  // same file, and there is no second count to keep in step.
  const interrupted = operations.filter((op) => op.status === 'pending' || op.status === 'authoring').length;
  const when = formatSavedAt(snapshot.savedAt);
  const parts = [`Restored the build you left unapplied${when ? ` ${when}` : ''}.`];

  if (staged > 0) {
    parts.push(`${staged} operation${staged === 1 ? '' : 's'} still staged — nothing has reached your project.`);
  }
  if (interrupted > 0) {
    parts.push(
      `${interrupted} was cut off when the editor closed and ${interrupted === 1 ? 'is' : 'are'} waiting to be retried.`
    );
  }
  if (staged === 0 && interrupted === 0) {
    parts.push('Nothing was authored yet — the plan is as you left it.');
  }

  return parts.join(' ');
}

function formatSavedAt(savedAt: string): string {
  const at = Date.parse(savedAt);
  if (!Number.isFinite(at)) return '';
  return `on ${new Date(at).toLocaleString()}`;
}

function isPlan(value: unknown): value is AuthoringPlan {
  const plan = value as AuthoringPlan;
  return (
    !!plan &&
    typeof plan === 'object' &&
    typeof plan.request === 'string' &&
    Array.isArray(plan.operations) &&
    plan.operations.every((op) => op && typeof op.id === 'string' && typeof op.kind === 'string')
  );
}

function isNote(value: unknown): value is PlanSessionNote {
  const note = value as PlanSessionNote;
  return (
    !!note &&
    typeof note === 'object' &&
    typeof note.text === 'string' &&
    (note.type === 'success' || note.type === 'notice' || note.type === 'danger')
  );
}

function isApplyFailure(value: unknown): value is PlanApplyFailure {
  const failure = value as PlanApplyFailure;
  return (
    !!failure &&
    typeof failure === 'object' &&
    typeof failure.id === 'string' &&
    typeof failure.target === 'string' &&
    typeof failure.reason === 'string'
  );
}

const STATUSES: ReadonlySet<string> = new Set(['pending', 'authoring', 'staged', 'failed', 'skipped']);

/**
 * The run, keyed back to the plan it belongs to.
 *
 * Operations are matched to the plan by id and anything unmatched is dropped:
 * the plan is the authority on what the run is, and a file that disagrees with
 * it (a hand-edit, a version skew) must not be able to introduce an operation
 * `PlanRun` has no state for. Staged files for an operation that did not survive
 * that filter go with it — a candidate nothing can apply is not recovery.
 */
function parseRunSnapshot(raw: unknown, plan: AuthoringPlan): PlanRunSnapshot | null {
  const value = raw as Partial<PlanRunSnapshot> | null;
  if (!value || typeof value !== 'object' || !Array.isArray(value.operations)) return null;

  const byId = new Map<string, PlanOperation>(plan.operations.map((op) => [op.id, op]));
  const operations: PlanOperationState[] = [];
  for (const state of value.operations) {
    const operation = state && typeof state === 'object' ? byId.get((state.operation as PlanOperation)?.id) : undefined;
    if (!operation || !STATUSES.has(state.status)) continue;
    operations.push({ ...state, operation });
  }
  if (operations.length === 0) return null;

  const live = new Set(operations.map((state) => state.operation.id));
  return {
    operations,
    files: pickById(value.files, live),
    sampleData: pickById(value.sampleData, live),
    docs: pickById(value.docs, live),
    costUsd: typeof value.costUsd === 'number' ? value.costUsd : null,
    ...(typeof value.startedAt === 'number' ? { startedAt: value.startedAt } : {}),
    ...(typeof value.endedAt === 'number' ? { endedAt: value.endedAt } : {})
  };
}

function pickById<T>(raw: unknown, live: ReadonlySet<string>): Record<string, T> {
  const source = (raw ?? {}) as Record<string, T>;
  if (typeof source !== 'object') return {};
  const picked: Record<string, T> = {};
  for (const [id, value] of Object.entries(source)) {
    if (live.has(id) && value && typeof value === 'object') picked[id] = value;
  }
  return picked;
}
