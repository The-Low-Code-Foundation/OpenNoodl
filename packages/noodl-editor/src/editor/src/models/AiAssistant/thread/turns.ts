/**
 * BLD-001 — three producers, one thread.
 *
 * `AuthoringSession`, `PlanningSession`/`PlanRun` and the project review run
 * keep their interfaces exactly as they are. Nothing here starts, cancels or
 * accepts anything; these are total functions from published state to a list of
 * turns. That is the whole of what "the three views become turn producers"
 * means in practice — the sessions did not change, the thing rendering them
 * did.
 *
 * ## The turn boundary is the user's sentence
 *
 * `AuthoringSession` pushes `{ kind: 'user' }` at the top of `run()` and again
 * at the top of `refine()`, and nothing else does. So the feed already carries
 * its own turn boundaries and never needed a parallel structure to record them
 * — splitting on `user` is not a heuristic, it is reading the marker the
 * session was already writing.
 *
 * ## Why history is a parameter and not a store
 *
 * Accepting disposes the session, which is correct and stays: a session holds a
 * candidate, and once the candidate is in the project there is nothing left to
 * hold. What was wrong (D5) is that the *record* died with it — `setState(null)`
 * and the whole conversation was gone at the moment it became part of your
 * project. `freezeTurns` is the fix at this layer: the live turns become
 * history before the session is dropped, so accept appends a receipt instead of
 * clearing the screen. Making that history survive a restart is BLD-006.
 *
 * @module AiAssistant/thread/turns
 */

import type { AuthoringMode, AuthoringSessionState, PlanOperationState, PlanRunState } from '../authoring';
import type { PlanSession } from '../authoring';
import type { ProjectReviewState } from '../review';
import { summarisePlan } from './intent';
import type { IntentDecision } from './intent';
import type { BuildIntent, Turn, TurnActivity, TurnOutcome } from './types';

/**
 * What the feed's tail says when the loop has stopped, as an outcome.
 *
 * Lifted verbatim from `AiAuthoringPanel.outcomeNote` — the wording is
 * unchanged and deliberately so; it was reviewed once and this task is not
 * about what the sentences say. What changed is that it is now pure, pinned,
 * and reachable from a runner, which is what makes the next task free to
 * rewrite it on evidence.
 */
export function sessionNote(state: AuthoringSessionState): TurnOutcome | undefined {
  switch (state.phase) {
    case 'staged':
      return undefined; // The staged outcome says it better.
    case 'exhausted':
      return {
        kind: 'note',
        tone: 'notice',
        text: state.staged
          ? 'This refinement did not produce a valid revision — the previous candidate is still staged.'
          : 'The agent could not produce a valid component within its budget. Reword the description and try again.'
      };
    case 'cancelled':
      return {
        kind: 'note',
        tone: 'notice',
        text: state.staged
          ? 'Cancelled — the previously staged candidate is untouched.'
          : 'Cancelled. Nothing was written.'
      };
    case 'error':
      return { kind: 'note', tone: 'danger', text: state.error ?? 'Something went wrong.' };
    default:
      return undefined;
  }
}

export interface ComponentTurnOptions {
  /**
   * Namespaces the ids. Two producers in one thread must not both emit `t-0`,
   * and a React key collision shows up as state leaking between turns rather
   * than as an error.
   */
  idPrefix?: string;
  /** Named on the first turn only — it is a decision about the request, not about every refinement. */
  intent?: BuildIntent;
  /**
   * The agent's first sentence, from `decideIntent`.
   *
   * Prepended to the first turn rather than pushed into the session's feed,
   * because the session did not say it — the planning turn did, and a feed that
   * attributes one producer's words to another is the kind of small lie that
   * makes a transcript useless later.
   */
  sentence?: string;
}

/**
 * A single-component session as turns.
 *
 * The staged outcome lands on the **last** turn, not on the turn that produced
 * the candidate, and that is deliberate: a candidate survives a failed
 * refinement (`state.staged` outlives an `exhausted` phase), so attributing it
 * to the round that made it would put a live Accept button halfway up a
 * scrolled thread with a newer, failed round below it.
 */
