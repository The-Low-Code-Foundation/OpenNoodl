# Phase 4: Drag-Drop

**Estimated Time:** 2 hours  
**Complexity:** High  
**Prerequisites:** Phase 3 complete (context menus working)

## Overview

Implement drag-drop functionality for reorganizing components and folders. Users should be able to drag components into folders, drag folders into other folders, and reorder items. The system should integrate with existing PopupLayer drag system and UndoQueue.

---

## Goals

- ✅ Implement drag initiation on mouse down + move
- ✅ Show drag ghost with item name
- ✅ Implement drop zones on folders and components
- ✅ Validate drop targets (prevent invalid drops)
- ✅ Execute drop operations
- ✅ Create undo actions for all drops
- ✅ Handle cross-sheet drops
- ✅ Show visual feedback for valid/invalid drops

---

## Step 1: Create Drag-Drop Hook

### 1.1 Create `hooks/useDragDrop.ts`

Hook for managing drag-drop state:

```typescript
/**
 * useDragDrop
 *
 * Manages drag-drop state and operations for components/folders.
 * Integrates with PopupLayer.startDragging system.
 */

import PopupLayer from '@noodl-views/popuplayer';
import { useCallback, useState } from 'react';

import { ComponentItemData, FolderItemData, TreeNode } from '../types';

export function useDragDrop() {
  const [draggedItem, setDraggedItem] = useState<TreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<TreeNode | null>(null);

  // Start dragging
  const startDrag = useCallback((item: TreeNode, sourceElement: HTMLElement) => {
    setDraggedItem(item);

    const label = item.type === 'component' ? item.name : `📁 ${item.name}`;

    PopupLayer.instance.startDragging({
      label,
      dragTarget: sourceElement,
      onDragEnd: () => {
        setDraggedItem(null);
        setDropTarget(null);
      }
    });
  }, []);

  // Check if drop is valid
  const canDrop = useCallback(
    (target: TreeNode): boolean => {
      if (!draggedItem) return false;

      // Can't drop on self
      if (draggedItem === target) return false;

      // Folder-specific rules
      if (draggedItem.type === 'folder') {
        // Can't drop folder into its own children
        if (target.type === 'folder' && isDescendant(target, draggedItem)) {
          return false;
        }
      }

      // Component can be dropped on folder
      if (draggedItem.type === 'component' && target.type === 'folder') {
        return true;
      }

      // Folder can be dropped on folder
      if (draggedItem.type === 'folder' && target.type === 'folder') {
        return true;
      }

      return false;
    },
    [draggedItem]
  );

  // Handle drop
  const handleDrop = useCallback(
    (target: TreeNode) => {
      if (!draggedItem || !canDrop(target)) return;

      setDropTarget(target);

      // Drop will be executed by parent component
      // which has access to ProjectModel and UndoQueue
    },
    [draggedItem, canDrop]
  );

  return {
    draggedItem,
    dropTarget,
    startDrag,
    canDrop,
    handleDrop,
    clearDrop: () => setDropTarget(null)
  };
}

/**
 * Check if targetFolder is a descendant of sourceFolder
 */
function isDescendant(targetFolder: FolderItemData, sourceFolder: FolderItemData): boolean {
  if (targetFolder.path.startsWith(sourceFolder.path + '/')) {
    return true;
  }
  return false;
}
```

---

## Step 2: Add Drag Handlers to Components

### 2.1 Update `ComponentItem.tsx`

Add drag initiation:

