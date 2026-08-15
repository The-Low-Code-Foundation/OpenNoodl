/**
 * UNI-010 — reading a bundle off disk.
 *
 * Thin by design, and tested anyway for one reason: this is the layer where the
 * solution either arrives or silently does not, and a bundle read without one
 * scores three classes as `not-checked` while still looking like a successful
 * read. The tests below are mostly about that sentence being said out loud.
 */

import { MANIFEST_FILE, SOLUTION_DIR, readLessonBundle, readLessonProject } from '../../src/editor/src/models/lessonbundleread';
import type { LessonBundleFs } from '../../src/editor/src/models/lessonbundleread';

// ─── A filesystem made of a plain object ────────────────────────────────────

function fakeFs(files: Record<string, unknown>): LessonBundleFs {
  return {
    exists: (p) => p in files || Object.keys(files).some((f) => f.startsWith(`${p}/`)),
    readJsonFile: (p) => files[p],
    join: (...parts) => parts.join('/')
  };
}

function projectFiles(prefix: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [`${prefix}/components/_registry.json`]: { components: { App: { path: 'App' } } },
    [`${prefix}/components/App/component.json`]: { id: 'app', name: 'App', path: '/App', type: 'visual' },
    [`${prefix}/components/App/nodes.json`]: {
      componentId: 'app',
      nodes: [{ id: 'text-1', type: 'Text', label: 'Greeting' }]
    },
    [`${prefix}/components/App/connections.json`]: { componentId: 'app', connections: [] },
    [`${prefix}/nodegx.project.json`]: { rootNodeId: 'text-1', metadata: { appConfig: { runtime: 'react19' } } },
    ...extra
  };
}

const MANIFEST = { title: 'A lesson', steps: [{ title: 'Do a thing', completeWhen: [{ node: '/App:#Greeting', exists: true }] }] };

// ─── Reading a project ──────────────────────────────────────────────────────

describe('readLessonProject', () => {
  it('reads the registry, the components and the project-level facts', () => {
    const source = readLessonProject('bundle', fakeFs(projectFiles('bundle')));

    expect(source?.components).toHaveLength(1);
    expect(source?.components[0].component.path).toBe('/App');
    expect(source?.rootNodeId).toBe('text-1');
    expect(source?.metadata).toEqual({ appConfig: { runtime: 'react19' } });
  });

  it('is undefined for a directory that is not a v2 project', () => {
    expect(readLessonProject('bundle', fakeFs({ 'bundle/lesson.json': MANIFEST }))).toBeUndefined();
  });

  it('tolerates a component missing its files rather than throwing', () => {
    const files = projectFiles('bundle');
    delete files['bundle/components/App/nodes.json'];
    delete files['bundle/components/App/connections.json'];

    // A machine wrote this bundle. A reader that throws makes its caller guess.
    const source = readLessonProject('bundle', fakeFs(files));
    expect(source?.components[0].nodes.nodes).toEqual([]);
  });
});

// ─── Reading a bundle ───────────────────────────────────────────────────────

describe('readLessonBundle', () => {
  it('reads manifest, starter and solution when all three are there', () => {
    const files = {
      ...projectFiles('bundle'),
      ...projectFiles(`bundle/${SOLUTION_DIR}`),
      [`bundle/${MANIFEST_FILE}`]: MANIFEST
    };

    const bundle = readLessonBundle('bundle', fakeFs(files));

    expect(bundle.manifest?.title).toBe('A lesson');
    expect(bundle.starter).toBeDefined();
    expect(bundle.solution).toBeDefined();
    expect(bundle.problems).toEqual([]);
  });

  it('says out loud that a bundle with no solution leaves three classes unchecked', () => {
    const bundle = readLessonBundle('bundle', fakeFs({ ...projectFiles('bundle'), [`bundle/${MANIFEST_FILE}`]: MANIFEST }));

    expect(bundle.solution).toBeUndefined();
    expect(bundle.problems.join('\n')).toMatch(/carries no solution/);
    // 🔴 And it still returns the manifest and starter. Refusing to read is a
    // policy decision, and it is the caller's — a curated bundle legitimately
    // has no solution.
    expect(bundle.manifest).toBeDefined();
    expect(bundle.starter).toBeDefined();
  });

  it('reports a missing manifest and a missing project separately', () => {
    const bundle = readLessonBundle('bundle', fakeFs({ 'bundle/something.txt': 1 }));

    expect(bundle.problems.join('\n')).toMatch(new RegExp(MANIFEST_FILE));
    expect(bundle.problems.join('\n')).toMatch(/nothing for a learner to open/);
  });

  it('reports a path that is not there at all', () => {
    expect(readLessonBundle('nowhere', fakeFs({})).problems).toEqual([
      'There is no lesson bundle at nowhere.'
    ]);
  });
});
