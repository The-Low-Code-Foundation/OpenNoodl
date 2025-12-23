# ComponentsPanel Rename Testing Plan

## Overview

This document outlines the testing plan to verify that the rename functionality works correctly after integrating the `useEventListener` hook from TASK-008.

**Bug Being Fixed:** Component/folder renames not updating in the UI despite successful backend operation.

**Root Cause:** EventDispatcher events weren't reaching React hooks due to closure incompatibility.

**Solution:** Integrated `useEventListener` hook which bridges EventDispatcher and React lifecycle.

---

## Test Environment Setup

### Prerequisites

```bash
# Ensure editor is built and running
npm run dev
```

### Test Project Requirements

- Project with at least 3-5 components
- At least one folder with components inside
- Mix of root-level and nested components

---

## Test Cases

### 1. Component Rename (Basic)

**Objective:** Verify component name updates in tree immediately after rename

**Steps:**

1. Open the editor with a test project
2. In Components panel, right-click a component
3. Select "Rename" from context menu
4. Enter a new name (e.g., "MyComponent" → "RenamedComponent")
5. Press Enter or click outside to confirm

**Expected Result:**

- ✅ Component name updates immediately in the tree
- ✅ Component icon/status indicators remain correct
- ✅ No console errors
- ✅ Undo/redo works correctly

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 2. Component Rename (Double-Click)

**Objective:** Verify double-click rename flow works

**Steps:**

1. Double-click a component name in the tree
2. Enter a new name
3. Press Enter to confirm

**Expected Result:**

- ✅ Rename input appears on double-click
- ✅ Name updates immediately after Enter
- ✅ UI remains responsive

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 3. Component Rename (Cancel)

**Objective:** Verify canceling rename doesn't cause issues

**Steps:**

1. Start renaming a component
2. Press Escape or click outside without changing name
3. Start rename again and change name
4. Press Escape to cancel

**Expected Result:**

- ✅ First cancel exits rename mode cleanly
- ✅ Second cancel discards changes
- ✅ Original name remains
- ✅ UI remains stable

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 4. Component Rename (Conflict Detection)

**Objective:** Verify duplicate name validation works

**Steps:**

1. Start renaming "ComponentA"
2. Try to rename it to "ComponentB" (which already exists)
3. Press Enter

**Expected Result:**

- ✅ Error toast appears: "Component name already exists"
- ✅ Rename mode stays active (user can fix the name)
- ✅ Original name unchanged
- ✅ No console errors

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 5. Folder Rename (Basic)

**Objective:** Verify folder rename updates all child components

**Steps:**

1. Create a folder with 2-3 components inside
2. Right-click the folder
3. Select "Rename"
4. Enter new folder name (e.g., "OldFolder" → "NewFolder")
5. Press Enter

**Expected Result:**

- ✅ Folder name updates immediately in tree
- ✅ All child component paths update (e.g., "OldFolder/Comp1" → "NewFolder/Comp1")
- ✅ Child components remain accessible
- ✅ Undo/redo works for entire folder rename

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 6. Nested Component Rename

**Objective:** Verify nested component paths update correctly

**Steps:**

1. Rename a component inside a folder
2. Verify path updates (e.g., "Folder/OldName" → "Folder/NewName")
3. Verify parent folder still shows correctly

**Expected Result:**

- ✅ Nested component name updates
- ✅ Path shows correct folder
- ✅ Parent folder structure unchanged
- ✅ Component still opens correctly

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 7. Rapid Renames

**Objective:** Verify multiple rapid renames don't cause issues

**Steps:**

1. Rename a component
2. Immediately after, rename another component
3. Rename a third component
4. Verify all names updated correctly

**Expected Result:**

- ✅ All three renames succeed
- ✅ No race conditions or stale data
- ✅ UI updates consistently
- ✅ Undo/redo stack correct

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 8. Rename While Component Open

**Objective:** Verify rename works when component is currently being edited

**Steps:**

1. Open a component in the node graph editor
2. In Components panel, rename that component
3. Verify editor tab/title updates

**Expected Result:**

- ✅ Component name updates in tree
- ✅ Editor tab title updates (if applicable)
- ✅ Component remains open and editable
- ✅ No editor state lost

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 9. Undo/Redo Rename

**Objective:** Verify undo/redo works correctly

**Steps:**

1. Rename a component (e.g., "Comp1" → "Comp2")
2. Press Cmd+Z (Mac) or Ctrl+Z (Windows) to undo
3. Press Cmd+Shift+Z / Ctrl+Y to redo

**Expected Result:**

- ✅ Undo reverts name back to "Comp1"
- ✅ Tree updates immediately after undo
- ✅ Redo changes name to "Comp2"
- ✅ Tree updates immediately after redo
- ✅ Multiple undo/redo cycles work correctly

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

### 10. Special Characters in Names

**Objective:** Verify name validation handles special characters

**Steps:**

1. Try renaming with special characters: `@#$%^&*()`
2. Try renaming with spaces: "My Component Name"
3. Try renaming with only spaces: " "

**Expected Result:**

- ✅ Invalid characters rejected with appropriate message
- ✅ Spaces may or may not be allowed (based on validation rules)
- ✅ Empty/whitespace-only names rejected
- ✅ Rename mode stays active for correction

**Actual Result:**

- [ ] Pass / [ ] Fail
- Notes:

---

## Console Monitoring

While testing, monitor the browser console for:

### Expected Logs (OK to see):

- `🚀 React ComponentsPanel RENDERED`
- `🔍 handleRenameConfirm CALLED`
- `✅ Calling performRename...`
- `✅ Rename successful - canceling rename mode`

### Problematic Logs (Investigate if seen):

- ❌ Any errors related to EventDispatcher
- ❌ "performRename failed"
- ❌ Warnings about stale closures
- ❌ React errors or warnings
- ❌ "forceRefresh is not a function" (should never appear)

---

## Performance Check

### Memory Leak Test

**Steps:**

1. Perform 20-30 rapid renames
2. Open browser DevTools → Performance/Memory tab
3. Check for memory growth

**Expected Result:**

- ✅ No significant memory leaks
- ✅ Event listeners properly cleaned up
- ✅ UI remains responsive

---

## Regression Checks

Verify these existing features still work:

- [ ] Creating new components
- [ ] Deleting components
- [ ] Duplicating components
- [ ] Drag & drop to move components
- [ ] Setting component as home
- [ ] Opening components in editor
- [ ] Folder expand/collapse
- [ ] Context menu on components
- [ ] Context menu on folders

---

## Known Issues / Limitations

_Document any known issues discovered during testing:_

1.
2.
3.

---

## Test Results Summary

**Date Tested:** ******\_\_\_******

**Tester:** ******\_\_\_******

**Overall Result:** [ ] All Pass [ ] Some Failures [ ] Critical Issues

**Critical Issues Found:**

-

**Minor Issues Found:**

-

**Recommendations:**

-

---

## Sign-Off

**Ready for Production:** [ ] Yes [ ] No [ ] With Reservations

**Notes:**
