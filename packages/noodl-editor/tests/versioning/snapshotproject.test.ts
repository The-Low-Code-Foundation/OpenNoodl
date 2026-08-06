/**
 * Reading a project out of a git snapshot, in either on-disk format.
 *
 * The version-control panel diffs *projects*, not files: it reconstructs the
 * legacy in-memory shape at two points in history and compares the graphs. When
 * new projects became decomposed (v2) by default, that reconstruction stopped
 * being a single `JSON.parse` of one blob — and until it was taught the second
 * format, every new project's diff came back empty, which reads as "nothing
 * changed" rather than as a failure.
 *
 * These specs use the same fixture pair the import engine uses: `import_proj_v2`
 * is a decomposition of `import_proj1`, so the two formats must reconstruct to
 * projects that diff as identical.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { SnapshotEntry } from '@noodl/git/src/core/models/snapshot';

import { isProjectSourceFile } from '../../src/editor/src/views/panels/VersionControlPanel/context/DiffUtils';
import { readProjectFromSnapshot } from '../../src/editor/src/views/panels/VersionControlPanel/context/snapshotProject';

const TESTFS = path.join(process.cwd(), 'tests/testfs');

/**
 * A snapshot backed by a directory on disk. `getFileAsString` reproduces git's
 * behaviour for the case that matters here: a path that is not in the snapshot
 * rejects, it does not resolve to undefined.
 */
function snapshotOfDirectory(dir: string, root = ''): SnapshotEntry {
  return {
    sha: 'fixture',
    author: null,
    async getFileAsString(name: string) {
      const full = path.join(dir, name);
      if (!fs.existsSync(full)) {
        throw new Error(`fatal: path '${name}' exists on disk, but not in 'fixture'`);
      }
      return fs.readFileSync(full, 'utf8');
    },
    async getFiles() {
      return [];
    }
  } as unknown as SnapshotEntry;
}

describe('reading a project from a git snapshot', () => {
  it('reconstructs a v2 project from its decomposed files', async () => {
    const project = await readProjectFromSnapshot(snapshotOfDirectory(path.join(TESTFS, 'import_proj_v2')), '');

    expect(Array.isArray(project.components)).toBe(true);
    expect(project.components.length).toBeGreaterThan(0);
  });

  it('reads a legacy project from its single file', async () => {
    const project = await readProjectFromSnapshot(snapshotOfDirectory(path.join(TESTFS, 'import_proj1')), '');

    expect(Array.isArray(project.components)).toBe(true);
    expect(project.components.length).toBeGreaterThan(0);
  });

  it('reconstructs the same component set from either format', async () => {
    // The whole point: a diff must not report every component as added or
    // removed simply because the two commits were written in different formats.
    const [legacy, v2] = await Promise.all([
      readProjectFromSnapshot(snapshotOfDirectory(path.join(TESTFS, 'import_proj1')), ''),
      readProjectFromSnapshot(snapshotOfDirectory(path.join(TESTFS, 'import_proj_v2')), '')
    ]);

    const names = (p: TSFixme) => p.components.map((c: TSFixme) => c.name).sort();
    expect(names(v2)).toEqual(names(legacy));
  });

  it('reads a project that lives in a subdirectory of the repository', async () => {
    const project = await readProjectFromSnapshot(snapshotOfDirectory(TESTFS), 'import_proj_v2');

    expect(project.components.length).toBeGreaterThan(0);
  });

  it('rejects when the snapshot holds no project in either format', async () => {
    let threw = false;
    try {
      await readProjectFromSnapshot(snapshotOfDirectory(TESTFS), 'no-such-project');
    } catch {
      threw = true;
    }
    // The callers render "no diff available" from this. Resolving with an empty
    // project instead would render as "the user deleted everything".
    expect(threw).toBe(true);
  });
});

describe('which repository paths count as project source', () => {
  it('covers both formats project-level files', () => {
    expect(isProjectSourceFile('project.json')).toBe(true);
    expect(isProjectSourceFile('nodegx.project.json')).toBe(true);
    expect(isProjectSourceFile('nodegx.routes.json')).toBe(true);
    expect(isProjectSourceFile('nodegx.styles.json')).toBe(true);
  });

  it('covers per-component files and the registry', () => {
    expect(isProjectSourceFile('components/_registry.json')).toBe(true);
    expect(isProjectSourceFile('components/App/nodes.json')).toBe(true);
    expect(isProjectSourceFile('components/__page__/Home/connections.json')).toBe(true);
    expect(isProjectSourceFile('components/Deeply/Nested/Thing/component.json')).toBe(true);
  });

  it('finds them under a project nested in the repository', () => {
    expect(isProjectSourceFile('apps/web/components/App/nodes.json')).toBe(true);
    expect(isProjectSourceFile('apps/web/nodegx.project.json')).toBe(true);
  });

  it('leaves the user their own files', () => {
    expect(isProjectSourceFile('README.md')).toBe(false);
    expect(isProjectSourceFile('assets/logo.png')).toBe(false);
    expect(isProjectSourceFile('noodl_modules/thing/manifest.json')).toBe(false);
  });

  it('does not claim a legacy asset folder that happens to be called components', () => {
    // `components/` is only project source when the files inside it are the v2
    // per-component trio. A legacy project may keep anything under that name.
    expect(isProjectSourceFile('components/logo.svg')).toBe(false);
    expect(isProjectSourceFile('components/data.json')).toBe(false);
  });

  it('does not claim a stray nodes.json outside a components directory', () => {
    expect(isProjectSourceFile('nodes.json')).toBe(false);
    expect(isProjectSourceFile('data/nodes.json')).toBe(false);
  });
});
