/**
 * UNI-007 slice 4 — **"check my work"**: the grading runner's first caller.
 *
 * WHAT WAS MISSING, AND HOW IT WAS ESTABLISHED
 * --------------------------------------------
 * Slices 1–3 built both engines, engine 2's sidecar adapter, the Learning folder
 * register and its launcher section. Nothing called `gradeLesson`. That was
 * measured rather than assumed: `__webpack_require__` in the running renderer
 * answered *"Cannot find module `./src/editor/src/models/lessongrading.ts`"* —
 * the runner was not in the bundle at all, because no editor module imported it.
 * This module is the import, and the button in the lesson layer is the click.
 *
 * WHAT IT DOES, IN ORDER
 * ----------------------
 *   1. Find the Learning-folder entry for the open project. The lesson's id is
 *      on the project already — the opener sets `project.id = entry.id` — so a
 *      project with no entry is simply not a lesson, and says so rather than
 *      grading nothing and calling it a pass.
 *   2. Re-read `lesson.json` **from disk, now**. Not from the compiled steps the
 *      lesson layer is showing: those are HTML, and grading needs the manifest's
 *      `completeWhen` conditions. Re-reading also means an author iterating on a
 *      bundle grades against what they last wrote.
 *   3. Grade — engine 1 always, engine 2 when a grader is supplied.
 *   4. Reduce to the evidence bundle and record it against the entry.
 *
 * 🔴 THE GRADE IS WRITTEN, AND IT IS WHAT DECIDES COMPLETION
 * ---------------------------------------------------------
 * `LearningFolderModel.recordGrade` has existed since slice 3 and only a test
 * harness had ever called it. The card reads *two* numbers — progress (which
 * step the learner is on) and score (what a grade said) — and a recorded grade
 * is the only thing that may set "complete". A card inferring completion from
 * 100% progress would be a second, weaker completion rule beside
 * `buildLessonEvidence().complete`, which already carries the empty-page and
 * could-not-run guarantees.
 *
 * ⚠️ **No Electron, no `fs`, no singletons in this file.** Every port is
 * injected, so the whole flow is gradeable in `tests-unit/`. `lessoncheck.live.ts`
 * builds the real ones.
 *
 * @module noodl-editor/models/lessoncheck
 */

import type { LearningEntry, LearningEntryView } from './learningfolder';
import type { LessonManifest } from './lessonformat';
import { buildLessonEvidence, gradeLesson } from './lessongrading';
import type { LessonEvidence, LessonGrade, WholeSolutionGrader } from './lessongrading';
import type { LessonEvalContext } from '../views/lessons/lessonevalconditions';

export interface CheckMyWorkRegister {
  get(id: string): LearningEntryView | undefined;
  recordGrade(
    id: string,
    evidence: LessonEvidence,
    options?: { gradedBy?: 'runner' | 'human'; feedback?: string; gradedAt?: string }
  ): LearningEntry | undefined;
}

export interface CheckMyWorkDeps {
  register: CheckMyWorkRegister;
  /** Parsed `lesson.json` from an installed lesson, or undefined when unreadable. */
  readManifest(projectDirectory: string): LessonManifest | undefined;
  /** The live editor state engine 1 grades against. */
  evalContext(): LessonEvalContext;
  /**
   * Engine 2. Optional on purpose — a build with no viewer still grades every
   * step, and `gradeLesson` treats an absent grader as "not asked", never as a
   * failed check.
   */
  wholeSolution?: WholeSolutionGrader;
  now(): string;
}

export type CheckMyWorkOutcome =
  | {
      result: 'graded';
      entryId: string;
      grade: LessonGrade;
      evidence: LessonEvidence;
      /** The sentence shown to the learner and stored as the card's feedback. */
      summary: string;
    }
  /** Nothing was graded, and nothing was written. */
  | { result: 'unavailable'; reason: string };

/**
 * Run the grading runner over the open lesson and record the result.
 *
 * Never throws: a lesson whose folder was deleted, a manifest that will not
 * parse and an engine 2 with no browser are all outcomes rather than exceptions.
 * The learner pressed a button; the answer is a sentence either way.
 */
export async function checkMyWork(projectId: string | undefined, deps: CheckMyWorkDeps): Promise<CheckMyWorkOutcome> {
  const entry = projectId ? deps.register.get(projectId) : undefined;
  if (!entry) {
    return { result: 'unavailable', reason: 'This project is not a lesson from your Learning section.' };
  }
  if (entry.missing) {
    return {
      result: 'unavailable',
      reason: `“${entry.title}” is no longer on disk. Reset it from the launcher to pull a fresh copy.`
    };
  }

  const manifest = deps.readManifest(entry.projectDirectory);
  if (!manifest || typeof manifest !== 'object') {
    return {
      result: 'unavailable',
      reason: `“${entry.title}” has no readable lesson.json, so there is nothing to grade against.`
    };
  }

  let grade: LessonGrade;
  try {
    grade = await gradeLesson(manifest, deps.evalContext(), {
      ...(deps.wholeSolution ? { wholeSolution: deps.wholeSolution } : {})
    });
  } catch (e) {
    // Engine 1 is pure and engine 2 never throws, so reaching here means the
    // *context* could not be built — no project, a graph mid-swap. That is a
    // "could not run", never a failed lesson.
    return { result: 'unavailable', reason: `The check could not run: ${e instanceof Error ? e.message : String(e)}` };
  }

  const evidence = buildLessonEvidence(manifest, grade, {
    // 🔴 The register's provenance, never the manifest's. A bundle that declared
    // itself `curated` would be believed, and one producer of this format is an
    // agent on the user's own machine — so only the code that watched it arrive
    // may answer.
    provenance: entry.provenance,
    gradedAt: deps.now()
  });

  const summary = summariseGrade(grade, evidence);
  deps.register.recordGrade(entry.id, evidence, { gradedBy: 'runner', feedback: summary });

  return { result: 'graded', entryId: entry.id, grade, evidence, summary };
}

