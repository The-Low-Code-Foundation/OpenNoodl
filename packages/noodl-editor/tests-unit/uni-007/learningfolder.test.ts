/**
 * UNI-007 slice 3 — the Learning folder register.
 *
 * The spine of this file is D5, stated as behaviour rather than as prose:
 *
 *  - a lesson that cannot be completed never gets installed (the two-vocabulary
 *    check is the install gate, and the *shadowed* class is the one an
 *    existence check waves through);
 *  - there is no rename and no delete, structurally;
 *  - reset re-pulls a fresh copy, and 🔴 **checks the source before it deletes
 *    anything** — delete-then-fail would lose both the learner's work and the
 *    lesson, from the one button someone presses when already stuck;
 *  - the card's numbers come from the evidence bundle, so the card and UNI-002's
 *    points event read the same figures rather than two derivations of them.
 *
 * Everything runs against injected ports, so this reaches no Electron, no
 * electron-store and no real filesystem — the same constraint the rest of
 * UNI-007 carries, for the same reason (UNI-010 runs this arc with no renderer).
 */

import {
  isSafeLessonId,
  LearningFolderModel,
  slugifyLessonId
} from '../../src/editor/src/models/learningfolder';
import type {
  LearningFolderFs,
  LearningFolderStore
} from '../../src/editor/src/models/learningfolder';
import type { LessonEvidence } from '../../src/editor/src/models/lessongrading';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';

// ─── Fakes ──────────────────────────────────────────────────────────────────

class FakeStore implements LearningFolderStore {
  private data: Record<string, unknown> = {};
  get(key: string): unknown {
    return this.data[key];
  }
  set(key: string, value: unknown): void {
    // Round-tripped through JSON because the real store persists: a value that
    // would not survive the write must not survive here either.
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
    for (const [p, contents] of this.files) {
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

/**
 * A lesson that passes the check: real path grammar (`Component:%Type:…`, the
 * first segment being the component the node lives in) and live type names.
 */
function goodManifest(title = 'Make a Group'): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title,
    description: 'The first lesson.',
    steps: [
      { kind: 'popup', body: 'Welcome.' },
      { title: 'Add a Group', completeWhen: [{ node: 'App:%Group', exists: true }] },
      { title: 'Add some Text', completeWhen: [{ node: 'App:%Group:%Text', hasType: 'Text' }] }
    ]
  };
}

let clock = 0;
function makeModel(fs = new FakeFs()) {
  clock = 0;
  const store = new FakeStore();
  let mintCount = 0;
  const model = new LearningFolderModel({
    store,
    fs,
    root: '/data/Learning',
    // Monotonic and fake: `list()` sorts on it, so a real clock would make the
    // ordering assertions depend on how fast the machine is.
    now: () => `2026-08-15T00:00:${String(clock++).padStart(2, '0')}.000Z`,
    newProjectId: () => `minted-${++mintCount}`
  });
  return { model, fs, store };
}

/** Put a bundle on the fake disk: project files plus a manifest. */
function stageBundle(fs: FakeFs, dir: string, manifest: LessonManifest) {
  fs.writeFile(`${dir}/lesson.json`, JSON.stringify(manifest));
  fs.writeFile(`${dir}/project.json`, '{"components":[]}');
  fs.writeFile(`${dir}/media/cat.png`, 'PNG');
  return dir;
}

function evidence(over: Partial<LessonEvidence> = {}): LessonEvidence {
  return {
    stepsGraded: 2,
    stepsPassed: 2,
    completionPercent: 100,
    complete: true,
    stepOutcomes: [
      { index: 1, graded: true, passed: true },
      { index: 2, graded: true, passed: true }
    ],
    ...over
  };
}

// ─── Install: the verifier is the gate ──────────────────────────────────────

describe('installing a lesson bundle', () => {
  it('installs a verified bundle and copies its files into the Learning folder', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());

    const outcome = await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;

    expect(outcome.entry).toMatchObject({
      id: 'make-a-group',
      title: 'Make a Group',
      description: 'The first lesson.',
      provenance: 'curated',
      projectDirectory: '/data/Learning/make-a-group',
      source: { kind: 'local', path: '/bundles/groups' }
    });
    expect(outcome.verification.ok).toBe(true);

    // The files really landed, nested ones included.
    expect(fs.files.get('/data/Learning/make-a-group/project.json')).toBe('{"components":[]}');
    expect(fs.files.get('/data/Learning/make-a-group/media/cat.png')).toBe('PNG');
  });

