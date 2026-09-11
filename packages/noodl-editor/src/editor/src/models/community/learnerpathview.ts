/**
 * UNI-007 AC1, the editor half — turning the platform's intake and path into what the
 * launcher draws.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THIS MODULE DECIDES NOTHING ABOUT THE PATH.** It does not order steps, it does not
 * choose what is left out, and above all it does not compute the sentence about what the path
 * can deliver. `pathing.ts` on the platform does all three, and every one of them is a rule
 * that will be re-ruled — a lesson moving out from behind an intake answer is an edit to
 * `curriculum.json` and to nothing anywhere else. An editor that recomputed would disagree
 * with the web the first time that file changed, which is D15's argument for the mirror
 * restated one surface along, and `communityapi.ts`'s header is the same rule for the client:
 * *it transports and it types*.
 *
 * What this module DOES decide is the only thing left: which of six things the learner is
 * looking at, and in what words the editor says *"you are not signed in"* as against *"the
 * community is not answering"*. Those are editor decisions because they are about the editor.
 *
 * 🔴 **THE `truth` SENTENCE IS PASSED THROUGH VERBATIM AND IS NEVER RECONSTRUCTED FROM
 * `ready`/`total`.** It is the one string on this screen it is most tempting to drop, because
 * a personalised eight-step path reads like a product without it and reads like a promissory
 * note with it — and today, with all fifteen lessons still `in-writing`, the note is the true
 * one. `followsThePayloadsOwnSentence` in the spec proves the pass-through by handing this
 * function a path whose counts **contradict** its sentence and requiring the sentence: a
 * version that recomputed would produce the plausible answer and the wrong one.
 *
 * ⚠️ Pure. No fetch, no clock, no singleton, no core-ui import — same posture as
 * `projectsview.learningstate.ts` beside it, and for the same reason: the derivation has real
 * content and belongs where a plain-Node runner can reach it.
 *
 * @module noodl-editor/models/community/learnerpathview
 */

import type {
  IntakeAnswers,
  IntakeQuestion,
  IntakeState,
  LearnerPath,
  LessonStanding,
  PathOmission,
  PathState,
  Read
} from './communityapi';

/** One step, as its row reads it. */
export interface PathStepView {
  /** 1-based. The learner counts from one and `needs` is already repaired platform-side. */
  position: number;
  slug: string;
  title: string;
  description: string;
  /** Why this step is in THIS learner's path — the platform's sentence. */
  reason: string;
  /** `Ready` / `In writing` / `Needs "…" first`. See {@link standingLabel}. */
  standing: string;
  installable: boolean;
  minutes: number;
  /** Tier 1, from the cache. Null means *not projected*, never *failed*. */
  projection: string | null;
  /**
   * Whether asking for a projection is worth offering. 🔴 False once one exists, because
   * `POST /me/path/project` is idempotent for ever — a second press cannot produce a second
   * answer, so an enabled control would promise something the platform has made impossible.
   */
  projectable: boolean;
}

