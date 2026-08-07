# TASK-008C: ComponentsPanel Drag-Drop System

## Overview

This subtask addresses the systematic implementation and debugging of the drag-drop system for the React-based ComponentsPanel. Previous attempts have been piecemeal, leading to circular debugging. This document provides a complete scope and test matrix.

---

## Expected Behaviors (Full Requirements)

### A. DRAG INITIATION

| Requirement | Description                                                                                |
| ----------- | ------------------------------------------------------------------------------------------ |
| A1          | Click + hold on any **component** → initiates drag                                         |
| A2          | Click + hold on any **folder** → initiates drag                                            |
| A3          | Click + hold on any **component-folder** (component with nested children) → initiates drag |
| A4          | Visual feedback: dragged item follows cursor with ghost/label                              |
| A5          | Drag threshold: 5px movement before drag activates (prevents accidental drags)             |

### B. DROP TARGETS

| ID  | Source           | Target             | Result                                          | Example                                            |
| --- | ---------------- | ------------------ | ----------------------------------------------- | -------------------------------------------------- |
| B1  | Component        | Component          | Creates nesting                                 | `/PageA` → `/PageB` = `/PageB/PageA`               |
| B2  | Component        | Folder             | Moves into folder                               | `/MyComp` → `/Folder/` = `/Folder/MyComp`          |
| B3  | Component        | Empty Space (Root) | Moves to root level                             | `/Folder/MyComp` → root = `/MyComp`                |
| B4  | Folder           | Folder             | Moves folder + all contents                     | `/FolderA/` → `/FolderB/` = `/FolderB/FolderA/...` |
| B5  | Folder           | Component          | Nests folder inside component                   | `/FolderA/` → `/PageB` = `/PageB/FolderA/...`      |
| B6  | Folder           | Empty Space (Root) | Moves folder to root                            | `/Parent/FolderA/` → root = `/FolderA/...`         |
| B7  | Component-Folder | Any target         | Same as folder (moves component + all children) | Same as B4/B5/B6                                   |

### C. VALIDATION

| Requirement | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| C1          | Cannot drop item onto itself                                    |
| C2          | Cannot drop parent into its own descendant (circular reference) |
| C3          | Cannot create naming conflicts (same name at same level)        |
| C4          | Show "forbidden" cursor when drop not allowed                   |

### D. VISUAL FEEDBACK

| Requirement | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| D1          | Hover over valid target → highlight with border/background         |
| D2          | Hover over invalid target → show forbidden indicator               |
| D3          | Hover over empty space → show root drop zone indicator (blue tint) |
| D4          | Cursor changes based on drop validity (`move` vs `none`)           |

### E. COMPLETION

| Requirement | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| E1          | Successful drop → item moves, tree re-renders at new location |
| E2          | Failed/cancelled drop → item returns to origin (no change)    |
| E3          | All operations support Undo (Cmd+Z)                           |
| E4          | All operations support Redo (Cmd+Shift+Z)                     |

---

## Current Implementation Status

### Code Inventory

| File                       | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `useDragDrop.ts`           | React hook managing drag state, uses PopupLayer.startDragging        |
| `useComponentActions.ts`   | Drop handlers: `handleDropOn()`, `handleDropOnRoot()`                |
| `ComponentItem.tsx`        | Drag initiation + drop target handlers for components                |
| `FolderItem.tsx`           | Drag initiation + drop target handlers for folders                   |
| `ComponentsPanelReact.tsx` | Background drop zone handlers                                        |
| `popuplayer.js`            | Legacy jQuery drag system (startDragging, indicateDropType, endDrag) |

### Feature Status Matrix

| Feature                    | Handler Exists         | Wired Up | Tested | Works? |
| -------------------------- | ---------------------- | -------- | ------ | ------ |
| B1: Component → Component  | ✅ `handleDropOn`      | ✅       | ⏳     | ❓     |
| B2: Component → Folder     | ✅ `handleDropOn`      | ✅       | ⏳     | ❓     |
| B3: Component → Root       | ✅ `handleDropOnRoot`  | ✅       | ⏳     | ❌     |
| B4: Folder → Folder        | ✅ `handleDropOn`      | ✅       | ⏳     | ❓     |
| B5: Folder → Component     | ✅ `handleDropOn`      | ✅       | ⏳     | ❌     |
| B6: Folder → Root          | ✅ `handleDropOnRoot`  | ✅       | ⏳     | ❌     |
| B7: Component-Folder → any | ✅ (handled as folder) | ✅       | ⏳     | ❌     |

---

## Known Issues

### Issue 1: Background Drop Zone Not Triggering

- **Symptom**: Dragging to empty space doesn't trigger root move
- **Likely cause**: `e.target === e.currentTarget` check may be wrong, or handlers not attached properly
- **Debug approach**: Add console.log to `handleBackgroundMouseEnter`

### Issue 2: Nested Component → Other Component Not Working

- **Symptom**: Can't drag a nested component to another component to create new nesting
- **Likely cause**: `canDrop` validation or drop handler not triggering
- **Debug approach**: Add console.log to `handleDrop` in ComponentItem

### Issue 3: Parent Folder → Component Not Working

