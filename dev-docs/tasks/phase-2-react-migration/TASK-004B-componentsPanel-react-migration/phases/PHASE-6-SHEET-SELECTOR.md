# Phase 6: Sheet Selector

**Estimated Time:** 30 minutes  
**Complexity:** Low  
**Prerequisites:** Phase 5 complete (inline rename working)

## Overview

Implement sheet/tab switching functionality. The sheet selector displays tabs for different sheets and filters the component tree to show only components from the selected sheet. Respects `hideSheets` and `lockCurrentSheetName` props.

---

## Goals

- ✅ Display sheet tabs from ProjectModel
- ✅ Filter component tree by selected sheet
- ✅ Handle sheet selection
- ✅ Respect `hideSheets` prop
- ✅ Respect `lockCurrentSheetName` prop
- ✅ Show/hide based on `showSheetList` prop

---

## Step 1: Create Sheet Selector Component

### 1.1 Create `components/SheetSelector.tsx`

```typescript
/**
 * SheetSelector
 *
 * Displays tabs for project sheets and handles sheet selection.
 */

import classNames from 'classnames';
import React from 'react';

import css from '../ComponentsPanel.module.scss';
import { SheetData } from '../types';

interface SheetSelectorProps {
  sheets: SheetData[];
  selectedSheet: string;
  onSheetSelect: (sheetName: string) => void;
}

export function SheetSelector({ sheets, selectedSheet, onSheetSelect }: SheetSelectorProps) {
  if (sheets.length === 0) {
    return null;
  }

  return (
    <div className={css.SheetsSection}>
      <div className={css.SheetsHeader}>Sheets</div>
      <div className={css.SheetsList}>
        {sheets.map((sheet) => (
          <div
            key={sheet.name}
            className={classNames(css.SheetItem, {
              [css.Selected]: sheet.name === selectedSheet
            })}
            onClick={() => onSheetSelect(sheet.name)}
          >
            {sheet.displayName}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Step 2: Update Panel State Hook

### 2.1 Update `hooks/useComponentsPanel.ts`

Add sheet management:

```typescript
export function useComponentsPanel(options: UseComponentsPanelOptions = {}) {
  const { hideSheets = [], lockCurrentSheetName } = options;

  // Local state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [updateCounter, setUpdateCounter] = useState(0);
  const [currentSheet, setCurrentSheet] = useState<string>(() => {
    if (lockCurrentSheetName) return lockCurrentSheetName;
    return 'default'; // Or get from ProjectModel
  });

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

  // Build sheets list
  const sheets = useMemo(() => {
    return buildSheetsList(ProjectModel.instance, hideSheets);
  }, [updateCounter, hideSheets]);

  // Build tree structure (filtered by current sheet)
  const treeData = useMemo(() => {
    return buildTreeFromProject(ProjectModel.instance, hideSheets, currentSheet);
  }, [updateCounter, hideSheets, currentSheet]);

  // Handle sheet selection
  const handleSheetSelect = useCallback(
    (sheetName: string) => {
      if (!lockCurrentSheetName) {
        setCurrentSheet(sheetName);
      }
    },
    [lockCurrentSheetName]
  );

  return {
    treeData,
    expandedFolders,
    selectedId,
    sheets,
    currentSheet,
    toggleFolder,
    handleItemClick,
    handleSheetSelect
  };
}

/**
 * Build list of sheets from ProjectModel
 */
function buildSheetsList(project: ProjectModel, hideSheets: string[]): SheetData[] {
  const sheets: SheetData[] = [];
  const components = project.getComponents();

  // Extract unique sheet names
  const sheetNames = new Set<string>();
  components.forEach((comp) => {
    const sheetName = getSheetForComponent(comp.name);
    if (!hideSheets.includes(sheetName)) {
      sheetNames.add(sheetName);
    }
  });

  // Convert to SheetData array
  sheetNames.forEach((sheetName) => {
    sheets.push({
      name: sheetName,
      displayName: sheetName === 'default' ? 'Default' : sheetName,
      isDefault: sheetName === 'default',
      isSelected: false // Will be set by parent
    });
  });

  // Sort: default first, then alphabetical
  sheets.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return sheets;
}

