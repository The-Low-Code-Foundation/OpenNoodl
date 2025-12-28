# TASK-004B: ComponentsPanel React Migration

## ✅ CURRENT STATUS: COMPLETE

**Last Updated:** December 26, 2025  
**Status:** ✅ COMPLETE - All features working, ready for production  
**Completion:** 100% (All functionality implemented and tested)

### Quick Summary

- ✅ Full React migration from legacy jQuery/underscore.js
- ✅ All features working: tree rendering, context menus, drag-drop, rename
- ✅ Direct ProjectModel subscription pattern (events working correctly)
- ✅ Root folder display issue fixed (no unnamed folder)
- ✅ Components like "App" immediately visible on load
- ✅ Zero jQuery dependencies, proper TypeScript throughout

**Migration Complete!** The panel is now fully modernized and ready for future enhancements (TASK-004 badges/filters).

---

## Overview

Migrate the ComponentsPanel from the legacy jQuery/underscore.js View pattern to a modern React component. This eliminates tech debt, enables the migration badges/filters feature from TASK-004, and establishes a clean pattern for migrating remaining legacy panels.

**Phase:** 2 (Runtime Migration System)  
**Priority:** HIGH (blocks TASK-004 parts 2 & 3)  
**Effort:** 6-8 hours (Original estimate - actual time ~12 hours due to caching issues)  
**Risk:** Medium → HIGH (Webpack caching complications)

---

## Background

### Current State

`ComponentsPanel.ts` is a ~800 line legacy View class that uses:

- jQuery for DOM manipulation and event handling
- Underscore.js HTML templates (`componentspanel.html`) with `data-*` attribute bindings
- Manual DOM updates via `scheduleRender()` pattern
- Complex drag-and-drop via PopupLayer integration
- Deep integration with ProjectModel, NodeGraphEditor, and sheets system

### Why Migrate Now?

1. **Blocks TASK-004**: Adding migration status badges and filters to a jQuery template creates a Frankenstein component mixing React dialogs into jQuery views
2. **Philosophy alignment**: "When we touch a component, we clean it properly"
3. **Pattern establishment**: This migration creates a template for other legacy panels
4. **Maintainability**: React components are easier to test, extend, and debug

### Prior Art

Several patterns already exist in the codebase:

- `ReactView` wrapper class for hybrid components
- `SidePanel.tsx` - the container that hosts sidebar panels (already React)
- `SidebarModel` registration pattern supports both legacy Views and React components
- `UndoQueuePanel` example in `docs/sidebar.md` shows the migration pattern

---

## Goals

1. **Full React rewrite** of ComponentsPanel with zero jQuery dependencies
2. **Feature parity** with existing functionality (drag-drop, folders, context menus, rename-in-place)
3. **Clean integration** with existing SidebarModel registration
4. **Prepare for badges/filters** - structure component to easily add TASK-004 features
5. **TypeScript throughout** - proper typing, no TSFixme

---

## Architecture

### Component Structure

```
ComponentsPanel/
├── ComponentsPanel.tsx          # Main container, registered with SidebarModel
├── ComponentsPanel.module.scss  # Scoped styles
├── components/
│   ├── ComponentTree.tsx        # Recursive tree renderer
│   ├── ComponentItem.tsx        # Single component row
│   ├── FolderItem.tsx           # Folder row with expand/collapse
│   ├── SheetSelector.tsx        # Sheet tabs (if showSheetList option)
│   └── AddComponentMenu.tsx     # "+" button dropdown
├── hooks/
│   ├── useComponentsPanel.ts    # Main state management hook
│   ├── useDragDrop.ts           # Drag-drop logic
│   └── useRenameMode.ts         # Inline rename handling
├── types.ts                     # TypeScript interfaces
└── index.ts                     # Exports
```

### State Management

Use React hooks with ProjectModel as source of truth:

- `useModernModel` hook to subscribe to ProjectModel events
- Local state for UI concerns (expanded folders, selection, rename mode)
- Derive tree structure from ProjectModel on each render

### Drag-Drop Strategy

Two options to evaluate:

**Option A: Native HTML5 Drag-Drop**

- Lighter weight, no dependencies
- Already used elsewhere in codebase via PopupLayer
- Requires manual drop zone management

**Option B: @dnd-kit library**

- Already planned as dependency for DASH-003 (Project Organisation)
- Better accessibility, smoother animations
- More code but cleaner abstractions

**Recommendation**: Start with Option A to maintain existing PopupLayer integration patterns. Can upgrade to dnd-kit later if needed.

---

## Implementation Phases

### Phase 1: Foundation (1-2 hours)

Create the component structure and basic rendering without interactivity.

**Files to create:**

