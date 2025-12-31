/**
 * useProjectList - Hook for managing project list state with sorting
 *
 * Handles project data sorting and persistence of sort preferences.
 *
 * @module noodl-core-ui/preview/launcher
 */

import { useMemo, useState, useEffect } from 'react';

import { LauncherProjectData } from '../components/LauncherProjectCard';

export type SortField = 'name' | 'lastModified' | 'gitStatus';
export type SortDirection = 'asc' | 'desc';

export interface UseProjectListOptions {
  projects: LauncherProjectData[];
  initialSortField?: SortField;
  initialSortDirection?: SortDirection;
}

export interface UseProjectListReturn {
  sortedProjects: LauncherProjectData[];
  sortField: SortField;
  sortDirection: SortDirection;
  setSorting: (field: SortField, direction?: SortDirection) => void;
}

/**
 * Get git status priority for sorting (lower = higher priority)
 */
function getGitStatusPriority(project: LauncherProjectData): number {
  // Priority: needs attention (diverged, uncommitted, ahead/behind) > synced > none
  if (project.pullAmount && project.pushAmount) return 1; // Diverged
  if (project.uncommittedChangesAmount) return 2; // Uncommitted
  if (project.pushAmount) return 3; // Ahead
  if (project.pullAmount) return 4; // Behind
  if (project.cloudSyncMeta.source) return 5; // Synced
  return 6; // None
}

/**
 * Sort projects by the specified field and direction
 */
function sortProjects(
  projects: LauncherProjectData[],
  field: SortField,
  direction: SortDirection
): LauncherProjectData[] {
  const sorted = [...projects].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'name':
        comparison = a.title.localeCompare(b.title);
        break;

      case 'lastModified':
        comparison = new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime();
        break;

      case 'gitStatus':
        comparison = getGitStatusPriority(a) - getGitStatusPriority(b);
        break;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Hook to manage project list with sorting
 *
 * Provides sorted project data and methods to update sort preferences.
 * Persists sort state to localStorage.
 */
export function useProjectList({
  projects,
  initialSortField = 'lastModified',
  initialSortDirection = 'asc'
}: UseProjectListOptions): UseProjectListReturn {
  // Load sort preferences from localStorage
  const [sortField, setSortField] = useState<SortField>(() => {
    try {
      const stored = localStorage.getItem('launcher:sortField');
      return (stored as SortField) || initialSortField;
    } catch {
      return initialSortField;
    }
  });

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    try {
      const stored = localStorage.getItem('launcher:sortDirection');
      return (stored as SortDirection) || initialSortDirection;
    } catch {
      return initialSortDirection;
    }
  });

  // Persist sort preferences
  useEffect(() => {
    try {
      localStorage.setItem('launcher:sortField', sortField);
      localStorage.setItem('launcher:sortDirection', sortDirection);
    } catch (error) {
      console.warn('Failed to persist sort preferences:', error);
    }
  }, [sortField, sortDirection]);

  // Memoized sorted projects
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, sortField, sortDirection);
  }, [projects, sortField, sortDirection]);

  // Update sorting (toggle direction if same field clicked)
  const setSorting = (field: SortField, direction?: SortDirection) => {
    if (field === sortField && !direction) {
      // Toggle direction if clicking the same field
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(direction || 'asc');
    }
  };

  return {
    sortedProjects,
    sortField,
    sortDirection,
    setSorting
  };
}
