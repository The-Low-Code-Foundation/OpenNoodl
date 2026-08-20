/**
 * TUT-004 — installing a community tutorial's bundle, in one action, with no browser.
 *
 * ## 🔴 THIS FILE BUILDS A CALLER. IT DOES NOT BUILD AN INSTALLER.
 *
 * `LearningFolderModel.install` exists, is wired, and has been called from `ProjectsPage` since
 * UNI-007. `LearningSource`'s `{kind:'platform', url}` arm has been *declared and unconstructed*
 * since the same slice — two test files and nothing else in `packages/**`. So the work here is
 * exactly: **fetch → stage → the install that already exists → record where it came from → make
 * reset able to re-pull.** A file that wrote a second install path would have misread the task.
 *
 * ⚠️ `learningfolder.ts` is emphatic that **the editor process writes the register — never a
 * sidecar, never the platform**. That rule is why this module takes a *fetcher* and a
 * *filesystem* and calls back into the register, rather than the register learning to fetch.
 *
 * ## The order, and why staging is not the Learning folder
 *
 * AC4: a bundle the harness refuses is refused here too, **and nothing is written to the
 * Learning folder**. That is only true if the files land somewhere else first — so a fetched
 * bundle is written to a staging directory, scored there, and only then handed to `install`,
 * which copies it into Learning. A refusal removes the staging directory and the register never
 * hears about it.
 *
 * 🔴 **AND THE STAGING DIRECTORY IS REMOVED ON EVERY PATH, INCLUDING SUCCESS.** `install` copies
 * out of it; keeping it would leave a second copy of every lesson ever installed, growing
 * silently, and a `source.path` somebody could later mistake for a re-pullable local bundle. The
 * source of a platform lesson is a URL, and it stays a URL.
 *
 * ## R2, answered 2026-08-20
 *
 * A community tutorial installs as **`curated`**. `articles` has no author column and no
 * authoring UI — every tutorial on the platform is editorial — so "a bundle from an arbitrary
 * member" is not a thing that can exist yet, and inventing a provenance for it would be a policy
 * with no population.
 *
 * ⚠️ **That is not the loose end it looks like**, because provenance may only ever tighten. A
 * bundle whose manifest says `authoredBy: "ai"` is moved to `local-ai` by
 * `resolveProvenance` — from a one-class gate to a three-class one — no matter what this module
 * passes. TUT-003's bundle declares exactly that, so the first tutorial to travel this path is
 * held to F1+F2+F3. 🔴 When member-authored tutorials do arrive they need a new row in
 * `REQUIRED_CLASSES` and a column that says who wrote it; what they must **not** get is a
 * cheaper path than `local-ai`, or the asymmetry that makes the AI claim safe to honour inverts.
 * `lessoninstallpolicy`'s "a claim may only ever cost the claimant" spec is the alarm.
 *
 * @module noodl-editor/models/lessonplatforminstall
 */

import type { Read, TutorialBundlePayload } from './community/communityapi';
import type {
  InstallLessonOutcome,
  LearningEntry,
  LessonProvenance,
  PreflightOutcome,
  ResetLessonOutcome
} from './learningfolder';
import type { LessonBundleScorecard } from './lessonbundleverify';

/**
 * 🔴 R2's answer, in one place. A caller passing its own literal would be a second copy of a
 * policy decision, and the copy that gets updated is never both.
 */
export const PLATFORM_PROVENANCE: LessonProvenance = 'curated';

/** The staging filesystem. Injected for `learningfolder`'s reason — this must load in plain Node. */
export interface StagingFs {
  exists(path: string): boolean;
  makeDirectory(path: string): void;
  removeDirectoryRecursive(path: string): void;
  writeFile(path: string, contents: string): void;
  join(...parts: string[]): string;
  /** The directory part of a path, so a nested entry can have its parent made first. */
  dirname(path: string): string;
}

/** The half of `LearningFolderModel` this module uses. Narrow on purpose — it is also the seam. */
export interface LearningRegister {
  preflight(options: { bundleDir: string; provenance: LessonProvenance }): Promise<PreflightOutcome>;
  install(options: {
    bundleDir: string;
    provenance: LessonProvenance;
    id?: string;
    source?: { kind: 'platform'; url: string };
  }): Promise<InstallLessonOutcome>;
  resetFrom(id: string, sourceDir: string): ResetLessonOutcome;
  get(id: string): LearningEntry | undefined;
}

export interface PlatformSource {
  /** The bundle for a slug. `absent` covers "no such tutorial", "unpublished" and "no bundle". */
  tutorialBundle(slug: string): Promise<Read<TutorialBundlePayload>>;
  /** The URL recorded on the entry, so `reset` knows where to go back to. */
  tutorialBundleUrl(slug: string): string;
}

