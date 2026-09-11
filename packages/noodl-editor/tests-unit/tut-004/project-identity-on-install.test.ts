/**
 * TUT-004 — an installed lesson is a project of its own, not a second copy of
 * the author's.
 *
 * 🔴 **WHAT THIS FILE IS ABOUT, AND IT IS NOT A TIDINESS RULE.** A bundle is a
 * template. Every stage of the authoring route copies `nodegx.project.json`
 * verbatim — `create_project` stamps an `id`, `derive_starter` copies it,
 * `create_lesson` copies it again, and `LearningFolderModel.install` copies the
 * whole directory — so before this change the bundle root, the author's project
 * and every learner's installed copy answered to one id. Measured on TUT-003's
 * first bundle: all of them claimed `620eff71-718e-4be7-a39b-462eafcdeb23`.
 *
 * `findReusableBackend` matches a backend on **name plus ownership**, and
 * ownership is *"this project's id is in the backend's `projectIds`"*. Two
 * projects with one id is README §1B's two-apps-one-datastore defect **with the
 * ownership check intact and useless**: the check answers true, honestly, for
 * the wrong project. That check exists because matching on name alone once made
 * every AI-created project on a machine bind to the first backend ever
 * provisioned on it.
 *
 * ⚠️ **INSTALL AND RESET ARE OPPOSITE HERE, AND THE ASYMMETRY IS THE POINT.**
 * Install makes a project that did not exist a moment ago, so it mints. Reset
 * replaces the *files* of a project that already has a backend bound to its id,
 * so it **keeps**. Minting on reset would orphan that backend and provision a
 * second one on every press — the same defect, arriving through the repair
 * button. The final test in this file is that control, and it fails if someone
 * "simplifies" the two paths into one.
 */

import { LearningFolderModel } from '../../src/editor/src/models/learningfolder';
import type {
  LearningFolderFs,
  LearningFolderStore
} from '../../src/editor/src/models/learningfolder';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';

// ─── Fakes ──────────────────────────────────────────────────────────────────

class FakeStore implements LearningFolderStore {
  private data: Record<string, unknown> = {};
  get(key: string): unknown {
    return this.data[key];
  }
  set(key: string, value: unknown): void {
    this.data[key] = JSON.parse(JSON.stringify(value));
  }
}

class FakeFs implements LearningFolderFs {
  files = new Map<string, string>();
  dirs = new Set<string>();
  /** Set to a message to make every write throw — the "disk said no" path. */
  failWrites: string | undefined;

  writeFile(path: string, contents: string): void {
    this.files.set(path, contents);
    this.dirs.add(path.slice(0, path.lastIndexOf('/')));
  }
  exists(path: string): boolean {
    return this.dirs.has(path) || this.files.has(path);
  }
  makeDirectory(path: string): void {
    if (this.failWrites) throw new Error(this.failWrites);
    this.dirs.add(path);
  }
  removeDirectoryRecursive(path: string): void {
    if (this.failWrites) throw new Error(this.failWrites);
    for (const p of [...this.files.keys()]) if (p === path || p.startsWith(path + '/')) this.files.delete(p);
    for (const d of [...this.dirs]) if (d === path || d.startsWith(path + '/')) this.dirs.delete(d);
  }
  copyRecursive(from: string, to: string): void {
    if (this.failWrites) throw new Error(this.failWrites);
    this.dirs.add(to);
    for (const [p, contents] of [...this.files]) {
      if (!p.startsWith(from + '/')) continue;
      this.writeFile(to + p.slice(from.length), contents);
    }
  }
  readJsonFile(path: string): unknown {
    const raw = this.files.get(path);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  writeJsonFile(path: string, data: unknown): void {
    if (this.failWrites) throw new Error(this.failWrites);
    this.writeFile(path, JSON.stringify(data, null, 2));
  }
  join(...parts: string[]): string {
    return parts.join('/');
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** The author's project id, as TUT-003's bundle carried it end to end. */
const AUTHORS_ID = '620eff71-718e-4be7-a39b-462eafcdeb23';

function goodManifest(title = 'Log a thing'): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title,
    description: 'The first lesson.',
    steps: [
      { kind: 'popup', body: 'Welcome.' },
      { title: 'Add a Group', completeWhen: [{ node: 'App:%Group', exists: true }] }
    ]
  };
}

let clock = 0;
function makeModel(fs = new FakeFs()) {
  clock = 0;
  let mintCount = 0;
  const model = new LearningFolderModel({
    store: new FakeStore(),
    fs,
    root: '/data/Learning',
    now: () => `2026-08-20T00:00:${String(clock++).padStart(2, '0')}.000Z`,
    newProjectId: () => `minted-${++mintCount}`
  });
  return { model, fs };
}

/**
 * A bundle shaped like the real one: a v2 project file at the root and a
 * `solution/` beside it, both carrying the author's id.
 */
function stageBundle(fs: FakeFs, dir: string, opts: { id?: string | null } = {}) {
  const id = opts.id === undefined ? AUTHORS_ID : opts.id;
  fs.writeFile(`${dir}/lesson.json`, JSON.stringify(goodManifest()));
  fs.writeFile(`${dir}/project.json`, '{"components":[]}');
  fs.writeFile(
    `${dir}/nodegx.project.json`,
    JSON.stringify({ name: 'Log a thing', ...(id === null ? {} : { id }), version: '2' })
  );
  fs.writeFile(`${dir}/solution/nodegx.project.json`, JSON.stringify({ name: 'Log a thing', id: AUTHORS_ID }));
  return dir;
}

function projectIdAt(fs: FakeFs, dir: string): unknown {
  return (fs.readJsonFile(`${dir}/nodegx.project.json`) as { id?: unknown } | undefined)?.id;
}

const INSTALLED = '/data/Learning/log-a-thing';

// ─── Install mints ──────────────────────────────────────────────────────────

describe('an installed lesson gets a project identity of its own', () => {
  it('🔴 does not answer to the id the bundle shipped', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing');

    const outcome = await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated' });

    expect(outcome.result).toBe('installed');
    expect(projectIdAt(fs, INSTALLED)).toBe('minted-1');
    expect(projectIdAt(fs, INSTALLED)).not.toBe(AUTHORS_ID);
    // The bundle itself is untouched: install reads a template, it does not edit one.
    expect(projectIdAt(fs, '/bundles/log-a-thing')).toBe(AUTHORS_ID);
  });

  it('🔴 gives two learners of the SAME bundle two different ids', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing');

    await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated', id: 'learner-a' });
    await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated', id: 'learner-b' });

    const a = projectIdAt(fs, '/data/Learning/learner-a');
    const b = projectIdAt(fs, '/data/Learning/learner-b');
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('mints one even when the bundle carries no id at all — the pre-DSG-007 state', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing', { id: null });

    await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated' });

    expect(projectIdAt(fs, INSTALLED)).toBe('minted-1');
  });

  it('keeps every other field of the project file, and writes only `id`', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing');

    await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated' });

    expect(fs.readJsonFile(`${INSTALLED}/nodegx.project.json`)).toEqual({
      name: 'Log a thing',
      id: 'minted-1',
      version: '2'
    });
  });

