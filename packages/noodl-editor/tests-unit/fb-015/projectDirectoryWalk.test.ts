/**
 * FB-015 AC3 — the project-file walk stops at installed dependencies and tooling state.
 *
 * ⚠️ This grades the predicate, not the recursion. That `_listFilesInDirectory` asks it is a
 * one-line call in `projectmodel.ts`, which needs Electron and cannot be loaded here; the mutation
 * that removes the call is caught by the drive, where a project with a `node_modules` full of PNGs
 * either lists them or does not.
 */
import { shouldDescendIntoProjectDirectory } from '../../src/editor/src/utils/projectDirectoryWalk';

describe('FB-015 AC3 — which directories the walk descends into', () => {
  it('skips installed dependencies', () => {
    expect(shouldDescendIntoProjectDirectory('node_modules')).toBe(false);
  });

  it('skips dot-prefixed tooling directories', () => {
    expect(shouldDescendIntoProjectDirectory('.git')).toBe(false);
    expect(shouldDescendIntoProjectDirectory('.noodl')).toBe(false);
    expect(shouldDescendIntoProjectDirectory('.vscode')).toBe(false);
  });

  /**
   * 🔴 The half that makes this a fix rather than a new bug. DEP-008 paid for this lesson once
   * already: `fullPath.indexOf('.git') !== -1` silently dropped `pre.gitlab-assets/` from every
   * deploy. Matching by segment name means a folder that merely *contains* one of these words is
   * still the author's.
   */
  it('descends into the author\u2019s own folders, including ones whose names contain the excluded words', () => {
    expect(shouldDescendIntoProjectDirectory('assets')).toBe(true);
    expect(shouldDescendIntoProjectDirectory('images')).toBe(true);
    expect(shouldDescendIntoProjectDirectory('my.node_modules.backup')).toBe(true);
    expect(shouldDescendIntoProjectDirectory('node_modules_old')).toBe(true);
    expect(shouldDescendIntoProjectDirectory('pre.gitlab-assets')).toBe(true);
  });

  /** `noodl_modules` holds project modules the author installed on purpose and can pick from. */
  it('still descends into noodl_modules', () => {
    expect(shouldDescendIntoProjectDirectory('noodl_modules')).toBe(true);
  });
});
