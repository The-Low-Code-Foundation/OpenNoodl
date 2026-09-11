/**
 * TUT-002 AC3/AC4 at the learner's surface — the caller, and the sentence.
 *
 * The contract built in session 2 had no production path exercising it. These specs grade the
 * path: `checkMyWork` reads a snapshot, hands it to the same synchronous evaluator, and — when it
 * could not be read — says so **as its own kind of answer**, distinct from "you have not finished"
 * and distinct from "this lesson is broken".
 *
 * 🔴 The three-way distinction is the whole point and every spec here is one arm of it:
 *
 * | what happened | what the learner sees | whose problem |
 * |---|---|---|
 * | the collection is not there yet | step untucked, no sentence | theirs, and it is the lesson working |
 * | the project is bound to Directus | the refusal, naming Directus | theirs, and fixable in Backend Services |
 * | the lesson's condition is malformed | "the lesson's own conditions failed" | the author's |
 */

import { checkMyWork, summariseGrade } from '../../src/editor/src/models/lessoncheck';
import type { CheckMyWorkDeps } from '../../src/editor/src/models/lessoncheck';
import type { LearningEntryView } from '../../src/editor/src/models/learningfolder';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import { buildLessonEvidence, gradeLessonSteps } from '../../src/editor/src/models/lessongrading';
import type { LessonEvalContext, LessonDatabaseSnapshot } from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const OK: LessonDatabaseSnapshot = {
  status: 'ok',
  collections: [{ name: 'Puppies', columns: ['name', 'age'], rowCount: 1 }]
};
const REFUSED: LessonDatabaseSnapshot = { status: 'refused', binding: 'Directus (https://data.example.com)' };
const DOWN: LessonDatabaseSnapshot = { status: 'unavailable', reason: 'ECONNREFUSED' };

function emptyContext(): LessonEvalContext {
  return {
    components: [{ name: 'App', graph: { roots: [] } }],
    rootNode: undefined,
    getMetaData: () => undefined,
    viewerPath: undefined,
    activeComponentName: 'App'
  };
}

const DATA_LESSON: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'Save a puppy',
  steps: [{ title: 'Save one', completeWhen: [{ collection: 'Puppies', rowCountAtLeast: 1 }] }]
};

const GRAPH_LESSON: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'Put a Group on the page',
  steps: [{ title: 'Add a Group', completeWhen: [{ node: 'App:%Group', exists: true }] }]
};

const entry: LearningEntryView = {
  id: 'save-a-puppy',
  title: 'Save a puppy',
  provenance: 'local',
  projectDirectory: '/learning/save-a-puppy',
  source: { kind: 'local', path: '/bundles/save-a-puppy' },
  installedAt: '2026-08-20T09:00:00.000Z',
  missing: false
};

function deps(overrides: Partial<CheckMyWorkDeps> = {}): CheckMyWorkDeps {
  return {
    register: {
      get: (id: string) => (id === entry.id ? entry : undefined),
      recordGrade: () => undefined,
      recordSubmission: () => undefined
    },
    readManifest: () => DATA_LESSON,
    evalContext: emptyContext,
    now: () => '2026-08-20T10:00:00.000Z',
    ...overrides
  };
}

// ─── The caller ─────────────────────────────────────────────────────────────

describe('checkMyWork reads the database — and only when the lesson grades one', () => {
  it('🔴 calls readDatabase for a data lesson, and the step ticks off the snapshot', async () => {
    let reads = 0;
    const outcome = await checkMyWork(
      entry.id,
      deps({
        readDatabase: async () => {
          reads++;
          return OK;
        }
      })
    );

    expect(reads).toBe(1);
    expect(outcome.result).toBe('graded');
    // The step passes on data alone: the context carries no nodes at all.
    expect(outcome.result === 'graded' && outcome.grade.steps[0].passed).toBe(true);
  });

  it('🔴 does NOT read the database for a lesson that never mentions one', async () => {
    // The guard that keeps a graph-only lesson free: every "check my work" would otherwise open
    // an HTTP conversation with a backend the lesson has no interest in.
    let reads = 0;
    await checkMyWork(
      entry.id,
      deps({
        readManifest: () => GRAPH_LESSON,
        readDatabase: async () => {
          reads++;
          return OK;
        }
      })
    );
    expect(reads).toBe(0);
  });

  it('an editor with no reader wired grades exactly as before — it just cannot tick a data step', async () => {
    const outcome = await checkMyWork(entry.id, deps());
    expect(outcome.result).toBe('graded');
    expect(outcome.result === 'graded' && outcome.grade.steps[0].passed).toBe(false);
    // …and says why, rather than leaving it looking like a learner who has not got there.
    expect(outcome.result === 'graded' && outcome.summary).toMatch(/nothing read it/);
  });

  it('a reader that throws becomes an unavailable snapshot, not a failed check', async () => {
    // `checkMyWork`'s `unavailable` outcome means NOTHING was graded and nothing written. A
    // database that would not answer must not cost the learner the rest of their grade.
    const outcome = await checkMyWork(
      entry.id,
      deps({
        readDatabase: async () => {
          throw new Error('the backend manager went away');
        }
      })
    );
    expect(outcome.result).toBe('graded');
    expect(outcome.result === 'graded' && outcome.summary).toMatch(/the backend manager went away/);
  });
});

