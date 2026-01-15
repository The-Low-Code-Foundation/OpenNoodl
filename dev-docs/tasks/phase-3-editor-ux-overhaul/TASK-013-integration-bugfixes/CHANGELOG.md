# TASK-013 Integration Bug Fixes - CHANGELOG

This document tracks progress on fixing bugs introduced during Phase 2 Task 8 and Phase 3 Task 12.

---

## 2026-01-13 - Task Created

### Documentation Complete

**Created task structure:**

- ✅ Main README with overview and implementation phases
- ✅ BUG-1: Property Panel Stuck (detailed investigation doc)
- ✅ BUG-2: Blockly Node Deletion (intermittent data loss)
- ✅ BUG-2.1: Blockly UI Polish (quick wins)
- ✅ BUG-3: Comment UX Overhaul (design doc)
- ✅ BUG-4: Label Double-Click (opens wrong modal)
- ✅ CHANGELOG (this file)

**Status:**

- **Phase A:** Research & Investigation (IN PROGRESS)
- **Phase B:** Quick Wins (PENDING)
- **Phase C:** Core Fixes (IN PROGRESS)
- **Phase D:** Complex Debugging (PENDING)
- **Phase E:** Testing & Documentation (PENDING)

---

## 2026-01-13 - BUG-1 FIXED: Property Panel Stuck

### Root Cause Identified

Found in `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts` line 1149:

The `selectNode()` method had conditional logic:

- **First click** (when `!node.selected`): Called `SidebarModel.instance.switchToNode()` ✅
- **Subsequent clicks** (when `node.selected === true`): Only handled double-click navigation, **never called switchToNode()** ❌

This meant clicking a node that was already "selected" wouldn't update the property panel.

### Solution Applied

**Implemented Option A:** Always switch to node regardless of selection state

Changed logic to:

1. Update selector state only if node not selected (unchanged behavior)
2. **ALWAYS call `SidebarModel.instance.switchToNode()`** (KEY FIX)
3. Handle double-click navigation separately when `leftButtonIsDoubleClicked` is true

### Changes Made

- **File:** `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- **Method:** `selectNode()`
- **Lines:** ~1149-1183
- **Type:** Logic refactoring to separate concerns

### Testing Needed

- [ ] Click node A → panel shows A
- [ ] Click node B → panel shows B (not A)
- [ ] Click node C → panel shows C
- [ ] Rapid clicking between nodes works correctly
- [ ] Double-click navigation still works
- [ ] No regressions in multiselect behavior

**Next Steps:**

1. Manual testing with `npm run dev`
2. If confirmed working, mark as complete
3. Move to BUG-4 (likely same root cause - event handling)

---

## Future Entries

Template for future updates:

```markdown
## YYYY-MM-DD - [Milestone/Phase Name]

### What Changed

- Item 1
- Item 2

### Bugs Fixed

- BUG-X: Brief description

### Discoveries

- Important finding 1
- Important finding 2

### Next Steps

