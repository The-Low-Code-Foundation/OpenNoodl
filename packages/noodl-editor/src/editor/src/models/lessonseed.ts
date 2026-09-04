/**
 * REL-012 — the shipped lessons, and the register that is the only thing the Learning tab reads.
 *
 * ## 🔴 THE HALF THAT LOOKS LIKE THE WHOLE FIX
 *
 * `project-examples/lessons/` was in **neither** `files` nor `extraResources`, so both committed
 * bundles shipped in no artefact a user receives. Adding them to the packaging config makes the
 * files present and changes **nothing on screen**: `LearningFolderModel` is a per-user *install
 * register* in electron-store under the key `lessons`, its only writers were the launcher's folder
 * picker (`local`) and `lessonplatforminstall` (`curated`), and a fresh profile therefore opens the
 * Learning tab to an empty shelf no matter what is on disk. Packaging is AC1; this module is AC2,
 * and without it AC1 is a green gate over a still-empty tab.
 *
 * ## ⚠️ WHY `extraResources` AND NOT `files`, WHICH IS WHAT `STARTER_ASSETS` DOES
 *
 * `starterAssets.ts` solves the same-shaped problem the other way: its files live under
 * `packages/noodl-editor/src/assets/`, which is already inside electron-builder's `files`
 * allow-list, and it resolves them against `platform.getAppPath()` — i.e. **inside the asar**.
 * That works there for two reasons that do not hold here:
 *
 *   1. **It copies one file at a time**, with `filesystem.copyFile` → `fs.copyFileSync`, which is
 *      one of the functions Electron's asar shim patches. `LearningFolderModel.install` copies a
 *      *directory* — `fs.cpSync(from, to, { recursive: true })` — and `cp`/`cpSync` are **not** in
 *      the patched surface. A lesson root inside `app.asar` would therefore exist to
 *      `existsSync`, pass `preflight` (which reads files individually), and then fail at the copy.
 *      That is a failure mode that is invisible in dev and total when packaged, which is the exact
 *      class of defect this row exists to close, so this module does not depend on the answer.
 *   2. **The bundle path is kept**: `install` records `source: {kind:'local', path: bundleDir}`,
 *      and `canReset` answers `available` only while that path still exists. Real files under
 *      `Resources/` make *Start again* work on a shipped lesson; a path inside the asar would make
 *      `canReset` say yes and `repairFrom` fail.
 *
 * So the resolution answer reused here is the *other* one this repo already has —
 * `main/src/mcp/resolveMcpServer.js` and `ServiceSupervisor.resolveServiceEntry`: a candidate list
 * ending at `process.resourcesPath`, returning the paths it probed, because when it misses **the
 * list of paths tried is the bug report**. It is not a third answer; it is that one, for the same
 * reason (`extraResources`) and in the same shape.
 *
 * ## 🔴 AC3 — A LEDGER OF WHAT WAS SEEDED, NEVER "IS IT PRESENT"
 *
 * The obvious seed is *"if the register has no entry for this lesson, install it"*. That is wrong
 * in the one direction that matters: a learner who **removes** a shipped lesson gets it back on
 * every launch, forever, and the product has no way to be told no. So the seed keeps its own
 * record — {@link SEED_LEDGER_KEY}, beside the register in the same store — of every bundle it has
 * ever acted on, and consults *that*. The register is read only to decide whether to stand down;
 * it is never read to decide whether to install.
 *
 * The ledger also records a **stand-down**: a bundle whose id (or whose ordinary slugified id — the
 * id the folder picker and the community installer would give it) is already in the register is
 * recorded as handled and never revisited. That is what stops the seed appearing beside a copy the
 * user installed themselves, and it is why "never overwrites a `local` install" is structural here
 * rather than a rule someone has to remember.
 *
 * ⚠️ A **refusal** is deliberately *not* ledgered. A bundle the install gate rejects is a defect in
 * the shipped artefact, and the next build is meant to fix it — ledgering the refusal would mean
 * the fixed bundle never seeded. Refusals are reported and logged, and retried on the next launch.
 *
 * ## 🔴 AC4 — THE ID NAMESPACE IS STRUCTURAL, NOT A CONVENTION
 *
 * Every other install path derives its id with {@link slugifyLessonId}, which lowercases and
 * replaces every run of non-alphanumerics with `-`. It can therefore **never** emit an underscore.
 * A shipped lesson's id is `shipped_<directory>` ({@link shippedLessonId}), so a community
 * (`curated`) tutorial and a shipped bundle cannot collide on id whatever either is called — and
 * the collision that would otherwise happen is not cosmetic: `install` deletes the directory of an
 * existing id before copying over it.
 *
 * ## Loud, never silent
 *
 * `starterAssets`' rule applies unchanged: a shelf that is empty because the seed failed looks
 * exactly like a shelf that is empty by design. Every skip, every refusal and every probed path is
 * in the returned report, and {@link seedShippedLessonsOnStartup} logs a one-line summary.
 *
 * @module noodl-editor/models/lessonseed
 */

