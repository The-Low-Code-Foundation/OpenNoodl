/**
 * BLD-005 — what a long run says about itself, decided once.
 *
 * ## Why this is pure, and here
 *
 * Same boundary as `messages.ts` and `turns.ts`, for the same reason, and this
 * task is the sharpest case of it yet.
 *
 * **An estimate computed from one sample looks exactly like one computed from
 * five.** On screen, *"about 4m left (estimate)"* is the same pixels either way
 * — there is nothing for a screenshot, a reviewer or a `tsc` run to notice, and
 * the way anyone finds out that it was extrapolated from a single unusually fast
 * operation is by watching it be wrong. So the rule about *when an estimate may
 * be shown at all* is a total function over the operation list, graded in a
 * runner, and the header below it only renders what this returns.
 *
 * The same argument covers the stop sentence. *"Stopping keeps the 2 built so
 * far"* is true or false depending on a count and a tense, and a wrong one is
 * perfectly legible — the panel already shipped **"The 1 document are written
 * last"** (AIB-009 F4), which is exactly this failure: a count interpolated into
 * a sentence whose verb was not. That sentence now has one author and a spec.
 *
 * ## What is deliberately NOT here
 *
 * No heartbeat and no motion. Distinguishing the *current* operation by movement
 * is BLD-004's — {@link operationRole} names the role so the stylesheet has
 * something to key off, and stops there. Naming a role is not claiming progress.
 *
 * @module AiAssistant/thread/runProgress
 */

import type { AuthoringSessionState, PlanOperationState, PlanRunState } from '../authoring';

/**
 * How many operations must have finished before an estimate is honest.
 *
 * Two, and the acceptance criterion says two. One sample is not a distribution:
 * the first operation of a plan is routinely the fastest (a small component, a
 * warm cache) or the slowest (the model reading the whole project for the first
 * time), and either way extrapolating six operations from it produces a number
 * with the *appearance* of measurement and none of the substance.
 */
export const MIN_ESTIMATE_SAMPLES = 2;

/** What a row in the run map is, for the stylesheet. */
export type OperationRole = 'done' | 'current' | 'pending' | 'failed' | 'skipped';

/**
 * The visual role of one operation.
 *
 * Five statuses, five roles, and `current` is the one that matters: the task's
 * complaint is that `authoring` renders a static wand identical to the row above
 * it, so "which component is it building" costs a read instead of a glance.
 */
export function operationRole(operation: PlanOperationState): OperationRole {
  switch (operation.status) {
    case 'staged':
      return 'done';
    case 'authoring':
      return 'current';
    case 'failed':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default:
      return 'pending';
  }
}

/**
 * The durations of operations that actually did work, in milliseconds.
 *
 * `skipped` is excluded deliberately, and it is not a detail: a skipped
 * operation ends microseconds after it starts, so letting two of them into the
 * sample makes the median ~0 and the estimate reads *"about 0s left"* for a run
 * with four components still to build. A skipped operation is evidence about
 * nothing except that it was skipped.
 */
export function completedDurations(operations: readonly PlanOperationState[]): number[] {
  return operations
    .filter((operation) => operation.status !== 'skipped')
    .map((operation) =>
      operation.startedAt !== undefined && operation.endedAt !== undefined
        ? operation.endedAt - operation.startedAt
        : undefined
    )
    .filter((ms): ms is number => ms !== undefined && ms >= 0);
}

/**
 * The median, not the mean.
 *
 * One operation that hit its repair loop three times and took eight minutes is
 * a real event and a terrible predictor; the mean lets it drag every remaining
 * row's estimate up with it, and the median does not.
 */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Roughly how much longer the run has, or **nothing**.
 *
 * `undefined` is the honest answer far more often than a number is, and every
 * one of these three cases returns it:
 *
 * - **Fewer than {@link MIN_ESTIMATE_SAMPLES} finished operations.** See above.
 * - **Nothing left to do.** No pending operations and nothing authoring means
 *   the run is over; an estimate would be describing work that does not exist.
 * - ⚠️ **The estimate has run out.** This is the acceptance criterion that reads
 *   like a nicety and is not: *a countdown that reaches 0:00 and keeps running
 *   is worse than no estimate*, because it converts "I don't know" into a claim
 *   that is now visibly, continuously false. When the current operation has
 *   already outlived the typical one and nothing is queued behind it, this
 *   returns `undefined` and the header simply stops saying.
 *
 * Note the number is recomputed from `now` on every tick rather than decremented
 * — the same discipline `useElapsedClock` uses, and for the same reason: a value
 * that is derived cannot drift, and a panel that was hidden for four minutes
 * comes back with the right answer instead of a stale one.
 */
export function estimateRemaining(operations: readonly PlanOperationState[], now: number): number | undefined {
  const samples = completedDurations(operations);
  if (samples.length < MIN_ESTIMATE_SAMPLES) return undefined;

  const typical = median(samples);
  const pending = operations.filter((operation) => operation.status === 'pending').length;
  const current = operations.find((operation) => operation.status === 'authoring');
  const currentRemaining =
    current?.startedAt !== undefined ? Math.max(0, typical - (now - current.startedAt)) : 0;

  const total = typical * pending + currentRemaining;
  return total > 0 ? total : undefined;
}

