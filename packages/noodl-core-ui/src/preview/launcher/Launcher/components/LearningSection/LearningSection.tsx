/**
 * LearningSection — UNI-007 / D5's visible Learning section in the launcher.
 *
 * D5 resolved R9's two options in favour of the visible one, because visible
 * progress motivates. "Platform-managed" is the ruling's word for what the
 * learner can and cannot do here, and this component is where that becomes
 * something a person can see:
 *
 *  - the lesson project is **freely editable** — that IS the lesson — so the
 *    card's primary action is simply *Open*, with no warning and no read-only
 *    posture;
 *  - 🔴 there is **no rename and no delete**, and deliberately no kebab menu to
 *    put them in. The register behind this section offers no such operation
 *    either (`models/learningfolder.ts`), so the absence is structural and this
 *    is only its visible half;
 *  - **Reset is the whole recovery story** — it re-pulls a fresh copy. It is
 *    destructive to the learner's work, so it asks first, and it is the repair
 *    offered for a lesson whose folder has gone missing.
 *
 * ⚠️ **Nothing here assumes an account.** Progress, score and feedback are fed
 * either by local grading or by a pulled platform result and the card cannot
 * tell which (D5) — which is exactly what lets UNI-010 run this section with no
 * platform at all. So there is no sign-in state, no "syncing", and no empty
 * shelf inviting one: with nothing installed the section does not render.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import css from './LearningSection.module.scss';

export type LearningProvenance = 'curated' | 'org' | 'local-ai' | 'local';
export type LearningCardState = 'not-started' | 'in-progress' | 'completed';

export interface LauncherLearningData {
  id: string;
  title: string;
  description?: string;
  provenance: LearningProvenance;
  /** How far through the steps the learner has got, 0–100. */
  progressPercent: number;
  state: LearningCardState;
  /**
   * The last grade, 0–100. Distinct from `progressPercent` on purpose: you can
   * be on the last step and still be failing three of the graded ones, and a
   * card that showed one number for both would hide exactly that case.
   */
  score?: number;
  feedback?: string;
  /** Who graded. UNI-006 lets a human override the runner, and the card must say so. */
  gradedBy?: 'runner' | 'human';
  /**
   * Engine 2 could not run — no Chrome, no viewer bundle. 🔴 Shown as its own
   * state and never as a failure: a learner on a machine with no render harness
   * has not failed the lesson, and a card that cannot tell the two apart will
   * tell them they have.
   */
  checkUnavailable?: boolean;
  /** The installed folder is gone. Resettable, not lost — see the register's note. */
  missing?: boolean;
}

export interface LearningSectionProps {
  lessons: LauncherLearningData[];
  onOpen?: (id: string) => void;
  onReset?: (id: string) => void;
  /**
   * Install a lesson bundle from a folder. Absent in Storybook and in any host
   * that has no installer, in which case an empty section renders nothing at
   * all rather than an explanation of something the user cannot do.
   */
  onInstall?: () => void;
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
}

const PROVENANCE_LABEL: Record<LearningProvenance, string> = {
  curated: 'NodeGX',
  org: 'Your organisation',
  // R12/UNI-010. Named for who wrote it rather than "AI", because the point of
  // the experiment is that it is *the learner's own* assistant, locally.
  'local-ai': 'Written locally',
  // The honest label for a folder the user pointed us at. Nothing about picking
  // a directory says who authored what is in it — see the register's note.
  local: 'From disk'
};

const STATE_LABEL: Record<LearningCardState, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Completed'
};

