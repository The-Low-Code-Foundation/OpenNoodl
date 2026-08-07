# Phase 2: Tree Rendering

**Estimated Time:** 1-2 hours  
**Complexity:** Medium  
**Prerequisites:** Phase 1 complete (foundation set up)

## Overview

Connect the ComponentsPanel to ProjectModel and render the actual component tree structure with folders, proper selection handling, and correct icons. This phase brings the panel to life with real data.

---

## Goals

- ✅ Subscribe to ProjectModel events for component changes
- ✅ Build folder/component tree structure from ProjectModel
- ✅ Implement recursive tree rendering
- ✅ Add expand/collapse for folders
- ✅ Implement component selection sync with NodeGraphEditor
- ✅ Show correct icons (home, page, cloud, visual, folder)
- ✅ Handle component warnings display

---

## Step 1: Create Tree Rendering Components

### 1.1 Create `components/ComponentTree.tsx`

Recursive component for rendering the tree:

```typescript
/**
 * ComponentTree
 *
 * Recursively renders the component/folder tree structure.
 */

import React from 'react';

import { TreeNode } from '../types';
import { ComponentItem } from './ComponentItem';
import { FolderItem } from './FolderItem';

interface ComponentTreeProps {
  nodes: TreeNode[];
  level?: number;
  onItemClick: (node: TreeNode) => void;
  onCaretClick: (folderId: string) => void;
  expandedFolders: Set<string>;
  selectedId?: string;
}

export function ComponentTree({
  nodes,
  level = 0,
  onItemClick,
  onCaretClick,
  expandedFolders,
  selectedId
}: ComponentTreeProps) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'folder') {
          return (
            <FolderItem
              key={node.path}
              folder={node}
              level={level}
              isExpanded={expandedFolders.has(node.path)}
              isSelected={selectedId === node.path}
              onCaretClick={() => onCaretClick(node.path)}
              onClick={() => onItemClick(node)}
            >
              {expandedFolders.has(node.path) && node.children.length > 0 && (
                <ComponentTree
                  nodes={node.children}
                  level={level + 1}
                  onItemClick={onItemClick}
                  onCaretClick={onCaretClick}
                  expandedFolders={expandedFolders}
                  selectedId={selectedId}
                />
              )}
            </FolderItem>
          );
        } else {
          return (
            <ComponentItem
              key={node.fullName}
              component={node}
              level={level}
              isSelected={selectedId === node.fullName}
              onClick={() => onItemClick(node)}
            />
          );
        }
      })}
    </>
  );
}
```

### 1.2 Create `components/FolderItem.tsx`

Component for rendering folder rows:

```typescript
/**
 * FolderItem
 *
 * Renders a folder row with expand/collapse caret and nesting.
 */

import classNames from 'classnames';
import React from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import css from '../ComponentsPanel.module.scss';
import { FolderItemData } from '../types';

interface FolderItemProps {
  folder: FolderItemData;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onCaretClick: () => void;
  onClick: () => void;
  children?: React.ReactNode;
}

export function FolderItem({
  folder,
  level,
  isExpanded,
  isSelected,
  onCaretClick,
  onClick,
  children
}: FolderItemProps) {
  const indent = level * 12;

  return (
    <>
      <div
        className={classNames(css.TreeItem, {
          [css.Selected]: isSelected
        })}
        style={{ paddingLeft: `${indent + 10}px` }}
      >
        <div
          className={classNames(css.Caret, {
            [css.Expanded]: isExpanded
          })}
          onClick={(e) => {
            e.stopPropagation();
            onCaretClick();
          }}
        >
          ▶
        </div>
        <div className={css.ItemContent} onClick={onClick}>
          <div className={css.Icon}>{folder.isComponentFolder ? IconName.FolderComponent : IconName.Folder}</div>
          <div className={css.Label}>{folder.name}</div>
          {folder.hasWarnings && <div className={css.Warning}>!</div>}
        </div>
      </div>
      {children}
    </>
  );
}
```

### 1.3 Create `components/ComponentItem.tsx`

Component for rendering component rows:

```typescript
/**
 * ComponentItem
 *
 * Renders a single component row with appropriate icon.
 */

import classNames from 'classnames';
import React from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import css from '../ComponentsPanel.module.scss';
import { ComponentItemData } from '../types';

interface ComponentItemProps {
  component: ComponentItemData;
  level: number;
  isSelected: boolean;
  onClick: () => void;
}

export function ComponentItem({ component, level, isSelected, onClick }: ComponentItemProps) {
  const indent = level * 12;

  // Determine icon based on component type
  let icon = IconName.Component;
  if (component.isRoot) {
    icon = IconName.Home;
  } else if (component.isPage) {
    icon = IconName.Page;
  } else if (component.isCloudFunction) {
    icon = IconName.Cloud;
  } else if (component.isVisual) {
    icon = IconName.Visual;
  }

  return (
    <div
      className={classNames(css.TreeItem, {
        [css.Selected]: isSelected
      })}
      style={{ paddingLeft: `${indent + 23}px` }}
      onClick={onClick}
    >
      <div className={css.ItemContent}>
        <div className={css.Icon}>{icon}</div>
        <div className={css.Label}>{component.name}</div>
        {component.hasWarnings && <div className={css.Warning}>!</div>}
      </div>
    </div>
  );
}
```

