/**
 * UNI-007 — the grading runner: two engines, and the rules that keep them apart.
 *
 * These run under jest, which is only possible because `lessonevalconditions`
 * now defers its `ProjectModel` / `NodeGraphContextTmp` imports into
 * `liveLessonEvalContext()`. That matters beyond convenience: UNI-010 runs this
 * runner inside an MCP sidecar with no renderer, and "the same verifier, not a
 * fork" (README surface 2) is only achievable if the pure core loads outside
 * Electron.
 *
 * Acceptance criterion 3 is the spine of this file — "check my work" grades a
 * deliberately-wrong and a correct attempt differently, per step, with no model
 * call — plus the two structural rules: the engines stay separate, and a render
 * that drew nothing is never a pass.
 */

import {
  buildLessonEvidence,
  gradeLesson,
  gradeLessonSteps,
  normaliseWholeSolutionResult
} from '../../src/editor/src/models/lessongrading';
import type { WholeSolutionGrader, WholeSolutionResult } from '../../src/editor/src/models/lessongrading';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import type {
  LessonComponent,
  LessonEvalContext,
  LessonNode
} from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── Graph fakes (same shape as tests/lessons/worked-lesson.test.ts) ─────────

function node(args: {
  label: string;
  type: string;
  parameters?: Record<string, unknown>;
  children?: LessonNode[];
}): LessonNode {
  return {
    id: args.label,
    label: args.label,
    type: { name: args.type },
    ports: [],
    parameters: args.parameters ?? {},
    children: args.children ?? [],
    getPort: () => undefined,
    forAllConnectionsOnThisNode: () => undefined
  };
}

function context(roots: LessonNode[], activeComponentName = 'App'): LessonEvalContext {
  const components: LessonComponent[] = [{ name: 'App', graph: { roots } }];
  return {
    components,
    rootNode: roots[0],
    getMetaData: () => undefined,
    viewerPath: undefined,
    activeComponentName
  };
}

/** The lesson under test: an intro popup, then three graded steps. */
const lesson: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'Your first Group',
  steps: [
    { kind: 'popup', body: 'Welcome' },
    { title: 'Add a Group', completeWhen: [{ node: 'App:%Group', exists: true }] },
    { title: 'Label it Card', completeWhen: [{ node: 'App:%Group', hasLabel: 'Card' }] },
    { title: 'Add a Text', completeWhen: [{ node: 'App:#Card:%Text', exists: true }] }
  ]
};

const emptyProject = context([]);
const correctAttempt = context([node({ label: 'Card', type: 'Group', children: [node({ label: 'T', type: 'Text' })] })]);
/** Deliberately wrong: the Group is there, but never relabelled, so no Text under "Card". */
const wrongAttempt = context([node({ label: 'Group', type: 'Group', children: [node({ label: 'T', type: 'Text' })] })]);

// ─── Engine 1 ───────────────────────────────────────────────────────────────

describe('gradeLessonSteps — engine 1, per-step completion', () => {
  it('grades a correct attempt as complete, per step', () => {
    const grades = gradeLessonSteps(lesson, correctAttempt);
    expect(grades.map((g) => g.passed)).toEqual([false, true, true, true]);
    // The popup is not "failed" — it is not graded at all.
    expect(grades.map((g) => g.graded)).toEqual([false, true, true, true]);
    expect(grades[0].kind).toBe('popup');
  });

  it('grades a deliberately-wrong attempt differently, and says WHICH step', () => {
    const grades = gradeLessonSteps(lesson, wrongAttempt);
    expect(grades.map((g) => g.passed)).toEqual([false, true, false, false]);
    // Step 2 passed (a Group exists); step 3 is where the learner actually is.
    expect(grades[2].title).toBe('Label it Card');
  });

  it('fires nothing against an empty project — no premature advance', () => {
    expect(gradeLessonSteps(lesson, emptyProject).every((g) => !g.passed)).toBe(true);
  });

  it('is synchronous — no await, no injection point, so no model call is reachable', () => {
    // Acceptance criterion 3's "no model call" half, made structural rather than
    // asserted: engine 1 takes (manifest, ctx) and returns an array. There is
    // nowhere to put a network call.
    const result = gradeLessonSteps(lesson, correctAttempt);
    expect(Array.isArray(result)).toBe(true);
    expect(gradeLessonSteps.length).toBe(2);
  });

  it('reports a malformed condition as an error on that step, without failing the rest', () => {
    const broken: LessonManifest = {
      steps: [
        { title: 'Bad', completeWhen: [{ node: 'App' } as never] },
        { title: 'Good', completeWhen: [{ node: 'App:%Group', exists: true }] }
      ]
    };
    const grades = gradeLessonSteps(broken, correctAttempt);
    expect(grades[0].passed).toBe(false);
    expect(grades[0].error).toBeTruthy();
    expect(grades[1].passed).toBe(true);
  });

  it('tolerates a manifest with no steps', () => {
    expect(gradeLessonSteps({ steps: [] }, emptyProject)).toEqual([]);
  });
});