  it('refuses a lesson whose condition uses the prose vocabulary', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/repeat', {
      title: 'Repeat yourself',
      steps: [{ title: 'Add a Repeater', completeWhen: [{ node: 'App:%Repeater', exists: true }] }]
    });

    const outcome = await model.install({ bundleDir: '/bundles/repeat', provenance: 'local-ai' });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    expect(outcome.verification?.ok).toBe(false);
    expect(outcome.verification?.findings.some((f) => f.code === 'display-name-used')).toBe(true);
    // Nothing was written — a refused lesson leaves no folder behind.
    expect(model.list()).toEqual([]);
    expect(fs.exists('/data/Learning/repeat-yourself')).toBe(false);
  });

  it('refuses a SHADOWED name, the class a "does this type exist?" gate waves through', async () => {
    // `Variable` IS a real catalog type, so `hasType()` returns true — but it is
    // the deprecated one, and the node a learner drags out of the picker under
    // that name is `Variable2`. It is also the curriculum's own L6 node
    // (CURRICULUM-DESIGN D3), so this is the case that would have shipped.
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/l6', {
      title: 'Lesson 6',
      steps: [{ title: 'Add a Variable', completeWhen: [{ node: 'App:%Variable', exists: true }] }]
    });

    const outcome = await model.install({ bundleDir: '/bundles/l6', provenance: 'curated' });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    const finding = outcome.verification?.findings.find((f) => f.code === 'shadowed-by-deprecated');
    expect(finding).toBeDefined();
    expect(finding?.suggestion).toBe('Variable2');
  });

  it('installs a lesson that only produces warnings — an ageing lesson is still completable', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/anim', {
      title: 'Animate it',
      // Deprecated, but nothing live carries it as a display name, so a learner
      // with an existing project can still satisfy the condition.
      steps: [{ title: 'Find the Animation', completeWhen: [{ node: 'App:%Animation', exists: true }] }]
    });

    const outcome = await model.install({ bundleDir: '/bundles/anim', provenance: 'org' });

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;
    expect(outcome.verification.ok).toBe(true);
    expect(outcome.verification.findings.some((f) => f.severity === 'warning')).toBe(true);
  });

  it('refuses a bundle with no readable lesson.json rather than throwing', async () => {
    const { model, fs } = makeModel();
    fs.writeFile('/bundles/empty/project.json', '{}');

    expect((await model.install({ bundleDir: '/bundles/empty', provenance: 'local-ai' })).result).toBe('rejected');
    expect((await model.install({ bundleDir: '/bundles/nowhere', provenance: 'local-ai' })).result).toBe('rejected');

    fs.writeFile('/bundles/broken/lesson.json', '{ not json');
    fs.writeFile('/bundles/broken/project.json', '{}');
    expect((await model.install({ bundleDir: '/bundles/broken', provenance: 'local-ai' })).result).toBe('rejected');
  });

  it('refuses an id that would escape the Learning folder', async () => {
    // UNI-010 lets an agent on the user's machine hand over a bundle, so the id
    // is a path-traversal boundary and not a tidiness rule.
    //
    // ⚠️ Installed as `curated` deliberately, and the reason is worth keeping:
    // these fixtures carry no `solution/`, so under `local-ai` slice 2's policy
    // refuses them *before* the id is looked at — and the test would keep passing
    // while proving nothing about path traversal. Same for the slug test below.
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/ok', goodManifest());

    for (const id of ['../../etc', 'a/b', 'a\\b', '', '.hidden', '..']) {
      const outcome = await model.install({ bundleDir: '/bundles/ok', provenance: 'curated', id });
      expect(outcome.result).toBe('rejected');
    }
    expect(fs.exists('/data/Learning/../../etc')).toBe(false);
  });

  it('refuses a lesson whose title slugifies to nothing, instead of installing at the root', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/unnamed', { title: '!!!', steps: [{ title: 'Do a thing' }] });

    expect((await model.install({ bundleDir: '/bundles/unnamed', provenance: 'curated' })).result).toBe('rejected');
  });

  it('replaces on reinstall and does NOT carry the old grade onto new files', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());
    await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });
    model.recordGrade('make-a-group', evidence());
    expect(model.get('make-a-group')?.grade?.complete).toBe(true);

    await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });

    expect(model.list()).toHaveLength(1);
    expect(model.get('make-a-group')?.grade).toBeUndefined();
  });

  it('notifies listeners on every write', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());
    let changes = 0;
    const group = {};
    model.on('learningFolderChanged', () => changes++, group);

    await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });
    model.recordProgress('make-a-group', { stepIndex: 1, stepCount: 3 });
    model.recordGrade('make-a-group', evidence());

    expect(changes).toBe(3);
    model.off(group);
  });
});