```typescript
import { useRef } from 'react';

export function ComponentItem({ component, level, isSelected, onClick, onDragStart }: ComponentItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Track mouse down position
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStartPos.current) return;

      // Check if mouse moved enough to start drag
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5 && itemRef.current) {
        onDragStart?.(component, itemRef.current);
        dragStartPos.current = null;
      }
    },
    [component, onDragStart]
  );

  const handleMouseUp = useCallback(() => {
    dragStartPos.current = null;
  }, []);

  return (
    <div
      ref={itemRef}
      className={classNames(css.TreeItem, {
        [css.Selected]: isSelected
      })}
      style={{ paddingLeft: `${indent + 23}px` }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
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

### 2.2 Update `FolderItem.tsx`

Add drag initiation and drop zone:

```typescript
export function FolderItem({
  folder,
  level,
  isExpanded,
  isSelected,
  onCaretClick,
  onClick,
  onDragStart,
  onDrop,
  canAcceptDrop,
  children
}: FolderItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStartPos.current) return;

      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5 && itemRef.current) {
        onDragStart?.(folder, itemRef.current);
        dragStartPos.current = null;
      }
    },
    [folder, onDragStart]
  );

  const handleMouseUp = useCallback(() => {
    dragStartPos.current = null;
  }, []);

  const handleDragEnter = useCallback(() => {
    if (canAcceptDrop?.(folder)) {
      setIsDropTarget(true);
    }
  }, [folder, canAcceptDrop]);

  const handleDragLeave = useCallback(() => {
    setIsDropTarget(false);
  }, []);

  const handleDragDrop = useCallback(() => {
    if (canAcceptDrop?.(folder)) {
      onDrop?.(folder);
      setIsDropTarget(false);
    }
  }, [folder, canAcceptDrop, onDrop]);

  return (
    <>
      <div
        ref={itemRef}
        className={classNames(css.TreeItem, {
          [css.Selected]: isSelected,
          [css.DropTarget]: isDropTarget
        })}
        style={{ paddingLeft: `${indent + 10}px` }}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDragDrop}
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

---

## Step 3: Implement Drop Execution

### 3.1 Create Drop Handler in `useComponentActions.ts`

Add drop execution logic:

```typescript
export function useComponentActions() {
  // ... existing handlers ...

  const handleDropOn = useCallback((draggedItem: TreeNode, targetItem: TreeNode) => {
    if (draggedItem.type === 'component' && targetItem.type === 'folder') {
      // Move component to folder
      const component = draggedItem.component;
      const targetPath = targetItem.path === '/' ? '' : targetItem.path;
      const newName = targetPath ? `${targetPath}/${draggedItem.name}` : draggedItem.name;

      // Check for naming conflicts
      if (ProjectModel.instance.getComponentWithName(newName)) {
        ToastLayer.showError(`Component "${newName}" already exists`);
        return;
      }

      const oldName = component.name;

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${component.name} to ${targetItem.name}`,
          do: () => {
            ProjectModel.instance.renameComponent(component, newName);
          },
          undo: () => {
            ProjectModel.instance.renameComponent(component, oldName);
          }
        })
      );
    } else if (draggedItem.type === 'folder' && targetItem.type === 'folder') {
      // Move folder to folder
      const sourcePath = draggedItem.path;
      const targetPath = targetItem.path === '/' ? '' : targetItem.path;
      const newPath = targetPath ? `${targetPath}/${draggedItem.name}` : draggedItem.name;

      // Get all components in source folder
      const componentsToMove = getComponentsInFolder(sourcePath);

      if (componentsToMove.length === 0) {
        ToastLayer.showInfo('Folder is empty');
        return;
      }

      const renames: Array<{ component: ComponentModel; oldName: string; newName: string }> = [];

      componentsToMove.forEach((comp) => {
        const relativePath = comp.name.substring(sourcePath.length + 1);
        const newName = `${newPath}/${relativePath}`;
        renames.push({ component: comp, oldName: comp.name, newName });
      });

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${draggedItem.name} to ${targetItem.name}`,
          do: () => {
            renames.forEach(({ component, newName }) => {
              ProjectModel.instance.renameComponent(component, newName);
            });
          },
          undo: () => {
            renames.forEach(({ component, oldName }) => {
              ProjectModel.instance.renameComponent(component, oldName);
            });
          }
        })
      );
    }
  }, []);

  return {
    handleMakeHome,
    handleDelete,
    handleDuplicate,
    handleRename,
    handleDropOn
  };
}

function getComponentsInFolder(folderPath: string): ComponentModel[] {
  const components = ProjectModel.instance.getComponents();
  return components.filter((comp) => {
    return comp.name.startsWith(folderPath + '/');
  });
}
```

---

## Step 4: Add Drop Zone Styles

### 4.1 Update `ComponentsPanel.module.scss`

Add drop target styling:

```scss
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

  &.DropTarget {
    background-color: var(--theme-color-primary-transparent);
    border: 2px dashed var(--theme-color-primary);
    border-radius: 4px;
  }

  &.DragOver {
    background-color: var(--theme-color-primary-transparent);
  }
}
```

---

## Step 5: Integrate with ComponentsPanel

### 5.1 Update `ComponentsPanel.tsx`

Wire up drag-drop:

```typescript
export function ComponentsPanel(props: ComponentsPanelProps) {
  const { showSheetList = true, hideSheets = [], componentTitle = 'Components', lockCurrentSheetName } = props;

  const { treeData, expandedFolders, selectedId, toggleFolder, handleItemClick } = useComponentsPanel({
    hideSheets,
    lockCurrentSheetName
  });

  const { handleMakeHome, handleDelete, handleDuplicate, handleRename, handleDropOn } = useComponentActions();

  const { draggedItem, startDrag, canDrop, handleDrop, clearDrop } = useDragDrop();

  // Handle drop completion
  useEffect(() => {
    if (draggedItem && dropTarget) {
      handleDropOn(draggedItem, dropTarget);
      clearDrop();
    }
  }, [draggedItem, dropTarget, handleDropOn, clearDrop]);

  return (
    <div className={css.ComponentsPanel}>
      {/* ... header ... */}

      <div className={css.ComponentsScroller}>
        <div className={css.ComponentsList}>
          <ComponentTree
            nodes={treeData}
            expandedFolders={expandedFolders}
            selectedId={selectedId}
            onItemClick={handleItemClick}
            onCaretClick={toggleFolder}
            onDragStart={startDrag}
            onDrop={handleDrop}
            canAcceptDrop={canDrop}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Step 6: Testing

### 6.1 Verification Checklist

- [ ] Can drag component to folder
- [ ] Can drag folder to folder
- [ ] Cannot drag folder into its own children
- [ ] Cannot drag item onto itself
- [ ] Drop target highlights correctly
- [ ] Invalid drops show no feedback
- [ ] Drop executes correctly
- [ ] Component moves to new location
- [ ] Folder with all contents moves
- [ ] Undo reverses drop
- [ ] Redo re-applies drop
- [ ] No console errors

### 6.2 Test Edge Cases

- [ ] Drag to root level (no folder)
- [ ] Drag component with same name (should error)
- [ ] Drag empty folder
- [ ] Drag folder with deeply nested components
- [ ] Cancel drag (mouse up without drop)
- [ ] Drag across sheets

---

## Common Issues & Solutions

### Issue: Drag doesn't start

**Solution:** Check that mouse down + move distance calculation is correct. Ensure PopupLayer.startDragging is called.

### Issue: Drop doesn't work

**Solution:** Verify that drop zone event handlers are attached. Check canDrop logic.

### Issue: Folder moves but children don't

**Solution:** Ensure getComponentsInFolder finds all nested components and renames them correctly.

### Issue: Undo breaks after drop

**Solution:** Verify that undo action captures all renamed components and restores original names.

---

## Success Criteria

✅ **Phase 4 is complete when:**

1. Components can be dragged to folders
2. Folders can be dragged to folders
3. Invalid drops are prevented
4. Drop target shows visual feedback
5. Drops execute correctly
6. All drops can be undone
7. No console errors

---

## Next Phase

**Phase 5: Inline Rename** - Implement rename-in-place with validation.
