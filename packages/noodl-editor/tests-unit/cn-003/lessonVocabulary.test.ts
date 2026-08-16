/**
 * CN-003 slice 4 — which catalog answers a lesson's questions.
 *
 * ## The three vocabularies, and why guessing between them is the whole risk
 *
 * After slice 3 the editor holds two catalogs that differ by the open project's
 * kits, and a lesson can be asked about from three positions:
 *
 *  - **the open project** — grading a learner, or verifying a lesson about the
 *    project on screen. `projectLessonVocabulary()`.
 *  - **a bundle on disk** — the install gate, which runs *before* anyone opens
 *    the bundle. `bundleLessonVocabulary()`, from that bundle's own files.
 *  - **neither** — `defaultLessonVocabulary()`, shipped catalog only.
 *
 * 🔴 **Picking the wrong one is invisible.** A bundle checked against the open
 * project's vocabulary produces a *plausible* answer about the wrong kit, and it
 * does so only when a project happens to be open — so the same bundle installs
 * or is refused depending on what is on screen. That is what this file grades,
 * and every claim in it is paired with the control that makes it attributable.
 *
 * ⚠️ **Measured before any of this was built** (2026-08-16), against the code as
 * slice 3 left it:
 *
 * | | then | now |
 * |---|---|---|
 * | a lesson naming the OPEN project's kit node, `gradeLesson(verify)` | `unknown-node-type` **error** | clean |
 * | a bundle's node ports, with a kit project open | **the open project's kit** | the bundle's own, or none |
 * | a bundle carrying the kit it teaches, at install | refused: *"is not a node type"* | refused, and it says **why it cannot tell** |
 *
 * The third row is deliberately still a refusal. ✅ **D4** was ruled against
 * quiet downgrades, so slice 4 fixes the *claim*, not the verdict — whether an
 * unresolvable kit type should block install at all is a scope question on
 * Richard's desk, not something to settle by loosening a test.
 */

import { LearningFolderModel } from '../../src/editor/src/models/learningfolder';
import type { LearningFolderFs, LearningFolderStore } from '../../src/editor/src/models/learningfolder';
import { gradeLesson } from '../../src/editor/src/models/lessongrading';
import {
  bundleLessonVocabulary,
  defaultLessonVocabulary,
  projectLessonVocabulary,
  verifyLessonManifest
} from '../../src/editor/src/models/lessonverify';
import { setCatalogOverlay } from '../../src/editor/src/validation/catalog';
import { overlayFromNodeLibrary } from '../../src/editor/src/validation/kitOverlay';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import type { LessonEvalContext } from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** A kit node type in the shape `generateNodeLibrary` exports. */
function kitNodeType(name: string, moduleName: string, portNames: string[]) {
  return {
    name,
    displayNodeName: name.split('.').pop(),
    module: moduleName,
    category: 'Visual',
    ports: portNames.map((p) => ({ name: p, type: 'string', plug: 'input' }))
  };
}

/** What the OPEN project's viewer sent: a Badge with a `label` port. */
const OPEN_PROJECT = { nodetypes: [kitNodeType('demo.kit.Badge', 'Demo Kit', ['label'])] };

/** A different project's kit, used to prove the vocabulary is not sticky. */
const OTHER_PROJECT = { nodetypes: [kitNodeType('other.kit.Gauge', 'Other Kit', ['value'])] };

function openProject(payload: { nodetypes: unknown[] }): void {
  setCatalogOverlay(overlayFromNodeLibrary(payload as never).nodes);
}

/** A lesson whose one condition names `typeName`. */
function lessonNaming(typeName: string): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title: `Use the ${typeName}`,
    steps: [{ title: 'Add one', completeWhen: [{ node: `App:%${typeName}`, exists: true }] }]
  } as LessonManifest;
}

const EMPTY_CONTEXT = { components: [] } as unknown as LessonEvalContext;

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

  /**
   * 🔴 Registers **every** ancestor, not just the immediate parent. A real
   * filesystem answers `exists()` for an intermediate directory, and the first
   * version of this fake did not — which silently skipped the `noodl_modules/`
   * detection this file grades, and made a broken build look green.
   */
  writeFile(path: string, contents: string): void {
    this.files.set(path, contents);
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'));
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
  join(...parts: string[]): string {
    return parts.join('/');
  }
}

interface BundleOptions {
  /** The type the lesson's condition names, and the type the solution places. */
  typeName: string;
  /** Write a `noodl_modules/` — i.e. this bundle ships the kit it teaches. */
  carriesKit: boolean;
  /** An extra condition on the solution's node, for the F2 replay. */
  hasPort?: string;
}

