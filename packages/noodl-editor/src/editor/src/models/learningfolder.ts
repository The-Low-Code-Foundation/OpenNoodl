/**
 * UNI-007 slice 3 — the Learning folder: the register behind D5's launcher section.
 *
 * WHY IT IS A SECOND STORE, NOT A FLAG ON `recentProjects`
 * -------------------------------------------------------
 * D5 rules that a lesson project is **platform-managed**: freely editable
 * inside — that IS the lesson — but the learner "cannot rename, detach or
 * delete it from the launcher", and reset means re-pulling a fresh copy rather
 * than repairing one.
 *
 * A boolean on `LocalProjectsModel`'s entries would have put lesson projects
 * into the recents list, where `renameProject` and `removeProject` already
 * exist and are already wired to the card menu. Every one of those call sites
 * would then need a guard, and a guard that has to be remembered at N sites is
 * a rule that will be broken at N+1. A separate register makes the ruling
 * **structural**: there is no rename, there is no delete, and a lesson cannot
 * appear in the normal picker flow because it is not in the list the normal
 * picker flow reads.
 *
 * 🔴 THE EDITOR PROCESS WRITES THIS. NEVER A SIDECAR, NEVER THE PLATFORM.
 * ----------------------------------------------------------------------
 * D5, and the bridge direction (README surface 3, the OBS-004 lesson): the
 * launcher's stores are read-only to external processes. An MCP sidecar that
 * wants a lesson installed asks the editor; it does not write here. UNI-010's
 * "your own Claude authors a lesson" therefore lands as a **bundle on disk**
 * that the editor installs, which is why {@link LearningSource} names a path
 * rather than a writer.
 *
 * PURITY, AND WHY THE PORTS EXIST
 * -------------------------------
 * `electron-store`, `@noodl/platform` and `node:fs` are all injected. That is
 * the same constraint the rest of UNI-007 is built under (`lessonverify`,
 * `lessongrading`): the pure core has to load in a plain-Node runner, because
 * UNI-010 runs this arc with no renderer around it. {@link defaultDeps} builds
 * the real ones with a lazy `require`, so importing this module from
 * `tests-unit/` never reaches Electron.
 *
 * NOTHING HERE LOADS A PROJECT. Installing is a file operation and a register
 * write; opening the installed project is the caller's job, through the same
 * `projectFromDirectory` path `LessonsProjectsModel` uses — deliberately *not*
 * `LocalProjectsModel.openProjectFromFolder`, which would add the lesson to
 * recents and undo the whole point of the separate store.
 *
 * @module noodl-editor/models/learningfolder
 */

import Model from '../../../shared/model';
import type { LessonEvidence, WholeSolutionGrader } from './lessongrading';
import { verifyLessonBundle } from './lessonbundleverify';
import type { LessonBundleScorecard } from './lessonbundleverify';
import { readLessonBundle } from './lessonbundleread';
import { decideInstall, resolveProvenance } from './lessoninstallpolicy';
import { buildLessonEvalContext } from './lessonprojectcontext';
import type { LessonProjectSource } from './lessonprojectcontext';
import { bundleLessonVocabulary } from './lessonverify';
import type { LessonVerificationReport, LessonVocabulary } from './lessonverify';
import { shippedCatalogIndex } from '../validation/catalog';
import type { CatalogIndex } from '../validation/CatalogIndex';
import type { LessonEvalContext } from '../views/lessons/lessonevalconditions';

/** The directory a project's node kits live in. */
const MODULES_DIR = 'noodl_modules';

// ─── What a Learning-section entry is ───────────────────────────────────────

/**
 * Which producer wrote the bundle. The format is an open contract with two
 * producers from day one (UNI-007), and UNI-010 adds a third that involves no
 * account at all — so provenance is recorded on the entry.
 *
 * 🔴 **The caller supplies it and the manifest never does.** A bundle that
 * *declared* itself `curated` would be believed, and the one producer this
 * format explicitly invites is an agent on the user's own machine — so a
 * self-declared field is a claim, not a fact. Only the code that knows the
 * route the bundle arrived by can answer honestly, which is why this is an
 * install argument.
 *
 * `local` is that honesty made explicit: a folder the user pointed us at is
 * *installed from disk*, and nothing about it says who wrote it.
 *
 * 🔴 **UNI-010 slice 2 amended how the AI route reaches `local-ai`, and the
 * amendment sharpens the rule rather than bending it.** Slice 3 assumed the
 * editor would "watch the MCP write it" — it does not, and cannot: the sidecar
 * writes a folder and the learner installs it through the ordinary picker, which
 * knows nothing. The way out is that this rule is **asymmetric**. Declaring
 * `curated` buys trust and is ignored; declaring `authoredBy: "ai"` *spends* it,
 * moving the bundle from a one-class install gate to a three-class one — so a
 * liar has no motive and the claim is safe to honour in that one direction. See
 * `lessoninstallpolicy.resolveProvenance`.
 */
