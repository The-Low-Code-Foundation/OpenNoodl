# Phase 3: Context Menus

**Estimated Time:** 1 hour  
**Complexity:** Low  
**Prerequisites:** Phase 2 complete (tree rendering working)

## Overview

Add context menu functionality for components and folders, including add component menu, rename, duplicate, delete, and make home actions. All actions should integrate with UndoQueue for proper undo/redo support.

---

## Goals

- ✅ Implement header "+" button menu
- ✅ Implement component right-click context menu
- ✅ Implement folder right-click context menu
- ✅ Wire up add component action
- ✅ Wire up rename action
- ✅ Wire up duplicate action
- ✅ Wire up delete action
- ✅ Wire up make home action
- ✅ All actions use UndoQueue

---

## Step 1: Create Add Component Menu

### 1.1 Create `components/AddComponentMenu.tsx`

Menu for adding new components/folders:

```typescript
/**
 * AddComponentMenu
 *
 * Dropdown menu for adding new components or folders.
 * Integrates with ComponentTemplates system.
 */

import PopupLayer from '@noodl-views/popuplayer';
import React, { useCallback } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import { ComponentTemplates } from '../../componentspanel/ComponentTemplates';

interface AddComponentMenuProps {
  targetElement: HTMLElement;
  onClose: () => void;
  parentPath?: string;
}

export function AddComponentMenu({ targetElement, onClose, parentPath = '' }: AddComponentMenuProps) {
  const handleAddComponent = useCallback(
    (templateId: string) => {
      const template = ComponentTemplates.instance.getTemplate(templateId);
      if (!template) return;

      // TODO: Create component with template
      // This will integrate with ProjectModel
      console.log('Add component:', templateId, 'at path:', parentPath);

      onClose();
    },
    [parentPath, onClose]
  );

  const handleAddFolder = useCallback(() => {
    // TODO: Create new folder
    console.log('Add folder at path:', parentPath);
    onClose();
  }, [parentPath, onClose]);

  // Build menu items from templates
  const templates = ComponentTemplates.instance.getTemplates();
  const menuItems = templates.map((template) => ({
    icon: template.icon || IconName.Component,
    label: template.displayName || template.name,
    onClick: () => handleAddComponent(template.id)
  }));

  // Add folder option
  menuItems.push(
    { type: 'divider' as const },
    {
      icon: IconName.Folder,
      label: 'Folder',
      onClick: handleAddFolder
    }
  );

  // Show popup menu
  const menu = new PopupLayer.PopupMenu({ items: menuItems });

  PopupLayer.instance.showPopup({
    content: menu,
    attachTo: targetElement,
    position: 'bottom'
  });

  return null;
}
```

---

## Step 2: Add Context Menu Handlers

### 2.1 Update `ComponentItem.tsx`

Add right-click handler:

```typescript
export function ComponentItem({ component, level, isSelected, onClick }: ComponentItemProps) {
  const indent = level * 12;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const menuItems = buildComponentContextMenu(component);
      const menu = new PopupLayer.PopupMenu({ items: menuItems });

      PopupLayer.instance.showPopup({
        content: menu,
        attachTo: e.currentTarget as HTMLElement,
        position: { x: e.clientX, y: e.clientY }
      });
    },
    [component]
  );

  // ... existing code ...

  return (
    <div
      className={classNames(css.TreeItem, {
        [css.Selected]: isSelected
      })}
      style={{ paddingLeft: `${indent + 23}px` }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      {/* ... existing content ... */}
    </div>
  );
}

function buildComponentContextMenu(component: ComponentItemData) {
  return [
    {
      icon: IconName.Plus,
      label: 'Add',
      onClick: () => {
        // TODO: Show add submenu
      }
    },
    { type: 'divider' as const },
    {
      icon: IconName.Home,
      label: 'Make Home',
      disabled: component.isRoot || !component.canBecomeRoot,
      onClick: () => {
        // TODO: Make component home
      }
    },
    { type: 'divider' as const },
    {
      icon: IconName.Edit,
      label: 'Rename',
      onClick: () => {
        // TODO: Enable rename mode
      }
    },
    {
      icon: IconName.Copy,
      label: 'Duplicate',
      onClick: () => {
        // TODO: Duplicate component
      }
    },
    { type: 'divider' as const },
    {
      icon: IconName.Trash,
      label: 'Delete',
      onClick: () => {
        // TODO: Delete component
      }
    }
  ];
}
```