// ─── D5: platform-managed means no rename and no delete ─────────────────────

describe('D5 — the section is platform-managed', () => {
  it('offers no rename and no delete at all, structurally', () => {
    const { model } = makeModel();
    const api = model as unknown as Record<string, unknown>;
    for (const forbidden of ['rename', 'renameLesson', 'remove', 'removeLesson', 'delete', 'deleteLesson', 'detach']) {
      expect(typeof api[forbidden]).toBe('undefined');
    }
  });

  it('keeps an entry whose folder went missing, and says so — a missing folder is resettable, not gone', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());
    await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });

    fs.removeDirectoryRecursive('/data/Learning/make-a-group');

    const [entry] = model.list();
    expect(entry.id).toBe('make-a-group');
    expect(entry.missing).toBe(true);
  });

  it('lists newest install first', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/a', goodManifest('Lesson A'));
    stageBundle(fs, '/bundles/b', goodManifest('Lesson B'));

    await model.install({ bundleDir: '/bundles/a', provenance: 'curated' });
    await model.install({ bundleDir: '/bundles/b', provenance: 'curated' });

    expect(model.list().map((e) => e.id)).toEqual(['lesson-b', 'lesson-a']);
  });
});

// ─── Reset ──────────────────────────────────────────────────────────────────

describe('resetting a lesson', () => {
  it('re-pulls a fresh copy and clears progress and grade', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());
    await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });
    model.recordProgress('make-a-group', { stepIndex: 2, stepCount: 3 });
    model.recordGrade('make-a-group', evidence({ complete: false, completionPercent: 50 }));

    // The learner edited the lesson project — that IS the lesson, per D5.
    fs.writeFile('/data/Learning/make-a-group/project.json', '{"components":["their work"]}');

    const outcome = model.reset('make-a-group');

    expect(outcome.result).toBe('reset');
    expect(fs.files.get('/data/Learning/make-a-group/project.json')).toBe('{"components":[]}');
    const entry = model.get('make-a-group');
    expect(entry?.progress).toBeUndefined();
    expect(entry?.grade).toBeUndefined();
  });

  it('🔴 does not delete anything when the source cannot be re-pulled', async () => {
    // Delete-then-fail loses the learner's work AND the lesson — strictly worse
    // than the state reset was pressed to repair.
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());
    await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });
    fs.writeFile('/data/Learning/make-a-group/project.json', '{"components":["their work"]}');

    fs.removeDirectoryRecursive('/bundles/groups');
    const outcome = model.reset('make-a-group');

    expect(outcome.result).toBe('unavailable');
    expect(fs.files.get('/data/Learning/make-a-group/project.json')).toBe('{"components":["their work"]}');
  });

  // ⚠️ TUT-004 changed the SENTENCE and not the rule. This method still refuses a platform
  // lesson, for the reason it always did — it is synchronous, has no network, and must stay
  // loadable in plain Node. What changed is that "the platform is not connected yet" stopped
  // being true: `lessonplatforminstall.resetFromPlatform` fetches and comes back through
  // `resetFrom`, so the honest sentence now points at the panel instead of at an absence.
  it('refuses to reset a platform lesson HERE, and points at the caller that can', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());
    await model.install({
      bundleDir: '/bundles/groups',
      provenance: 'curated',
      source: { kind: 'platform', url: 'https://community.nodegx.io/lessons/groups' }
    });

    const outcome = model.reset('make-a-group');
    expect(outcome.result).toBe('unavailable');
    if (outcome.result !== 'unavailable') return;
    expect(outcome.reason).toMatch(/community panel/);
    // 🔴 And it left the installed copy standing — the whole point of refusing rather than
    // deleting first. A reset is the button someone presses when they are already stuck.
    expect(fs.files.get('/data/Learning/make-a-group/project.json')).toBe('{"components":[]}');
  });

  it('reports an unknown lesson instead of throwing', () => {
    const { model } = makeModel();
    expect(model.reset('nope').result).toBe('unavailable');
  });
});