import { LearningFolderModel, slugifyLessonId } from './learningfolder';
import type { LessonProvenance } from './learningfolder';

// ─── The contract between the packaging config and this module ──────────────

/**
 * The directory name the bundles land in under `Resources/`, and the `to` of the `extraResources`
 * entry in `packages/noodl-editor/package.json`.
 *
 * 🔴 **These two are one fact and this constant is where it lives.** A rename on either side alone
 * ships an app whose lessons are present and unreachable — the defect this row opened for, one
 * layer along. `shippedLessonsPackaging` is the gate that reads the config and compares it to this.
 */
export const SHIPPED_LESSONS_DIRNAME = 'lessons';

/** Where the bundles are in a checkout, relative to the repository root. */
export const SHIPPED_LESSONS_REPO_PATH = 'project-examples/lessons';

/**
 * The id prefix that keeps a shipped lesson out of every other installer's namespace.
 *
 * 🔴 The underscore is the whole mechanism, not decoration — see the module note on AC4.
 */
export const SHIPPED_LESSON_ID_PREFIX = 'shipped_';

/**
 * 🔴 **The droppings that must not travel.** Measured on the corpus 2026-09-04, not theorised:
 * `project-examples/lessons/your-creature-on-screen/` and its `solution/` each carry an untracked,
 * gitignored `.mcp.json` written by *opening the project in the editor* — and each of them names an
 * absolute path on the machine that opened it, including a `/private/tmp/…` scratchpad and a
 * `~/Library/Application Support/NodeGX/PREFERENCES.md`. `extraResources` copies what is on disk;
 * git has no say in it. Without this filter, the very change that puts the lessons in the artefact
 * would put one developer's paths inside every learner's copy of the lesson.
 *
 * ⚠️ Both possible glob semantics give the safe answer here, which is why this is two lines rather
 * than a staging step: if electron-builder's matcher has `dot: true`, `**\/*` matches the file and
 * the negation removes it; if it does not, the file was never included. Nothing in a lesson bundle
 * needs to be a dotfile, so there is no arm where the leniency costs anything.
 *
 * `shippedLessonsPackaging` requires the config to carry **exactly** this list. It is not
 * evaluating globs — it is asserting that the one filter this module has reasoned about is the one
 * the build will apply.
 */
export const SHIPPED_LESSONS_FILTER: readonly string[] = ['**/*', '!**/.mcp.json', '!**/.DS_Store'];

/** The store key the seed ledger lives under, beside the register's own `lessons`. */
export const SEED_LEDGER_KEY = 'seededLessons';

/** What a shipped bundle directory is installed as. */
export function shippedLessonId(dirName: string): string {
  return `${SHIPPED_LESSON_ID_PREFIX}${dirName}`;
}

/** Whether an id was minted by this module. Used by nothing yet; asserted, so it cannot drift. */
export function isShippedLessonId(id: string): boolean {
  return typeof id === 'string' && id.startsWith(SHIPPED_LESSON_ID_PREFIX);
}

