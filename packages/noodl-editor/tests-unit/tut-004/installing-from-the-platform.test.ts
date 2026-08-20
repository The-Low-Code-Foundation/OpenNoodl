/**
 * TUT-004 — one click from the community panel.
 *
 * 🔴 **THE ACs THIS FILE HOLDS, AND WHY EACH IS SHARP.**
 *
 *  - **AC2** — `source: {kind:'platform', url}`. That arm of `LearningSource` has been declared
 *    and *unconstructed* since UNI-007: two test files and nothing in `packages/**`. A type that
 *    compiles is not a path that runs, so this asserts the value on the entry rather than the
 *    shape of the union.
 *  - **AC3** — the scorecard is shown BEFORE the bundle lands. The test does not check that
 *    `confirm` was called; it checks what the Learning folder contained *at the moment it was
 *    called*. "Called first" and "called before anything was written" are different claims and
 *    only the second one is the criterion.
 *  - **AC4** — a refused bundle writes nothing to Learning. Staging is a different directory on
 *    purpose, so this asserts both: nothing in Learning, and no staging left behind either.
 *  - **AC5** — reset re-pulls, and a reset that cannot reach the network leaves the installed
 *    copy standing. 🔴 The failing arm is the older one: `'unavailable'` used to mean "we have
 *    no way to fetch this" and now means "we tried", which is a different fact with the same
 *    name.
 *  - **AC7** — offline says the network, not the tutorial.
 *
 * ⚠️ **The register here is the REAL `LearningFolderModel`**, not a double. The whole task is
 * that the install mechanism already exists; a fake register would test that this file can call
 * a thing rather than that the thing does what the ACs say.
 */

import { LearningFolderModel } from '../../src/editor/src/models/learningfolder';
import type { LearningFolderFs, LearningFolderStore } from '../../src/editor/src/models/learningfolder';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import type { NodeV2 } from '../../src/editor/src/schemas';
import type { Read, TutorialBundlePayload } from '../../src/editor/src/models/community/communityapi';
import {
  PLATFORM_PROVENANCE,
  installTutorialFromPlatform,
  resetLessonFromPlatform,
  slugFromBundleUrl,
  stageBundleFiles
} from '../../src/editor/src/models/lessonplatforminstall';
import type { PlatformInstallDeps, PlatformSource, StagingFs } from '../../src/editor/src/models/lessonplatforminstall';

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

class FakeFs implements LearningFolderFs, StagingFs {
  files = new Map<string, string>();
  dirs = new Set<string>();

  writeFile(path: string, contents: string): void {
    this.files.set(path, contents);
    let parent = path.slice(0, path.lastIndexOf('/'));
    while (parent) {
      this.dirs.add(parent);
      parent = parent.slice(0, parent.lastIndexOf('/'));
    }
  }
  writeJson(path: string, data: unknown): void {
    this.writeFile(path, JSON.stringify(data));
  }
  exists(path: string): boolean {
    return this.dirs.has(path) || this.files.has(path);
  }
  makeDirectory(path: string): void {
    this.dirs.add(path);
  }
  removeDirectoryRecursive(path: string): void {
    for (const p of [...this.files.keys()]) if (p === path || p.startsWith(path + '/')) this.files.delete(p);
    for (const d of [...this.dirs]) if (d === path || d.startsWith(path + '/')) this.dirs.delete(d);
  }
  copyRecursive(from: string, to: string): void {
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
    this.writeFile(path, JSON.stringify(data, null, 2));
  }
  join(...parts: string[]): string {
    return parts.join('/');
  }
  dirname(path: string): string {
    const i = path.lastIndexOf('/');
    return i <= 0 ? '' : path.slice(0, i);
  }

  /** Every path under a directory, so a test can say "nothing landed here". */
  under(prefix: string): string[] {
    return [...this.files.keys()].filter((p) => p.startsWith(prefix + '/')).sort();
  }
}

