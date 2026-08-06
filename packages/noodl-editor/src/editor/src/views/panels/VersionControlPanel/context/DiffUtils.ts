import path from 'path';
import { getCommit } from '@noodl/git/src/core/logs';
import { FileStatusKind } from '@noodl/git/src/core/models/status';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import {
  ProjectDiff,
  ProjectDiffItem,
  ProjectBasicDiffItem,
  ArrayDiff,
  diffProject,
  createEmptyArrayDiff
} from '@noodl-utils/projectmerger.diff';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { ListItemProps } from '@noodl-core-ui/components/layout/ListItem';

import { ProjectModel } from '../../../../models/projectmodel';
import { V2_FILES } from '../../../../services/ProjectStructure/types';
import { readProjectFromSnapshot } from './snapshotProject';

export interface ProjectLocalDiff extends ProjectDiff {
  baseProject: TSFixme; //Project model as an object from raw json
  commitShaDiffedTo: string;
}

export type ComponentChange = {
  status: FileStatusKind;
  component: ProjectDiffItem;
};

export function getChangedComponents(components: ArrayDiff<ProjectDiffItem>): ComponentChange[] {
  const items = components.changed
    .map((c) => ({ status: FileStatusKind.Modified, component: c }))
    .concat(components.created.map((c) => ({ status: FileStatusKind.New, component: c })))
    .concat(components.deleted.map((c) => ({ status: FileStatusKind.Deleted, component: c })));

  items.sort((a, b) => {
    if (a.component.name < b.component.name) return -1;
    return a.component.name > b.component.name ? 1 : 0;
  });

  return items;
}

export type ObjectPropertyChange = {
  status: FileStatusKind;
  property: ProjectBasicDiffItem;
};

export function getChangedObjectProperties(properties: ArrayDiff<ProjectBasicDiffItem>): ObjectPropertyChange[] {
  const items = properties.changed
    .map((property) => ({ status: FileStatusKind.Modified, property }))
    .concat(properties.created.map((property) => ({ status: FileStatusKind.New, property })))
    .concat(properties.deleted.map((property) => ({ status: FileStatusKind.Deleted, property })));

  items.sort((a, b) => {
    if (a.property.name < b.property.name) return -1;
    return a.property.name > b.property.name ? 1 : 0;
  });

  return items;
}

export function getFileStatusIconProps(status: FileStatusKind): Partial<ListItemProps> {
  switch (status) {
    case FileStatusKind.Copied:
    case FileStatusKind.Untracked:
    case FileStatusKind.New:
      return {
        icon: IconName.Plus,
        iconVariant: FeedbackType.Success
      };

    case FileStatusKind.Renamed:
    case FileStatusKind.Conflicted:
    case FileStatusKind.Modified:
      return {
        icon: IconName.DotsThreeHorizontal,
        iconVariant: FeedbackType.Notice
      };

    case FileStatusKind.Deleted:
      return {
        icon: IconName.Minus,
        iconVariant: FeedbackType.Danger
      };
  }
}

/**
 * True for a repo path that holds project *source* in either format.
 *
 * These files are already represented in the panel as a component/style/setting
 * diff — the whole point of the graph diff is that a user reads "Home changed",
 * not "components/__page__/Home/nodes.json changed". Listing them again under
 * raw file changes double-counts every edit, and in v2 a one-node change would
 * otherwise show up as three JSON files plus a registry.
 *
 * Deliberately matched on the v2 filenames rather than on `components/` alone:
 * in a legacy project `components/` is a perfectly ordinary asset folder.
 */
export function isProjectSourceFile(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/');
  const name = normalized.split('/').pop();

  if (name === 'project.json' || name === V2_FILES.project) return true;
  if (name === V2_FILES.routes || name === V2_FILES.styles) return true;

  // Per-component files and the registry, at any depth under a components/ dir.
  const isV2ComponentFile =
    name === V2_FILES.component || name === V2_FILES.nodes || name === V2_FILES.connections || name === '_registry.json';
  return isV2ComponentFile && normalized.includes(`${V2_FILES.componentsDir}/`);
}

/**
 * The project's root inside the repository, repo-relative and `/`-separated
 * (`''` when the project *is* the repository root). Formerly this returned the
 * path of `project.json`; a v2 project has no single file, so what the readers
 * need is the directory the format lives under.
 */
export function getProjectRootInRepo(repositoryPath: string, projectPath: string) {
  return path.relative(repositoryPath, projectPath).replaceAll('\\', '/');
}

export async function doLocalDiff(
  repositoryPath: string,
  projectPath: string,
  headCommitId: string
): Promise<ProjectLocalDiff> {
  const root = getProjectRootInRepo(repositoryPath, projectPath);

  try {
    const baseCommit = await getCommit(projectPath, headCommitId);
    const baseProject = await readProjectFromSnapshot(baseCommit, root);

    const diff = diffProject(baseProject, ProjectModel.instance.toJSON());

    return {
      ...diff,
      baseProject,
      commitShaDiffedTo: headCommitId
    };
  } catch (error) {
    if (error.toString().includes('exists on disk, but not in')) {
      console.warn('This commit contains no project to diff against.');
    }

    // Return empty state
    return {
      baseProject: {},
      commitShaDiffedTo: headCommitId,
      components: createEmptyArrayDiff(),
      variants: createEmptyArrayDiff(),
      settings: createEmptyArrayDiff(),
      styles: {
        colors: createEmptyArrayDiff(),
        text: createEmptyArrayDiff()
      },
      cloudservices: createEmptyArrayDiff()
    };
  }
}