export type LessonProvenance = 'curated' | 'org' | 'local-ai' | 'local';

/**
 * Where a lesson came from, kept so **reset can re-pull**. D5's entire recovery
 * story is "re-pull a fresh copy"; an entry that cannot say where it came from
 * cannot be reset, which is the one repair the learner is offered.
 */
export type LearningSource =
  | { kind: 'local'; path: string }
  | { kind: 'platform'; url: string };

/** How far through the lesson the learner is. Fed by the lesson runtime. */
export interface LearningProgress {
  /** Zero-based index of the step the learner is on. */
  stepIndex: number;
  stepCount: number;
}

/**
 * The last grade recorded against this lesson.
 *
 * ⚠️ `gradedBy` matters and is not decoration: UNI-006 gives a human the final
 * say over a runner's verdict, and a card that cannot say which one it is
 * showing cannot show the override. It is also why the card must not assume an
 * account — a locally graded lesson and a platform-graded one both land here
 * (D5), and the display cannot tell them apart.
 */
export interface LearningGrade {
  completionPercent: number;
  complete: boolean;
  /** ISO timestamp, supplied by the caller — this module has no clock of its own. */
  gradedAt: string;
  gradedBy: 'runner' | 'human';
  /** Free text shown on the card. Machine feedback or a human's. */
  feedback?: string;
  /**
   * Engine 2's summary, when it ran. The same three fields
   * {@link LessonEvidence} carries, and for the same reason — `unavailable` is a
   * flag, never the sentence, because the sentence names a filesystem.
   */
  wholeSolution?: { valid: boolean; rendered: boolean; findingCount: number; unavailable?: true };
}

export interface LearningEntry {
  /** Stable id. Also the folder name under the Learning root, so it is constrained. */
  id: string;
  title: string;
  description?: string;
  provenance: LessonProvenance;
  /** Absolute path of the installed lesson project. */
  projectDirectory: string;
  source: LearningSource;
  /** ISO timestamp, supplied by the caller. */
  installedAt: string;
  progress?: LearningProgress;
  grade?: LearningGrade;
  /**
   * UNI-006 — set when this lesson is on the card because an org ASSIGNED it.
   *
   * 🔴 Its presence is the only thing that makes "check my work" hand anything in. An
   * ordinary lesson a learner installed themselves has no assignment, submits nothing, and
   * must not: D5 rules that the Learning folder works with no platform and no account at
   * all, and a grader that phoned home for every lesson would quietly repeal that.
   */
  assignment?: LearningAssignmentLink;
}

/** What links a Learning-folder entry back to the org that set the work. */
export interface LearningAssignmentLink {
  assignmentId: string;
  orgSlug: string;
  /** Set once the platform has ACCEPTED a submission — never when one was merely attempted. */
  submittedAt?: string;
  /** The platform's own state for the submission, as of the last accepted submit. */
  state?: 'in_progress' | 'submitted' | 'graded';
}

/**
 * An entry as the launcher sees it. `missing` is computed, never persisted: a
 * folder the user deleted from Finder is a repairable state (reset re-pulls),
 * not a reason to silently drop the entry — dropping it is the "detach" D5
 * forbids, arrived at by accident.
 */
export interface LearningEntryView extends LearningEntry {
  missing: boolean;
}

// ─── Ports ──────────────────────────────────────────────────────────────────

export interface LearningFolderStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/**
 * The filesystem this model needs, and nothing more. Synchronous on purpose:
 * the register is small, the launcher reads it during render, and an async
 * read would buy nothing but a loading state.
 */
export interface LearningFolderFs {
  exists(path: string): boolean;
  makeDirectory(path: string): void;
  removeDirectoryRecursive(path: string): void;
  copyRecursive(from: string, to: string): void;
  /** Parsed JSON, or `undefined` when the file is missing or unreadable. Never throws. */
  readJsonFile(path: string): unknown;
  join(...parts: string[]): string;
}

