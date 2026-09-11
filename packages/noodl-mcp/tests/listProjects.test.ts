/**
 * BST-006 §4 — `list_projects`, against a synthetic user-data directory.
 *
 * The tool itself reads whatever this machine has, which is right for the
 * product and useless as a spec, so the scan is exported and tested against
 * fixtures. `bootstrap.test.ts` covers the tool end to end for shape.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { scanRecentProjects, userDataCandidates } from '../src/tools/listProjects';

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A directory `ProjectStore` would accept. */
function v2Project(root: string, name: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'components'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'nodegx.project.json'), '{}');
  return dir;
}

/** A pre-migration project: the thing the launcher remembers and this server cannot open. */
function legacyProject(root: string, name: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'project.json'), '{}');
  return dir;
}

function writeStore(userData: string, rows: unknown[]): string {
  fs.mkdirSync(userData, { recursive: true });
  const file = path.join(userData, 'recently_opened_project.json');
  fs.writeFileSync(file, JSON.stringify({ recentProjects: rows }, null, 2));
  return file;
}

describe('BST-006 — reading the launcher’s recent-projects list', () => {
  it('reports what exists, marks legacy, and drops what is gone', () => {
    const projects = tmp('bst-projects-');
    const userData = tmp('bst-userdata-');
    const live = v2Project(projects, 'Reading List');
    const old = legacyProject(projects, 'Old App');
    const unrecognised = path.join(projects, 'Just A Folder');
    fs.mkdirSync(unrecognised);

    writeStore(userData, [
      { retainedProjectDirectory: live, name: 'Reading List', latestAccessed: 3000 },
      { retainedProjectDirectory: old, name: 'Old App', latestAccessed: 2000 },
      { retainedProjectDirectory: unrecognised, name: 'Just A Folder', latestAccessed: 1000 },
      { retainedProjectDirectory: path.join(projects, 'Deleted'), name: 'Deleted', latestAccessed: 4000 }
    ]);

    const result = scanRecentProjects([userData]);

    // ⚠️ Verified before reported: `LocalProjectsModel.fetch()` filters to
    // folders that still exist for exactly this reason, and a tool that reports
    // a deleted directory sends an agent to open nothing.
    expect(result.projects.map((p) => p.name)).toEqual(['Reading List', 'Old App', 'Just A Folder']);
    expect(result.missing).toBe(1);

    // ⚠️ Legacy is marked, not dropped. It is a project the user has and this
    // server cannot open, and an omission reads as "you have never built
    // anything" — the answer that produces a duplicate.
    expect(result.projects.map((p) => p.format)).toEqual(['v2', 'legacy', 'unrecognised']);
  });

  it('sorts newest first and carries the access time as ISO', () => {
    const projects = tmp('bst-projects-');
    const userData = tmp('bst-userdata-');
    const a = v2Project(projects, 'Older');
    const b = v2Project(projects, 'Newer');
    writeStore(userData, [
      { retainedProjectDirectory: a, name: 'Older', latestAccessed: 1000 },
      { retainedProjectDirectory: b, name: 'Newer', latestAccessed: 9000 }
    ]);

    const result = scanRecentProjects([userData]);
    expect(result.projects.map((p) => p.name)).toEqual(['Newer', 'Older']);
    expect(result.projects[0].lastOpened).toBe(new Date(9000).toISOString());
  });

  it('never returns the stored thumbnail', () => {
    // Each row in the store carries a base64 PNG. A dozen of them is roughly a
    // megabyte of tokens for a picture nothing in this loop can look at.
    const projects = tmp('bst-projects-');
    const userData = tmp('bst-userdata-');
    const dir = v2Project(projects, 'Thumbed');
    writeStore(userData, [
      { retainedProjectDirectory: dir, name: 'Thumbed', latestAccessed: 1, thumbURI: 'data:image/png;base64,AAAA' }
    ]);
    expect(JSON.stringify(scanRecentProjects([userData]))).not.toContain('base64');
  });

  it('merges several product-name directories, newest wins per directory', () => {
    // A user upgrading from an OpenNoodl build has a live editor writing to the
    // old user-data directory, and "you have no projects" would be a much worse
    // answer than one extra existsSync.
    const projects = tmp('bst-projects-');
    const current = tmp('bst-userdata-new-');
    const previous = tmp('bst-userdata-old-');
    const shared = v2Project(projects, 'Shared');
    const onlyOld = v2Project(projects, 'Only Old');
    writeStore(current, [{ retainedProjectDirectory: shared, name: 'Shared', latestAccessed: 5000 }]);
    writeStore(previous, [
      { retainedProjectDirectory: shared, name: 'Shared (stale name)', latestAccessed: 1 },
      { retainedProjectDirectory: onlyOld, name: 'Only Old', latestAccessed: 4000 }
    ]);

    const result = scanRecentProjects([current, previous]);
    expect(result.projects.map((p) => p.name)).toEqual(['Shared', 'Only Old']);
  });

  it('an absent store is an empty answer, not an error', () => {
    // ⚠️ A machine where NodeGX has never run has no file at all. Throwing here
    // would turn "you are new" into "something is broken".
    const result = scanRecentProjects([tmp('bst-empty-userdata-')]);
    expect(result.projects).toEqual([]);
    expect(result.missing).toBe(0);
    expect(result.searched).toHaveLength(1);
    expect(result.searched[0]).toContain('recently_opened_project.json');
  });

  it('a corrupt store is an empty answer too', () => {
    const userData = tmp('bst-corrupt-');
    fs.writeFileSync(path.join(userData, 'recently_opened_project.json'), 'not json at all');
    expect(scanRecentProjects([userData]).projects).toEqual([]);
  });

  it('never writes to the store file', () => {
    // ⚠️ The editor owns that file and rewrites it wholesale from its in-memory
    // model. A server writing there races the editor and loses, and what it
    // loses is the user's project list.
    const projects = tmp('bst-projects-');
    const userData = tmp('bst-userdata-');
    const dir = v2Project(projects, 'Untouched');
    const file = writeStore(userData, [{ retainedProjectDirectory: dir, name: 'Untouched', latestAccessed: 1 }]);
    const before = fs.readFileSync(file, 'utf8');
    const stat = fs.statSync(file);

    scanRecentProjects([userData]);

    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(fs.statSync(file).mtimeMs).toBe(stat.mtimeMs);
    expect(fs.readdirSync(userData)).toEqual(['recently_opened_project.json']);
  });

  it('looks in the product-name directory the editor actually writes to', () => {
    // ⚠️ Electron names the directory after `app.getName()` — `productName` from
    // noodl-editor/package.json, which is NodeGX, not the npm name. Getting this
    // wrong produces "no projects" on a machine where the file is sitting right
    // there. Mirrored in nodegx-observe/src/token.ts; if a product name is added,
    // add it in both.
    const candidates = userDataCandidates();
    expect(candidates[0]).toContain('NodeGX');
    expect(candidates.some((c) => c.includes('OpenNoodl'))).toBe(true);
  });
});
