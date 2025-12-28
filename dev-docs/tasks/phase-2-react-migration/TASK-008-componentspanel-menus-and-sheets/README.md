# TASK-008: ComponentsPanel Menu Enhancements & Sheet System

## 🟡 CURRENT STATUS: IN PROGRESS (Phase 2 Complete)

**Last Updated:** December 27, 2025  
**Status:** 🟡 IN PROGRESS  
**Completion:** 50%

### Quick Summary

Implement the remaining ComponentsPanel features discovered during TASK-004B research:

- ✅ Enhanced context menus with "Create" submenus - COMPLETE
- ✅ Sheet system backend (detection, filtering, management) - COMPLETE
- ⏳ Sheet selector UI with dropdown - NEXT
- ⏳ Sheet management actions wired up - PENDING

**Predecessor:** TASK-004B (ComponentsPanel React Migration) - COMPLETE ✅

### Completed Phases

**Phase 1: Enhanced Context Menus** ✅

- Create menu items in component/folder right-click menus
- All component templates + folder creation accessible

**Phase 2: Sheet System Backend** ✅ (December 27, 2025)

- Sheet detection from `#`-prefixed folders
- `useComponentsPanel` now exports: `sheets`, `currentSheet`, `selectSheet`
- Tree filtering by selected sheet
- `useSheetManagement` hook with full CRUD operations
- All operations with undo support

**TASK-008C: Drag-Drop System** ✅

- All 7 drop combinations working
- Root drop zone implemented

---

## Overview

TASK-004B successfully migrated the ComponentsPanel to React, but several features from the legacy implementation were intentionally deferred. This task completes the ComponentsPanel by adding:

1. **Enhanced Context Menus**: Add "Create" submenus to component and folder right-click menus
2. **Sheet System UI**: Implement dropdown selector for managing component sheets
3. **Sheet Management**: Full CRUD operations for sheets with undo support

**Phase:** 2 (Runtime Migration System)  
**Priority:** MEDIUM (UX enhancement, not blocking)  
**Effort:** 8-12 hours  
**Risk:** Low (foundation already stable)

---

## Background

### What Are Sheets?

Sheets are a way to organize components into top-level groups:

- **Sheet Folders**: Top-level folders with names starting with `#` (e.g., `#CloudFunctions`, `#Pages`)
- **Default Sheet**: All components not in a `#` folder
- **Special Sheets**: Some sheets can be hidden (e.g., `__cloud__` sheet)

### Current State

After TASK-004B completion, the React ComponentsPanel has:

**✅ Working:**

- Basic tree rendering with folders/components
- Component selection and navigation
- Expand/collapse folders
- Basic context menus (Make Home, Rename, Duplicate, Delete)
- Drag-drop for organizing components
- Root folder transparency (no unnamed folder)

**❌ Missing:**

- "Create" submenus in context menus
- Sheet selector UI (currently no way to see/switch sheets)
- Sheet creation/deletion/rename
- Visual indication of current sheet

### Legacy Implementation

The legacy `ComponentsPanel.ts.legacy` shows:

- Full context menu system with "Create" submenus
- Sheet selector bar with tabs
- Sheet management actions (add, rename, delete)
- Sheet drag-drop support

---

## Goals

1. **Enhanced Context Menus** - Add "Create" submenus with all component types + folder
2. **Sheet Dropdown UI** - Replace legacy tab bar with modern dropdown selector
3. **Sheet Management** - Full create/rename/delete with undo support
4. **Sheet Filtering** - Show only components in selected sheet
5. **TypeScript Throughout** - Proper typing, no TSFixme

---

## Architecture

### Component Structure

```
ComponentsPanel/
├── ComponentsPanelReact.tsx     # Add sheet selector UI
├── components/
│   ├── ComponentTree.tsx        # Enhance context menus
│   ├── ComponentItem.tsx        # Update menu items
│   ├── FolderItem.tsx           # Update menu items
│   └── SheetSelector.tsx        # NEW: Dropdown for sheets
├── hooks/
│   ├── useComponentsPanel.ts    # Add sheet filtering
│   ├── useComponentActions.ts   # Add sheet actions
│   └── useSheetManagement.ts    # NEW: Sheet operations
└── types.ts                     # Add sheet types
```

### State Management

**Sheet State (in useComponentsPanel):**

- `currentSheet: ComponentsPanelFolder | null` - Active sheet
- `sheets: ComponentsPanelFolder[]` - All available sheets
- `selectSheet(sheet)` - Switch to a sheet
- `filterBySheet(sheet)` - Filter tree to show only sheet components