const LEARNING = '/data/Learning';
const STAGING = '/data/staging';

// ─── Bundle fixtures, as files on the wire rather than as a directory ───────

function projectFiles(prefix: string, nodes: NodeV2[]): Record<string, string> {
  const at = (p: string) => (prefix ? `${prefix}/${p}` : p);
  return {
    [at('components/_registry.json')]: JSON.stringify({ components: { '__page__/Home': { path: '__page__/Home' } } }),
    [at('components/__page__/Home/component.json')]: JSON.stringify({
      id: 'home',
      name: 'Home',
      path: '/#__page__/Home',
      type: 'visual'
    }),
    [at('components/__page__/Home/nodes.json')]: JSON.stringify({ componentId: 'home', nodes }),
    [at('components/__page__/Home/connections.json')]: JSON.stringify({ componentId: 'home', connections: [] }),
    [at('nodegx.project.json')]: JSON.stringify({ name: 'Put some text on the page', rootNodeId: 'page-1' })
  };
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

function bundlePayload(over: { manifest?: LessonManifest; withSolution?: boolean } = {}): TutorialBundlePayload {
  const manifest = over.manifest ?? lesson();
  return {
    slug: 'put-some-text',
    title: manifest.title ?? 'Put some text on the page',
    version: 1,
    updatedAt: '2026-08-20T10:00:00.000Z',
    files: {
      'lesson.json': JSON.stringify(manifest),
      ...projectFiles('', EMPTY_PAGE),
      ...(over.withSolution === false ? {} : projectFiles('solution', PAGE_WITH_TEXT))
    }
  };
}

// ─── The harness ────────────────────────────────────────────────────────────

const BUNDLE_URL = 'https://community.nodegx.io/api/v1/community/tutorials/put-some-text/bundle';

class FakeSource implements PlatformSource {
  calls = 0;
  constructor(private answer: () => Read<TutorialBundlePayload>) {}
  async tutorialBundle(): Promise<Read<TutorialBundlePayload>> {
    this.calls += 1;
    return this.answer();
  }
  tutorialBundleUrl(slug: string): string {
    return `https://community.nodegx.io/api/v1/community/tutorials/${slug}/bundle`;
  }
}

let clock = 0;
function harness(answer: () => Read<TutorialBundlePayload>) {
  clock = 0;
  let mints = 0;
  const fs = new FakeFs();
  const register = new LearningFolderModel({
    store: new FakeStore(),
    fs,
    root: LEARNING,
    now: () => `2026-08-20T00:00:${String(clock++).padStart(2, '0')}.000Z`,
    newProjectId: () => `minted-${++mints}`
  });
  const source = new FakeSource(answer);
  const deps: PlatformInstallDeps = { register, source, fs, stagingRoot: STAGING };
  return { fs, register, source, deps };
}

const ok = (value: TutorialBundlePayload): Read<TutorialBundlePayload> => ({ outcome: 'ok', value });

// ─── AC2 — the arm that has never been constructed ──────────────────────────

describe('installing a community tutorial in one action', () => {
  it('🔴 AC2 — records source {kind: platform, url}, and the url names the tutorial', async () => {
    const { deps, fs } = harness(() => ok(bundlePayload()));

    const outcome = await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;
    expect(outcome.entry.source).toEqual({ kind: 'platform', url: BUNDLE_URL });
    // Round-trips: an entry that cannot say which tutorial it is cannot be reset.
    const source = outcome.entry.source;
    if (source.kind !== 'platform') throw new Error('expected a platform source');
    expect(slugFromBundleUrl(source.url)).toBe('put-some-text');
    // And the files really landed in Learning, not just in staging.
    expect(fs.exists(`${LEARNING}/put-some-text-on-the-page/lesson.json`)).toBe(true);
  });

  it('installs as `curated` — R2, answered', async () => {
    const { deps } = harness(() => ok(bundlePayload()));
    const outcome = await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);
    if (outcome.result !== 'installed') throw new Error('expected an install');
    expect(outcome.entry.provenance).toBe('curated');
    expect(PLATFORM_PROVENANCE).toBe('curated');
  });

  it('🔴 a manifest claiming `authoredBy: ai` is held to the STRICTER gate anyway', async () => {
    // The asymmetry `lessoninstallpolicy` defends: a claim may only ever cost the claimant.
    // TUT-003's bundle declares exactly this, so it is the first real case.
    const { deps } = harness(() => ok(bundlePayload({ manifest: lesson({ authoredBy: 'ai' }) })));

    const outcome = await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);

    expect(outcome.result).toBe('installed');
    if (outcome.result !== 'installed') return;
    expect(outcome.entry.provenance).toBe('local-ai');
    expect(outcome.scorecard.classes).toMatchObject({ F1: 'pass', F2: 'pass', F3: 'pass' });
  });

  it('removes the staging directory on success — a second copy of every lesson is not a feature', async () => {
    const { deps, fs } = harness(() => ok(bundlePayload()));
    await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);
    expect(fs.under(STAGING)).toEqual([]);
  });

  it('gives the installed copy a project id of its own, not the bundle&apos;s', async () => {
    const { deps, fs } = harness(() => ok(bundlePayload()));
    await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);
    const project = fs.readJsonFile(`${LEARNING}/put-some-text-on-the-page/nodegx.project.json`) as { id?: string };
    expect(project.id).toBe('minted-1');
  });
});

