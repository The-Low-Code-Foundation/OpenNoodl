/**
 * REL-012 AC1 — **the gate that asks the packaging config what it will actually include.**
 *
 * 🔴 WHY THIS IS NOT `npm run lessons:check`. That gate walks `project-examples/lessons` in the
 * repository and reports on the bundles it finds there. Both bundles were perfect, gated, driven —
 * and named in **neither** `files` nor `extraResources`, so they shipped in no artefact a user
 * receives. A checker pointed at the repository directory is structurally incapable of seeing
 * that: it is measuring the wrong population. This one reads
 * `packages/noodl-editor/package.json` and asks what electron-builder will put in the app.
 *
 * ⚠️ **It is still not an artefact.** Only a build proves AC1 outright, and a build is not run
 * here. What this closes is the gap between the config and the code that resolves the path — which
 * is the half that fails silently, because a renamed `to` ships an app whose lessons are present
 * and unreachable and nothing anywhere says so.
 *
 * 🔴 **THE MUTANT ARMS ARE THE POINT.** A verdict function driven only over the real config that
 * was just made correct is indistinguishable from `return { ok: true }`. So every arm below is
 * driven twice: once over the real `package.json`, and once over a mutated copy of it where the
 * defect this row opened for has been put back. If a mutant passes, the gate is vacuous — fix the
 * gate, not the mutant.
 */
import { execFileSync } from 'node:child_process';
import * as nodeFs from 'node:fs';
import * as nodeOs from 'node:os';
import * as nodePath from 'node:path';

import {
  SHIPPED_LESSONS_DIRNAME,
  SHIPPED_LESSONS_FILTER,
  SHIPPED_LESSONS_REPO_PATH,
  resolveShippedLessonsRoot,
  shippedLessonsPackaging
} from '../../src/editor/src/models/lessonseed';

/** The real thing, resolved from this file so a move breaks loudly rather than silently. */
const PACKAGE_JSON = nodePath.resolve(__dirname, '../../package.json');
const REPO_ROOT = nodePath.resolve(__dirname, '../../../..');
const LESSONS_DIR = nodePath.join(REPO_ROOT, ...SHIPPED_LESSONS_REPO_PATH.split('/'));

function readBuildConfig(): Record<string, unknown> {
  const pkg = JSON.parse(nodeFs.readFileSync(PACKAGE_JSON, 'utf8')) as { build?: Record<string, unknown> };
  return pkg.build ?? {};
}

/** Every file under `dir`, absolute. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of nodeFs.readdirSync(dir, { withFileTypes: true })) {
    const full = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** A deep copy, so a mutant cannot leak into the next arm. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The one entry the gate is about, located the same way the gate locates it. */
