/**
 * UNI-010 slice 2 — scoring a lesson bundle, and writing it only if it passed.
 *
 * 🔴 THE SIDECAR WRITES A FOLDER. IT NEVER WRITES LAUNCHER STATE.
 * ---------------------------------------------------------------
 * D5 is explicit and this module is where it would be broken if it were going to
 * be: the Learning section's register belongs to the **editor process**, and an
 * MCP sidecar that wrote it would be wrong on the bridge direction as well as on
 * the ruling. So the output of `create_lesson` is a directory on disk. The
 * learner installs it through the launcher's ordinary "install from a folder"
 * route, and the editor's own gate runs again on the way in.
 *
 * That leaves one question — how the editor knows the bundle was written by a
 * model — and the answer needs no channel at all. The manifest carries
 * `authoredBy: "ai"`, and the install policy honours a claim that **spends**
 * trust while ignoring one that buys it: declaring AI authorship moves the bundle
 * from a one-class gate to a three-class one, so nobody has a motive to lie in
 * that direction. This module stamps the field; `lessoninstallpolicy` reads it.
 *
 * 🔴 THE GATE RUNS BEFORE THE WRITE, AND A REFUSAL WRITES NOTHING
 * ---------------------------------------------------------------
 * Phase 64's rule is that a refusal is graded by what it wrote, and slice 1's is
 * that a bundle where nothing failed *because nothing was checked* has not
 * passed. Both point the same way here: score first, and produce a directory only
 * when every class actually passed. A half-written bundle beside an error message
 * is the worst outcome available — an authoring model would install it.
 *
 * ⚠️ **This is the only process that can answer F4**, which is why it is the one
 * that must. The editor's engine-2 adapter drives the running viewer, so it
 * cannot render a solution folder; the render harness lives here. F4 is the class
 * the prior arc predicted would dominate, so a bundle written without it is a
 * deliberate exception — see {@link WriteLessonOptions.allowUnrendered}.
 *
 * @module noodl-mcp/lessons/bundleWriter
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  buildLessonEvalContext,
  decideInstall,
  formatBundleScorecard,
  MANIFEST_FILE,
  readLessonProject,
  SOLUTION_DIR,
  verifyLessonBundle
} from '../editor-deps';
import type {
  LessonBundleFs,
  LessonBundleScorecard,
  LessonManifest,
  WholeSolutionGrader,
  WholeSolutionResult
} from '../editor-deps';
import { ToolError } from '../errors';
import { bundleVocabularyFor } from './bundleVocabulary';
import { createWholeSolutionGrader } from './wholeSolutionGrader';

/** The real filesystem, in the three methods the bundle reader asks for. */
export const nodeBundleFs: LessonBundleFs = {
  exists: (p) => fs.existsSync(p),
  readJsonFile: (p) => {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return undefined;
    }
  },
  join: (...parts) => path.join(...parts)
};

export interface ScoreLessonOptions {
  /** The project the learner opens. */
  starterDir: string;
  /** The graph after every step is done. */
  solutionDir: string;
  /** Skip the render. F4 then reports `not-checked` rather than passing. */
  skipRender?: boolean;
  /** Seam for the specs, so a scorecard costs no Chrome. */
  grade?: (solutionDir: string) => Promise<WholeSolutionResult>;
}

export interface ScoredLesson {
  scorecard: LessonBundleScorecard;
  /** The whole scorecard as the text an authoring model has to act on. */
  report: string;
  /** Whether the editor would install this bundle as `local-ai`. */
  installable: boolean;
  /** Present when it would not. */
  refusal?: string;
}

/**
 * Score a manifest against two project directories.
 *
 * Throws {@link ToolError} only for the caller's own mistakes — a directory that
 * is not a v2 project. Everything about the *lesson* comes back as a scorecard,
 * because a lesson that is wrong is the ordinary case this tool exists for.
 */
export async function scoreLesson(manifest: LessonManifest, options: ScoreLessonOptions): Promise<ScoredLesson> {
  const starterSource = readLessonProject(options.starterDir, nodeBundleFs);
  if (!starterSource) {
    throw new ToolError(
      'invalid-argument',
      `"${options.starterDir}" is not a NodeGX project — there is no components/_registry.json in it. The ` +
        'starter is the project the learner opens, so it has to be a real project directory.'
    );
  }

  const solutionSource = readLessonProject(options.solutionDir, nodeBundleFs);
  if (!solutionSource) {
    throw new ToolError(
      'invalid-argument',
      `"${options.solutionDir}" is not a NodeGX project — there is no components/_registry.json in it. The ` +
        "solution is the lesson's own answer, and without it the conditions cannot be replayed at all."
    );
  }

  const grade = options.grade;
  const wholeSolution: WholeSolutionGrader | undefined = options.skipRender
    ? undefined
    : grade
      ? { check: () => grade(options.solutionDir) }
      : createWholeSolutionGrader(options.solutionDir);

  // 🔴 CN-003 slice 4 — the lesson is checked against **the starter's** kits, not
  // against the shipped catalog and not against whatever project this server is
  // bound to. The starter is the project the learner opens, so its node types are
  // the ones a condition may name. Without this, `create_lesson` refuses every
  // lesson that teaches a node the project's own kit provides — as a typo.
  const kits = bundleVocabularyFor(options.starterDir);

  const scorecard = await verifyLessonBundle(manifest, {
    starter: buildLessonEvalContext(starterSource, { catalog: kits.catalog }),
    solution: buildLessonEvalContext(solutionSource, { catalog: kits.catalog }),
    ...(wholeSolution ? { wholeSolution } : {}),
    verify: { vocabulary: kits.vocabulary }
  });

  // The producer holds itself to the same table the installer will apply. A
  // bundle this tool writes and the editor then refuses would be the worst of
  // both — so `create_lesson` asks the install policy directly rather than
  // re-deriving what "good enough" means.
  const decision = decideInstall(scorecard, 'local-ai');

  return {
    scorecard,
    report: formatBundleScorecard(scorecard),
    installable: decision.allowed,
    ...(decision.reason ? { refusal: decision.reason } : {})
  };
}