// ─── The three answers ──────────────────────────────────────────────────────

describe('a step that could not be graded is not a step the learner failed', () => {
  it('🔴 marks the step unevaluable and names the binding', () => {
    const [step] = gradeLessonSteps(DATA_LESSON, { ...emptyContext(), database: REFUSED });

    expect(step.passed).toBe(false);
    expect(step.unevaluable).toMatch(/Directus \(https:\/\/data\.example\.com\)/);
    // 🔴 NOT `error`. `error` means the lesson's own condition is broken, and `summariseGrade`
    // says exactly that — sending a learner to look for a mistake in a lesson that is fine.
    expect(step.error).toBeUndefined();
  });

  it('🔴 the known-firing control: the same step against a LOCAL binding is graded normally', () => {
    // Without this pair, "unevaluable" and "nobody asked" read identically — and they have
    // opposite fixes.
    const [step] = gradeLessonSteps(DATA_LESSON, { ...emptyContext(), database: OK });
    expect(step.unevaluable).toBeUndefined();
    expect(step.passed).toBe(true);
  });

  it('a database that is ours and could not be read reports the reason, not the binding', () => {
    const [step] = gradeLessonSteps(DATA_LESSON, { ...emptyContext(), database: DOWN });
    expect(step.unevaluable).toMatch(/ECONNREFUSED/);
    expect(step.unevaluable).not.toMatch(/bound to/);
  });

  it('🔴 an empty database is a real answer: the step is graded, and fails honestly', () => {
    // The one arm that must NOT be unevaluable. "The learner has not made the collection yet" is
    // what a data lesson looks like at step one, and reporting it as unreadable would put a
    // refusal sentence on screen for a backend that is working perfectly.
    const [step] = gradeLessonSteps(DATA_LESSON, { ...emptyContext(), database: { status: 'ok', collections: [] } });
    expect(step.unevaluable).toBeUndefined();
    expect(step.passed).toBe(false);
  });

  it('a graph-only step is untouched by any of this', () => {
    const [step] = gradeLessonSteps(GRAPH_LESSON, { ...emptyContext(), database: REFUSED });
    expect(step.unevaluable).toBeUndefined();
    expect(step.passed).toBe(false);
  });
});

// ─── The sentence ───────────────────────────────────────────────────────────

describe('what the learner reads', () => {
  function summaryFor(database: LessonDatabaseSnapshot | undefined): string {
    const steps = gradeLessonSteps(DATA_LESSON, { ...emptyContext(), ...(database ? { database } : {}) });
    const grade = {
      steps,
      stepsGraded: 1,
      stepsPassed: steps[0].passed ? 1 : 0,
      firstIncompleteStep: steps[0].passed ? -1 : 0,
      completionPercent: steps[0].passed ? 100 : 0
    };
    return summariseGrade(grade, buildLessonEvidence(DATA_LESSON, grade, { gradedAt: 'now' }));
  }

  it('🔴 does not tell the learner the lesson is broken when the database is', () => {
    const summary = summaryFor(REFUSED);
    expect(summary).toMatch(/bound to Directus/);
    // The sentence `error` would have produced. Wrong twice: wrong culprit, wrong fix.
    expect(summary).not.toMatch(/the lesson's own conditions failed/);
  });

  it('says nothing extra when the database was read and the learner simply is not there yet', () => {
    const summary = summaryFor({ status: 'ok', collections: [] });
    expect(summary).toMatch(/still to do/);
    expect(summary).not.toMatch(/database/);
  });

  it('an unavailable database withholds completion rather than granting it', () => {
    // The `wholeSolution.unavailable` rule, applied to engine 1: a check that could not run has
    // not passed anybody.
    const steps = gradeLessonSteps(DATA_LESSON, { ...emptyContext(), database: DOWN });
    const grade = { steps, stepsGraded: 1, stepsPassed: 0, firstIncompleteStep: 0, completionPercent: 0 };
    expect(buildLessonEvidence(DATA_LESSON, grade, { gradedAt: 'now' }).complete).toBeFalsy();
  });
});