### 2.2 Update `FolderItem.tsx`

Add right-click handler:

```typescript
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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const menuItems = buildFolderContextMenu(folder);
      const menu = new PopupLayer.PopupMenu({ items: menuItems });

      PopupLayer.instance.showPopup({
        content: menu,
        attachTo: e.currentTarget as HTMLElement,
        position: { x: e.clientX, y: e.clientY }
      });
    },
    [folder]
  );

  return (
    <>
      <div
        className={classNames(css.TreeItem, {
          [css.Selected]: isSelected
        })}
        style={{ paddingLeft: `${indent + 10}px` }}
        onContextMenu={handleContextMenu}
      >
        {/* ... existing content ... */}
      </div>
      {children}
    </>
  );
}

function buildFolderContextMenu(folder: FolderItemData) {
  return [
    {
      icon: IconName.Plus,
      label: 'Add',
      onClick: () => {
        // TODO: Show add submenu at folder path
      }
    },
    { type: 'divider' as const },
    {
      icon: IconName.Home,
      label: 'Make Home',
      disabled: !folder.isComponentFolder || !folder.canBecomeRoot,
      onClick: () => {
        // TODO: Make folder component home
      }
    },
    { type: 'divider' as const },
    {
      icon: IconName.Edit,
      label: 'Rename',
      onClick: () => {
        // TODO: Enable rename mode for folder
      }
    },
    {
      icon: IconName.Copy,
      label: 'Duplicate',
      onClick: () => {
        // TODO: Duplicate folder
      }
    },
    { type: 'divider' as const },
    {
      icon: IconName.Trash,
      label: 'Delete',
      onClick: () => {
        // TODO: Delete folder and contents
      }
    }
  ];
}
```

---

## Step 3: Implement Action Handlers

### 3.1 Create `hooks/useComponentActions.ts`

Hook for handling component actions:

```typescript
/**
 * useComponentActions
 *
 * Provides handlers for component/folder actions.
 * Integrates with UndoQueue for all operations.
 */

import { ToastLayer } from '@noodl-views/ToastLayer/ToastLayer';
import { useCallback } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';

import { ComponentItemData, FolderItemData } from '../types';

export function useComponentActions() {
  const handleMakeHome = useCallback((item: ComponentItemData | FolderItemData) => {
    const componentName = item.type === 'component' ? item.fullName : item.path;
    const component = ProjectModel.instance.getComponentWithName(componentName);

    if (!component) {
      ToastLayer.showError('Component not found');
      return;
    }

    const previousRoot = ProjectModel.instance.getRootComponent();

    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Make ${component.name} home`,
        do: () => {
          ProjectModel.instance.setRootComponent(component);
        },
        undo: () => {
          if (previousRoot) {
            ProjectModel.instance.setRootComponent(previousRoot);
          }
        }
      })
    );
  }, []);

  const handleDelete = useCallback((item: ComponentItemData | FolderItemData) => {
    const itemName = item.type === 'component' ? item.name : item.name;

    // Confirm deletion
    const confirmed = confirm(`Are you sure you want to delete "${itemName}"?`);
    if (!confirmed) return;

    if (item.type === 'component') {
      const component = item.component;

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Delete ${component.name}`,
          do: () => {
            ProjectModel.instance.removeComponent(component);
          },
          undo: () => {
            ProjectModel.instance.addComponent(component);
          }
        })
      );
    } else {
      // TODO: Delete folder and all contents
      ToastLayer.showInfo('Folder deletion not yet implemented');
    }
  }, []);

  const handleDuplicate = useCallback((item: ComponentItemData | FolderItemData) => {
    if (item.type === 'component') {
      const component = item.component;
      const newName = ProjectModel.instance.findUniqueComponentName(component.name + ' Copy');

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Duplicate ${component.name}`,
          do: () => {
            const duplicated = ProjectModel.instance.duplicateComponent(component, newName);
            return duplicated;
          },
          undo: (duplicated) => {
            if (duplicated) {
              ProjectModel.instance.removeComponent(duplicated);
            }
          }
        })
      );
    } else {
      // TODO: Duplicate folder and all contents
      ToastLayer.showInfo('Folder duplication not yet implemented');
    }
  }, []);

  const handleRename = useCallback((item: ComponentItemData | FolderItemData) => {
    // This will be implemented in Phase 5: Inline Rename
    console.log('Rename:', item);
  }, []);

  return {
    handleMakeHome,
    handleDelete,
    handleDuplicate,
    handleRename
  };
}
```

---

## Step 4: Wire Up Actions

### 4.1 Update `ComponentsPanel.tsx`

Integrate action handlers:

```typescript
import React, { useCallback, useState } from 'react';

