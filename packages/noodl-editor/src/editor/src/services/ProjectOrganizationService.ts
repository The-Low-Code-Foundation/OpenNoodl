/**
 * ProjectOrganizationService
 *
 * Manages project organization through folders and tags.
 * Data is stored client-side in electron-store and keyed by project path.
 */

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';

// ============================================================================
// Types
// ============================================================================

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null = root level
  order: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string; // hex color
  createdAt: string;
}

export interface ProjectMeta {
  folderId: string | null;
  tagIds: string[];
  customName?: string;
  notes?: string;
}

export interface ProjectOrganizationData {
  version: 1;
  folders: Folder[];
  tags: Tag[];
  projectMeta: Record<string, ProjectMeta>; // keyed by project path
}

// Tag color palette
export const TAG_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280' // Gray
];

// ============================================================================
// Service
// ============================================================================

export class ProjectOrganizationService extends EventDispatcher {
  private static _instance: ProjectOrganizationService;
  private data: ProjectOrganizationData;
  private storageKey = 'projectOrganization';

  private constructor() {
    super();
    this.data = this.loadData();
  }

  static get instance(): ProjectOrganizationService {
    if (!ProjectOrganizationService._instance) {
      ProjectOrganizationService._instance = new ProjectOrganizationService();
    }
    return ProjectOrganizationService._instance;
  }

  // ============================================================================
  // Storage
  // ============================================================================