  it('⚠️ leaves `solution/` alone — nothing opens it as a project, so no matcher reads its id', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing');

    await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated' });

    // ✅ Paired with a known-firing signal **in this same call**. On its own this
    // assertion reads identically whether `solution/` was skipped deliberately or
    // the whole mechanism is switched off — and those want opposite fixes.
    expect(projectIdAt(fs, INSTALLED)).toBe('minted-1');
    expect(projectIdAt(fs, `${INSTALLED}/solution`)).toBe(AUTHORS_ID);
  });

  it('installs a bundle with no readable project file rather than repairing one', async () => {
    const { model, fs } = makeModel();
    fs.writeFile('/bundles/bare/lesson.json', JSON.stringify(goodManifest()));
    fs.writeFile('/bundles/bare/project.json', '{"components":[]}');
    fs.writeFile('/bundles/bare/nodegx.project.json', '{ not json');

    const outcome = await model.install({ bundleDir: '/bundles/bare', provenance: 'curated' });

    // No identity to collide with, so there is nothing here to fix. A minted id
    // written into a file this module could not parse is a second defect hiding
    // the first.
    expect(outcome.result).toBe('installed');
    expect(fs.files.get(`${INSTALLED}/nodegx.project.json`)).toBe('{ not json');

    // ✅ Same pairing: a bundle this model CAN read is re-identified in the same
    // test, so "left alone" is a decision and not a dead mechanism.
    stageBundle(fs, '/bundles/readable');
    await model.install({ bundleDir: '/bundles/readable', provenance: 'curated', id: 'readable' });
    // `minted-2`, not `minted-1`: install mints before it attempts the write, so
    // the unreadable bundle above still drew a value it then had nowhere to put.
    // Harmless — the generator is pure — but it is why this is the second number.
    expect(projectIdAt(fs, '/data/Learning/readable')).toBe('minted-2');
  });

  it('🔴 refuses the install when the identity cannot be written, rather than installing a colliding copy', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing');
    const failing = new FailAfterCopy(fs);
    const { model: guarded } = makeModel(failing as unknown as FakeFs);

    const outcome = await guarded.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated' });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    expect(outcome.reason).toContain('could not be written to disk');
  });
});

/** A disk that takes the copy and then refuses the one write that matters. */
class FailAfterCopy extends FakeFs {
  constructor(seed: FakeFs) {
    super();
    this.files = seed.files;
    this.dirs = seed.dirs;
  }
  writeJsonFile(): void {
    throw new Error('read-only volume');
  }
}

// ─── Reset keeps ────────────────────────────────────────────────────────────

describe('reset repairs the files and keeps the identity', () => {
  it('🔴 does NOT mint a new id — a new id on every reset orphans the backend it was bound to', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing');
    await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated' });
    const afterInstall = projectIdAt(fs, INSTALLED);

    const outcome = model.reset('log-a-thing');

    expect(outcome.result).toBe('reset');
    expect(projectIdAt(fs, INSTALLED)).toBe(afterInstall);
    // And emphatically not the bundle's, which the re-copy would otherwise restore.
    expect(projectIdAt(fs, INSTALLED)).not.toBe(AUTHORS_ID);
  });

  it('mints one if the installed copy somehow had none — a reset must not leave a project unable to own anything', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/log-a-thing');
    await model.install({ bundleDir: '/bundles/log-a-thing', provenance: 'curated' });
    // Whatever removed it — a hand edit, a half-written file — reset is the repair.
    fs.writeFile(`${INSTALLED}/nodegx.project.json`, JSON.stringify({ name: 'Log a thing' }));

    model.reset('log-a-thing');

    expect(projectIdAt(fs, INSTALLED)).toBe('minted-2');
  });
});