export interface PlatformInstallDeps {
  register: LearningRegister;
  source: PlatformSource;
  fs: StagingFs;
  /** A directory this module may create and delete freely. Never the Learning folder. */
  stagingRoot: string;
}

/** What a person is shown BEFORE anything lands. AC3. */
export interface InstallPreview {
  title: string;
  /** After the manifest's claim has been folded in, so the label is the gate that ran. */
  provenance: LessonProvenance;
  /** `describeInstallCheck`'s line — names what passed AND what was not checked. */
  checked: string;
  scorecard: LessonBundleScorecard;
}

export interface PlatformInstallOptions {
  slug: string;
  /**
   * Shown the scorecard before the bundle lands. Returning `false` abandons the install.
   *
   * ⚠️ Optional, and its absence means "install without asking" rather than "refuse". A caller
   * with no UI — a test, a script — should not have to fake a person.
   */
  confirm?: (preview: InstallPreview) => boolean | Promise<boolean>;
}

export type PlatformInstallOutcome =
  | { result: 'installed'; entry: LearningEntry; checked: string; scorecard: LessonBundleScorecard }
  /** The harness refused it. Nothing reached the Learning folder. */
  | { result: 'refused'; reason: string; checked?: string; scorecard?: LessonBundleScorecard }
  /** A person saw the scorecard and said no. Not a failure, and not narrated as one. */
  | { result: 'cancelled' }
  /** 🔴 AC7: the network, not the tutorial. The sentence says so and offers a retry. */
  | { result: 'offline'; reason: string }
  /** No bundle, no such tutorial, or D15 says this surface is not there. One answer, on purpose. */
  | { result: 'unavailable'; reason: string };

// ─── Staging ────────────────────────────────────────────────────────────────

/**
 * Write a fetched bundle to a directory of its own.
 *
 * ⚠️ **Path safety is NOT re-checked here, and that is deliberate rather than an omission.**
 * `communityapi.tutorialBundle` refuses the whole payload if any key is not a relative path, so
 * a bundle that reaches this function has already been through the gate that matters — the one
 * inside the process that writes the files. Checking again here would be a third copy of a rule
 * with three chances to disagree; what this function does instead is take `files` from a typed
 * value that only that reader can produce.
 *
 * 🔴 The one thing it must do itself is make parent directories. A bundle is
 * `components/Home.json`, `solution/nodegx.project.json` — nested from the first entry.
 */
export function stageBundleFiles(
  files: Record<string, string>,
  deps: { fs: StagingFs; directory: string }
): void {
  const { fs, directory } = deps;
  if (fs.exists(directory)) fs.removeDirectoryRecursive(directory);
  fs.makeDirectory(directory);
  for (const [relative, contents] of Object.entries(files)) {
    const full = fs.join(directory, relative);
    const parent = fs.dirname(full);
    if (parent && parent !== directory) fs.makeDirectory(parent);
    fs.writeFile(full, contents);
  }
}

/** The sentence for each non-`ok` read, said in the caller's terms rather than HTTP's. */
function sentenceFor(read: Exclude<Read<unknown>, { outcome: 'ok' }>, slug: string): PlatformInstallOutcome {
  switch (read.outcome) {
    case 'absent':
      return {
        result: 'unavailable',
        reason: `There is nothing to install for "${slug}". The tutorial may not have a project attached.`
      };
    case 'unauthenticated':
      // ⚠️ Should not happen — this route is public — but folding it into `offline` would tell
      // somebody their network was down while the platform answered them precisely.
      return { result: 'unavailable', reason: 'NodeGX Community did not accept this session.' };
    default:
      return {
        result: 'offline',
        reason: `NodeGX Community could not be reached, so "${slug}" can't be installed right now. ${read.detail}`
      };
  }
}

// ─── The caller ─────────────────────────────────────────────────────────────

/**
 * One action: fetch a tutorial's bundle, score it, show what was checked, install it.
 *
 * The staging directory is removed on every exit, so a refusal, a cancellation and a network
 * failure all leave the machine exactly as they found it.
 */
