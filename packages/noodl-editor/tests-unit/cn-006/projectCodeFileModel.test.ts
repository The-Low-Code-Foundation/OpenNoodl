/**
 * CN-006 — the model behind D1's in-app code editor.
 *
 * The property that matters is not "it can read and write a file". It is that
 * **neither side of a concurrent edit is silently lost** — the author has the
 * kit open in the editor *and* in VS Code, because that is where this whole
 * phase told them to edit it.
 *
 * There are two halves to that and guarding only one just picks who loses:
 *
 * - the **poll** notices an external edit, and does not clobber an unsaved
 *   buffer with it (the document's half, graded here through the event);
 * - the **write** is baseline-checked, so a save made against stale bytes is
 *   refused rather than winning by being last.
 *
 * ⚠️ Every test runs against a real temp directory through a real `fs` — see
 * `testFileSystem`. The behaviour under test *is* filesystem behaviour.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { installTestFileSystem } from './testFileSystem';

installTestFileSystem();

import {
  CODE_FILES_CHANGED,
  CodeFileConflictError,
  ProjectCodeFileModel
} from '../../src/editor/src/models/ProjectFiles/ProjectCodeFileModel';

const REL = 'noodl_modules/weather-kit/index.js';

let dir: string;
let model: ProjectCodeFileModel;

function absolute(rel: string) {
  return path.join(dir, ...rel.split('/'));
}

function writeOnDisk(rel: string, content: string) {
  const abs = absolute(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn006-model-'));
  model = new ProjectCodeFileModel(dir);
});

afterEach(() => {
  model.dispose();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('reading', () => {
  test('reads a file and caches what it saw', async () => {
    writeOnDisk(REL, 'const a = 1;');
    expect(await model.read(REL)).toBe('const a = 1;');
    expect(model.cached(REL)).toBe('const a = 1;');
  });

  test('a missing file reads as undefined, distinguishably from an empty one', async () => {
    expect(await model.read(REL)).toBeUndefined();
    writeOnDisk(REL, '');
    expect(await model.read(REL)).toBe('');
  });

  test('refuses a path outside the project', async () => {
    await expect(model.read('../escape.js')).rejects.toThrow(/outside the project/);
  });
});

describe('writing', () => {
  test('creates the directory and the file', async () => {
    await model.write(REL, 'const a = 1;', { baseline: null });
    expect(fs.readFileSync(absolute(REL), 'utf8')).toBe('const a = 1;');
  });

  test('replaces content when the baseline still matches disk', async () => {
    writeOnDisk(REL, 'before');
    const baseline = await model.read(REL);
    await model.write(REL, 'after', { baseline });
    expect(fs.readFileSync(absolute(REL), 'utf8')).toBe('after');
  });

  test('🔴 refuses — and changes nothing — when disk moved under the baseline', async () => {
    writeOnDisk(REL, 'before');
    const baseline = await model.read(REL);

    // Somebody else's editor saves while ours is open.
    writeOnDisk(REL, 'their edit');

    await expect(model.write(REL, 'my edit', { baseline })).rejects.toThrow(CodeFileConflictError);

    // The refusal has to be *total*. A guard that throws after writing would
    // pass a `rejects.toThrow` and still have destroyed their work.
    expect(fs.readFileSync(absolute(REL), 'utf8')).toBe('their edit');
  });

  test('the control: with no baseline the same write is allowed', async () => {
    // Otherwise the test above cannot tell "the conflict check fired" from
    // "writing is broken".
    writeOnDisk(REL, 'before');
    await model.read(REL);
    writeOnDisk(REL, 'their edit');

    await model.write(REL, 'my edit', {});
    expect(fs.readFileSync(absolute(REL), 'utf8')).toBe('my edit');
  });

  test('emits a change naming the path it wrote', async () => {
    const seen: string[][] = [];
    model.on(CODE_FILES_CHANGED, ({ paths }: { paths: string[] }) => seen.push(paths), 'test');
    await model.write(REL, 'x', { baseline: null });
    expect(seen).toEqual([[REL]]);
  });
});

describe('noticing an external edit', () => {
  test('refresh reports a file whose content changed', async () => {
    writeOnDisk(REL, 'before');
    await model.read(REL);

    writeOnDisk(REL, 'after');
    expect(await model.refresh()).toEqual([REL]);
    expect(model.cached(REL)).toBe('after');
  });

  test('and says nothing when the content is identical', async () => {
    writeOnDisk(REL, 'same');
    await model.read(REL);
    // Rewritten on disk — same bytes, new mtime. A watcher keyed on mtime or
    // size would raise a false alarm here and pop the conflict notice at an
    // author who did nothing; content comparison is exact.
    writeOnDisk(REL, 'same');
    expect(await model.refresh()).toEqual([]);
  });

  test('reports a deletion as a change, and forgets the content', async () => {
    writeOnDisk(REL, 'before');
    await model.read(REL);
    fs.rmSync(absolute(REL));
    expect(await model.refresh()).toEqual([REL]);
    expect(model.cached(REL)).toBeUndefined();
  });

  test('🔴 watches only opened files — a forgotten file is not polled', async () => {
    writeOnDisk(REL, 'before');
    await model.read(REL);
    model.forget(REL);

    writeOnDisk(REL, 'after');
    // Not "no change" — no longer watched at all. This is what stops a closed
    // document costing a disk read every two seconds for the rest of a session.
    expect(await model.refresh()).toEqual([]);
  });
});

describe('the per-project instance', () => {
  test('is reused for the same directory and replaced for a different one', () => {
    const a = ProjectCodeFileModel.forProject({ _retainedProjectDirectory: dir } as never);
    const b = ProjectCodeFileModel.forProject({ _retainedProjectDirectory: dir } as never);
    expect(b).toBe(a);

    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'cn006-other-'));
    try {
      const c = ProjectCodeFileModel.forProject({ _retainedProjectDirectory: other } as never);
      // Two live models over one project would each hold their own baseline, so
      // a save in one would read as an external edit in the other — the conflict
      // notice firing against yourself.
      expect(c).not.toBe(a);
      c?.dispose();
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  test('is undefined when no project is open', () => {
    expect(ProjectCodeFileModel.forProject(undefined)).toBeUndefined();
    expect(ProjectCodeFileModel.forProject({} as never)).toBeUndefined();
  });
});