- `ComponentsPanel.tsx` - Shell component
- `ComponentsPanel.module.scss` - Base styles (port from existing CSS)
- `types.ts` - TypeScript interfaces
- `hooks/useComponentsPanel.ts` - State hook skeleton

**Tasks:**

1. Create directory structure
2. Define TypeScript interfaces for component/folder items
3. Create basic ComponentsPanel that renders static tree
4. Register with SidebarModel (replacing legacy panel)
5. Verify it mounts without errors

**Success criteria:**

- Panel appears in sidebar
- Shows hardcoded component list
- No console errors

### Phase 2: Tree Rendering (1-2 hours)

Implement proper tree structure from ProjectModel.

**Files to create:**

- `components/ComponentTree.tsx`
- `components/ComponentItem.tsx`
- `components/FolderItem.tsx`

**Tasks:**

1. Subscribe to ProjectModel with useModernModel
2. Build folder/component tree structure (port logic from `addComponentToFolderStructure`)
3. Implement recursive tree rendering
4. Add expand/collapse for folders
5. Implement component selection
6. Add proper icons (home, page, cloud function, visual)

**Success criteria:**

- Tree matches current panel exactly
- Folders expand/collapse
- Selection highlights correctly
- Icons display correctly

### Phase 3: Context Menus (1 hour)

Port context menu functionality.

**Files to create:**

- `components/AddComponentMenu.tsx`

**Tasks:**

1. Implement header "+" button menu using existing PopupMenu
2. Implement component right-click context menu
3. Implement folder right-click context menu
4. Wire up all actions (rename, duplicate, delete, make home)

**Success criteria:**

- All context menu items work
- Actions perform correctly (components created, renamed, deleted)
- Undo/redo works for all actions

### Phase 4: Drag-Drop (2 hours)

Port the drag-drop system.

**Files to create:**

- `hooks/useDragDrop.ts`

**Tasks:**

1. Create drag-drop hook using PopupLayer.startDragging pattern
2. Implement drag initiation on component/folder rows
3. Implement drop zones on folders and between items
4. Port drop validation logic (`getAcceptableDropType`)
5. Port drop execution logic (`dropOn`)
6. Handle cross-sheet drops

**Success criteria:**

- Components can be dragged to folders
- Folders can be dragged to folders
- Invalid drops show appropriate feedback
- Drop creates undo action

### Phase 5: Inline Rename (1 hour)

Port rename-in-place functionality.

**Files to create:**

- `hooks/useRenameMode.ts`

**Tasks:**

1. Create rename mode state management
2. Implement inline input field rendering
3. Handle Enter to confirm, Escape to cancel
4. Validate name uniqueness
5. Handle focus management

**Success criteria:**

- Double-click or menu triggers rename
- Input shows with current name selected
- Enter saves, Escape cancels
- Invalid names show error

### Phase 6: Sheet Selector (30 min)

Port sheet/tab functionality (if `showSheetList` option is true).

**Files to create:**

- `components/SheetSelector.tsx`

**Tasks:**

1. Render sheet tabs
2. Handle sheet switching
3. Respect `hideSheets` option

**Success criteria:**

- Sheets display correctly
- Switching sheets filters component list
- Hidden sheets don't appear

### Phase 7: Polish & Integration (1 hour)

Final cleanup and TASK-004 preparation.

**Tasks:**

1. Remove old ComponentsPanel.ts and template
2. Update any imports/references
3. Add data attributes for testing
4. Prepare component structure for badges/filters (TASK-004)
5. Write migration notes for other legacy panels

**Success criteria:**

- No references to old files
- All tests pass
- Ready for TASK-004 badge implementation

---

## Files to Modify

### Create (New)

```
packages/noodl-editor/src/editor/src/views/panels/ComponentsPanel/
├── ComponentsPanel.tsx
├── ComponentsPanel.module.scss
├── components/
│   ├── ComponentTree.tsx
│   ├── ComponentItem.tsx
│   ├── FolderItem.tsx
│   ├── SheetSelector.tsx
│   └── AddComponentMenu.tsx
├── hooks/
│   ├── useComponentsPanel.ts
│   ├── useDragDrop.ts
│   └── useRenameMode.ts
├── types.ts
└── index.ts
```

### Modify

```
packages/noodl-editor/src/editor/src/router.setup.ts
  - Update ComponentsPanel import to new location
  - Verify SidebarModel.register call works with React component

packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.tsx
  - May need adjustment if React components need different handling
```

### Delete (After Migration Complete)

```
packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentsPanel.ts
packages/noodl-editor/src/editor/src/templates/componentspanel.html
```

### Keep (Reference/Integration)

```
packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentsPanelFolder.ts
  - Data structure class, can be reused or ported to types.ts

packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentTemplates.ts
  - Template definitions, used by AddComponentMenu
```

