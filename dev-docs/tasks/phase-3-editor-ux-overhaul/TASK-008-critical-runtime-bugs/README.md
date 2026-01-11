# TASK-008: Critical Runtime Bug Fixes

**Status:** 🔴 Not Started  
**Priority:** CRITICAL  
**Estimated Effort:** 4-7 hours  
**Created:** 2026-01-11  
**Phase:** 3 (Editor UX Overhaul)

---

## Overview

Two critical bugs are affecting core editor functionality:

1. **White-on-White Error Tooltips** - Error messages hovering over nodes are unreadable (white text on white background)
2. **Expression/Function Nodes Not Outputting** - These nodes evaluate but don't propagate data downstream

Both bugs severely impact usability and need immediate investigation and fixes.

---

## Bugs

### Bug 1: Unreadable Error Tooltips 🎨

**Symptom:**
When hovering over nodes with errors, tooltips appear with white background and white text, making error messages invisible.

**Impact:**

- Users cannot read error messages
- Debugging becomes impossible
- Poor UX for error states

**Affected Code:**

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts` (lines 606-615)
- `packages/noodl-editor/src/editor/src/views/popuplayer.js`
- `packages/noodl-editor/src/editor/src/styles/popuplayer.css` (legacy hardcoded colors)

---

### Bug 2: Expression/Function Nodes Not Outputting ⚠️

**Symptom:**
Expression and Function nodes run/evaluate but don't send output data to connected nodes.

**Impact:**

- Core computation nodes are broken
- Projects using these nodes are non-functional
- Critical functionality regression

**Affected Code:**

- `packages/noodl-runtime/src/nodes/std-library/expression.js`
- `packages/noodl-runtime/src/nodes/std-library/simplejavascript.js`
- `packages/noodl-runtime/src/node.js` (base output flagging mechanism)

---

## Investigation Approach

### Phase 1: Reproduce & Document

- [ ] Reproduce tooltip issue (create node with error, hover, screenshot)
- [ ] Reproduce output issue (create Expression node, verify no output)
- [ ] Reproduce output issue (create Function node, verify no output)
- [ ] Check browser/console for errors
- [ ] Document exact reproduction steps

### Phase 2: Investigate Tooltip Styling

- [ ] Locate CSS source in `popuplayer.css`
- [ ] Identify hardcoded color values
- [ ] Check if theme tokens are available
- [ ] Verify tooltip rendering path (HTML structure)

### Phase 3: Debug Node Outputs

- [ ] Add debug logging to Expression node (`_scheduleEvaluateExpression`)
- [ ] Add debug logging to Function node (`scheduleRun`)
- [ ] Verify `scheduleAfterInputsHaveUpdated` callback fires
- [ ] Check if `flagOutputDirty` is called
- [ ] Test downstream node updates
- [ ] Check if context/scope is properly initialized

### Phase 4: Implement Fixes

- [ ] Fix tooltip CSS (replace hardcoded colors with theme tokens)
- [ ] Fix node output propagation (based on investigation findings)
- [ ] Test fixes thoroughly
- [ ] Update LEARNINGS.md with findings

---

## Root Cause Theories

### Tooltip Issue

**Theory:** Legacy CSS (`popuplayer.css`) uses hardcoded white/light colors incompatible with current theme system.

**Solution:** Replace with theme tokens (`var(--theme-color-*)`) per UI-STYLING-GUIDE.md.

---

### Expression/Function Node Issue

**Theory A - Output Flagging Broken:**
The `flagOutputDirty()` mechanism may be broken (possibly from React 19 migration or runtime changes).

**Theory B - Scheduling Issue:**
`scheduleAfterInputsHaveUpdated()` may have race conditions or broken callbacks.

**Theory C - Context/Scope Issue:**
Node context (`this.context.modelScope`) may not be properly initialized, causing silent failures.

**Theory D - Proxy Issue (Function Node only):**
The `outputValuesProxy` Proxy object behavior may have changed in newer Node.js versions.

**Theory E - Recent Regression:**
Changes to the base `Node` class or runtime evaluation system may have broken these nodes specifically.

---

## Success Criteria

### Tooltip Fix

- [ ] Error tooltips readable in both light and dark themes
- [ ] Text color contrasts properly with background
- [ ] All tooltip types (error, warning, info) work correctly

### Node Output Fix

- [ ] Expression nodes output correct values to connected nodes
- [ ] Function nodes output correct values to connected nodes
- [ ] Signal outputs trigger properly
- [ ] Reactive updates work as expected
- [ ] No console errors during evaluation

---

## Subtasks

- **SUBTASK-A:** Fix Error Tooltip Styling
- **SUBTASK-B:** Debug & Fix Expression/Function Node Outputs

See individual subtask files for detailed implementation plans.

---

## Related Files

**Tooltip:**

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts`
- `packages/noodl-editor/src/editor/src/views/popuplayer.js`
- `packages/noodl-editor/src/editor/src/styles/popuplayer.css`

**Nodes:**

- `packages/noodl-runtime/src/nodes/std-library/expression.js`
- `packages/noodl-runtime/src/nodes/std-library/simplejavascript.js`
- `packages/noodl-runtime/src/node.js`
- `packages/noodl-runtime/src/nodecontext.js`

---

## Notes

- These bugs are CRITICAL and block core functionality
- Investigation-heavy task - root cause unclear
- May reveal deeper runtime issues
- Document all findings in LEARNINGS.md