**Sheet Actions (in useSheetManagement):**

- `createSheet(name)` - Create new sheet with undo
- `renameSheet(sheet, newName)` - Rename sheet with undo
- `deleteSheet(sheet)` - Delete sheet with confirmation + undo
- `moveToSheet(item, targetSheet)` - Move component/folder to sheet

---

## Implementation Phases

### Phase 1: Enhanced Context Menus (2-3 hours)

Add "Create" submenus to existing context menus.

**Files to Modify:**

- `components/ComponentItem.tsx` - Add "Create" submenu before divider
- `components/FolderItem.tsx` - Add "Create" submenu before divider
- `hooks/useComponentActions.ts` - Already has `handleAddComponent` and `handleAddFolder`

**Tasks:**

1. **Check PopupMenu Submenu Support**

   - Read PopupMenu source to see if nested menus are supported
   - If not, may need to enhance PopupMenu or use alternative approach

2. **Add "Create" Submenu to Component Context Menu**

   - Position: After "Make Home", before "Rename"
   - Items:
     - Page (template)
     - Visual Component (template)
     - Logic Component (template)
     - Cloud Function (template)
     - Divider
     - Folder
   - Each item calls `handleAddComponent(template, parentPath)`

3. **Add "Create" Submenu to Folder Context Menu**

   - Same items as component menu
   - Parent path is folder path

4. **Wire Up Template Selection**
   - Get templates from `ComponentTemplates.instance.getTemplates()`
   - Filter by runtime type (browser vs cloud)
   - Pass correct parent path to popup

**Success Criteria:**

- [ ] Component right-click shows "Create" submenu
- [ ] Folder right-click shows "Create" submenu
- [ ] All 4 component templates + folder appear in submenu
- [ ] Clicking template opens creation popup at correct path
- [ ] All operations support undo/redo

### Phase 2: Sheet System Backend (2 hours)

Implement sheet detection and filtering logic.

**Files to Create:**

- `hooks/useSheetManagement.ts` - Sheet operations hook

**Files to Modify:**

- `hooks/useComponentsPanel.ts` - Add sheet filtering

**Tasks:**

1. **Sheet Detection in useComponentsPanel**

   ```typescript
   // Identify sheets from projectFolder.folders
   const sheets = useMemo(() => {
     const allSheets = [{ name: 'Default', folder: projectFolder, isDefault: true }];

     projectFolder.folders
       .filter((f) => f.name.startsWith('#'))
       .forEach((f) => {
         allSheets.push({
           name: f.name.substring(1), // Remove # prefix
           folder: f,
           isDefault: false
         });
       });

     // Filter out hidden sheets
     return allSheets.filter((s) => !hideSheets?.includes(s.name));
   }, [projectFolder, hideSheets]);
   ```

2. **Current Sheet State**

   ```typescript
   const [currentSheet, setCurrentSheet] = useState(() => {
     // Default to first non-hidden sheet
     return sheets[0] || null;
   });
   ```

3. **Sheet Filtering**

   ```typescript
   const filteredTreeData = useMemo(() => {
     if (!currentSheet) return treeData;
     if (currentSheet.isDefault) {
       // Show components not in any # folder
       return filterNonSheetComponents(treeData);
     } else {
       // Show only components in this sheet's folder
       return filterSheetComponents(treeData, currentSheet.folder);
     }
   }, [treeData, currentSheet]);
   ```

4. **Create useSheetManagement Hook**
   - `createSheet(name)` - Create `#SheetName` folder
   - `renameSheet(sheet, newName)` - Rename folder with component path updates
   - `deleteSheet(sheet)` - Delete folder and all components (with confirmation)
   - All operations use `UndoQueue.pushAndDo()` pattern

**Success Criteria:**

- [ ] Sheets correctly identified from folder structure
- [ ] Current sheet state maintained
- [ ] Tree data filtered by selected sheet
- [ ] Sheet CRUD operations with undo support

### Phase 3: Sheet Selector UI (2-3 hours)

Create dropdown component for sheet selection.

**Files to Create:**

- `components/SheetSelector.tsx` - Dropdown component
- `components/SheetSelector.module.scss` - Styles

**Component Structure:**

```typescript
interface SheetSelectorProps {
  sheets: Sheet[];
  currentSheet: Sheet | null;
  onSelectSheet: (sheet: Sheet) => void;
  onCreateSheet: () => void;
  onRenameSheet: (sheet: Sheet) => void;
  onDeleteSheet: (sheet: Sheet) => void;
}

export function SheetSelector({
  sheets,
  currentSheet,
  onSelectSheet,
  onCreateSheet,
  onRenameSheet,
  onDeleteSheet
}: SheetSelectorProps) {
  // Dropdown implementation
}
```