/**
 * The sentence a learner reads, and the one stored on the card.
 *
 * 🔴 **"The check didn't run" is its own state and never a failure.** Engine 2
 * reports `unavailable` when there was no browser to render in, and a learner on
 * such a machine has not failed the lesson — telling them they have is the
 * single most damaging thing this string could do. Same rule as the card's, said
 * once here so both read it from one place.
 *
 * ⚠️ It reports engine 2's halves separately because they fail independently: a
 * project the validator cannot read may still render perfectly. Collapsing them
 * into one verdict is the mistake the adapter itself is written to avoid, and it
 * would be no less wrong in prose.
 */
export function summariseGrade(grade: LessonGrade, evidence: LessonEvidence): string {
  const parts: string[] = [];

  if (grade.stepsGraded === 0) {
    parts.push('This lesson has no steps that can be checked automatically.');
  } else if (grade.firstIncompleteStep === -1) {
    parts.push(`All ${grade.stepsGraded} checked steps are done.`);
  } else {
    const step = grade.steps[grade.firstIncompleteStep];
    const named = step?.title ? `Step ${step.index + 1} — “${step.title}”` : `Step ${grade.firstIncompleteStep + 1}`;
    parts.push(
      `${grade.stepsPassed} of ${grade.stepsGraded} checked steps are done. ${named} is the first one still to do.`
    );
  }

  // A step whose conditions could not be evaluated is not a step the learner
  // failed, and lumping the two together would send them looking for a mistake
  // that is in the lesson.
  const broken = grade.steps.filter((s) => s.error).length;
  if (broken > 0) {
    parts.push(`${broken} step${broken === 1 ? '' : 's'} could not be checked — the lesson's own conditions failed.`);
  }

  const whole = grade.wholeSolution;
  if (whole) {
    if (whole.unavailable) {
      parts.push('The whole-project check could not run on this machine, so it has not been counted either way.');
    } else if (!whole.rendered) {
      parts.push(
        whole.drawnElementCount === 0
          ? 'Your app renders nothing at all — a clean project that draws an empty page is not finished.'
          : 'Your app did not render.'
      );
    } else if (!whole.valid) {
      parts.push(`Your app renders, but the project has problems (${whole.findings.length} reported).`);
    } else {
      // ⚠️ The count is stated when there is one and omitted when there is not.
      // `rendered: true` with no count is only reachable from an adapter that
      // opted out of the empty-page check; inventing a number for it here would
      // hide exactly that.
      const drawn = typeof whole.drawnElementCount === 'number' ? ` — ${whole.drawnElementCount} elements drawn` : '';
      parts.push(`Your app renders${drawn}, with no blocking problems.`);
    }
  }

  if (evidence.complete) parts.push('This lesson is complete.');

  return parts.join(' ');
}

// ─── The real ports ─────────────────────────────────────────────────────────

/**
 * Wire "check my work" to this editor process.
 *
 * `require` inside the function, not module-scope `import`, for the reason every
 * UNI-007 module carries: the register reaches `electron-store`, the eval
 * context reaches `ProjectModel`, and engine 2's adapter reaches `ipcRenderer` —
 * while everything above has to import cleanly in a plain-Node runner.
 *
 * ⚠️ **Engine 2 is attached, not optional, in the editor.** It is what makes the
 * empty-page rule reach the completion flag; a build that quietly graded steps
 * only would pass a learner whose app draws nothing. When there is no browser to
 * render in, the adapter says `unavailable` — which withholds completion without
 * ever telling the learner they failed.
 */
export function liveCheckMyWorkDeps(): CheckMyWorkDeps {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { LearningFolderModel } = require('./learningfolder');
  const { liveLessonEvalContext } = require('../views/lessons/lessonevalconditions.live');
  const { liveWholeSolutionGrader } = require('./lessonwholesolution.live');
  const { defaultLearningLessonFs, readLessonManifest } = require('./learninglesson');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const fs = defaultLearningLessonFs();

  return {
    register: LearningFolderModel.instance,
    readManifest: (projectDirectory: string) => readLessonManifest(projectDirectory, fs),
    evalContext: liveLessonEvalContext,
    wholeSolution: liveWholeSolutionGrader(),
    now: () => new Date().toISOString()
  };
}