- Next action 1
- Next action 2
```

---

## [2026-01-13 16:00] - BUG-1 ACTUALLY FIXED: React State Mutation

### Investigation Update

The first fix attempt failed. Node visual selection worked, but property panel stayed stuck. This revealed the real problem was deeper in the React component layer.

### Root Cause Identified (ACTUAL)

Found in `packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx`:

**The `nodeSelected` event listener (lines 73-84) was MUTATING React state:**

```typescript
setPanels((prev) => {
  const component = SidebarModel.instance.getPanelComponent(panelId);
  if (component) {
    prev[panelId] = React.createElement(component); // ❌ MUTATION!
  }
  return prev; // ❌ Returns SAME object reference
});
```

React uses reference equality to detect changes. When you mutate an object and return the same reference, **React doesn't detect any change** and skips re-rendering. This is why the panel stayed stuck showing the old node!

### Solution Applied

**Fixed ALL three state mutations in SidePanel.tsx:**

1. **Initial panel load** (lines 30-40)
2. **activeChanged listener** (lines 48-66)
3. **nodeSelected listener** (lines 73-84) ← **THE CRITICAL BUG**

Changed ALL setState calls to return NEW objects:

```typescript
setPanels((prev) => {
  const component = SidebarModel.instance.getPanelComponent(panelId);
  if (component) {
    return {
      ...prev, // ✅ Spread creates NEW object
      [panelId]: React.createElement(component)
    };
  }
  return prev;
});
```

### Changes Made

- **File:** `packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx`
- **Lines:** 30-40, 48-66, 73-84
- **Type:** React state management bug fix
- **Severity:** Critical (broke all node property panel updates)

### Why This Happened

This was introduced during Phase 2 Task 8 when the side panel was migrated to React. The original code likely worked because it was using a different state management approach. The React migration introduced this classic state mutation anti-pattern.

### Testing Needed

- [x] Visual selection works (confirmed earlier)
- [x] Click node A → panel shows A ✅
- [x] Click node B → panel shows B (not stuck on A) ✅
- [x] Click node C → panel shows C ✅
- [x] Rapid clicking between nodes updates correctly ✅
- [x] No performance regressions ✅

**STATUS: ✅ VERIFIED AND WORKING - BUG-1 COMPLETE**

### Learnings

**Added to COMMON-ISSUES.md:**

- React setState MUST return new objects for React to detect changes
- State mutation is silent and hard to debug (no errors, just wrong behavior)
- Always use spread operator or Object.assign for state updates

---

---

## [2026-01-13 17:00] - BUG-2.1 COMPLETE: Blockly UI Polish

### Changes Implemented

**Goal:** Clean up Blockly Logic Builder UI by:

1. Removing redundant "View Generated Code" button
2. Showing "Generated code" field in property panel (read-only)
3. Changing "Edit Logic Blocks" to "View Logic Blocks"
4. Using new CodeMirror editor in read-only mode for generated code

### Root Cause

The generatedCode parameter was being hidden via CSS and had a separate button to view it. This was redundant since we can just show the parameter directly with the new code editor in read-only mode.

### Solution Applied

**1. Node Definition (`logic-builder.js`)**

- Changed `generatedCode` parameter:
  - `editorType: 'code-editor'` (use new JavaScriptEditor)
  - `displayName: 'Generated code'` (lowercase 'c')
  - `group: 'Advanced'` (show in Advanced group)
  - `readOnly: true` (mark as read-only)
- Removed hiding logic (empty group, high index)

**2. LogicBuilderWorkspaceType Component**

- Removed "View Generated Code" button completely
- Removed CSS that was hiding generatedCode parameter
- Changed button text: "✨ Edit Logic Blocks" → "View Logic Blocks"
- Removed `onViewCodeClicked()` method (no longer needed)
- Kept CSS to hide empty group labels

**3. CodeEditorType Component**

- Added support for `readOnly` port flag
- Pass `disabled={this.port?.readOnly || false}` to JavaScriptEditor
- This makes the editor truly read-only (can't edit, can copy/paste)

### Files Modified

1. `packages/noodl-runtime/src/nodes/std-library/logic-builder.js`
   - Updated `generatedCode` parameter configuration
2. `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/LogicBuilderWorkspaceType.ts`
   - Removed second button
   - Updated button label
   - Removed CSS hiding logic
3. `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts`
   - Added readOnly support for JavaScriptEditor

### Testing Needed

- [ ] Logic Builder node shows only "View Logic Blocks" button
- [ ] "Generated code" field appears in Advanced group
- [ ] Clicking "Generated code" opens new CodeMirror editor
- [ ] Editor is read-only (can't type, can select/copy)
- [ ] No empty group labels visible

**Next Steps:**

1. Test with `npm run clean:all && npm run dev`
2. Add a Logic Builder node and add some blocks
3. Close Blockly tab and verify generated code field appears
4. Click it and verify read-only CodeMirror editor opens

**STATUS: ✅ IMPLEMENTED - AWAITING USER TESTING**

---

## [2026-01-13 22:48] - BUG-2.1 FINAL FIX: Read-Only Flag Location

### Investigation Complete

After clean rebuild and testing, discovered `readOnly: false` in logs. Root cause: the `readOnly` flag wasn't being passed through to the property panel.

### Root Cause (ACTUAL)

The port object only contains these properties:

```javascript
allKeys: ['name', 'type', 'plug', 'group', 'displayName', 'index'];
```

`readOnly` was NOT in the list because it was at the wrong location in the node definition.

**Wrong Location (not passed through):**

```javascript
generatedCode: {
  type: { ... },
  readOnly: true  // ❌ Not passed to port object
}
```

**Correct Location (passed through):**

```javascript
generatedCode: {
  type: {
    readOnly: true; // ✅ Passed as port.type.readOnly
  }
}
```

### Solution Applied

**Moved `readOnly` flag inside `type` object in `logic-builder.js`:**

```javascript
generatedCode: {
  type: {
    name: 'string',
    allowEditOnly: true,
    codeeditor: 'javascript',
    readOnly: true  // ✅ Correct location
  },
  displayName: 'Generated code',
  group: 'Advanced',
  set: function (value) { ... }
}
```

**CodeEditorType already checks `p.type?.readOnly`** so no changes needed there!

### Files Modified

1. `packages/noodl-runtime/src/nodes/std-library/logic-builder.js`
   - Moved `readOnly: true` inside `type` object (line 237)
2. `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts`
   - Added debug logging to identify the issue
   - Added fallback to check multiple locations for readOnly flag
   - Disabled history tracking for read-only fields (prevents crash)

### Testing Checklist

After `npm run clean:all && npm run dev`:

- [x] Console shows `[CodeEditorType.fromPort] Resolved readOnly: true` ✅
- [x] Console shows `[CodeEditorType] Rendering JavaScriptEditor: {readOnly: true}` ✅
- [x] Generated code editor is completely read-only (can't type) ✅
- [x] Can still select and copy text ✅
- [x] Format and Save buttons are disabled ✅
- [x] No CodeHistoryManager crash on close ✅

**STATUS: ✅ COMPLETE AND VERIFIED WORKING**

### Key Learning

**Added to LEARNINGS-NODE-CREATION.md:**

- Port-level properties (like `readOnly`) are NOT automatically passed to the property panel
- To make a property accessible, it must be inside the `type` object
- The property panel accesses it as `port.type.propertyName`
- Always check `allKeys` in debug logs to see what properties are actually available

---

_Last Updated: January 13, 2026 22:48_

---

## [2026-01-13 23:00] - BUG-5 DOCUMENTED: Code Editor Modal Close Behavior

### Bug Report Created

**Issue:** New JavaScriptEditor (CodeMirror 6) modal doesn't close when clicking outside of it. Users feel "trapped" and unclear how to dismiss the editor.

**Expected behavior:**

- Click outside modal → Auto-saves and closes
- Press Escape → Auto-saves and closes
- Click Save button → Saves and stays open

**Current behavior:**

- Click outside modal → Nothing happens (modal stays open)
- Only way to interact is through Save button

### Design Decision Made

**Chose Option A: Auto-save on close**

- Keep it simple - clicking outside auto-saves and closes
- No "unsaved changes" warning needed (nothing is lost)
- Consistent with existing Monaco editor behavior
- Less friction for users

Rejected alternatives:

- Option B: Require explicit save (adds friction)
- Option C: Add visual feedback indicators (over-engineering)

### Investigation Plan

**Likely causes to investigate:**

1. **Event propagation** - JavaScriptEditor stopping click events
2. **Z-index/pointer events** - Overlay not capturing clicks
3. **React event handling** - Synthetic events interfering with jQuery popout system

**Next steps:**

1. Check if JavaScriptEditor root has onClick that calls stopPropagation
2. Compare with Monaco editor (which works correctly)
3. Test overlay click handler in browser console
4. Fix root cause (prefer making outside-click work)
5. Fallback: Add explicit close button if outside-click proves unreliable

### Files to Investigate

- `packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx`
- `packages/noodl-editor/src/editor/src/views/popuplayer.js`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts`

