/**
 * UNI-007 / D5 — what a Learning-folder entry becomes on its card.
 *
 * The load-bearing assertion in this file is that **a recorded grade decides
 * completion and step progress never does**. Reaching the last card means the
 * learner read every instruction; whether the graded steps passed — and whether
 * the project drew anything, and whether engine 2 ran at all — is decided once,
 * in `buildLessonEvidence().complete`. A card that inferred "Completed" from
 * 100% progress would be a second, weaker completion rule sitting beside the
 * real one, which is the defect shape this task has now produced twice.
 */

import type { LearningEntryView } from '../../src/editor/src/models/learningfolder';
import {
  learningCardState,
  learningProgressPercent,
  toLearningCard,
  toLearningCards
} from '../../src/editor/src/views/projectsview.learningstate';

function entry(over: Partial<LearningEntryView> = {}): LearningEntryView {
  return {
    id: 'make-a-group',
    title: 'Make a Group',
    provenance: 'curated',
    projectDirectory: '/data/Learning/make-a-group',
    source: { kind: 'local', path: '/bundles/groups' },
    installedAt: '2026-08-15T00:00:00.000Z',
    missing: false,
    ...over
  };
}

describe('learningProgressPercent', () => {
  it('reads stepIndex as the step the learner is ON, not the count finished', () => {
    // The off-by-one `getLessonsState` already handles for hosted lessons: the
    // last step is stepCount - 1, so a naive index/count shows 83% to someone
    // who has reached the end.
    expect(learningProgressPercent({ stepIndex: 0, stepCount: 6 })).toBe(0);
    expect(learningProgressPercent({ stepIndex: 3, stepCount: 6 })).toBe(60);
    expect(learningProgressPercent({ stepIndex: 5, stepCount: 6 })).toBe(100);
  });

  it('is 0 rather than NaN for the shapes a register can hold', () => {
    expect(learningProgressPercent(undefined)).toBe(0);
    expect(learningProgressPercent({ stepIndex: 0, stepCount: 0 })).toBe(0);
    expect(learningProgressPercent({ stepIndex: 0, stepCount: 1 })).toBe(0);
  });

  it('clamps a value that should not be possible', () => {
    expect(learningProgressPercent({ stepIndex: 99, stepCount: 6 })).toBe(100);
    expect(learningProgressPercent({ stepIndex: -3, stepCount: 6 })).toBe(0);
  });
});

describe('learningCardState', () => {
  it('is not-started with no progress and no grade', () => {
    expect(learningCardState(entry())).toBe('not-started');
    expect(learningCardState(entry({ progress: { stepIndex: 0, stepCount: 6 } }))).toBe('not-started');
  });

  it('is in-progress once the learner has moved off the first step', () => {
    expect(learningCardState(entry({ progress: { stepIndex: 1, stepCount: 6 } }))).toBe('in-progress');
  });

  it('🔴 does NOT call a lesson complete on step progress alone', () => {
    // Read every card, passed nothing. The card must not say "Completed".
    const readEverything = entry({ progress: { stepIndex: 5, stepCount: 6 } });
    expect(learningProgressPercent(readEverything.progress)).toBe(100);
    expect(learningCardState(readEverything)).toBe('in-progress');
  });

  it('is completed only when a recorded grade says so', () => {
    expect(
      learningCardState(
        entry({
          progress: { stepIndex: 5, stepCount: 6 },
          grade: { completionPercent: 100, complete: true, gradedAt: 'x', gradedBy: 'runner' }
        })
      )
    ).toBe('completed');
  });

  it('is in-progress for a grade that did not complete, however high the score', () => {
    expect(
      learningCardState(
        entry({ grade: { completionPercent: 100, complete: false, gradedAt: 'x', gradedBy: 'runner' } })
      )
    ).toBe('in-progress');
  });
});

