/**
 * Learning View — the Learning section's own tab.
 *
 * D5 put a Learning section "in the launcher, beside recent projects", and it
 * was built above the project grid. Richard, 2026-08-17: *"you should see your
 * projects first when you open the launcher, not the learning bit which takes
 * up the whole top of the launcher"*. So it moved here.
 *
 * ## FB-004 — and why this is two tabs rather than two stacked sections
 *
 * Richard, 2026-08-22: *"The 'Your path' thing dominates the learning page in
 * the launcher, it should be two tabs no? Otherwise you have to scroll down a
 * page every time you want to see your actual installed lessons."* That is the
 * **third** report of this class (FIX-024, then FIX-025 §2/§3): a learning
 * surface landing above the thing the user came for.
 *
 * 🔴 **This deliberately revises UNI-007 AC1**, whose own words were *"above the
 * installed-lessons grid"*. An acceptance criterion is being changed on the word
 * of the person it was written for — it is not a regression, and the argument
 * UNI-007 built it on is kept rather than discarded: see `learningTabs`, which
 * holds every decision this file used to make inline, and holds them where a
 * spec can reach them.
 *
 * ⚠️ Not `LearningCenter` (page id `'learn'`). That is POL-002's retired
 * catalogue of hosted lessons and is still unreachable. See `LauncherPageId`.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { useMemo, useState } from 'react';

import { Tabs, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';
import {
  LearnerPathSection,
  installedStepsFrom
} from '@noodl-core-ui/preview/launcher/Launcher/components/LearnerPathSection';
import { LearningSection, type LearningFilter } from '@noodl-core-ui/preview/launcher/Launcher/components/LearningSection';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';
import { learningTabs, type LearningTabId } from '@noodl-core-ui/preview/launcher/Launcher/views/learningTabs';

import css from './Learning.module.scss';

export interface LearningViewProps {}

const TAB_LABEL: Record<LearningTabId, string> = {
  lessons: 'Installed lessons',
  path: 'Your path'
};

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

  /**
   * `null` until the learner picks a tab, and then it sticks. Deliberately not
   * seeded with the default: the default depends on data that arrives after the
   * first render, so leaving this null keeps the opening tab a *derivation*
   * right up until there is a choice to respect. See `learningTabs`.
   */
  const [chosen, setChosen] = useState<LearningTabId | null>(null);

  /**
   * 2026-09-06 — the shelf's filter. Held here for `LearningSection`'s reason: that component is
   * walked by `tests-unit` and may not hold state. Resets with the tab, like `chosen`.
   */
  const [filter, setFilter] = useState<LearningFilter>('all');

  const lessons = learning ?? [];
  const plan = learningTabs({ installedLessonCount: lessons.length, pathState: learnerPath?.state, chosen });
  const hasPathTab = plan.tabs.includes('path');

  /**
   * 2026-09-06 — THE JOIN. The platform's path steps and the shelf's cards carry the same slugs
   * (`spine.json` on this side, `curriculum.json` on that one), and this view is the one place
   * both lists are in hand. So a step whose lesson is installed opens the installed copy — the
   * thing Richard could not do: *"you can't actually click any of the spine steps to open the
   * tutorial."* See `installedStepsFrom` for what the map carries.
   */
  const installedSteps = useMemo(() => installedStepsFrom(lessons), [lessons]);

  const shelf = (
    <LearningSection
      lessons={lessons}
      onOpen={onOpenLearningLesson}
      onReset={onResetLearningLesson}
      onInstall={onInstallLearningLesson}
      // The tab label already says "Installed lessons"; with no strip, the
      // section's own heading is the only thing naming the page.
      showTitle={!hasPathTab}
      filter={filter}
      onFilterChange={setFilter}
    />
  );

  if (!hasPathTab) {
    // One surface, no strip: a tab strip with a single tab is a label
    // impersonating a control.
    return <div className={css['Root']}>{shelf}</div>;
  }

  return (
    <div className={css['Root']}>
      <Tabs
        /*
          🔴 Segmented, not `Text`. The text variant paints its root
          `--theme-color-bg-2`, which would slab the whole Learning page in a
          colour the launcher's other tabs do not use, and it insets its button
          row by 15px on top of this page's own 32px, so the labels would sit out
          of line with the content beneath them. The segmented variant paints
          nothing and takes its inset from `--tabs-row-padding` — it is the
          variant written for a consumer that owns the surrounding chrome.
        */
        variant={TabsVariant.Segmented}
        activeTab={plan.active}
        onChange={(id) => setChosen(id as LearningTabId)}
        UNSAFE_className={css['Tabs']}
        tabs={plan.tabs.map((id) => ({
          id,
          label: TAB_LABEL[id],
          testId: `learning-tab-${id}`,
          content:
            id === 'lessons' ? (
              shelf
            ) : (
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
                showTitle={false}
                installed={installedSteps}
                onOpenStep={
                  onOpenLearningLesson
                    ? (slug) => {
                        const copy = installedSteps[slug];
                        if (copy) onOpenLearningLesson(copy.id);
                      }
                    : undefined
                }
              />
            )
        }))}
      />
    </div>
  );
}
