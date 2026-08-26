/**
 * TUT-004 — **the bundle that actually ships, through the path that actually runs.**
 *
 * 🔴 WHY THIS EXISTS BESIDE 55 GREEN SPECS. Every other TUT-004 test builds its own two-node
 * fixture. A fixture is written by the person writing the test, so it passes the gates that
 * person was thinking about — and TUT-003's session found exactly this: 52 specs green on
 * fixtures, and one pass over the real modules found two defects. `project-examples/lessons/
 * log-a-thing/` is eight steps, six graded, three components and 35 files, and it is the only
 * bundle a learner will ever see.
 *
 * ⚠️ **A REAL TEMPORARY FILESYSTEM, not the fake.** The fake `FakeFs` in the sibling files
 * agrees with `node:fs` about everything the other tests ask it — but a fake is a hypothesis
 * about a filesystem, and nested `mkdir`, path joining and recursive copy are precisely where
 * one is wrong. This is also the only test that would notice a bundle entry whose path the fake
 * flattens.
 *
 * ⚠️ **`authoredBy: "ai"` in the shipped manifest is load-bearing here.** It means this bundle
 * installs as `local-ai` — F1 **and** F2 **and** F3, all three required — even though TUT-004
 * passes `curated`. The asymmetry `lessoninstallpolicy` defends, exercised by the first real
 * artefact to travel the path rather than by a fixture written to exercise it.
 */
import * as nodeCrypto from 'node:crypto';
import * as nodeFs from 'node:fs';
import * as nodeOs from 'node:os';
import * as nodePath from 'node:path';

import { LearningFolderModel } from '../../src/editor/src/models/learningfolder';
import {
  installTutorialFromPlatform,
  resetLessonFromPlatform
} from '../../src/editor/src/models/lessonplatforminstall';
import type { PlatformInstallDeps, PlatformSource } from '../../src/editor/src/models/lessonplatforminstall';
import type { Read, TutorialBundlePayload } from '../../src/editor/src/models/community/communityapi';

/** The shipped bundle. Resolved from this file so a move breaks loudly rather than silently. */
const BUNDLE_DIR = nodePath.resolve(__dirname, '../../../../project-examples/lessons/log-a-thing');

function readDirectory(root: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of nodeFs.readdirSync(nodePath.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(out, readDirectory(root, rel));
    else if (entry.isFile()) out[rel] = nodeFs.readFileSync(nodePath.join(root, rel), 'utf8');
  }
  return out;
}

function countFiles(dir: string): number {
  let n = 0;
  for (const e of nodeFs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(nodePath.join(dir, e.name)) : 1;
  }
  return n;
}

let root: string;
let deps: PlatformInstallDeps;
let register: LearningFolderModel;
let learningRoot: string;
let fetches: number;
let answer: () => Read<TutorialBundlePayload>;

beforeEach(() => {
  root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'tut004-'));
  learningRoot = nodePath.join(root, 'Learning');
  nodeFs.mkdirSync(learningRoot, { recursive: true });

  const store = new Map<string, unknown>();
  const fs = {
    exists: (p: string) => nodeFs.existsSync(p),
    makeDirectory: (p: string) => nodeFs.mkdirSync(p, { recursive: true }),
    removeDirectoryRecursive: (p: string) => nodeFs.rmSync(p, { recursive: true, force: true }),
    copyRecursive: (from: string, to: string) => nodeFs.cpSync(from, to, { recursive: true }),
    readJsonFile: (p: string) => {
      try {
        return JSON.parse(nodeFs.readFileSync(p, 'utf8'));
      } catch {
        return undefined;
      }
    },
    writeJsonFile: (p: string, d: unknown) => nodeFs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8'),
    writeFile: (p: string, c: string) => nodeFs.writeFileSync(p, c, 'utf8'),
    join: (...parts: string[]) => nodePath.join(...parts),
    dirname: (p: string) => nodePath.dirname(p)
  };

  register = new LearningFolderModel({
    store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) },
    fs,
    root: learningRoot,
    now: () => new Date().toISOString(),
    newProjectId: () => nodeCrypto.randomUUID()
  });

  fetches = 0;
  answer = () => ({
    outcome: 'ok',
    value: {
      slug: 'log-a-thing',
      title: 'Log a thing',
      version: 1,
      updatedAt: '2026-08-20T12:00:00.000Z',
      files: readDirectory(BUNDLE_DIR),
      // ⚠️ `{}` — a LESSON bundle never carries binaries. `0023` gave the shared `BundlePayload`
      // a second map for project templates, and `publish-tutorial-bundle.ts` still refuses a
      // binary outright because TUT-004's staging writer has no decode branch.
      binaryFiles: {}
    }
  });
  const source: PlatformSource = {
    tutorialBundle: async () => {
      fetches += 1;
      return answer();
    },
    tutorialBundleUrl: (slug) => `https://community.nodegx.io/api/v1/community/tutorials/${slug}/bundle`
  };

  deps = { register, source, fs, stagingRoot: nodePath.join(root, 'staging') };
});

afterEach(() => {
  nodeFs.rmSync(root, { recursive: true, force: true });
});