export async function installTutorialFromPlatform(
  options: PlatformInstallOptions,
  deps: PlatformInstallDeps
): Promise<PlatformInstallOutcome> {
  const { register, source, fs, stagingRoot } = deps;
  const slug = options.slug;

  const read = await source.tutorialBundle(slug);
  if (read.outcome !== 'ok') return sentenceFor(read, slug);

  const bundleDir = fs.join(stagingRoot, slug);
  try {
    stageBundleFiles(read.value.files, { fs, directory: bundleDir });
  } catch (e) {
    return { result: 'offline', reason: `The lesson could not be unpacked: ${errorText(e)}` };
  }

  try {
    // 🔴 Scored BEFORE it lands, by the same code that admits it. See `preflight`.
    const pre = await register.preflight({ bundleDir, provenance: PLATFORM_PROVENANCE });
    if (pre.result !== 'ok') {
      return {
        result: 'refused',
        reason: pre.reason,
        ...(pre.checked ? { checked: pre.checked } : {}),
        ...(pre.scorecard ? { scorecard: pre.scorecard } : {})
      };
    }

    if (options.confirm) {
      const proceed = await options.confirm({
        title: pre.title || read.value.title,
        provenance: pre.provenance,
        checked: pre.checked,
        scorecard: pre.scorecard
      });
      if (!proceed) return { result: 'cancelled' };
    }

    const outcome = await register.install({
      bundleDir,
      provenance: PLATFORM_PROVENANCE,
      // 🔴 AC2. The arm that has been declared and unconstructed since UNI-007.
      source: { kind: 'platform', url: source.tutorialBundleUrl(slug) }
    });

    if (outcome.result !== 'installed') {
      return { result: 'refused', reason: outcome.reason, checked: pre.checked, scorecard: pre.scorecard };
    }
    return { result: 'installed', entry: outcome.entry, checked: pre.checked, scorecard: pre.scorecard };
  } finally {
    // Success included — see the module header. `install` has copied what it needs.
    try {
      fs.removeDirectoryRecursive(bundleDir);
    } catch {
      /* A staging directory we could not remove is litter, not a failed install. */
    }
  }
}

/**
 * AC5 — re-pull a platform lesson.
 *
 * 🔴 **BOTH ARMS MATTER AND THE FAILING ONE IS THE OLDER.** `ResetLessonOutcome`'s
 * `'unavailable'` has existed since UNI-007 and meant *"we have no way to fetch this"*. It now
 * means *"we tried and could not reach the platform"*, which is a different fact with the same
 * name — so the sentence has to say which, and the installed copy has to still be there
 * afterwards either way. `learningfolder.reset`'s rule is the one being honoured: the source is
 * checked before anything is deleted, because reset is the button someone presses when they are
 * already stuck.
 */
export async function resetLessonFromPlatform(
  id: string,
  deps: PlatformInstallDeps
): Promise<ResetLessonOutcome> {
  const { register, source, fs, stagingRoot } = deps;

  const entry = register.get(id);
  if (!entry) return { result: 'unavailable', reason: `No lesson called "${id}" is installed.` };
  if (entry.source.kind !== 'platform') {
    return { result: 'unavailable', reason: `"${id}" did not come from NodeGX Community.` };
  }

  const slug = slugFromBundleUrl(entry.source.url);
  if (!slug) {
    return {
      result: 'unavailable',
      reason: `"${id}" records where it came from in a form this editor cannot re-pull (${entry.source.url}). Nothing was changed.`
    };
  }

  const read = await source.tutorialBundle(slug);
  if (read.outcome !== 'ok') {
    const said = sentenceFor(read, slug);
    // ⚠️ "Nothing was changed" is not decoration. It is the difference between this outcome and
    // the one where a reset half-ran, and it is what makes the message safe to show someone
    // whose work is still on disk.
    return { result: 'unavailable', reason: `${'reason' in said ? said.reason : ''} Nothing was changed.`.trim() };
  }

  const bundleDir = fs.join(stagingRoot, `${slug}-reset`);
  try {
    stageBundleFiles(read.value.files, { fs, directory: bundleDir });
    return register.resetFrom(id, bundleDir);
  } catch (e) {
    return { result: 'unavailable', reason: `The lesson could not be re-pulled: ${errorText(e)}. Nothing was changed.` };
  } finally {
    try {
      fs.removeDirectoryRecursive(bundleDir);
    } catch {
      /* litter, not a failed reset */
    }
  }
}

/**
 * The tutorial slug an entry's source URL names.
 *
 * ⚠️ Parsed rather than stored beside the URL, because `LearningSource`'s platform arm is
 * `{kind, url}` and widening it would touch every reader of the register for one caller's
 * convenience. Returns `undefined` for a URL this editor did not write — an entry installed by
 * an older or newer build says so rather than being guessed at.
 */
export function slugFromBundleUrl(url: string): string | undefined {
  const match = /\/api\/v1\/community\/tutorials\/([^/]+)\/bundle\/?$/.exec(url);
  if (!match) return undefined;
  try {
    const slug = decodeURIComponent(match[1]);
    return slug.length > 0 ? slug : undefined;
  } catch {
    return undefined;
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