export interface LearningFolderDeps {
  store: LearningFolderStore;
  fs: LearningFolderFs;
  /** Absolute path of the Learning folder root. */
  root: string;
  /** ISO-timestamp source. Injected so the module stays pure and its tests stay stable. */
  now: () => string;
}

// ─── Outcomes ───────────────────────────────────────────────────────────────

export interface InstallLessonOptions {
  /** The bundle on disk: project files plus `lesson.json`. */
  bundleDir: string;
  provenance: LessonProvenance;
  /**
   * Defaults to a slug of the manifest title. Constrained to a safe folder
   * segment — see {@link isSafeLessonId}.
   */
  id?: string;
  /** Defaults to `{ kind: 'local', path: bundleDir }`. */
  source?: LearningSource;
  /**
   * Engine 2 over the bundle's **solution**, when the installing process can run
   * one. Absent means F4 is `not-checked`, which is the shipped editor's ordinary
   * state and is why F4 is required of nobody — see `lessoninstallpolicy`.
   */
  wholeSolution?: WholeSolutionGrader;
}

export type InstallLessonOutcome =
  | {
      result: 'installed';
      entry: LearningEntry;
      /** The static half, kept at the top level because callers already read it. */
      verification: LessonVerificationReport;
      /** All four classes, as scored at install. */
      scorecard: LessonBundleScorecard;
    }
  /** The bundle was refused. Both reports are present when the refusal came from the check. */
  | {
      result: 'rejected';
      reason: string;
      verification?: LessonVerificationReport;
      scorecard?: LessonBundleScorecard;
    };

export type ResetLessonOutcome =
  | { result: 'reset'; entry: LearningEntry }
  /** Nothing was touched — the source could not be re-pulled, so the installed copy stands. */
  | { result: 'unavailable'; reason: string };

// ─── Id rules ───────────────────────────────────────────────────────────────

/**
 * An id becomes a directory name under the Learning root, and one of the three
 * producers of this format is **an agent on the user's machine** (UNI-010). So
 * this is a path-traversal boundary, not a tidiness rule: `../../..` in a
 * manifest title must not decide where files land.
 */
export function isSafeLessonId(id: string): boolean {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id) && !id.includes('..');
}

/** A folder-safe id from a lesson title. Empty when the title yields nothing usable. */
export function slugifyLessonId(title: string | undefined): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

// ─── The model ──────────────────────────────────────────────────────────────

const STORE_KEY = 'lessons';

/**
 * Events: `learningFolderChanged` after any write. One event, because the
 * launcher re-reads the whole (short) list anyway and a per-entry event would
 * be a second thing to keep correct for no gain.
 */
export class LearningFolderModel extends Model {
  private static _instance: LearningFolderModel | undefined;

  /** The real one, built lazily so a plain-Node import never reaches Electron. */
  static get instance(): LearningFolderModel {
    if (!LearningFolderModel._instance) {
      LearningFolderModel._instance = new LearningFolderModel(defaultDeps());
    }
    return LearningFolderModel._instance;
  }

  constructor(private readonly deps: LearningFolderDeps) {
    super();
  }

  /** Absolute path of the Learning folder root. */
  get root(): string {
    return this.deps.root;
  }

  private read(): LearningEntry[] {
    const raw = this.deps.store.get(STORE_KEY);
    return Array.isArray(raw) ? (raw as LearningEntry[]) : [];
  }

  private write(entries: LearningEntry[]): void {
    this.deps.store.set(STORE_KEY, entries);
    this.notifyListeners('learningFolderChanged');
  }

  /**
   * Every installed lesson, newest install first, each carrying whether its
   * folder is still there.
   */
  list(): LearningEntryView[] {
    return this.read()
      .slice()
      .sort((a, b) => (b.installedAt ?? '').localeCompare(a.installedAt ?? ''))
      .map((entry) => ({ ...entry, missing: !this.deps.fs.exists(entry.projectDirectory) }));
  }

  get(id: string): LearningEntryView | undefined {
    return this.list().find((entry) => entry.id === id);
  }

