# BUG-5: Code Editor Modal Won't Close on Outside Click

**Priority:** P1 - Significant UX Issue  
**Status:** ✅ Complete - Verified Working  
**Created:** January 13, 2026  
**Updated:** January 14, 2026

---

## Problem

When opening the new JavaScriptEditor (CodeMirror 6) by clicking a code property in the property panel, the modal stays on screen even when clicking outside of it. This prevents users from closing the editor without saving.

**Expected behavior:**

- Click outside modal → Auto-saves and closes
- Press Escape → Auto-saves and closes
- Click Save button → Saves and stays open

**Current behavior:**

- Click outside modal → Nothing happens (modal stays open)
- Only way to close is clicking Save button

---

## Impact

- Users feel "trapped" in the code editor
- Unclear how to dismiss the modal
- Inconsistent with other popout behaviors in OpenNoodl

---

## Root Cause Analysis

### Code Flow

1. **CodeEditorType.ts** calls `this.parent.showPopout()` with JavaScriptEditor content
2. **showPopout()** should close on outside clicks by default (unless `manualClose: true`)
3. **onClose callback** calls `save()` which auto-saves changes
4. Something is preventing the outside click from triggering close

### Likely Causes

**Possibility 1: Event Propagation**

- JavaScriptEditor or its container might be stopping event propagation
- Click events not bubbling up to PopupLayer

**Possibility 2: Z-index/Pointer Events**

- Modal overlay might not be capturing clicks
- CSS `pointer-events` preventing click detection

**Possibility 3: React Event Handling**

- React's synthetic event system might interfere with jQuery-based popout system
- Event listener attachment timing issue

---

## Investigation Steps

### 1. Check Event Propagation

Verify JavaScriptEditor isn't stopping clicks:

```typescript
// In JavaScriptEditor.tsx <div ref={rootRef}>
// Should NOT have onClick that calls event.stopPropagation()
```

### 2. Check Popout Configuration

Current call in `CodeEditorType.ts`:

```typescript
this.parent.showPopout({
  content: { el: [this.popoutDiv] },
  attachTo: $(el),
  position: 'right',
  disableDynamicPositioning: true,
  // manualClose is NOT set, so should close on outside click
  onClose: function () {
    save(); // Auto-saves
    // ... cleanup
  }
});
```

### 3. Compare with Monaco Editor

The old Monaco CodeEditor works correctly - compare popout setup.

### 4. Test Overlay Click Handler

Check if PopupLayer's overlay click handler is working:

```javascript
// In browser console when modal is open:
document.querySelector('.popout-overlay')?.addEventListener('click', (e) => {
  console.log('Overlay clicked', e);
});
```

---

## Solution Options

### Option A: Fix Event Propagation (Preferred)

If JavaScriptEditor is stopping events, remove/fix that:

```typescript
// JavaScriptEditor.tsx - ensure no stopPropagation on root
<div
  ref={rootRef}
  className={css['Root']}
  // NO onClick handler here
>
```

### Option B: Add Explicit Close Button

If outside-click proves unreliable, add a close button:

```typescript
<div className={css['ToolbarRight']}>
  <button onClick={onClose} className={css['CloseButton']}>
    ✕ Close
  </button>
  <button onClick={handleFormat}>Format</button>
  <button onClick={onSave}>Save</button>
</div>
```

But this is less elegant - prefer fixing the root cause.

### Option C: Set manualClose Flag

Force manual close behavior and add close button:

```typescript
this.parent.showPopout({
  // ...
  manualClose: true, // Require explicit close
  onClose: function () {
    save(); // Still auto-save
    // ...
  }
});
```

---

## Implementation Plan

1. **Investigate** - Determine exact cause (event propagation vs overlay)
2. **Fix Root Cause** - Prefer making outside-click work
3. **Test** - Verify click-outside, Escape key, and Save all work
4. **Fallback** - If outside-click unreliable, add close button

---

## Design Decision: Auto-Save Behavior

**Chosen: Option A - Auto-save on close**

- Clicking outside closes modal and auto-saves
- No "unsaved changes" warning needed
- Consistent with existing Monaco editor behavior
- Simpler UX - less friction

**Rejected alternatives:**

- Option B: Require explicit save (adds friction)
- Option C: Add visual feedback (over-engineering for this use case)

---

## Files to Modify

**Investigation:**

- `packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx` - Check event handlers
- `packages/noodl-editor/src/editor/src/views/popuplayer.js` - Check overlay click handling

**Fix (likely):**

- `packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx` - Remove stopPropagation if present
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts` - Verify popout config

**Fallback:**

- Add close button to JavaScriptEditor if outside-click proves unreliable

---

## Testing Checklist

- [ ] Click outside modal closes it
- [ ] Changes are auto-saved on close
- [ ] Escape key closes modal (if PopupLayer supports it)
- [ ] Save button works (saves but doesn't close)
- [ ] Works for both editable and read-only editors
- [ ] No console errors on close
- [ ] Cursor position preserved if re-opening same editor

---

## Related Issues

- Related to Task 11 (Advanced Code Editor implementation)
- Similar pattern needed for Blockly editor modals

---

## Notes

- This is a quick fix - should be resolved before continuing with other bugs
- Auto-save behavior matches existing patterns in OpenNoodl
- If outside-click proves buggy across different contexts, consider standardizing on explicit close buttons

---

_Last Updated: January 13, 2026_
