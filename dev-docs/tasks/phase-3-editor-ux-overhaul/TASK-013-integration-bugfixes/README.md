# TASK-013: Phase 3/4 Integration Bug Fixes

**Status:** 🔴 RESEARCH PHASE  
**Priority:** P0 - Critical UX Issues  
**Created:** January 13, 2026  
**Last Updated:** January 16, 2026

---

## Overview

Critical UX bugs introduced during Phase 2 (Task 8 - ComponentsPanel changes) and Phase 3 (Task 12 - Blockly Integration) that significantly impact core editing workflows.

These bugs affect basic node selection, property panel interactions, Blockly editor stability, and comment system usability.

---

## Bugs

### 🐛 [BUG-1: Property Panel "Stuck" on Previous Node](./BUG-1-property-panel-stuck.md)

**Priority:** P0 - Blocks basic workflow  
**Status:** Research needed

When clicking different nodes, property panel shows previous node's properties until you click blank canvas.

### 🐛 [BUG-2: Blockly Node Randomly Deleted on Tab Close](./BUG-2-blockly-node-deletion.md)

**Priority:** P0 - Data loss risk  
**Status:** Research needed

Sometimes when closing Blockly editor tab, the node vanishes from canvas.

### 🎨 [BUG-2.1: Blockly UI Polish](./BUG-2.1-blockly-ui-polish.md)

**Priority:** P2 - UX improvement  
**Status:** Ready to implement

Simple UI improvements to Blockly property panel (remove redundant label, add code viewer button).

### 💬 [BUG-3: Comment System UX Overhaul](./BUG-3-comment-ux-overhaul.md)

**Priority:** P1 - Significant UX annoyance  
**Status:** Design phase

Comment button too easy to click accidentally, inconsistent positioning. Move to property panel.

### 🏷️ [BUG-4: Double-Click Label Opens Comment Modal](./BUG-4-label-double-click.md)

**Priority:** P1 - Breaks expected behavior  
**Status:** Research needed

Double-clicking node name in property panel opens comment modal instead of inline rename.

### 🪟 [BUG-5: Code Editor Modal Won't Close on Outside Click](./BUG-5-code-editor-modal-close.md)

**Priority:** P1 - Significant UX issue  
**Status:** Research needed

New JavaScriptEditor modal stays on screen when clicking outside. Should auto-save and close.

### 📂 [BUG-6: App Component Not Clickable in Component Menu](./BUG-6-app-component-click.md)

**Priority:** P0 - Blocks basic workflow  
**Status:** Ready to implement

Clicking App (or any component-folder) only toggles expand/collapse - doesn't open the component canvas.

### 🖼️ [BUG-7: Broken Editor Icons (SVG Files Not Found)](./BUG-7-broken-editor-icons.md)

**Priority:** P0 - Visual breakage  
**Status:** Ready to implement

Several icons broken (comment, arrows) due to absolute paths like `/assets/icons/...` not resolving in Electron.

### 🔍 [BUG-8: Node Picker Search Not Auto-Expanding Categories](./BUG-8-node-picker-expansion.md)

**Priority:** P1 - UX regression  
**Status:** Research needed

When searching in Node Picker, categories filter correctly but stay collapsed instead of auto-expanding.

### ↔️ [BUG-9: Properties Panel Not Responsive to Width Changes](./BUG-9-property-panel-width.md)

**Priority:** P1 - UX annoyance  
**Status:** Research needed

Left panel expands when dragged, but properties panel content stays fixed width with empty space.

---

## Implementation Phases

### Phase A: Research & Investigation

- [ ] Investigate Bug 1: Property panel state synchronization
- [ ] Investigate Bug 2: Blockly node deletion race condition
- [ ] Investigate Bug 3: Comment UX design and implementation path
- [ ] Investigate Bug 4: Label interaction event flow
- [ ] Investigate Bug 5: Code editor modal close behavior
- [ ] Investigate Bug 8: Node picker category expansion
- [ ] Investigate Bug 9: Properties panel CSS width constraints

### Phase B: Quick Wins (Current)

- [ ] Fix Bug 7: Broken editor icons (replace absolute paths)
- [ ] Fix Bug 6: App component click (add component-folder handling)
- [ ] Fix Bug 5: Code editor modal close (likely event propagation)
- [ ] Fix Bug 2.1: Blockly UI polish (straightforward)
- [ ] Fix Bug 4: Label double-click (likely related to Bug 1)

### Phase C: Core Fixes

- [ ] Fix Bug 1: Property panel selection sync
- [ ] Fix Bug 3: Implement new comment UX
- [ ] Fix Bug 8: Node picker search auto-expansion
- [ ] Fix Bug 9: Properties panel responsive width

### Phase D: Complex Debugging

- [ ] Fix Bug 2: Blockly node deletion

### Phase E: Testing & Documentation

- [ ] Comprehensive testing of all fixes
- [ ] Update LEARNINGS.md with discoveries
- [ ] Close out task

---

## Success Criteria

- [ ] Can click different nodes without canvas clear workaround
- [ ] Blockly tabs close without ever deleting nodes
- [ ] Blockly UI is polished and intuitive
- [ ] Comment system feels intentional, no accidental triggers
- [ ] Comment preview on hover is useful
- [ ] Double-click label renames inline, not opening comment modal
- [ ] Code editor modal closes on outside click with auto-save
- [ ] App component (and component-folders) clickable to open canvas
- [ ] All Node Picker icons display correctly
- [ ] Node Picker categories auto-expand when searching
- [ ] Properties panel expands responsively when sidebar widened
- [ ] All existing functionality still works
- [ ] No regressions introduced

---

## Files Modified (Expected)

**Bug 1 & 4:**

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.ts`
- Property panel files

**Bug 2:**

- `packages/noodl-editor/src/editor/src/views/CanvasTabs/CanvasTabs.tsx`
- `packages/noodl-editor/src/editor/src/contexts/CanvasTabsContext.tsx`

**Bug 2.1:**

- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/LogicBuilderWorkspaceType.ts`

**Bug 3:**

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts`
- Property panel header components
- New hover preview component

**Bug 5:**

- `packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts`

**Bug 6:**

- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`

**Bug 7:**

- `packages/noodl-editor/src/editor/src/views/NodePicker/components/NodePickerCategory/NodePickerCategory.tsx`
- `packages/noodl-editor/src/editor/src/views/NodePicker/tabs/NodeLibrary/NodeLibrary.tsx`

**Bug 8:**

- `packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.hooks.ts`
- `packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.reducer.ts`
- `packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.selectors.ts`

**Bug 9:**

- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.scss`
- `packages/noodl-core-ui/src/components/property-panel/` (various)

---

## Related Tasks

- **Phase 2 Task 8:** ComponentsPanel Menu & Sheets (introduced Bug 1, 4)
- **Phase 3 Task 12:** Blockly Integration (introduced Bug 2, 2.1)
- **LEARNINGS.md:** Will document all discoveries

---

## Notes

- All bugs are separate and should be researched independently
- Bug 2 is intermittent - need to reproduce consistently first
- Bug 3 requires UX design before implementation
- Bug 1 and 4 likely share root cause in property panel event handling
- Bug 5, 6, 7 are quick fixes - should be resolved early
- Bug 6 root cause found: `handleItemClick` doesn't handle component-folders
- Bug 7 root cause found: absolute paths `/assets/icons/...` don't resolve in Electron

---

_Last Updated: January 16, 2026_
