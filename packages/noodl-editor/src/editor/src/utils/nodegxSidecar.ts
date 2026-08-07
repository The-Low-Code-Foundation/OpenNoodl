/**
 * `<project>/.nodegx/` — the editor's own scratch directory inside a project.
 *
 * Two stores keep local, per-machine state next to a project rather than inside
 * it: code snapshots (CED-001) and an unapplied AI build (AIB-003 slice 4).
 * Neither belongs to a collaborator, neither may reach a deploy, and both need
 * the same two things to be true of the directory they write to — it exists, and
 * git ignores it. `compilation/build/ignore.ts` already excludes `.nodegx/` from
 * the deploy walk; this is the other half.
 *
 * It lives here rather than staying private to `CodeHistoryStore` because a
 * second copy of "make sure `.nodegx/` is gitignored" is a copy that eventually
 * disagrees with the first, and the failure mode of disagreeing is a scratch
 * directory committed to somebody's repository.
 *
 * Everything is best-effort by design. A project with no directory on disk yet,
 * a read-only checkout or an unwritable `.gitignore` degrades to "no sidecar",
 * never to a failed save of the user's actual work.
 *
 * @module utils/nodegxSidecar
 */

import { filesystem } from '@noodl/platform';

export const SIDECAR_DIR = '.nodegx';

/** Directories whose `.gitignore` has already been checked this session. */
const checked = new Set<string>();

/** A path inside a project's sidecar directory. */
export function sidecarPath(projectDirectory: string, ...parts: string[]): string {
  return filesystem.join(projectDirectory, SIDECAR_DIR, ...parts);
}

/**
 * Create a directory inside the sidecar, and make sure git ignores the whole of
 * `.nodegx/`. Returns the directory, or `undefined` if it could not be made —
 * callers treat that as "no sidecar this session" and carry on.
 */
export async function ensureSidecarDirectory(
  projectDirectory: string,
  ...parts: string[]
): Promise<string | undefined> {
  try {
    // Created one level at a time: `makeDirectory` is not recursive on every
    // platform implementation, and `.nodegx/plan` is two levels on first write.
    let current = filesystem.join(projectDirectory, SIDECAR_DIR);
    if (!filesystem.exists(current)) await filesystem.makeDirectory(current);
    for (const part of parts) {
      current = filesystem.join(current, part);
      if (!filesystem.exists(current)) await filesystem.makeDirectory(current);
    }
    await ensureIgnored(projectDirectory);
    return current;
  } catch (error) {
    console.warn(`Could not create ${SIDECAR_DIR}/ in the project:`, error);
    return undefined;
  }
}

/**
 * Append `.nodegx/` to the project's `.gitignore` if it is not already ignored.
 * Never rewrites what is there — this file belongs to the user.
 */
export async function ensureIgnored(projectDirectory: string): Promise<void> {
  if (checked.has(projectDirectory)) return;
  checked.add(projectDirectory);

  const path = filesystem.join(projectDirectory, '.gitignore');
  const entry = `${SIDECAR_DIR}/`;

  try {
    const current = filesystem.exists(path) ? await filesystem.readFile(path) : '';

    const alreadyIgnored = current.split(/\r?\n/).some((line) => line.trim() === entry || line.trim() === SIDECAR_DIR);
    if (alreadyIgnored) return;

    const separator = current.length === 0 || current.endsWith('\n') ? '' : '\n';
    await filesystem.writeFileOverride(path, `${current}${separator}${entry}\n`);
  } catch (error) {
    console.warn(`Could not add ${SIDECAR_DIR}/ to .gitignore:`, error);
  }
}