---

## Technical Notes

### SidebarModel Registration

Current registration in `router.setup.ts`:

```typescript
SidebarModel.instance.register({
  id: 'components',
  name: 'Components',
  order: 1,
  icon: IconName.Components,
  onOpen: () => {
    /* ... */
  },
  panelProps: {
    options: {
      showSheetList: true,
      hideSheets: ['__cloud__']
    }
  },
  panel: ComponentsPanel // Currently legacy View class
});
```

React components can be registered directly - see how `SidePanel.tsx` handles this with `SidebarModel.instance.getPanelComponent()`.

### ProjectModel Integration

Key events to subscribe to:

- `componentAdded` - New component created
- `componentRemoved` - Component deleted
- `componentRenamed` - Component name changed
- `rootComponentChanged` - Home component changed

Use `useModernModel(ProjectModel.instance, [...events])` pattern.

### Existing Patterns to Follow

Look at these files for patterns:

- `SearchPanel.tsx` - Modern React sidebar panel
- `VersionControlPanel.tsx` - Another React sidebar panel
- `useModernModel` hook - Model subscription pattern
- `PopupMenu` component - For context menus

### CSS Migration

Port styles from:

- `packages/noodl-editor/src/editor/src/styles/componentspanel.css`

To CSS modules in `ComponentsPanel.module.scss`.

---

## Testing Checklist

### Basic Rendering

- [ ] Panel appears in sidebar when Components icon clicked
- [ ] Components display with correct names
- [ ] Folders display with correct names
- [ ] Nested structure renders correctly
- [ ] Icons display correctly (home, page, cloud, visual, folder)

### Selection

- [ ] Clicking component selects it
- [ ] Clicking folder selects it
- [ ] Selection opens component in node graph editor
- [ ] Only one item selected at a time

### Folders

- [ ] Clicking caret expands/collapses folder
- [ ] Folder state persists during session
- [ ] Empty folders display correctly
- [ ] "Folder components" (folders that are also components) work

### Context Menus

- [ ] "+" button shows add menu
- [ ] Component context menu shows all options
- [ ] Folder context menu shows all options
- [ ] "Make home" option works
- [ ] "Rename" option works
- [ ] "Duplicate" option works
- [ ] "Delete" option works (with confirmation)

### Drag-Drop

- [ ] Can drag component to folder
- [ ] Can drag folder to folder
- [ ] Cannot drag folder into its own children
- [ ] Drop indicator shows correctly
- [ ] Invalid drops show feedback
- [ ] Undo works after drop

### Rename

- [ ] Double-click enables rename
- [ ] Context menu "Rename" enables rename
- [ ] Enter confirms rename
- [ ] Escape cancels rename
- [ ] Tab moves to next item (optional)
- [ ] Invalid names show error

### Sheets

- [ ] Sheet tabs display (if enabled)
- [ ] Clicking sheet filters component list
- [ ] Hidden sheets don't appear

### Integration

- [ ] Warnings icon appears for components with warnings
- [ ] Selection syncs with node graph editor
- [ ] New component appears immediately after creation
- [ ] Deleted component disappears immediately

---

## Risks & Mitigations

### Risk: Drag-drop edge cases

**Mitigation**: Port logic directly from existing implementation, test thoroughly

### Risk: Performance with large component trees

**Mitigation**: Use React.memo for tree items, virtualize if needed (future)

### Risk: Breaking existing functionality

**Mitigation**: Test all features before removing old code, keep old files until verified

### Risk: Subtle event timing issues

**Mitigation**: Use same ProjectModel subscription pattern as other panels

---

## Success Criteria

1. **Feature parity**: All existing functionality works identically
2. **No regressions**: Existing projects work correctly
3. **Clean code**: No jQuery, no TSFixme, proper TypeScript
4. **Ready for TASK-004**: Easy to add migration badges/filters
5. **Pattern established**: Can be used as template for other panel migrations

---

## Future Enhancements (Out of Scope)

- Virtualized rendering for huge component trees
- Keyboard navigation (arrow keys)
- Multi-select for bulk operations
- Search/filter within panel (separate from SearchPanel)
- Drag to reorder (not just move to folder)

---

## Dependencies

**Blocked by:** None

**Blocks:**

- TASK-004 Parts 2 & 3 (Migration Status Badges & Filters)

---

## References

- Current implementation: `views/panels/componentspanel/ComponentsPanel.ts`
- Template: `templates/componentspanel.html`
- Styles: `styles/componentspanel.css`
- Folder model: `views/panels/componentspanel/ComponentsPanelFolder.ts`
- Sidebar docs: `packages/noodl-editor/docs/sidebar.md`
- SidePanel container: `views/SidePanel/SidePanel.tsx`