// ─── Progress and grades ────────────────────────────────────────────────────

describe('progress and grades on the card', () => {
  async function installed() {
    const made = makeModel();
    stageBundle(made.fs, '/bundles/groups', goodManifest());
    await made.model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });
    return made;
  }

  it('records progress', async () => {
    const { model } = await installed();
    model.recordProgress('make-a-group', { stepIndex: 1, stepCount: 3 });
    expect(model.get('make-a-group')?.progress).toEqual({ stepIndex: 1, stepCount: 3 });
  });

  it('takes its numbers straight from the evidence bundle', async () => {
    const { model } = await installed();
    model.recordGrade(
      'make-a-group',
      evidence({
        completionPercent: 67,
        complete: false,
        gradedAt: '2026-08-15T10:00:00.000Z',
        wholeSolution: { valid: true, rendered: false, findingCount: 1 }
      })
    );

    expect(model.get('make-a-group')?.grade).toEqual({
      completionPercent: 67,
      complete: false,
      gradedAt: '2026-08-15T10:00:00.000Z',
      gradedBy: 'runner',
      wholeSolution: { valid: true, rendered: false, findingCount: 1 }
    });
  });

  it('carries a human override with its feedback — UNI-006 has the final say', async () => {
    const { model } = await installed();
    model.recordGrade('make-a-group', evidence({ complete: false, completionPercent: 80 }), {
      gradedBy: 'human',
      feedback: 'Close — the button works but nothing tells the user it did.',
      gradedAt: '2026-08-15T11:00:00.000Z'
    });

    const grade = model.get('make-a-group')?.grade;
    expect(grade?.gradedBy).toBe('human');
    expect(grade?.feedback).toMatch(/nothing tells the user/);
  });

  it('carries `unavailable` as a flag and never as the sentence', async () => {
    // The sentence names a filesystem, and this register is read by a card that
    // UNI-002 and UNI-006 also read. Same rule as the evidence bundle's.
    const { model } = await installed();
    model.recordGrade(
      'make-a-group',
      evidence({ complete: false, wholeSolution: { valid: true, rendered: false, findingCount: 0, unavailable: true } })
    );

    const ws = model.get('make-a-group')?.grade?.wholeSolution;
    expect(ws?.unavailable).toBe(true);
    expect(JSON.stringify(ws)).not.toMatch(/\//);
  });

  it('ignores a grade for a lesson that is not installed', async () => {
    const { model } = await installed();
    expect(model.recordGrade('other', evidence())).toBeUndefined();
    expect(model.recordProgress('other', { stepIndex: 0, stepCount: 1 })).toBeUndefined();
  });
});

// ─── Id helpers ─────────────────────────────────────────────────────────────

describe('lesson ids', () => {
  it('slugifies a title into a folder-safe segment', () => {
    expect(slugifyLessonId('L6 — the Variable node!')).toBe('l6-the-variable-node');
    expect(slugifyLessonId('  ')).toBe('');
    expect(slugifyLessonId(undefined)).toBe('');
  });

  it('accepts ordinary ids and rejects anything that could escape', () => {
    expect(isSafeLessonId('make-a-group')).toBe(true);
    expect(isSafeLessonId('l6_variable.v2')).toBe(true);
    expect(isSafeLessonId('../escape')).toBe(false);
    expect(isSafeLessonId('a/b')).toBe(false);
    expect(isSafeLessonId('a b')).toBe(false);
    expect(isSafeLessonId('')).toBe(false);
    expect(isSafeLessonId('a'.repeat(65))).toBe(false);
  });
});

// ─── The disk saying no ─────────────────────────────────────────────────────

describe('when the disk refuses', () => {
  it('rejects rather than throwing, and records nothing', async () => {
    const { model, fs } = makeModel();
    stageBundle(fs, '/bundles/groups', goodManifest());
    fs.failWrites = 'EACCES: permission denied';

    const outcome = await model.install({ bundleDir: '/bundles/groups', provenance: 'curated' });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    expect(outcome.reason).toMatch(/EACCES/);
    expect(model.list()).toEqual([]);
  });
});
