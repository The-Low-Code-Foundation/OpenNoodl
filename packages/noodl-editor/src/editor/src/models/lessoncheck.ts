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
import { lessonObservesDatabase } from './lessondatabase';
import type { LessonManifest } from './lessonformat';
import { buildLessonEvidence, findingTotalOf, gradeLesson } from './lessongrading';
import type { LessonEvidence, LessonGrade, WholeSolutionGrader } from './lessongrading';
import type { LessonDatabaseSnapshot, LessonEvalContext } from '../views/lessons/lessonevalconditions';

export interface CheckMyWorkRegister {
  get(id: string): LearningEntryView | undefined;
  recordGrade(
    id: string,
    evidence: LessonEvidence,
    options?: { gradedBy?: 'runner' | 'human'; feedback?: string; gradedAt?: string }
  ): LearningEntry | undefined;
  /** UNI-006. Called only when the platform accepted the submission. */
  recordSubmission(
    id: string,
    accepted: { submittedAt: string; state: 'in_progress' | 'submitted' | 'graded' }
  ): LearningEntry | undefined;
}

/**
 * What handing in came to. 🔴 `notAttempted` is a distinct outcome and not a null: *"this
 * lesson is not assigned work"* and *"we tried and could not"* are opposite facts, and the
 * sentence a learner should read differs completely between them.
 */
export type SubmissionOutcome =
  | { result: 'notAttempted' }
  | { result: 'accepted'; state: 'in_progress' | 'submitted' | 'graded'; score: number | null }
  | { result: 'unauthenticated' }
  | { result: 'refused'; detail: string }
  | { result: 'failed'; detail: string };

/** The one call this module makes over the network. Injected, so the suite needs none. */
export interface SubmitAssignmentPort {
  (assignmentId: string, evidence: LessonEvidence): Promise<SubmissionOutcome>;
}

