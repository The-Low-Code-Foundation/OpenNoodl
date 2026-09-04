/**
 * REL-012 AC2–AC4 — **the register is the thing the Learning tab reads, and nothing wrote to it.**
 *
 * 🔴 Packaging is the half that looks like the whole fix. `project-examples/lessons` reaching the
 * artefact changes nothing on screen: the Learning tab draws `LearningFolderModel.list()`, a
 * per-user install register in electron-store, and its only writers were the launcher's folder
 * picker and the community installer. A session that stopped at AC1 would report success against a
 * still-empty tab. These specs are about the writer that was missing.
 *
 * ⚠️ **AC2 is graded against the bundles that actually ship, through the model that actually
 * runs** — real `node:fs`, a real temporary Learning folder, the real `LearningFolderModel` — for
 * `tests-unit/tut-004/the-real-bundle-installs.test.ts`'s reason: a fixture is written by the
 * person writing the test, so it passes the gates that person was thinking about. Both shipped
 * manifests declare `authoredBy: "ai"`, so both install as **`local-ai`** and are held to F1+F2+F3
 * whatever provenance the seed passes. `npm run lessons:check` does **not** run F2/F3 — it runs the
 * manifest check and the semantic validator — so this file is the only place that says whether a
 * shipped bundle can actually be installed. A red here is a finding about the bundle.
 *
 * AC3 and AC4 are about the seed's *decisions*, so they are driven over a fixture root with a
 * counting register: what is being graded is which bundles are handed to `install` and which are
 * not, and a real install would only make that slower and less legible.
 */
import * as nodeCrypto from 'node:crypto';
import * as nodeFs from 'node:fs';
import * as nodeOs from 'node:os';
import * as nodePath from 'node:path';

import { LearningFolderModel, slugifyLessonId } from '../../src/editor/src/models/learningfolder';
import type { LearningFolderFs } from '../../src/editor/src/models/learningfolder';
import {
  SEED_LEDGER_KEY,
  SHIPPED_LESSONS_REPO_PATH,
  isShippedLessonId,
  seedShippedLessons,
  shippedLessonId
} from '../../src/editor/src/models/lessonseed';
import type { SeedDeps, SeedFs, SeedLedgerRecord, SeedRegister } from '../../src/editor/src/models/lessonseed';

const LESSONS_DIR = nodePath.resolve(__dirname, '../../../..', ...SHIPPED_LESSONS_REPO_PATH.split('/'));
/** The one bundle already proven to travel the install path end to end (TUT-004). */
const PROVEN_BUNDLE = 'log-a-thing';

