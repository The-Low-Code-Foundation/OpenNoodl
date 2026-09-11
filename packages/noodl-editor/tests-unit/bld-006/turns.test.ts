/**
 * BLD-006 — R6, and the gap that removing the duplicate uncovered.
 *
 * The user's request rendered **twice** in the thread, in every screenshot
 * since session 8: a bare bubble above the live turn, which read as a retired
 * turn and was in fact the *pending* turn — the placeholder that carries the
 * request while the planning call is in flight. It was never retired because
 * `send` awaits `routePlan`, and `routePlan` awaits the whole component build.
 *
 * The rule the panel now composes with is *the pending turn stands in for the
 * live turns until there are some*, which is a statement about what is on
 * screen rather than about what has been decided — the condition is graded
 * here, and the docs case is why it could not be "has the route been decided".
 *
 * ⚠️ And a duplicate was hiding a hole: `docsTurns` has always accepted a
 * `request` and `liveTurns` has never had one to give it, so a docs run has
 * been rendering with no request at all. Nobody saw it because the pending
 * turn was showing the same words two lines up.
 */

import { liveTurns, retiredTurns, type LiveSources } from '@noodl-models/AiAssistant/thread';
import type { PlanSession } from '@noodl-models/AiAssistant/authoring';
import type { ProjectReviewState as ReviewState } from '@noodl-models/AiAssistant/review';

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

function reviewState(partial: Partial<ReviewState> = {}): ReviewState {
  return { phase: 'done', busy: false, drafts: [], costUsd: null, ...partial } as ReviewState;
}

const IDLE: LiveSources = {
  route: null,
  session: null,
  planSession: planSession(),
  runState: null,
  reviewState: null,
  decision: null
};

const REQUEST = "Write this project's documents";

describe('R6 — the pending turn only stands in when nothing is live', () => {
  it('a routed docs run produces a live turn, so the placeholder goes', () => {
    const live = liveTurns({ ...IDLE, route: 'docs', reviewState: reviewState(), request: REQUEST });
    expect(live).toHaveLength(1);
  });

  it('⚠️ but the route alone is not the signal — `startProjectReview` is awaited', () => {
    // `routePlan` sets the route and *then* awaits. There is a render in
    // between with a decided route and no producer state, and a rule that
    // dropped the placeholder there would blank the thread mid-send. The
    // derivation returns nothing here, which is exactly what keeps the
    // placeholder on screen.
    expect(liveTurns({ ...IDLE, route: 'docs', reviewState: null, request: REQUEST })).toEqual([]);
  });
});

describe('the request a docs run had nowhere to put', () => {
  it('reaches the turn', () => {
    const [turn] = liveTurns({ ...IDLE, route: 'docs', reviewState: reviewState(), request: REQUEST });
    expect(turn.request).toBe(REQUEST);
  });

  it('is absent rather than empty when there is none', () => {
    // A banner can open a review with nobody having typed anything.
    const [turn] = liveTurns({ ...IDLE, route: 'docs', reviewState: reviewState(), request: null });
    expect(turn).not.toHaveProperty('request');
  });

  it('survives being retired, so the record says what was asked for', () => {
    const retired = retiredTurns(0, { ...IDLE, route: 'docs', reviewState: reviewState(), request: REQUEST });
    expect(retired[0].request).toBe(REQUEST);
  });

  it('does not reach a component or plan turn, which already have it', () => {
    const sources: LiveSources = {
      ...IDLE,
      route: 'plan',
      planSession: planSession({
        plan: { request: 'Wire checkout in', operations: [{ id: 'op-1', kind: 'create', target: 'Pages/A', intent: 'x' }] }
      }),
      request: 'something else entirely'
    };
    // The plan's own request wins — one turn, one source of truth for what was
    // asked, and no chance of the two disagreeing on screen.
    expect(liveTurns(sources)[0].request).toBe('Wire checkout in');
  });
});

describe('retiredTurns', () => {
  it('is the retired half of `retireLive`, prefixed by position', () => {
    const sources: LiveSources = { ...IDLE, route: 'docs', reviewState: reviewState(), request: REQUEST };
    expect(retiredTurns(3, sources).map((turn) => turn.id)).toEqual(['history-3-docs-run']);
  });

  it('mounts no live control — the prefix is the liveness', () => {
    const sources: LiveSources = { ...IDLE, route: 'docs', reviewState: reviewState(), request: REQUEST };
    for (const turn of retiredTurns(0, sources)) {
      expect(turn.id.startsWith('component-')).toBe(false);
      expect(turn.id.startsWith('plan-')).toBe(false);
      expect(turn.id).not.toBe('docs-run');
    }
  });

  it('strips busy, so a stored turn cannot spin forever', () => {
    const sources: LiveSources = {
      ...IDLE,
      route: 'docs',
      reviewState: reviewState({ busy: true, phase: 'drafting' }),
      request: REQUEST
    };
    expect(liveTurns(sources)[0].busy).toBe(true);
    expect(retiredTurns(0, sources)[0]).not.toHaveProperty('busy');
  });

  it('returns nothing when there was nothing live', () => {
    expect(retiredTurns(0, IDLE)).toEqual([]);
  });
});
