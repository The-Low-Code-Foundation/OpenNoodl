# Blockly Drag-and-Drop Issue Investigation

**Date:** 2026-01-11  
**Status:** Partially Resolved - Issue Remains  
**Severity:** Medium (Annoying but Usable)

## Summary

Blockly blocks in the Logic Builder can only be dragged for approximately 1000ms before the drag gesture automatically terminates, regardless of drag speed or distance.

## Symptoms

### Issue 1: Drag Timeout

- User can click and hold a block
- Block begins dragging normally
- After ~1000ms (consistently), the drag stops
- User must release and re-grab to continue dragging
- Issue occurs with both:
  - Dragging blocks from toolbox onto workspace
  - Dragging existing blocks around workspace

### Issue 2: Connection Errors (CRITICAL) 🔴

- When dragging a block near another block's connector (to connect them)
- Insertion marker appears (visual preview of connection)
- Console floods with errors:
  - `"The block associated with the block move event could not be found"`
  - `"Cannot read properties of undefined (reading 'indexOf')"`
  - `"Block not present in workspace's list of top-most blocks"` (repeated 10+ times)
- Errors occur during:
  - Connection preview (hovering over valid connection point)
  - Ending drag operation
  - Disposing insertion marker
- **Result:** Blocks may not connect properly, workspace state becomes corrupted

## Environment

- **Editor:** OpenNoodl Electron app (React 19)
- **Blockly Version:** v10+ (modern API with named exports)
- **Integration:** React component wrapping Blockly SVG workspace
- **Browser Engine:** Chromium (Electron)

## What We've Tried

### ✅ **Fixed: Change Event Spam**

- **Problem:** Blockly fired change events on every pixel of movement (13-16/second during drag)
- **Solution:** Added 150ms debounce to onChange callback
- **Result:** Reduced save spam from 50+/drag to ~1/second
- **Impact on drag issue:** Improved performance but did NOT fix 1000ms limit

### ❌ **Attempted: Pointer Events Adjustment**

- **Hypothesis:** `pointer-events: none` on canvas-tabs-root was blocking gestures
- **Attempt:** Removed `pointer-events: none`
- **Result:** Broke canvas clicks when no tabs open
- **Reverted:** Yes - needed for canvas layer coordination

### ✅ **Working: Z-Index Layering**

```html
<div id="canvas-tabs-root" style="position: absolute; z-index: 100; pointer-events: none">
  <!-- CanvasTabs renders here -->
</div>
```

`.CanvasTabs` has `pointer-events: all` to re-enable clicks when tabs render.

## Current Code Structure

### BlocklyWorkspace.tsx

```typescript
// Debounced change listener
const changeListener = () => {
  if (!onChange || !workspace) return;

  if (changeTimeoutRef.current) {
    clearTimeout(changeTimeoutRef.current);
  }

  // Only fire after 150ms of no activity
  changeTimeoutRef.current = setTimeout(() => {
    const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    const code = javascriptGenerator.workspaceToCode(workspace);
    onChange(workspace, json, code);
  }, 150);
};

workspace.addChangeListener(changeListener);
```

### DOM Structure

```
canvas-tabs-root (z:100, pointer-events:none)
  ↳ CanvasTabs (pointer-events:all when rendered)
      ↳ TabBar
      ↳ TabContent
          ↳ BlocklyContainer
              ↳ Blockly SVG workspace
```

## Console Output During Drag

### Normal Drag (No Connection)

```
🔧 [Blockly] Initializing workspace
✅ [Blockly] Loaded initial workspace
[NodeGraphEditor] Workspace changed for node xxx (every ~1-2 seconds)
Project saved Sun Jan 11 2026 21:19:57 GMT+0100
```

**Note:** Much less spam than before (used to be 13-16/second), but drag still stops at 1000ms.

### Connection Attempt (CRITICAL ERRORS) 🔴

When dragging a block over another block's connector:

```
❌ [Blockly] Failed to update workspace: Error: The block associated with the block move event could not be found
    at BlockMove.currentLocation (blockly_compressed.js:1595:331)
    at new BlockMove (blockly_compressed.js:1592:541)
    at RenderedConnection.connect_ (blockly_compressed.js:935:316)
    ...

❌ [Blockly] Failed to update workspace: TypeError: Cannot read properties of undefined (reading 'indexOf')
    at removeElem (blockly_compressed.js:119:65)
    at WorkspaceSvg.removeTypedBlock (blockly_compressed.js:1329:64)
    at BlockSvg.disposeInternal (blockly_compressed.js:977:393)
    at InsertionMarkerPreviewer.hideInsertionMarker (blockly_compressed.js:1535:410)
    ...

Uncaught Error: Block not present in workspace's list of top-most blocks. (repeated 10+ times)
    at WorkspaceSvg.removeTopBlock (blockly_compressed.js:1328:254)
    at BlockSvg.dispose (blockly_compressed.js:977:218)
    at InsertionMarkerPreviewer.hideInsertionMarker (blockly_compressed.js:1535:410)
    ...
```

**Error Pattern:**

1. Block drag starts normally
2. User approaches valid connection point
3. Insertion marker (preview) appears
4. Errors flood console (10-20 errors per connection attempt)
5. Errors occur in:
   - `BlockMove` event creation
   - Insertion marker disposal
   - Block state management
6. Workspace state may become corrupted

**Hypothesis:** The debounced onChange callback might be interfering with Blockly's internal state management during connection operations. When Blockly tries to update insertion markers or finalize connections, it expects immediate state consistency, but React's async updates + debouncing create race conditions.

## Theories

### 1. **React Re-Render Interruption**

- Even though onChange is debounced, React might re-render for other reasons
- Re-rendering CanvasTabs could unmount/remount Blockly workspace
- **Evidence:** Consistent 1000ms suggests a timeout somewhere

### 2. **Blockly Internal Gesture Management**

- Blockly v10 might have built-in gesture timeout for security/performance
- Drag might be using Blockly's gesture system which has limits
- **Evidence:** 1000ms is suspiciously round number

### 3. **Browser Pointer Capture Timeout**

- Chromium might have drag gesture timeouts
- SVG elements might have different pointer capture rules
- **Evidence:** Only affects Blockly, not canvas nodes

### 4. **Hidden Autosave/Event Loop**

- Something else might be interrupting pointer capture periodically
- Project autosave runs every second (seen in logs)
- **Evidence:** Saves happen around the time drags break

### 5. **React 19 Automatic Batching**

- React 19's automatic batching might affect Blockly's internal state
- Blockly's gesture tracking might not account for React batching
- **Evidence:** No direct evidence, but timing is suspicious

## What to Investigate Next

1. **Blockly Gesture Configuration**

   - Check if Blockly has configurable drag timeouts
   - Look for `maxDragDuration` or similar config options

2. **React Component Lifecycle**

   - Add logging to track re-renders during drag
   - Check if BlocklyWorkspace component re-renders mid-drag

3. **Pointer Events Flow**

   - Use browser DevTools to trace pointer events during drag
   - Check if `pointerup` or `pointercancel` fires automatically

4. **Blockly Source Code**

   - Search Blockly source for hardcoded timeout values
   - Look in gesture.ts/drag.ts for 1000ms constants

5. **SVG vs Canvas Interaction**
   - Test if issue occurs with Blockly in isolation (no canvas layers)
   - Check if z-index stacking affects pointer capture

## Workaround

Users can drag, release, re-grab, and continue dragging. Annoying but functional.

## Files Modified

- `BlocklyWorkspace.tsx` - Added debouncing
- `nodegrapheditor.html` - Fixed z-index layering
- `CanvasTabs.module.scss` - Added pointer-events coordination
- `LogicBuilderWorkspaceType.ts` - Fixed property panel layout

## Success Criteria for Resolution

- [ ] User can drag blocks continuously for 10+ seconds
- [ ] No forced drag termination
- [ ] Smooth drag performance maintained
- [ ] No increase in save spam

## Related Issues

- Tab visibility (FIXED - z-index issue)
- JavaScript generator import (FIXED - needed named export)
- Property panel layout (FIXED - flexbox spacing)
- Canvas click blocking (FIXED - pointer-events coordination)
