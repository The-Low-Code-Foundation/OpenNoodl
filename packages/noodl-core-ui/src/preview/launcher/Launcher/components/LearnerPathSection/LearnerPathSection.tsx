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
}

export function LearnerPathSection({
  surface,
  onChoose,
  onSubmit,
  onRetake,
  onSignIn,
  onProject,
  projecting,
  projectionNote
}: LearnerPathSectionProps) {
  // 🔴 `hidden` is D15 and draws NOTHING — not a heading, not an empty state, not a sign-in.
  // A pupil whose school switched the community off must not learn from this screen that
  // there is a path they are being kept from. Same posture as the people directory's.
  if (surface.state === 'hidden') return null;

  return (
    <section className={css['Root']} data-test="learner-path-section" data-state={surface.state}>
      <div className={css['HeadRow']}>
        <h2 className={css['Title']}>Your path</h2>
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
            🔴 The questions render signed out, and this is the whole reason `GET /me/intake`
            takes no token. "Sign in to find out what we would ask you" is a worse door than
            the three questions themselves with a sign-in beneath them.
          */}
          <p className={css['Muted']}>{surface.note}</p>
          <QuestionList questions={surface.questions} chosen={{}} disabled />
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

          <ol className={css['Steps']}>
            {surface.steps.map((step) => (
              <li
                key={step.slug}
                className={css['Step']}
                data-test={`learner-path-step-${step.slug}`}
                data-installable={step.installable ? 'yes' : 'no'}
              >
                <span className={css['Position']}>{step.position}</span>
                <div className={css['StepBody']}>
                  <div className={css['StepHead']}>
                    <h3 className={css['StepTitle']}>{step.title}</h3>
                    <span className={css['Standing']} data-test={`learner-path-standing-${step.slug}`}>
                      {step.standing}
                    </span>
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
              </li>
            ))}
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
