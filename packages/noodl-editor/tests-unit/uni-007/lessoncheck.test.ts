/**
 * UNI-007 slice 4 — **"check my work"**, the grading runner's first caller.
 *
 * Until this slice `models/lessongrading.ts` was not in the renderer bundle at
 * all: no editor module imported it, so both engines, engine 2's adapter and
 * their specs were code nothing could reach. These specs grade the flow that
 * reaches it — find the lesson, re-read its manifest, grade, record — and the
 * sentence the learner is shown, which carries the one rule that matters most
 * to get right: **"the check could not run" is neither a pass nor a failure.**
 */

import { checkMyWork, summariseGrade } from '../../src/editor/src/models/lessoncheck';
import type { CheckMyWorkDeps } from '../../src/editor/src/models/lessoncheck';
import type { LearningEntryView } from '../../src/editor/src/models/learningfolder';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import { buildLessonEvidence } from '../../src/editor/src/models/lessongrading';
import type { LessonEvidence, LessonGrade, WholeSolutionResult } from '../../src/editor/src/models/lessongrading';
import type {
  LessonComponent,
  LessonEvalContext,
  LessonNode
} from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function node(label: string, type: string, children: LessonNode[] = []): LessonNode {
  return {
    id: label,
    label,
    type: { name: type },
    ports: [],
    parameters: {},
    children,
    getPort: () => undefined,
    forAllConnectionsOnThisNode: () => undefined
  };
}

function context(roots: LessonNode[]): LessonEvalContext {
  const components: LessonComponent[] = [{ name: 'App', graph: { roots } }];
  return {
    components,
    rootNode: roots[0],
    getMetaData: () => undefined,
    viewerPath: undefined,
    activeComponentName: 'App'
  };
}

const manifest: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'State on a page',
  steps: [
    { kind: 'popup', body: 'Welcome' },
    { title: 'Add a Group', completeWhen: [{ node: 'App:%Group', exists: true }] },
    { title: 'Add a Text', completeWhen: [{ node: 'App:%Text', exists: true }] }
  ]
};

const entry: LearningEntryView = {
  id: 'state-on-a-page',
  title: 'State on a page',
  provenance: 'local',
  projectDirectory: '/learning/state-on-a-page',
  source: { kind: 'local', path: '/bundles/state-on-a-page' },
  installedAt: '2026-08-15T09:00:00.000Z',
  missing: false
};

interface Recorded {
  id: string;
  evidence: LessonEvidence;
  options?: { gradedBy?: 'runner' | 'human'; feedback?: string; gradedAt?: string };
}

function deps(overrides: Partial<CheckMyWorkDeps> = {}, recorded: Recorded[] = []): CheckMyWorkDeps {
  return {
    register: {
      get: (id: string) => (id === entry.id ? entry : undefined),
      recordGrade: (id, evidence, options) => {
        recorded.push({ id, evidence, options });
        return undefined;
      }
    },
    readManifest: () => manifest,
    evalContext: () => context([node('Card', 'Group'), node('T', 'Text')]),
    now: () => '2026-08-15T10:00:00.000Z',
    ...overrides
  };
}

// ─── Refusals ───────────────────────────────────────────────────────────────

describe('checkMyWork — what it refuses to grade', () => {
  it('says so when the open project is not a lesson, rather than grading nothing', async () => {
    const outcome = await checkMyWork('some-ordinary-project', deps());
    expect(outcome).toEqual({ result: 'unavailable', reason: 'This project is not a lesson from your Learning section.' });
  });

  it('says so when there is no project id at all', async () => {
    const outcome = await checkMyWork(undefined, deps());
    expect(outcome.result).toBe('unavailable');
  });

  it('points at reset when the lesson folder has gone', async () => {
    const missing = { ...entry, missing: true };
    const outcome = await checkMyWork(entry.id, deps({ register: { get: () => missing, recordGrade: () => undefined } }));

    expect(outcome.result).toBe('unavailable');
    expect(outcome.result === 'unavailable' && outcome.reason).toContain('Reset it');
  });

  it('says so when the manifest cannot be read, rather than grading zero steps as a pass', async () => {
    const outcome = await checkMyWork(entry.id, deps({ readManifest: () => undefined }));

    expect(outcome.result).toBe('unavailable');
    expect(outcome.result === 'unavailable' && outcome.reason).toContain('lesson.json');
  });

  it('records nothing when it refuses', async () => {
    const recorded: Recorded[] = [];
    await checkMyWork(entry.id, deps({ readManifest: () => undefined }, recorded), );
    expect(recorded).toHaveLength(0);
  });

  it('turns a context that cannot be built into "could not run", not a failed lesson', async () => {
    const outcome = await checkMyWork(
      entry.id,
      deps({
        evalContext: () => {
          throw new Error('no project is open');
        }
      })
    );

    expect(outcome.result).toBe('unavailable');
    expect(outcome.result === 'unavailable' && outcome.reason).toContain('no project is open');
  });
});

