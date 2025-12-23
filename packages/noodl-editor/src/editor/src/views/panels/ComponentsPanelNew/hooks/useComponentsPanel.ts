import { useCallback, useMemo, useState } from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { useEventListener } from '../../../../hooks/useEventListener';
import { TreeNode } from '../types';

/**
 * useComponentsPanel
 *
 * Main state management hook for ComponentsPanel.
 * Subscribes to ProjectModel and builds tree structure.
 */

// 🔥 MODULE LOAD MARKER - If you see this, the new code is loaded!
console.log('🔥🔥🔥 useComponentsPanel.ts MODULE LOADED WITH FIXES - Version 2.0 🔥🔥🔥');

// Stable array reference to prevent re-subscription on every render
const PROJECT_EVENTS = ['componentAdded', 'componentRemoved', 'componentRenamed', 'rootNodeChanged'];

interface UseComponentsPanelOptions {
  hideSheets?: string[];
}

interface FolderStructure {
  name: string;
  path: string;
  components: ComponentModel[];
  children: FolderStructure[];
}

export function useComponentsPanel(options: UseComponentsPanelOptions = {}) {
  const { hideSheets = [] } = options;

  // Local state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [updateCounter, setUpdateCounter] = useState(0);

  // Subscribe to ProjectModel events using the new useEventListener hook
  console.log(
    '🔍 useComponentsPanel: About to call useEventListener with ProjectModel.instance:',
    ProjectModel.instance
  );
  useEventListener(ProjectModel.instance, PROJECT_EVENTS, () => {
    console.log('🎉 Event received! Updating counter...');
    setUpdateCounter((c) => c + 1);
  });

  // Build tree structure
  const treeData = useMemo(() => {
    if (!ProjectModel.instance) return [];
    return buildTreeFromProject(ProjectModel.instance, hideSheets);
  }, [updateCounter, hideSheets]);

  // Toggle folder expand/collapse
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Handle item click
  const handleItemClick = useCallback(
    (node: TreeNode) => {
      if (node.type === 'component') {
        setSelectedId(node.data.name);
        // Open component - trigger the NodeGraphEditor to switch to this component
        const component = node.data.component;
        if (component) {
          EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', {
            component,
            pushHistory: true
          });
        }
      } else {
        setSelectedId(node.data.path);
        // Toggle folder if clicking on folder
        toggleFolder(node.data.path);
      }
    },
    [toggleFolder]
  );

  return {
    treeData,
    expandedFolders,
    selectedId,
    toggleFolder,
    handleItemClick
  };
}

/**
 * Build tree structure from ProjectModel
 */
function buildTreeFromProject(project: ProjectModel, hideSheets: string[]): TreeNode[] {
  const rootFolder: FolderStructure = {
    name: '',
    path: '/',
    components: [],
    children: []
  };

  // Get all components
  const components = project.getComponents();

  // Filter by sheet if specified
  const filteredComponents = components.filter((comp) => {
    const sheet = getSheetForComponent(comp.name);
    return !hideSheets.includes(sheet);
  });

  // Add each component to folder structure
  filteredComponents.forEach((comp) => {
    addComponentToFolderStructure(rootFolder, comp);
  });

  // Convert folder structure to tree nodes
  return convertFolderToTreeNodes(rootFolder);
}

/**
 * Add a component to the folder structure
 */
function addComponentToFolderStructure(rootFolder: FolderStructure, component: ComponentModel) {
  const parts = component.name.split('/');
  let currentFolder = rootFolder;

  // Navigate/create folder structure (all parts except the last one)
  for (let i = 0; i < parts.length - 1; i++) {
    const folderName = parts[i];
    let folder = currentFolder.children.find((c) => c.name === folderName);

    if (!folder) {
      folder = {
        name: folderName,
        path: parts.slice(0, i + 1).join('/'),
        components: [],
        children: []
      };
      currentFolder.children.push(folder);
    }

    currentFolder = folder;
  }

  // Add component to final folder
  currentFolder.components.push(component);
}

/**
 * Convert folder structure to tree nodes
 */
function convertFolderToTreeNodes(folder: FolderStructure): TreeNode[] {
  const nodes: TreeNode[] = [];

  // Sort folder children alphabetically
  const sortedChildren = [...folder.children].sort((a, b) => a.name.localeCompare(b.name));

  // Add folder children first
  sortedChildren.forEach((childFolder) => {
    const folderNode: TreeNode = {
      type: 'folder',
      data: {
        name: childFolder.name,
        path: childFolder.path,
        isOpen: false,
        isComponentFolder: childFolder.components.length > 0,
        component: undefined,
        children: convertFolderToTreeNodes(childFolder)
      }
    };
    nodes.push(folderNode);
  });

  // Sort components alphabetically
  const sortedComponents = [...folder.components].sort((a, b) => a.localName.localeCompare(b.localName));

  // Add components
  sortedComponents.forEach((comp) => {
    const isRoot = ProjectModel.instance?.getRootComponent() === comp;
    const isPage = checkIsPage(comp);
    const isCloudFunction = checkIsCloudFunction(comp);
    const isVisual = checkIsVisual(comp);

    const componentNode: TreeNode = {
      type: 'component',
      data: {
        id: comp.id,
        name: comp.name,
        localName: comp.localName,
        component: comp,
        isRoot,
        isPage,
        isCloudFunction,
        isVisual,
        hasWarnings: false, // TODO: Implement warning detection
        path: comp.name
      }
    };
    nodes.push(componentNode);
  });

  return nodes;
}

/**
 * Extract sheet name from component name
 */
function getSheetForComponent(componentName: string): string {
  // Components in sheets have format: SheetName/ComponentName
  if (componentName.includes('/')) {
    return componentName.split('/')[0];
  }
  return 'default';
}

/**
 * Check if component is a page
 */
function checkIsPage(component: ComponentModel): boolean {
  // A component is a page if it has nodes of type 'Page' or 'PageRouter'
  let isPage = false;
  component.forEachNode((node) => {
    if (node.type.name === 'Page' || node.typename === 'Page') {
      isPage = true;
      return true; // Stop iteration
    }
  });
  return isPage;
}

/**
 * Check if component is a cloud function
 */
function checkIsCloudFunction(component: ComponentModel): boolean {
  // A component is a cloud function if it has nodes of type 'Cloud Function'
  let isCloudFunction = false;
  component.forEachNode((node) => {
    if (node.type.name === 'Cloud Function' || node.typename === 'Cloud Function') {
      isCloudFunction = true;
      return true; // Stop iteration
    }
  });
  return isCloudFunction;
}

/**
 * Check if component is visual (has UI elements)
 */
function checkIsVisual(component: ComponentModel): boolean {
  // A component is visual if it's not a cloud function and has visual nodes
  // For now, we'll consider all non-cloud-function components as visual
  return !checkIsCloudFunction(component);
}