export type LearnerPathSurface =
  | { state: 'loading' }
  /** D15 says this surface does not exist for you. ⚠️ Drawn as nothing at all. */
  | { state: 'hidden' }
  | { state: 'unreachable'; detail: string }
  /**
   * Signed out — and the questions are still here, because `GET /me/intake` needs no token.
   * 🔴 Showing them is the point: *"sign in to see what we would ask you"* is a worse door
   * than the questions themselves with a sign-in beneath them.
   */
  | { state: 'signed-out'; questions: IntakeQuestion[]; note: string }
  | {
      state: 'intake';
      questions: IntakeQuestion[];
      chosen: Record<string, string>;
      /** Every question answered. A partial set is refused platform-side, not merged. */
      canSubmit: boolean;
      /** They already had a path and chose to redo this. Retaking REPLACES. */
      retaking: boolean;
      /**
       * 🔴 WHY THE FORM CARRIES AN ERROR AT ALL. Found by driving, 2026-08-20: the submit
       * failed and **the screen did not change in any way** — no message, no spinner, no
       * state — because the hook returned early on any non-`ok` write. A learner pressing
       * "Rebuild my path" against a rate limit, an expired session or a platform blip gets a
       * button that appears not to be connected to anything, which is worse than an error and
       * indistinguishable from a broken build. ⚠️ Every spec passed: they all fed the view a
       * *successful* world, and no source-analysis or render check can see a callback that
       * quietly does nothing.
       */
      error?: string;
    }
  | {
      state: 'path';
      truth: string;
      ready: number;
      total: number;
      /** "about 4 hours" / "35 minutes". Presentation only. */
      duration: string;
      steps: PathStepView[];
      /** 🔴 What the intake branched AWAY. Empty is a fact, not a reason to hide the block. */
      omitted: PathOmission[];
      answers: IntakeAnswers | null;
    };

/**
 * The editor's copy of the platform's `standingLabel`.
 *
 * ⚠️ **A SECOND COPY, ACKNOWLEDGED, AND MADE LOUD RATHER THAN DEDUPED.** The wire carries the
 * standing's `kind`, not its label — presentation is each surface's own — so the web and the
 * editor necessarily word this twice and the two can drift. Two repositories cannot share a
 * function, so the mitigation is the `never` below: a standing kind added on the platform
 * **fails this typecheck** rather than rendering as an empty string in a row nobody re-reads.
 * That converts a silent drift into a build error, which is the most a client can do from here.
 */
export function standingLabel(standing: LessonStanding): string {
  switch (standing.kind) {
    case 'ready':
      return 'Ready';
    case 'in-writing':
      return 'In writing';
    case 'needs':
      return `Needs “${standing.lesson.title}” first`;
    default: {
      const unhandled: never = standing;
      return unhandled;
    }
  }
}

/**
 * Total time, in the units a person would use.
 *
 * ⚠️ Rounded to the half hour above an hour, and never to a decimal. "2.7 hours" is a number
 * a machine produced; the estimate behind it is a guess in `curriculum.json` and printing it
 * to one decimal claims a precision the input does not have.
 */
export function durationLabel(minutes: number): string {
  if (minutes <= 0) return 'no time yet';
  if (minutes < 60) return `${minutes} minutes`;
  const halves = Math.round(minutes / 30) / 2;
  if (halves === 1) return 'about an hour';
  return `about ${halves % 1 === 0 ? halves : halves.toFixed(1)} hours`;
}

function stepViews(path: LearnerPath): PathStepView[] {
  return path.steps.map((step, index) => ({
    position: index + 1,
    slug: step.slug,
    title: step.title,
    description: step.description,
    reason: step.reason,
    standing: standingLabel(step.standing),
    installable: step.standing.kind === 'ready',
    minutes: step.estimatedMinutes,
    projection: step.projection,
    projectable: step.projection === null
  }));
}

export interface LearnerPathInputs {
  /** `undefined` while in flight. */
  intake: Read<IntakeState> | undefined;
  /** `undefined` while in flight, and legitimately never read when signed out. */
  path: Read<PathState> | undefined;
  /** What the learner has picked in the form but not yet submitted. */
  chosen?: Record<string, string>;
  /** They pressed "take it again" while holding a path. */
  retaking?: boolean;
  /** What the last submit failed with, if it did. See the `error` field on the intake state. */
  submitError?: string | null;
}

