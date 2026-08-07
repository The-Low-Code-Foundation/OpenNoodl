# Phase 1: Foundation

**Estimated Time:** 1-2 hours  
**Complexity:** Low  
**Prerequisites:** None

## Overview

Set up the basic directory structure, TypeScript interfaces, and a minimal React component that can be registered with SidebarModel. By the end of this phase, the panel should mount in the sidebar showing placeholder content.

---

## Goals

- ✅ Create directory structure for new React component
- ✅ Define TypeScript interfaces for component data
- ✅ Create minimal ComponentsPanel React component
- ✅ Register component with SidebarModel
- ✅ Port base CSS styles to SCSS module
- ✅ Verify panel mounts without errors

---

## Step 1: Create Directory Structure

### 1.1 Create Main Directory

```bash
mkdir -p packages/noodl-editor/src/editor/src/views/panels/ComponentsPanel
cd packages/noodl-editor/src/editor/src/views/panels/ComponentsPanel
```

### 1.2 Create Subdirectories

```bash
mkdir components
mkdir hooks
```

### Final Structure

```
ComponentsPanel/
├── components/       # UI components
├── hooks/           # React hooks
├── ComponentsPanel.tsx
├── ComponentsPanel.module.scss
├── types.ts
└── index.ts
```

---

## Step 2: Define TypeScript Interfaces

### 2.1 Create `types.ts`

Create comprehensive type definitions:

```typescript
import { ComponentModel } from '@noodl-models/componentmodel';

import { ComponentsPanelFolder } from '../componentspanel/ComponentsPanelFolder';

/**
 * Props accepted by ComponentsPanel component
 */
export interface ComponentsPanelProps {
  /** Current node graph editor instance */
  nodeGraphEditor?: TSFixme;

  /** Lock to a specific sheet */
  lockCurrentSheetName?: string;

  /** Show the sheet section */
  showSheetList: boolean;

  /** List of sheets we want to hide */
  hideSheets?: string[];

  /** Change the title of the component header */
  componentTitle?: string;
}

/**
 * Data for rendering a component item
 */
export interface ComponentItemData {
  type: 'component';
  component: ComponentModel;
  folder: ComponentsPanelFolder;
  name: string;
  fullName: string;
  isSelected: boolean;
  isRoot: boolean;
  isPage: boolean;
  isCloudFunction: boolean;
  isVisual: boolean;
  canBecomeRoot: boolean;
  hasWarnings: boolean;
  // Future: migration status for TASK-004
  // migrationStatus?: 'needs-review' | 'ai-migrated' | 'auto' | 'manually-fixed';
}

/**
 * Data for rendering a folder item
 */
export interface FolderItemData {
  type: 'folder';
  folder: ComponentsPanelFolder;
  name: string;
  path: string;
  isOpen: boolean;
  isSelected: boolean;
  isRoot: boolean;
  isPage: boolean;
  isCloudFunction: boolean;
  isVisual: boolean;
  isComponentFolder: boolean; // Folder that also has a component
  canBecomeRoot: boolean;
  hasWarnings: boolean;
  children: TreeNode[];
}

/**
 * Tree node can be either component or folder
 */
export type TreeNode = ComponentItemData | FolderItemData;

/**
 * Sheet/tab information
 */
export interface SheetData {
  name: string;
  displayName: string;
  folder: ComponentsPanelFolder;
  isDefault: boolean;
  isSelected: boolean;
}

/**
 * Context menu item configuration
 */
export interface ContextMenuItem {
  icon?: string;
  label: string;
  onClick: () => void;
  type?: 'divider';
}
```

---

## Step 3: Create Base Component

### 3.1 Create `ComponentsPanel.tsx`

Start with a minimal shell:

```typescript
/**
 * ComponentsPanel
 *
 * Modern React implementation of the components sidebar panel.
 * Displays project component hierarchy with folders, allows drag-drop reorganization,
 * and provides context menus for component/folder operations.
 */

import React from 'react';

import css from './ComponentsPanel.module.scss';
import { ComponentsPanelProps } from './types';

export function ComponentsPanel(props: ComponentsPanelProps) {
  const {
    nodeGraphEditor,
    showSheetList = true,
    hideSheets = [],
    componentTitle = 'Components',
    lockCurrentSheetName
  } = props;

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
          <div className={css.SheetsList}>
            {/* Sheet tabs will go here */}
            <div className={css.SheetItem}>Default</div>
          </div>
        </div>
      )}

      <div className={css.ComponentsHeader}>
        <div className={css.Title}>Components</div>
      </div>

      <div className={css.ComponentsScroller}>
        <div className={css.ComponentsList}>
          {/* Placeholder content */}
          <div className={css.PlaceholderItem}>📁 Folder 1</div>
          <div className={css.PlaceholderItem}>📄 Component 1</div>
          <div className={css.PlaceholderItem}>📄 Component 2</div>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 4: Create Base Styles

### 4.1 Create `ComponentsPanel.module.scss`

Port essential styles from the legacy CSS:

```scss
/**
 * ComponentsPanel Styles
 * Ported from legacy componentspanel.css
 */

.ComponentsPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--theme-color-bg-1);
  color: var(--theme-color-fg-default);
  overflow: hidden;
}