export function componentTurns(state: AuthoringSessionState | null, options: ComponentTurnOptions = {}): Turn[] {
  if (!state) return [];
  const prefix = options.idPrefix ?? 'component';
  const turns: Turn[] = [];

  for (const activity of state.activities) {
    if (activity.kind === 'user') {
      turns.push({ id: `${prefix}-${turns.length}`, request: activity.text, activities: [] });
      continue;
    }
    if (turns.length === 0) {
      // A session that produced prose before any request is a caller bug, not a
      // shape to render around — but dropping the prose would hide it, so it
      // gets a turn with no request rather than being appended to nothing.
      turns.push({ id: `${prefix}-0`, activities: [] });
    }
    turns[turns.length - 1].activities.push(activity as TurnActivity);
  }

  if (turns.length === 0) return turns;
  if (options.intent) turns[0].intent = options.intent;
  if (options.sentence) turns[0].activities.unshift({ kind: 'assistant', text: options.sentence });

  const last = turns[turns.length - 1];
  if (state.busy) last.busy = true;
  else if (state.staged) {
    last.outcome = {
      kind: 'staged-component',
      legacyName: state.legacyName,
      mode: state.mode,
      nodeCount: state.staged.nodeCount,
      connectionCount: state.staged.connectionCount
    };
  } else {
    const note = sessionNote(state);
    if (note) last.outcome = note;
  }

  return turns;
}

/** The receipt an accept appends. D5's fix, at the smallest possible size. */
export function acceptedTurn(legacyName: string, mode: AuthoringMode, idPrefix = 'accepted'): Turn {
  return {
    id: `${idPrefix}-${legacyName}`,
    activities: [],
    outcome: { kind: 'accepted-component', legacyName, mode }
  };
}

/**
 * A turn is history once nothing can change it.
 *
 * Strips `busy` — a frozen turn that still claims to be running is how a thread
 * grows two spinners, one of which never stops.
 *
 * ⚠️ Freezing is **not** on its own enough to retire a turn: the ids carry the
 * liveness, and this deliberately leaves them alone. See {@link retireLive},
 * which is what callers retiring a whole request should use.
 */
export function freezeTurns(turns: readonly Turn[]): Turn[] {
  return turns.map(({ busy: _busy, ...turn }) => turn);
}

/**
 * One finished operation as one line.
 *
 * `pending` and `authoring` produce nothing here on purpose: an operation that
 * has not happened yet is not part of the record of what happened, and the
 * *live* picture of the one currently authoring is the run's own row with its
 * own clock, which BLD-005 pins. A feed that also listed "Building Pages/Cart…"
 * would be the same fact in two places, drifting.
 */
function operationActivity(op: PlanOperationState): TurnActivity | undefined {
  const target = op.operation.target;
  switch (op.status) {
    case 'staged':
      return { kind: 'tool', label: `Built ${target}` };
    case 'failed':
      return { kind: 'submit', ok: false, errorLines: [op.error ?? `${target} could not be built.`] };
    case 'skipped':
      // AIB-009 F4: the two reasons an operation ends `skipped` are not the same
      // answer, and the run's own rows already distinguish them. Saying only
      // "Skipped" here would flatten a decision the agent made into a casualty
      // of a Stop the user pressed.
      return {
        kind: 'tool',
        label: op.skippedByCancel ? `Skipped ${target} — the run was stopped` : `Skipped ${target}`
      };
    default:
      return undefined;
  }
}

export interface PlanTurnOptions {
  idPrefix?: string;
  /** The agent's first sentence, from `decideIntent`. Rendered above the plan. */
  sentence?: string;
}

/**
 * A plan session as turns: the request that produced the plan, then the run.
 *
 * Two turns rather than one, because they answer different questions and a user
 * decides between them: the first is *"is this the right work?"* and carries the
 * plan for pruning; the second is *"did it work?"* and carries what each
 * operation produced. Collapsing them would put a plan editor and a run feed in
 * one card, which is the 400px problem D10 names.
 */
