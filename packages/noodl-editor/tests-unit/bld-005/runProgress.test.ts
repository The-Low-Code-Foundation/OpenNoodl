/**
 * BLD-005 — the long run is legible.
 *
 * The task is mostly placement: AIB-002 already built position, elapsed, cost
 * and a per-operation clock, and they feel like nothing because they render
 * *inside* the scroll area and are gone thirty seconds in. Placement is driven,
 * not specced — a pinned element is exactly the thing a screenshot at three
 * scroll depths settles.
 *
 * What is specced here is the half a screenshot cannot settle.
 *
 * **An estimate is the same pixels whether it came from one sample or five.**
 * There is no way to look at *"about 4m left (estimate)"* and tell whether the
 * rule that produced it was honest. That makes it precisely the BLD-002 case —
 * grade the invisible half — and the acceptance criterion ("no estimate before
 * two operations complete; never count down past zero") is written as three
 * separate refusals below, because each of them is a different way for the same
 * pixels to be a lie.
 *
 * **The stop sentence has a recorded failure.** The panel shipped *"The 1
 * document are written last"* (AIB-009 F4) — a count interpolated into a
 * sentence whose verb was not. Every branch that takes a number is pinned.
 */

import type { PlanOperationState, PlanRunState } from '@noodl-models/AiAssistant/authoring';
import {
  completedDurations,
  estimateRemaining,
  formatCost,
  formatEstimate,
  MIN_ESTIMATE_SAMPLES,
  operationRole,
  runHeadline,
  runPosition,
  stopCost
} from '@noodl-models/AiAssistant/thread';

/** A component operation, with whatever status and clock the case needs. */
function op(
  id: string,
  status: PlanOperationState['status'],
  clock?: { startedAt?: number; endedAt?: number },
  kind: 'create' | 'doc' = 'create'
): PlanOperationState {
  return {
    operation: { id, kind, target: `Pages/${id}` } as PlanOperationState['operation'],
    status,
    ...clock
  };
}

/** A finished operation that took `ms`, on a clock starting at 0. */
const took = (id: string, ms: number, status: PlanOperationState['status'] = 'staged') =>
  op(id, status, { startedAt: 0, endedAt: ms });

function runState(operations: PlanOperationState[], extra: Partial<PlanRunState> = {}): PlanRunState {
  return { busy: true, phase: 'running', operations, costUsd: 0, ...extra };
}

describe('estimateRemaining', () => {
  it('refuses to estimate from a single sample', () => {
    // The acceptance criterion, and the reason it exists: one operation is not a
    // distribution. The first one is routinely the fastest or the slowest, and
    // extrapolating six from it produces a number that looks measured.
    const operations = [took('a', 60_000), op('b', 'authoring', { startedAt: 60_000 }), op('c', 'pending')];

    expect(completedDurations(operations)).toHaveLength(1);
    expect(estimateRemaining(operations, 70_000)).toBeUndefined();
  });

  it('estimates once two operations have finished', () => {
    const operations = [
      took('a', 60_000),
      took('b', 100_000),
      op('c', 'authoring', { startedAt: 160_000 }),
      op('d', 'pending')
    ];

    // Median of 60s and 100s is 80s. One pending operation, plus what is left of
    // the current one: 80s − 10s elapsed = 70s. 150s in total.
    expect(estimateRemaining(operations, 170_000)).toBe(150_000);
  });

  it('never counts down past zero — it stops saying instead', () => {
    // ⚠️ The criterion this task called out by name. The current operation has
    // outlived the typical one and nothing is queued behind it, so the only
    // honest answers are "no idea" and a number that is already wrong. A
    // countdown sitting at 0:00 while the run continues is a claim that is
    // visibly, continuously false — worse than the absence it replaced.
    const operations = [took('a', 60_000), took('b', 60_000), op('c', 'authoring', { startedAt: 120_000 })];

    expect(estimateRemaining(operations, 180_000)).toBeUndefined();
    // And it did not go negative on the way there.
    expect(estimateRemaining(operations, 600_000)).toBeUndefined();
  });

  it('holds at the pending work rather than reaching zero while work remains', () => {
    // Same overrun, but two operations are still queued. The estimate floors at
    // what those two will cost instead of collapsing to nothing.
    const operations = [
      took('a', 60_000),
      took('b', 60_000),
      op('c', 'authoring', { startedAt: 120_000 }),
      op('d', 'pending'),
      op('e', 'pending')
    ];

    expect(estimateRemaining(operations, 600_000)).toBe(120_000);
  });

  it('does not let skipped operations poison the median', () => {
    // A skipped operation ends microseconds after it starts. Two of them in the
    // sample make the median ~0 and the header reads "about 0s left" for a run
    // with real work queued — an estimate that is not merely wrong but confidently
    // wrong, in the direction that makes someone stop watching.
    const operations = [
      op('a', 'skipped', { startedAt: 0, endedAt: 1 }),
      op('b', 'skipped', { startedAt: 1, endedAt: 2 }),
      took('c', 120_000),
      op('d', 'pending')
    ];

    expect(completedDurations(operations)).toEqual([120_000]);
    expect(estimateRemaining(operations, 130_000)).toBeUndefined();
  });

  it('says nothing when there is nothing left to do', () => {
    const operations = [took('a', 60_000), took('b', 60_000)];

    expect(estimateRemaining(operations, 200_000)).toBeUndefined();
  });

  it('prefers the median to the mean, so one repair loop does not drag the rest up', () => {
    // 30s, 30s, 8m. The mean is ~3m and would tell the user the remaining two
    // operations cost six minutes; the median says one.
    const operations = [
      took('a', 30_000),
      took('b', 30_000),
      took('c', 480_000),
      op('d', 'pending'),
      op('e', 'pending')
    ];

    expect(estimateRemaining(operations, 540_000)).toBe(60_000);
  });

  it('MIN_ESTIMATE_SAMPLES is the number the acceptance criterion names', () => {
    expect(MIN_ESTIMATE_SAMPLES).toBe(2);
  });
});