// ─── AC3 — shown BEFORE it lands ────────────────────────────────────────────

describe('what the scorecard checked is shown before the bundle lands', () => {
  it('🔴 AC3 — at the moment confirm is called, the Learning folder is still empty', async () => {
    const { deps, fs } = harness(() => ok(bundlePayload()));
    let learningAtConfirmTime: string[] | undefined;
    let seen: { checked: string; provenance: string } | undefined;

    const outcome = await installTutorialFromPlatform(
      {
        slug: 'put-some-text',
        confirm: (preview) => {
          // 🔴 The criterion is not "confirm ran first" — it is that nothing had landed yet.
          learningAtConfirmTime = fs.under(LEARNING);
          seen = { checked: preview.checked, provenance: preview.provenance };
          return true;
        }
      },
      deps
    );

    expect(outcome.result).toBe('installed');
    expect(learningAtConfirmTime).toEqual([]);
    // And it names what was NOT checked as well as what passed — F4 is unanswerable here.
    expect(seen?.checked).toMatch(/Checked as curated: F1/);
    expect(seen?.checked).toMatch(/not checked/);
    expect(seen?.provenance).toBe('curated');
  });

  it('a person who says no gets `cancelled`, and nothing is installed or left behind', async () => {
    const { deps, fs, register } = harness(() => ok(bundlePayload()));

    const outcome = await installTutorialFromPlatform({ slug: 'put-some-text', confirm: () => false }, deps);

    expect(outcome.result).toBe('cancelled');
    expect(fs.under(LEARNING)).toEqual([]);
    expect(fs.under(STAGING)).toEqual([]);
    expect(register.list()).toEqual([]);
  });

  it('installs without asking when no confirm is supplied — absence is not a refusal', async () => {
    const { deps } = harness(() => ok(bundlePayload()));
    expect((await installTutorialFromPlatform({ slug: 'put-some-text' }, deps)).result).toBe('installed');
  });
});

// ─── AC4 — a refused bundle ─────────────────────────────────────────────────

