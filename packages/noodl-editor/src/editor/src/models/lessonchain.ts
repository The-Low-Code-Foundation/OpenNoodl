/**
 * 2026-09-06 — the order the shelf draws the shipped lessons in, read from `spine.json`.
 *
 * ## The defect this replaces
 *
 * Richard, on the Learning tab: *"the lessons 'en vrac' without any numbering or ordering. The
 * first lesson is actually the LAST lesson of the spine."* `LearningFolderModel.list()` sorts by
 * `installedAt`, newest first — right for a shelf a person fills by hand, and exactly wrong for
 * eight bundles the seed installs in one pass in directory order: the shelf opened on *Snacks*
 * (spine lesson 8) and buried *Your creature, on screen* (lesson 1) at the bottom.
 *
 * ## 🔴 The order is READ, not declared here
 *
 * `project-examples/lessons/spine.json` is SYL-002's prerequisite chain and *"the only place in
 * [this repository] that knows a lesson has a predecessor"*. UNI-022 ruled that order is
 * curriculum-level and may not live in a `lesson.json`, and `npm run lessons:chain` gates the
 * file against the bundles on disk. A second list of the same eight slugs in this module would be
 * the copy that drifts — the drift `spine.json`'s own note records catching in the community
 * repo's `curriculum.json` on 2026-09-05. So this module walks the chain the file already
 * describes, and a lesson added there is numbered here with no code change.
 *
 * ⚠️ **Pure, and a plain-Node import.** The file is read through the seed's `SeedFs` port so a
 * spec can hand it a fixture; the one real port lives in {@link shippedChainOnStartup} and is
 * built inside the function, for the reason every lesson module gives.
 *
 * @module noodl-editor/models/lessonchain
 */

import type { SeedFs } from './lessonseed';

export const SPINE_FILENAME = 'spine.json';

/** The shape `spine.json` declares — only the fields this module reads. */
type SpineLesson = { needs?: string | null; standalone?: boolean };

export interface LessonChain {
  /** Spine slugs in chain order: the head first, then whatever `needs` it, and so on. */
  spine: string[];
  /** Slugs the file marks `standalone` — on the shelf beside the spine, not in it. */
  standalone: string[];
}

export const EMPTY_CHAIN: LessonChain = { spine: [], standalone: [] };

/**
 * Walk a parsed `spine.json` into an ordered chain.
 *
 * ⚠️ Defensive on purpose — this runs at launcher mount on whatever the artefact carries:
 *  - a missing or malformed file is an empty chain, never a throw (the shelf still draws);
 *  - a cycle terminates (`seen`), and a lesson unreachable from the head is dropped rather than
 *    guessed at — `lessons:chain` is the gate that reports it, not the launcher;
 *  - two heads: the first in file order wins, which is stable and is what the gate refuses anyway.
 */
export function chainFromSpine(spine: unknown): LessonChain {
  const lessons = (spine as { lessons?: unknown } | null)?.lessons;
  if (!lessons || typeof lessons !== 'object' || Array.isArray(lessons)) return EMPTY_CHAIN;

  const entries = Object.entries(lessons as Record<string, SpineLesson | null>).filter(
    (pair): pair is [string, SpineLesson] => !!pair[1] && typeof pair[1] === 'object'
  );

  const standalone = entries.filter(([, lesson]) => lesson.standalone === true).map(([slug]) => slug);
  const chained = entries.filter(([, lesson]) => lesson.standalone !== true);

  const head = chained.find(([, lesson]) => !lesson.needs);
  if (!head) return { spine: [], standalone };

  // `needs` points backwards (lesson → predecessor); invert it once so the walk goes forwards.
  const successorOf = new Map<string, string>();
  for (const [slug, lesson] of chained) {
    if (lesson.needs && !successorOf.has(lesson.needs)) successorOf.set(lesson.needs, slug);
  }

  const order: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = head[0];
  while (current && !seen.has(current)) {
    seen.add(current);
    order.push(current);
    current = successorOf.get(current);
  }

  return { spine: order, standalone };
}

/** Read the chain from the shipped-lessons root. `null` root or no file ⇒ the empty chain. */
export function readShippedChain(fs: Pick<SeedFs, 'readJsonFile' | 'join'>, root: string | null): LessonChain {
  if (!root) return EMPTY_CHAIN;
  return chainFromSpine(fs.readJsonFile(fs.join(root, SPINE_FILENAME)));
}

/**
 * The chain, from the real artefact. Never throws — a launcher that cannot number its lessons
 * still has to show them.
 */
export function shippedChainOnStartup(): LessonChain {
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { defaultShippedPorts } = require('./lessonseed') as typeof import('./lessonseed');
    /* eslint-enable @typescript-eslint/no-var-requires */
    const { fs, root } = defaultShippedPorts();
    return readShippedChain(fs, root);
  } catch (e) {
    console.warn(`[lesson-chain] could not read ${SPINE_FILENAME}: ${e instanceof Error ? e.message : String(e)}`);
    return EMPTY_CHAIN;
  }
}