- **Symptom**: Can't drag a folder with children onto a component
- **Likely cause**: Folder→Component case may not be recognized
- **Debug approach**: Check `handleDropOn` for folder→component case

### Issue 4: Component-Folder Drag Returns to Origin

- **Symptom**: Dragging component-folders snaps back instead of completing drop
- **Likely cause**: Missing `PopupLayer.endDrag()` call or wrong case branch
- **Debug approach**: Add logging to each case in `handleDropOn`

---

## Implementation Plan

### Phase 1: Diagnostic Logging (30 min)

Add comprehensive logging to understand current behavior:

```typescript
// In ComponentItem.tsx handleMouseEnter
console.log('🎯 Component hover:', { node, isDragging: PopupLayer.instance.isDragging() });

// In FolderItem.tsx handleMouseEnter
console.log('📁 Folder hover:', { folder, isDragging: PopupLayer.instance.isDragging() });

// In ComponentsPanelReact.tsx handleBackgroundMouseEnter
console.log('🏠 Background hover:', { target: e.target, currentTarget: e.currentTarget });

// In useComponentActions.ts handleDropOn
console.log('💾 handleDropOn called:', { draggedItem, targetItem });

// In useComponentActions.ts handleDropOnRoot
console.log('🏠 handleDropOnRoot called:', { draggedItem });
```

### Phase 2: Test Each Combination (1 hour)

Create test scenario for each combination and verify:

1. **B1**: Create `/CompA`, `/CompB`. Drag `/CompA` onto `/CompB`.
2. **B2**: Create `/CompA`, `/Folder`. Drag `/CompA` onto `/Folder`.
3. **B3**: Create `/Folder/CompA`. Drag `/CompA` to empty space.
4. **B4**: Create `/FolderA`, `/FolderB`. Drag `/FolderA` onto `/FolderB`.
5. **B5**: Create `/FolderA`, `/CompB`. Drag `/FolderA` onto `/CompB`.
6. **B6**: Create `/Parent/FolderA`. Drag `/FolderA` to empty space.
7. **B7**: Create `/CompParent` with nested `/CompParent/Child`. Drag `/CompParent` onto another component.

### Phase 3: Fix Issues (2-3 hours)

Address each failing combination based on diagnostic output.

### Phase 4: Remove Logging & Test (30 min)

Clean up debug code and verify all combinations work.

---

## Acceptance Criteria

All items must pass:

- [ ] **B1**: Component → Component creates proper nesting
- [ ] **B2**: Component → Folder moves component into folder
- [ ] **B3**: Component → Root moves component to top level
- [ ] **B4**: Folder → Folder moves entire folder hierarchy
- [ ] **B5**: Folder → Component nests folder inside component
- [ ] **B6**: Folder → Root moves folder to top level
- [ ] **B7**: Component-Folder → any target works as folder
- [ ] **C1-C4**: All validations prevent invalid operations
- [ ] **D1-D4**: Visual feedback works for all scenarios
- [ ] **E1-E4**: Completion and undo/redo work

---

## Technical Notes

### PopupLayer Drag System Integration

The legacy `PopupLayer` uses a jQuery-based drag system:

```javascript
// Start drag
PopupLayer.instance.startDragging({
  label: 'Item Name',
  type: 'component' | 'folder',
  dragTarget: HTMLElement,
  onDragEnd: () => {
    /* cleanup */
  }
});

// During drag, from drop targets:
PopupLayer.instance.isDragging(); // Check if dragging
PopupLayer.instance.indicateDropType('move' | 'none'); // Visual feedback

// Complete drag
PopupLayer.instance.endDrag(); // Must be called for drop to complete!
```

**Critical**: If `endDrag()` is not called, the dragged element returns to origin.

### Component-Folder Pattern

When a component has nested children (e.g., `/Parent` with `/Parent/Child`), it's rendered as a `FolderItem` with attached component data:

```typescript
// In tree building:
{
  type: 'folder',
  data: {
    path: '/Parent',
    name: 'Parent',
    isComponentFolder: true,
    component: ComponentModel // The component at /Parent
  }
}
```

Drop handlers must check `node.data.component` to handle these properly.

### Background Drop Zone

The background drop zone should trigger when:

1. User is dragging (PopupLayer.isDragging() === true)
2. Mouse enters the tree container
3. Mouse is NOT over any tree item (target === currentTarget)

The current implementation uses `e.target === e.currentTarget` which may be too restrictive.

---

## Files to Modify

1. **ComponentItem.tsx** - Add diagnostic logging, verify drop handlers
2. **FolderItem.tsx** - Add diagnostic logging, verify drop handlers
3. **ComponentsPanelReact.tsx** - Fix background drop zone
4. **useDragDrop.ts** - Verify canDrop logic
5. **useComponentActions.ts** - Verify all drop handler cases

---

## References

- **TASK-008 CHANGELOG** - Previous fix attempts documented
- **popuplayer.js** - Legacy drag system (don't modify, just understand)
- **UNDO-QUEUE-PATTERNS.md** - Correct undo patterns for operations

---

_Created: December 27, 2025_
_Last Updated: December 27, 2025_