  /**
   * Install a bundle into the Learning folder.
   *
   * 🔴 **The verifier is the gate, and this is the moment it earns its keep.**
   * A lesson whose conditions are written in the prose vocabulary can never be
   * completed — the learner is told they have not done a step they have in fact
   * done (LESSON-FORMAT §3). Refusing at install is the only point where that
   * costs nothing; refusing later means a learner has already been stuck.
   *
   * 🔴 **Slice 2 widened this from F1 to the whole scorecard, and there is one
   * door.** Until now this ran `verifyLessonManifest` alone, so an AI-authored
   * bundle got the static check and nothing else — the free-authoring bargain was
   * priced at four classes and collected at one. The temptation was to add a
   * second, stricter `installVerified()` beside this and leave the F1-only door
   * open for the callers that already existed. That is the shape slice 3's own
   * header argues against ("a rule enforced at N sites is broken at N+1"), so
   * instead this method absorbed the harness and every caller awaits it.
   *
   * Which classes must have *passed* is {@link REQUIRED_CLASSES}, keyed by
   * provenance — and a `fail` in any class blocks regardless, which also makes
   * curated bundles better checked than they were.
   *
   * Warnings do not block. A deprecated-but-unshadowed node type is a lesson
   * that will age badly, not one that cannot be finished.
   *
   * Never throws: both machine producers of this format hand it machine-written
   * JSON, so a malformed bundle is an outcome, not an exception. The context
   * builders reconstruct arbitrary on-disk files, so they are guarded too.
   */
  async install(options: InstallLessonOptions): Promise<InstallLessonOutcome> {
    const { fs } = this.deps;
    const bundleDir = options.bundleDir;

    if (!bundleDir || !fs.exists(bundleDir)) {
      return { result: 'rejected', reason: `There is no lesson bundle at ${bundleDir || '(no path given)'}.` };
    }

    const bundle = readLessonBundle(bundleDir, fs);
    const manifest = bundle.manifest;
    if (!manifest || typeof manifest !== 'object') {
      return {
        result: 'rejected',
        reason: 'The bundle has no readable lesson.json. A lesson bundle is project files plus a lesson.json manifest.'
      };
    }

    // The manifest may make the gate stricter and may never make it looser.
    const provenance = resolveProvenance(options.provenance, manifest.authoredBy);

    // 🔴 CN-003 slice 4. Everything below answers about **this bundle**, so
    // everything below is handed the bundle's vocabulary explicitly — never the
    // module default, which after slice 3 carries the *open project's* kits.
    // Measured before it was fixed: with a kit project open, a bundle's nodes
    // were given that project's ports. See {@link bundleVocabularyFor}.
    const vocabulary = this.bundleVocabularyFor(bundleDir);
    const starter = contextFor(bundle.starter, shippedCatalogIndex());
    const solution = contextFor(bundle.solution, shippedCatalogIndex());
    const scorecard = await verifyLessonBundle(manifest, {
      ...(starter ? { starter } : {}),
      ...(solution ? { solution } : {}),
      ...(options.wholeSolution ? { wholeSolution: options.wholeSolution } : {}),
      verify: { vocabulary }
    });
    const verification = scorecard.verification;

    const decision = decideInstall(scorecard, provenance);
    if (!decision.allowed) {
      return { result: 'rejected', reason: decision.reason ?? 'This lesson was refused.', verification, scorecard };
    }

    const id = options.id ?? slugifyLessonId(manifest.title);
    if (!isSafeLessonId(id)) {
      return {
        result: 'rejected',
        reason: `"${id}" is not a usable lesson id. Use letters, digits, dots, dashes and underscores.`
      };
    }

    const projectDirectory = fs.join(this.deps.root, id);

    try {
      if (fs.exists(projectDirectory)) fs.removeDirectoryRecursive(projectDirectory);
      fs.makeDirectory(projectDirectory);
      fs.copyRecursive(bundleDir, projectDirectory);
    } catch (e) {
      return {
        result: 'rejected',
        reason: `The lesson could not be written to disk: ${errorText(e)}`,
        verification,
        scorecard
      };
    }

    const entry: LearningEntry = {
      id,
      title: manifest.title ?? id,
      ...(manifest.description ? { description: manifest.description } : {}),
      provenance,
      projectDirectory,
      source: options.source ?? { kind: 'local', path: bundleDir },
      installedAt: this.deps.now()
    };

    // A reinstall replaces the entry outright rather than merging: the files were
    // just replaced, so carrying the old grade forward would attach a verdict to
    // work that is no longer there.
    const entries = this.read().filter((e) => e.id !== id);
    entries.push(entry);
    this.write(entries);

    return { result: 'installed', entry, verification, scorecard };
  }

