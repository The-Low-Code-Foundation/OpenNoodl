# Blockly Drag-and-Drop Fix Attempt

**Date:** 2026-01-11  
**Status:** Fix Implemented - Testing Required  
**Severity:** High (Core functionality)

## Problem Summary

Two critical issues with Blockly integration:

1. **Drag Timeout:** Blocks could only be dragged for ~1000ms before gesture terminated
2. **Connection Errors:** Console flooded with errors when trying to connect blocks

## Root Cause Analysis

The original implementation used **blanket debouncing** on ALL Blockly change events:

```typescript
// ❌ OLD APPROACH - Debounced ALL events
const changeListener = () => {
  if (changeTimeoutRef.current) clearTimeout(changeTimeoutRef.current);

  changeTimeoutRef.current = setTimeout(() => {
    const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    const code = javascriptGenerator.workspaceToCode(workspace);
    onChange(workspace, json, code);
  }, 150);
};
```

### Why This Caused Problems

1. **During drag operations:** Blockly fires MANY events (BLOCK_DRAG, BLOCK_MOVE, etc.)
2. **Each event triggered:** A new debounce timeout
3. **React state updates:** Potentially caused re-renders during gesture
4. **Blockly's internal state:** Expected immediate consistency, but our debounce + React async updates created race conditions
5. **Insertion markers:** When trying to show connection previews, Blockly tried to update blocks that were in an inconsistent state

## The Solution

**Event Filtering** - Only respond to events that actually change workspace structure:

```typescript
// ✅ NEW APPROACH - Filter events intelligently
const changeListener = (event: Blockly.Events.Abstract) => {
  if (!onChange || !workspace) return;

  // Ignore UI events that don't change workspace structure
  if (event.type === Blockly.Events.BLOCK_DRAG) return;
  if (event.type === Blockly.Events.BLOCK_MOVE && !event.isUiEvent) return;
  if (event.type === Blockly.Events.SELECTED) return;
  if (event.type === Blockly.Events.CLICK) return;
  if (event.type === Blockly.Events.VIEWPORT_CHANGE) return;
  if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) return;
  if (event.type === Blockly.Events.THEME_CHANGE) return;
  if (event.type === Blockly.Events.TRASHCAN_OPEN) return;

  // For UI events that DO change workspace, debounce them
  const isUiEvent = event.isUiEvent;

  if (isUiEvent) {
    // Debounce user-initiated changes (300ms)
    changeTimeoutRef.current = setTimeout(() => {
      const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
      const code = javascriptGenerator.workspaceToCode(workspace);
      onChange(workspace, json, code);
    }, 300);
  } else {
    // Programmatic changes fire immediately (undo/redo, loading)
    const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    const code = javascriptGenerator.workspaceToCode(workspace);
    onChange(workspace, json, code);
  }
};
```

### Key Changes

1. **Event type checking:** Ignore events that are purely UI feedback
2. **UI vs Programmatic:** Different handling based on event source
3. **No interference with gestures:** BLOCK_DRAG events are completely ignored
4. **Longer debounce:** Increased from 150ms to 300ms for stability
5. **Immediate programmatic updates:** Undo/redo and loading don't debounce

## Expected Results

### Before Fix

- ❌ Drag stops after ~1000ms
- ❌ Console errors during connection attempts
- ❌ Insertion markers cause state corruption
- ✅ But: no event spam (previous fix still working)

### After Fix

- ✅ Drag continuously for 10+ seconds
- ✅ No console errors during connections
- ✅ Clean insertion marker operations
- ✅ No event spam (maintained)

## Testing Checklist

### Drag Performance

- [ ] Drag block from toolbox → workspace (slow drag, 5+ seconds)
- [ ] Drag block around workspace (slow drag, 10+ seconds)
- [ ] Drag block quickly across workspace
- [ ] Drag multiple blocks in succession

### Connection Operations

- [ ] Drag block to connect to another block
- [ ] Check console for errors during connection
- [ ] Verify insertion marker appears/disappears smoothly
- [ ] Verify blocks actually connect properly

### Workspace Persistence

- [ ] Add blocks, close tab, reopen → blocks should persist
- [ ] Edit workspace, switch to canvas, back to Logic Builder → no loss
- [ ] Save project, reload → workspace loads correctly

### Performance

- [ ] No lag during dragging
- [ ] Console shows reasonable event frequency
- [ ] Project saves at reasonable intervals (not spamming)

## Files Modified

- `packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx`
  - Replaced blanket debouncing with event filtering
  - Added event type checks for UI-only events
  - Separated UI vs programmatic event handling
  - Increased debounce timeout to 300ms

## Rollback Plan

If this fix doesn't work, we can:

1. Revert to previous debounced approach
2. Try alternative: disable onChange during gestures using Blockly gesture events
3. Try alternative: use MutationObserver instead of change events

## Learning

> **Blockly Event System:** Blockly fires many event types. Not all need persistence. UI feedback events (drag, select, viewport) should be ignored. Only respond to structural changes (CREATE, DELETE, CHANGE, MOVE completed). The `isUiEvent` property distinguishes user actions from programmatic changes.

## Next Steps

1. **Test the fix** - Run through testing checklist above
2. **If successful** - Update DRAG-DROP-ISSUE.md with "RESOLVED" status
3. **If unsuccessful** - Document what still fails and try alternative approaches
4. **Record in CHANGELOG.md** - Document the fix for future reference
5. **Record in LEARNINGS.md** - Add to institutional knowledge

---

**Testing Required By:** Richard (manual testing in running app)
**Expected Outcome:** Smooth, continuous dragging with no console errors
