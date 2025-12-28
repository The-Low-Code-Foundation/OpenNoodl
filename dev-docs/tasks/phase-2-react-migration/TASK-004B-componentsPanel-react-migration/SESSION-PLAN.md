# TASK-005 Session Plan for Cline

## Context

You are migrating `ComponentsPanel.ts` from a legacy jQuery/underscore.js View to a modern React component. This is a prerequisite for TASK-004's migration badges feature.

**Philosophy:** "When we touch a component, we clean it properly" - full React rewrite, no jQuery, proper TypeScript.

---

## Session 1: Foundation (Start Here)

### Goal
Create the component structure and get it rendering in the sidebar.

### Steps

1. **Create directory structure:**
```
packages/noodl-editor/src/editor/src/views/panels/ComponentsPanel/
├── ComponentsPanel.tsx
├── ComponentsPanel.module.scss
├── components/
├── hooks/
├── types.ts
└── index.ts
```

2. **Define types in `types.ts`:**
```typescript
import { ComponentModel } from '@noodl-models/componentmodel';

export interface ComponentItemData {
  id: string;
  name: string;
  localName: string;
  component: ComponentModel;
  isRoot: boolean;
  isPage: boolean;
  isCloudFunction: boolean;
  isVisual: boolean;
  hasWarnings: boolean;
}

export interface FolderItemData {
  name: string;
  path: string;
  isOpen: boolean;
  isComponentFolder: boolean;
  component?: ComponentModel;
  children: TreeNode[];
}

export type TreeNode = 
  | { type: 'component'; data: ComponentItemData }
  | { type: 'folder'; data: FolderItemData };

export interface ComponentsPanelProps {
  options?: {
    showSheetList?: boolean;
    hideSheets?: string[];
  };
}
```

3. **Create basic `ComponentsPanel.tsx`:**
```typescript
import React from 'react';
import css from './ComponentsPanel.module.scss';

export function ComponentsPanel({ options }: ComponentsPanelProps) {
  return (
    <div className={css['ComponentsPanel']}>
      <div className={css['Header']}>
        <span className={css['Title']}>Components</span>
        <button className={css['AddButton']}>+</button>
      </div>
      <div className={css['Tree']}>
        {/* Tree will go here */}
        <div style={{ padding: 16, color: '#888' }}>
          ComponentsPanel React migration in progress...
        </div>
      </div>
    </div>
  );
}
```

4. **Update `router.setup.ts`:**
```typescript
// Change import
import { ComponentsPanel } from './views/panels/ComponentsPanel';

// In register call, panel should now be the React component
SidebarModel.instance.register({
  id: 'components',
  name: 'Components',
  order: 1,
  icon: IconName.Components,
  onOpen: () => { /* ... */ },
  panelProps: {
    options: {
      showSheetList: true,
      hideSheets: ['__cloud__']
    }
  },
  panel: ComponentsPanel  // React component
});
```

5. **Port base styles to `ComponentsPanel.module.scss`** from `styles/componentspanel.css`

### Verify
- [ ] Panel appears when clicking Components icon in sidebar
- [ ] Placeholder text visible
- [ ] No console errors

---

## Session 2: Tree Rendering

### Goal
Render the actual component tree from ProjectModel.

### Steps

1. **Create `hooks/useComponentsPanel.ts`:**
- Subscribe to ProjectModel using `useModernModel`
- Build tree structure from components
- Track expanded folders in useState
- Track selected item in useState

2. **Port tree building logic** from `ComponentsPanel.ts`:
- `addComponentToFolderStructure()`
- `getFolderForComponentWithName()`
- Handle sheet filtering

3. **Create `components/ComponentTree.tsx`:**
- Recursive renderer
- Pass tree data and handlers

4. **Create `components/ComponentItem.tsx`:**
- Single row for component
- Icon based on type (use getComponentIconType)
- Selection state
- Warning indicator

5. **Create `components/FolderItem.tsx`:**
- Folder row with caret
- Expand/collapse on click
- Render children when expanded

### Verify
- [ ] Tree structure matches original
- [ ] Folders expand/collapse
- [ ] Selection works
- [ ] Icons correct

