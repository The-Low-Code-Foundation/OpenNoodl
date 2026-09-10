/**
 * FLD-009 — the project-level half of the "an agent wrote it, the editor kept it"
 * guarantee.
 *
 * REL-009a/REL-009b gave *component* files a three-hash decision, a re-read
 * before every write and a refusal the user is told about. Project-level files
 * had none of it: `saveProjectLevelFiles` compared only against its own
 * in-memory hashes and wrote unconditionally when its own copy moved, and
 * `componentPathFromRelativePath` returned `null` for every one of them, so the
 * watcher never saw them either. The MCP server writes `nodegx.project.json`
 * through three methods (`writeDesignTokens`, `writeProjectSettings`,
 * `writeCloudServices`), so a backend binding or a design-token block written by
 * an agent was reverted by the editor's next project-level save with nothing
 * reported to either side.
 *
 * 🔴 **The measurement that shaped this, 2026-09-10, against HEAD.** The
 * sequence in FLD-009's AC1 — agent binds a backend, person touches a
 * *component*, autosave fires — does **not** lose the binding: the project-level
 * content built from memory is unchanged, so the save skips the file entirely.
 * The loss needs a project-level change in the editor. `rootNodeId` moving (set
 * a component as the app root) reverted both a `cloudservices` binding and a
 * `designTokens` block in the same save. So the trigger is *any* editor change
 * to a project-level file while an agent's change to it is unread — not autosave
 * as such.
 *
 * This module holds the pure parts, for the same reason `decide.ts` does: they
 * are the whole judgement, and everything around them needs a filesystem.
 *
 * @module noodl-editor/services/ProjectStructure/projectLevel
 */

import type { LegacyProject } from '../../io/ProjectExporter';

import { stableStringify, hashString } from './ComponentSaver';

/** Project-level file identities tracked for change detection. */
export type ProjectLevelKey = 'project' | 'routes' | 'styles';

export const PROJECT_LEVEL_KEYS: readonly ProjectLevelKey[] = ['project', 'routes', 'styles'];

/**
 * Content hash of one project-level file, ignoring the volatile `modified`
 * field so the editor's own timestamp is not mistaken for someone else's write.
 * `null` (the file is absent, and legitimately so) hashes to `'absent'`.
 */
export function hashProjectLevel(content: unknown): string {
  if (content === null || content === undefined) return 'absent';
  const { modified: _m, ...rest } = content as Record<string, unknown>;
  return hashString(stableStringify(rest));
}

/** What to do about a project-level file that just changed on disk. */
export type ProjectLevelReloadDecision =
  | { action: 'reload' }
  | { action: 'skip-unchanged' }
  | { action: 'refuse-dirty' };

/**
 * Decides what a change to one project-level file means.
 *
 * ⚠️ **This deliberately takes a boolean where `decideComponentReload` takes a
 * third hash, and that is not laziness.** A component is compared in one space:
 * the disk copy is loaded back through the importer, so `hashComponent` of the
 * in-memory copy and of the disk copy are the same quantity. A project-level
 * file is not — what the editor holds is a `LegacyProject`, what is on disk is
 * an exported file, and the export is lossy in both directions (the project file
 * drops `metadata.styles` and array-shaped `metadata.routes` into their own
 * files). So "has the disk moved" is asked in *disk* space and "does the person
 * have unsaved changes" in *built* space, and forcing them into one signature
 * would mean one of the two comparisons was between two different things.
 *
 * The order matches `decideComponentReload` and for the same reason: our own
 * write coming back through the watcher must not raise a conflict warning.
 */
export function decideProjectLevelReload(args: {
  /** Hash of the file as we last read or wrote it. `undefined` — never seen. */
  diskBaselineHash: string | undefined;
  /** Hash of the file as it is on disk right now. */
  diskHash: string;
  /** Does the editor hold unsaved changes to this file's content? */
  dirty: boolean;
}): ProjectLevelReloadDecision {
  const { diskBaselineHash, diskHash, dirty } = args;

  // Nothing new on disk: our own write echoing back. Checked first.
  if (diskBaselineHash !== undefined && diskHash === diskBaselineHash) {
    return { action: 'skip-unchanged' };
  }

  // We have never seen this file, so there is nothing of ours to lose.
  if (diskBaselineHash === undefined) {
    return { action: 'reload' };
  }

  if (dirty) return { action: 'refuse-dirty' };

  return { action: 'reload' };
}

/**
 * The project-level fields each file owns.
 *
 * 🔴 **This list is the reverse of `ProjectExporter`'s split and has to stay
 * that way.** `buildProjectV2File` deletes `metadata.styles` and array-shaped
 * `metadata.routes` before writing, because they have their own files; so
 * adopting a fresh `nodegx.project.json` must *not* touch the in-memory copies
 * of those two, and adopting a fresh routes or styles file must touch nothing
 * else. Applying a whole reconstructed project instead would overwrite an
 * unsaved colour edit with the disk copy the moment an agent wrote an unrelated
 * backend binding — the same data loss this task exists to stop, wearing the
 * other face.
 */
const PROJECT_FILE_FIELDS = [
  'name',
  'version',
  'id',
  'runtimeVersion',
  'rootNodeId',
  'lesson',
  'thumbnailURI',
  'settings'
] as const;

/** The subset of a project this module writes onto — `ProjectModel` satisfies it. */
export interface ProjectLevelTarget {
  metadata?: Record<string, unknown>;
  variants?: unknown[];
  [key: string]: unknown;
}

/**
 * Copies the fields owned by one project-level file from `slice` (a project
 * reconstructed from the files on disk) onto `target`, and leaves every other
 * field alone.
 */
export function applyProjectLevelSlice(
  target: ProjectLevelTarget,
  slice: LegacyProject,
  key: ProjectLevelKey
): void {
  const sliceMetadata = (slice.metadata ?? {}) as Record<string, unknown>;

  if (key === 'project') {
    for (const field of PROJECT_FILE_FIELDS) {
      const value = (slice as unknown as Record<string, unknown>)[field];
      if (value !== undefined) target[field] = value;
    }
    // `settings` is indexed directly by four read sites and the panel crashes on
    // undefined (POL-001), so absent means empty, not missing.
    if (slice.settings === undefined) target.settings = {};

    const kept = (target.metadata ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...sliceMetadata };
    delete next.styles;
    delete next.routes;
    if (kept.styles !== undefined) next.styles = kept.styles;
    if (kept.routes !== undefined) next.routes = kept.routes;
    target.metadata = next;
    return;
  }

  if (!target.metadata) target.metadata = {};

  if (key === 'routes') {
    if (sliceMetadata.routes !== undefined) {
      target.metadata.routes = sliceMetadata.routes;
    } else {
      delete target.metadata.routes;
    }
    return;
  }

  // styles — the file also carries the variants.
  if (sliceMetadata.styles !== undefined) {
    target.metadata.styles = sliceMetadata.styles;
  } else {
    delete target.metadata.styles;
  }
  target.variants = slice.variants ?? [];
}