function getSheetForComponent(componentName: string): string {
  if (componentName.includes('/')) {
    const parts = componentName.split('/');
    // Check if first part is a sheet name
    // Sheets typically start with uppercase or have specific patterns
    return parts[0];
  }
  return 'default';
}
```

---

## Step 3: Integrate Sheet Selector

### 3.1 Update `ComponentsPanel.tsx`

Add sheet selector to panel:

```typescript
export function ComponentsPanel(props: ComponentsPanelProps) {
  const { showSheetList = true, hideSheets = [], componentTitle = 'Components', lockCurrentSheetName } = props;

  const {
    treeData,
    expandedFolders,
    selectedId,
    sheets,
    currentSheet,
    toggleFolder,
    handleItemClick,
    handleSheetSelect
  } = useComponentsPanel({
    hideSheets,
    lockCurrentSheetName
  });

  // ... other hooks ...

  return (
    <div className={css.ComponentsPanel}>
      <div className={css.Header}>
        <div className={css.Title}>{componentTitle}</div>
        <button ref={setAddButtonRef} className={css.AddButton} title="Add component" onClick={handleAddButtonClick}>
          <div className={css.AddIcon}>+</div>
        </button>
      </div>

      {showSheetList && sheets.length > 0 && (
        <SheetSelector sheets={sheets} selectedSheet={currentSheet} onSheetSelect={handleSheetSelect} />
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
      </div>

      {showAddMenu && addButtonRef && (
        <AddComponentMenu targetElement={addButtonRef} onClose={() => setShowAddMenu(false)} parentPath="" />
      )}
    </div>
  );
}
```

---

## Step 4: Add Sheet Styles

### 4.1 Update `ComponentsPanel.module.scss`

Add sheet selection styling:

```scss
.SheetsSection {
  border-bottom: 1px solid var(--theme-color-border-default);
}

.SheetsHeader {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  font: 11px var(--font-family-bold);
  color: var(--theme-color-fg-default);
  background-color: var(--theme-color-bg-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.SheetsList {
  max-height: 250px;
  overflow-y: auto;
  overflow-x: hidden;
}

.SheetItem {
  padding: 8px 10px 8px 30px;
  font: 11px var(--font-family-regular);
  color: var(--theme-color-fg-default);
  cursor: pointer;
  transition: background-color 0.15s ease;
  user-select: none;

  &:hover {
    background-color: var(--theme-color-bg-3);
  }

  &.Selected {
    background-color: var(--theme-color-primary-transparent);
    color: var(--theme-color-primary);
    font-weight: 600;
  }
}
```

---

## Step 5: Testing

### 5.1 Verification Checklist

- [ ] Sheet tabs appear when `showSheetList` is true
- [ ] Sheet tabs hidden when `showSheetList` is false
- [ ] Correct sheets displayed (excluding hidden sheets)
- [ ] Clicking sheet selects it
- [ ] Selected sheet highlights correctly
- [ ] Component tree filters by selected sheet
- [ ] Default sheet displays first
- [ ] `lockCurrentSheetName` locks to specific sheet
- [ ] No console errors

### 5.2 Test Edge Cases

- [ ] Project with no sheets (only default)
- [ ] Project with many sheets
- [ ] Switching sheets with expanded folders
- [ ] Switching sheets with selected component
- [ ] Locked sheet (should not allow switching)
- [ ] Hidden sheets don't appear

---

## Common Issues & Solutions

### Issue: Sheets don't appear

**Solution:** Check that `showSheetList` prop is true and that ProjectModel has components in sheets.

### Issue: Sheet filtering doesn't work

**Solution:** Verify `buildTreeFromProject` correctly filters components by sheet name.

### Issue: Hidden sheets still appear

**Solution:** Check that `hideSheets` array includes the correct sheet names.

### Issue: Can't switch sheets when locked

**Solution:** This is expected behavior when `lockCurrentSheetName` is set.

---

## Success Criteria

✅ **Phase 6 is complete when:**

1. Sheet tabs display correctly
2. Sheet selection works
3. Component tree filters by selected sheet
4. Hidden sheets are excluded
5. Locked sheet prevents switching
6. showSheetList prop controls visibility
7. No console errors

---

## Next Phase

**Phase 7: Polish & Cleanup** - Final cleanup, remove legacy files, and prepare for TASK-004.