// ─── Grading and recording ──────────────────────────────────────────────────

describe('checkMyWork — the grade it records', () => {
  it('grades the open project per step and writes the evidence to the register', async () => {
    const recorded: Recorded[] = [];
    const outcome = await checkMyWork(entry.id, deps({}, recorded));

    expect(outcome.result).toBe('graded');
    expect(recorded).toHaveLength(1);
    expect(recorded[0].id).toBe(entry.id);
    expect(recorded[0].evidence.stepsPassed).toBe(2);
    expect(recorded[0].options?.gradedBy).toBe('runner');
  });

  it('grades a deliberately-wrong attempt differently, with no model call', async () => {
    const recorded: Recorded[] = [];
    const outcome = await checkMyWork(entry.id, deps({ evalContext: () => context([node('Card', 'Group')]) }, recorded));

    expect(outcome.result === 'graded' && outcome.grade.stepsPassed).toBe(1);
    expect(outcome.result === 'graded' && outcome.evidence.complete).toBe(false);
    expect(recorded[0].evidence.completionPercent).toBe(50);
  });

  it('takes provenance from the register, never from the manifest', async () => {
    const recorded: Recorded[] = [];
    // A bundle that declares itself curated would be believed; one producer of
    // this format is an agent on the user's own machine.
    const lying = { ...manifest, provenance: 'curated' } as LessonManifest;
    await checkMyWork(entry.id, deps({ readManifest: () => lying }, recorded));

    expect(recorded[0].evidence.provenance).toBe('local');
  });

  it('stamps the grade with the caller’s clock', async () => {
    const recorded: Recorded[] = [];
    await checkMyWork(entry.id, deps({}, recorded));
    expect(recorded[0].evidence.gradedAt).toBe('2026-08-15T10:00:00.000Z');
  });

  it('stores the learner-facing sentence as the card’s feedback', async () => {
    const recorded: Recorded[] = [];
    const outcome = await checkMyWork(entry.id, deps({}, recorded));

    expect(outcome.result === 'graded' && recorded[0].options?.feedback).toBe(
      outcome.result === 'graded' ? outcome.summary : ''
    );
  });

  it('runs engine 2 when one is supplied, and lets an empty page withhold completion', async () => {
    const recorded: Recorded[] = [];
    const empty: WholeSolutionResult = { valid: true, rendered: true, drawnElementCount: 0, findings: [] };
    const outcome = await checkMyWork(
      entry.id,
      deps({ wholeSolution: { check: async () => empty } }, recorded)
    );

    // Every step passed, and the lesson is still not complete: `gradeLesson`
    // normalises the claimed render away, and completion reads the result.
    expect(outcome.result === 'graded' && outcome.grade.firstIncompleteStep).toBe(-1);
    expect(recorded[0].evidence.complete).toBe(false);
    expect(recorded[0].evidence.wholeSolution).toMatchObject({ rendered: false });
  });

  it('withholds completion — without failing anyone — when engine 2 could not run', async () => {
    const recorded: Recorded[] = [];
    const cannot: WholeSolutionResult = {
      valid: true,
      rendered: false,
      findings: [],
      unavailable: 'The render could not run: no viewer'
    };
    await checkMyWork(entry.id, deps({ wholeSolution: { check: async () => cannot } }, recorded));

    expect(recorded[0].evidence.complete).toBe(false);
    // 🔴 A flag, never the sentence — the sentence names a filesystem and this
    // bundle is the thing that leaves one.
    expect(recorded[0].evidence.wholeSolution?.unavailable).toBe(true);
  });
});

// ─── The sentence ───────────────────────────────────────────────────────────

function gradeOf(steps: LessonGrade['steps'], whole?: WholeSolutionResult): LessonGrade {
  const graded = steps.filter((s) => s.graded);
  const passed = graded.filter((s) => s.passed);
  return {
    steps,
    stepsGraded: graded.length,
    stepsPassed: passed.length,
    firstIncompleteStep: steps.findIndex((s) => s.graded && !s.passed),
    completionPercent: graded.length === 0 ? 100 : Math.round((passed.length / graded.length) * 100),
    ...(whole ? { wholeSolution: whole } : {})
  };
}

const step = (index: number, passed: boolean, title?: string, error?: string) => ({
  index,
  title,
  kind: 'card' as const,
  graded: true,
  passed,
  conditionCount: 1,
  ...(error ? { error } : {})
});

