/**
 * useProjectOrganization
 *
 * React hook for managing project organization (folders and tags).
 * Interfaces with ProjectOrganizationService from noodl-editor.
 */

import { useEffect, useMemo, useState } from 'react';

import { useLauncherContext } from '../LauncherContext';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface ProjectMeta {
  folderId: string | null;
  tagIds: string[];
  customName?: string;
  notes?: string;
}

export interface UseProjectOrganizationReturn {
  // Data
  folders: Folder[];
  tags: Tag[];

  // Folder operations
  createFolder: (name: string, parentId?: string | null) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  getProjectCountInFolder: (folderId: string | null) => number;

  // Tag operations
  createTag: (name: string, color?: string) => Tag;
  renameTag: (id: string, name: string) => void;
  changeTagColor: (id: string, color: string) => void;
  deleteTag: (id: string) => void;

  // Project organization
  moveProjectToFolder: (projectPath: string, folderId: string | null) => void;
  addTagToProject: (projectPath: string, tagId: string) => void;
  removeTagFromProject: (projectPath: string, tagId: string) => void;
  getProjectMeta: (projectPath: string) => ProjectMeta | null;
  getProjectsInFolder: (folderId: string | null) => string[];
  getProjectsWithTag: (tagId: string) => string[];
}

/**
 * Hook to manage project organization through folders and tags.
 *
 * Uses the real ProjectOrganizationService when available (in production),
 * falls back to localStorage service for Storybook compatibility.
 */
export function useProjectOrganization(): UseProjectOrganizationReturn {
  const { projectOrganizationService } = useLauncherContext();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [, setUpdateTrigger] = useState(0);

  // Use real service if available, otherwise fall back to localStorage
  const service = useMemo(() => {
    if (projectOrganizationService) {
      console.log('✅ Using real ProjectOrganizationService');
      return projectOrganizationService;
    }

    console.warn('⚠️ ProjectOrganizationService not available, using localStorage fallback');
    return createLocalStorageService();
  }, [projectOrganizationService]);

  // Subscribe to service events and load initial data
  useEffect(() => {
    // Initial load
    setFolders(service.getFolders());
    setTags(service.getTags());

    // Subscribe to changes
    const handleDataChange = () => {
      setFolders(service.getFolders());
      setTags(service.getTags());
      setUpdateTrigger((prev) => prev + 1);
    };

    service.on('dataChanged', handleDataChange);

    // Cleanup
    return () => {
      service.off('dataChanged', handleDataChange);
    };
  }, [service]);

  return {
    // Data
    folders,
    tags,

    // Folder operations
    createFolder: (name, parentId) => service.createFolder(name, parentId),
    renameFolder: (id, name) => service.renameFolder(id, name),
    deleteFolder: (id) => service.deleteFolder(id),
    getProjectCountInFolder: (folderId) => service.getProjectCountInFolder(folderId),

    // Tag operations
    createTag: (name, color) => service.createTag(name, color),
    renameTag: (id, name) => service.renameTag(id, name),
    changeTagColor: (id, color) => service.changeTagColor(id, color),
    deleteTag: (id) => service.deleteTag(id),

    // Project organization
    moveProjectToFolder: (projectPath, folderId) => service.moveProjectToFolder(projectPath, folderId),
    addTagToProject: (projectPath, tagId) => service.addTagToProject(projectPath, tagId),
    removeTagFromProject: (projectPath, tagId) => service.removeTagFromProject(projectPath, tagId),
    getProjectMeta: (projectPath) => service.getProjectMeta(projectPath),
    getProjectsInFolder: (folderId) => service.getProjectsInFolder(folderId),
    getProjectsWithTag: (tagId) => service.getProjectsWithTag(tagId)
  };
}

// ============================================================================
// Minimal localStorage-based service for noodl-core-ui
// This allows the hook to work in Storybook and standalone contexts
// ============================================================================

class EventEmitter {
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback?: (data: any) => void) {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }
}

