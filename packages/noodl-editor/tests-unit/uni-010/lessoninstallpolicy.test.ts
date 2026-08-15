/**
 * UNI-010 slice 2 — the install gate, and the two things it had to get right.
 *
 * 🔴 **The free-authoring bargain, collected.** Slice 1 built the F1–F4 harness
 * and nothing called it: `LearningFolderModel.install()` still ran the static
 * check alone, so an AI-authored bundle was priced at four classes and charged at
 * one. These tests are that gate closing — and the shape they pin is a *policy
 * table*, not a boolean, because the shipped editor cannot answer F4 at all (its
 * engine-2 adapter drives the running viewer, and the sidecar's spawns something
 * out of `scripts/`, which is not in `build.files`). Gating install on slice 1's
 * `installable` would have made every AI-authored lesson uninstallable — the
 * fourth amendment's failure, one slice later.
 *
 * 🔴 **And a manifest may only tighten.** Provenance is the caller's word because
 * a bundle declaring itself `curated` would be believed. The asymmetry that makes
 * `authoredBy: "ai"` safe is that it *spends* trust: it moves the bundle from a
 * one-class gate to a three-class one, so a liar has no motive. That single rule
 * is what lets the MCP route work through the launcher's ordinary folder picker
 * with no new plumbing, and it is D5-clean — the sidecar wrote a folder, the
 * editor process wrote the register.
 */

import {
  LearningFolderModel,
  type LearningFolderFs,
  type LearningFolderStore
} from '../../src/editor/src/models/learningfolder';
import {
  decideInstall,
  describeInstallCheck,
  type FailureClass,
  REQUIRED_CLASSES,
  resolveProvenance
} from '../../src/editor/src/models/lessoninstallpolicy';
import type { LessonBundleScorecard } from '../../src/editor/src/models/lessonbundleverify';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import type { WholeSolutionGrader } from '../../src/editor/src/models/lessongrading';
import type { NodeV2 } from '../../src/editor/src/schemas';

// ─── Fakes ──────────────────────────────────────────────────────────────────

class FakeStore implements LearningFolderStore {
  private data: Record<string, unknown> = {};
  get(key: string) {
    return this.data[key];
  }
  set(key: string, value: unknown) {
    this.data[key] = JSON.parse(JSON.stringify(value));
  }
}

class FakeFs implements LearningFolderFs {
  files = new Map<string, string>();
  dirs = new Set<string>();

  writeFile(path: string, contents: string): void {
    this.files.set(path, contents);
    let dir = path;
    while (dir.includes('/')) {
      dir = dir.slice(0, dir.lastIndexOf('/'));
      this.dirs.add(dir);
    }
  }
  writeJson(path: string, value: unknown): void {
    this.writeFile(path, JSON.stringify(value));
  }
  exists(path: string) {
    return this.dirs.has(path) || this.files.has(path);
  }
  makeDirectory(path: string) {
    this.dirs.add(path);
  }
  removeDirectoryRecursive(path: string) {
    for (const p of [...this.files.keys()]) if (p === path || p.startsWith(path + '/')) this.files.delete(p);
    for (const d of [...this.dirs]) if (d === path || d.startsWith(path + '/')) this.dirs.delete(d);
  }
  copyRecursive(from: string, to: string) {
    this.dirs.add(to);
    for (const [p, contents] of [...this.files]) {
      if (!p.startsWith(from + '/')) continue;
      this.writeFile(to + p.slice(from.length), contents);
    }
  }
  readJsonFile(path: string) {
    const raw = this.files.get(path);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  join(...parts: string[]) {
    return parts.join('/');
  }
}

function makeModel() {
  const fs = new FakeFs();
  const model = new LearningFolderModel({
    store: new FakeStore(),
    fs,
    root: '/data/Learning',
    now: () => '2026-08-15T12:00:00.000Z'
  });
  return { model, fs };
}

// ─── Bundle fixtures on the fake disk ───────────────────────────────────────

/**
 * Write one v2 project into `dir`. The same shape `lessonbundleread` expects —
 * ⚠️ including the component's `path`, which is its **legacy name** and not its
 * directory. A fixture that let those agree would be testing a graph the editor
 * never produces.
 */
function writeProject(fs: FakeFs, dir: string, nodes: NodeV2[]): void {
  fs.writeJson(`${dir}/components/_registry.json`, { components: { '__page__/Home': { path: '__page__/Home' } } });
  fs.writeJson(`${dir}/components/__page__/Home/component.json`, {
    id: 'home',
    name: 'Home',
    path: '/#__page__/Home',
    type: 'visual'
  });
  fs.writeJson(`${dir}/components/__page__/Home/nodes.json`, { componentId: 'home', nodes });
  fs.writeJson(`${dir}/components/__page__/Home/connections.json`, { componentId: 'home', connections: [] });
  fs.writeJson(`${dir}/nodegx.project.json`, { rootNodeId: 'page-1' });
}

const EMPTY_PAGE: NodeV2[] = [{ id: 'page-1', type: 'Page', children: [] }];
const PAGE_WITH_TEXT: NodeV2[] = [
  { id: 'page-1', type: 'Page', children: ['text-1'] },
  { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' }
];

function lesson(over: Partial<LessonManifest> = {}): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title: 'Put some text on the page',
    steps: [
      { kind: 'popup', body: 'Welcome.' },
      {
        title: 'Add a Text node',
        body: 'Drag a **Text** node onto the page and label it `Greeting`.',
        completeWhen: [{ node: '/#__page__/Home:%Page:#Greeting', hasType: 'Text' }]
      }
    ],
    ...over
  };
}