function lessonsEntryIndex(build: Record<string, unknown>): number {
  const list = build.extraResources as { from?: string }[];
  const index = list.findIndex((entry) => (entry.from ?? '').replace(/\\/g, '/').endsWith(SHIPPED_LESSONS_REPO_PATH));
  // 🔴 A -1 here would make every mutant below mutate the WRONG entry — `splice(-1, 1)` removes
  // the last one — and the mutants would then pass for a reason that has nothing to do with them.
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('the corpus this gate is about', () => {
  it('🔴 is really there — two bundles, each with a manifest', () => {
    // Non-vacuity for everything below. A gate that says "the config includes the lessons
    // directory" over a directory with nothing in it is the failure this repo keeps re-learning.
    expect(nodeFs.existsSync(LESSONS_DIR)).toBe(true);
    const bundles = nodeFs
      .readdirSync(LESSONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(bundles.length).toBeGreaterThanOrEqual(2);
    for (const bundle of bundles) {
      expect(nodeFs.existsSync(nodePath.join(LESSONS_DIR, bundle, 'lesson.json'))).toBe(true);
    }
  });
});

describe('🔴 what is in the directory, as opposed to what is in git', () => {
  it('carries no untracked file the filter does not exclude', () => {
    // MEASURED, NOT THEORISED, 2026-09-04: `your-creature-on-screen/.mcp.json` and its
    // `solution/` twin are written by *opening the project in the editor*, are gitignored, and
    // each names absolute paths on the machine that opened it — a `/private/tmp/…` scratchpad and
    // a `~/Library/Application Support/…/PREFERENCES.md`. `extraResources` copies what is on
    // disk; git has no say in it. Without the filter, the change that puts the lessons in the
    // artefact puts one developer's paths inside every learner's copy of the lesson.
    //
    // 🔴 So the population this asserts over is the DIRECTORY, not the index. The day a new kind
    // of dropping appears, this goes red and the answer is to commit it or to exclude it — not to
    // widen the set below.
    const excludedBasenames = new Set(
      SHIPPED_LESSONS_FILTER.filter((glob) => glob.startsWith('!')).map((glob) => nodePath.basename(glob))
    );
    expect(excludedBasenames.size).toBeGreaterThan(0);

    const tracked = new Set(
      execFileSync('git', ['ls-files', '-z', SHIPPED_LESSONS_REPO_PATH], { cwd: REPO_ROOT, encoding: 'utf8' })
        .split('\0')
        .filter(Boolean)
        .map((rel) => nodePath.join(REPO_ROOT, rel))
    );
    // A control that read zero would make every assertion below vacuously true.
    expect(tracked.size).toBeGreaterThan(30);

    const onDisk = walk(LESSONS_DIR);
    expect(onDisk.length).toBeGreaterThanOrEqual(tracked.size);

    const stowaways = onDisk.filter((file) => !tracked.has(file) && !excludedBasenames.has(nodePath.basename(file)));
    expect(stowaways.map((f) => nodePath.relative(REPO_ROOT, f))).toEqual([]);
  });
});

describe('AC1 — the packaging config puts the bundles in the artefact', () => {
  it('🔴 the real package.json includes project-examples/lessons', () => {
    const verdict = shippedLessonsPackaging(readBuildConfig());
    // The reason is asserted on failure so a red here reads as the finding rather than as `false`.
    expect(verdict.reason ?? 'ok').toBe('ok');
    expect(verdict.ok).toBe(true);
  });

  it('🔴 and lands it where the editor looks — the config and the resolver are one fact', () => {
    const verdict = shippedLessonsPackaging(readBuildConfig());
    // DERIVED from the config, never re-literalled here: this assertion is the join between
    // `package.json` and `lessonseed.ts`, and a literal on both sides would let them drift.
    expect(verdict.to).toBe(SHIPPED_LESSONS_DIRNAME);

    const resourcesPath = '/Applications/NodeGX.app/Contents/Resources';
    const packagedPath = nodePath.join(resourcesPath, String(verdict.to));
    const { probed } = resolveShippedLessonsRoot({
      exists: () => false,
      join: nodePath.join,
      resolve: nodePath.resolve,
      appPath: `${resourcesPath}/app.asar/`,
      resourcesPath
    });
    expect(probed).toContain(packagedPath);
  });

  it('the entry copies the repository directory that actually holds the bundles', () => {
    const verdict = shippedLessonsPackaging(readBuildConfig());
    const from = nodePath.resolve(nodePath.dirname(PACKAGE_JSON), String(verdict.from));
    expect(from).toBe(LESSONS_DIR);
  });
});

describe('🔴 the mutants — proving the gate is not vacuous', () => {
  it('fails when the entry is missing, which is the state this row opened for', () => {
    const build = clone(readBuildConfig());
    (build.extraResources as unknown[]).splice(lessonsEntryIndex(build), 1);

    const verdict = shippedLessonsPackaging(build);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain(SHIPPED_LESSONS_REPO_PATH);
  });

  it('fails when the bundles land under a name the editor does not look for', () => {
    const build = clone(readBuildConfig());
    (build.extraResources as { to: string }[])[lessonsEntryIndex(build)].to = 'lesson-bundles';

    const verdict = shippedLessonsPackaging(build);
    // 🔴 Present and unreachable — the same defect one layer along, and the one a build would
    // not catch either: the files really are in the artefact.
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain(SHIPPED_LESSONS_DIRNAME);
  });

  it('🔴 fails when the filter is dropped — that is the arm that ships a developer’s paths', () => {
    const build = clone(readBuildConfig());
    delete (build.extraResources as { filter?: string[] }[])[lessonsEntryIndex(build)].filter;

    const verdict = shippedLessonsPackaging(build);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('filter');
  });

  it('fails when the filter is a different one this gate has not reasoned about', () => {
    const build = clone(readBuildConfig());
    (build.extraResources as { filter?: string[] }[])[lessonsEntryIndex(build)].filter = ['**/*'];

    expect(shippedLessonsPackaging(build).ok).toBe(false);
  });

  it('fails when two entries copy the same directory', () => {
    const build = clone(readBuildConfig());
    const list = build.extraResources as unknown[];
    list.push(clone(list[lessonsEntryIndex(build)]));

    expect(shippedLessonsPackaging(build).ok).toBe(false);
  });

  it('fails when the bundles are put in `files` instead — inside the asar, where the copy cannot read them', () => {
    const build = clone(readBuildConfig());
    const list = build.extraResources as unknown[];
    const entry = list.splice(lessonsEntryIndex(build), 1)[0];
    (build.files as unknown[]).push(entry);

    expect(shippedLessonsPackaging(build).ok).toBe(false);
  });

  it('fails when there is no extraResources at all', () => {
    expect(shippedLessonsPackaging({}).ok).toBe(false);
    expect(shippedLessonsPackaging(undefined).ok).toBe(false);
  });
});

describe('resolving the bundles in both layouts', () => {
  let root: string;

  beforeEach(() => {
    root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'rel012-paths-'));
  });

  afterEach(() => {
    nodeFs.rmSync(root, { recursive: true, force: true });
  });

  const ports = (over: Partial<Parameters<typeof resolveShippedLessonsRoot>[0]>) => ({
    exists: (p: string) => nodeFs.existsSync(p),
    join: nodePath.join,
    resolve: nodePath.resolve,
    ...over
  });

  it('finds them in a packaged app, beside the asar', () => {
    const resources = nodePath.join(root, 'Contents', 'Resources');
    nodeFs.mkdirSync(nodePath.join(resources, SHIPPED_LESSONS_DIRNAME), { recursive: true });

    const found = resolveShippedLessonsRoot(
      ports({ appPath: `${nodePath.join(resources, 'app.asar')}/`, resourcesPath: resources })
    );
    expect(found.root).toBe(nodePath.join(resources, SHIPPED_LESSONS_DIRNAME));
  });

  it('finds them in a checkout, two levels above the editor package', () => {
    const appPath = nodePath.join(root, 'packages', 'noodl-editor');
    nodeFs.mkdirSync(appPath, { recursive: true });
    nodeFs.mkdirSync(nodePath.join(root, ...SHIPPED_LESSONS_REPO_PATH.split('/')), { recursive: true });

    const found = resolveShippedLessonsRoot(ports({ appPath: `${appPath}/` }));
    expect(found.root).toBe(nodePath.join(root, ...SHIPPED_LESSONS_REPO_PATH.split('/')));
  });

  it('🔴 misses loudly when the bundles are not there, and the paths it tried are the bug report', () => {
    const resources = nodePath.join(root, 'Contents', 'Resources');
    // The layout a build with a renamed `to` produces: real files, wrong name.
    nodeFs.mkdirSync(nodePath.join(resources, 'lesson-bundles'), { recursive: true });

    const found = resolveShippedLessonsRoot(
      ports({ appPath: `${nodePath.join(resources, 'app.asar')}/`, resourcesPath: resources })
    );
    expect(found.root).toBeNull();
    // A null root with an empty `probed` would be indistinguishable from a resolver that never ran.
    expect(found.probed.length).toBeGreaterThan(0);
    expect(found.probed).toContain(nodePath.join(resources, SHIPPED_LESSONS_DIRNAME));
  });

  it('honours the NODEGX_SHIPPED_LESSONS escape hatch, and probes it first', () => {
    const elsewhere = nodePath.join(root, 'elsewhere');
    nodeFs.mkdirSync(elsewhere, { recursive: true });

    const found = resolveShippedLessonsRoot(ports({ override: elsewhere, resourcesPath: root }));
    expect(found.root).toBe(elsewhere);
    expect(found.probed[0]).toBe(elsewhere);
  });
});