describe('formatEstimate', () => {
  it('labels an estimate as one', () => {
    // It sits inches from a measured elapsed time. Unlabelled, the two read as
    // the same kind of fact.
    expect(formatEstimate(150_000)).toBe('about 2m 30s left (estimate)');
  });

  it('passes the absence through rather than inventing a phrase for it', () => {
    expect(formatEstimate(undefined)).toBeUndefined();
  });
});

describe('runPosition', () => {
  it('counts the operation being worked on while the run is live', () => {
    const state = runState([op('a', 'staged'), op('b', 'authoring'), op('c', 'pending')], {
      activeOperationId: 'b'
    });

    expect(runPosition(state)).toBe('Building 2 of 3');
  });

  it('counts what was actually built once the run stops, not what it attempted', () => {
    // A run that failed twice must not report "3 of 3 built". This is the whole
    // difference between the live form and the finished one.
    const state = runState([op('a', 'staged'), op('b', 'failed'), op('c', 'failed')], {
      busy: false,
      phase: 'done'
    });

    expect(runPosition(state)).toBe('1 of 3 built');
  });

  it('counts a cancelled run by what survived it', () => {
    const state = runState([op('a', 'staged'), op('b', 'staged'), op('c', 'skipped')], {
      busy: false,
      phase: 'cancelled'
    });

    expect(runPosition(state)).toBe('2 of 3 built');
  });
});

