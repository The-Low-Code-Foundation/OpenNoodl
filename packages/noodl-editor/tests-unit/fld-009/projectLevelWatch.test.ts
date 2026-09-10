/**
 * FLD-009 — the watcher sees the project-level files at all.
 *
 * 🔴 This is graded FIRST and DIRECTLY, and the task file says why: at HEAD
 * `componentPathFromRelativePath` returned `null` for every path that was not
 * `components/<path>/{component,nodes,connections}.json`, so every downstream
 * assertion about an agent's `nodegx.project.json` write would have passed
 * vacuously on a watcher that saw nothing at all.
 *
 * What these specs cannot see: whether the reload reaches the panels that read
 * project metadata (that is the drive, FLD-009 AC1), and whether the saver's
 * guard holds (that is the Jasmine suite, `projectLevelGuard.test.ts` — it needs
 * the service and its filesystem double).
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  ProjectFileWatcher,
  componentPathFromRelativePath,
  projectLevelFileFromRelativePath,
  type WatchHandle
} from '../../src/editor/src/services/ProjectFileWatcher';

/** Bounds a genuine hang and nothing else — see REL-009b's note on stopwatches. */
const WATCH_EVENT_CEILING_MS = 4000;
const WATCH_TEST_TIMEOUT_MS = 20000;

describe('FLD-009 — mapping a changed file onto a project-level file', () => {
  it('maps each of the three project-level files', () => {
    expect(projectLevelFileFromRelativePath('nodegx.project.json')).toBe('project');
    expect(projectLevelFileFromRelativePath('nodegx.routes.json')).toBe('routes');
    expect(projectLevelFileFromRelativePath('nodegx.styles.json')).toBe('styles');
  });

  // The editor's own project-level write is `writeFileAtomic`: stage `<file>.tmp`,
  // then rename. A watcher that reported the staging file would feed the editor
  // its own saves, and would read a file that may not be complete JSON.
  it("ignores the .tmp staging file the editor's own atomic write leaves", () => {
    expect(projectLevelFileFromRelativePath('nodegx.project.json.tmp')).toBeNull();
    expect(projectLevelFileFromRelativePath('nodegx.styles.json.tmp')).toBeNull();
  });

  it('ignores a same-named file that is not at the project root', () => {
    expect(projectLevelFileFromRelativePath('backup/nodegx.project.json')).toBeNull();
    expect(projectLevelFileFromRelativePath('components/nodegx.project.json')).toBeNull();
  });

  // Not an oversight — `ComponentSaver.updateRegistry` re-reads the registry and
  // merges into it, so an entry an agent added is not lost by our next save.
  it('does not claim the registry, which is merged on write rather than overwritten', () => {
    expect(projectLevelFileFromRelativePath('components/_registry.json')).toBeNull();
  });

  it('leaves the component mapping answering exactly as it did', () => {
    expect(componentPathFromRelativePath('components/Pages/Home/nodes.json')).toBe('Pages/Home');
    expect(componentPathFromRelativePath('nodegx.project.json')).toBeNull();
    expect(componentPathFromRelativePath('components/_registry.json')).toBeNull();
  });
});

describe('FLD-009 — the watcher reports both kinds in one batch', () => {
  function fakeWatch() {
    let emit: (relativePath: string) => void = () => undefined;
    const factory = (_dir: string, onEvent: (relativePath: string) => void): WatchHandle => {
      emit = onEvent;
      return { close: () => undefined };
    };
    return { factory, fire: (p: string) => emit(p) };
  }

  it('separates project-level files from component paths', async () => {
    const w = fakeWatch();
    const watcher = new ProjectFileWatcher({ debounceMs: 5, watchFactory: w.factory });

    const components: string[][] = [];
    const projectLevel: string[][] = [];
    watcher.start('/proj', (c) => components.push(c), (p) => projectLevel.push(p));

    w.fire('nodegx.project.json');
    w.fire('components/Pages/Home/nodes.json');
    w.fire('nodegx.project.json'); // deduplicated
    await new Promise((resolve) => setTimeout(resolve, 40));
    watcher.stop();

    expect(components).toEqual([['Pages/Home']]);
    expect(projectLevel).toEqual([['project']]);
  });

  // The presence control for the negative above: a batch with no project-level
  // file must not call the second callback at all, or "it fired" proves nothing.
  it('does not call the project-level callback for a component-only batch', async () => {
    const w = fakeWatch();
    const watcher = new ProjectFileWatcher({ debounceMs: 5, watchFactory: w.factory });

    const components: string[][] = [];
    const projectLevel: string[][] = [];
    watcher.start('/proj', (c) => components.push(c), (p) => projectLevel.push(p));

    w.fire('components/Header/nodes.json');
    await new Promise((resolve) => setTimeout(resolve, 40));
    watcher.stop();

    expect(components).toEqual([['Header']]);
    expect(projectLevel).toEqual([]);
  });

  it('still works when no project-level callback is given', async () => {
    const w = fakeWatch();
    const watcher = new ProjectFileWatcher({ debounceMs: 5, watchFactory: w.factory });

    const components: string[][] = [];
    watcher.start('/proj', (c) => components.push(c));

    w.fire('nodegx.project.json');
    w.fire('components/Header/nodes.json');
    await new Promise((resolve) => setTimeout(resolve, 40));
    watcher.stop();

    expect(components).toEqual([['Header']]);
  });
});

describe('FLD-009 — against a real filesystem', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fld009-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // 🔴 The mapping above assumes `fs.watch` reports a root-level file as a bare
  // filename. That is an assumption about node, not about us, and the whole
  // feature rests on it.
  it('reports the project file when a real atomic write lands on it', async () => {
    const watcher = new ProjectFileWatcher({ debounceMs: 60 });
    const batches: string[][] = [];

    watcher.start(dir, () => undefined, (files) => batches.push(files));

    // Exactly what ComponentSaver.writeFileAtomic does.
    const target = path.join(dir, 'nodegx.project.json');
    fs.writeFileSync(`${target}.tmp`, JSON.stringify({ name: 'p', metadata: { cloudservices: {} } }));
    fs.renameSync(`${target}.tmp`, target);

    // Wait for the EVENT, never for a stopwatch (REL-009b's note).
    const deadline = Date.now() + WATCH_EVENT_CEILING_MS;
    while (batches.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const arrivedWithinCeiling = batches.length > 0;

    await new Promise((resolve) => setTimeout(resolve, 200));
    watcher.stop();

    // Every assertion after stop(), so a failure cannot leak the fs.watch handle
    // and hang `test:main` for everybody.
    expect(arrivedWithinCeiling).toBe(true);
    expect(batches.flat()).toContain('project');
    expect(batches.flat().every((f) => f === 'project')).toBe(true);
  }, WATCH_TEST_TIMEOUT_MS);
});