describe('a bundle the harness refuses is refused here too', () => {
  it('🔴 AC4 — writes NOTHING to the Learning folder, and leaves no staging behind', async () => {
    // A condition in the prose vocabulary: the learner could never be told they finished.
    const refused = bundlePayload({
      manifest: lesson({
        steps: [{ title: 'Add a Repeater', completeWhen: [{ node: 'App:%Repeater', exists: true }] }]
      })
    });
    const { deps, fs, register } = harness(() => ok(refused));

    const outcome = await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);

    expect(outcome.result).toBe('refused');
    if (outcome.result !== 'refused') return;
    expect(outcome.reason).toBeTruthy();
    expect(fs.under(LEARNING)).toEqual([]);
    expect(fs.under(STAGING)).toEqual([]);
    expect(register.list()).toEqual([]);
  });

  it('never asks a person to confirm a bundle that was already refused', async () => {
    const refused = bundlePayload({
      manifest: lesson({ steps: [{ title: 'x', completeWhen: [{ node: 'App:%Repeater', exists: true }] }] })
    });
    let asked = false;
    const { deps } = harness(() => ok(refused));

    await installTutorialFromPlatform({ slug: 'put-some-text', confirm: () => ((asked = true), true) }, deps);

    expect(asked).toBe(false);
  });
});

// ─── AC7 — offline says the network ─────────────────────────────────────────

describe('offline, and the difference between a network and a tutorial', () => {
  it('🔴 AC7 — an unreachable platform says the community could not be reached', async () => {
    const { deps, fs } = harness(() => ({ outcome: 'unreachable', status: null, detail: 'getaddrinfo ENOTFOUND' }));

    const outcome = await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);

    expect(outcome.result).toBe('offline');
    if (outcome.result !== 'offline') return;
    expect(outcome.reason).toMatch(/could not be reached/);
    expect(outcome.reason).toMatch(/put-some-text/);
    expect(fs.under(LEARNING)).toEqual([]);
  });

  it('🔴 a tutorial with no bundle is `unavailable`, NOT offline — opposite fixes', async () => {
    // ✅ Read against the control above: the same call, one different answer from the platform,
    // two different outcomes. Without the pair, "unavailable" could be the only thing this
    // function ever produces.
    const { deps } = harness(() => ({ outcome: 'absent' }));

    const outcome = await installTutorialFromPlatform({ slug: 'put-some-text' }, deps);

    expect(outcome.result).toBe('unavailable');
    if (outcome.result !== 'unavailable') return;
    expect(outcome.reason).toMatch(/nothing to install/i);
  });
});

// ─── AC5 — reset, both arms ─────────────────────────────────────────────────

