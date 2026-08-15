/**
 * UNI-010 slice 2 — which failure classes a bundle must have *passed* to install,
 * and who is allowed to say who wrote it.
 *
 * WHY A POLICY TABLE RATHER THAN A BOOLEAN
 * ----------------------------------------
 * Slice 1 ended with `LessonBundleScorecard.installable` — "every class was
 * checked and passed" — and that is the right idea and the wrong gate to install
 * through, for a reason only building the caller showed:
 *
 * 🔴 **The editor cannot answer F4.** Engine 2's editor adapter
 * (`lessonwholesolution.live.ts`) drives a hidden window over the *running
 * viewer*, so it grades the project the learner has open. Nothing in a packaged
 * editor can render a solution directory sitting inside a bundle — the sidecar's
 * adapter spawns the render harness out of `scripts/`, and `scripts/` is not in
 * `package.json`'s `build.files`. So `installable` is unreachable in the shipped
 * editor, and gating install on it would mean **no AI-authored lesson could ever
 * be installed**, which is a gate that rejects the correct answer: the fourth
 * amendment's failure, one slice later.
 *
 * The honest shape is a table of *which classes this provenance must have passed*,
 * plus one rule that holds for everyone:
 *
 *   - **No class may FAIL, whatever the provenance.** A `dead-on-solution` step
 *     in a curated lesson is exactly as uncompletable as one in a generated
 *     lesson. Slice 3's gate only ever saw F1, so this widens what a curated
 *     bundle is checked for as well.
 *   - **A required class may not be `not-checked`.** For `local-ai` that is F1,
 *     F2 and F3 — which is the free-authoring bargain made structural: a bundle
 *     with no `solution/` cannot be replayed, so it cannot install.
 *
 * ⚠️ **F4 is required of nobody at install, and that is a recorded gap rather
 * than a judgement that it does not matter.** The prior arc's pre-registered
 * prediction is that F4 *dominates*. It is answered at authoring time, in the MCP
 * `create_lesson` gate, which does have the render harness — so the class most
 * likely to bite is checked by the producer and not by the installer. When a
 * grader *is* injected here, F4 is scored and a failure blocks like any other;
 * what this table declines to do is demand a check the installing process is
 * incapable of running.
 *
 * PROVENANCE: A CLAIM MAY ONLY TIGHTEN
 * ------------------------------------
 * Slice 3 ruled that provenance is the caller's word and never the manifest's,
 * because a bundle that *declared* itself `curated` would be believed and the one
 * producer this format invites is an agent on the user's machine. That reasoning
 * is asymmetric and the asymmetry is usable: declaring `curated` buys trust, and
 * declaring **`local-ai` spends it** — it moves the bundle from a one-class gate
 * to a three-class one. A liar has no motive, so the claim is safe to honour in
 * exactly one direction.
 *
 * That is what lets the AI route work with no new plumbing at all: the sidecar
 * writes `authoredBy: "ai"` into the manifest, the learner installs the folder
 * through the launcher's ordinary route, and the editor still ends up applying
 * the stricter gate and showing the AI-authored label. D5 is untouched — the
 * sidecar wrote a bundle on disk and the editor process wrote the register.
 *
 * @module noodl-editor/models/lessoninstallpolicy
 */

import type { FailureClassResult, LessonBundleScorecard } from './lessonbundleverify';
import type { LessonProvenance } from './learningfolder';

export type FailureClass = 'F1' | 'F2' | 'F3' | 'F4';

/**
 * What each provenance must have *checked and passed*.
 *
 * The one place this decision lives. A second copy of it in a caller is how
 * "AI-authored bundles are held to a higher standard" becomes true of one install
 * route and false of the next.
 */
export const REQUIRED_CLASSES: Record<LessonProvenance, ReadonlyArray<FailureClass>> = {
  /** Human-authored on the platform: the static check, as slice 3 shipped. */
  curated: ['F1'],
  /** An org's own lesson. Same posture as curated — a person stands behind it. */
  org: ['F1'],
  /** A folder the user pointed us at. Says nothing about who wrote it. */
  local: ['F1'],
  /**
   * The free-authoring bargain, made structural. F2 and F3 are only answerable
   * against the lesson's own solution, so requiring them requires a `solution/`.
   */
  'local-ai': ['F1', 'F2', 'F3']
};