---

## Step 2: Create State Management Hook

### 2.1 Create `hooks/useComponentsPanel.ts`

Main hook for managing panel state:

```typescript
/**
 * useComponentsPanel
 *
 * Main state management hook for ComponentsPanel.
 * Subscribes to ProjectModel and builds tree structure.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { ComponentsPanelFolder } from '../../componentspanel/ComponentsPanelFolder';
import { ComponentItemData, FolderItemData, TreeNode } from '../types';

interface UseComponentsPanelOptions {
  hideSheets?: string[];
  lockCurrentSheetName?: string;
}

export function useComponentsPanel(options: UseComponentsPanelOptions = {}) {
  const { hideSheets = [], lockCurrentSheetName } = options;

  // Local state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [updateCounter, setUpdateCounter] = useState(0);

  // Subscribe to ProjectModel events
  useEffect(() => {
    const handleUpdate = () => {
      setUpdateCounter((c) => c + 1);
    };

    ProjectModel.instance.on('componentAdded', handleUpdate);
    ProjectModel.instance.on('componentRemoved', handleUpdate);
    ProjectModel.instance.on('componentRenamed', handleUpdate);
    ProjectModel.instance.on('rootComponentChanged', handleUpdate);

    return () => {
      ProjectModel.instance.off('componentAdded', handleUpdate);
      ProjectModel.instance.off('componentRemoved', handleUpdate);
      ProjectModel.instance.off('componentRenamed', handleUpdate);
      ProjectModel.instance.off('rootComponentChanged', handleUpdate);
    };
  }, []);

  // Build tree structure
  const treeData = useMemo(() => {
    return buildTreeFromProject(ProjectModel.instance, hideSheets, lockCurrentSheetName);
  }, [updateCounter, hideSheets, lockCurrentSheetName]);

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
  const handleItemClick = useCallback((node: TreeNode) => {
    if (node.type === 'component') {
      setSelectedId(node.fullName);
      // TODO: Open component in NodeGraphEditor
    } else {
      setSelectedId(node.path);
    }
  }, []);

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
 * Port logic from ComponentsPanel.ts addComponentToFolderStructure
 */
function buildTreeFromProject(project: ProjectModel, hideSheets: string[], lockSheet?: string): TreeNode[] {
  // TODO: Implement tree building logic
  // This will port the logic from legacy ComponentsPanel.ts
  // For now, return placeholder structure
  return [];
}
```

---

## Step 3: Add Styles for Tree Items

### 3.1 Update `ComponentsPanel.module.scss`

Add styles for tree items:

```scss
/* Tree items */
.TreeItem {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  font: 11px var(--font-family-regular);
  color: var(--theme-color-fg-default);
  user-select: none;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--theme-color-bg-3);
  }

  &.Selected {
    background-color: var(--theme-color-primary-transparent);
    color: var(--theme-color-primary);
  }
}

.Caret {
  width: 12px;
  height: 12px;
  margin-right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: var(--theme-color-fg-muted);
  transition: transform 0.15s ease;

  &.Expanded {
    transform: rotate(90deg);
  }
}

.ItemContent {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 6px;
}

.Icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-color-fg-default);
}

.Label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.Warning {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--theme-color-warning);
  color: var(--theme-color-bg-1);
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
}
```

---

## Step 4: Integrate Tree Rendering

### 4.1 Update `ComponentsPanel.tsx`

Replace placeholder content with actual tree:

```typescript
import React from 'react';

import { ComponentTree } from './components/ComponentTree';
import css from './ComponentsPanel.module.scss';
import { useComponentsPanel } from './hooks/useComponentsPanel';
import { ComponentsPanelProps } from './types';

export function ComponentsPanel(props: ComponentsPanelProps) {
  const {
    nodeGraphEditor,
    showSheetList = true,
    hideSheets = [],
    componentTitle = 'Components',
    lockCurrentSheetName
  } = props;

  const { treeData, expandedFolders, selectedId, toggleFolder, handleItemClick } = useComponentsPanel({
    hideSheets,
    lockCurrentSheetName
  });

  return (
    <div className={css.ComponentsPanel}>
      <div className={css.Header}>
        <div className={css.Title}>{componentTitle}</div>
        <button className={css.AddButton} title="Add component">
          <div className={css.AddIcon}>+</div>
        </button>
      </div>

      {showSheetList && (
        <div className={css.SheetsSection}>
          <div className={css.SheetsHeader}>Sheets</div>
          <div className={css.SheetsList}>{/* TODO: Implement sheet selector in Phase 6 */}</div>
        </div>
      )}

      <div className={css.ComponentsHeader}>
        <div className={css.Title}>Components</div>
      </div>

      <div className={css.ComponentsScroller}>
        <div className={css.ComponentsList}>
          <ComponentTree
            nodes={treeData}
            expandedFolders={expandedFolders}
            selectedId={selectedId}
            onItemClick={handleItemClick}
            onCaretClick={toggleFolder}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Step 5: Port Tree Building Logic

### 5.1 Implement `buildTreeFromProject`

Port logic from legacy `ComponentsPanel.ts`:

```typescript
function buildTreeFromProject(project: ProjectModel, hideSheets: string[], lockSheet?: string): TreeNode[] {
  const rootFolder = new ComponentsPanelFolder({ path: '/', name: '' });

  // Get all components
  const components = project.getComponents();

  // Filter by sheet if specified
  const filteredComponents = components.filter((comp) => {
    const sheet = getSheetForComponent(comp.name);
    if (hideSheets.includes(sheet)) return false;
    if (lockSheet && sheet !== lockSheet) return false;
    return true;
  });

  // Add each component to folder structure
  filteredComponents.forEach((comp) => {
    addComponentToFolderStructure(rootFolder, comp, project);
  });

  // Convert folder structure to tree nodes
  return convertFolderToTreeNodes(rootFolder);
}

