# BUG-4: Double-Click Label Opens Comment Modal

**Priority:** P1 - Breaks expected behavior  
**Status:** 🔴 Research  
**Introduced in:** Related to Phase 2 Task 8 (Property panel changes)

---

## Symptoms

1. Select a node in canvas ✅
2. Property panel opens showing node properties ✅
3. Double-click the node label at the top of the property panel ❌
4. **WRONG:** Comment modal opens instead of inline rename ❌
5. **EXPECTED:** Should enter inline edit mode to rename the node ✅

---

## User Impact

- **Severity:** High - Breaks expected rename interaction
- **Frequency:** Every time you try to rename via double-click
- **Frustration:** High - confusing that comment modal opens instead
- **Workaround:** Use right-click menu or other rename method

---

## Expected Behavior

Double-clicking a node label should:

1. Enter inline edit mode
2. Show text input with current label
3. Allow typing new label
4. Save on Enter or blur
5. Cancel on Escape

**Like this:**

```
Before:   MyNodeName
Click:    [MyNodeName____]  ← Editable input, cursor at end
Type:     [UpdatedName___]
Enter:    UpdatedName        ← Saved
```

---

## Initial Analysis

### Likely Related to BUG-1

This bug probably shares the same root cause as BUG-1 (Property Panel Stuck). The property panel event handling was changed in Phase 2 Task 8, and now events are being routed incorrectly.

### Suspected Root Cause

The double-click event on the label is likely being:

1. Intercepted by a new comment system handler
2. Or bubbling up to a parent component that opens comments
3. Or the label click handler was removed/broken during refactoring

### Event Flow to Investigate

```
User Double-Click on Label
    ↓
Label element receives event
    ↓
??? Event handler (should be rename)
    ↓
❌ Instead: Comment modal opens
```

---

## Investigation Tasks

- [ ] Find property panel label element in code
- [ ] Check what event handlers are attached to label
- [ ] Trace double-click event propagation
- [ ] Verify if rename functionality still exists
- [ ] Check if comment modal handler is on parent element
- [ ] Compare with pre-Phase-2-Task-8 behavior

---

## Files to Investigate

1. **Property Panel Label Component**

   - Find where node label is rendered in property panel
   - Check for `onDoubleClick` or `dblclick` handlers
   - Verify rename functionality exists

2. **Property Panel Container**

   - Check if parent has comment event handlers
   - Look for event bubbling that might intercept double-click

3. **Node Model**

   - Verify `rename()` method still exists
   - Check if it's being called from anywhere

4. **Comment System**
   - Find comment modal trigger code
   - Check what events trigger it
   - See if it's catching events meant for label

---

## Proposed Solutions

### Solution A: Fix Event Handler Priority

Ensure label double-click handler stops propagation:

```typescript
const handleLabelDoubleClick = (e: React.MouseEvent) => {
  e.stopPropagation(); // Don't let comment handler see this
  e.preventDefault();

  enterRenameMode();
};
```

### Solution B: Restore Missing Rename Handler

If handler was removed, add it back:

```typescript
<div
  className="node-label"
  onDoubleClick={handleRename}
>
  {node.name}
</div>

// When in edit mode:
<input
  value={editedName}
  onChange={(e) => setEditedName(e.target.value)}
  onKeyDown={handleKeyDown}
  onBlur={handleSave}
  autoFocus
/>
```

### Solution C: Remove Comment Handler from Panel

If comment handler is on property panel container, either:

1. Remove it (use BUG-3's solution of button in header instead)
2. Make it more specific (only certain elements trigger it)
3. Check target element before opening modal

---

## Implementation Plan

1. **Locate the label element** in property panel code
2. **Add/fix double-click handler** for rename
3. **Ensure event doesn't bubble** to comment handler
4. **Implement inline edit mode**:
   - Replace label with input
   - Focus input, select all text
   - Save on Enter or blur
   - Cancel on Escape
5. **Test thoroughly** to ensure:
   - Double-click renames
   - Comment modal doesn't open
   - Other interactions still work

---

## User Experience

### Current (Broken)

1. Double-click label
2. Comment modal opens unexpectedly
3. Have to close modal
4. Have to find another way to rename
5. Confused and frustrated

### Fixed

1. Double-click label
2. Label becomes editable input
3. Type new name
4. Press Enter
5. Node renamed ✅

---

## Testing Plan

### Basic Rename

- [ ] Double-click label opens inline edit
- [ ] Can type new name
- [ ] Enter key saves new name
- [ ] Escape key cancels edit
- [ ] Click outside (blur) saves new name

### Edge Cases

- [ ] Empty name rejected or reverted
- [ ] Very long names handled appropriately
- [ ] Special characters handled correctly
- [ ] Duplicate names (if validation exists)

### No Regressions

- [ ] Comment modal doesn't open on label double-click
- [ ] Other double-click behaviors still work
- [ ] Single click on label doesn't trigger rename
- [ ] Right-click context menu still accessible

---

## Success Criteria

- [ ] Double-clicking node label enters rename mode
- [ ] Can successfully rename node inline
- [ ] Comment modal does NOT open when double-clicking label
- [ ] Rename interaction feels natural and responsive
- [ ] All edge cases handled gracefully
- [ ] No regressions in other property panel interactions

---

## Related Issues

- **BUG-1:** Property panel stuck (likely same root cause - event handling)
- **BUG-3:** Comment system UX (removing comment handlers might fix this too)

---

_Last Updated: January 13, 2026_