function writeBundle(fs: FakeFs, dir: string, options: BundleOptions): void {
  const w = (p: string, v: unknown) => fs.writeFile(`${dir}/${p}`, JSON.stringify(v));

  // 🔴 `/App`, not `App`. A condition's first segment is matched against the
  // component's **legacy name**, which `reconstructLegacyComponent` writes with
  // the leading slash — and a path that cannot match makes every condition read
  // false, which is indistinguishable from the defect this file is grading. The
  // first draft of this fixture used `App:` and was green against a *restored*
  // leak: it measured nothing. (`lessonprojectcontext`'s header warns about
  // exactly this; it costs a test its meaning as easily as it costs a lesson.)
  const completeWhen: unknown[] = [{ node: `/App:%${options.typeName}`, exists: true }];
  if (options.hasPort) completeWhen.push({ node: `/App:%${options.typeName}`, hasPort: options.hasPort });

  w('lesson.json', {
    format: 'noodl-lesson@1',
    title: 'A lesson about a kit node',
    steps: [{ title: 'Add one', completeWhen }]
  });
  w('nodegx.project.json', { rootNodeId: 'app' });

  if (options.carriesKit) {
    w('noodl_modules/bundle-kit/manifest.json', { name: 'Bundle Kit', main: 'index.js', runtimes: ['browser'] });
    fs.writeFile(`${dir}/noodl_modules/bundle-kit/index.js`, '// the kit, which nothing here executes');
  }

  // The starter is empty; the solution places the node the lesson asks for.
  for (const root of ['', 'solution/']) {
    w(`${root}components/_registry.json`, { components: { App: { path: 'App' } } });
    w(`${root}components/App/component.json`, { id: 'App', name: 'App', type: 'visual' });
    w(`${root}components/App/connections.json`, { componentId: 'App', connections: [] });
    w(`${root}components/App/nodes.json`, {
      componentId: 'App',
      nodes: root ? [{ id: 'n1', type: options.typeName, parameters: {} }] : []
    });
  }
  w('solution/nodegx.project.json', { rootNodeId: 'app' });
}

function installBundle(options: BundleOptions) {
  const fs = new FakeFs();
  writeBundle(fs, '/bundles/lesson', options);
  const model = new LearningFolderModel({
    store: new FakeStore(),
    fs,
    root: '/data/Learning',
    now: () => '2026-08-16T00:00:00.000Z'
  });
  return model.install({ bundleDir: '/bundles/lesson', provenance: 'curated' });
}

afterEach(() => setCatalogOverlay([]));

// ─── The open project ───────────────────────────────────────────────────────

describe('a lesson about the OPEN project’s own kit node', () => {
  it('verifies clean, where before slice 4 it was refused as a typo', async () => {
    openProject(OPEN_PROJECT);

    const grade = await gradeLesson(lessonNaming('demo.kit.Badge'), EMPTY_CONTEXT, { verify: true });
    expect(grade.verification?.findings).toEqual([]);
    expect(grade.verification?.ok).toBe(true);
  });

  it('…and is refused again with no project open — the control that makes that attributable', async () => {
    // Without this half, the test above would also pass against a catalog that
    // had always carried `demo.kit.Badge`, and would be grading nothing.
    setCatalogOverlay([]);

    const grade = await gradeLesson(lessonNaming('demo.kit.Badge'), EMPTY_CONTEXT, { verify: true });
    expect(grade.verification?.findings.map((f) => f.code)).toEqual(['unknown-node-type']);
  });

  it('follows the project, rather than memoising the first one opened', () => {
    // The trap the generation counter exists for, one layer up: a vocabulary
    // cached across a project switch answers about the project you closed.
    openProject(OPEN_PROJECT);
    expect(verifyLessonManifest(lessonNaming('demo.kit.Badge'), { vocabulary: projectLessonVocabulary() }).ok).toBe(
      true
    );

    openProject(OTHER_PROJECT);
    const now = projectLessonVocabulary();
    expect(verifyLessonManifest(lessonNaming('other.kit.Gauge'), { vocabulary: now }).ok).toBe(true);
    expect(verifyLessonManifest(lessonNaming('demo.kit.Badge'), { vocabulary: now }).ok).toBe(false);
  });

  it('does not leak the project’s kits into the shipped vocabulary', () => {
    openProject(OPEN_PROJECT);
    const shipped = defaultLessonVocabulary();
    expect(shipped.classifyTypeName('demo.kit.Badge').code).toBe('unknown-node-type');
    expect(shipped.isIncomplete).toBe(false);
  });
});

// ─── A bundle is not the open project ───────────────────────────────────────