export function LearningSection({ lessons, onOpen, onReset, onInstall, showTitle = true }: LearningSectionProps) {
  // 🔴 An empty section renders only when there is something to *do* in it.
  //
  // The first instinct here was "never show an empty shelf", and for a shelf
  // that could only be filled by signing in that was right — an empty section
  // would have been an advertisement. It is the wrong call once a lesson can be
  // installed from a folder with no account at all (D5, and UNI-010's whole
  // premise): then the empty state is the only place that route is discoverable,
  // and hiding it hides the feature. So the test is the handler, not the count,
  // and the empty copy mentions no platform and no account.
  if (!lessons.length && !onInstall) return null;

  return (
    <section className={css['Root']} data-test="launcher-learning-section">
      <div className={css['HeadRow']}>
        {showTitle && <h2 className={css['Title']}>Learning</h2>}
        {lessons.length > 0 && (
          <span className={css['Count']}>
            {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
          </span>
        )}
        <div className={css['Spacer']} />
        {onInstall && (
          <button type="button" className={css['Ghost']} onClick={onInstall} data-test="learning-install">
            Install a lesson…
          </button>
        )}
      </div>

      {lessons.length === 0 ? (
        <p className={css['Empty']} data-test="learning-empty">
          Lessons you install appear here, each keeping its own progress, score and feedback. A lesson is a folder
          holding a project and a <code>lesson.json</code> — anything that writes one is a lesson source.
        </p>
      ) : (
        <div className={css['Grid']}>
          {lessons.map((lesson) => (
            <LearningCard key={lesson.id} lesson={lesson} onOpen={onOpen} onReset={onReset} />
          ))}
        </div>
      )}
    </section>
  );
}

function LearningCard({
  lesson,
  onOpen,
  onReset
}: {
  lesson: LauncherLearningData;
  onOpen?: (id: string) => void;
  onReset?: (id: string) => void;
}) {
  const percent = clampPercent(lesson.progressPercent);

  return (
    <article className={css['Card']} data-test={`learning-card-${lesson.id}`} data-state={lesson.state}>
      <header className={css['CardHead']}>
        <h3 className={css['CardTitle']}>{lesson.title}</h3>
        <span className={css['Provenance']}>{PROVENANCE_LABEL[lesson.provenance]}</span>
      </header>

      {lesson.description && <p className={css['CardBody']}>{lesson.description}</p>}

      {lesson.missing ? (
        // The folder went away under us. Say what happened and offer the one
        // repair there is, rather than dropping the entry — dropping it is the
        // "detach" D5 forbids, arrived at by accident.
        <p className={css['Warning']} data-test="learning-missing">
          Its folder is no longer on disk. Reset to pull a fresh copy.
        </p>
      ) : (
        <>
          <div
            className={css['ProgressTrack']}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={css['ProgressFill']} style={{ width: `${percent}%` }} />
          </div>

          <div className={css['MetaRow']}>
            <span className={css['State']}>{STATE_LABEL[lesson.state]}</span>
            <span className={css['Percent']}>{percent}%</span>
          </div>

          {typeof lesson.score === 'number' && (
            <p className={css['Score']} data-test="learning-score">
              Scored {clampPercent(lesson.score)}%{lesson.gradedBy === 'human' ? ' — reviewed by a person' : ''}
            </p>
          )}

          {lesson.checkUnavailable && (
            <p className={css['Muted']} data-test="learning-check-unavailable">
              The whole-project check didn’t run on this machine, so only the steps were graded.
            </p>
          )}

          {lesson.feedback && <p className={css['Feedback']}>{lesson.feedback}</p>}
        </>
      )}

      <footer className={css['CardActions']}>
        {/* No kebab. There is nothing behind one that D5 permits. */}
        <button
          type="button"
          className={css['Primary']}
          disabled={lesson.missing}
          onClick={() => onOpen?.(lesson.id)}
          data-test="learning-open"
        >
          {lesson.state === 'not-started' ? 'Start' : 'Continue'}
        </button>
        <button
          type="button"
          className={css['Ghost']}
          onClick={() => onReset?.(lesson.id)}
          data-test="learning-reset"
          title="Throw this copy away and pull a fresh one"
        >
          Reset
        </button>
      </footer>
    </article>
  );
}

/** A percentage that came from a register, a platform, or a person. Trust none of them. */
function clampPercent(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