// ─── The empty-render rule ──────────────────────────────────────────────────

describe('normaliseWholeSolutionResult — clean can mean EMPTY', () => {
  it('rewrites a render that claims success while drawing nothing', () => {
    const result = normaliseWholeSolutionResult({ valid: true, rendered: true, drawnElementCount: 0, findings: [] });
    expect(result.rendered).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatch(/drew nothing/);
  });

  it('leaves a render that actually drew alone', () => {
    const result = normaliseWholeSolutionResult({ valid: true, rendered: true, drawnElementCount: 12, findings: [] });
    expect(result.rendered).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('does not invent a count an adapter did not report', () => {
    // `undefined` means "not counted", which is not the same as zero.
    const result = normaliseWholeSolutionResult({ valid: true, rendered: true, findings: [] });
    expect(result.rendered).toBe(true);
  });
});

// ─── Both engines together ──────────────────────────────────────────────────

function grader(result: WholeSolutionResult): WholeSolutionGrader & { calls: number } {
  const g = {
    calls: 0,
    check: async () => {
      g.calls += 1;
      return result;
    }
  };
  return g;
}

describe('gradeLesson', () => {
  it('grades steps with no whole-solution grader at all — the "check my work" fast path', async () => {
    const grade = await gradeLesson(lesson, wrongAttempt);
    expect(grade.stepsGraded).toBe(3);
    expect(grade.stepsPassed).toBe(1);
    expect(grade.completionPercent).toBe(33);
    expect(grade.firstIncompleteStep).toBe(2);
    expect(grade.wholeSolution).toBeUndefined();
  });

  it('reports -1 for firstIncompleteStep when every graded step passes', async () => {
    const grade = await gradeLesson(lesson, correctAttempt);
    expect(grade.firstIncompleteStep).toBe(-1);
    expect(grade.completionPercent).toBe(100);
  });

  it('runs the whole-solution engine once when supplied, and normalises its answer', async () => {
    const g = grader({ valid: true, rendered: true, drawnElementCount: 0, findings: [] });
    const grade = await gradeLesson(lesson, correctAttempt, { wholeSolution: g });
    expect(g.calls).toBe(1);
    // Engine 2's claim does not survive the empty-render rule…
    expect(grade.wholeSolution?.rendered).toBe(false);
    // …and engine 1's per-step verdicts are untouched by it.
    expect(grade.stepsPassed).toBe(3);
  });

  it('runs the static verifier only when asked', async () => {
    expect((await gradeLesson(lesson, correctAttempt)).verification).toBeUndefined();
    const verified = await gradeLesson(lesson, correctAttempt, { verify: true });
    expect(verified.verification?.ok).toBe(true);
  });

  it('fails verification for a lesson written in the prose vocabulary', async () => {
    const proseLesson: LessonManifest = {
      steps: [{ title: 'Add a Repeater', completeWhen: [{ node: 'App:%Repeater', exists: true }] }]
    };
    const grade = await gradeLesson(proseLesson, emptyProject, { verify: true });
    expect(grade.verification?.ok).toBe(false);
    expect(grade.verification?.findings[0].suggestion).toBe('For Each');
  });

  it('treats a lesson with only popups as complete', async () => {
    const grade = await gradeLesson({ steps: [{ kind: 'popup', body: 'hi' }] }, emptyProject);
    expect(grade.completionPercent).toBe(100);
    expect(grade.firstIncompleteStep).toBe(-1);
  });
});

// ─── The evidence bundle ────────────────────────────────────────────────────

describe('buildLessonEvidence', () => {
  it('marks a finished lesson complete', async () => {
    const grade = await gradeLesson(lesson, correctAttempt);
    const evidence = buildLessonEvidence(lesson, grade, { provenance: 'curated', gradedAt: '2026-08-14T00:00:00Z' });
    expect(evidence.complete).toBe(true);
    expect(evidence.stepsPassed).toBe(3);
    expect(evidence.lessonTitle).toBe('Your first Group');
    expect(evidence.provenance).toBe('curated');
    expect(evidence.gradedAt).toBe('2026-08-14T00:00:00Z');
  });

  it('withholds completion when every step passed but nothing rendered', async () => {
    const grade = await gradeLesson(lesson, correctAttempt, {
      wholeSolution: grader({ valid: true, rendered: true, drawnElementCount: 0, findings: [] })
    });
    expect(grade.firstIncompleteStep).toBe(-1);
    // All steps pass and the project validates — and it still is not complete,
    // because it draws nothing.
    expect(buildLessonEvidence(lesson, grade).complete).toBe(false);
  });

  it('carries no project content — only positional step outcomes', async () => {
    // D10: org-minor accounts' project content never leaves the machine, and the
    // evidence bundle is the obvious route by which it would. Distinctive labels
    // so the assertion cannot pass by coincidence.
    const learnerProject = context([
      node({
        label: 'Card',
        type: 'Group',
        parameters: { text: 'LEARNER-TYPED-SECRET' },
        children: [node({ label: 'LEARNER-NODE-LABEL', type: 'Text' })]
      })
    ]);
    const grade = await gradeLesson(lesson, learnerProject);
    const evidence = buildLessonEvidence(lesson, grade);
    const serialised = JSON.stringify(evidence);
    expect(serialised).not.toContain('LEARNER-TYPED-SECRET');
    expect(serialised).not.toContain('LEARNER-NODE-LABEL');
    expect(evidence.stepOutcomes).toEqual([
      { index: 0, graded: false, passed: false },
      { index: 1, graded: true, passed: true },
      { index: 2, graded: true, passed: true },
      { index: 3, graded: true, passed: true }
    ]);
  });

  it('omits gradedAt when the caller does not stamp one', async () => {
    // The module has no clock, deliberately — that is what keeps it pure.
    const grade = await gradeLesson(lesson, emptyProject);
    expect('gradedAt' in buildLessonEvidence(lesson, grade)).toBe(false);
  });
});

// ─── The repo's own template lesson ─────────────────────────────────────────

describe("the worked lesson fixture (LEARN-001's template)", () => {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const workedLesson = require('../../tests/lessons/fixtures/worked-lesson.json') as LessonManifest;
  /* eslint-enable @typescript-eslint/no-var-requires */

  it('passes the static two-vocabulary check', async () => {
    // The lesson LEARN-002 authors against had never been checked by anything.
    const grade = await gradeLesson(workedLesson, emptyProject, { verify: true });
    expect(grade.verification?.findings).toEqual([]);
  });

  it('grades as entirely incomplete against a fresh project', async () => {
    // Not just an empty graph: its first graded step is `activeComponentEquals`,
    // so the learner must also not already be sitting in the right component.
    const grade = await gradeLesson(workedLesson, context([], 'Some Other Component'));
    expect(grade.stepsPassed).toBe(0);
    expect(grade.stepsGraded).toBe(5);
    expect(grade.completionPercent).toBe(0);
  });
});
