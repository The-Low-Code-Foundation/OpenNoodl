import React from 'react';

import { Label } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';

import { SortDirection, SortField } from '../../hooks/useProjectList';
import { LauncherProjectData } from '../LauncherProjectCard';
import css from './ProjectList.module.scss';
import { ProjectListHeader } from './ProjectListHeader';
import { ProjectListRow } from './ProjectListRow';

export interface ProjectListProps {
  projects: LauncherProjectData[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onProjectClick: (project: LauncherProjectData) => void;
  onOpenFolder?: (project: LauncherProjectData) => void;
  onSettings?: (project: LauncherProjectData) => void;
  onDelete?: (project: LauncherProjectData) => void;
}

/**
 * ProjectList
 *
 * Table view for displaying projects with sortable columns.
 * Combines header and row components into a cohesive list.
 */
export function ProjectList({
  projects,
  sortField,
  sortDirection,
  onSort,
  onProjectClick,
  onOpenFolder,
  onSettings,
  onDelete
}: ProjectListProps) {
  // Empty state
  if (projects.length === 0) {
    return (
      <div className={css.Empty}>
        <Label variant={TextType.Shy}>No projects found</Label>
      </div>
    );
  }

  return (
    <div className={css.Root}>
      <ProjectListHeader sortField={sortField} sortDirection={sortDirection} onSort={onSort} />

      <div className={css.Rows}>
        {projects.map((project) => (
          <ProjectListRow
            key={project.id}
            {...project}
            onClick={() => onProjectClick(project)}
            onOpenFolder={() => onOpenFolder?.(project)}
            onSettings={() => onSettings?.(project)}
            onDelete={() => onDelete?.(project)}
          />
        ))}
      </div>
    </div>
  );
}