/** A complete bundle: manifest, starter at the root, solution at `solution/`. */
function stageFullBundle(fs: FakeFs, dir: string, manifest: LessonManifest = lesson()): string {
  fs.writeJson(`${dir}/lesson.json`, manifest);
  writeProject(fs, dir, EMPTY_PAGE);
  writeProject(fs, `${dir}/solution`, PAGE_WITH_TEXT);
  return dir;
}

/** The same lesson with no answer beside it — the shape slice 1 named. */
function stageSolutionlessBundle(fs: FakeFs, dir: string, manifest: LessonManifest = lesson()): string {
  fs.writeJson(`${dir}/lesson.json`, manifest);
  writeProject(fs, dir, EMPTY_PAGE);
  return dir;
}

function grader(rendered: boolean): WholeSolutionGrader {
  return { check: async () => ({ valid: true, rendered, drawnElementCount: rendered ? 2 : 0, findings: [] }) };
}

// ─── The gate ───────────────────────────────────────────────────────────────

describe('an AI-authored bundle has to carry its own answer', () => {
  it('installs when the solution is there and every required class passes', async () => {
    const { model, fs } = makeModel();
    stageFullBundle(fs, '/bundles/text');

    const outcome = await model.install({ bundleDir: '/bundles/text', provenance: 'local-ai' });

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;
    expect(outcome.scorecard.classes).toMatchObject({ F1: 'pass', F2: 'pass', F3: 'pass' });
    expect(outcome.entry.provenance).toBe('local-ai');
  });

  it('🔴 refuses one with no solution/, and says that is what is missing', async () => {
    // This is the whole bargain. F2 and F3 are only answerable against the
    // lesson's own answer, so a bundle without one has not passed the gate that
    // was traded for §3.1 — it has skipped it.
    const { model, fs } = makeModel();
    stageSolutionlessBundle(fs, '/bundles/text');

    const outcome = await model.install({ bundleDir: '/bundles/text', provenance: 'local-ai' });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    expect(outcome.reason).toMatch(/solution\//);
    expect(outcome.scorecard?.classes).toMatchObject({ F2: 'not-checked', F3: 'not-checked' });
    expect(model.list()).toEqual([]);
  });

  it('accepts the same solutionless bundle as curated — a person stands behind that one', async () => {
    const { model, fs } = makeModel();
    stageSolutionlessBundle(fs, '/bundles/text');

    const outcome = await model.install({ bundleDir: '/bundles/text', provenance: 'curated' });

    expect(outcome.result).toBe('installed');
  });

  it('🔴 refuses a lesson whose own solution does not satisfy it, whatever the provenance', async () => {
    // Slice 3's gate was F1-only, so a curated bundle with a dead condition
    // installed and the learner found out. A `fail` blocks for everyone; only
    // `not-checked` is what the provenance table is about.
    const { model, fs } = makeModel();
    // The solution never grows the Text the step asks for.
    fs.writeJson('/bundles/dead/lesson.json', lesson());
    writeProject(fs, '/bundles/dead', EMPTY_PAGE);
    writeProject(fs, '/bundles/dead/solution', EMPTY_PAGE);

    const outcome = await model.install({ bundleDir: '/bundles/dead', provenance: 'curated' });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    expect(outcome.scorecard?.classes.F2).toBe('fail');
    expect(outcome.reason).toMatch(/F2/);
  });

  it('🔴 refuses a step the starter has already done for the learner (§3.5)', async () => {
    const { model, fs } = makeModel();
    fs.writeJson('/bundles/ghost/lesson.json', lesson());
    // The "starter" already has the labelled Text the step asks the learner to add.
    writeProject(fs, '/bundles/ghost', PAGE_WITH_TEXT);
    writeProject(fs, '/bundles/ghost/solution', PAGE_WITH_TEXT);

    const outcome = await model.install({ bundleDir: '/bundles/ghost', provenance: 'local-ai' });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    expect(outcome.scorecard?.findings.some((f) => f.code === 'already-satisfied-in-starter')).toBe(true);
  });
});

// ─── F4, and the honest gap ─────────────────────────────────────────────────

describe('F4 is scored when it can be, and required of nobody', () => {
  it('⚠️ installs an AI-authored bundle with F4 not-checked — the editor cannot render a solution folder', async () => {
    // Recorded as behaviour rather than as a comment, because it is the one hole
    // slice 2 leaves open: the class the prior arc predicted would DOMINATE is
    // answered by the producer (the MCP gate has the render harness) and not by
    // the installer. If the editor ever gains the capability, this test is the
    // thing that has to change.
    const { model, fs } = makeModel();
    stageFullBundle(fs, '/bundles/text');

    const outcome = await model.install({ bundleDir: '/bundles/text', provenance: 'local-ai' });

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;
    expect(outcome.scorecard.classes.F4).toBe('not-checked');
    expect(outcome.scorecard.installable).toBe(false);
    expect(REQUIRED_CLASSES['local-ai']).not.toContain('F4');
  });

  it('blocks when a grader IS supplied and the solution draws nothing', async () => {
    const { model, fs } = makeModel();
    stageFullBundle(fs, '/bundles/text');

    const outcome = await model.install({
      bundleDir: '/bundles/text',
      provenance: 'local-ai',
      wholeSolution: grader(false)
    });

    expect(outcome.result).toBe('rejected');
    if (outcome.result !== 'rejected') return;
    expect(outcome.scorecard?.classes.F4).toBe('fail');
    expect(outcome.reason).toMatch(/F4/);
  });

  it('installs with every class checked when the grader says it drew', async () => {
    const { model, fs } = makeModel();
    stageFullBundle(fs, '/bundles/text');

    const outcome = await model.install({
      bundleDir: '/bundles/text',
      provenance: 'local-ai',
      wholeSolution: grader(true)
    });

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;
    expect(outcome.scorecard.installable).toBe(true);
  });
});

// ─── A claim may only tighten ───────────────────────────────────────────────

describe('the manifest may spend trust and may not buy it', () => {
  it('honours authoredBy: "ai" arriving through the ordinary folder picker', async () => {
    // The launcher passes `local` — picking a directory says nothing about who
    // wrote what is in it. The manifest's claim moves it to `local-ai`, so the
    // stricter gate applies and the card carries the AI-authored label, with no
    // channel between the sidecar and the editor at all.
    const { model, fs } = makeModel();
    stageFullBundle(fs, '/bundles/text', lesson({ authoredBy: 'ai' }));

    const outcome = await model.install({ bundleDir: '/bundles/text', provenance: 'local' });

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;
    expect(outcome.entry.provenance).toBe('local-ai');
  });

  it('🔴 and that claim makes it refusable — a solutionless AI bundle cannot sneak in as local', async () => {
    const { model, fs } = makeModel();
    stageSolutionlessBundle(fs, '/bundles/text', lesson({ authoredBy: 'ai' }));

    const outcome = await model.install({ bundleDir: '/bundles/text', provenance: 'local' });

    expect(outcome.result).toBe('rejected');
  });

  it('🔴 ignores a manifest that declares itself curated', async () => {
    // The direction that buys trust. Slice 3 refused to read provenance out of
    // the manifest for exactly this case, and slice 2 does not reopen it.
    const { model, fs } = makeModel();
    const claimed = { ...lesson(), authoredBy: 'curated' } as unknown as LessonManifest;
    stageSolutionlessBundle(fs, '/bundles/text', claimed);

    const outcome = await model.install({ bundleDir: '/bundles/text', provenance: 'local-ai' });

    expect(outcome.result).toBe('rejected');
  });

  it('resolves in one direction only', () => {
    expect(resolveProvenance('local', 'ai')).toBe('local-ai');
    expect(resolveProvenance('curated', 'ai')).toBe('local-ai');
    expect(resolveProvenance('local-ai', undefined)).toBe('local-ai');
    expect(resolveProvenance('local', 'curated')).toBe('local');
    expect(resolveProvenance('local', 'org')).toBe('local');
    expect(resolveProvenance('local', { spoof: true })).toBe('local');
  });
});

// ─── The decision, on its own ───────────────────────────────────────────────

describe('decideInstall', () => {
  function card(classes: Partial<LessonBundleScorecard['classes']>): LessonBundleScorecard {
    return {
      ok: true,
      installable: false,
      classes: { F1: 'pass', F2: 'pass', F3: 'pass', F4: 'not-checked', ...classes },
      findings: [
        {
          code: 'dead-on-solution',
          severity: 'error',
          failureClass: 'F2',
          where: 'Step 2',
          message: 'the sentence that names what to change'
        }
      ],
      gradedSteps: 1,
      verification: { ok: true, findings: [] }
    };
  }

  it('lets a fail block every provenance', () => {
    for (const provenance of ['curated', 'org', 'local', 'local-ai'] as const) {
      expect(decideInstall(card({ F2: 'fail' }), provenance).allowed).toBe(false);
    }
  });

  it('quotes the first error, so the refusal is a repair instruction', () => {
    const decision = decideInstall(card({ F2: 'fail' }), 'local-ai');
    expect(decision.reason).toMatch(/names what to change/);
  });

  it('only local-ai requires more than F1', () => {
    const unreplayed = card({ F2: 'not-checked', F3: 'not-checked' });
    expect(decideInstall(unreplayed, 'curated').allowed).toBe(true);
    expect(decideInstall(unreplayed, 'org').allowed).toBe(true);
    expect(decideInstall(unreplayed, 'local').allowed).toBe(true);
    expect(decideInstall(unreplayed, 'local-ai').allowed).toBe(false);
  });

  it('🔴 a claim may only ever COST the claimant — local-ai is a strict superset of every other row', () => {
    // The precondition the whole trust argument rests on, made executable.
    //
    // Honouring `authoredBy: "ai"` is safe *because* it can only tighten: a liar
    // has no motive to move itself to a harder gate. That reasoning holds only
    // while `local-ai` demands everything every other provenance demands and
    // more. A future fast-path — "the producer already scored F2, skip it at
    // install" — would reverse the incentive and make the field worth forging,
    // and it would arrive in review looking like an optimisation.
    //
    // 🔴 If this fails, the fix is the table, not the assertion.
    const ai = new Set<FailureClass>(REQUIRED_CLASSES['local-ai']);

    for (const provenance of ['curated', 'org', 'local'] as const) {
      for (const required of REQUIRED_CLASSES[provenance]) {
        expect(ai.has(required)).toBe(true);
      }
      // ...and strictly more, or the claim costs nothing and buys nothing.
      expect(ai.size).toBeGreaterThan(REQUIRED_CLASSES[provenance].length);
    }
  });

  it('🔴 and no scorecard exists that local-ai admits while another provenance refuses', () => {
    // The superset check is structural; this is the same guarantee stated over
    // behaviour, because a table can be a superset and a decision can still
    // diverge if `decideInstall` ever grows a branch on provenance.
    const states = ['pass', 'fail', 'not-checked'] as const;

    for (const F1 of states) {
      for (const F2 of states) {
        for (const F3 of states) {
          const scorecard = card({ F1, F2, F3 });
          if (!decideInstall(scorecard, 'local-ai').allowed) continue;

          for (const provenance of ['curated', 'org', 'local'] as const) {
            expect(decideInstall(scorecard, provenance).allowed).toBe(true);
          }
        }
      }
    }
  });

  it('says "not checked" out loud rather than omitting the class', () => {
    // "We did not look" and "we looked and it was fine" must never be written
    // the same way — the discipline this whole arc is built on.
    const line = describeInstallCheck(card({}), 'local-ai');
    expect(line).toMatch(/F1, F2, F3 passed/);
    expect(line).toMatch(/F4 not checked/);
  });
});
