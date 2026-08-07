/**
 * MigrationNotesManager
 *
 * Helper functions for managing component migration notes.
 * Handles loading, filtering, dismissing, and restoring migration notes.
 */

import { ProjectModel } from '../projectmodel';
import { ComponentMigrationNote, MigrationIssueType, ProjectMigrationMetadata } from './types';

export type MigrationFilter = 'all' | 'needs-review' | 'ai-migrated';

// Type helper to access migration properties
type ProjectModelWithMigration = ProjectModel & ProjectMigrationMetadata;

function getProject(): ProjectModelWithMigration | undefined {
  return ProjectModel.instance as ProjectModelWithMigration | undefined;
}

export interface MigrationNoteCounts {
  total: number;
  needsReview: number;
  aiMigrated: number;
  dismissed: number;
}

/**
 * Get migration notes for a specific component
 */
export function getMigrationNote(componentId: string): ComponentMigrationNote | undefined {
  const notes = getProject()?.migrationNotes;
  if (!notes) return undefined;

  return notes[componentId];
}

/**
 * Get all migration notes, optionally filtered by status
 */
export function getAllMigrationNotes(
  filter: MigrationFilter = 'all',
  includeDismissed: boolean = false
): Record<string, ComponentMigrationNote> {
  const notes = getProject()?.migrationNotes;
  if (!notes) return {};

  let filtered = Object.entries(notes);

  // Filter out dismissed unless requested
  if (!includeDismissed) {
    filtered = filtered.filter(([, note]) => !note.dismissedAt);
  }

  // Apply status filter
  if (filter === 'needs-review') {
    filtered = filtered.filter(([, note]) => note.status === 'needs-review');
  } else if (filter === 'ai-migrated') {
    filtered = filtered.filter(([, note]) => note.status === 'ai-migrated');
  }

  return Object.fromEntries(filtered);
}

/**
 * Get counts of migration notes by category
 */
export function getMigrationNoteCounts(): MigrationNoteCounts {
  const notes = getProject()?.migrationNotes;
  if (!notes) {
    return {
      total: 0,
      needsReview: 0,
      aiMigrated: 0,
      dismissed: 0
    };
  }

  const allNotes = Object.values(notes);
  const activeNotes = allNotes.filter((note) => !note.dismissedAt);

  return {
    total: activeNotes.length,
    needsReview: activeNotes.filter((n) => n.status === 'needs-review').length,
    aiMigrated: activeNotes.filter((n) => n.status === 'ai-migrated').length,
    dismissed: allNotes.filter((n) => n.dismissedAt).length
  };
}

/**
 * Check if a component has migration notes
 */
export function hasComponentMigrationNote(componentId: string): boolean {
  const note = getMigrationNote(componentId);
  return Boolean(note && !note.dismissedAt);
}

/**
 * Dismiss a migration note for a component
 */
export function dismissMigrationNote(componentId: string): void {
  const project = getProject();
  const notes = project?.migrationNotes;
  if (!notes || !notes[componentId]) return;

  notes[componentId] = {
    ...notes[componentId],
    dismissedAt: new Date().toISOString()
  };

  (ProjectModel.instance as any).save();
}

/**
 * Restore a dismissed migration note
 */
export function restoreMigrationNote(componentId: string): void {
  const notes = getProject()?.migrationNotes;
  if (!notes || !notes[componentId]) return;

  const note = notes[componentId];
  delete note.dismissedAt;

  (ProjectModel.instance as any).save();
}

/**
 * Get dismissed migration notes
 */
export function getDismissedMigrationNotes(): Record<string, ComponentMigrationNote> {
  const notes = getProject()?.migrationNotes;
  if (!notes) return {};

  return Object.fromEntries(Object.entries(notes).filter(([, note]) => note.dismissedAt));
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: ComponentMigrationNote['status']): string {
  const labels = {
    auto: 'Automatically Migrated',
    'ai-migrated': 'AI Migrated',
    'needs-review': 'Needs Manual Review',
    'manually-fixed': 'Manually Fixed'
  };

  return labels[status] || status;
}

/**
 * Get status icon name
 */
export function getStatusIcon(status: ComponentMigrationNote['status']): string {
  const icons = {
    auto: 'check-circle',
    'ai-migrated': 'sparkles',
    'needs-review': 'warning',
    'manually-fixed': 'check'
  };

  return icons[status] || 'info';
}

/**
 * Get issue type label for display
 */
export function getIssueTypeLabel(type: MigrationIssueType): string {
  const labels: Record<MigrationIssueType, string> = {
    componentWillMount: 'componentWillMount',
    componentWillReceiveProps: 'componentWillReceiveProps',
    componentWillUpdate: 'componentWillUpdate',
    unsafeLifecycle: 'Unsafe Lifecycle',
    stringRef: 'String Refs',
    legacyContext: 'Legacy Context',
    createFactory: 'createFactory',
    findDOMNode: 'findDOMNode',
    reactDomRender: 'ReactDOM.render',
    other: 'Other Issue'
  };

  return labels[type] || type;
}

/**
 * Format timestamp for display
 */
export function formatMigrationDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Check if project has any migration notes
 */
export function projectHasMigrationNotes(): boolean {
  const notes = getProject()?.migrationNotes;
  return Boolean(notes && Object.keys(notes).length > 0);
}

/**
 * Check if project was AI migrated
 */
export function projectWasAIMigrated(): boolean {
  const migratedFrom = getProject()?.migratedFrom;
  return Boolean(migratedFrom?.aiAssisted);
}