/**
 * Which of the six the learner is looking at.
 *
 * 🔴 **THE ORDER OF THE BRANCHES IS THE DESIGN.** Three of them are refusals and only one may
 * be narrated:
 *
 *  1. `hidden` first, because D15's `absent` outranks everything — a pupil whose school
 *     switched the community off must not be told there is a path to sign in for.
 *  2. `signed-out` before `unreachable`, because until 2026-08-20 the client could not tell
 *     them apart and a 401 rendered as *"could not reach the community"*. That told a learner
 *     with an expired token that their network was down while the platform answered them
 *     precisely, and it is the defect this whole surface's first read exposed.
 *  3. `unreachable` last, so it means what it says.
 *
 * ⚠️ **`signed-out` is decided from the PATH read, never from whether a token exists.** A held
 * token and a valid session are different facts, and an expired one is exactly the case a
 * token check reports as signed in.
 */
export function learnerPathSurface(inputs: LearnerPathInputs): LearnerPathSurface {
  const { intake, path } = inputs;

  if (intake === undefined) return { state: 'loading' };
  if (intake.outcome === 'absent') return { state: 'hidden' };
  if (path?.outcome === 'absent') return { state: 'hidden' };

  if (intake.outcome === 'unreachable') return { state: 'unreachable', detail: intake.detail };

  // The questions survive a signed-out read — that is what this route is for.
  const questions = intake.outcome === 'ok' ? intake.value.questions : [];

  if (intake.outcome === 'unauthenticated' || path?.outcome === 'unauthenticated') {
    return {
      state: 'signed-out',
      questions,
      note: 'Sign in to the community and these three answers build your path.'
    };
  }

  if (path === undefined) return { state: 'loading' };
  if (path.outcome === 'unreachable') return { state: 'unreachable', detail: path.detail };

  const held = path.value.path;
  const answers = path.value.intake;

  // 🔴 No path means the intake has not been taken — NOT that something is missing. The route
  // answers `{intake: null, path: null}` rather than a 404 for exactly this reading, so the
  // client's next move is the form and never a retry.
  if (held === null || inputs.retaking) {
    const chosen = inputs.chosen ?? {};
    return {
      state: 'intake',
      questions,
      chosen,
      canSubmit: questions.length > 0 && questions.every((question) => chosen[question.key] !== undefined),
      retaking: held !== null,
      ...(inputs.submitError ? { error: inputs.submitError } : {})
    };
  }

  return {
    state: 'path',
    // Verbatim. See the module header — this is the assertion the spec turns on.
    truth: held.truth,
    ready: held.ready,
    total: held.total,
    duration: durationLabel(held.minutes),
    steps: stepViews(held),
    omitted: held.omitted,
    answers
  };
}

/**
 * What the editor says about a projection attempt.
 *
 * 🔴 **`refused` IS NOT A FAILURE AND MUST NOT BE WORDED AS ONE.** D10 turns tier-1 projection
 * off for an org-owned under-18 account, decided from the account's own kind. The tier-0 path
 * is complete; the learner has lost nothing, and a client that said *"projection failed"*
 * would report a school's policy as a bug in the product. `unavailable` is the platform's own
 * "nobody configured a model here", which is a fact about the deployment and equally not the
 * learner's problem.
 *
 * ⚠️ Returns `null` when there is nothing to say — a `ready` projection speaks for itself and
 * a note beside it would be the second sentence about a thing that already rendered.
 */
export function projectionNote(
  outcome: { kind: string; reason?: string; failure?: string; fresh?: boolean } | null
): string | null {
  if (!outcome) return null;
  switch (outcome.kind) {
    case 'ready':
      return null;
    case 'in-flight':
      return 'Working on that explanation — check back in a moment.';
    case 'refused':
      return 'Tailored explanations are switched off for this account. Your path is complete without them.';
    case 'unavailable':
      return 'Tailored explanations are not switched on for this community yet.';
    case 'failed':
      // 🔴 Says it will NOT retry, because it will not: "one model call ever" is enforced by a
      // primary key claimed before the call, so a failure is recorded and re-projecting is a
      // deliberate act. A client that implied a retry was coming would be describing a
      // different platform.
      return 'That explanation could not be written, and it will not be retried on its own.';
    default:
      return null;
  }
}