describe('reset re-pulls a platform lesson', () => {
  async function installed() {
    let answer: () => Read<TutorialBundlePayload> = () => ok(bundlePayload());
    const h = harness(() => answer());
    await installTutorialFromPlatform({ slug: 'put-some-text' }, h.deps);
    return { ...h, setAnswer: (a: () => Read<TutorialBundlePayload>) => (answer = a) };
  }

  it('🔴 AC5 — re-pulls a clean copy, clearing progress and keeping the project identity', async () => {
    const { deps, fs, register, source } = await installed();
    const id = 'put-some-text-on-the-page';
    register.recordProgress(id, { stepIndex: 1, stepCount: 2 });
    fs.writeFile(`${LEARNING}/${id}/scribble.json`, 'the learner&apos;s work');
    const idBefore = (fs.readJsonFile(`${LEARNING}/${id}/nodegx.project.json`) as { id: string }).id;

    const outcome = await resetLessonFromPlatform(id, deps);

    expect(outcome.result).toBe('reset');
    expect(source.calls).toBe(2); // it really went back to the platform
    expect(fs.exists(`${LEARNING}/${id}/scribble.json`)).toBe(false);
    expect(register.get(id)?.progress).toBeUndefined();
    // 🔴 The identity SURVIVES: a new id on every reset would orphan the lesson's backend.
    expect((fs.readJsonFile(`${LEARNING}/${id}/nodegx.project.json`) as { id: string }).id).toBe(idBefore);
    expect(fs.under(STAGING)).toEqual([]);
  });

  it('🔴 AC5 — a reset that cannot reach the network leaves the installed copy standing', async () => {
    const { deps, fs, register, setAnswer } = await installed();
    const id = 'put-some-text-on-the-page';
    register.recordProgress(id, { stepIndex: 1, stepCount: 2 });
    fs.writeFile(`${LEARNING}/${id}/scribble.json`, 'the learner&apos;s work');
    setAnswer(() => ({ outcome: 'unreachable', status: null, detail: 'ENOTFOUND' }));

    const outcome = await resetLessonFromPlatform(id, deps);

    expect(outcome.result).toBe('unavailable');
    if (outcome.result !== 'unavailable') return;
    expect(outcome.reason).toMatch(/Nothing was changed/);
    // ✅ The half that matters: the work is still there and so is the progress.
    expect(fs.exists(`${LEARNING}/${id}/scribble.json`)).toBe(true);
    expect(register.get(id)?.progress).toEqual({ stepIndex: 1, stepCount: 2 });
  });

  it('refuses to re-pull a lesson that did not come from the platform', async () => {
    const { deps, register, fs } = harness(() => ok(bundlePayload()));
    fs.writeFile('/bundles/local/lesson.json', JSON.stringify(lesson()));
    for (const [p, c] of Object.entries(projectFiles('', EMPTY_PAGE))) fs.writeFile(`/bundles/local/${p}`, c);
    await register.install({ bundleDir: '/bundles/local', provenance: 'local' });

    const outcome = await resetLessonFromPlatform('put-some-text-on-the-page', deps);
    expect(outcome.result).toBe('unavailable');
  });

  it('says so, rather than guessing, when the recorded url is not one this editor wrote', async () => {
    const { deps, register, fs } = harness(() => ok(bundlePayload()));
    for (const [p, c] of Object.entries(bundlePayload().files)) fs.writeFile(`/bundles/x/${p}`, c);
    await register.install({
      bundleDir: '/bundles/x',
      provenance: 'curated',
      source: { kind: 'platform', url: 'https://example.com/some/other/shape' }
    });

    const outcome = await resetLessonFromPlatform('put-some-text-on-the-page', deps);
    expect(outcome.result).toBe('unavailable');
    if (outcome.result !== 'unavailable') return;
    expect(outcome.reason).toMatch(/cannot re-pull/);
  });
});

// ─── The small pieces ───────────────────────────────────────────────────────

describe('slugFromBundleUrl', () => {
  it('reads the slug this editor writes', () => {
    expect(slugFromBundleUrl(BUNDLE_URL)).toBe('put-some-text');
  });
  it('decodes an escaped slug', () => {
    expect(
      slugFromBundleUrl('https://c.io/api/v1/community/tutorials/a%2Fb/bundle')
    ).toBe('a/b');
  });
  it.each([
    'https://example.com/lessons/groups',
    'https://c.io/api/v1/community/tutorials//bundle',
    'https://c.io/api/v1/community/tutorials/x',
    ''
  ])('returns undefined for %s rather than guessing', (url) => {
    expect(slugFromBundleUrl(url)).toBeUndefined();
  });
});

describe('staging a bundle', () => {
  it('makes parent directories for nested entries', () => {
    const fs = new FakeFs();
    stageBundleFiles({ 'a/b/c.json': '{}', 'top.json': '1' }, { fs, directory: '/s/x' });
    expect(fs.files.get('/s/x/a/b/c.json')).toBe('{}');
    expect(fs.files.get('/s/x/top.json')).toBe('1');
  });

  it('replaces a stale staging directory rather than merging into it', () => {
    const fs = new FakeFs();
    fs.writeFile('/s/x/leftover.json', 'old');
    stageBundleFiles({ 'lesson.json': '{}' }, { fs, directory: '/s/x' });
    expect(fs.exists('/s/x/leftover.json')).toBe(false);
  });
});
