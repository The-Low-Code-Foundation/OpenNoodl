# TASK-005 Implementation Checklist

## Pre-Implementation

- [ ] Create branch `task/005-componentspanel-react`
- [ ] Read current `ComponentsPanel.ts` thoroughly
- [ ] Read `ComponentsPanelFolder.ts` for data structures
- [ ] Review `componentspanel.html` template for all UI elements
- [ ] Check `componentspanel.css` for styles to port
- [ ] Review how `SearchPanel.tsx` is structured (reference)

---

## Phase 1: Foundation

### Directory Setup
- [ ] Create `views/panels/ComponentsPanel/` directory
- [ ] Create `components/` subdirectory
- [ ] Create `hooks/` subdirectory

### Type Definitions (`types.ts`)
- [ ] Define `ComponentItemData` interface
- [ ] Define `FolderItemData` interface
- [ ] Define `ComponentsPanelProps` interface
- [ ] Define `TreeNode` union type

### Base Component (`ComponentsPanel.tsx`)
- [ ] Create function component skeleton
- [ ] Accept props from SidebarModel registration
- [ ] Add placeholder content
- [ ] Export from `index.ts`

### Registration Update
- [ ] Update `router.setup.ts` import
- [ ] Verify SidebarModel accepts React component
- [ ] Test panel mounts in sidebar

### Base Styles (`ComponentsPanel.module.scss`)
- [ ] Create file with basic container styles
- [ ] Port `.sidebar-panel` styles
- [ ] Port `.components-scroller` styles

### Checkpoint
- [ ] Panel appears when clicking Components icon
- [ ] No console errors
- [ ] Placeholder content visible

---

## Phase 2: Tree Rendering

### State Hook (`hooks/useComponentsPanel.ts`)
- [ ] Create hook function
- [ ] Subscribe to ProjectModel with `useModernModel`
- [ ] Track expanded folders in local state
- [ ] Track selected item in local state
- [ ] Build tree structure from ProjectModel components
- [ ] Return tree data and handlers

### Folder Structure Logic
- [ ] Port `addComponentToFolderStructure` logic
- [ ] Port `getFolderForComponentWithName` logic
- [ ] Port `getSheetForComponentWithName` logic
- [ ] Handle sheet filtering (`hideSheets` option)

### ComponentTree (`components/ComponentTree.tsx`)
- [ ] Create recursive tree renderer
- [ ] Accept tree data as prop
- [ ] Render FolderItem for folders
- [ ] Render ComponentItem for components
- [ ] Handle indentation via CSS/inline style

### FolderItem (`components/FolderItem.tsx`)
- [ ] Render folder row with caret icon
- [ ] Render folder name
- [ ] Handle expand/collapse on caret click
- [ ] Render children when expanded
- [ ] Show correct icon (folder vs folder-component)
- [ ] Handle "folder component" case (folder that is also a component)

### ComponentItem (`components/ComponentItem.tsx`)
- [ ] Render component row
- [ ] Render component name
- [ ] Show correct icon based on type:
  - [ ] Home icon for root component
  - [ ] Page icon for page components
  - [ ] Cloud function icon for cloud components
  - [ ] Visual icon for visual components
  - [ ] Default icon for logic components
- [ ] Show warning indicator if component has warnings
- [ ] Handle selection state

### Selection Logic
- [ ] Click to select component
- [ ] Update NodeGraphEditor active component
- [ ] Expand folders to show selected item
- [ ] Sync with external selection changes

### Checkpoint
- [ ] Tree renders with correct structure
- [ ] Folders expand and collapse
- [ ] Components show correct icons
- [ ] Selection highlights correctly
- [ ] Clicking component opens it in editor

---

## Phase 3: Context Menus

### AddComponentMenu (`components/AddComponentMenu.tsx`)
- [ ] Create component with popup menu
- [ ] Get templates from `ComponentTemplates.instance`
- [ ] Filter templates by runtime type
- [ ] Render menu items for each template
- [ ] Add "Folder" menu item
- [ ] Handle template popup creation

### Header "+" Button
- [ ] Add button to panel header
- [ ] Open AddComponentMenu on click
- [ ] Position popup correctly

### Component Context Menu
- [ ] Add right-click handler to ComponentItem
- [ ] Create menu with options:
  - [ ] Add (submenu with templates)
  - [ ] Make home (if allowed)
  - [ ] Rename
  - [ ] Duplicate
  - [ ] Delete
- [ ] Wire up each action

### Folder Context Menu
- [ ] Add right-click handler to FolderItem
- [ ] Create menu with options:
  - [ ] Add (submenu with templates + folder)
  - [ ] Make home (if folder has component)
  - [ ] Rename
  - [ ] Duplicate
  - [ ] Delete
- [ ] Wire up each action

### Action Implementations
- [ ] Port `performAdd` logic
- [ ] Port `onRenameClicked` logic (triggers rename mode)
- [ ] Port `onDuplicateClicked` logic
- [ ] Port `onDuplicateFolderClicked` logic
- [ ] Port `onDeleteClicked` logic
- [ ] All actions use UndoQueue

### Checkpoint
- [ ] "+" button shows correct menu
- [ ] Right-click shows context menu
- [ ] All menu items work
- [ ] Undo works for all actions
- [ ] ToastLayer shows errors appropriately

---

## Phase 4: Drag-Drop