---

## Session 3: Context Menus

### Goal
Implement all context menu functionality.

### Steps

1. **Create `components/AddComponentMenu.tsx`:**
- Uses ComponentTemplates.instance.getTemplates()
- Renders PopupMenu with template options + Folder

2. **Wire header "+" button** to show AddComponentMenu

3. **Add context menu to ComponentItem:**
- Right-click handler
- Menu: Add submenu, Make home, Rename, Duplicate, Delete

4. **Add context menu to FolderItem:**
- Right-click handler  
- Menu: Add submenu, Make home (if folder component), Rename, Duplicate, Delete

5. **Port action handlers:**
- `performAdd()` - create component/folder
- `onDeleteClicked()` - with confirmation
- `onDuplicateClicked()` / `onDuplicateFolderClicked()`

### Verify
- [ ] All menu items appear
- [ ] Actions work correctly
- [ ] Undo works

---

## Session 4: Drag-Drop

### Goal
Implement drag-drop for reorganizing components.

### Steps

1. **Create `hooks/useDragDrop.ts`:**
- Track drag state
- Integrate with PopupLayer.instance

2. **Add drag handlers to items:**
- mousedown/mousemove pattern from original
- Call PopupLayer.startDragging()

3. **Add drop zone handlers:**
- Folders are drop targets
- Top-level area is drop target
- Show visual feedback

4. **Port drop logic:**
- `getAcceptableDropType()` - validation
- `dropOn()` - execution with undo

### Verify
- [ ] Dragging shows label
- [ ] Valid targets highlight
- [ ] Invalid targets show feedback
- [ ] Drops work correctly
- [ ] Undo works

---

## Session 5: Inline Rename + Sheets

### Goal
Complete rename functionality and sheet selector.

### Steps

1. **Create `hooks/useRenameMode.ts`:**
- Track which item is being renamed
- Handle Enter/Escape/blur

2. **Add rename input UI:**
- Replaces label when in rename mode
- Auto-select text
- Validation

3. **Create `components/SheetSelector.tsx`:**
- Tab list from ProjectModel sheets
- Handle hideSheets option
- Switch current sheet on click

4. **Integrate SheetSelector:**
- Only show if options.showSheetList
- Filter tree by current sheet

### Verify
- [ ] Rename via double-click works
- [ ] Rename via menu works
- [ ] Sheets display and switch correctly

---

## Session 6: Polish + Cleanup

### Goal
Final cleanup, remove old files, prepare for TASK-004.

### Steps

1. **Style polish:**
- Match exact spacing/sizing
- Hover and focus states

2. **Code cleanup:**
- Remove any `any` types
- Add JSDoc comments
- Consistent naming

3. **Remove old files:**
- Delete `views/panels/componentspanel/ComponentsPanel.ts`
- Delete `templates/componentspanel.html`
- Update remaining imports

4. **TASK-004 preparation:**
- Add `migrationStatus` to ComponentItemData
- Add badge placeholder in ComponentItem
- Document extension points

5. **Update CHANGELOG.md**

### Verify
- [ ] All functionality works
- [ ] No errors
- [ ] Old files removed
- [ ] Ready for badges feature

---

## Key Files Reference

**Read these first:**
- `views/panels/componentspanel/ComponentsPanel.ts` - Logic to port
- `templates/componentspanel.html` - UI structure reference
- `views/panels/componentspanel/ComponentsPanelFolder.ts` - Data model
- `views/panels/componentspanel/ComponentTemplates.ts` - Template definitions

**Pattern references:**
- `views/panels/SearchPanel/SearchPanel.tsx` - Modern panel example
- `views/SidePanel/SidePanel.tsx` - Container that hosts panels
- `views/PopupLayer/PopupMenu.tsx` - Context menu component
- `hooks/useModel.ts` - useModernModel hook

---

## Confidence Checkpoints

After each session, verify:
1. No TypeScript errors: `npx tsc --noEmit`
2. App launches: `npm run dev`
3. Panel renders in sidebar
4. Previous functionality still works

**Before removing old files:** Test EVERYTHING twice.
