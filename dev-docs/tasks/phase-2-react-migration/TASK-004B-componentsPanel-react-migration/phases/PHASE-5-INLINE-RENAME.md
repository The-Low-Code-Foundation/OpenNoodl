# Phase 5: Inline Rename

**Estimated Time:** 1 hour  
**Complexity:** Medium  
**Prerequisites:** Phase 4 complete (drag-drop working)

## Overview

Implement inline rename functionality allowing users to double-click or use context menu to rename components and folders directly in the tree. Includes validation for duplicate names and proper undo support.

---

## Goals

- ✅ Implement rename mode state management
- ✅ Show inline input field on rename trigger
- ✅ Handle Enter to confirm, Escape to cancel
- ✅ Validate name uniqueness
- ✅ Handle focus management
- ✅ Integrate with UndoQueue
- ✅ Support both component and folder rename

---

## Step 1: Create Rename Hook

### 1.1 Create `hooks/useRenameMode.ts`

```typescript
/**
 * useRenameMode
 *
 * Manages inline rename state and validation.
 */

import { ToastLayer } from '@noodl-views/ToastLayer/ToastLayer';
import { useCallback, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { TreeNode } from '../types';

export function useRenameMode() {
  const [renamingItem, setRenamingItem] = useState<TreeNode | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const startRename = useCallback((item: TreeNode) => {
    setRenamingItem(item);
    setRenameValue(item.name);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingItem(null);
    setRenameValue('');
  }, []);

  const validateName = useCallback(
    (newName: string): { valid: boolean; error?: string } => {
      if (!newName || newName.trim() === '') {
        return { valid: false, error: 'Name cannot be empty' };
      }

      if (newName === renamingItem?.name) {
        return { valid: true }; // No change
      }

      // Check for invalid characters
      if (/[<>:"|?*\\]/.test(newName)) {
        return { valid: false, error: 'Name contains invalid characters' };
      }

      // Check for duplicate name
      if (renamingItem?.type === 'component') {
        const folder = renamingItem.folder;
        const folderPath = folder.path === '/' ? '' : folder.path;
        const fullName = folderPath ? `${folderPath}/${newName}` : newName;

        if (ProjectModel.instance.getComponentWithName(fullName)) {
          return { valid: false, error: 'A component with this name already exists' };
        }
      } else if (renamingItem?.type === 'folder') {
        // Check for duplicate folder
        const parentPath = renamingItem.path.substring(0, renamingItem.path.lastIndexOf('/'));
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        const components = ProjectModel.instance.getComponents();
        const hasConflict = components.some((comp) => comp.name.startsWith(newPath + '/'));

        if (hasConflict) {
          // Check if it's just the same folder
          if (newPath !== renamingItem.path) {
            return { valid: false, error: 'A folder with this name already exists' };
          }
        }
      }

      return { valid: true };
    },
    [renamingItem]
  );

  return {
    renamingItem,
    renameValue,
    setRenameValue,
    startRename,
    cancelRename,
    validateName
  };
}
```

---

## Step 2: Create Rename Input Component

### 2.1 Create `components/RenameInput.tsx`

```typescript
/**
 * RenameInput
 *
 * Inline input field for renaming components/folders.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import css from '../ComponentsPanel.module.scss';

interface RenameInputProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  level: number;
}

export function RenameInput({ value, onChange, onConfirm, onCancel, level }: RenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const indent = level * 12;

  // Auto-focus and select all on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [onConfirm, onCancel]
  );

  const handleBlur = useCallback(() => {
    // Cancel on blur
    onCancel();
  }, [onCancel]);

  return (
    <div className={css.RenameContainer} style={{ paddingLeft: `${indent + 23}px` }}>
      <input
        ref={inputRef}
        type="text"
        className={css.RenameInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}
```

---

## Step 3: Integrate Rename into Tree Items

### 3.1 Update `ComponentItem.tsx`

Add double-click and rename mode:

```typescript
export function ComponentItem({
  component,
  level,
  isSelected,
  onClick,
  onDragStart,
  onDoubleClick,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel
}: ComponentItemProps) {
  // ... existing code ...

  if (isRenaming) {
    return (
      <RenameInput
        value={renameValue}
        onChange={onRenameChange}
        onConfirm={onRenameConfirm}
        onCancel={onRenameCancel}
        level={level}
      />
    );
  }

  return (
    <div
      ref={itemRef}
      className={classNames(css.TreeItem, {
        [css.Selected]: isSelected
      })}
      style={{ paddingLeft: `${indent + 23}px` }}
      onClick={onClick}
      onDoubleClick={() => onDoubleClick?.(component)}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* ... existing content ... */}
    </div>
  );
}
```

### 3.2 Update `FolderItem.tsx`