export interface CheckMyWorkDeps {
  register: CheckMyWorkRegister;
  /** Parsed `lesson.json` from an installed lesson, or undefined when unreadable. */
  readManifest(projectDirectory: string): LessonManifest | undefined;
  /** The live editor state engine 1 grades against. */
  evalContext(): LessonEvalContext;
  /**
   * TUT-002 — the project's built-in database, pre-read, for the three collection verbs.
   *
   * **Optional, and its absence is a working editor rather than a degraded one** — every
   * lesson that grades only the graph is unaffected. It is called at most once per check, and
   * only when the manifest actually names a collection verb: a lesson with none must not put
   * HTTP traffic on the machine every time somebody presses the button.
   *
   * 🔴 It is a *separate* port from {@link evalContext} because it is the async half. Folding
   * it in would make the context builder async, which is the thing this design exists not to
   * do — see `LessonDatabaseSnapshot`.
   */
  readDatabase?(): Promise<LessonDatabaseSnapshot>;
  /**
   * Engine 2. Optional on purpose — a build with no viewer still grades every
   * step, and `gradeLesson` treats an absent grader as "not asked", never as a
   * failed check.
   */
  wholeSolution?: WholeSolutionGrader;
  /**
   * UNI-006's bridge. **Optional, and its absence is a working editor rather than a degraded
   * one** — D5 rules that the Learning folder works with no platform and no account, so a
   * build that could not hand in still grades every lesson exactly as before.
   */
  submitAssignment?: SubmitAssignmentPort;
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
      /**
       * 🔴 ALWAYS PRESENT, so a caller cannot forget to look. An undefined field is one a UI
       * renders as nothing and a reviewer reads as "not applicable" — which is exactly the
       * reading that would be wrong for a failed hand-in.
       */
      submission: SubmissionOutcome;
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
    grade = await gradeLesson(manifest, await lessonContext(manifest, deps), {
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

  /*
   * 🔴 UNI-006's BRIDGE, AND THE ORDER IS THE DESIGN. The grade is recorded BEFORE the
   * network is touched, and nothing below can undo it. A learner who pressed "check my work"
   * on a train has been graded — that is a local fact about a local project, computed by two
   * local engines — and losing it because a POST failed would make the offline case worse
   * than having no bridge at all.
   *
   * ⚠️ This is also why a failed submit is not an `unavailable` outcome. `unavailable` means
   * *nothing was graded and nothing was written*, and both halves would be false here.
   */
  const submission = await submitIfAssigned(entry, evidence, deps);

  return { result: 'graded', entryId: entry.id, grade, evidence, summary, submission };
}

/**
 * The context engine 1 grades against, with the database in it when the lesson needs one.
 *
 * 🔴 **The merge is here rather than pushed through `evalContext()`, and that is deliberate.**
 * A dependency shaped `evalContext(database?)` is one every existing implementation — the live
 * one, and every fake in the suite — would silently ignore, and a snapshot dropped on the floor
 * looks exactly like a snapshot nobody read: the step does not tick and the sentence blames the
 * database. Merging over the returned object cannot be forgotten by an implementor.
 *
 * A `readDatabase` that throws becomes an `unavailable` snapshot rather than an exception: the
 * learner pressed a button, and "the check could not run" is a worse answer than "your database
 * could not be read", which names the thing to fix.
 */
async function lessonContext(manifest: LessonManifest, deps: CheckMyWorkDeps): Promise<LessonEvalContext> {
  const ctx = deps.evalContext();
  if (!deps.readDatabase || !lessonObservesDatabase(manifest)) return ctx;

  let database: LessonDatabaseSnapshot;
  try {
    database = await deps.readDatabase();
  } catch (e) {
    database = { status: 'unavailable', reason: e instanceof Error ? e.message : String(e) };
  }
  return { ...ctx, database };
}

/**
 * Hand the work in, when there is work to hand in and somewhere to hand it to.
 *
 * 🔴 THE TWO GUARDS ARE NOT THE SAME GUARD. `entry.assignment` absent means this lesson is
 * the learner's own and must never be sent anywhere — D5's *"works with no platform and no
 * account"*. `deps.submitAssignment` absent means this build has no bridge wired. Collapsing
 * them into one condition would work today and would send a personal lesson to a school the
 * day somebody made the port non-optional.
 */
async function submitIfAssigned(
  entry: LearningEntryView,
  evidence: LessonEvidence,
  deps: CheckMyWorkDeps
): Promise<SubmissionOutcome> {
  if (!entry.assignment) return { result: 'notAttempted' };
  if (!deps.submitAssignment) return { result: 'notAttempted' };

  let outcome: SubmissionOutcome;
  try {
    outcome = await deps.submitAssignment(entry.assignment.assignmentId, evidence);
  } catch (e) {
    // The port is written not to throw; a caller that ignored that must not take the whole
    // check down with it, because the grade above is already recorded and already true.
    return { result: 'failed', detail: e instanceof Error ? e.message : String(e) };
  }

  // 🔴 Written ONLY on acceptance. See `recordSubmission`: a `submittedAt` written on a
  // refused attempt is a field that says a pupil handed their homework in when they did not,
  // and it is the field somebody would later read to decide whether they were late.
  if (outcome.result === 'accepted') {
    deps.register.recordSubmission(entry.id, { submittedAt: deps.now(), state: outcome.state });
  }
  return outcome;
}

/**
 * The sentence to add when a lesson was assigned work.
 *
 * ⚠️ Kept apart from {@link summariseGrade} on purpose. That sentence is about the learner's
 * project and is stored on the card as feedback; this one is about a network and must not
 * become part of a grade's permanent record — a card reading *"could not reach your school"*
 * six weeks later would be describing a moment, not the work.
 *
 * 🔴 NOTHING HERE MAY SAY THE WORK WAS HANDED IN UNLESS IT WAS. The refused and failed
 * branches are the ones with damage available to them: a pupil who believes they submitted
 * stops trying.
 */
export function summariseSubmission(submission: SubmissionOutcome, orgSlug?: string): string {
  const school = orgSlug ? `${orgSlug}` : 'your school';
  switch (submission.result) {
    case 'notAttempted':
      return '';
    case 'accepted':
      return submission.state === 'graded'
        ? `Handed in to ${school}, and marked.`
        : `Handed in to ${school}. A person will look at it and you will see their feedback here.`;
    case 'unauthenticated':
      return `Not handed in — sign in to ${school} from the community panel, then press Check my work again.`;
    case 'refused':
      return `Not handed in — ${submission.detail}`;
    case 'failed':
      return `Not handed in — ${school} could not be reached. Your work is graded and saved; press Check my work again when you are back online.`;
  }
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

  // TUT-002 — and it is a *different* sentence from the one above on purpose. A step that grades
  // against the built-in database and could not read it has not failed, and neither has the
  // lesson: the fix is on this machine, so the reason is quoted verbatim rather than counted.
  const unevaluable = grade.steps.find((s) => s.unevaluable)?.unevaluable;
  if (unevaluable) {
    parts.push(unevaluable);
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
      /*
       * 🔴 FIX-027 §18, and it is two defects in one sentence.
       *
       * THE NUMBER. It counted `findings`, which both adapters cap for display
       * — so it printed "21 reported" over a project with 26 problems, and would
       * have printed 21 over a project with a thousand. `findingTotalOf` is the
       * tally; the capped list announces its own overflow separately.
       *
       * THE VERDICT. Richard finished every step of *State on a page* and was
       * told his app "has problems" in the same breath as "all 3 checked steps
       * are done" — over 26 diagnostics that ship inside the lesson and that he
       * could not have caused or fixed. It read as a failure. So when every
       * checked step is done, the whole-project observation is said as an
       * observation and the lesson's own verdict is restated beside it. What is
       * NOT done is softening the finding away: the problems are real, they are
       * still counted, and the list still follows. A learner who genuinely broke
       * something is still told so — they are simply not told they failed a
       * lesson they passed.
       */
      const total = findingTotalOf(whole);
      const problems = `${total} problem${total === 1 ? '' : 's'}`;
      parts.push(
        grade.firstIncompleteStep === -1 && grade.stepsGraded > 0
          ? `Your app renders. The validator reports ${problems} in the project — worth a look, though none of it is a step you were asked to do.`
          : `Your app renders, but the project has problems (${problems} reported).`
      );
    } else {
      // ⚠️ The count is stated when there is one and omitted when there is not.
      // `rendered: true` with no count is only reachable from an adapter that
      // opted out of the empty-page check; inventing a number for it here would
      // hide exactly that.
      const drawn = typeof whole.drawnElementCount === 'number' ? ` — ${whole.drawnElementCount} elements drawn` : '';
      if (whole.renderDefects?.length) {
        /*
         * 🔴 UNI-010 §8.1 at the learner's surface, and it is a *sentence*
         * change and not a verdict change. The gate that grades a finished
         * lesson now fails on these codes; a learner is halfway through
         * building one, and a page carrying the placeholder of a Text node they
         * dropped ten seconds ago is what progress looks like. Failing them for
         * it would be the "gate that rejects the correct answer" pointed at the
         * one person who cannot argue with it.
         *
         * What is not defensible is the old sentence: "with no blocking
         * problems" was printed over a render whose own report said elements on
         * the page are dead. Say what was seen, complete the lesson exactly as
         * before.
         */
        parts.push(
          `Your app renders${drawn}, and some of what it draws looks wrong ` +
            `(${whole.renderDefects.join(', ')}) — worth a look before you move on.`
        );
      } else {
        parts.push(`Your app renders${drawn}, with no blocking problems.`);
      }
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
  const { liveLessonDatabaseSnapshot } = require('./lessondatabase.live');
  const { liveWholeSolutionGrader } = require('./lessonwholesolution.live');
  const { defaultLearningLessonFs, readLessonManifest } = require('./learninglesson');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const fs = defaultLearningLessonFs();

  return {
    register: LearningFolderModel.instance,
    readManifest: (projectDirectory: string) => readLessonManifest(projectDirectory, fs),
    evalContext: liveLessonEvalContext,
    // TUT-002 AC3 — the caller that makes the three collection verbs real. Guarded by
    // `lessonObservesDatabase` inside `checkMyWork`, so a graph-only lesson costs nothing.
    readDatabase: liveLessonDatabaseSnapshot,
    wholeSolution: liveWholeSolutionGrader(),
    submitAssignment: liveSubmitAssignment,
    now: () => new Date().toISOString()
  };
}

/**
 * UNI-006's bridge, wired to the real platform.
 *
 * 🔴 THE NARROWING IS HERE AND NOT IN THE CLIENT, and that is deliberate: `submittedEvidence`
 * lives beside `LessonEvidence`, which is the file somebody edits when they add a field. A
 * narrowing tucked into the transport is one they would never see.
 *
 * ⚠️ **Never throws.** Every branch of `Write<T>` becomes a {@link SubmissionOutcome}, because
 * `checkMyWork` has already recorded a grade by the time this runs and an exception here would
 * lose it. `absent` folds into `refused` with a plain sentence: D15 says a pupil is not told a
 * door exists, so the honest thing a learner can be told is that it was not handed in.
 */
async function liveSubmitAssignment(
  assignmentId: string,
  evidence: LessonEvidence
): Promise<SubmissionOutcome> {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { CommunityApiClient } = require('./community/communityapi');
  const { COMMUNITY_URL } = require('./community/communityorigin');
  const { readCommunitySession } = require('./community/communitysession');
  const { submittedEvidence } = require('./lessongrading');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const session = await readCommunitySession();
  // ⚠️ Asked BEFORE the request rather than reading a 401 back. A learner who never signed in
  // should not have their homework put on the wire at all.
  if (!session?.token) return { result: 'unauthenticated' };

  const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session.token });
  const written = await client.submitAssignment(assignmentId, submittedEvidence(evidence));

  switch (written.outcome) {
    case 'ok':
      return { result: 'accepted', state: written.value.state, score: written.value.score };
    case 'unauthenticated':
      return { result: 'unauthenticated' };
    case 'refused':
      return { result: 'refused', detail: written.detail };
    case 'absent':
      return { result: 'refused', detail: 'this assignment is not available to you.' };
    case 'unreachable':
      return { result: 'failed', detail: written.detail };
  }
}
