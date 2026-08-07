/**
 * Topology Map Persistence
 *
 * Handles saving and loading custom positions and sticky notes from project metadata.
 * Stored in project.json under "topologyMap" key.
 */

import { ProjectModel } from '@noodl-models/projectmodel';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import { CustomPosition, StickyNote, TopologyMapMetadata } from './topologyTypes';

const METADATA_KEY = 'topologyMap';

/**
 * Get topology map metadata from project.
 * Returns default empty metadata if not found.
 */
export function getTopologyMapMetadata(project: ProjectModel): TopologyMapMetadata {
  const metadata = project.getMetaData(METADATA_KEY);

  if (!metadata || typeof metadata !== 'object') {
    return {
      version: 1,
      customPositions: {},
      stickyNotes: []
    };
  }

  return {
    version: (metadata as TopologyMapMetadata).version || 1,
    customPositions: (metadata as TopologyMapMetadata).customPositions || {},
    stickyNotes: (metadata as TopologyMapMetadata).stickyNotes || []
  };
}

/**
 * Save topology map metadata to project.
 * Uses undo queue for proper undo/redo support.
 */
export function saveTopologyMapMetadata(project: ProjectModel, metadata: TopologyMapMetadata): void {
  // Capture previous state before modification
  const previousMetadata = getTopologyMapMetadata(project);

  // Use the correct UndoQueue pattern (see UNDO-QUEUE-PATTERNS.md)
  UndoQueue.instance.pushAndDo(
    new UndoActionGroup({
      label: 'Update Topology Map',
      do: () => {
        project.setMetaData(METADATA_KEY, metadata);
      },
      undo: () => {
        project.setMetaData(METADATA_KEY, previousMetadata);
      }
    })
  );
}

/**
 * Update custom position for a folder or component.
 */
export function updateCustomPosition(project: ProjectModel, nodeId: string, position: CustomPosition): void {
  const metadata = getTopologyMapMetadata(project);

  metadata.customPositions[nodeId] = position;

  saveTopologyMapMetadata(project, metadata);
}

/**
 * Get custom position for a node (if exists).
 */
export function getCustomPosition(project: ProjectModel, nodeId: string): CustomPosition | undefined {
  const metadata = getTopologyMapMetadata(project);
  return metadata.customPositions[nodeId];
}

/**
 * Clear custom position for a node.
 */
export function clearCustomPosition(project: ProjectModel, nodeId: string): void {
  const metadata = getTopologyMapMetadata(project);

  delete metadata.customPositions[nodeId];

  saveTopologyMapMetadata(project, metadata);
}

/**
 * Add a new sticky note.
 */
export function addStickyNote(project: ProjectModel, note: StickyNote): void {
  const metadata = getTopologyMapMetadata(project);

  metadata.stickyNotes.push(note);

  saveTopologyMapMetadata(project, metadata);
}

/**
 * Update an existing sticky note.
 */
export function updateStickyNote(project: ProjectModel, noteId: string, updates: Partial<StickyNote>): void {
  const metadata = getTopologyMapMetadata(project);

  const noteIndex = metadata.stickyNotes.findIndex((n) => n.id === noteId);

  if (noteIndex !== -1) {
    metadata.stickyNotes[noteIndex] = {
      ...metadata.stickyNotes[noteIndex],
      ...updates
    };

    saveTopologyMapMetadata(project, metadata);
  }
}

/**
 * Delete a sticky note.
 */
export function deleteStickyNote(project: ProjectModel, noteId: string): void {
  const metadata = getTopologyMapMetadata(project);

  metadata.stickyNotes = metadata.stickyNotes.filter((n) => n.id !== noteId);

  saveTopologyMapMetadata(project, metadata);
}

/**
 * Get all sticky notes.
 */
export function getStickyNotes(project: ProjectModel): StickyNote[] {
  const metadata = getTopologyMapMetadata(project);
  return metadata.stickyNotes;
}