  /**
   * The vocabulary a bundle at `bundleDir` is checked against.
   *
   * 🔴 **The editor cannot read a bundle's kits, and both rulings that say so
   * point the same way.** ✅ **D3** puts extraction in exactly one process — the
   * MCP server, which is headless and has the extractor — and the editor's own
   * kit knowledge comes from the viewer, which has not loaded this bundle and
   * will not until someone opens it. ✅ **D6** is the sharper half: resolving a
   * downloaded bundle's kit types means *executing* its JavaScript, and consent
   * to run third-party kit code is precisely what D6 requires first. A gate that
   * runs the code in order to decide whether the code may run has no gate in it.
   *
   * So this returns the shipped vocabulary, and — when the bundle carries a
   * `noodl_modules/` — one that **says it is incomplete**. The verdict on an
   * unresolvable type is unchanged (still an error, still blocks; ✅ D4 was ruled
   * against quiet downgrades). What changes is that the refusal stops asserting
   * "there is no such node type", which is a claim this path cannot support and
   * which is false for every bundle that ships the kit it teaches.
   *
   * ⚠️ **The same gap costs F2 a second way, and it predates slice 4.** A kit
   * node reconstructed from a bundle's files carries only its stored ports —
   * the catalog supplies the declared ones and this catalog has never heard of
   * the kit — so a `hasPort` condition over a kit node reads false against the
   * lesson's own correct solution. That is a *manufactured* failure of the kind
   * `lessonprojectcontext`'s header refuses to produce, and it is why "should
   * this block at all" is an open scope question rather than a fix.
   */
  private bundleVocabularyFor(bundleDir: string): LessonVocabulary {
    const { fs } = this.deps;
    const carriesKits = fs.exists(fs.join(bundleDir, MODULES_DIR));
    return bundleLessonVocabulary(
      [],
      carriesKits
        ? {
            where: 'This bundle',
            reason: 'the editor does not run a bundle’s kit code before you have opened it'
          }
        : undefined
    );
  }

  /**
   * D5's whole recovery story: throw the copy away and pull a fresh one.
   *
   * 🔴 **The source is checked before anything is deleted.** Delete-then-fail
   * would lose the learner's work *and* the lesson, which is strictly worse than
   * the state it was called to repair — and "reset" is the button someone presses
   * when they are already stuck.
   */
  reset(id: string): ResetLessonOutcome {
    const { fs } = this.deps;
    const entry = this.read().find((e) => e.id === id);
    if (!entry) return { result: 'unavailable', reason: `No lesson called "${id}" is installed.` };

    if (entry.source.kind !== 'local') {
      return {
        result: 'unavailable',
        reason: 'This lesson came from NodeGX Community. Resetting it needs the platform, which is not connected yet.'
      };
    }

    if (!fs.exists(entry.source.path)) {
      return {
        result: 'unavailable',
        reason: `The lesson can't be re-pulled: its bundle is no longer at ${entry.source.path}. Nothing was changed.`
      };
    }

    try {
      if (fs.exists(entry.projectDirectory)) fs.removeDirectoryRecursive(entry.projectDirectory);
      fs.makeDirectory(entry.projectDirectory);
      fs.copyRecursive(entry.source.path, entry.projectDirectory);
    } catch (e) {
      return { result: 'unavailable', reason: `The lesson could not be re-pulled: ${errorText(e)}` };
    }

    // A fresh copy has no progress and no grade. There is no partial repair path
    // by design, so there is no partial state to keep either.
    const fresh: LearningEntry = {
      ...entry,
      installedAt: this.deps.now(),
      progress: undefined,
      grade: undefined
    };
    delete fresh.progress;
    delete fresh.grade;

    this.write(this.read().map((e) => (e.id === id ? fresh : e)));
    return { result: 'reset', entry: fresh };
  }

  /** Record how far through the lesson the learner is. No-op for an unknown id. */
  recordProgress(id: string, progress: LearningProgress): LearningEntry | undefined {
    return this.update(id, (entry) => ({ ...entry, progress }));
  }

  /**
   * Record a grade from {@link LessonEvidence}.
   *
   * The evidence bundle is the currency on purpose — it is what UNI-002 and
   * UNI-006 consume, it carries no project content (D10), and taking it here
   * means the card and the points event are reading the same numbers rather
   * than two derivations of them.
   */
  recordGrade(
    id: string,
    evidence: LessonEvidence,
    options: { gradedBy?: 'runner' | 'human'; feedback?: string; gradedAt?: string } = {}
  ): LearningEntry | undefined {
    const grade: LearningGrade = {
      completionPercent: evidence.completionPercent,
      complete: evidence.complete,
      gradedAt: options.gradedAt ?? evidence.gradedAt ?? this.deps.now(),
      gradedBy: options.gradedBy ?? 'runner',
      ...(options.feedback ? { feedback: options.feedback } : {}),
      ...(evidence.wholeSolution ? { wholeSolution: evidence.wholeSolution } : {})
    };
    return this.update(id, (entry) => ({ ...entry, grade }));
  }