function addComponentToFolderStructure(
  rootFolder: ComponentsPanelFolder,
  component: ComponentModel,
  project: ProjectModel
) {
  const parts = component.name.split('/');
  let currentFolder = rootFolder;

  // Navigate/create folder structure
  for (let i = 0; i < parts.length - 1; i++) {
    const folderName = parts[i];
    let folder = currentFolder.children.find((c) => c.name === folderName);

    if (!folder) {
      folder = new ComponentsPanelFolder({
        path: parts.slice(0, i + 1).join('/'),
        name: folderName
      });
      currentFolder.children.push(folder);
    }

    currentFolder = folder;
  }

  // Add component to final folder
  currentFolder.components.push(component);
}

function convertFolderToTreeNodes(folder: ComponentsPanelFolder): TreeNode[] {
  const nodes: TreeNode[] = [];

  // Add folder children first
  folder.children.forEach((childFolder) => {
    const folderNode: FolderItemData = {
      type: 'folder',
      folder: childFolder,
      name: childFolder.name,
      path: childFolder.path,
      isOpen: false,
      isSelected: false,
      isRoot: childFolder.path === '/',
      isPage: false,
      isCloudFunction: false,
      isVisual: true,
      isComponentFolder: childFolder.components.length > 0,
      canBecomeRoot: false,
      hasWarnings: false,
      children: convertFolderToTreeNodes(childFolder)
    };
    nodes.push(folderNode);
  });

  // Add components
  folder.components.forEach((comp) => {
    const componentNode: ComponentItemData = {
      type: 'component',
      component: comp,
      folder: folder,
      name: comp.name.split('/').pop() || comp.name,
      fullName: comp.name,
      isSelected: false,
      isRoot: ProjectModel.instance.getRootComponent() === comp,
      isPage: comp.type === 'Page',
      isCloudFunction: comp.type === 'CloudFunction',
      isVisual: comp.type !== 'Logic',
      canBecomeRoot: true,
      hasWarnings: false // TODO: Implement warning detection
    };
    nodes.push(componentNode);
  });

  return nodes;
}

function getSheetForComponent(componentName: string): string {
  // Extract sheet from component name
  // Components in sheets have format: SheetName/ComponentName
  if (componentName.includes('/')) {
    return componentName.split('/')[0];
  }
  return 'default';
}
```

---

## Step 6: Testing

### 6.1 Verification Checklist

- [ ] Tree renders with correct folder structure
- [ ] Components appear under correct folders
- [ ] Clicking caret expands/collapses folders
- [ ] Clicking component selects it
- [ ] Home icon appears for root component
- [ ] Page icon appears for page components
- [ ] Cloud icon appears for cloud functions
- [ ] Visual icon appears for visual components
- [ ] Folder icons appear correctly
- [ ] Folder+component icon for folders that are also components
- [ ] Warning icons appear (when implemented)
- [ ] No console errors

### 6.2 Test Edge Cases

- [ ] Empty project (no components)
- [ ] Deep folder nesting
- [ ] Component names with special characters
- [ ] Sheet filtering works correctly
- [ ] Hidden sheets are excluded

---

## Common Issues & Solutions

### Issue: Tree doesn't update when components change

**Solution:** Verify ProjectModel event subscriptions are correct and updateCounter increments.

### Issue: Folders don't expand

**Solution:** Check that `expandedFolders` Set is being updated correctly and ComponentTree receives updated props.

### Issue: Icons not showing

**Solution:** Verify Icon component import and that IconName values are correct.

### Issue: Selection doesn't work

**Solution:** Check that `selectedId` is being set correctly and CSS `.Selected` class is applied.

---

## Success Criteria

✅ **Phase 2 is complete when:**

1. Component tree renders with actual project data
2. Folders expand and collapse correctly
3. Components can be selected
4. All icons display correctly
5. Selection highlights correctly
6. Tree updates when project changes
7. No console errors or warnings

---

## Next Phase

**Phase 3: Context Menus** - Add context menu functionality for components and folders.