describe('installing a bundle while a kit project is open', () => {
  it('does not let the open project’s kit vouch for the bundle', async () => {
    openProject(OPEN_PROJECT);

    // The bundle teaches `demo.kit.Badge` and does not ship a kit. The open
    // project declares exactly that type — and must not answer for it.
    const outcome = await installBundle({ typeName: 'demo.kit.Badge', carriesKit: false });
    expect(outcome.result).toBe('rejected');
  });

  it('does not answer a bundle node’s ports from the open project’s kit', async () => {
    // 🔴 The F2 half, and the one that was live between slices 3 and 4:
    // `buildLessonEvalContext` defaults its catalog to the *overlaid* index, so
    // a `hasPort` condition over a bundle's kit node was answered by whatever
    // kit happened to be open. The open project's Badge declares `label`; the
    // bundle's files declare no port at all. Borrowing makes F2 **pass** on a
    // port the bundle never had — measured at 2026-08-16, both arms.
    openProject(OPEN_PROJECT);

    const outcome = await installBundle({ typeName: 'demo.kit.Badge', carriesKit: true, hasPort: 'label' });
    expect(outcome.scorecard?.classes.F2).toBe('fail');
  });

  it('reaches the same verdict with nothing open at all', async () => {
    // The property that matters more than either verdict: **the answer does not
    // depend on what is on screen.** This is the assertion that catches the leak
    // by its shape rather than by its symptom — restore the default catalog in
    // `contextFor` and these two arms disagree on F2.
    setCatalogOverlay([]);
    const closed = await installBundle({ typeName: 'demo.kit.Badge', carriesKit: true, hasPort: 'label' });

    openProject(OPEN_PROJECT);
    const open = await installBundle({ typeName: 'demo.kit.Badge', carriesKit: true, hasPort: 'label' });

    expect(open.result).toBe(closed.result);
    expect(open.scorecard?.classes).toEqual(closed.scorecard?.classes);
  });
});

// ─── The refusal says what it could not read ────────────────────────────────

describe('a bundle that ships the kit it teaches', () => {
  it('is refused with a message that says the kit could not be read', async () => {
    const outcome = await installBundle({ typeName: 'bundle.kit.Badge', carriesKit: true });

    expect(outcome.result).toBe('rejected');
    const message = outcome.verification?.findings[0]?.message ?? '';
    expect(message).toContain('carries at least one node kit whose node types could not be read here');
    // ✅ D4: the verdict is unchanged. Only the claim was wrong before.
    expect(outcome.verification?.findings[0]?.severity).toBe('error');
  });

  it('…while a bundle with no kit gets the flat answer — the control for that caveat', async () => {
    // Without this half the caveat could be unconditional boilerplate appended
    // to every refusal, which would say nothing about anything.
    const outcome = await installBundle({ typeName: 'bundle.kit.Badge', carriesKit: false });

    expect(outcome.result).toBe('rejected');
    const message = outcome.verification?.findings[0]?.message ?? '';
    expect(message).toContain('is not a node type or a display name in the catalog');
    expect(message).not.toContain('could not be read here');
  });
});

// ─── The bundle's own kits, when a caller can read them ─────────────────────

describe('bundleLessonVocabulary — the MCP route’s half', () => {
  const BUNDLE_KIT = overlayFromNodeLibrary({
    nodetypes: [kitNodeType('bundle.kit.Badge', 'Bundle Kit', ['caption'])]
  } as never).nodes;

  it('resolves the bundle’s own kit types', () => {
    const vocabulary = bundleLessonVocabulary(BUNDLE_KIT);
    expect(verifyLessonManifest(lessonNaming('bundle.kit.Badge'), { vocabulary }).ok).toBe(true);
    expect(vocabulary.isIncomplete).toBe(false);
  });

  it('is built from the bundle alone, whatever project is open', () => {
    openProject(OPEN_PROJECT);
    const vocabulary = bundleLessonVocabulary(BUNDLE_KIT);

    expect(verifyLessonManifest(lessonNaming('bundle.kit.Badge'), { vocabulary }).ok).toBe(true);
    // The open project's Badge is not the bundle's business.
    expect(vocabulary.classifyTypeName('demo.kit.Badge').code).toBe('unknown-node-type');
  });

  it('reports partial knowledge as partial, never as an answer', () => {
    // 🔴 CN-002's lesson: an extractor that failed produces an empty node list,
    // which is indistinguishable from a bundle with no kits unless the
    // difference is carried. `[]` with `unresolved` is that difference.
    const cannotTell = bundleLessonVocabulary([], { where: 'This bundle', reason: 'the extractor is not built' });

    expect(cannotTell.isIncomplete).toBe(true);
    const verdict = cannotTell.classifyTypeName('bundle.kit.Badge');
    expect(verdict.code).toBe('unknown-node-type');
    expect(verdict.severity).toBe('error');
    expect(verdict.message).toContain('the extractor is not built');
  });
});
