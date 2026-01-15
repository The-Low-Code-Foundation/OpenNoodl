# BUG-2: Blockly Node Randomly Deleted on Tab Close

**Priority:** P0 - Data loss risk  
**Status:** 🔴 Research  
**Introduced in:** Phase 3 Task 12 (Blockly integration)

---

## Symptoms

1. Add a Logic Builder (Blockly) node to canvas ✅
2. Open the Blockly editor tab (click "Edit Logic Blocks") ✅
3. Add some blocks in the Blockly editor ✅
4. Close the Blockly editor tab ✅
5. **SOMETIMES** the Logic Builder node disappears from canvas ❌

**Frequency:** Intermittent - doesn't happen every time (need to determine success rate)

---

## User Impact

- **Severity:** Critical - Data loss
- **Frequency:** Intermittent (need testing to determine %)
- **Frustration:** Extremely high - losing work is unacceptable
- **Workaround:** None - just have to be careful and check after closing

---

## Initial Hypotheses

### Hypothesis 1: Race Condition in Save/Close

When closing tab, workspace might not be saved before close event completes:

1. User clicks close button
2. Tab starts closing
3. Workspace save triggered but async
4. Tab closes before save completes
5. Some cleanup logic runs
6. Node gets deleted?

### Hypothesis 2: Event Bubbling to Canvas

Close button click might bubble through to canvas:

1. Click close button on tab
2. Event bubbles to canvas layer
3. Canvas interprets as "click empty space"
4. Triggers deselect
5. Some condition causes node deletion instead of just deselection

### Hypothesis 3: Keyboard Shortcut Conflict

Accidental Delete key press during close:

1. Tab is closing
2. User presses Delete (or Esc triggers something)
3. Node is selected in background
4. Delete key removes node

### Hypothesis 4: Node Lifecycle Cleanup Bug

Tab close triggers node cleanup by mistake:

1. Tab close event fires
2. Cleanup logic runs to remove tab from state
3. Logic accidentally also removes associated node
4. Node deleted from graph

---

## Investigation Tasks

### Step 1: Reproduce Consistently

- [ ] Test closing tab 20 times, track success vs failure
- [ ] Try different timing (close immediately vs wait a few seconds)
- [ ] Try with empty workspace vs with blocks
- [ ] Try with multiple Blockly nodes
- [ ] Check if it happens on first close vs subsequent closes

### Step 2: Add Logging

Add comprehensive logging to trace node lifecycle:

```typescript
// In CanvasTabs.tsx - tab close handler
console.log('[CanvasTabs] Closing Blockly tab for node:', nodeId);

// In nodegrapheditor.ts - node deletion
console.log('[NodeGraphEditor] Node being deleted:', nodeId, 'Reason:', reason);

// In logic-builder.js runtime node
console.log('[LogicBuilder] Node lifecycle event:', event, nodeId);
```

### Step 3: Check Workspace Save Timing

- [ ] Verify `handleBlocklyWorkspaceChange` is called before close
- [ ] Add timing logs to see save vs close race
- [ ] Check if workspace parameter is actually saved to node model

### Step 4: Event Flow Analysis

- [ ] Trace all events fired during tab close
- [ ] Check if any events reach canvas
- [ ] Look for stopPropagation calls

### Step 5: Review Cleanup Logic

- [ ] Check `CanvasTabsContext` cleanup on unmount
- [ ] Review node selection state during close
- [ ] Look for any "remove node if X condition" logic

---

## Files to Investigate

1. **`packages/noodl-editor/src/editor/src/views/CanvasTabs/CanvasTabs.tsx`**

   - Tab close handler
   - Workspace change handler
   - Event propagation

2. **`packages/noodl-editor/src/editor/src/contexts/CanvasTabsContext.tsx`**

   - Tab state management
   - Cleanup logic
   - Node ID mapping

3. **`packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`**

   - Node deletion logic
   - Selection state during tab operations
   - Event handlers that might trigger deletion

4. **`packages/noodl-runtime/src/nodes/std-library/logic-builder.js`**

   - Runtime node lifecycle
   - Parameter update handlers
   - Any cleanup logic

5. **`packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx`**
   - Workspace save logic
   - Component unmount/cleanup

---

## Proposed Solutions (Pending Investigation)

### Solution A: Ensure Save Before Close

```typescript
const handleCloseTab = async (nodeId: string) => {
  console.log('[CanvasTabs] Closing tab for node:', nodeId);

  // Save workspace first
  await saveWorkspace(nodeId);

  // Then close tab
  removeTab(nodeId);
};
```

### Solution B: Add Confirmation for Unsaved Changes

```typescript
const handleCloseTab = (nodeId: string) => {
  if (hasUnsavedChanges(nodeId)) {
    // Show confirmation dialog
    showConfirmDialog({
      message: 'Close without saving changes?',
      onConfirm: () => removeTab(nodeId)
    });
  } else {
    removeTab(nodeId);
  }
};
```

### Solution C: Prevent Event Bubbling

```typescript
const handleCloseClick = (e: React.MouseEvent, nodeId: string) => {
  e.stopPropagation(); // Prevent bubbling to canvas
  e.preventDefault();

  closeTab(nodeId);
};
```

### Solution D: Guard Against Accidental Deletion

```typescript
// In node deletion logic
const deleteNode = (nodeId: string, source: string) => {
  // Don't delete if associated Blockly tab is open
  if (blocklyTabOpenForNode(nodeId)) {
    console.warn('[NodeGraphEditor] Prevented deletion of node with open Blockly tab');
    return;
  }

  // Proceed with deletion
  actuallyDeleteNode(nodeId);
};
```

---

## Testing Plan

### Reproduction Testing

1. Create Logic Builder node
2. Open editor, add blocks, close tab
3. Repeat 20 times, track failures
4. Try different scenarios (empty, with blocks, multiple nodes)
5. Document exact conditions when it fails

### With Logging

1. Add comprehensive logging
2. Reproduce the bug with logs active
3. Analyze log sequence to find root cause
4. Identify exact point where deletion occurs

### After Fix

1. Test tab close 50 times - should NEVER delete node
2. Test with multiple Blockly nodes open
3. Test rapid open/close cycles
4. Test with unsaved changes
5. Test with saved changes
6. Verify workspace is properly saved on close

---

## Success Criteria

- [ ] Can close Blockly tab 100 times without a single node deletion
- [ ] Workspace is always saved before tab closes
- [ ] No event bubbling causes unintended canvas clicks
- [ ] No race conditions between save and close
- [ ] Logging shows clean lifecycle with no errors

---

## Related Issues

This might be related to:

- Tab state management from Phase 3 Task 12
- Node selection state management
- Canvas event handling

---

_Last Updated: January 13, 2026_
