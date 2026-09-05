/**
 * UNI-007 / D5 — turning a Learning-folder entry into what its card shows.
 *
 * Extracted for the same reason `projectsview.lessonstate.ts` beside it was:
 * the derivation has real content and belongs where a plain-Node runner can
 * reach it, not inside a React page. It is a pure function of the register's
 * entry — no filesystem, no singletons, no core-ui import.
 *
 * 🔴 THE FIELD SHAPE IS DUPLICATED DELIBERATELY, NOT BY OVERSIGHT.
 * {@link LearningCardData} mirrors `LauncherLearningData` in
 * `noodl-core-ui/.../components/LearningSection`, and TypeScript's structural
 * typing checks the two agree at the one place they meet (`ProjectsPage`'s
 * `<Launcher learning={…}>`). Importing the core-ui type here would drag a
 * path alias this runner does not carry into a module whose whole value is
 * being testable without one.
 *
 * @module noodl-editor/views/projectsview.learningstate
 */

import { isShippedLessonId } from '../models/lessonseed';
import type { LearningEntryView, LessonProvenance } from '../models/learningfolder';

export type LearningCardState = 'not-started' | 'in-progress' | 'completed';

/** Structurally identical to core-ui's `LauncherLearningData`. See the module note. */
export interface LearningCardData {
  id: string;
  title: string;
  description?: string;
  provenance: LessonProvenance;
  progressPercent: number;
  state: LearningCardState;
  score?: number;
  feedback?: string;
  gradedBy?: 'runner' | 'human';
  checkUnavailable?: boolean;
  missing?: boolean;
}

/**
 * How far through the steps, 0–100.
 *
 * ⚠️ `stepIndex` is the step the learner is **on**, not the count they have
 * finished, so the last step is `stepCount - 1` — the same off-by-one
 * `getLessonsState` handles for the legacy hosted lessons, and the reason a
 * naive `index / count` shows 83% to someone who has finished.
 */
export function learningProgressPercent(progress: { stepIndex: number; stepCount: number } | undefined): number {
  if (!progress || !progress.stepCount || progress.stepCount <= 1) return 0;
  const ratio = progress.stepIndex / (progress.stepCount - 1);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * The card's state.
 *
 * 🔴 **A recorded grade decides completion, and step progress never does.**
 * Reaching the last card means the learner read every instruction; it does not
 * mean the graded steps passed, and `buildLessonEvidence().complete` is the one
 * place that judgement is made (it also carries the empty-page rule and the
 * "engine 2 could not run" rule). A card that called 100% progress "Completed"
 * would be a second, weaker completion rule sitting next to the real one — the
 * exact shape of defect this task keeps finding.
 */
export function learningCardState(entry: LearningEntryView): LearningCardState {
  if (entry.grade?.complete) return 'completed';
  if (entry.grade || (entry.progress && entry.progress.stepIndex > 0)) return 'in-progress';
  return 'not-started';
}

/**
 * The provenance the CARD shows — P79 J3.
 *
 * 🔴 Three inputs, in order, and the order is the whole point:
 *
 *  1. `entry.origin` — the installing caller's word, recorded unfolded. The right answer, and
 *     the one every entry written since the field landed carries.
 *  2. A shipped-lesson id — the migration for entries written BEFORE it. The seed mints these
 *     ids and `isShippedLessonId` is asserted against that, so it is a sound witness that
 *     NodeGX shipped the bundle. Without this arm the eight lessons already on a learner's
 *     shelf keep the wrong badge for ever: the seed skips an id it has already installed, so
 *     nothing would ever rewrite them.
 *  3. `entry.provenance` — the gate class, which is what the badge used to read and is still
 *     the honest answer for a bundle nobody claimed.
 *
 * ⚠️ Deliberately NOT `entry.provenance` for a shipped lesson: that field is downgraded to
 * `local-ai` by design, because all eight manifests declare `authoredBy: "ai"` and are held to
 * the stricter gate for it. Reading a gate class as an authorship claim is the defect.
 */
export function badgeProvenance(entry: LearningEntryView): LessonProvenance {
  if (entry.origin) return entry.origin;
  if (isShippedLessonId(entry.id)) return 'curated';
  return entry.provenance;
}

/** One entry, as its card reads it. */
export function toLearningCard(entry: LearningEntryView): LearningCardData {
  const grade = entry.grade;

  return {
    id: entry.id,
    title: entry.title,
    ...(entry.description ? { description: entry.description } : {}),
    provenance: badgeProvenance(entry),
    progressPercent: learningProgressPercent(entry.progress),
    state: learningCardState(entry),
    ...(grade ? { score: grade.completionPercent, gradedBy: grade.gradedBy } : {}),
    ...(grade?.feedback ? { feedback: grade.feedback } : {}),
    // Carried through as the flag it is stored as. The sentence names a
    // filesystem and never reaches a card.
    ...(grade?.wholeSolution?.unavailable ? { checkUnavailable: true } : {}),
    ...(entry.missing ? { missing: true } : {})
  };
}

export function toLearningCards(entries: LearningEntryView[]): LearningCardData[] {
  return entries.map(toLearningCard);
}
