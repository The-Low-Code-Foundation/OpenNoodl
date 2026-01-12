# TASK-012B: Logic Builder Integration Bug Fixes

**Status:** Ready to Start  
**Priority:** High (Blocking)  
**Estimated Time:** 1 hour  
**Dependencies:** TASK-012 Phase A-C Complete

---

## Overview

Fix critical integration bugs discovered during testing of the Logic Builder feature. The main issue is an architectural conflict between the canvas rendering system and the React-based CanvasTabs component.

---

## Bugs to Fix

### 🔴 Critical

**Bug #1-3, #5: Canvas Not Rendering**

- Opening a project shows blank canvas initially
- First component click shows nothing
- Second component click works normally
- Tabs not visible (only back/forward buttons)

**Root Cause:** CanvasTabs tries to "wrap" the canvas in a React tab system, but the canvas is rendered via vanilla JS/jQuery with its own lifecycle. This creates a DOM conflict where the canvas renders into the wrong container.

**Bug #4: Logic Builder Button Crash**

```
this.parent.model.getDisplayName is not a function
```

**Root Cause:** Incorrect assumption about model API. Method doesn't exist.

### 🟢 Low Priority

**Bug #6: Floating "Workspace" Label**

- Label floats in middle of property panel over button
- CSS positioning issue

---

## Root Cause Analysis

### The Architecture Conflict

**What Was Attempted:**

```tsx
// CanvasTabs.tsx - INCORRECT APPROACH
{
  activeTab?.type === 'canvas' && <div id="nodegraph-canvas-container">{/* Tried to render canvas here */}</div>;
}
```

**The Problem:**

1. The canvas is **NOT a React component**
2. It's rendered by `nodegrapheditor.ts` using a template
3. My CanvasTabs created a **duplicate** container with same ID
4. This causes DOM conflicts and canvas rendering failures

**Key Insight:**

- Canvas = The desktop (always there)
- Logic Builder tabs = Windows on the desktop (overlay)
- NOT: Canvas and Logic Builder as sibling tabs

---

## Fix Strategy (Option 1: Minimal Changes)

### Principle: Separation of Concerns

**Don't wrap the canvas. Keep them completely separate:**

1. CanvasTabs manages **Logic Builder tabs ONLY**
2. Canvas rendering completely untouched
3. Use visibility toggle instead of replacement
4. Coordinate via EventDispatcher

---

## Implementation Plan

### Step 1: Remove Canvas Tab Logic (20 min)

**File:** `CanvasTabs.tsx`

- Remove `type === 'canvas'` condition
- Remove canvas tab rendering
- Only render Logic Builder tabs
- Simplify component to single responsibility

**File:** `CanvasTabsContext.tsx`

- Remove canvas tab from initial state
- Only manage Logic Builder tabs
- Add event emission for visibility coordination

### Step 2: Add Visibility Coordination (10 min)

**File:** `nodegrapheditor.ts`

- Listen for `LogicBuilder.TabOpened` event
- Hide canvas elements when Logic Builder opens
- Listen for `LogicBuilder.TabClosed` event
- Show canvas elements when Logic Builder closes

**CSS Approach:**

```typescript
// When Logic Builder opens
this.el.find('#nodegraphcanvas').css('display', 'none');
this.el.find('.other-canvas-elements').css('display', 'none');

// When Logic Builder closes (or no tabs)
this.el.find('#nodegraphcanvas').css('display', 'block');
this.el.find('.other-canvas-elements').css('display', 'block');
```

### Step 3: Fix Logic Builder Button (5 min)

**File:** `LogicBuilderWorkspaceType.ts` (line ~81)

```typescript
// BEFORE (broken):
const nodeName = this.parent.model.label || this.parent.model.getDisplayName() || 'Logic Builder';

// AFTER (fixed):
const nodeName = this.parent.model.label || this.parent.model.type?.displayName || 'Logic Builder';
```

### Step 4: Fix CSS Label (10 min)

**File:** `LogicBuilderWorkspaceType.ts`

Properly structure the HTML with correct CSS classes:

```typescript
return `
  <div class="property-panel-input-wrapper">
    <label class="property-label">Workspace</label>
    <button id="edit-logic-blocks-btn" class="edit-blocks-button">
      ✨ Edit Logic Blocks
    </button>
  </div>
`;
```

### Step 5: Testing (15 min)

**Test Scenarios:**

1. ✅ Open project → Canvas renders immediately
2. ✅ Click component → Canvas shows nodes
3. ✅ Add Logic Builder node → Node appears
4. ✅ Click "Edit Blocks" → Logic Builder opens, canvas hidden
5. ✅ Close Logic Builder tab → Canvas shows again
6. ✅ Multiple Logic Builder tabs work
7. ✅ No console errors

---

## Technical Details

### Event Flow

```
User clicks "Edit Blocks"
  ↓
LogicBuilderWorkspaceType emits: LogicBuilder.OpenTab
  ↓
CanvasTabsContext creates Logic Builder tab
  ↓
CanvasTabsContext emits: LogicBuilder.TabOpened
  ↓
NodeGraphEditor hides canvas
  ↓
CanvasTabs renders Logic Builder workspace
```

```
User closes Logic Builder tab
  ↓
CanvasTabsContext removes tab
  ↓
If no more tabs: CanvasTabsContext emits: LogicBuilder.AllTabsClosed
  ↓
NodeGraphEditor shows canvas
  ↓
Canvas resumes normal rendering
```

### Files to Modify

**Major Changes:**

1. `CanvasTabs.tsx` - Remove canvas logic
2. `CanvasTabsContext.tsx` - Simplify, add events
3. `nodegrapheditor.ts` - Add visibility coordination

**Minor Fixes:** 4. `LogicBuilderWorkspaceType.ts` - Fix getDisplayName, CSS 5. `CanvasTabs.module.scss` - Remove canvas-specific styles

---

## Success Criteria

- [x] Canvas renders immediately on project open
- [ ] Canvas shows on first component click
- [ ] Logic Builder button works without errors
- [ ] Logic Builder opens in separate view (canvas hidden)
- [ ] Closing Logic Builder returns to canvas view
- [ ] Multiple Logic Builder tabs work correctly
- [ ] No floating labels or CSS issues
- [ ] No console errors

---

## Risks & Mitigation

### Risk: Breaking Canvas Rendering

**Mitigation:** Don't modify canvas rendering code at all. Only add/remove CSS display properties.

### Risk: Event Coordination Timing

**Mitigation:** Use EventDispatcher (already proven pattern in codebase).

### Risk: Edge Cases with Multiple Tabs

**Mitigation:** Comprehensive testing of tab opening/closing sequences.

---

## Future Improvements (Not in Scope)

- [ ] Smooth transitions between canvas and Logic Builder
- [ ] Remember last opened Logic Builder tabs
- [ ] Split-screen view (canvas + Logic Builder)
- [ ] Breadcrumb integration for Logic Builder
- [ ] Proper tab bar UI (currently just overlays)

---

## References

- Original issue: User testing session 2026-01-11
- Root cause investigation: TASK-012 CHANGELOG Session 2
- Canvas rendering: `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- CanvasTabs: `packages/noodl-editor/src/editor/src/views/CanvasTabs/`

---

## Notes

This is a **debugging and refactoring task**, not new feature development. The goal is to make the already-implemented Logic Builder actually work correctly by fixing the architectural mismatch discovered during testing.

**Key Learning:** When integrating React with legacy jQuery/vanilla JS code, keep them completely separate rather than trying to wrap one in the other.
