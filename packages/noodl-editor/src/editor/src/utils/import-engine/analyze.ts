/**
 * LIB-004: Import Engine v2 — analyze stage (I/O shell).
 *
 * Loads a source project from disk and hands its data to the pure
 * `buildInventory`. This is the only part of analyze that touches Electron
 * (`projectFromDirectory`, the filesystem) — the dependency graph is computed by
 * the pure core, which is why the interesting logic is unit-tested outside
 * Electron.
 *
 * Routes source loading through `projectFromDirectory`, the format-aware loader,
 * so v2-format sources are read the same way the editor reads them (STRUCT-003).
 *
 * @module noodl-editor/utils/import-engine/analyze
 */

import { ProjectModel } from '@noodl-models/projectmodel';
import { projectFromDirectory } from '@noodl-models/projectmodel.editor';

import { loadDefaultCatalog } from '../../validation/catalog';
import FileSystem from '../filesystem';
import { buildInventory, catalogPortType } from './inventory';
import type { ProjectData, SourceInventory } from './types';

/**
 * Project *source* files, in both formats — never importable resources. The
 * graph they encode is imported through `projectFromDirectory` above; listing
 * them here as well would offer the user their own component files as if they
 * were assets.
 */
const IGNORED_FILES = new Set([
  'project.json',
  'nodegx.project.json',
  'nodegx.routes.json',
  'nodegx.styles.json',
  '.ds_store',
  '.gitignore',
  '.gitattributes',
  'readme.md'
]);

/** List a loaded project's importable resource paths (project-relative). */
function listResources(project: ProjectModel, sourceDir: string): Promise<string[]> {
  const ignoreFullPath = [`${project._retainedProjectDirectory}/.git`, `${project._retainedProjectDirectory}/__MACOSX`];
  // A v2 project keeps its whole graph under components/ — source, not assets.
  // Only skipped when the project actually is v2: `components/` is a plausible
  // asset folder name in a legacy project (the same carve-out the deploy copy
  // filter makes in `compilation/build/ignore.ts`).
  const componentsDir =
    project._projectFormat === 'v2' ? `${project._retainedProjectDirectory}/components/` : undefined;

  return new Promise((resolve) => {
    project.listFilesInProjectDirectory(
      (entries: { name: string; fullPath: string }[]) => {
        const resources: string[] = [];
        for (const e of entries) {
          if (IGNORED_FILES.has(e.name.toLowerCase())) continue;
          if (e.fullPath.indexOf('.git') === 0) continue;
          if (componentsDir && e.fullPath.startsWith(componentsDir)) continue;
          if (e.fullPath.startsWith(project._retainedProjectDirectory + '/noodl_modules')) continue;
          resources.push(e.fullPath.substring(sourceDir.length + 1));
        }
        resolve(resources);
      },
      undefined,
      ignoreFullPath
    );
  });
}

/** List modules (subdirectories of noodl_modules that carry a manifest). */
function listModules(sourceDir: string): string[] {
  try {
    const entries = FileSystem.instance.readDirectorySync(sourceDir + '/noodl_modules');
    return entries
      .filter((m: { fullPath: string }) => FileSystem.instance.fileExistsSync(m.fullPath + '/manifest.json'))
      .map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

/**
 * What one analyze pass produces: the inventory, plus the source project data it
 * was built from.
 *
 * `plan()` needs BOTH (the inventory for the closure, the project data for the
 * SUB-007 overwrite diffs), and loading a project off disk is the expensive part
 * of analyze — so LIB-005's UI takes this shape and loads once. `analyze()` is
 * the narrow view for callers that only want the inventory.
 */
export interface AnalyzedSource {
  inventory: SourceInventory;
  project: ProjectData;
}

/**
 * Analyze a source project directory. Does not mutate anything and does not
 * touch the current project.
 *
 * Rejects if the directory cannot be opened as a project.
 */
export function analyzeSource(sourceDir: string): Promise<AnalyzedSource> {
  return new Promise((resolve, reject) => {
    projectFromDirectory(sourceDir, async (project?: ProjectModel) => {
      if (!project) {
        reject(new Error('Could not open project to import'));
        return;
      }
      try {
        const resources = await listResources(project, sourceDir);
        const modules = listModules(sourceDir);
        const projectData = project.toJSON() as unknown as ProjectData;
        const portType = catalogPortType(loadDefaultCatalog());
        resolve({
          inventory: buildInventory({ sourceDir, project: projectData, resources, modules, portType }),
          project: projectData
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

/** {@link analyzeSource} reduced to just the inventory. */
export function analyze(sourceDir: string): Promise<SourceInventory> {
  return analyzeSource(sourceDir).then((analyzed) => analyzed.inventory);
}
