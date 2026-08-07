/**
 * Reading a project out of a git snapshot, in either on-disk format.
 *
 * Every diff in this panel works by reconstructing the *legacy in-memory shape*
 * of a project at two points in history and handing both to `diffProject` /
 * `safeGraphDiff`. That shape used to come from one blob, `project.json`. Since
 * new projects are created decomposed (v2), it has to be reassembled from
 * `nodegx.project.json` + `components/_registry.json` + three files per
 * component — the same reconstruction `ProjectStructureService.loadProject`
 * performs against the filesystem, done against a commit or stash instead.
 *
 * Everything downstream is format-agnostic and stays untouched: the panel
 * compares graphs, not files.
 *
 * @module noodl-editor/views/panels/VersionControlPanel/context/snapshotProject
 */

import type { SnapshotEntry } from '@noodl/git/src/core/models/snapshot';

import { applyPatches } from '@noodl-models/ProjectPatches/applypatches';

import { ProjectImporter, type ImportInput } from '../../../../io/ProjectImporter';
import type {
  ProjectV2File,
  RegistryV2File,
  RoutesV2File,
  StylesV2File,
  ComponentV2File,
  NodesV2File,
  ConnectionsV2File
} from '../../../../schemas';
import { V2_FILES } from '../../../../services/ProjectStructure/types';

const importer = new ProjectImporter();

/** Joins repo-relative path segments. Always `/` — these are git paths, not OS paths. */
function repoPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replaceAll('\\', '/');
}

async function readJson<T>(snapshot: SnapshotEntry, path: string): Promise<T> {
  return JSON.parse(await snapshot.getFileAsString(path)) as T;
}

/** Reads a file that legitimately may not exist in this snapshot. */
async function readOptionalJson<T>(snapshot: SnapshotEntry, path: string): Promise<T | undefined> {
  try {
    return await readJson<T>(snapshot, path);
  } catch {
    return undefined;
  }
}

/**
 * Reassembles a v2 project from a snapshot. Returns undefined when the snapshot
 * holds no v2 project at that root — the caller then tries the legacy blob.
 *
 * The registry is the index of what to read. A component listed there but absent
 * from the commit means a malformed history rather than a missing optional file,
 * so those reads are not tolerated: the whole reconstruction fails and the caller
 * falls back, rather than silently diffing against a project missing components
 * (which would render as "everything was deleted").
 */
async function readV2Project(snapshot: SnapshotEntry, root: string): Promise<TSFixme | undefined> {
  const project = await readOptionalJson<ProjectV2File>(snapshot, repoPath(root, V2_FILES.project));
  const registry = await readOptionalJson<RegistryV2File>(snapshot, repoPath(root, V2_FILES.registry));
  if (!project || !registry) return undefined;

  const [routes, styles] = await Promise.all([
    readOptionalJson<RoutesV2File>(snapshot, repoPath(root, V2_FILES.routes)),
    readOptionalJson<StylesV2File>(snapshot, repoPath(root, V2_FILES.styles))
  ]);

  const paths = Object.keys(registry.components ?? {});
  const entries = await Promise.all(
    paths.map(async (componentPath) => {
      const dir = repoPath(root, V2_FILES.componentsDir, componentPath);
      const [component, nodes, connections] = await Promise.all([
        readJson<ComponentV2File>(snapshot, repoPath(dir, V2_FILES.component)),
        readJson<NodesV2File>(snapshot, repoPath(dir, V2_FILES.nodes)),
        readJson<ConnectionsV2File>(snapshot, repoPath(dir, V2_FILES.connections))
      ]);
      return [componentPath, { component, nodes, connections }] as const;
    })
  );

  const components: ImportInput['components'] = {};
  for (const [componentPath, files] of entries) {
    components[componentPath] = files;
  }

  return importer.import({ project, registry, routes, styles, components }).project;
}

/**
 * Reads the project at `root` (repo-relative, `''` when the project *is* the
 * repository root) out of a commit or stash, in whichever format that snapshot
 * used, and returns it in the legacy in-memory shape with patches applied.
 *
 * The format is decided per snapshot, not per project: a repository whose
 * history spans a migration has legacy commits and v2 commits, and a diff across
 * that boundary has to read each side the way it was written.
 *
 * Throws if neither format is present — the callers already treat a failed read
 * as "no diff available", which is the honest answer for a commit predating the
 * project.
 */
export async function readProjectFromSnapshot(snapshot: SnapshotEntry, root: string): Promise<TSFixme> {
  const v2 = await readV2Project(snapshot, root);
  const project = v2 ?? (await readJson<TSFixme>(snapshot, repoPath(root, 'project.json')));

  applyPatches(project);
  return project;
}