function createLocalStorageService() {
  const emitter = new EventEmitter();
  const storageKey = 'projectOrganization';

  interface StorageData {
    version: 1;
    folders: Folder[];
    tags: Tag[];
    projectMeta: Record<string, ProjectMeta>;
  }

  const loadData = (): StorageData => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[useProjectOrganization] Failed to load data:', error);
    }
    return {
      version: 1,
      folders: [],
      tags: [],
      projectMeta: {}
    };
  };

  let data = loadData();

  const saveData = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      emitter.emit('dataChanged', data);
    } catch (error) {
      console.error('[useProjectOrganization] Failed to save data:', error);
    }
  };

  const generateId = (prefix: string) => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const TAG_COLORS = [
    '#EF4444',
    '#F97316',
    '#EAB308',
    '#22C55E',
    '#06B6D4',
    '#3B82F6',
    '#8B5CF6',
    '#EC4899',
    '#6B7280'
  ];

  const getNextTagColor = () => {
    const usedColors = data.tags.map((t) => t.color);
    const availableColors = TAG_COLORS.filter((c) => !usedColors.includes(c));
    return availableColors.length > 0 ? availableColors[0] : TAG_COLORS[0];
  };

  return {
    // Event methods
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),

    // Data methods
    getFolders: () => [...data.folders].sort((a, b) => a.order - b.order),
    getTags: () => [...data.tags],

    createFolder: (name: string, parentId?: string | null): Folder => {
      const folder: Folder = {
        id: generateId('folder'),
        name,
        parentId: parentId || null,
        order: data.folders.length,
        createdAt: new Date().toISOString()
      };
      data.folders.push(folder);
      saveData();
      return folder;
    },

    renameFolder: (id: string, name: string) => {
      const folder = data.folders.find((f) => f.id === id);
      if (folder) {
        folder.name = name;
        saveData();
      }
    },

    deleteFolder: (id: string) => {
      data.folders = data.folders.filter((f) => f.id !== id && f.parentId !== id);
      Object.keys(data.projectMeta).forEach((projectPath) => {
        if (data.projectMeta[projectPath].folderId === id) {
          data.projectMeta[projectPath].folderId = null;
        }
      });
      saveData();
    },

    getProjectCountInFolder: (folderId: string | null): number => {
      return Object.values(data.projectMeta).filter((meta) => meta.folderId === folderId).length;
    },

    createTag: (name: string, color?: string): Tag => {
      const tag: Tag = {
        id: generateId('tag'),
        name,
        color: color || getNextTagColor(),
        createdAt: new Date().toISOString()
      };
      data.tags.push(tag);
      saveData();
      return tag;
    },

    renameTag: (id: string, name: string) => {
      const tag = data.tags.find((t) => t.id === id);
      if (tag) {
        tag.name = name;
        saveData();
      }
    },

    changeTagColor: (id: string, color: string) => {
      const tag = data.tags.find((t) => t.id === id);
      if (tag) {
        tag.color = color;
        saveData();
      }
    },

    deleteTag: (id: string) => {
      data.tags = data.tags.filter((t) => t.id !== id);
      Object.keys(data.projectMeta).forEach((projectPath) => {
        data.projectMeta[projectPath].tagIds = data.projectMeta[projectPath].tagIds.filter((tagId) => tagId !== id);
      });
      saveData();
    },

    moveProjectToFolder: (projectPath: string, folderId: string | null) => {
      if (!data.projectMeta[projectPath]) {
        data.projectMeta[projectPath] = { folderId: null, tagIds: [] };
      }
      data.projectMeta[projectPath].folderId = folderId;
      saveData();
    },

    addTagToProject: (projectPath: string, tagId: string) => {
      if (!data.projectMeta[projectPath]) {
        data.projectMeta[projectPath] = { folderId: null, tagIds: [] };
      }
      const meta = data.projectMeta[projectPath];
      if (!meta.tagIds.includes(tagId)) {
        meta.tagIds.push(tagId);
        saveData();
      }
    },

    removeTagFromProject: (projectPath: string, tagId: string) => {
      const meta = data.projectMeta[projectPath];
      if (meta) {
        meta.tagIds = meta.tagIds.filter((id) => id !== tagId);
        saveData();
      }
    },

    getProjectMeta: (projectPath: string): ProjectMeta | null => {
      return data.projectMeta[projectPath] || null;
    },

    getProjectsInFolder: (folderId: string | null): string[] => {
      return Object.keys(data.projectMeta).filter((projectPath) => data.projectMeta[projectPath].folderId === folderId);
    },

    getProjectsWithTag: (tagId: string): string[] => {
      return Object.keys(data.projectMeta).filter((projectPath) =>
        data.projectMeta[projectPath].tagIds.includes(tagId)
      );
    }
  };
}