export function planTurns(
  session: PlanSession,
  runState: PlanRunState | null,
  options: PlanTurnOptions = {}
): Turn[] {
  const prefix = options.idPrefix ?? 'plan';
  const turns: Turn[] = [];

  if (session.plan) {
    const activities: TurnActivity[] = [];
    if (options.sentence) activities.push({ kind: 'assistant', text: options.sentence });
    turns.push({
      id: `${prefix}-proposed`,
      request: session.plan.request || session.description || undefined,
      intent: 'plan',
      activities,
      // Once the run exists the plan is no longer the decision on screen — it
      // has been approved, and re-offering Approve beside a running build is
      // exactly the duplicated control the phase is measured on.
      outcome: runState ? undefined : { kind: 'plan', plan: summarisePlan(session.plan) }
    });
  }

  if (runState) {
    const activities = runState.operations.map(operationActivity).filter((a): a is TurnActivity => Boolean(a));
    const turn: Turn = { id: `${prefix}-run`, activities };
    if (runState.busy) turn.busy = true;
    turns.push(turn);
  }

  if (session.applied) {
    turns.push({
      id: `${prefix}-applied`,
      activities: [],
      outcome: {
        kind: 'plan-applied',
        componentCount: session.applied.count,
        docs: session.applied.docs,
        ...(session.applied.backend ? { backendName: session.applied.backend.name } : {})
      }
    });
  } else if (session.applyFailure) {
    turns.push({
      id: `${prefix}-apply-failed`,
      activities: [],
      outcome: {
        kind: 'note',
        tone: 'danger',
        text: `${session.applyFailure.target} could not be applied — ${session.applyFailure.reason}`
      }
    });
  }

  return turns;
}

export interface DocsTurnOptions {
  idPrefix?: string;
  /** The user's words, when a request opened this run rather than a banner. */
  request?: string;
  sentence?: string;
}

/** A project review (the docs pass) as one turn. */
export function docsTurns(state: ProjectReviewState | null, options: DocsTurnOptions = {}): Turn[] {
  if (!state || state.phase === 'idle') return [];
  const prefix = options.idPrefix ?? 'docs';

  const activities: TurnActivity[] = [];
  if (options.sentence) activities.push({ kind: 'assistant', text: options.sentence });
  for (const draft of state.drafts) {
    if (draft.status === 'pending') continue;
    activities.push({ kind: 'tool', label: `${draft.status === 'authored' ? 'Drafted' : 'Left'} ${draft.path}` });
  }

  const turn: Turn = {
    id: `${prefix}-run`,
    ...(options.request ? { request: options.request } : {}),
    intent: 'docs',
    activities
  };

  if (state.busy) {
    turn.busy = true;
  } else if (state.phase === 'error') {
    turn.outcome = { kind: 'note', tone: 'danger', text: state.error ?? 'The review could not be completed.' };
  } else if (state.phase === 'cancelled') {
    turn.outcome = { kind: 'note', tone: 'notice', text: 'Cancelled. Nothing was written.' };
  } else {
    turn.outcome = {
      kind: 'docs-drafts',
      authored: state.drafts.filter((d) => d.status === 'authored').length,
      declined: state.drafts.filter((d) => d.status === 'declined').length,
      errors: state.drafts.filter((d) => d.status === 'error' || d.status === 'exhausted').length
    };
  }

  return [turn];
}

/**
 * The thread, in the order things happened.
 *
 * ⚠️ The invariant this enforces is the one a reviewer cannot see by reading a
 * single producer: **at most one turn is busy**. Each producer is honest about
 * its own state, and two of them can legitimately be live at once — a plan run
 * finishing while a docs pass starts — but a thread showing two live turns is
 * telling the user that two things are being built, which is a claim about
 * progress that BLD-001's own rule 5 forbids. The later turn wins; the earlier
 * one has, by construction, already produced whatever it produced.
 */
export function composeThread(...groups: readonly (readonly Turn[])[]): Turn[] {
  const turns: Turn[] = [];
  for (const group of groups) turns.push(...group);

  let seenBusy = false;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (!turns[i].busy) continue;
    if (seenBusy) turns[i] = { ...turns[i], busy: false };
    seenBusy = true;
  }
  return turns;
}

