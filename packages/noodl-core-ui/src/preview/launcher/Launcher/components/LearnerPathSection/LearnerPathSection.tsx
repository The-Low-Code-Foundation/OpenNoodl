/**
 * LearnerPathSection — UNI-007 AC1's visible half in the editor.
 *
 * Three multiple-choice questions, and the ordered path of lessons they produce. It sits
 * above the installed-lessons grid on the Learning tab, because the path is *what to install
 * next* and the grid is *what you already have*.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THE SENTENCE AT THE TOP OF THE PATH IS THE PLATFORM'S, NOT OURS, AND IT IS THE MOST
 * IMPORTANT THING ON THIS SCREEN.** Today it says that none of these lessons can be installed
 * yet, because all fifteen are still being written. An eight-step personalised path with
 * titles, times and reasons reads like a finished product; the same path with that sentence
 * reads like a curriculum being built. The first is a lie that would be very easy to ship —
 * every other pixel here supports it — and `truth` is the one string a tidy-up would delete
 * as redundant. It is rendered first, before the steps, so it cannot be scrolled past.
 *
 * 🔴 **AND THE OMISSIONS ARE DRAWN, NOT JUST THE STEPS.** AC1's word is *visibly* different.
 * A learner who never saw the long list cannot see that theirs is shorter, so the branching
 * is only visible as the block saying which lessons were taken off it and why. Rendering the
 * steps alone would turn a personalised path back into a filter.
 *
 * ⚠️ **This component decides nothing about the path** — not the order, not the omissions, not
 * the sentence, not whether a step is installable. `learnerpathview.ts` in the editor shapes
 * all of it from the API's payload, and that module in turn only re-words. See its header.
 *
 * ⚠️ **The surface type is duplicated here structurally**, exactly as `LauncherLearningData`
 * mirrors `LearningCardData`: TypeScript checks the two agree at the one place they meet
 * (`ProjectsPage`'s `<Launcher learnerPath={…}>`), and importing the editor's type into
 * core-ui would drag an editor path alias into a package that must not have one.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import css from './LearnerPathSection.module.scss';

export interface PathQuestion {
  key: string;
  prompt: string;
  options: { value: string; label: string }[];
}

export interface PathStepView {
  position: number;
  slug: string;
  title: string;
  description: string;
  reason: string;
  standing: string;
  installable: boolean;
  minutes: number;
  projection: string | null;
  projectable: boolean;
}

export interface PathOmission {
  slug: string;
  title: string;
  reason: string;
}

/** Structurally identical to the editor's `LearnerPathSurface`. See the module note. */
export type LauncherLearnerPath =
  | { state: 'loading' }
  | { state: 'hidden' }
  | { state: 'unreachable'; detail: string }
  | { state: 'signed-out'; questions: PathQuestion[]; note: string }
  | {
      state: 'intake';
      questions: PathQuestion[];
      chosen: Record<string, string>;
      canSubmit: boolean;
      retaking: boolean;
      /** 🔴 The submit failed. Drawn, because the drive found a button that silently did nothing. */
      error?: string;
    }
  | {
      state: 'path';
      truth: string;
      ready: number;
      total: number;
      duration: string;
      steps: PathStepView[];
      omitted: PathOmission[];
      answers: Record<string, string> | null;
    };