### Drag-Drop Hook (`hooks/useDragDrop.ts`)
- [ ] Create hook function
- [ ] Track drag state
- [ ] Track drop target
- [ ] Return drag handlers

### Drag Initiation
- [ ] Add mousedown/mousemove handlers to items
- [ ] Call `PopupLayer.instance.startDragging` on drag start
- [ ] Pass correct label and type

### Drop Zones
- [ ] Make folders droppable
- [ ] Make components droppable (for reorder/nesting)
- [ ] Make top-level area droppable
- [ ] Show drop indicator on valid targets

### Drop Validation
- [ ] Port `getAcceptableDropType` logic
- [ ] Cannot drop folder into its children
- [ ] Cannot drop component on itself
- [ ] Cannot create duplicate names
- [ ] Show invalid drop feedback

### Drop Execution
- [ ] Port `dropOn` logic
- [ ] Handle component → folder
- [ ] Handle folder → folder
- [ ] Handle component → component (reorder/nest)
- [ ] Create proper undo actions
- [ ] Call `PopupLayer.instance.dragCompleted`

### Checkpoint
- [ ] Dragging shows ghost label
- [ ] Valid drop targets highlight
- [ ] Invalid drops show feedback
- [ ] Drops execute correctly
- [ ] Undo reverses drops

---

## Phase 5: Inline Rename

### Rename Hook (`hooks/useRenameMode.ts`)
- [ ] Create hook function
- [ ] Track which item is in rename mode
- [ ] Track current input value
- [ ] Return rename state and handlers

### Rename UI
- [ ] Show input field when in rename mode
- [ ] Pre-fill with current name
- [ ] Select all text on focus
- [ ] Position input correctly

### Rename Actions
- [ ] Enter key confirms rename
- [ ] Escape key cancels rename
- [ ] Click outside cancels rename
- [ ] Validate name before saving
- [ ] Show error for invalid names

### Rename Execution
- [ ] Port rename logic for components
- [ ] Port rename logic for folders
- [ ] Use UndoQueue for rename action
- [ ] Update tree after rename

### Checkpoint
- [ ] Double-click triggers rename
- [ ] Menu "Rename" triggers rename
- [ ] Input appears with current name
- [ ] Enter saves correctly
- [ ] Escape cancels correctly
- [ ] Invalid names show error

---

## Phase 6: Sheet Selector

### SheetSelector (`components/SheetSelector.tsx`)
- [ ] Create component for sheet tabs
- [ ] Get sheets from ProjectModel
- [ ] Filter out hidden sheets
- [ ] Render tab for each sheet
- [ ] Handle sheet selection

### Integration
- [ ] Only render if `showSheetList` prop is true
- [ ] Update current sheet in state hook
- [ ] Filter component tree by current sheet
- [ ] Default to first visible sheet

### Checkpoint
- [ ] Sheet tabs appear (if enabled)
- [ ] Clicking tab switches sheets
- [ ] Component tree filters correctly
- [ ] Hidden sheets don't appear

---

## Phase 7: Polish & Cleanup

### Style Polish
- [ ] Match exact spacing/sizing of original
- [ ] Ensure hover states work
- [ ] Ensure focus states work
- [ ] Test in dark theme (if applicable)

### Code Cleanup
- [ ] Remove any `any` types
- [ ] Remove any `TSFixme` markers
- [ ] Add JSDoc comments to public functions
- [ ] Ensure consistent naming

### File Removal
- [ ] Verify all functionality works
- [ ] Delete `views/panels/componentspanel/ComponentsPanel.ts`
- [ ] Delete `templates/componentspanel.html`
- [ ] Update any remaining imports

### TASK-004 Preparation
- [ ] Add `migrationStatus` to ComponentItemData type
- [ ] Add placeholder for badge in ComponentItem
- [ ] Add placeholder for filter UI in header
- [ ] Document extension points

### Documentation
- [ ] Update CHANGELOG.md with changes
- [ ] Add notes to NOTES.md about patterns discovered
- [ ] Update any relevant dev-docs

### Checkpoint
- [ ] All original functionality works
- [ ] No console errors or warnings
- [ ] No TypeScript errors
- [ ] Old files removed
- [ ] Ready for TASK-004

---

## Post-Implementation

- [ ] Create PR with clear description
- [ ] Request review
- [ ] Test in multiple scenarios:
  - [ ] Fresh project
  - [ ] Project with many components
  - [ ] Project with deep folder nesting
  - [ ] Project with cloud functions
  - [ ] Project with pages
- [ ] Merge and verify in main branch

---

## Quick Reference: Port These Functions

From `ComponentsPanel.ts`:
- [ ] `addComponentToFolderStructure()`
- [ ] `getFolderForComponentWithName()`
- [ ] `getSheetForComponentWithName()`
- [ ] `getAcceptableDropType()`
- [ ] `dropOn()`
- [ ] `makeDraggable()`
- [ ] `makeDroppable()`
- [ ] `performAdd()`
- [ ] `onItemClicked()`
- [ ] `onCaretClicked()`
- [ ] `onComponentActionsClicked()`
- [ ] `onFolderActionsClicked()`
- [ ] `onRenameClicked()`
- [ ] `onDeleteClicked()`
- [ ] `onDuplicateClicked()`
- [ ] `onDuplicateFolderClicked()`
- [ ] `renderFolder()` (becomes React component)
- [ ] `returnComponentScopeAndSetActive()`