**UI Design:**

```
┌─────────────────────────────────┐
│ Components          ▼ [Default] │  ← Header with dropdown
├─────────────────────────────────┤
│ Click dropdown:                  │
│ ┌─────────────────────────────┐ │
│ │ ● Default                   │ │
│ │   Pages                     │ │
│ │   Components                │ │
│ │ ────────────────            │ │
│ │ + Add Sheet                 │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Tasks:**

1. **Create SheetSelector Component**

   - Button showing current sheet name with dropdown icon
   - Click opens dropdown menu
   - List of all sheets with selection indicator
   - "Add Sheet" button at bottom

2. **Sheet List Item with Actions**

   - Sheet name
   - Three-dot menu for rename/delete
   - Cannot delete "Default" sheet
   - Click sheet name to switch

3. **Integrate into ComponentsPanelReact**

   ```tsx
   <div className={css['Header']}>
     <span className={css['Title']}>Components</span>
     <SheetSelector
       sheets={sheets}
       currentSheet={currentSheet}
       onSelectSheet={selectSheet}
       onCreateSheet={handleCreateSheet}
       onRenameSheet={handleRenameSheet}
       onDeleteSheet={handleDeleteSheet}
     />
     <button className={css['AddButton']} onClick={handleAddClick}>
       +
     </button>
   </div>
   ```

4. **Style the Dropdown**
   - Match existing ComponentsPanel styling
   - Smooth open/close animation
   - Proper z-index layering

**Success Criteria:**

- [ ] Dropdown button shows current sheet name
- [ ] Clicking opens sheet list
- [ ] Sheet list shows all non-hidden sheets
- [ ] "Add Sheet" button at bottom
- [ ] Three-dot menu on each sheet (except Default)
- [ ] Clicking sheet switches view

### Phase 4: Sheet Management Actions (1-2 hours)

Wire up all sheet management actions.

**Files to Modify:**

- `ComponentsPanelReact.tsx` - Wire up SheetSelector callbacks

**Tasks:**

1. **Create Sheet Action**

   ```typescript
   const handleCreateSheet = useCallback(() => {
     const popup = new PopupLayer.StringInputPopup({
       label: 'New sheet name',
       okLabel: 'Create',
       cancelLabel: 'Cancel',
       onOk: (name: string) => {
         if (!name || name.trim() === '') {
           ToastLayer.showError('Sheet name cannot be empty');
           return;
         }
         createSheet(name);
         PopupLayer.instance.hidePopup();
       }
     });

     popup.render();
     PopupLayer.instance.showPopup({
       content: popup,
       position: 'center'
     });
   }, [createSheet]);
   ```

2. **Rename Sheet Action**

   - Show StringInputPopup with current name
   - Validate name (non-empty, unique)
   - Call `renameSheet()` from useSheetManagement
   - Update displays new name immediately (via ProjectModel events)

3. **Delete Sheet Action**

   - Show confirmation dialog with component count
   - Call `deleteSheet()` from useSheetManagement
   - Switch to Default sheet after deletion

4. **Drag-Drop Between Sheets** (Optional Enhancement)
   - Extend useDragDrop to support sheet boundaries
   - Allow dropping on sheet name in dropdown
   - Move component/folder to target sheet

**Success Criteria:**

- [ ] "Add Sheet" creates new sheet with undo
- [ ] Rename sheet updates all component paths
- [ ] Delete sheet removes folder and components
- [ ] All operations show in undo history
- [ ] UI updates immediately after operations

### Phase 5: Integration & Testing (1 hour)

Final integration and comprehensive testing.

**Tasks:**

1. **Update TASK-004B Documentation**

   - Mark as "Feature Complete" (not just "Complete")
   - Add reference to TASK-008 for sheet system

2. **Test All Menu Features**

   - [ ] Component context menu "Create" submenu works
   - [ ] Folder context menu "Create" submenu works
   - [ ] All templates create components at correct path
   - [ ] Folder creation from context menu works

3. **Test All Sheet Features**

   - [ ] Sheet dropdown displays correctly
   - [ ] Switching sheets filters component list
   - [ ] Creating sheet adds to dropdown
   - [ ] Renaming sheet updates dropdown and paths
   - [ ] Deleting sheet removes from dropdown

4. **Test Edge Cases**

   - [ ] Hidden sheets don't appear in dropdown
   - [ ] Locked sheet mode prevents switching (for Cloud Functions panel)
   - [ ] Empty sheets show correctly
   - [ ] Deleting last component in sheet folder

5. **Test Undo/Redo**
   - [ ] Create sheet → undo removes it
   - [ ] Rename sheet → undo reverts name
   - [ ] Delete sheet → undo restores it
   - [ ] Move to sheet → undo moves back

**Success Criteria:**

- [ ] All features working end-to-end
- [ ] No console errors or warnings
- [ ] Smooth UX with proper feedback
- [ ] Documentation updated

---

## Technical Details

### PopupMenu Submenu Support

The legacy implementation used nested PopupMenu items. Need to verify if current PopupMenu supports this:

**Option A: Nested Menu Support**

```typescript
{
  icon: IconName.Plus,
  label: 'Create',
  submenu: [
    { icon: IconName.Page, label: 'Page', onClick: ... },
    { icon: IconName.Component, label: 'Visual Component', onClick: ... },
    // etc
  ]
}
```

**Option B: Flat Menu with Dividers**

```typescript
[
  { icon: IconName.Plus, label: 'Create Page', onClick: ... },
  { icon: IconName.Plus, label: 'Create Visual Component', onClick: ... },
  { icon: IconName.Plus, label: 'Create Logic Component', onClick: ... },
  { icon: IconName.Plus, label: 'Create Cloud Function', onClick: ... },
  { type: 'divider' },
  { icon: IconName.Plus, label: 'Create Folder', onClick: ... },
  { type: 'divider' },
  // existing items...
]
```

**Decision:** Check PopupMenu implementation first. If nested menus aren't supported, use Option B as it's simpler and still provides good UX.

### Sheet Folder Structure

Sheets are implemented as top-level folders:

```
projectFolder (root)
├── #Pages/              ← Sheet: "Pages"
│   ├── HomePage
│   ├── AboutPage
├── #Components/         ← Sheet: "Components"
│   ├── Header
│   ├── Footer
├── #__cloud__/          ← Special hidden sheet
│   ├── MyCloudFunction
├── App                  ← Default sheet
├── Settings             ← Default sheet
```

**Key Points:**

- Sheet names start with `#` in folder structure
- Display names remove the `#` prefix
- Default sheet = any component not in a `#` folder
- Hidden sheets filtered by `hideSheets` option