/** Real disk, for the same reason TUT-004 uses one: a fake filesystem is a hypothesis. */
function realSeedFs(): SeedFs {
  return {
    exists: (p) => nodeFs.existsSync(p),
    listDirectories: (p) => {
      try {
        return nodeFs
          .readdirSync(p, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
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
}

function realLearningFs(): LearningFolderFs {
  return {
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
    writeJsonFile: (p, d) => nodeFs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8'),
    join: (...parts) => nodePath.join(...parts)
  };
}

/** The store both the register and the ledger live in — one file, two keys, as in the real app. */
function memoryStore() {
  const map = new Map<string, unknown>();
  return {
    map,
    port: { get: (k: string) => map.get(k), set: (k: string, v: unknown) => map.set(k, v) }
  };
}

// ────────────────────────────────────────────────────────────────────────────

describe('the shipped bundles this file is about', () => {
  it('🔴 are on disk, and both declare the claim that makes them local-ai', () => {
    // Non-vacuity. Every AC2 arm below counts entries; a seed over an empty directory installs
    // nothing and would read as a passing "no failures".
    const bundles = nodeFs
      .readdirSync(LESSONS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(bundles).toContain(PROVEN_BUNDLE);
    expect(bundles.length).toBeGreaterThanOrEqual(2);
    for (const bundle of bundles) {
      const manifest = JSON.parse(
        nodeFs.readFileSync(nodePath.join(LESSONS_DIR, bundle, 'lesson.json'), 'utf8')
      ) as { title?: string; authoredBy?: string };
      expect(typeof manifest.title).toBe('string');
      expect(manifest.authoredBy).toBe('ai');
    }
  });
});

describe('AC2 — a machine that never installed a lesson opens a non-empty shelf', () => {
  let root: string;
  let store: ReturnType<typeof memoryStore>;
  let register: LearningFolderModel;
  let deps: SeedDeps;

  beforeEach(() => {
    root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'rel012-seed-'));
    const learningRoot = nodePath.join(root, 'Learning');
    nodeFs.mkdirSync(learningRoot, { recursive: true });

    store = memoryStore();
    register = new LearningFolderModel({
      store: store.port,
      fs: realLearningFs(),
      root: learningRoot,
      now: () => new Date().toISOString(),
      newProjectId: () => nodeCrypto.randomUUID()
    });

    deps = {
      register: register as SeedRegister,
      store: store.port,
      fs: realSeedFs(),
      root: LESSONS_DIR,
      probed: [LESSONS_DIR],
      now: () => new Date().toISOString()
    };
  });

  afterEach(() => {
    nodeFs.rmSync(root, { recursive: true, force: true });
  });

  it('🔴 seeds the proven bundle, so the tab is not empty', async () => {
    // The register starts as a fresh profile does: no `lessons` key at all.
    expect(store.map.get('lessons')).toBeUndefined();
    expect(register.list()).toHaveLength(0);

    const report = await seedShippedLessons(deps);

    // Reported as the reason rather than as `false`, so a red says what the gate refused.
    expect(report.failed.filter((f) => f.dirName === PROVEN_BUNDLE).map((f) => f.reason)).toEqual([]);
    const entries = register.list();
    expect(entries.length).toBeGreaterThan(0);

    const proven = register.get(shippedLessonId(PROVEN_BUNDLE));
    expect(proven).toBeDefined();
    // 🔴 The consequence, not the mechanism: the launcher renders `missing` and would draw a
    // broken card for an entry whose files never landed.
    expect(proven?.missing).toBe(false);
    expect(nodeFs.existsSync(nodePath.join(proven!.projectDirectory, 'lesson.json'))).toBe(true);
    // Installed copies get an identity of their own — the bundle carries none.
    const project = JSON.parse(
      nodeFs.readFileSync(nodePath.join(proven!.projectDirectory, 'nodegx.project.json'), 'utf8')
    ) as { id?: string };
    expect(typeof project.id).toBe('string');
  }, 120_000);

  it('🔴 seeds EVERY shipped bundle — a red here is a finding about the bundle, not the seed', async () => {
    const bundles = realSeedFs().listDirectories(LESSONS_DIR);
    const report = await seedShippedLessons(deps);

    // `lessons:check` runs F1 and the semantic validator; the install gate also runs F2 and F3
    // against a `local-ai` manifest. This is the only assertion in the repository that says all
    // four shipped bundles clear the gate the product itself applies.
    expect(report.failed).toEqual([]);
    expect(report.installed.sort()).toEqual(bundles.map(shippedLessonId).sort());
  }, 120_000);

  it('🔴 the control: a root with no bundles in it installs nothing and says so', async () => {
    // A pass that would read the same whether the seed worked or not is the failure mode this
    // arm exists to exclude — the AC2 arms above must be able to read zero.
    const empty = nodePath.join(root, 'empty');
    nodeFs.mkdirSync(empty);

    const report = await seedShippedLessons({ ...deps, root: empty });
    expect(report.installed).toEqual([]);
    expect(register.list()).toHaveLength(0);
  });

  it('says nothing happened when there is no shipped-lessons root at all', async () => {
    const report = await seedShippedLessons({ ...deps, root: null, probed: ['/nowhere/lessons'] });
    expect(report.installed).toEqual([]);
    expect(report.probed).toEqual(['/nowhere/lessons']);
    expect(register.list()).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────

/** Records what it was asked to install. The seed's decisions are what AC3 and AC4 are about. */
class CountingRegister implements SeedRegister {
  readonly asked: string[] = [];
  readonly entries = new Map<string, { id: string }>();
  /** Ids this register will refuse, to grade the not-ledgered-on-refusal rule. */
  refuse = new Set<string>();

  get(id: string) {
    return this.entries.get(id);
  }

  async install(options: { bundleDir: string; provenance: string; id?: string }) {
    const id = options.id as string;
    this.asked.push(id);
    if (this.refuse.has(id)) return { result: 'rejected' as const, reason: 'refused by the gate' };
    this.entries.set(id, { id });
    return { result: 'installed' as const };
  }
}

describe('AC3 — idempotent, and it never touches what the user has', () => {
  let root: string;
  let store: ReturnType<typeof memoryStore>;
  let register: CountingRegister;
  let deps: SeedDeps;

  /** Two bundle directories with the manifest field the seed reads and nothing else. */
  beforeEach(() => {
    root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'rel012-ac3-'));
    for (const [dir, title] of [
      ['log-a-thing', 'Log a thing'],
      ['it-breaks-on-a-phone', 'It breaks on a phone']
    ]) {
      nodeFs.mkdirSync(nodePath.join(root, dir), { recursive: true });
      nodeFs.writeFileSync(nodePath.join(root, dir, 'lesson.json'), JSON.stringify({ title }), 'utf8');
    }

    store = memoryStore();
    register = new CountingRegister();
    deps = {
      register,
      store: store.port,
      fs: realSeedFs(),
      root,
      now: () => '2026-09-04T00:00:00.000Z'
    };
  });

  afterEach(() => {
    nodeFs.rmSync(root, { recursive: true, force: true });
  });

  const ledger = () => (store.map.get(SEED_LEDGER_KEY) as SeedLedgerRecord[]) ?? [];

  it('installs each bundle exactly once across launches', async () => {
    await seedShippedLessons(deps);
    expect(register.asked).toEqual(['it-breaks-on-a-phone', 'log-a-thing'].map(shippedLessonId));

    const second = await seedShippedLessons(deps);
    // The second launch asks for nothing at all.
    expect(register.asked).toHaveLength(2);
    expect(second.installed).toEqual([]);
    expect(second.skipped.map((s) => s.why)).toEqual(['already-seeded', 'already-seeded']);
  });

  it('🔴 does NOT put back a lesson the learner removed', async () => {
    await seedShippedLessons(deps);
    const removed = shippedLessonId('log-a-thing');
    expect(register.entries.has(removed)).toBe(true);

    // The learner takes it off the shelf.
    register.entries.delete(removed);

    await seedShippedLessons(deps);
    // 🔴 The whole reason the ledger exists. An "is it present?" seed would reinstall here, on
    // every launch, forever, with no way for the product to be told no.
    expect(register.entries.has(removed)).toBe(false);
    expect(register.asked).toHaveLength(2);
  });

  it('🔴 stands down beside a lesson the user installed themselves, and never overwrites it', async () => {
    // Exactly what the folder picker produces: the id `slugifyLessonId(title)` gives.
    const theirs = slugifyLessonId('Log a thing');
    expect(theirs).toBe('log-a-thing');
    register.entries.set(theirs, { id: theirs });

    const report = await seedShippedLessons(deps);

    // Never handed to `install` — which deletes the target directory before copying over it.
    expect(register.asked).not.toContain(shippedLessonId('log-a-thing'));
    expect(report.skipped).toContainEqual({ dirName: 'log-a-thing', why: 'already-installed', note: theirs });
    // Their entry is still theirs, and untouched.
    expect(register.entries.get(theirs)).toEqual({ id: theirs });
    // The other bundle still seeds — standing down is per bundle, not a global stop.
    expect(register.asked).toEqual([shippedLessonId('it-breaks-on-a-phone')]);

    // And the stand-down is remembered, so deleting their copy later does not summon ours.
    expect(ledger().find((r) => r.dirName === 'log-a-thing')?.outcome).toBe('stood-down');
    register.entries.delete(theirs);
    await seedShippedLessons(deps);
    expect(register.asked).toHaveLength(1);
  });

  it('🔴 retries a bundle the gate refused, because the next build is meant to fix it', async () => {
    register.refuse.add(shippedLessonId('log-a-thing'));
    const first = await seedShippedLessons(deps);
    expect(first.failed.map((f) => f.dirName)).toEqual(['log-a-thing']);
    expect(ledger().map((r) => r.dirName)).toEqual(['it-breaks-on-a-phone']);

    register.refuse.clear();
    const second = await seedShippedLessons(deps);
    expect(second.installed).toEqual([shippedLessonId('log-a-thing')]);
  });

  it('skips a directory with no readable manifest, and does not ledger it either', async () => {
    nodeFs.mkdirSync(nodePath.join(root, 'not-a-bundle'));
    const report = await seedShippedLessons(deps);

    expect(report.skipped).toContainEqual({ dirName: 'not-a-bundle', why: 'not-a-bundle' });
    expect(ledger().map((r) => r.dirName)).not.toContain('not-a-bundle');
  });

  it('seeds a bundle a later release adds, without disturbing the ones already there', async () => {
    await seedShippedLessons(deps);
    nodeFs.mkdirSync(nodePath.join(root, 'a-new-lesson'));
    nodeFs.writeFileSync(
      nodePath.join(root, 'a-new-lesson', 'lesson.json'),
      JSON.stringify({ title: 'A new lesson' }),
      'utf8'
    );

    const report = await seedShippedLessons(deps);
    expect(report.installed).toEqual([shippedLessonId('a-new-lesson')]);
    expect(register.asked).toHaveLength(3);
  });

  it('survives a ledger that is missing, empty or rubbish', async () => {
    store.map.set(SEED_LEDGER_KEY, 'not an array');
    await seedShippedLessons(deps);
    expect(register.asked).toHaveLength(2);
    expect(ledger()).toHaveLength(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('AC4 — a community install and a shipped one cannot collide on id', () => {
  it('🔴 no title can ever slug into the shipped namespace', () => {
    // Every other install path — the folder picker and `installTutorialFromPlatform` — derives its
    // id with `slugifyLessonId` and passes no explicit id. `slugifyLessonId` replaces every run of
    // non-alphanumerics with `-`, so it cannot emit an underscore. That is the mechanism, and this
    // is the assertion that would fail if someone "tidied" it.
    const titles = [
      'shipped_log-a-thing',
      'Shipped log a thing',
      'shipped log-a-thing',
      'SHIPPED_LOG_A_THING',
      '  shipped_  ',
      'shipped__log',
      'Log a thing'
    ];
    for (const title of titles) {
      const id = slugifyLessonId(title);
      expect(id).not.toContain('_');
      expect(isShippedLessonId(id)).toBe(false);
    }
    expect(isShippedLessonId(shippedLessonId('log-a-thing'))).toBe(true);
  });

  it('🔴 the collision is real — same id, and install replaces the entry outright', async () => {
    // The mutant arm. Without the namespace, a community tutorial called "Log a thing" and the
    // shipped bundle land on the same id, and `install` removes the target directory before
    // copying. This proves the prefix is load-bearing rather than decorative.
    const root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'rel012-ac4-'));
    try {
      const learningRoot = nodePath.join(root, 'Learning');
      nodeFs.mkdirSync(learningRoot, { recursive: true });
      const store = memoryStore();
      const register = new LearningFolderModel({
        store: store.port,
        fs: realLearningFs(),
        root: learningRoot,
        now: () => new Date().toISOString(),
        newProjectId: () => nodeCrypto.randomUUID()
      });
      const bundleDir = nodePath.join(LESSONS_DIR, PROVEN_BUNDLE);
      const ordinary = slugifyLessonId('Log a thing');

      // Arm 1 — the collision, with the namespace taken away.
      const a = await register.install({ bundleDir, provenance: 'curated', id: ordinary });
      const b = await register.install({ bundleDir, provenance: 'curated', id: ordinary });
      expect(a.result).toBe('installed');
      expect(b.result).toBe('installed');
      expect(register.list()).toHaveLength(1);

      // Arm 2 — the namespace in place. Two entries, two directories, both still on disk.
      const shipped = await register.install({
        bundleDir,
        provenance: 'curated',
        id: shippedLessonId(PROVEN_BUNDLE)
      });
      expect(shipped.result).toBe('installed');
      const entries = register.list();
      expect(entries).toHaveLength(2);
      expect(new Set(entries.map((e) => e.projectDirectory)).size).toBe(2);
      for (const entry of entries) {
        expect(entry.missing).toBe(false);
        expect(nodeFs.existsSync(nodePath.join(entry.projectDirectory, 'lesson.json'))).toBe(true);
      }
    } finally {
      nodeFs.rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
