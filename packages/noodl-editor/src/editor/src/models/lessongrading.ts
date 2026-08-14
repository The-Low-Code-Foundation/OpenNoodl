/**
 * UNI-007 — the grading runner. **Two jobs, two engines.**
 *
 * WHY TWO
 * -------
 * UNI-007 as originally scoped said "graded via MCP tooling" and conflated two
 * different questions. PRIOR-ART-RECONCILIATION F5 separated them and phase 67
 * made the separation a criterion:
 *
 *   1. **Per-step completion** — "has the learner done step 4 yet?" This already
 *      exists and is tested: the closed 11-verb condition vocabulary and its
 *      pure evaluator, `views/lessons/lessonevalconditions.ts`. It is what the
 *      lesson runtime uses to advance a step. Building a second per-step grader
 *      on MCP primitives would fork the very contract UNI-007 exists to keep
 *      single, so this module **calls the existing evaluator and adds nothing**.
 *      No MCP call. No model call.
 *
 *   2. **Whole-solution validity, and whether anything actually rendered** —
 *      "is the thing they built a working app, and does it draw?" The evaluator
 *      cannot answer this: it observes the graph, and a graph is a claim. That
 *      is the MCP tooling's job (`validate_project`, `render_report`), and it is
 *      injected here as a port rather than called directly, because it needs a
 *      child process and a Chrome and this module must stay usable without one.
 *
 * The separation is structural, not documentary: engine 1 is a synchronous pure
 * function with no injection point, and engine 2 cannot reach the conditions.
 * Neither can quietly grow into the other.
 *
 * 🔴 THE "CLEAN CAN MEAN EMPTY" RULE
 * ----------------------------------
 * Engine 2 must assert **drawn output**, never the absence of errors. The
 * phase-55 audit measured a correctly architected page that rendered four
 * identical blocks of the literal word "Text", and a validator that reported it
 * clean. {@link normaliseWholeSolutionResult} enforces this on the way in: a
 * result claiming `rendered: true` with nothing drawn is rewritten to
 * `rendered: false` with a finding, so an adapter that forgets cannot pass a
 * learner on an empty page.
 *
 * NO MODEL CALL
 * -------------
 * Nothing in this module or its dependencies reaches a model. That is UNI-007
 * acceptance criterion 3, and it is already true today rather than something to
 * build — the criterion is that it *stays* true.
 *
 * @module noodl-editor/models/lessongrading
 */

import type { LessonEvalContext } from '../views/lessons/lessonevalconditions';
import { evalConditionsWithContext } from '../views/lessons/lessonevalconditions';
import { compileConditions, LessonFormatError } from './lessonformat';
import type { LessonManifest, LessonStepDef } from './lessonformat';
import { verifyLessonManifest } from './lessonverify';
import type { LessonVerificationReport, VerifyLessonOptions } from './lessonverify';

// ─── Engine 1: per-step completion ──────────────────────────────────────────

export interface StepGrade {
  /** Zero-based index into `manifest.steps`. */
  index: number;
  title?: string;
  kind: 'card' | 'popup';
  /**
   * False for a step with no `completeWhen` — an intro, an outro, or a manual
   * *Next* card. An ungraded step is not a passed step and not a failed one.
   */
  graded: boolean;
  /** True only when every condition holds simultaneously. Always false when `graded` is false. */
  passed: boolean;
  conditionCount: number;
  /**
   * Set when the step's conditions could not be evaluated at all — a malformed
   * condition, or one naming a verb the evaluator does not know. Distinct from
   * `passed: false`, which means "evaluated, and the learner is not there yet".
   */
  error?: string;
}

/**
 * Grade every step of a lesson against a project state. Engine 1, whole of it.
 *
 * Synchronous and pure: `ctx` is the same {@link LessonEvalContext} the live
 * runtime builds, and tests supply a plain-object fake. Conditions are lowered
 * with the same `compileConditions` the runtime compiles with, so a lesson
 * grades here exactly as it advances there.
 */
export function gradeLessonSteps(manifest: LessonManifest, ctx: LessonEvalContext): StepGrade[] {
  const steps: LessonStepDef[] = Array.isArray(manifest?.steps) ? manifest.steps : [];

  return steps.map((step, index) => {
    const kind = step?.kind === 'popup' ? 'popup' : 'card';
    const base = { index, title: step?.title, kind } as const;
    const where = `Step ${index + 1}${step?.title ? ` ("${step.title}")` : ''}`;

    if (!step?.completeWhen || step.completeWhen.length === 0) {
      return { ...base, graded: false, passed: false, conditionCount: 0 };
    }

    try {
      const conditions = compileConditions(step.completeWhen, where);
      return {
        ...base,
        graded: true,
        passed: evalConditionsWithContext(conditions, ctx),
        conditionCount: conditions.length
      };
    } catch (e) {
      return {
        ...base,
        graded: true,
        passed: false,
        conditionCount: step.completeWhen.length,
        error: e instanceof LessonFormatError ? e.message : String(e)
      };
    }
  });
}