### Priority

**P1 - Significant UX Issue**

This is a quick fix that should be resolved early in Phase B (Quick Wins), likely before or alongside BUG-2.1.

**STATUS: 🔴 DOCUMENTED - AWAITING INVESTIGATION**

---

## [2026-01-14 21:57] - BUG-5 FIXED: Code Editor Modal Close Behavior

### Root Cause Identified

The `.popup-layer` element has `pointer-events: none` by default, which means clicks pass through it. The CSS class `.dim` adds `pointer-events: all` for modals with dark overlays, but popouts (like the code editor) don't use the dim class.

**The problem:**

- `.popup-layer-popout` itself has `pointer-events: all` → clicks on editor work ✅
- `.popup-layer` has `pointer-events: none` → clicks OUTSIDE pass through ❌
- The popuplayer.js click handlers never receive the events → popout doesn't close

### Solution Implemented

**Added new CSS class `.has-popouts` to enable click detection:**

**1. CSS Changes (`popuplayer.css`):**

```css
/* Enable pointer events when popouts are active (without dimming background)
   This allows clicking outside popouts to close them */
.popup-layer.has-popouts {
  pointer-events: all;
}
```

**2. JavaScript Changes (`popuplayer.js`):**

**In `showPopout()` method (after line 536):**

```javascript
this.popouts.push(popout);

// Enable pointer events for outside-click-to-close when popouts are active
this.$('.popup-layer').addClass('has-popouts');
```

