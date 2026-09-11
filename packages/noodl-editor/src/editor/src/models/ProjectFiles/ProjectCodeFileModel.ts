/**
 * CN-006 — the model behind the editor's first **file-backed** code editor.
 *
 * ## Why this exists at all
 *
 * ✅ **D1** says the "New node kit" command "writes the scaffold and opens
 * `index.js` in the code editor". The editor had no way to honour that
 * literally: its CodeMirror is bound to Function-node **parameters**, and the
 * only precedent for reaching a file was `shell.showItemInFolder` — which hands
 * the author to Finder and a different application. Richard ruled for the real
 * thing, so this is the missing half: a project file, held in the editor, with
 * a save and an honest answer about what is on disk.
 *
 * ## Deliberately the same discipline as `ProjectDocsModel`, for the same reason
 *
 * AIX-009 wrote that discipline down against `docs/*.md`, and every word of its
 * reasoning applies harder to a kit's `index.js`: the author **will** have it
 * open in VS Code at the same time, because that is where they were told to edit
 * it for the whole of this phase.
 *
 * - Every write is optimistic-concurrency checked against the exact bytes the
 *   caller last read (`baseline`). An external edit is refused, never clobbered.
 * - Every write is temp-file + atomic rename, so a crash cannot truncate a file
 *   the runtime is about to execute.
 * - External-edit detection is a **content-comparing poll**, because
 *   `IFileSystem` exposes no watcher and no mtime (`FileStat` is `{ size }`).
 *   Content comparison is exact where a size heuristic is not — and a kit whose
 *   edit changes one character is precisely the case a size check misses.
 *
 * ## What is different, and why
 *
 * `ProjectDocsModel` watches a known folder of known files. This watches
 * **exactly the files someone has opened** — a kit can contain anything, and
 * sweeping a project's `noodl_modules/` on a 2-second timer would read a
 * vendored library's whole bundle over and over for nothing.
 *
 * @module ProjectFiles/ProjectCodeFileModel
 */

import { filesystem } from '@noodl/platform';

import Model from '../../../../shared/model';
import type { ProjectModel } from '../projectmodel';
import { assertInsideProject, writeTextAtomic } from './projectFileIo';

/** How often open files are re-read from disk while anyone is listening. */
const POLL_INTERVAL_MS = 2_000;

/** The one event this model emits; the payload names the changed paths. */
export const CODE_FILES_CHANGED = 'codeFilesChanged';

/** Thrown when a write would overwrite an edit the caller never saw. */
export class CodeFileConflictError extends Error {
  constructor(public readonly path: string, message: string) {
    super(message);
    this.name = 'CodeFileConflictError';
  }
}

/**
 * The code files of one project directory.
 *
 * ⚠️ **A singleton per project, reached through {@link forProject}.** Two
 * instances would each hold their own cache and their own idea of the baseline,
 * so a save made in one would look like an external edit to the other — the
 * conflict dialog firing against yourself. The document surface and the settings
 * panel both open files, which is exactly two callers.
 */
export class ProjectCodeFileModel extends Model {
  readonly projectDir: string;

  /** Last content seen on disk, by project-relative path. */
  private cache = new Map<string, string>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;

  private static current: ProjectCodeFileModel | undefined;

  constructor(projectDir: string) {
    super();
    this.projectDir = projectDir;
  }

  /**
   * The model for the open project, or `undefined` when nothing is open or the
   * project has never been written to disk.
   *
   * Re-created when the project directory changes, so switching projects cannot
   * leave a model pointing at the previous one's files.
   */
  static forProject(project: ProjectModel | undefined): ProjectCodeFileModel | undefined {
    const dir = project?._retainedProjectDirectory;
    if (!dir) return undefined;
    if (!ProjectCodeFileModel.current || ProjectCodeFileModel.current.projectDir !== dir) {
      ProjectCodeFileModel.current?.dispose();
      ProjectCodeFileModel.current = new ProjectCodeFileModel(dir);
    }
    return ProjectCodeFileModel.current;
  }

  /** Absolute path for a project-relative path. Throws for paths outside the project. */
  absolute(relPath: string): string {
    return filesystem.join(this.projectDir, assertInsideProject(relPath));
  }

  exists(relPath: string): boolean {
    return filesystem.exists(this.absolute(relPath));
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /** One file, or `undefined` when it does not exist. */
  async read(relPath: string): Promise<string | undefined> {
    const rel = assertInsideProject(relPath);
    const abs = filesystem.join(this.projectDir, rel);
    if (!filesystem.exists(abs)) {
      this.cache.delete(rel);
      return undefined;
    }
    const text = await filesystem.readFile(abs);
    this.cache.set(rel, text);
    return text;
  }

  /** The last content read for a file, without touching disk. */
  cached(relPath: string): string | undefined {
    return this.cache.get(assertInsideProject(relPath));
  }

  /** Stop watching a file — the editor closing it, so the poll stops reading it. */
  forget(relPath: string): void {
    this.cache.delete(assertInsideProject(relPath));
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /**
   * Replace a file, whole-file. `baseline` is the content the caller last saw;
   * when disk no longer matches it the write is refused with a
   * {@link CodeFileConflictError} and **nothing is touched**, so an edit made in
   * another application is never silently lost.
   *
   * Pass `baseline: undefined` only when the caller genuinely has no prior read.
   */
  async write(relPath: string, content: string, options: { baseline?: string | null } = {}): Promise<void> {
    const rel = assertInsideProject(relPath);
    const abs = filesystem.join(this.projectDir, rel);

    if (options.baseline !== undefined) {
      const current = filesystem.exists(abs) ? await filesystem.readFile(abs) : null;
      if (current !== options.baseline) {
        throw new CodeFileConflictError(
          rel,
          `${rel} changed on disk since it was opened (an external editor, or another agent). ` +
            'Reload it and re-apply the change.'
        );
      }
    }

    await filesystem.makeDirectory(filesystem.dirname(abs));
    await writeTextAtomic(abs, content);
    this.cache.set(rel, content);
    this.notifyListeners(CODE_FILES_CHANGED, { paths: [rel] });
  }

  // ── External-edit watching ──────────────────────────────────────────────────

  /** Start polling the open files for external edits. Idempotent. */
  startWatching(intervalMs = POLL_INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.refresh(), intervalMs);
  }

  stopWatching(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * Re-read every file the cache knows about and notify when any content
   * differs. Safe to call directly as well as from the poll.
   */
  async refresh(): Promise<string[]> {
    if (this.polling) return [];
    this.polling = true;
    try {
      const changed: string[] = [];
      for (const rel of [...this.cache.keys()]) {
        const abs = filesystem.join(this.projectDir, rel);
        const before = this.cache.get(rel);
        let after: string | undefined;
        try {
          after = filesystem.exists(abs) ? await filesystem.readFile(abs) : undefined;
        } catch {
          continue; // mid-write by another process; the next tick sees the result
        }
        if (after === before) continue;
        if (after === undefined) this.cache.delete(rel);
        else this.cache.set(rel, after);
        changed.push(rel);
      }
      if (changed.length > 0) this.notifyListeners(CODE_FILES_CHANGED, { paths: changed });
      return changed;
    } finally {
      this.polling = false;
    }
  }

  dispose(): void {
    this.stopWatching();
    this.cache.clear();
    if (ProjectCodeFileModel.current === this) ProjectCodeFileModel.current = undefined;
  }
}