### Sheet Filtering Algorithm

```typescript
function filterBySheet(components, sheet) {
  if (sheet.isDefault) {
    // Show only components NOT in any sheet folder
    return components.filter((comp) => !comp.name.startsWith('/#'));
  } else {
    // Show only components in this sheet's folder
    const sheetPath = sheet.folder.getPath();
    return components.filter((comp) => comp.name.startsWith(sheetPath));
  }
}
```

### UndoQueue Pattern

All sheet operations must use the proven pattern:

```typescript
UndoQueue.instance.pushAndDo(
  new UndoActionGroup({
    label: 'create sheet',
    do: () => {
      // Perform action
    },
    undo: () => {
      // Revert action
    }
  })
);
```

**NOT** the old broken pattern:

```typescript
// ❌ DON'T DO THIS
const undoGroup = new UndoActionGroup({ label: 'action' });
undoGroup.push({ do: ..., undo: ... });
UndoQueue.instance.push(undoGroup);
undoGroup.do();
```

---

## Files to Modify

### Create (New)

```
packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/
├── components/
│   ├── SheetSelector.tsx              # NEW
│   └── SheetSelector.module.scss      # NEW
└── hooks/
    └── useSheetManagement.ts          # NEW
```

### Modify (Existing)

```
packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/
├── ComponentsPanelReact.tsx           # Add SheetSelector
├── components/
│   ├── ComponentItem.tsx              # Enhance context menu
│   └── FolderItem.tsx                 # Enhance context menu
├── hooks/
│   ├── useComponentsPanel.ts          # Add sheet filtering
│   └── useComponentActions.ts         # Add sheet actions
└── types.ts                           # Add Sheet types
```

---

## Testing Checklist

### Context Menu Enhancements

- [ ] Component right-click shows "Create" submenu
- [ ] "Create" submenu shows all 4 templates + folder
- [ ] Clicking template opens creation popup
- [ ] Component created at correct path
- [ ] Folder creation works from context menu
- [ ] Folder right-click has same "Create" submenu
- [ ] All operations support undo/redo

### Sheet Selector UI

