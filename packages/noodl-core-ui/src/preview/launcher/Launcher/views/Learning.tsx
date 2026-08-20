/**
 * Learning View — the Learning section's own tab.
 *
 * D5 put a Learning section "in the launcher, beside recent projects", and it
 * was built above the project grid. Richard, 2026-08-17: *"you should see your
 * projects first when you open the launcher, not the learning bit which takes
 * up the whole top of the launcher"*. So it moved here, whole and unchanged —
 * the section still owns its own heading, count and install button, which is
 * why this page draws no title of its own above it and would otherwise print
 * "Learning" twice.
 *
 * ⚠️ Not `LearningCenter` (page id `'learn'`). That is POL-002's retired
 * catalogue of hosted lessons and is still unreachable. See `LauncherPageId`.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { LearnerPathSection } from '@noodl-core-ui/preview/launcher/Launcher/components/LearnerPathSection';
import { LearningSection } from '@noodl-core-ui/preview/launcher/Launcher/components/LearningSection';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import css from './Learning.module.scss';

export interface LearningViewProps {}

export function Learning({}: LearningViewProps) {
  const {
    learning,
    onOpenLearningLesson,
    onResetLearningLesson,
    onInstallLearningLesson,
    learnerPath,
    onChooseIntakeAnswer,
    onSubmitIntake,
    onRetakeIntake,
    onProjectConcept,
    projectingConcept,
    learnerPathProjectionNote,
    community
  } = useLauncherContext();

  return (
    <div className={css['Root']}>
      {/*
        🔴 THE PATH GOES ABOVE THE SHELF, and the order is the argument. The path is what to
        learn next; the grid below is what you already installed. A learner arriving with an
        empty shelf and no path sees the three questions first, which is the only thing on
        this tab that leads anywhere. Reversed, the first screen of the Learning tab would be
        an empty grid explaining a folder format.

        ⚠️ `learnerPath` undefined means NOBODY WIRED THIS (Storybook, or a build with no host
        hook) — not a state of the surface. Rendering a `loading` section for it would tell a
        Storybook user their path was on its way from a platform this build cannot reach.
      */}
      {learnerPath && (
        <LearnerPathSection
          surface={learnerPath}
          onChoose={onChooseIntakeAnswer}
          onSubmit={onSubmitIntake}
          onRetake={onRetakeIntake}
          onProject={onProjectConcept}
          projecting={projectingConcept}
          projectionNote={learnerPathProjectionNote}
          // 🔴 THE SAME DEVICE FLOW THE ACCOUNT CARD USES, and wiring it is not a detail:
          // without it a signed-out learner reads the three questions and has **no way to
          // sign in from the surface that just asked them**. Found by driving, 2026-08-20 —
          // the render spec asserts both branches of this prop and neither could see that the
          // host never passed one. ⚠️ `community` is absent in Storybook and in any host with
          // no account hook, and the section then draws the questions with no door, which is
          // the deliberate behaviour rather than the bug.
          onSignIn={community?.onSignIn}
        />
      )}
      <LearningSection
        lessons={learning ?? []}
        onOpen={onOpenLearningLesson}
        onReset={onResetLearningLesson}
        onInstall={onInstallLearningLesson}
      />
    </div>
  );
}