describe('toLearningCard', () => {
  it('keeps progress and score as separate numbers', () => {
    // On the last step, failing two of five graded ones. One number for both
    // would hide exactly this case.
    const card = toLearningCard(
      entry({
        progress: { stepIndex: 5, stepCount: 6 },
        grade: { completionPercent: 60, complete: false, gradedAt: 'x', gradedBy: 'runner' }
      })
    );

    expect(card.progressPercent).toBe(100);
    expect(card.score).toBe(60);
    expect(card.state).toBe('in-progress');
  });

  it('omits score entirely when nothing has been graded', () => {
    const card = toLearningCard(entry());
    expect(card.score).toBeUndefined();
    expect(card.gradedBy).toBeUndefined();
    expect(card.feedback).toBeUndefined();
  });

  it('carries a human reviewer and their feedback', () => {
    const card = toLearningCard(
      entry({
        grade: {
          completionPercent: 80,
          complete: false,
          gradedAt: 'x',
          gradedBy: 'human',
          feedback: 'The button works but nothing tells the user it did.'
        }
      })
    );

    expect(card.gradedBy).toBe('human');
    expect(card.feedback).toMatch(/nothing tells the user/);
  });

  it('surfaces "the check could not run" as its own thing, never as a failure', () => {
    const card = toLearningCard(
      entry({
        grade: {
          completionPercent: 100,
          complete: false,
          gradedAt: 'x',
          gradedBy: 'runner',
          wholeSolution: { valid: true, rendered: false, findingCount: 0, unavailable: true }
        }
      })
    );

    expect(card.checkUnavailable).toBe(true);
    expect(card.state).toBe('in-progress');
  });

  it('does not set checkUnavailable when engine 2 ran and simply failed', () => {
    const card = toLearningCard(
      entry({
        grade: {
          completionPercent: 100,
          complete: false,
          gradedAt: 'x',
          gradedBy: 'runner',
          wholeSolution: { valid: true, rendered: false, findingCount: 1 }
        }
      })
    );

    expect(card.checkUnavailable).toBeUndefined();
  });

  it('passes provenance through so the card can say who wrote the lesson', () => {
    expect(toLearningCard(entry({ provenance: 'local-ai' })).provenance).toBe('local-ai');
    expect(toLearningCard(entry({ provenance: 'org' })).provenance).toBe('org');
  });

  it('marks a missing folder', () => {
    expect(toLearningCard(entry({ missing: true })).missing).toBe(true);
    expect(toLearningCard(entry({ missing: false })).missing).toBeUndefined();
  });

  it('maps a list in order', () => {
    expect(toLearningCards([entry({ id: 'a' }), entry({ id: 'b' })]).map((c) => c.id)).toEqual(['a', 'b']);
    expect(toLearningCards([])).toEqual([]);
  });
});

/**
 * P79 J3 — every shipped lesson was badged "Written locally" instead of "NodeGX".
 *
 * Measured by the session-8 lesson-runner drive: all 8 seeded entries carried
 * `provenance: "local-ai"` and all 8 cards read **Written locally**.
 *
 * 🔴 The field meant two things and only one was intended. `lessonseed` installs shipped
 * lessons as `curated` — *"they are editorial, and a person stands behind them"* — and their
 * manifests declare `authoredBy: "ai"`, so `resolveProvenance` downgrades them to `local-ai`.
 * That downgrade is CORRECT and deliberate: it buys the stricter install gate the seed
 * explicitly refuses to dodge. What was wrong is that the shelf read the gate's field as an
 * authorship claim. So the badge gets an input of its own — see `badgeProvenance`.
 */
describe('P79 J3 — the badge and the gate are two questions', () => {
  const shipped = (over: Record<string, unknown> = {}) =>
    entry({ id: 'shipped_poke-it', provenance: 'local-ai', ...over });

  it('🔴 a shipped lesson downgraded for the gate is still badged as ours', () => {
    expect(toLearningCard(shipped()).provenance).toBe('curated');
  });

  it('prefers the recorded origin over everything', () => {
    expect(toLearningCard(shipped({ origin: 'curated' })).provenance).toBe('curated');
    expect(toLearningCard(entry({ id: 'from-a-folder', provenance: 'local-ai', origin: 'local' })).provenance).toBe(
      'local'
    );
  });

  it('⚠️ the id arm is a migration, and only for ids the seed mints', () => {
    // An entry written before `origin` existed and NOT shipped by us keeps reading the gate
    // class — which is the honest answer for a bundle nobody claimed.
    expect(toLearningCard(entry({ id: 'poke-it', provenance: 'local-ai' })).provenance).toBe('local-ai');
    expect(toLearningCard(entry({ id: 'shippedish', provenance: 'local-ai' })).provenance).toBe('local-ai');
  });

  it('does not relabel a genuinely local bundle', () => {
    expect(toLearningCard(entry({ id: 'mine', provenance: 'local' })).provenance).toBe('local');
    expect(toLearningCard(entry({ id: 'assigned', provenance: 'org' })).provenance).toBe('org');
  });

  it('🔴 the gate class on the entry is untouched — only the card changed', () => {
    const e = shipped();
    expect(e.provenance).toBe('local-ai');
    expect(toLearningCard(e).provenance).toBe('curated');
  });
});