// ── Live and retired ──────────────────────────────────────────────────────────

/**
 * Everything the three producers currently hold, as one argument.
 *
 * One object rather than six parameters because it is read twice per request —
 * once to render the live turns and once to retire them — and a positional list
 * two call sites must keep in agreement is precisely how the two copies drift.
 */
export interface LiveSources {
  /** What the last routed request became. `null` before the first one. */
  route: BuildIntent | null;
  session: AuthoringSessionState | null;
  planSession: PlanSession;
  runState: PlanRunState | null;
  reviewState: ProjectReviewState | null;
  /** The agent's first sentence, named on the producer the decision was about. */
  decision: Pick<IntentDecision, 'intent' | 'sentence'> | null;
}

/**
 * The turns the three producers are holding *right now*.
 *
 * ## The prefix is the liveness
 *
 * Called with no `idPrefix`, the ids are `component-…`, `plan-…` and `docs-run`
 * — and those exact strings are what the panel's `renderOutcome` matches to
 * decide where to mount a live control (the plan editor, the review view, the
 * Accept/Discard card). Called *with* one, every id gains a `history-N-`
 * front and **none of those matches can fire**. That is not a tidy-ids
 * nicety; it is the whole mechanism that stops a retired turn from growing a
 * second Accept button beside the live one, and it is why retiring goes through
 * {@link retireLive} rather than through `freezeTurns` alone.
 *
 * A plan turn exists whenever the store holds a plan — whether this request
 * planned it, a previous one left it, or the launcher handed it over — because
 * the store, not this panel, is the plan's owner.
 */
export function liveTurns(sources: LiveSources, idPrefix?: string): Turn[] {
  const { route, session, planSession, runState, reviewState, decision } = sources;
  const scope = (kind: string) => (idPrefix ? `${idPrefix}-${kind}` : kind);

  const showPlan = route === 'plan' || Boolean(planSession.plan);
  const showDocs = route === 'docs' || Boolean(reviewState && reviewState.phase !== 'idle');

  return [
    ...(route === 'component'
      ? componentTurns(session, {
          idPrefix: scope('component'),
          ...(decision ? { sentence: decision.sentence, intent: decision.intent } : {})
        })
      : []),
    ...(showPlan
      ? planTurns(planSession, runState, {
          idPrefix: scope('plan'),
          ...(decision?.intent === 'plan' ? { sentence: decision.sentence } : {})
        })
      : []),
    ...(showDocs
      ? docsTurns(reviewState, {
          idPrefix: scope('docs'),
          ...(decision?.intent === 'docs' ? { sentence: decision.sentence } : {})
        })
      : [])
  ];
}

/**
 * B9 — a new request retires the previous one instead of erasing it.
 *
 * The thread reset on every successful send: `history` was appended on the
 * accept path, the discard path and the *declined* / *failed* branches of a
 * send, but never on the path that worked. Routing a second request replaced
 * the plan session the first one had produced, and the first turn simply
 * evaporated — three sends, three provider calls, one turn on screen. The
 * declined and failed branches were the tell that accumulation was always
 * intended and the success path was the one that was missed.
 *
 * Retiring at send time is not a new contract, it is the one that went missing:
 * the pre-BLD-001 panel called `reset()` at the top of `startPlanning` for the
 * same reason — *planning a new request is the user saying they are done with
 * the previous one*. What is new is that the record survives it.
 *
 * ⚠️ The caller must drop the live sources after calling this, or the retired
 * copy and the live derivation are both on screen — the duplicated message this
 * phase is measured on. Retiring is a pair: freeze the record, then release
 * what produced it.
 *
 * Returns the given history unchanged when there was nothing live, so a first
 * send does not push an empty render through React.
 */
export function retireLive(history: readonly Turn[], sources: LiveSources): Turn[] {
  const retired = freezeTurns(liveTurns(sources, `history-${history.length}`));
  if (retired.length === 0) return history as Turn[];
  return [...history, ...retired];
}