  private loadData(): ProjectOrganizationData {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ProjectOrganizationService] Failed to load data:', error);
    }

    // Return default empty structure
    return {
      version: 1,
      folders: [],
      tags: [],
      projectMeta: {}
    };
  }

  private saveData(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      this.notifyListeners('dataChanged', this.data);
    } catch (error) {
      console.error('[ProjectOrganizationService] Failed to save data:', error);
    }
  }

  // ============================================================================
  // Folder Operations
  // ============================================================================

  createFolder(name: string, parentId?: string | null): Folder {
    const folder: Folder = {
      id: this.generateId('folder'),
      name,
      parentId: parentId || null,
      order: this.data.folders.length,
      createdAt: new Date().toISOString()
    };

    this.data.folders.push(folder);
    this.saveData();
    this.notifyListeners('folderCreated', folder);

    return folder;
  }

  renameFolder(id: string, name: string): void {
    const folder = this.data.folders.find((f) => f.id === id);
    if (!folder) {
      console.warn('[ProjectOrganizationService] Folder not found:', id);
      return;
    }

    folder.name = name;
    this.saveData();
    this.notifyListeners('folderRenamed', { id, name });
  }

  deleteFolder(id: string): void {
    // Remove folder
    this.data.folders = this.data.folders.filter((f) => f.id !== id);

    // Remove child folders
    this.data.folders = this.data.folders.filter((f) => f.parentId !== id);

    // Move projects in deleted folder to uncategorized
    Object.keys(this.data.projectMeta).forEach((projectPath) => {
      if (this.data.projectMeta[projectPath].folderId === id) {
        this.data.projectMeta[projectPath].folderId = null;
      }
    });

    this.saveData();
    this.notifyListeners('folderDeleted', id);
  }

  reorderFolder(id: string, newOrder: number): void {
    const folder = this.data.folders.find((f) => f.id === id);
    if (!folder) return;

    folder.order = newOrder;
    this.saveData();
    this.notifyListeners('folderReordered', { id, order: newOrder });
  }

  getFolders(): Folder[] {
    return [...this.data.folders].sort((a, b) => a.order - b.order);
  }

  getFolder(id: string): Folder | undefined {
    return this.data.folders.find((f) => f.id === id);
  }

  // ============================================================================
  // Tag Operations
  // ============================================================================

  createTag(name: string, color?: string): Tag {
    const tag: Tag = {
      id: this.generateId('tag'),
      name,
      color: color || this.getNextTagColor(),
      createdAt: new Date().toISOString()
    };

    this.data.tags.push(tag);
    this.saveData();
    this.notifyListeners('tagCreated', tag);

    return tag;
  }

  renameTag(id: string, name: string): void {
    const tag = this.data.tags.find((t) => t.id === id);
    if (!tag) {
      console.warn('[ProjectOrganizationService] Tag not found:', id);
      return;
    }

    tag.name = name;
    this.saveData();
    this.notifyListeners('tagRenamed', { id, name });
  }

  changeTagColor(id: string, color: string): void {
    const tag = this.data.tags.find((t) => t.id === id);
    if (!tag) return;

    tag.color = color;
    this.saveData();
    this.notifyListeners('tagColorChanged', { id, color });
  }

  deleteTag(id: string): void {
    // Remove tag
    this.data.tags = this.data.tags.filter((t) => t.id !== id);

    // Remove tag from all projects
    Object.keys(this.data.projectMeta).forEach((projectPath) => {
      const meta = this.data.projectMeta[projectPath];
      meta.tagIds = meta.tagIds.filter((tagId) => tagId !== id);
    });

    this.saveData();
    this.notifyListeners('tagDeleted', id);
  }

  getTags(): Tag[] {
    return [...this.data.tags];
  }

  getTag(id: string): Tag | undefined {
    return this.data.tags.find((t) => t.id === id);
  }

  private getNextTagColor(): string {
    const usedColors = this.data.tags.map((t) => t.color);
    const availableColors = TAG_COLORS.filter((c) => !usedColors.includes(c));
    return availableColors.length > 0 ? availableColors[0] : TAG_COLORS[0];
  }

  // ============================================================================
  // Project Organization
  // ============================================================================

  moveProjectToFolder(projectPath: string, folderId: string | null): void {
    if (!this.data.projectMeta[projectPath]) {
      this.data.projectMeta[projectPath] = {
        folderId: null,
        tagIds: []
      };
    }

    this.data.projectMeta[projectPath].folderId = folderId;
    this.saveData();
    this.notifyListeners('projectMoved', { projectPath, folderId });
  }

  addTagToProject(projectPath: string, tagId: string): void {
    if (!this.data.projectMeta[projectPath]) {
      this.data.projectMeta[projectPath] = {
        folderId: null,
        tagIds: []
      };
    }

    const meta = this.data.projectMeta[projectPath];
    if (!meta.tagIds.includes(tagId)) {
      meta.tagIds.push(tagId);
      this.saveData();
      this.notifyListeners('projectTagAdded', { projectPath, tagId });
    }
  }

  removeTagFromProject(projectPath: string, tagId: string): void {
    const meta = this.data.projectMeta[projectPath];
    if (!meta) return;

    meta.tagIds = meta.tagIds.filter((id) => id !== tagId);
    this.saveData();
    this.notifyListeners('projectTagRemoved', { projectPath, tagId });
  }

  getProjectMeta(projectPath: string): ProjectMeta | null {
    return this.data.projectMeta[projectPath] || null;
  }

  // ============================================================================
  // Queries
  // ============================================================================

  getProjectsInFolder(folderId: string | null): string[] {
    return Object.keys(this.data.projectMeta).filter((projectPath) => {
      const meta = this.data.projectMeta[projectPath];
      return meta.folderId === folderId;
    });
  }

  getProjectsWithTag(tagId: string): string[] {
    return Object.keys(this.data.projectMeta).filter((projectPath) => {
      const meta = this.data.projectMeta[projectPath];
      return meta.tagIds.includes(tagId);
    });
  }

  getProjectCountInFolder(folderId: string | null): number {
    return this.getProjectsInFolder(folderId).length;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // For debugging
  exportData(): ProjectOrganizationData {
    return JSON.parse(JSON.stringify(this.data));
  }

  importData(data: ProjectOrganizationData): void {
    this.data = data;
    this.saveData();
  }

  clearAll(): void {
    this.data = {
      version: 1,
      folders: [],
      tags: [],
      projectMeta: {}
    };
    this.saveData();
    this.notifyListeners('dataCleared', null);
  }
}