export interface LearnerPathSectionProps {
  surface: LauncherLearnerPath;
  onChoose?: (questionKey: string, value: string) => void;
  onSubmit?: () => void;
  onRetake?: () => void;
  /** ⚠️ Absent when there is nothing to sign in to — the section then draws no door. */
  onSignIn?: () => void;
  /** Ask for a tailored explanation. 🔴 Spends money; see the client's `projectConcept`. */
  onProject?: (concept: string) => void;
  /** The step a projection request is in flight for, so only that row shows a spinner. */
  projecting?: string | null;
  /** A sentence about the last projection attempt — D10's refusal arrives here. */
  projectionNote?: string | null;
  /**
   * Draw the section's own `<h2>`. FB-004 put this section behind a tab whose
   * label already names it, and a heading repeating the tab you just clicked is
   * noise. Defaults to `true`: every other host still gets the heading, which is
   * why UNI-007's render specs are untouched by this.
   *
   * ⚠️ It suppresses the *title only*, not the head row — the count and the
   * button beside it are controls, not decoration.
   */
  showTitle?: boolean;
  /**
   * 2026-09-06 — the shelf's copy of each step, keyed by the step's slug.
   *
   * Richard: *"you can't actually click any of the spine steps to open the tutorial."* The
   * platform's steps and the launcher's installed lessons carry the same slugs, and the host
   * (`Learning.tsx`) is the one place both are in hand — so it passes the join in and this
   * section draws a step that HAS an installed copy as something you can open, with the copy's
   * own state (started, done) where the platform's standing would otherwise sit.
   *
   * 🔴 The installed copy OUTRANKS the platform's standing on screen. The deployed curriculum
   * still says *In writing* for lessons this very build ships, and a step that says "in writing"
   * next to a button that opens it is a contradiction a learner cannot resolve. Absent ⇒ the
   * standing is drawn as before, which is what every existing spec renders.
   */
  installed?: Record<string, LauncherPathInstalledStep>;
  /** Open the installed copy of a step. Absent ⇒ no step is a control. */
  onOpenStep?: (slug: string) => void;
}

export interface LauncherPathInstalledStep {
  /** The Learning-folder id, what `onOpen` takes. */
  id: string;
  state: 'not-started' | 'in-progress' | 'completed';
  progressPercent: number;
  missing?: boolean;
}

/** How many of a path's steps the shelf holds a copy of. */
export function installedOnPath(
  steps: readonly { slug: string }[],
  installed: Record<string, LauncherPathInstalledStep> | undefined
): number {
  if (!installed) return 0;
  return steps.filter((step) => Boolean(installed[step.slug])).length;
}

/**
 * The shelf, keyed by slug, in the shape a step needs. Pure, so the walker can grade it.
 *
 * ⚠️ Only cards WITH a slug take part — a slug is the chain's word that this card is a lesson
 * the path can name. Two copies of one lesson (a shipped one and a hand-installed one) resolve
 * to whichever is further along, so a learner who started the local copy is sent back to it.
 */
export function installedStepsFrom(
  lessons: readonly {
    id: string;
    slug?: string;
    state: 'not-started' | 'in-progress' | 'completed';
    progressPercent: number;
    missing?: boolean;
  }[]
): Record<string, LauncherPathInstalledStep> {
  const rank = { 'not-started': 0, 'in-progress': 1, completed: 2 } as const;
  const out: Record<string, LauncherPathInstalledStep> = {};
  for (const lesson of lessons) {
    if (!lesson.slug) continue;
    const held = out[lesson.slug];
    if (held && rank[held.state] >= rank[lesson.state]) continue;
    out[lesson.slug] = {
      id: lesson.id,
      state: lesson.state,
      progressPercent: lesson.progressPercent,
      ...(lesson.missing ? { missing: true } : {})
    };
  }
  return out;
}

