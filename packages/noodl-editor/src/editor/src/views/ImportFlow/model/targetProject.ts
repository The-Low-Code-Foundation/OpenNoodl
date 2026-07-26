/**
 * LIB-005: a `TargetProject` over the live `ProjectModel`.
 *
 * `plan()` deliberately takes the target as a small *synchronous* query
 * interface so the planner stays pure and Electron-free. The live project can
 * answer four of the six questions synchronously; resources and modules need a
 * directory listing. So this snapshots those two once, up front, and hands back
 * a sync interface over the snapshot — which is also what makes re-planning on
 * every keystroke of a rename box cheap.
 *
 * The snapshot is taken when the flow opens. Nothing else writes to the project
 * directory while a modal import flow is on screen, and `apply()` re-checks the
 * live model anyway, so a stale snapshot cannot cause a wrong write — only a
 * momentarily wrong *preview*.
 *
 * @module noodl-editor/views/ImportFlow/model/targetProject
 */

import { ProjectModel } from '@noodl-models/projectmodel';

import FileSystem from '@noodl-utils/filesystem';
import type { ProjectComponentData, TargetProject } from '@noodl-utils/import-engine';

interface ProjectStyles {
  colors?: Record<string, unknown>;
  text?: Record<string, unknown>;
}

function listResourcePaths(project: ProjectModel): Promise<Set<string>> {
  return new Promise((resolve) => {
    const root = project._retainedProjectDirectory;
    if (!root) {
      resolve(new Set());
      return;
    }
    try {
      project.listFilesInProjectDirectory((entries: { fullPath: string }[]) => {
        resolve(new Set(entries.map((e) => e.fullPath.substring(root.length + 1))));
      });
    } catch {
      resolve(new Set());
    }
  });
}

function listModuleNames(project: ProjectModel): Set<string> {
  try {
    const entries = FileSystem.instance.readDirectorySync(project._retainedProjectDirectory + '/noodl_modules');
    return new Set(
      entries
        .filter((m: { fullPath: string }) => FileSystem.instance.fileExistsSync(m.fullPath + '/manifest.json'))
        .map((m: { name: string }) => m.name)
    );
  } catch {
    return new Set();
  }
}

export interface TargetSnapshot extends TargetProject {
  /** Every component name the target already has — the rename suggester's `taken` set. */
  componentNames: ReadonlySet<string>;
}

export async function createTargetProject(project: ProjectModel): Promise<TargetSnapshot> {
  const resources = await listResourcePaths(project);
  const modules = listModuleNames(project);
  const styles = (project.getMetaData('styles') as ProjectStyles | undefined) ?? {};
  const componentNames = new Set<string>((project.getComponents() ?? []).map((c: { name: string }) => c.name));

  return {
    componentNames,
    getComponent(name) {
      const component = project.getComponentWithName(name);
      return component ? (component.toJSON() as unknown as ProjectComponentData) : undefined;
    },
    hasResource: (name) => resources.has(name),
    hasModule: (name) => modules.has(name),
    hasVariant: (typename, name) => project.findVariant(name, { localName: typename }) !== undefined,
    hasColorStyle: (name) => styles.colors?.[name] !== undefined,
    hasTextStyle: (name) => styles.text?.[name] !== undefined
  };
}

/**
 * The export flow plans against an empty staging project: nothing collides, so
 * every item is a plain `add` and the review stage has no decisions to offer.
 */
export function emptyTargetProject(): TargetSnapshot {
  return {
    componentNames: new Set(),
    getComponent: () => undefined,
    hasResource: () => false,
    hasModule: () => false,
    hasVariant: () => false,
    hasColorStyle: () => false,
    hasTextStyle: () => false
  };
}