export interface WriteLessonOptions extends ScoreLessonOptions {
  /** Where the bundle goes. Created if absent; refused if non-empty and not a bundle already. */
  bundleDir: string;
  /**
   * Write even though the render could not run.
   *
   * ⚠️ A deliberate, named exception rather than a silent fallback. On a machine
   * with no Chrome F4 reports `not-checked`, which is neither a pass nor a
   * failure — the safe default is to refuse, because F4 is the class predicted to
   * dominate. But refusing outright would mean nobody without a working render
   * harness can author a lesson at all, so the escape exists and the refusal
   * names it.
   */
  allowUnrendered?: boolean;
}

export interface WrittenLesson extends ScoredLesson {
  written: boolean;
  bundleDir: string;
}

/**
 * Refuse to write into a directory that already holds something else.
 *
 * 🔴 The bundle is assembled by *merging* two project trees into a directory the
 * caller names, and the caller is a model that has just been handed a path
 * parameter. Pointed at a project, a home directory or a repo, the merge would
 * scatter component files through it and there is no undo. An empty directory, a
 * missing one, or one that is already a bundle (it has a manifest, so this is an
 * iteration on a lesson) are the three cases where that cannot happen.
 */
function assertWritableBundleDir(bundleDir: string): void {
  if (!bundleDir) throw new ToolError('invalid-argument', 'bundle_dir is required.');
  if (!fs.existsSync(bundleDir)) return;

  if (!fs.statSync(bundleDir).isDirectory()) {
    throw new ToolError('invalid-argument', `"${bundleDir}" is a file, not a directory.`);
  }

  const entries = fs.readdirSync(bundleDir);
  if (entries.length === 0 || entries.includes(MANIFEST_FILE)) return;

  throw new ToolError(
    'invalid-argument',
    `"${bundleDir}" already contains other files and is not a lesson bundle (there is no ${MANIFEST_FILE} in ` +
      'it). Writing a bundle merges two project trees into this directory, so it would scatter component ' +
      'files through whatever is already there. Point at a new or empty directory.'
  );
}

/** Copy a project directory, without following anything out of it. */
function copyProject(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true, dereference: false });
}

/**
 * Score, and write the bundle if it passed.
 *
 * The order is the guarantee: nothing reaches disk until every class the machine
 * can check has passed, so there is no state in which a half-verified bundle sits
 * beside an error message waiting to be installed by a model that skimmed.
 */
export async function writeLessonBundle(
  manifest: LessonManifest,
  options: WriteLessonOptions
): Promise<WrittenLesson> {
  assertWritableBundleDir(options.bundleDir);
  const scored = await scoreLesson(manifest, options);

  const renderUnchecked = scored.scorecard.classes.F4 === 'not-checked';

  if (!scored.installable) {
    return { ...scored, written: false, bundleDir: options.bundleDir };
  }

  if (renderUnchecked && !options.allowUnrendered) {
    return {
      ...scored,
      written: false,
      bundleDir: options.bundleDir,
      refusal:
        'Every class that could be checked passed, but the solution was never rendered, so F4 — the solution ' +
        'draws nothing — is unanswered. That is the class most likely to reach a learner: a lesson whose own ' +
        'answer produces an empty page. Fix the render if you can (it needs a built viewer bundle and a ' +
        'Chrome), or pass allow_unrendered: true to write the bundle with F4 deliberately unchecked.'
    };
  }

  // The starter is the bundle root; the solution goes inside it. Written in this
  // order so a partially-copied bundle never has a manifest in it — the reader
  // identifies a bundle by `lesson.json`, so the manifest is the commit point.
  copyProject(options.starterDir, options.bundleDir);
  copyProject(options.solutionDir, path.join(options.bundleDir, SOLUTION_DIR));

  // 🔴 Stamped by the producer, never trusted from the input. The whole value of
  // the field is that it is a downgrade, and a manifest arriving with
  // `authoredBy` already set to something else would be a claim this tool is in
  // a position to correct.
  const stamped: LessonManifest = { ...manifest, authoredBy: 'ai' };
  fs.writeFileSync(path.join(options.bundleDir, MANIFEST_FILE), JSON.stringify(stamped, null, 2), 'utf8');

  return { ...scored, written: true, bundleDir: options.bundleDir };
}