/* Header sections */
.Header,
.SheetsHeader,
.ComponentsHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font: 11px var(--font-family-bold);
  color: var(--theme-color-fg-default);
  background-color: var(--theme-color-bg-2);
  border-bottom: 1px solid var(--theme-color-border-default);
}

.Title {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.AddButton {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--theme-color-fg-default);
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--theme-color-bg-3);
  }
}

.AddIcon {
  font-size: 14px;
  font-weight: bold;
}

/* Sheets section */
.SheetsSection {
  border-bottom: 1px solid var(--theme-color-border-default);
}

.SheetsList {
  max-height: 250px;
  overflow-y: auto;
  overflow-x: hidden;
}

.SheetItem {
  padding: 8px 10px 8px 30px;
  font: 11px var(--font-family-regular);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--theme-color-bg-3);
  }
}

/* Components list */
.ComponentsScroller {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.ComponentsList {
  padding: 4px 0;
}

/* Placeholder items (temporary for Phase 1) */
.PlaceholderItem {
  padding: 8px 10px 8px 23px;
  font: 11px var(--font-family-regular);
  color: var(--theme-color-fg-default);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--theme-color-bg-3);
  }
}

/* Custom scrollbar */
.ComponentsScroller::-webkit-scrollbar {
  width: 8px;
}

.ComponentsScroller::-webkit-scrollbar-track {
  background: var(--theme-color-bg-1);
}

.ComponentsScroller::-webkit-scrollbar-thumb {
  background: var(--theme-color-bg-4);
  border-radius: 4px;

  &:hover {
    background: var(--theme-color-fg-muted);
  }
}
```

---

## Step 5: Create Export File

### 5.1 Create `index.ts`

```typescript
export { ComponentsPanel } from './ComponentsPanel';
export * from './types';
```

---

## Step 6: Register with SidebarModel

### 6.1 Update `router.setup.ts`

Find the existing ComponentsPanel registration and update it:

**Before:**

```typescript
const ComponentsPanel = require('./views/panels/componentspanel/ComponentsPanel').ComponentsPanelView;
```

**After:**

```typescript
import { ComponentsPanel } from './views/panels/ComponentsPanel';
```

**Registration (should already exist, just verify):**

```typescript
SidebarModel.instance.register({
  id: 'components',
  name: 'Components',
  order: 1,
  icon: IconName.Components,
  onOpen: (args) => {
    const panel = new ComponentsPanel({
      nodeGraphEditor: args.context.nodeGraphEditor,
      showSheetList: true,
      hideSheets: ['__cloud__']
    });
    panel.render();
    return panel.el;
  }
});
```

**Update to:**

```typescript
SidebarModel.instance.register({
  id: 'components',
  name: 'Components',
  order: 1,
  icon: IconName.Components,
  panel: ComponentsPanel,
  panelProps: {
    nodeGraphEditor: undefined, // Will be set by SidePanel
    showSheetList: true,
    hideSheets: ['__cloud__']
  }
});
```

**Note:** Check how `SidebarModel` handles React components. You may need to look at how `SearchPanel.tsx` or other React panels are registered.

---

## Step 7: Testing

### 7.1 Build and Run

```bash
npm run dev
```

### 7.2 Verification Checklist

- [ ] No TypeScript compilation errors
- [ ] Application starts without errors
- [ ] Clicking "Components" icon in sidebar shows panel
- [ ] Panel displays with header "Components"
- [ ] "+" button appears in header
- [ ] Placeholder items are visible
- [ ] If `showSheetList` is true, "Sheets" section appears
- [ ] No console errors or warnings
- [ ] Styles look consistent with other sidebar panels

### 7.3 Test Edge Cases

- [ ] Panel resizes correctly with window
- [ ] Scrollbar appears if content overflows
- [ ] Panel switches correctly with other sidebar panels

---

## Common Issues & Solutions

### Issue: Panel doesn't appear

**Solution:** Check that `SidebarModel` registration is correct. Look at how other React panels like `SearchPanel` are registered.

### Issue: Styles not applying

**Solution:** Verify CSS module import path is correct and webpack is configured to handle `.module.scss` files.

### Issue: TypeScript errors with ComponentModel

**Solution:** Ensure all `@noodl-models` imports are available. Check `tsconfig.json` paths.

### Issue: "nodeGraphEditor" prop undefined

**Solution:** `SidePanel` should inject this. Check that prop passing matches other panels.

---

## Reference Files

**Legacy Implementation:**

- `packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentsPanel.ts`
- `packages/noodl-editor/src/editor/src/templates/componentspanel.html`
- `packages/noodl-editor/src/editor/src/styles/componentspanel.css`

**React Panel Examples:**

- `packages/noodl-editor/src/editor/src/views/panels/SearchPanel/SearchPanel.tsx`
- `packages/noodl-editor/src/editor/src/views/VersionControlPanel/VersionControlPanel.tsx`

**SidebarModel:**

- `packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.tsx`

---

## Success Criteria

✅ **Phase 1 is complete when:**

1. New directory structure exists
2. TypeScript types are defined
3. ComponentsPanel React component renders
4. Component is registered with SidebarModel
5. Panel appears when clicking Components icon
6. Placeholder content is visible
7. No console errors
8. All TypeScript compiles without errors

---

## Next Phase

**Phase 2: Tree Rendering** - Connect to ProjectModel and render actual component tree structure.