describe('summariseGrade — what the learner reads', () => {
  const evidence = (grade: LessonGrade) => buildLessonEvidence(manifest, grade);

  it('names the first step still to do, by its title', () => {
    const grade = gradeOf([step(0, true, 'Add a Group'), step(1, false, 'Add a Text')]);
    const summary = summariseGrade(grade, evidence(grade));

    expect(summary).toContain('1 of 2 checked steps are done');
    expect(summary).toContain('Step 2 — “Add a Text”');
  });

  it('separates "could not be checked" from "not done yet"', () => {
    // A step whose own conditions are broken is a defect in the lesson, and
    // telling the learner to go looking for their mistake would be wrong.
    const grade = gradeOf([step(0, true, 'One'), step(1, false, 'Two', 'unknown verb "hasThing"')]);
    expect(summariseGrade(grade, evidence(grade))).toContain('could not be checked');
  });

  it('says a lesson with nothing checkable is exactly that', () => {
    const grade = gradeOf([]);
    expect(summariseGrade(grade, evidence(grade))).toContain('no steps that can be checked');
  });

  it('🔴 never reads as a failure when the check could not run', () => {
    const grade = gradeOf([step(0, true, 'One')], {
      valid: true,
      rendered: false,
      findings: [],
      unavailable: 'no browser'
    });
    const summary = summariseGrade(grade, evidence(grade));

    expect(summary).toContain('could not run');
    expect(summary).toContain('has not been counted either way');
    // The three sentences a learner must never see here.
    expect(summary).not.toContain('renders nothing');
    expect(summary).not.toContain('did not render');
    expect(summary).not.toContain('complete');
  });

  it('names an empty page as an empty page, not as a clean project', () => {
    const grade = gradeOf([step(0, true, 'One')], {
      valid: true,
      rendered: false,
      drawnElementCount: 0,
      findings: []
    });
    expect(summariseGrade(grade, evidence(grade))).toContain('renders nothing at all');
  });

  it('congratulates only when the evidence says complete', () => {
    const done = gradeOf([step(0, true, 'One')], {
      valid: true,
      rendered: true,
      drawnElementCount: 12,
      findings: []
    });
    expect(summariseGrade(done, evidence(done))).toContain('This lesson is complete.');

    const notDone = gradeOf([step(0, false, 'One')]);
    expect(summariseGrade(notDone, evidence(notDone))).not.toContain('This lesson is complete.');
  });

  it('🔴 does not claim "no blocking problems" over a render the harness called broken', () => {
    // UNI-010 §8.1 at the learner's surface. Four elements drew, three of them
    // are the word "Text", and the old sentence congratulated them for it.
    const grade = gradeOf([step(0, true, 'One')], {
      valid: true,
      rendered: true,
      drawnElementCount: 4,
      renderDefects: ['dead-placeholder-text'],
      findings: ['[error] desktop: dead-placeholder-text — 3 elements render a node-type default.']
    });
    const summary = summariseGrade(grade, evidence(grade));

    expect(summary).not.toContain('no blocking problems');
    expect(summary).toContain('dead-placeholder-text');
    expect(summary).toContain('4 elements drawn');
  });

  it('🔴 does not FAIL the learner for it — the verdict is unchanged, only the sentence', () => {
    /*
     * The asymmetry that keeps this out of the gate: the authoring harness
     * grades a finished solution and now refuses one with these codes, while a
     * learner is mid-build and a placeholder they have not filled in yet is
     * what progress looks like. Completion must be exactly as it was.
     */
    const withDefects = gradeOf([step(0, true, 'One')], {
      valid: true,
      rendered: true,
      drawnElementCount: 4,
      renderDefects: ['dead-placeholder-text'],
      findings: []
    });
    const without = gradeOf([step(0, true, 'One')], {
      valid: true,
      rendered: true,
      drawnElementCount: 4,
      findings: []
    });

    expect(evidence(withDefects).complete).toBe(evidence(without).complete);
    expect(summariseGrade(withDefects, evidence(withDefects))).toContain('This lesson is complete.');
  });

  it('omits the drawn count when an adapter did not report one', () => {
    // `rendered: true` with no count is only reachable from an adapter that
    // opted out of the empty-page check; inventing a number would hide it.
    const grade = gradeOf([step(0, true, 'One')], { valid: true, rendered: true, findings: [] });
    const summary = summariseGrade(grade, evidence(grade));

    expect(summary).toContain('Your app renders, with no blocking problems.');
    expect(summary).not.toContain('undefined');
  });
});
