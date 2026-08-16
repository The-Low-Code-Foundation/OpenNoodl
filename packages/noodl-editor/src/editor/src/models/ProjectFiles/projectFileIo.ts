/**
 * The file-handling primitives shared by every model that owns a project file.
 *
 * These three functions were private to `ProjectDocsModel` (AIX-009). CN-006's
 * editor half needs exactly the same three for a kit's `index.js`, and a second
 * copy of "temp file, then rename" is the kind of duplication that stays right
 * for about a month. So they moved here and `ProjectDocsModel` imports them —
 * one implementation, two owners, no behaviour change.
 *
 * ⚠️ **Deliberately not a general filesystem layer.** `@noodl/platform`'s
 * `filesystem` is that. This is the narrow set of operations that make a file
 * *safe to hold open in an editor*: write without the chance of truncation, and
 * decide whether a path is inside the project at all.
 *
 * @module ProjectFiles/projectFileIo
 */

import { filesystem } from '@noodl/platform';

/**
 * Temp file + rename, mirroring `writeJsonAtomic` in the MCP `ProjectStore` and
 * `filesystem.writeJson`. A file half-written by a crash is a file the next
 * reader — the runtime, an agent, or the author — takes as gospel.
 */
export async function writeTextAtomic(absPath: string, content: string): Promise<void> {
  const tmp = `${absPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await filesystem.writeFile(tmp, content);
  try {
    await filesystem.renameFile(tmp, absPath);
  } catch (error) {
    try {
      await filesystem.removeFile(tmp);
    } catch {
      /* the rename failure is the interesting one */
    }
    throw error;
  }
}

/** Absolute → project-relative with forward slashes, or undefined when outside. */
export function toProjectRelative(projectDir: string, fullPath: string): string | undefined {
  const root = projectDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const p = fullPath.replace(/\\/g, '/');
  if (!p.startsWith(`${root}/`)) return undefined;
  return p.slice(root.length + 1);
}

/**
 * Normalise a project-relative path, refusing anything that escapes the project.
 *
 * ⚠️ **Checks the segments, not the joined result.** `resolveKitName` in
 * `@nodegx/kit-scaffold` carries the same warning for the same reason: a check
 * applied after normalisation can be talked out of a traversal by a slug step,
 * so `..` is rejected as a path *segment* before anything is joined.
 *
 * @throws when the path is absolute, empty, or contains a `..` segment
 */
export function assertInsideProject(relPath: string): string {
  const raw = String(relPath ?? '').trim();
  if (!raw) throw new Error('A project-relative file path is required.');

  const normalised = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalised.startsWith('/') || /^[A-Za-z]:/.test(normalised)) {
    throw new Error(`"${relPath}" is an absolute path; project files are addressed relative to the project.`);
  }

  const segments = normalised.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new Error(`"${relPath}" points outside the project.`);
  }

  return segments.filter((segment) => segment !== '' && segment !== '.').join('/');
}