import { ComponentTree } from './components/ComponentTree';
import css from './ComponentsPanel.module.scss';
import { useComponentActions } from './hooks/useComponentActions';
import { useComponentsPanel } from './hooks/useComponentsPanel';
import { ComponentsPanelProps } from './types';

export function ComponentsPanel(props: ComponentsPanelProps) {
  const { showSheetList = true, hideSheets = [], componentTitle = 'Components', lockCurrentSheetName } = props;

  const { treeData, expandedFolders, selectedId, toggleFolder, handleItemClick } = useComponentsPanel({
    hideSheets,
    lockCurrentSheetName
  });

  const { handleMakeHome, handleDelete, handleDuplicate, handleRename } = useComponentActions();

  const [addButtonRef, setAddButtonRef] = useState<HTMLButtonElement | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleAddButtonClick = useCallback(() => {
    setShowAddMenu(true);
  }, []);

  return (
    <div className={css.ComponentsPanel}>
      <div className={css.Header}>
        <div className={css.Title}>{componentTitle}</div>
        <button ref={setAddButtonRef} className={css.AddButton} title="Add component" onClick={handleAddButtonClick}>
          <div className={css.AddIcon}>+</div>
        </button>
      </div>

      {/* ... rest of component ... */}

      {showAddMenu && addButtonRef && (
        <AddComponentMenu targetElement={addButtonRef} onClose={() => setShowAddMenu(false)} parentPath="" />
      )}
    </div>
  );
}
```

---

## Step 5: Testing

### 5.1 Verification Checklist

- [ ] Header "+" button shows add menu
- [ ] Add menu includes all component templates
- [ ] Add menu includes "Folder" option
- [ ] Right-click on component shows context menu
- [ ] Right-click on folder shows context menu
- [ ] "Make Home" action works (and is disabled appropriately)
- [ ] "Rename" action triggers (implementation in Phase 5)
- [ ] "Duplicate" action works
- [ ] "Delete" action works with confirmation
- [ ] All actions can be undone
- [ ] All actions can be redone
- [ ] No console errors

### 5.2 Test Edge Cases

- [ ] Try to make home on component that can't be home
- [ ] Try to delete root component (should prevent or handle)
- [ ] Duplicate component with same name (should auto-rename)
- [ ] Delete last component in folder
- [ ] Context menu closes when clicking outside

---

## Common Issues & Solutions

### Issue: Context menu doesn't appear

**Solution:** Check that `onContextMenu` handler is attached and `e.preventDefault()` is called.

### Issue: Menu appears in wrong position

**Solution:** Verify PopupLayer position parameters. Use `{ x: e.clientX, y: e.clientY }` for mouse position.

### Issue: Actions don't work

**Solution:** Check that ProjectModel methods are being called correctly and UndoQueue integration is proper.

### Issue: Undo doesn't work

**Solution:** Verify that UndoActionGroup is created correctly with both `do` and `undo` functions.

---

## Success Criteria

✅ **Phase 3 is complete when:**

1. Header "+" button shows add menu
2. All context menus work correctly
3. Make home action works
4. Delete action works with confirmation
5. Duplicate action works
6. All actions integrate with UndoQueue
7. Undo/redo works for all actions
8. No console errors

---

## Next Phase

**Phase 4: Drag-Drop** - Implement drag-drop functionality for reorganizing components and folders.