/**
 * Shipped lessons install as `curated`: they are editorial, and a person stands behind them.
 *
 * ⚠️ That is the *caller's* word and it may still be tightened. `log-a-thing`'s manifest declares
 * `authoredBy: "ai"`, so `resolveProvenance` moves it to `local-ai` and it is held to F1+F2+F3 —
 * the same asymmetry `tests-unit/tut-004/the-real-bundle-installs.test.ts` exercises against this
 * very bundle. Passing `curated` here does not buy a shipped bundle a cheaper gate.
 */
export const SHIPPED_PROVENANCE: LessonProvenance = 'curated';

// ─── Asking the packaging config what it will actually include ──────────────

export interface PackagingVerdict {
  ok: boolean;
  /** The `from` the config declares, when there is one. */
  from?: string;
  /** The `to` the config declares, when there is one. */
  to?: string;
  /** Why not, in terms of the config that was read. Present exactly when `ok` is false. */
  reason?: string;
}

/**
 * Does this `build` config put the lesson bundles where {@link resolveShippedLessonsRoot} looks?
 *
 * 🔴 **Trap 5.** `npm run lessons:check` walks `project-examples/lessons` in the repository, so it
 * is structurally incapable of seeing this defect: the bundles were perfect and shipped nowhere.
 * The gate that catches it is one that asks the *packaging configuration* what it will include,
 * which is what this function is, and which is why it takes the config as data rather than
 * reaching for the file — so a spec can drive it over the real `package.json` **and** over mutants
 * of it, and a green result is a measurement rather than a hope.
 *
 * ⚠️ It deliberately refuses an entry carrying a `filter`. electron-builder's glob semantics are
 * not re-implemented here, and a gate that guesses at them would report on a population it cannot
 * see — so the rule is: ship the directory whole, or teach this function the filter.
 */
export function shippedLessonsPackaging(build: unknown): PackagingVerdict {
  const extraResources = (build as { extraResources?: unknown } | undefined)?.extraResources;
  if (!Array.isArray(extraResources)) {
    return { ok: false, reason: 'build.extraResources is not an array — nothing lands outside the asar.' };
  }

  const entries = extraResources.filter(
    (entry): entry is { from?: unknown; to?: unknown; filter?: unknown } =>
      !!entry && typeof entry === 'object' && !Array.isArray(entry)
  );

  const named = entries.filter((entry) => normalisePath(entry.from).endsWith(SHIPPED_LESSONS_REPO_PATH));
  if (named.length === 0) {
    return {
      ok: false,
      reason: `no build.extraResources entry copies ${SHIPPED_LESSONS_REPO_PATH}, so the lesson bundles reach no artefact.`
    };
  }
  if (named.length > 1) {
    return {
      ok: false,
      reason: `${named.length} build.extraResources entries copy ${SHIPPED_LESSONS_REPO_PATH}; two producers of one directory is a collision, not redundancy.`
    };
  }

  const entry = named[0];
  const from = typeof entry.from === 'string' ? entry.from : undefined;
  const to = typeof entry.to === 'string' ? entry.to : undefined;

  if (to !== SHIPPED_LESSONS_DIRNAME) {
    return {
      ok: false,
      from,
      to,
      reason: `the entry lands at "${String(to)}" but the editor looks for "${SHIPPED_LESSONS_DIRNAME}" under Resources — present and unreachable.`
    };
  }
  // 🔴 Exactly the declared filter, in order. This gate does not evaluate electron-builder globs —
  // it asserts that the one filter this module has reasoned about is the one the build applies.
  // Anything else is unmeasured, and the thing it would fail to measure is a developer's absolute
  // paths riding into a learner's copy of the lesson. See SHIPPED_LESSONS_FILTER.
  const filter = entry.filter;
  const declared = SHIPPED_LESSONS_FILTER.join(' ');
  if (!Array.isArray(filter) || filter.join(' ') !== declared) {
    return {
      ok: false,
      from,
      to,
      reason: `the entry's filter is ${JSON.stringify(filter)} but this module reasons about ${JSON.stringify(
        SHIPPED_LESSONS_FILTER
      )}. A filter this gate has not read is a population it cannot see.`
    };
  }

  return { ok: true, from, to };
}

