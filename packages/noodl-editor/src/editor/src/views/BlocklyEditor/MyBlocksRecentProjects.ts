/**
 * VFN-010 — reading the launcher's recent projects, so `myblocks/` does not have to.
 *
 * The same split `MyBlocksProjectScan.ts` makes for a live project, made again for projects on
 * disk: this file owns the read and no rules, `myblocks/projectFile.ts` owns the format and no I/O,
 * and `myblocks/crossProjectUsage.ts` owns the counting and neither. That is what keeps the count
 * in the launcher's warning and the refusal in `remove` gradeable in a plain-Node runner.
 *
 * ## 🔴 What the recent list is, and is not
 *
 * `LocalProjectsModel` is a record of folders this editor has opened. It is **not** an inventory of
 * everywhere a backpack block is used, and nothing here pretends otherwise: every project that is
 * read is recorded in `scanned`, every project that is not is recorded in `unreadable` with a
 * reason, and `libraryIntent.ts` says both out loud. A count presented as a total when it is a
 * sample is a warning that teaches the builder to distrust warnings.
 *
 * ⚠️ **This is I/O in a dialog.** N projects × one directory walk each. It runs behind an explicit
 * *"Check where this is used"* action and on the delete path, never on render — which is VFN-010's
 * own instruction and the reason `CrossProjectUsage` carries a timestamp.
 *
 * @module BlocklyEditor
 */

import { filesystem } from '@noodl/platform';

import { LocalProjectsModel } from '@noodl-utils/LocalProjectsModel';
import {
  crossProjectUsage,
  type CrossProjectUsage,
  type ProjectSnapshot,
  type UnreadableProject
} from './myblocks/crossProjectUsage';
import { scanFromLegacyProject, scanFromV2Components, type V2ComponentFiles } from './myblocks/projectFile';

/** The two files a project root can be. v2 first: it is the default format for a new project. */
const V2_PROJECT_FILE = 'nodegx.project.json';
const LEGACY_PROJECT_FILE = 'project.json';
const V2_COMPONENTS_DIR = 'components';
const V2_NODES_FILE = 'nodes.json';
const V2_COMPONENT_FILE = 'component.json';

/** One entry of the recent-projects list, as far as this file cares. */
export interface RecentProjectEntry {
  id?: string;
  name: string;
  directory: string;
}

/**
 * The launcher's recent projects.
 *
 * A folder that no longer exists is dropped rather than reported: `LocalProjectsModel.fetch`
 * already filters those out of the list the builder sees, and reporting a project the launcher is
 * not showing as "could not be read" would name something that is not on screen.
 */
export function recentProjects(model = LocalProjectsModel.instance): RecentProjectEntry[] {
  const entries = model?.getProjects?.() ?? [];
  return entries
    .filter((entry) => !!entry?.retainedProjectDirectory)
    .map((entry) => ({
      id: entry.id,
      name: (entry.name ?? '').trim() || 'Untitled',
      directory: entry.retainedProjectDirectory
    }));
}

/**
 * Every v2 component's `nodes.json` and `component.json`, found by walking `components/`.
 *
 * ⚠️ **The registry is deliberately not consulted.** `components/_registry.json` is an index that
 * is written alongside the components and can be stale — a component added by a tool that did not
 * update it would be invisible to a registry-driven walk, and invisible means "not used", which is
 * the answer that makes a delete refusal stop refusing. The files on disk are the project.
 */
async function readV2Components(directory: string): Promise<V2ComponentFiles[]> {
  const componentsDir = filesystem.join(directory, V2_COMPONENTS_DIR);
  if (!filesystem.exists(componentsDir)) return [];

  const files = await filesystem.listDirectoryFiles(componentsDir);
  const nodeFiles = files.filter((file) => !file.isDirectory && file.name === V2_NODES_FILE);

  return Promise.all(
    nodeFiles.map(async (file) => {
      const componentDir = filesystem.dirname(file.fullPath);
      // The registry path is the component directory relative to `components/`, which is what
      // `ComponentLoader` joins back on. Derived from the path we actually walked, never assembled.
      const path = componentDir.slice(componentsDir.length + 1).split('\\').join('/');

      let nodes: V2ComponentFiles['nodes'] = null;
      let component: V2ComponentFiles['component'] = null;
      try {
        nodes = await filesystem.readJson(file.fullPath);
      } catch {
        // One unreadable component must not cost the whole project's scan.
      }
      try {
        const componentPath = filesystem.join(componentDir, V2_COMPONENT_FILE);
        if (filesystem.exists(componentPath)) component = await filesystem.readJson(componentPath);
      } catch {
        // Metadata only — its absence costs a display name, not a reference.
      }

      return { path, component, nodes };
    })
  );
}

/**
 * One project on disk, reduced to a scan.
 *
 * @returns the snapshot, or the reason it could not be read. Never throws, and never returns an
 *   empty scan in place of a failure — an empty scan means *"read it, found nothing"* and the whole
 *   point of `unreadable` is that those two answers are different.
 */
export async function readProjectSnapshot(
  entry: RecentProjectEntry
): Promise<{ snapshot?: ProjectSnapshot; unreadable?: UnreadableProject }> {
  const failure = (reason: string): { unreadable: UnreadableProject } => ({
    unreadable: { name: entry.name, path: entry.directory, reason }
  });

  try {
    if (!entry.directory || !filesystem.exists(entry.directory)) {
      return failure('the folder is no longer there');
    }

    const v2Path = filesystem.join(entry.directory, V2_PROJECT_FILE);
    if (filesystem.exists(v2Path)) {
      const components = await readV2Components(entry.directory);
      return {
        snapshot: {
          id: entry.id,
          name: entry.name,
          path: entry.directory,
          scan: scanFromV2Components(components)
        }
      };
    }

    const legacyPath = filesystem.join(entry.directory, LEGACY_PROJECT_FILE);
    if (!filesystem.exists(legacyPath)) return failure('it has no project file');

    const json = await filesystem.readJson(legacyPath);
    return {
      snapshot: { id: entry.id, name: entry.name, path: entry.directory, scan: scanFromLegacyProject(json) }
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'it could not be read');
  }
}

/** Every recent project, read in parallel, each one either scanned or reported. */
export async function scanRecentProjects(
  entries: RecentProjectEntry[] = recentProjects()
): Promise<{ snapshots: ProjectSnapshot[]; unreadable: UnreadableProject[] }> {
  const results = await Promise.all(entries.map(readProjectSnapshot));

  const snapshots: ProjectSnapshot[] = [];
  const unreadable: UnreadableProject[] = [];
  for (const result of results) {
    if (result.snapshot) snapshots.push(result.snapshot);
    else if (result.unreadable) unreadable.push(result.unreadable);
  }

  return { snapshots, unreadable };
}

/**
 * Where a backpack definition is used, across the recent projects, right now.
 *
 * ⚠️ **Recomputed on every call, cached nowhere.** VFN-009's own rule, one level out: a stale usage
 * index is wrong about a node somebody deleted, and a warning built on it names call sites that are
 * not there. The cost is real and is why this is behind an explicit action.
 */
export async function backpackUsageNow(definitionId: string): Promise<CrossProjectUsage> {
  const { snapshots, unreadable } = await scanRecentProjects();
  return crossProjectUsage(definitionId, snapshots, unreadable);
}