/** Human-readable, because these strings reach an authoring model. */
const CLASS_NAMES: Record<FailureClass, string> = {
  F1: 'F1 (conditions that can never match)',
  F2: "F2 (conditions that do not hold against the lesson's own solution)",
  F3: 'F3 (addresses that resolve to the wrong node)',
  F4: 'F4 (a solution that draws nothing)'
};

/**
 * The manifest's own claim about who wrote it.
 *
 * Deliberately not called `provenance`: it is a *claim*, one value wide, and the
 * only thing it can do is make the gate stricter. See the module note.
 */
export type ManifestAuthorshipClaim = 'ai' | undefined;

/**
 * Fold a manifest's claim into the caller's word.
 *
 * The caller's word wins in every case except the one where the manifest asks to
 * be trusted *less*. A manifest claiming anything else is ignored in silence —
 * there is no finding to raise, because the field is not a promise the format
 * makes to the author, it is a downgrade switch.
 */
export function resolveProvenance(caller: LessonProvenance, claim: unknown): LessonProvenance {
  if (claim === 'ai' && caller !== 'local-ai') return 'local-ai';
  return caller;
}

export interface InstallDecision {
  allowed: boolean;
  /** Present when refused, and written for the model that has to fix the bundle. */
  reason?: string;
}

/**
 * May a bundle with this scorecard install under this provenance?
 *
 * Never throws, and never *passes* on a class that failed — the required list
 * widens the gate, it does not narrow it.
 */
export function decideInstall(scorecard: LessonBundleScorecard, provenance: LessonProvenance): InstallDecision {
  const classes = scorecard.classes as Record<FailureClass, FailureClassResult>;

  const failed = (Object.keys(classes) as FailureClass[]).filter((c) => classes[c] === 'fail');
  if (failed.length > 0) {
    const errors = scorecard.findings.filter((f) => f.severity === 'error');
    return {
      allowed: false,
      reason:
        `This lesson would not be completable: ${failed.map((c) => CLASS_NAMES[c]).join(', ')} failed. ` +
        `First problem: ${errors[0]?.message ?? 'unknown'}`
    };
  }

  const required = REQUIRED_CLASSES[provenance] ?? REQUIRED_CLASSES.local;
  const unchecked = required.filter((c) => classes[c] !== 'pass');
  if (unchecked.length > 0) {
    return {
      allowed: false,
      reason:
        `A lesson installed as "${provenance}" has to be checked on ${required.join(', ')} before a learner ` +
        `sees it, and ${unchecked.map((c) => CLASS_NAMES[c]).join(', ')} could not be checked here. ` +
        `That almost always means the bundle carries no "solution/" folder — without the lesson's own answer ` +
        `its conditions cannot be replayed, and nothing has established that a learner who does exactly what ` +
        `the lesson asks is told they finished.`
    };
  }

  return { allowed: true };
}

/**
 * One line for a human, naming what was and was not checked.
 *
 * ⚠️ It says "not checked" rather than omitting the class, on purpose: the whole
 * discipline of this arc is that "we did not look" and "we looked and it was
 * fine" must never be written the same way.
 */
export function describeInstallCheck(scorecard: LessonBundleScorecard, provenance: LessonProvenance): string {
  const classes = scorecard.classes as Record<FailureClass, FailureClassResult>;
  const passed = (Object.keys(classes) as FailureClass[]).filter((c) => classes[c] === 'pass');
  const skipped = (Object.keys(classes) as FailureClass[]).filter((c) => classes[c] === 'not-checked');

  const parts = [`Checked as ${provenance}: ${passed.length ? passed.join(', ') + ' passed' : 'nothing passed'}`];
  if (skipped.length) parts.push(`${skipped.join(', ')} not checked`);
  return parts.join('; ') + '.';
}