**In `hidePopout()` method (inside close function):**

```javascript
if (this.popouts.length === 0) {
  this.$('.popup-layer-blocker').css({ display: 'none' });
  // Disable pointer events when no popouts are active
  this.$('.popup-layer').removeClass('has-popouts');
}
```

### How It Works

1. When a popout opens, add `has-popouts` class → enables `pointer-events: all`
2. Click detection now works → outside clicks trigger `hidePopouts()`
3. When last popout closes, remove `has-popouts` class → restores `pointer-events: none`
4. This ensures clicks only work when popouts are actually open

### Files Modified

1. `packages/noodl-editor/src/editor/src/styles/popuplayer.css`
   - Added `.popup-layer.has-popouts` CSS rule (lines 23-26)
2. `packages/noodl-editor/src/editor/src/views/popuplayer.js`
   - Added `addClass('has-popouts')` after pushing popout (lines 538-540)
   - Added `removeClass('has-popouts')` when popouts array becomes empty (line 593)

### Testing Checklist

- [ ] Open code editor by clicking a code property
- [ ] Click outside modal → Editor closes and auto-saves
- [ ] Changes are preserved after close
- [ ] Press Escape → Editor closes (existing functionality)
- [ ] Save button still works (saves but doesn't close)
- [ ] Works for both editable and read-only editors
- [ ] Multiple popouts can be open (all close when clicking outside)
- [ ] No console errors on close

### Design Notes

**Auto-save behavior maintained:**

- Clicking outside triggers `onClose` callback
- `onClose` calls `save()` which auto-saves changes
- No "unsaved changes" warning needed
- Consistent with existing Monaco editor behavior

**No visual changes:**

- No close button added (outside-click is intuitive enough)
- Keeps UI clean and minimal
- Escape key also works as an alternative

### Testing Complete

User verification confirmed:

- ✅ Click outside modal closes editor
- ✅ Changes auto-save on close
- ✅ No console errors
- ✅ Clean, intuitive UX

**STATUS: ✅ COMPLETE - VERIFIED WORKING**

---

_Last Updated: January 14, 2026 22:01_