describe('the shipped log-a-thing bundle', () => {
  it('is the artefact this test claims — eight steps, a solution, and no identity of its own', () => {
    // 🔴 Non-vacuity. Every assertion below is about a file on disk, so if the bundle moved or
    // emptied, the interesting tests would pass having installed nothing.
    const files = readDirectory(BUNDLE_DIR);
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(30);
    const manifest = JSON.parse(files['lesson.json']) as { steps: unknown[]; authoredBy?: string };
    expect(manifest.steps.length).toBe(8);
    expect(manifest.authoredBy).toBe('ai');
    expect(Object.keys(files).some((f) => f.startsWith('solution/'))).toBe(true);
    // A template carries no identity — TUT-003 removed it, and `install` is what supplies one.
    expect((JSON.parse(files['nodegx.project.json']) as { id?: string }).id).toBeUndefined();
  });

  it('🔴 installs end to end, and the manifest claim makes it local-ai despite `curated`', async () => {
    let learningAtPreview: string[] | undefined;
    let checked: string | undefined;

    const outcome = await installTutorialFromPlatform(
      {
        slug: 'log-a-thing',
        confirm: (preview) => {
          learningAtPreview = nodeFs.readdirSync(learningRoot);
          checked = preview.checked;
          return true;
        }
      },
      deps
    );

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;

    // The strict gate ran, and passed, on the real lesson.
    expect(outcome.entry.provenance).toBe('local-ai');
    expect(outcome.scorecard.classes).toMatchObject({ F1: 'pass', F2: 'pass', F3: 'pass' });
    expect(checked).toMatch(/Checked as local-ai: F1, F2, F3 passed/);

    // AC2 — the arm that had never been constructed.
    expect(outcome.entry.source).toEqual({
      kind: 'platform',
      url: 'https://community.nodegx.io/api/v1/community/tutorials/log-a-thing/bundle'
    });

    // AC3 — nothing had landed when the person was shown the scorecard.
    expect(learningAtPreview).toEqual([]);

    // Every file arrived, nested ones included, through a real filesystem.
    expect(countFiles(outcome.entry.projectDirectory)).toBe(Object.keys(readDirectory(BUNDLE_DIR)).length);
    expect(nodeFs.existsSync(nodePath.join(outcome.entry.projectDirectory, 'solution', 'nodegx.project.json'))).toBe(true);

    // Staging is gone.
    expect(nodeFs.existsSync(nodePath.join(root, 'staging', 'log-a-thing'))).toBe(false);
  });

  it('🔴 two learners installing the SAME bundle get two different project ids', async () => {
    // README §1B, and the defect TUT-003 shipped with a workaround. N learners and one bundle is
    // precisely the case that breaks when a template carries an identity.
    const a = await installTutorialFromPlatform({ slug: 'log-a-thing' }, deps);
    if (a.result !== 'installed') throw new Error('first install failed');
    const first = nodeFs.readFileSync(nodePath.join(a.entry.projectDirectory, 'nodegx.project.json'), 'utf8');

    nodeFs.rmSync(a.entry.projectDirectory, { recursive: true, force: true });
    const b = await installTutorialFromPlatform({ slug: 'log-a-thing' }, deps);
    if (b.result !== 'installed') throw new Error('second install failed');
    const second = nodeFs.readFileSync(nodePath.join(b.entry.projectDirectory, 'nodegx.project.json'), 'utf8');

    const idOf = (raw: string) => (JSON.parse(raw) as { id?: string }).id;
    expect(idOf(first)).toBeTruthy();
    expect(idOf(second)).toBeTruthy();
    expect(idOf(first)).not.toBe(idOf(second));
  });

  it('AC5 — resets from the platform, keeping the identity and dropping the work', async () => {
    const installed = await installTutorialFromPlatform({ slug: 'log-a-thing' }, deps);
    if (installed.result !== 'installed') throw new Error('install failed');
    const dir = installed.entry.projectDirectory;
    const idBefore = (JSON.parse(nodeFs.readFileSync(nodePath.join(dir, 'nodegx.project.json'), 'utf8')) as { id: string }).id;

    nodeFs.writeFileSync(nodePath.join(dir, 'learner-scribble.json'), '{"mine":true}');
    register.recordProgress(installed.entry.id, { stepIndex: 3, stepCount: 8 });

    const reset = await resetLessonFromPlatform(installed.entry.id, deps);

    expect(reset.result).toBe('reset');
    expect(fetches).toBe(2);
    expect(nodeFs.existsSync(nodePath.join(dir, 'learner-scribble.json'))).toBe(false);
    expect(register.get(installed.entry.id)?.progress).toBeUndefined();
    const idAfter = (JSON.parse(nodeFs.readFileSync(nodePath.join(dir, 'nodegx.project.json'), 'utf8')) as { id: string }).id;
    expect(idAfter).toBe(idBefore);
  });

  it('AC5 — a reset with no network leaves the real lesson and the real work standing', async () => {
    const installed = await installTutorialFromPlatform({ slug: 'log-a-thing' }, deps);
    if (installed.result !== 'installed') throw new Error('install failed');
    const dir = installed.entry.projectDirectory;
    nodeFs.writeFileSync(nodePath.join(dir, 'learner-scribble.json'), '{"mine":true}');
    register.recordProgress(installed.entry.id, { stepIndex: 5, stepCount: 8 });

    answer = () => ({ outcome: 'unreachable', status: null, detail: 'ENOTFOUND community.nodegx.io' });
    const reset = await resetLessonFromPlatform(installed.entry.id, deps);

    expect(reset.result).toBe('unavailable');
    if (reset.result !== 'unavailable') return;
    expect(reset.reason).toMatch(/Nothing was changed/);
    expect(nodeFs.existsSync(nodePath.join(dir, 'learner-scribble.json'))).toBe(true);
    expect(register.get(installed.entry.id)?.progress).toEqual({ stepIndex: 5, stepCount: 8 });
    expect(countFiles(dir)).toBeGreaterThan(30);
  });
});