- [ ] Dropdown button appears in header
- [ ] Dropdown shows current sheet name
- [ ] Clicking opens sheet list
- [ ] All non-hidden sheets appear in list
- [ ] Current sheet has selection indicator
- [ ] "Add Sheet" button at bottom
- [ ] Three-dot menu on non-default sheets
- [ ] Clicking sheet switches view

### Sheet Management

- [ ] Create sheet opens input popup
- [ ] New sheet appears in dropdown
- [ ] Components filtered by selected sheet
- [ ] Rename sheet updates name everywhere
- [ ] Rename sheet updates component paths
- [ ] Delete sheet shows confirmation
- [ ] Delete sheet removes from dropdown
- [ ] Delete sheet removes all components
- [ ] Hidden sheets don't appear (e.g., **cloud**)

### Sheet Filtering

- [ ] Default sheet shows non-sheet components
- [ ] Named sheet shows only its components
- [ ] Switching sheets updates tree immediately
- [ ] Empty sheets show empty state
- [ ] Component creation adds to current sheet

### Undo/Redo

- [ ] Create sheet → undo removes it
- [ ] Create sheet → undo → redo restores it
- [ ] Rename sheet → undo reverts name
- [ ] Delete sheet → undo restores sheet and components
- [ ] Move to sheet → undo moves back

### Edge Cases

- [ ] Cannot delete Default sheet
- [ ] Cannot create sheet with empty name
- [ ] Cannot create sheet with duplicate name
- [ ] Locked sheet mode prevents switching
- [ ] Hidden sheets stay hidden
- [ ] Deleting last component doesn't break UI

---

## Risks & Mitigations

### Risk: PopupMenu doesn't support nested menus

**Mitigation:** Use flat menu structure with dividers. Still provides good UX.

### Risk: Sheet filtering breaks component selection

**Mitigation:** Test extensively. Ensure ProjectModel events update sheet view correctly.

### Risk: Sheet delete is destructive

**Mitigation:** Show confirmation with component count. Make undo work perfectly.

---

## Success Criteria

1. **Context Menus Enhanced**: "Create" submenus with all templates work perfectly
2. **Sheet UI Complete**: Dropdown selector with all management features
3. **Sheet Operations**: Full CRUD with undo support
4. **Feature Parity**: All legacy sheet features now in React
5. **Clean Code**: TypeScript throughout, no TSFixme
6. **Documentation**: Updated task status, learnings captured

---

## Future Enhancements (Out of Scope)

- Drag-drop between sheets (drag component onto sheet name)
- Sheet reordering
- Sheet color coding
- Sheet icons
- Keyboard shortcuts for sheet switching
- Sheet search/filter

---

## Dependencies

**Blocked by:** None (TASK-004B complete)

**Blocks:** None (UX enhancement)

---

## References

- **TASK-004B**: ComponentsPanel React Migration (predecessor)
- **Legacy Implementation**: `ComponentsPanel.ts.legacy` - Complete reference
- **Current React**: `ComponentsPanelReact.tsx` - Foundation to build on
- **Templates**: `ComponentTemplates.ts` - Template system
- **Actions**: `useComponentActions.ts` - Action patterns
- **Undo Pattern**: `dev-docs/reference/UNDO-QUEUE-PATTERNS.md`

---

## Notes for Implementation

### PopupMenu Investigation

Before starting Phase 1, check:

1. Does PopupMenu support nested menus?
2. If yes, what's the API?
3. If no, is it easy to add or should we use flat menus?

File to check: `packages/noodl-editor/src/editor/src/views/PopupLayer/PopupMenu.tsx`

### Sheet State Management

Consider using a custom hook `useSheetState()` to encapsulate:

- Current sheet selection
- Sheet list with filtering
- Sheet switching logic
- Persistence (if needed)

This keeps ComponentsPanelReact clean and focused.

### Component Path Updates

When renaming sheets, ALL components in that sheet need path updates. This is similar to folder rename. Use the same pattern:

```typescript
const componentsInSheet = ProjectModel.instance.getComponents().filter((c) => c.name.startsWith(oldSheetPath));

componentsInSheet.forEach((comp) => {
  const relativePath = comp.name.substring(oldSheetPath.length);
  const newName = newSheetPath + relativePath;
  ProjectModel.instance.renameComponent(comp, newName);
});
```

### Hidden Sheets

The `hideSheets` option is important for panels like the Cloud Functions panel. It might show:

- `hideSheets: ['__cloud__']` - Don't show cloud functions in main panel

OR it might be locked to ONLY cloud functions:

- `lockCurrentSheetName: '__cloud__'` - Only show cloud functions

Both patterns should work seamlessly.

---

_Last Updated: December 26, 2025_
