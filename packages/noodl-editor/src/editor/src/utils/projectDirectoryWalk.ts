/**
 * FB-015 AC3 — which directories the project-file walk is allowed to descend into.
 *
 * `ProjectModel._listFilesInDirectory` recurses through the whole project directory by file
 * extension, and until this module existed it descended into everything — so a project that had
 * ever run `npm install` offered every PNG in every dependency as one of the author's own images.
 * The image picker, the font picker, the file picker and both halves of the import flow all read
 * that walk, so they all listed them.
 *
 * 🔴 **Matched by path SEGMENT, never by substring.** DEP-008 already paid for this lesson in the
 * deploy copy filter: `fullPath.indexOf('.git') !== -1` silently dropped `pre.gitlab-assets/` from
 * every deploy. A directory named `my.node_modules.backup` is the author's, and a file called
 * `node_modules.png` is an image they can pick.
 *
 * ⚠️ Deliberately NOT the deploy matcher (`utils/compilation/build/ignore.ts`). That one is a full
 * gitignore engine, and its defaults exclude `project.json`, `docs/` and a v2 project's
 * `components/` — correct for publishing a build, wrong for "show me my files", where hiding a
 * file the author can see on disk is the defect rather than the feature.
 *
 * @module noodl-editor/utils/projectDirectoryWalk
 */

/** Installed dependencies — not the author's assets, and the reason this module exists. */
const DEPENDENCY_DIRECTORIES = new Set(['node_modules']);

/**
 * Whether the project-file walk should recurse into a directory, given its **name** — not its
 * path. Everything else is descended into, including `noodl_modules`: a project module's files
 * are installed alongside the author's rather than underneath a package manager, and the import
 * flow filters them itself by prefix for its own reasons.
 *
 * Excluded:
 *  - `node_modules` — installed dependencies.
 *  - any dot-prefixed directory — `.git`, `.noodl`, `.vscode`; editor and tooling state, which
 *    is also where the walk previously spent most of its time in a version-controlled project.
 */
export function shouldDescendIntoProjectDirectory(name: string): boolean {
  if (name.startsWith('.')) return false;
  return !DEPENDENCY_DIRECTORIES.has(name);
}