export function LearnerPathSection({
  surface,
  onChoose,
  onSubmit,
  onRetake,
  onSignIn,
  onProject,
  projecting,
  projectionNote,
  showTitle = true,
  installed,
  onOpenStep
}: LearnerPathSectionProps) {
  // 🔴 `hidden` is D15 and draws NOTHING — not a heading, not an empty state, not a sign-in.
  // A pupil whose school switched the community off must not learn from this screen that
  // there is a path they are being kept from. Same posture as the people directory's.
  if (surface.state === 'hidden') return null;

  return (
    <section className={css['Root']} data-test="learner-path-section" data-state={surface.state}>
      <div className={css['HeadRow']}>
        {showTitle && <h2 className={css['Title']}>Your path</h2>}
        {surface.state === 'path' && (
          <span className={css['Count']}>
            {surface.total} {surface.total === 1 ? 'lesson' : 'lessons'} · {surface.duration}
          </span>
        )}
        <div className={css['Spacer']} />
        {surface.state === 'path' && onRetake && (
          <button type="button" className={css['Ghost']} onClick={onRetake} data-test="learner-path-retake">
            Answer again
          </button>
        )}
      </div>

      {surface.state === 'loading' && (
        <p className={css['Muted']} data-test="learner-path-loading">
          Looking up your path…
        </p>
      )}

      {surface.state === 'unreachable' && (
        <p className={css['Muted']} data-test="learner-path-unreachable">
          Couldn’t reach the community, so your path isn’t here. <span className={css['Detail']}>{surface.detail}</span>
        </p>
      )}

      {surface.state === 'signed-out' && (
        <div data-test="learner-path-signed-out">
          {/*
            🔴 FIX-025 — THE QUESTIONS ARE NOT DRAWN SIGNED OUT. This reverses the note that
            used to be here, which argued that showing the three questions greyed out was a
            better door than describing them.

            Richard, 2026-08-20, having met it: *"When I was signed out, the build my path
            questions looked possible to answer, and didn't explain why clicking answers does
            nothing. The questions should be hidden until the user signs in."*

            The old argument was right that a form is a better invitation than a sentence. It
            was wrong about what a **disabled** form communicates: `disabled` reads as *broken*
            rather than as *locked*, there was no text anywhere saying why, and a radio that
            does not respond to a click is the clearest possible statement that a screen is
            not working. One sentence naming what you get, with a door under it, is honest.

            ⚠️ `GET /me/intake` still takes no token, and that is still deliberate — see
            `useLearnerPath`. The reason has changed from "so the form can render" to "so the
            count below is true", and the route should not be re-scoped on the strength of
            this component no longer drawing the options.
          */}
          <p className={css['Muted']}>{surface.note}</p>
          <p className={css['Muted']} data-test="learner-path-locked">
            {surface.questions.length === 1
              ? 'One short question, once you are signed in, and none of it is a test — your answer decides which lessons you meet and in what order.'
              : `${surface.questions.length} short questions, once you are signed in, and none of them are a test — your answers decide which lessons you meet and in what order.`}
          </p>
          {onSignIn && (
            <button type="button" className={css['Primary']} onClick={onSignIn} data-test="learner-path-sign-in">
              Sign in to the community
            </button>
          )}
        </div>
      )}

      {surface.state === 'intake' && (
        <div data-test="learner-path-intake">
          <p className={css['Muted']}>
            {surface.retaking
              ? 'Answering again replaces your current path.'
              : 'Three questions, and none of them are a test. They decide which lessons you meet and in what order.'}
          </p>
          <QuestionList questions={surface.questions} chosen={surface.chosen} onChoose={onChoose} />
          {/*
            🔴 ABOVE the button, not below it. The learner's eye is on the control they just
            pressed; a message underneath it is one they scroll past while concluding the
            button is broken.
          */}
          {surface.error && (
            <p className={css['Error']} data-test="learner-path-submit-error">
              {surface.error}
            </p>
          )}
          <button
            type="button"
            className={css['Primary']}
            disabled={!surface.canSubmit}
            onClick={onSubmit}
            data-test="learner-path-submit"
          >
            {surface.retaking ? 'Rebuild my path' : 'Build my path'}
          </button>
        </div>
      )}

      {surface.state === 'path' && (
        <div data-test="learner-path-steps">
          {/*
            🔴 FIRST, ABOVE THE STEPS, AND VERBATIM. See the module header — this is the
            string that decides whether the screen is honest.
          */}
          <p className={css['Truth']} data-test="learner-path-truth">
            {surface.truth}
          </p>

          {projectionNote && (
            <p className={css['Muted']} data-test="learner-path-projection-note">
              {projectionNote}
            </p>
          )}

          {/*
            🔴 The truth above is the PLATFORM'S sentence, verbatim, and today it says "none of
            them can be installed yet" over a list this build ships eight of. That sentence stays
            (it is the platform's to change, and it is graded verbatim); this one is the
            launcher's own, because the launcher is the one that can see the shelf. Drawn only
            when the two disagree — a platform that knows what shipped needs no correction.
          */}
          {surface.ready === 0 && installedOnPath(surface.steps, installed) > 0 && (
            <p className={css['Muted']} data-test="learner-path-installed-note">
              {installedOnPath(surface.steps, installed) === 1
                ? 'One of these lessons is already installed on this machine — open it from the list below.'
                : `${installedOnPath(surface.steps, installed)} of these lessons are already installed on this machine — open them from the list below.`}
            </p>
          )}

          <ol className={css['Steps']}>
            {surface.steps.map((step) => {
              const copy = installed?.[step.slug];
              const openable = Boolean(copy && onOpenStep && !copy.missing);
              const open = () => onOpenStep?.(step.slug);
              return (
                <li
                  key={step.slug}
                  className={css['Step']}
                  data-test={`learner-path-step-${step.slug}`}
                  data-installable={step.installable ? 'yes' : 'no'}
                  data-installed={copy ? 'yes' : 'no'}
                  data-lesson-state={copy?.state}
                >
                  <span className={css['Position']}>{step.position}</span>
                  <div className={css['StepBody']}>
                    <div className={css['StepHead']}>
                      {/*
                        The title is the control when there is a copy to open — a step you can
                        only open from a small button under two paragraphs is a step most people
                        never open. The button below stays for the eye that looks for one.
                      */}
                      {openable ? (
                        <button
                          type="button"
                          className={css['StepTitleButton']}
                          onClick={open}
                          data-test={`learner-path-open-title-${step.slug}`}
                        >
                          <h3 className={css['StepTitle']}>{step.title}</h3>
                        </button>
                      ) : (
                        <h3 className={css['StepTitle']}>{step.title}</h3>
                      )}
                      {copy ? (
                        <span
                          className={css['Standing']}
                          data-test={`learner-path-lesson-state-${step.slug}`}
                          data-state={copy.state}
                        >
                          {copy.state === 'completed'
                            ? 'Completed'
                            : copy.state === 'in-progress'
                              ? `In progress · ${Math.round(copy.progressPercent)}%`
                              : 'Installed'}
                        </span>
                      ) : (
                        <span className={css['Standing']} data-test={`learner-path-standing-${step.slug}`}>
                          {step.standing}
                        </span>
                      )}
                      <span className={css['Minutes']}>{step.minutes} min</span>
                    </div>
                    <p className={css['StepDescription']}>{step.description}</p>
                    <p className={css['Reason']} data-test={`learner-path-reason-${step.slug}`}>
                      {step.reason}
                    </p>

                    {step.projection && (
                      <p className={css['Projection']} data-test={`learner-path-projection-${step.slug}`}>
                        {step.projection}
                      </p>
                    )}

                    <div className={css['StepActions']}>
                      {openable && (
                        <button
                          type="button"
                          className={css['Primary']}
                          onClick={open}
                          data-test={`learner-path-open-${step.slug}`}
                        >
                          {copy!.state === 'not-started'
                            ? 'Start this lesson'
                            : copy!.state === 'completed'
                              ? 'Open again'
                              : 'Continue'}
                        </button>
                      )}
                      {copy?.missing && (
                        <span className={css['Muted']} data-test={`learner-path-missing-${step.slug}`}>
                          Its folder is no longer on disk — reset it from Installed lessons.
                        </span>
                      )}
                      {step.projectable && onProject && (
                        <button
                          type="button"
                          className={css['Ghost']}
                          disabled={projecting === step.slug}
                          onClick={() => onProject(step.slug)}
                          data-test={`learner-path-project-${step.slug}`}
                          title="Ask for this concept explained against what you already know"
                        >
                          {projecting === step.slug ? 'Writing…' : 'Explain this for me'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/*
            🔴 The half a filter cannot produce. Rendered whenever there is something in it —
            an empty list is a fact about this learner's answers, not a reason to hide the
            block from the learners whose answers did branch something away.
          */}
          {surface.omitted.length > 0 && (
            <div className={css['Omitted']} data-test="learner-path-omitted">
              <h3 className={css['OmittedTitle']}>Left off your path</h3>
              <ul className={css['OmittedList']}>
                {surface.omitted.map((omission) => (
                  <li key={omission.slug} data-test={`learner-path-omitted-${omission.slug}`}>
                    <strong>{omission.title}</strong> — {omission.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function QuestionList({
  questions,
  chosen,
  onChoose,
  disabled
}: {
  questions: PathQuestion[];
  chosen: Record<string, string>;
  onChoose?: (questionKey: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={css['Questions']}>
      {questions.map((question) => (
        <fieldset key={question.key} className={css['Question']} data-test={`learner-path-question-${question.key}`}>
          <legend className={css['Prompt']}>{question.prompt}</legend>
          <div className={css['Options']}>
            {question.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={css['Option']}
                aria-pressed={chosen[question.key] === option.value}
                data-chosen={chosen[question.key] === option.value ? 'yes' : 'no'}
                disabled={disabled}
                onClick={() => onChoose?.(question.key, option.value)}
                data-test={`learner-path-option-${question.key}-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