function normalisePath(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\\/g, '/').replace(/\/+$/, '') : '';
}

// ─── Where the bundles are, in a checkout and in a packaged app ─────────────

/** The path knowledge this module needs, injected so a spec can pose either layout. */
export interface ShippedLessonsPathPorts {
  exists(path: string): boolean;
  join(...parts: string[]): string;
  /** `path.resolve`, for walking out of the app directory to the repository root in dev. */
  resolve(...parts: string[]): string;
  /** `app.getAppPath()` — `packages/noodl-editor` in dev, `…/Resources/app.asar` when packaged. */
  appPath?: string;
  /** `process.resourcesPath` — absent outside Electron. */
  resourcesPath?: string;
  /** `NODEGX_SHIPPED_LESSONS`. Same escape-hatch contract as `NOODL_MCP_ENTRY`. */
  override?: string;
}

/**
 * Locate the shipped lesson bundles.
 *
 * The candidate order is `resolveMcpServer`'s, deliberately: override, then the dev layout, then
 * the two packaged ones. `probed` is returned for that module's reason — when this misses, the
 * list of paths tried is the whole bug report, and a `root: null` with an empty `probed` would be
 * indistinguishable from a resolver that never ran.
 *
 * ⚠️ `root: null` is a real state and not an error. A checkout that deleted `project-examples/`,
 * or a packaged app built before this row landed, has no bundles; the honest answer is to say so
 * and seed nothing, not to throw during startup.
 */
export function resolveShippedLessonsRoot(ports: ShippedLessonsPathPorts): {
  root: string | null;
  probed: string[];
} {
  const probed: string[] = [];
  const candidates: string[] = [];

  if (ports.override) candidates.push(ports.override);

  if (ports.appPath) {
    // dev: app.getAppPath() is packages/noodl-editor, and the bundles are two levels up.
    candidates.push(ports.resolve(ports.appPath, '..', '..', ...SHIPPED_LESSONS_REPO_PATH.split('/')));
    // packaged: app.getAppPath() is …/Resources/app.asar, so its parent is Resources.
    candidates.push(ports.resolve(ports.appPath, '..', SHIPPED_LESSONS_DIRNAME));
  }

  if (ports.resourcesPath) {
    candidates.push(ports.join(ports.resourcesPath, SHIPPED_LESSONS_DIRNAME));
  }

  for (const candidate of candidates) {
    probed.push(candidate);
    if (ports.exists(candidate)) return { root: candidate, probed };
  }

  return { root: null, probed };
}

// ─── The seed ───────────────────────────────────────────────────────────────

/** One row of the ledger: a bundle this module has acted on, and will not act on again. */
export interface SeedLedgerRecord {
  /** The directory under the shipped-lessons root. The identity the ledger is keyed by. */
  dirName: string;
  /** The id it was installed as, or would have been. */
  id: string;
  /** `installed` — we put it there. `stood-down` — something was already there and we left it. */
  outcome: 'installed' | 'stood-down';
  at: string;
  /** For a stand-down: the id that was already in the register. */
  note?: string;
}

/** The half of `LearningFolderModel` the seed uses. Narrow on purpose — it is also the seam. */
export interface SeedRegister {
  get(id: string): { id: string } | undefined;
  install(options: {
    bundleDir: string;
    provenance: LessonProvenance;
    id?: string;
  }): Promise<{ result: 'installed' | 'rejected'; reason?: string }>;
}

/** The ledger's store. The register's own store, under a different key. */
export interface SeedStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/** The filesystem the seed needs, and nothing more. */
export interface SeedFs {
  exists(path: string): boolean;
  /** Directory names directly under `path`. Never throws — an unreadable root is `[]`. */
  listDirectories(path: string): string[];
  /** Parsed JSON, or `undefined` when missing or unreadable. Never throws. */
  readJsonFile(path: string): unknown;
  join(...parts: string[]): string;
}