Add double-click and rename mode:

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
  onDoubleClick,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  children
}: FolderItemProps) {
  // ... existing code ...

  if (isRenaming) {
    return (
      <>
        <RenameInput
          value={renameValue}
          onChange={onRenameChange}
          onConfirm={onRenameConfirm}
          onCancel={onRenameCancel}
          level={level}
        />
        {children}
      </>
    );
  }

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
        onDoubleClick={() => onDoubleClick?.(folder)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDragDrop}
      >
        {/* ... existing content ... */}
      </div>
      {children}
    </>
  );
}
```

---

## Step 4: Implement Rename Execution

### 4.1 Update `useComponentActions.ts`

Complete the rename handler:

```typescript
const handleRename = useCallback((item: TreeNode, newName: string) => {
  if (item.type === 'component') {
    const component = item.component;
    const folder = item.folder;
    const folderPath = folder.path === '/' ? '' : folder.path;
    const newFullName = folderPath ? `${folderPath}/${newName}` : newName;
    const oldName = component.name;

    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Rename ${component.name} to ${newName}`,
        do: () => {
          ProjectModel.instance.renameComponent(component, newFullName);
        },
        undo: () => {
          ProjectModel.instance.renameComponent(component, oldName);
        }
      })
    );
  } else if (item.type === 'folder') {
    // Rename folder (rename all components in folder)
    const oldPath = item.path;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    const components = ProjectModel.instance.getComponents();
    const componentsToRename = components.filter((comp) => comp.name.startsWith(oldPath + '/'));

    if (componentsToRename.length === 0) {
      ToastLayer.showInfo('Folder is empty');
      return;
    }

    const renames = componentsToRename.map((comp) => ({
      component: comp,
      oldName: comp.name,
      newName: comp.name.replace(oldPath, newPath)
    }));

    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Rename folder ${item.name} to ${newName}`,
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
```

---

## Step 5: Add Rename Styles

### 5.1 Update `ComponentsPanel.module.scss`

```scss
.RenameContainer {
  display: flex;
  align-items: center;
  padding: 6px 10px;
}

.RenameInput {
  flex: 1;
  padding: 4px 8px;
  font: 11px var(--font-family-regular);
  color: var(--theme-color-fg-default);
  background-color: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-primary);
  border-radius: 3px;
  outline: none;

  &:focus {
    border-color: var(--theme-color-primary);
    box-shadow: 0 0 0 2px var(--theme-color-primary-transparent);
  }
}
```

---

## Step 6: Wire Up Rename

### 6.1 Update `ComponentsPanel.tsx`

```typescript
export function ComponentsPanel(props: ComponentsPanelProps) {
  const { treeData, expandedFolders, selectedId, toggleFolder, handleItemClick } = useComponentsPanel({
    hideSheets,
    lockCurrentSheetName
  });

  const { handleMakeHome, handleDelete, handleDuplicate, handleRename, handleDropOn } = useComponentActions();

  const { renamingItem, renameValue, setRenameValue, startRename, cancelRename, validateName } = useRenameMode();

  const handleRenameConfirm = useCallback(() => {
    if (!renamingItem) return;

    const validation = validateName(renameValue);
    if (!validation.valid) {
      ToastLayer.showError(validation.error || 'Invalid name');
      return;
    }

    if (renameValue !== renamingItem.name) {
      handleRename(renamingItem, renameValue);
    }

    cancelRename();
  }, [renamingItem, renameValue, validateName, handleRename, cancelRename]);

  return (
    <div className={css.ComponentsPanel}>
      {/* ... */}

      <ComponentTree
        nodes={treeData}
        expandedFolders={expandedFolders}
        selectedId={selectedId}
        onItemClick={handleItemClick}
        onCaretClick={toggleFolder}
        onDragStart={startDrag}
        onDrop={handleDrop}
        canAcceptDrop={canDrop}
        onDoubleClick={startRename}
        renamingItem={renamingItem}
        renameValue={renameValue}
        onRenameChange={setRenameValue}
        onRenameConfirm={handleRenameConfirm}
        onRenameCancel={cancelRename}
      />
    </div>
  );
}
```

---

## Step 7: Testing

### 7.1 Verification Checklist

- [ ] Double-click on component triggers rename
- [ ] Double-click on folder triggers rename
- [ ] Context menu "Rename" triggers rename
- [ ] Input field appears with current name
- [ ] Text is selected on focus
- [ ] Enter confirms rename
- [ ] Escape cancels rename
- [ ] Click outside cancels rename
- [ ] Empty name shows error
- [ ] Duplicate name shows error
- [ ] Invalid characters show error
- [ ] Successful rename updates tree
- [ ] Rename can be undone
- [ ] Folder rename updates all child components

---

## Success Criteria

✅ **Phase 5 is complete when:**

1. Double-click triggers rename mode
2. Inline input appears with current name
3. Enter confirms, Escape cancels
4. Name validation works correctly
5. Renames execute and update tree
6. All renames can be undone
7. No console errors

---

## Next Phase

**Phase 6: Sheet Selector** - Implement sheet/tab switching functionality.