// ─── Engine 2: whole-solution validity + did it draw ────────────────────────

/**
 * What engine 2 reports back. Deliberately narrow: this module does not want
 * the MCP payloads, it wants the two answers a learner's card shows.
 */
export interface WholeSolutionResult {
  /** No blocking diagnostics — `validate_project`'s question. */
  valid: boolean;
  /**
   * 🔴 The project **drew something**. Not "no render errors" — see the module
   * note. An adapter setting this true must have counted drawn elements.
   */
  rendered: boolean;
  /** How many elements the render actually drew. Absent means "not counted". */
  drawnElementCount?: number;
  /** Human-readable problems, in the reporting tool's own words. */
  findings: string[];
  /**
   * Set when the check could not run at all — no render harness, no Chrome, a
   * project this adapter cannot read.
   *
   * 🔴 Distinct from `rendered: false`, which means the render *ran* and the page
   * was empty, and from `valid: false`, which means the project was read and is
   * wrong. It is the same distinction {@link StepGrade.error} draws for engine 1,
   * and it exists for the same reason: a learner on a machine with no Chrome has
   * not failed the lesson, and a card that cannot tell the two apart will tell
   * them they have. UNI-010 runs this port inside an MCP sidecar, where "no
   * Chrome" is an ordinary Tuesday rather than an edge case.
   *
   * It never *passes* anyone — {@link buildLessonEvidence} withholds `complete`
   * from a lesson whose whole-solution check could not run — but it does not
   * make the fields beside it lie: the two halves fail independently, so a
   * project that cannot be *read* may still have rendered, and `rendered` keeps
   * reporting what the render actually saw.
   */
  unavailable?: string;
}

/**
 * The port engine 2 is supplied through. An implementation wraps
 * `validate_project` + `render_report`; it lives outside this module because it
 * needs a child process, a built viewer bundle and a Chrome, none of which this
 * module should require in order to grade a step.
 */
export interface WholeSolutionGrader {
  check(): Promise<WholeSolutionResult>;
}

/**
 * Apply the "clean can mean EMPTY" rule to whatever an adapter returned.
 *
 * A result that claims to have rendered while reporting zero drawn elements is
 * not evidence of a working app; it is the exact shape of the defect the rule
 * exists for. Rewritten rather than trusted.
 *
 * ⚠️ It deliberately does **not** force `rendered` false when a result carries
 * `unavailable`. The two halves of engine 2 fail independently — a project this
 * adapter cannot *read* may still render perfectly — so `unavailable` does not
 * imply the render is unknown, and rewriting `rendered` on the strength of it
 * would contradict the `drawnElementCount` sitting beside it. The guarantee that
 * an unavailable check never passes anyone lives on the completion flag instead,
 * where it is stated once: see {@link buildLessonEvidence}.
 */
export function normaliseWholeSolutionResult(result: WholeSolutionResult): WholeSolutionResult {
  const findings = [...(result.findings ?? [])];
  let rendered = result.rendered;

  if (rendered && result.drawnElementCount === 0) {
    rendered = false;
    findings.push(
      'The render reported success but drew nothing. An empty page is not a passing render — ' +
        'a clean report can mean empty.'
    );
  }

  return { ...result, rendered, findings };
}

// ─── The full grade ─────────────────────────────────────────────────────────

export interface LessonGrade {
  /** Per-step results from engine 1, in step order. */
  steps: StepGrade[];
  stepsGraded: number;
  stepsPassed: number;
  /** Index of the first graded step that has not passed, or -1 when all have. */
  firstIncompleteStep: number;
  /** 0–100 over *graded* steps only; 100 when a lesson has no graded step. */
  completionPercent: number;
  /** Engine 2's answer, when a grader was supplied. */
  wholeSolution?: WholeSolutionResult;
  /** The static two-vocabulary check, when asked for. Grades the *lesson*, not the learner. */
  verification?: LessonVerificationReport;
}