export interface SeedDeps {
  register: SeedRegister;
  store: SeedStore;
  fs: SeedFs;
  /** The resolved shipped-lessons root, or `null` when there is none. */
  root: string | null;
  /** What {@link resolveShippedLessonsRoot} tried, carried into the report. */
  probed?: string[];
  now: () => string;
}

export type SeedSkipReason =
  /** The ledger says this bundle has been handled. The learner may have removed it since. */
  | 'already-seeded'
  /** Something is already in the register under this id or the id the ordinary route would give. */
  | 'already-installed'
  /** No readable `lesson.json`. Not ledgered — the next build is meant to fix it. */
  | 'not-a-bundle';

export interface SeedReport {
  root: string | null;
  probed: string[];
  /** Ids installed by this run. */
  installed: string[];
  skipped: { dirName: string; why: SeedSkipReason; note?: string }[];
  /** Refused by the install gate, or unwritable. Retried on the next launch. */
  failed: { dirName: string; reason: string }[];
}

/**
 * Put the shipped bundles into the register, once each, ever.
 *
 * Never throws: startup calls this and a broken bundle must not stop the editor loading. Every
 * outcome is in the report.
 */
export async function seedShippedLessons(deps: SeedDeps): Promise<SeedReport> {
  const { register, store, fs, root } = deps;
  const report: SeedReport = {
    root,
    probed: deps.probed ?? [],
    installed: [],
    skipped: [],
    failed: []
  };

  if (!root) return report;

  const ledger = readLedger(store);
  const handled = new Set(ledger.map((record) => record.dirName));
  const added: SeedLedgerRecord[] = [];

  // Sorted so two machines with the same bundles install them in the same order, which is also
  // the order `list()` reverses into the shelf.
  for (const dirName of fs.listDirectories(root).slice().sort()) {
    if (handled.has(dirName)) {
      report.skipped.push({ dirName, why: 'already-seeded' });
      continue;
    }

    const bundleDir = fs.join(root, dirName);
    const manifest = fs.readJsonFile(fs.join(bundleDir, 'lesson.json'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      report.skipped.push({ dirName, why: 'not-a-bundle' });
      continue;
    }

    const id = shippedLessonId(dirName);
    // 🔴 The id the folder picker and the community installer would give this same lesson. Checked
    // so the seed stands beside a copy the user installed themselves rather than beside a
    // duplicate of it — see the module note on AC3.
    const ordinaryId = slugifyLessonId((manifest as { title?: string }).title);

    const collidesWith = existingId(register, [id, ordinaryId]);
    if (collidesWith) {
      report.skipped.push({ dirName, why: 'already-installed', note: collidesWith });
      added.push({ dirName, id, outcome: 'stood-down', at: deps.now(), note: collidesWith });
      continue;
    }

    let outcome: { result: 'installed' | 'rejected'; reason?: string };
    try {
      outcome = await register.install({ bundleDir, provenance: SHIPPED_PROVENANCE, id });
    } catch (e) {
      report.failed.push({ dirName, reason: e instanceof Error ? e.message : String(e) });
      continue;
    }

    if (outcome.result === 'installed') {
      report.installed.push(id);
      added.push({ dirName, id, outcome: 'installed', at: deps.now() });
    } else {
      // Not ledgered on purpose: a refused bundle is a defect in the artefact, and the build that
      // fixes it must be able to seed.
      report.failed.push({ dirName, reason: outcome.reason ?? 'the install gate refused this bundle.' });
    }
  }

  if (added.length > 0) store.set(SEED_LEDGER_KEY, [...ledger, ...added]);

  return report;
}

/** The first of `ids` the register already holds, or `undefined`. */
function existingId(register: SeedRegister, ids: string[]): string | undefined {
  for (const id of ids) {
    if (!id) continue;
    try {
      if (register.get(id)) return id;
    } catch {
      // A register we cannot read is a register we must not overwrite. Treat it as occupied.
      return id;
    }
  }
  return undefined;
}

function readLedger(store: SeedStore): SeedLedgerRecord[] {
  let raw: unknown;
  try {
    raw = store.get(SEED_LEDGER_KEY);
  } catch {
    raw = undefined;
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (record): record is SeedLedgerRecord =>
      !!record && typeof record === 'object' && typeof (record as SeedLedgerRecord).dirName === 'string'
  );
}

// ─── The real ports ─────────────────────────────────────────────────────────

/**
 * Built with `require` inside the function for the reason recorded across the lesson modules:
 * `electron-store`, `electron` and `@noodl/platform` are renderer-bound, and this module has to
 * import cleanly in a plain-Node runner.
 */
export function defaultSeedDeps(): SeedDeps {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const Store = require('electron-store');
  const { platform } = require('@noodl/platform');
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  /* eslint-enable @typescript-eslint/no-var-requires */

  // The register's own store, under a different key. One file, two facts: the lessons a person
  // has, and the shipped bundles this module has already acted on.
  const store = new Store({ name: 'learning_folder' });

  const fs: SeedFs = {
    exists: (p) => nodeFs.existsSync(p),
    listDirectories: (p) => {
      try {
        return nodeFs
          .readdirSync(p, { withFileTypes: true })
          .filter((entry: { isDirectory(): boolean }) => entry.isDirectory())
          .map((entry: { name: string }) => entry.name);
      } catch {
        return [];
      }
    },
    readJsonFile: (p) => {
      try {
        return JSON.parse(nodeFs.readFileSync(p, 'utf8'));
      } catch {
        return undefined;
      }
    },
    join: (...parts) => nodePath.join(...parts)
  };

  const { root, probed } = resolveShippedLessonsRoot({
    exists: fs.exists,
    join: (...parts) => nodePath.join(...parts),
    resolve: (...parts) => nodePath.resolve(...parts),
    // `getAppPath()` carries a trailing slash here (`platform-electron` adds one); `path.resolve`
    // is indifferent to it.
    appPath: platform.getAppPath(),
    resourcesPath: process.resourcesPath,
    override: process.env.NODEGX_SHIPPED_LESSONS
  });

  return {
    register: LearningFolderModel.instance as SeedRegister,
    store: { get: (key) => store.get(key), set: (key, value) => store.set(key, value) },
    fs,
    root,
    probed,
    now: () => new Date().toISOString()
  };
}

/**
 * The startup call. One line at the call site, and it never throws or rejects.
 *
 * ⚠️ Fire-and-forget on purpose. `ProjectsPage` already re-reads the register on
 * `learningFolderChanged`, which `install` emits — so the shelf fills itself when the seed lands
 * and nothing on the render path has to wait for a verification pass it usually skips entirely.
 * After the first run the ledger short-circuits every bundle before any file is read.
 */
export async function seedShippedLessonsOnStartup(): Promise<SeedReport | undefined> {
  try {
    const report = await seedShippedLessons(defaultSeedDeps());
    const trouble = report.failed.length > 0 || (report.root === null && report.probed.length > 0);
    if (trouble) {
      // eslint-disable-next-line no-console
      console.warn(
        `[lesson-seed] root=${report.root ?? 'NOT FOUND'} installed=${report.installed.length} ` +
          `failed=${report.failed.length}\n  probed: ${report.probed.join('\n  probed: ')}` +
          (report.failed.length ? `\n  ${report.failed.map((f) => `${f.dirName}: ${f.reason}`).join('\n  ')}` : '')
      );
    } else if (report.installed.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[lesson-seed] seeded ${report.installed.length} shipped lesson(s): ${report.installed.join(', ')}`);
    }
    return report;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[lesson-seed] could not run: ${e instanceof Error ? e.message : String(e)}`);
    return undefined;
  }
}
