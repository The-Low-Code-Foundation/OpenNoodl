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

import { LearningSection } from '@noodl-core-ui/preview/launcher/Launcher/components/LearningSection';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import css from './Learning.module.scss';

export interface LearningViewProps {}

export function Learning({}: LearningViewProps) {
  const { learning, onOpenLearningLesson, onResetLearningLesson, onInstallLearningLesson } = useLauncherContext();

  return (
    <div className={css['Root']}>
      <LearningSection
        lessons={learning ?? []}
        onOpen={onOpenLearningLesson}
        onReset={onResetLearningLesson}
        onInstall={onInstallLearningLesson}
      />
    </div>
  );
}