/**
 * Where the run is: *"Building 3 of 7"* while it works, *"5 of 7 built"* after.
 *
 * The live form counts the operation being worked on; the finished form counts
 * what is actually staged, which is not the same number when something failed.
 * A run that built five of seven and failed twice must not report "7 of 7".
 */
export function runPosition(state: PlanRunState): string {
  const total = state.operations.length;

  if (state.busy) {
    const index = state.activeOperationId
      ? state.operations.findIndex((operation) => operation.operation.id === state.activeOperationId)
      : -1;
    return `Building ${index >= 0 ? index + 1 : 1} of ${total}`;
  }

  const built = state.operations.filter((operation) => operation.status === 'staged').length;
  return `${built} of ${total} built`;
}

/**
 * What pressing Stop costs, in one sentence.
 *
 * One author, because there were two and they said different things: the panel
 * had *"Stopping keeps everything built so far"* — which appeared **only when
 * the plan contained unwritten documents**, so a component-only run offered Stop
 * with no statement of its cost at all — beside AIB-009 F4's careful two-branch
 * sentence about documents being written last.
 *
 * Both halves are kept, the count is added (step 6: *"keeps the 2 built so
 * far"*), and every branch that interpolates a number agrees with its own verb.
 * That last clause is the whole reason this is a function with a spec rather
 * than a ternary in a `.tsx`.
 */
export function stopCost(operations: readonly PlanOperationState[]): string {
  const built = operations.filter((operation) => operation.status === 'staged').length;
  const docsPending = operations.filter(
    (operation) => operation.operation.kind === 'doc' && operation.status !== 'staged'
  ).length;

  const kept =
    built === 0
      ? 'Stopping keeps nothing — no operation has finished yet.'
      : built === 1
        ? 'Stopping keeps the one built so far.'
        : `Stopping keeps the ${built} built so far.`;

  if (docsPending === 0) return kept;

  const docs =
    docsPending === 1
      ? 'The document is written last, so it will be skipped — you can write it afterwards without re-running the build.'
      : `The ${docsPending} documents are written last, so they will be skipped — you can write them afterwards without re-running the build.`;

  return `${kept} ${docs}`;
}

/**
 * AIB-002 — what an authoring operation is doing *right now*, in one clause.
 *
 * The attempt number is the single most reassuring thing on screen during a
 * long turn: a run that has silently been repairing its third submission for
 * four minutes is indistinguishable, without it, from one that has hung.
 *
 * Moved here from the view by BLD-005, because the pinned header promotes this
 * line and the operation row still shows it — one sentence with two renderers,
 * which is only safe while it has one author. (BLD-007 is the counter-example
 * this phase already paid for: one fact given two sources, `tsc` green the
 * whole time.)
 */
export function authoringDetail(session: AuthoringSessionState | undefined): string | undefined {
  if (!session) return undefined;
  const building = session.building;
  if (!building) return 'Reading context…';
  const nodes = `${building.nodes.length} node${building.nodes.length === 1 ? '' : 's'}`;
  const attempt = building.submission > 1 ? ` · attempt ${building.submission}` : '';
  return building.complete ? `Validating — ${nodes}${attempt}` : `Writing — ${nodes} so far${attempt}`;
}

/** "4m 12s", "38s" — a duration read at a glance, not parsed. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

/**
 * An estimate, labelled as one — or nothing at all.
 *
 * The word "about" and the parenthetical are not hedging for its own sake. This
 * number sits inches from `formatDuration`'s elapsed time, which is *measured*;
 * without the label the two read as the same kind of fact, and a user who plans
 * their next ten minutes around a median-of-three has been misled by a
 * formatting choice.
 */
export function formatEstimate(ms: number | undefined): string | undefined {
  return ms === undefined ? undefined : `about ${formatDuration(ms)} left (estimate)`;
}

/**
 * AIB-002 — cost, or the honest absence of one.
 *
 * `costUsd` is null when *any* turn had unknown pricing, and rendering that as
 * `$0.00` would tell a user bringing their own key that the plan was free. In
 * an alpha where the cost of a plan is the only thing standing between a user
 * and a surprise invoice, that is not a rounding error.
 */
export function formatCost(costUsd: number | null): string {
  if (costUsd === null) return 'cost unknown';
  // Sub-cent totals are real during testing; $0.00 reads as "nothing happened".
  return costUsd > 0 && costUsd < 0.01 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`;
}

/**
 * The whole pinned header line, assembled.
 *
 * Position, elapsed, cost and — only when it is honest — an estimate. Assembled
 * here rather than in the component so the *order* and the separators are one
 * decision, and so a spec can assert the estimate is absent when it should be
 * without mounting anything.
 */
export function runHeadline(state: PlanRunState, now: number): string {
  const elapsed = state.startedAt !== undefined ? (state.endedAt ?? now) - state.startedAt : undefined;

  return [
    runPosition(state),
    elapsed !== undefined ? formatDuration(elapsed) : undefined,
    formatCost(state.costUsd),
    state.busy ? formatEstimate(estimateRemaining(state.operations, now)) : undefined
  ]
    .filter(Boolean)
    .join(' · ');
}