export interface GradeLessonOptions {
  /** Engine 2. Omit to grade steps only — the "check my work" fast path. */
  wholeSolution?: WholeSolutionGrader;
  /**
   * Also run the static verifier over the lesson itself. Off by default when a
   * learner is being graded (their lesson was verified at install), on for
   * UNI-010, where the bundle being graded was written minutes ago.
   */
  verify?: boolean | VerifyLessonOptions;
}

/**
 * Grade a lesson: engine 1 always, engine 2 when supplied, plus the static
 * check when asked. `async` only because engine 2 is; with no grader the work
 * is entirely synchronous.
 */
export async function gradeLesson(
  manifest: LessonManifest,
  ctx: LessonEvalContext,
  options: GradeLessonOptions = {}
): Promise<LessonGrade> {
  const steps = gradeLessonSteps(manifest, ctx);
  const graded = steps.filter((s) => s.graded);
  const passed = graded.filter((s) => s.passed);
  const firstIncomplete = steps.findIndex((s) => s.graded && !s.passed);

  const grade: LessonGrade = {
    steps,
    stepsGraded: graded.length,
    stepsPassed: passed.length,
    firstIncompleteStep: firstIncomplete,
    completionPercent: graded.length === 0 ? 100 : Math.round((passed.length / graded.length) * 100)
  };

  if (options.verify) {
    grade.verification = verifyLessonManifest(
      manifest,
      typeof options.verify === 'object' ? options.verify : undefined
    );
  }

  if (options.wholeSolution) {
    grade.wholeSolution = normaliseWholeSolutionResult(await options.wholeSolution.check());
  }

  return grade;
}

// ─── The evidence bundle ────────────────────────────────────────────────────

/**
 * What leaves the editor when a learner finishes.
 *
 * Consumed by UNI-002 (a points event) and UNI-006 (a submission a human can
 * override), and shown on the Learning-section card. It carries *no project
 * content* — step outcomes and counts only. That is not tidiness: D10 rules
 * that org-minor accounts' project content never leaves the machine, and an
 * evidence bundle that carried a graph would be the route by which it did.
 */
export interface LessonEvidence {
  lessonTitle?: string;
  /** Which producer wrote the bundle — curated, org, or the learner's own Claude (R12/UNI-010). */
  provenance?: string;
  stepsGraded: number;
  stepsPassed: number;
  completionPercent: number;
  complete: boolean;
  /** Per-step pass/fail, positionally. No labels, no parameters, no graph. */
  stepOutcomes: Array<{ index: number; graded: boolean; passed: boolean }>;
  /**
   * `unavailable` is carried as a **flag, not the sentence**. The sentence names
   * a machine — "NODEGX_RENDER_CLI points at /Users/…" — and this bundle is the
   * thing that leaves one. A human reviewer (UNI-006) needs to know engine 2 did
   * not run; they do not need the learner's filesystem to find out.
   */
  wholeSolution?: { valid: boolean; rendered: boolean; findingCount: number; unavailable?: true };
  /** Set by the caller. Not sampled here — this module has no clock, so it stays pure. */
  gradedAt?: string;
}

export interface BuildEvidenceOptions {
  provenance?: string;
  gradedAt?: string;
}

/** Reduce a grade to the bundle that may leave the machine. */
export function buildLessonEvidence(
  manifest: LessonManifest,
  grade: LessonGrade,
  options: BuildEvidenceOptions = {}
): LessonEvidence {
  return {
    lessonTitle: manifest?.title,
    ...(options.provenance ? { provenance: options.provenance } : {}),
    stepsGraded: grade.stepsGraded,
    stepsPassed: grade.stepsPassed,
    completionPercent: grade.completionPercent,
    // A lesson with a whole-solution grader attached is only complete when it
    // also drew something — the empty-page rule reaches the completion flag too.
    //
    // 🔴 And a check that could not run never completes anyone. This is the one
    // place that guarantee is stated, precisely so the fields it reads can stay
    // honest about what each half of engine 2 actually observed.
    complete:
      grade.firstIncompleteStep === -1 &&
      (!grade.wholeSolution ||
        (grade.wholeSolution.valid && grade.wholeSolution.rendered && !grade.wholeSolution.unavailable)),
    stepOutcomes: grade.steps.map((s) => ({ index: s.index, graded: s.graded, passed: s.passed })),
    ...(grade.wholeSolution
      ? {
          wholeSolution: {
            valid: grade.wholeSolution.valid,
            rendered: grade.wholeSolution.rendered,
            findingCount: grade.wholeSolution.findings.length,
            ...(grade.wholeSolution.unavailable ? { unavailable: true as const } : {})
          }
        }
      : {}),
    ...(options.gradedAt ? { gradedAt: options.gradedAt } : {})
  };
}
