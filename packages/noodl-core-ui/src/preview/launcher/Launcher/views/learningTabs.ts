/**
 * FB-004 — which tabs the Learning view draws, and which one opens.
 *
 * ## Why this is a function and not four lines inside the view
 *
 * `Learning` reads context and `Tabs` holds state, so neither can be evaluated
 * by `tests-unit`'s element walker — it invokes function components directly and
 * anything that calls a hook throws. The decisions here are the part worth
 * grading, and they are all decisions about *absence*: a tab that must not
 * appear, and a default that must not latch. So they live in a module whose only
 * import is a type.
 *
 * @module noodl-core-ui/preview/launcher/Launcher/views/learningTabs
 */
import type { LauncherLearnerPath } from '@noodl-core-ui/preview/launcher/Launcher/components/LearnerPathSection';

export type LearningTabId = 'lessons' | 'path';

export interface LearningTabsInput {
  /** Lessons on the shelf. Starts at 0 on the host's first render — see `active`. */
  installedLessonCount: number;
  /**
   * The path surface's state, or `undefined` when **nobody wired one** —
   * Storybook, or a build with no host hook. That is not a state of the surface
   * and must not be drawn as one.
   */
  pathState?: LauncherLearnerPath['state'];
  /** The tab the learner clicked, or `null` if they have not clicked one yet. */
  chosen?: LearningTabId | null;
}

export interface LearningTabsPlan {
  /** The tabs to draw, in order. A single entry means: draw no strip at all. */
  tabs: LearningTabId[];
  /** The tab whose content shows. */
  active: LearningTabId;
}

export function learningTabs({ installedLessonCount, pathState, chosen = null }: LearningTabsInput): LearningTabsPlan {
  /**
   * 🔴 `hidden` DRAWS NO TAB, not an empty one. D15: a pupil whose school
   * switched the community off must not learn from this screen that there is a
   * path they are being kept from. `LearnerPathSection` already returns `null`
   * for that state — a strip rendered around it regardless would put the words
   * "Your path" on a screen the section is careful to leave blank, so the
   * refusal would leak through the chrome instead of the content.
   *
   * `undefined` is the other no-tab case, and a different one: nobody wired a
   * path at all. Same outcome here, opposite meaning, and neither is a surface
   * with something in it.
   */
  if (!pathState || pathState === 'hidden') {
    return { tabs: ['lessons'], active: 'lessons' };
  }

  /**
   * 🔴 A FUNCTION OF THE SHELF, not a value latched at mount.
   *
   * Richard, 2026-08-22: *"you have to scroll down a page every time you want to
   * see your actual installed lessons"* — so the shelf opens first. But UNI-007's
   * argument for the old order is still true and is kept: *"a learner arriving
   * with an empty shelf and no path sees the three questions first, which is the
   * only thing on this tab that leads anywhere. Reversed, the first screen would
   * be an empty grid explaining a folder format."* Tabs let both be true.
   *
   * ⚠️ The host's `learning` starts `[]` and is filled by an effect, so a default
   * computed once at mount would read the empty array **every time** and open on
   * the path for everybody — the exact complaint, reintroduced by the fix for
   * it. Recomputing per render costs nothing and cannot latch; `chosen` is what
   * makes a click stick.
   */
  const fallback: LearningTabId = installedLessonCount > 0 ? 'lessons' : 'path';

  return { tabs: ['lessons', 'path'], active: chosen ?? fallback };
}