  /**
   * Record that the platform ACCEPTED a submission for this entry.
   *
   * 🔴 CALLED ONLY ON A 201, and the narrowness is the whole value. A `submittedAt` written
   * on every attempt would say a pupil handed their homework in when the request was refused,
   * timed out, or went nowhere because the laptop was on a train — and this is precisely the
   * field somebody would later read to decide whether they were late. An unsent submission
   * must look identical to one that was never attempted.
   *
   * ⚠️ It writes the platform's `state`, never a state this process inferred. The platform
   * answers `submitted` for a human-graded assignment and `graded` for a runner-graded one,
   * and which of those it is depends on a column only the platform has read.
   */
  recordSubmission(
    id: string,
    accepted: { submittedAt: string; state: 'in_progress' | 'submitted' | 'graded' }
  ): LearningEntry | undefined {
    return this.update(id, (entry) =>
      entry.assignment
        ? {
            ...entry,
            assignment: {
              ...entry.assignment,
              submittedAt: accepted.submittedAt,
              state: accepted.state
            }
          }
        : entry
    );
  }

  private update(id: string, change: (entry: LearningEntry) => LearningEntry): LearningEntry | undefined {
    const entries = this.read();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return undefined;

    const next = change(entries[index]);
    entries[index] = next;
    this.write(entries);
    return next;
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * A project source as an evaluation context, or `undefined` if it is not there
 * or will not reconstruct.
 *
 * 🔴 **The catch is the point, not defensive padding.** `buildLessonEvalContext`
 * runs the editor's own `reconstructLegacyComponent` over files that, on this
 * route, were written by a model — so a bundle with a plausible-looking but
 * malformed `nodes.json` can throw here. A throw would come out of
 * {@link LearningFolderModel.install} as an exception rather than as a refusal,
 * and this model's standing rule is that a malformed bundle is an outcome. The
 * class that could not be built then reports `not-checked`, which for a
 * `local-ai` bundle refuses the install anyway — the safe direction, arrived at
 * without pretending we know what was wrong with the file.
 *
 * 🔴 **`catalog` is passed, never defaulted (CN-003 slice 4).**
 * `buildLessonEvalContext` falls back to `loadDefaultCatalog()`, which carries
 * the *open project's* kit types — so between slices 3 and 4 a bundle installed
 * while a kit project was open had its nodes' ports answered by that project.
 * Measured, not theorised. The answer must not depend on what is on screen.
 */
function contextFor(source: LessonProjectSource | undefined, catalog: CatalogIndex): LessonEvalContext | undefined {
  if (!source) return undefined;
  try {
    return buildLessonEvalContext(source, { catalog });
  } catch {
    return undefined;
  }
}

// ─── The real ports ─────────────────────────────────────────────────────────

/**
 * Built with `require` inside the function, not module-scope `import`, for the
 * reason recorded across this task: `electron-store` and `@noodl/platform` are
 * renderer/Electron-bound, and this module has to import cleanly in a plain-Node
 * runner. Same trick, same reason, as `lessonevalconditions.liveLessonEvalContext`.
 */
export function defaultDeps(): LearningFolderDeps {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const Store = require('electron-store');
  const { platform } = require('@noodl/platform');
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const store = new Store({ name: 'learning_folder' });
  const root = nodePath.join(platform.getUserDataPath(), 'Learning');

  const fs: LearningFolderFs = {
    exists: (p) => nodeFs.existsSync(p),
    makeDirectory: (p) => nodeFs.mkdirSync(p, { recursive: true }),
    removeDirectoryRecursive: (p) => nodeFs.rmSync(p, { recursive: true, force: true }),
    copyRecursive: (from, to) => nodeFs.cpSync(from, to, { recursive: true }),
    readJsonFile: (p) => {
      try {
        return JSON.parse(nodeFs.readFileSync(p, 'utf8'));
      } catch {
        return undefined;
      }
    },
    join: (...parts) => nodePath.join(...parts)
  };

  return {
    store: { get: (key) => store.get(key), set: (key, value) => store.set(key, value) },
    fs,
    root,
    now: () => new Date().toISOString()
  };
}