describe('stopCost', () => {
  it('states the cost of stopping even when the plan has no documents', () => {
    // The gap this replaces: the old sentence rendered only when documents were
    // pending, so a component-only run offered Stop with no statement of its cost
    // at all.
    const operations = [op('a', 'staged'), op('b', 'staged'), op('c', 'authoring')];

    expect(stopCost(operations)).toBe('Stopping keeps the 2 built so far.');
  });

  it('does not claim to keep anything before anything is built', () => {
    const operations = [op('a', 'authoring'), op('b', 'pending')];

    expect(stopCost(operations)).toBe('Stopping keeps nothing — no operation has finished yet.');
  });

  it('agrees with its own verb at one document', () => {
    // ⚠️ AIB-009 F4, as a spec. "The 1 document are written last" is what this
    // said on screen — the count was interpolated and the verb was not.
    const operations = [op('a', 'staged'), op('doc', 'pending', undefined, 'doc')];
    const sentence = stopCost(operations);

    expect(sentence).toContain('The document is written last');
    expect(sentence).toContain('you can write it afterwards');
    expect(sentence).not.toContain('The 1 document');
  });

  it('agrees with its own verb at several documents', () => {
    const operations = [
      op('a', 'staged'),
      op('d1', 'pending', undefined, 'doc'),
      op('d2', 'pending', undefined, 'doc')
    ];
    const sentence = stopCost(operations);

    expect(sentence).toContain('The 2 documents are written last');
    expect(sentence).toContain('you can write them afterwards');
  });

  it('says nothing about documents that are already written', () => {
    const operations = [op('a', 'staged'), op('doc', 'staged', undefined, 'doc')];

    expect(stopCost(operations)).toBe('Stopping keeps the 2 built so far.');
  });

  it('never interpolates a bare number next to a mismatched noun', () => {
    // A sweep rather than a case: every count from 0 to 4, in both halves of the
    // sentence, has to read as English. This is the shape of check that would
    // have caught F4 the first time.
    for (let built = 0; built <= 4; built++) {
      for (let docs = 0; docs <= 4; docs++) {
        const operations = [
          ...Array.from({ length: built }, (_, i) => op(`c${i}`, 'staged')),
          ...Array.from({ length: docs }, (_, i) => op(`d${i}`, 'pending', undefined, 'doc'))
        ];
        const sentence = stopCost(operations);

        expect(sentence).not.toMatch(/\b1 documents\b/);
        expect(sentence).not.toMatch(/\bThe 1 document are\b/);
        expect(sentence).not.toMatch(/\b(\d+) documents is\b/);
        expect(sentence).not.toMatch(/\bkeeps the 1 built\b/);
      }
    }
  });
});

describe('operationRole', () => {
  it('gives the operation being worked on a role no other status has', () => {
    // The acceptance criterion "identifiable without reading text" needs a hook
    // the stylesheet can key off, and it has to be unique — the task's complaint
    // is that `authoring` renders the same static wand as the row above it.
    const others = (['pending', 'staged', 'failed', 'skipped'] as const).map((status) =>
      operationRole(op('x', status))
    );

    expect(operationRole(op('x', 'authoring'))).toBe('current');
    expect(others).not.toContain('current');
  });

  it('maps every status to a distinct role', () => {
    const statuses = ['pending', 'authoring', 'staged', 'failed', 'skipped'] as const;
    const roles = statuses.map((status) => operationRole(op('x', status)));

    expect(new Set(roles).size).toBe(statuses.length);
  });
});

describe('runHeadline', () => {
  it('carries position, elapsed and cost, and no estimate it cannot support', () => {
    const state = runState([took('a', 60_000), op('b', 'authoring', { startedAt: 60_000 })], {
      activeOperationId: 'b',
      startedAt: 0,
      costUsd: 0.42
    });

    expect(runHeadline(state, 90_000)).toBe('Building 2 of 2 · 1m 30s · $0.42');
  });

  it('adds the estimate once it is honest', () => {
    const state = runState(
      [took('a', 60_000), took('b', 60_000), op('c', 'authoring', { startedAt: 120_000 }), op('d', 'pending')],
      { activeOperationId: 'c', startedAt: 0, costUsd: 0.42 }
    );

    expect(runHeadline(state, 150_000)).toBe(
      'Building 3 of 4 · 2m 30s · $0.42 · about 1m 30s left (estimate)'
    );
  });

  it('never offers an estimate for a run that has stopped', () => {
    // Nothing is coming, so a remaining-time figure would be describing work that
    // does not exist.
    const state = runState([took('a', 60_000), took('b', 60_000)], {
      busy: false,
      phase: 'done',
      startedAt: 0,
      endedAt: 120_000,
      costUsd: null
    });

    // "2m 0s", not "2m" — AIB-002's formatter, moved verbatim rather than
    // tidied. Changing how every existing duration in this panel reads is not
    // this task's to do on the way past.
    expect(runHeadline(state, 999_999)).toBe('2 of 2 built · 2m 0s · cost unknown');
  });

  it('refuses to print $0.00 for unknown pricing', () => {
    // AIB-002's rule, pinned where the headline assembles it: in an alpha where
    // everyone brings their own key, "free" is the one wrong answer that costs money.
    expect(formatCost(null)).toBe('cost unknown');
    expect(formatCost(0.0004)).toBe('$0.0004');
    expect(formatCost(1.5)).toBe('$1.50');
  });
});
