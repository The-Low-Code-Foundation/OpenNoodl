# BUG-1: Property Panel "Stuck" on Previous Node

**Priority:** P0 - Blocks basic workflow  
**Status:** 🔴 Research  
**Introduced in:** Phase 2 Task 8 (Side panel changes)

---

## Symptoms

1. Click on node A in canvas → Property panel shows node A's properties ✅
2. Click on node B in canvas → Property panel STILL shows node A's properties ❌
3. Click blank canvas area → Property panel closes ✅
4. Now click node B again → Property panel shows node B's properties ✅

**Workaround:** Must click blank canvas to "clear" before selecting a different node.

---

## User Impact

- **Severity:** Critical - Breaks basic node selection workflow
- **Frequency:** Every time you try to select a different node
- **Frustration:** Very high - requires extra clicks for every node selection

---

## Initial Analysis

### Suspected Root Cause

Looking at `nodegrapheditor.ts` line ~1150, the `selectNode()` function has this logic:

```typescript
selectNode(node: NodeGraphEditorNode) {
  if (this.readOnly) {
    this.notifyListeners('readOnlyNodeClicked', node.model);
    return;
  }

  if (!node.selected) {
    // ✅ First selection works - this branch executes
    this.clearSelection();
    this.commentLayer?.clearSelection();
    node.selected = true;
    this.selector.select([node]);
    SidebarModel.instance.switchToNode(node.model);  // ← Opens panel

    this.repaint();
  } else {
    // ❌ Second selection fails - this branch executes
    // Handles double-click for navigating into components
    // But doesn't re-open/switch the sidebar!

    if (node.model.type instanceof ComponentModel) {
      this.switchToComponent(node.model.type, { pushHistory: true });
    } else {
      // Check for component ports and navigate if found
      // OR forward double-click to sidebar
      if (this.leftButtonIsDoubleClicked) {
        SidebarModel.instance.invokeActive('doubleClick', node);
      }
    }
  }
}
```

**The Problem:** When `node.selected` is already `true`, the `else` branch handles double-click navigation but **never calls** `SidebarModel.instance.switchToNode()` for a regular single click.

### Why This Worked Before Phase 2 Task 8

Phase 2 Task 8 changed how the sidebar/property panel manages visibility and state. Previously, the panel might have stayed open between selections. Now it appears to close/hide, so clicking a node that's already "selected" doesn't re-trigger the panel opening.

---

## Investigation Tasks

- [ ] Trace `SidebarModel.instance.switchToNode()` behavior
- [ ] Check if `node.selected` state is properly cleared when panel is hidden
- [ ] Verify sidebar visibility state management after Phase 2 changes
- [ ] Check if there's a `SidebarModelEvent.activeChanged` handler that should be deselecting nodes
- [ ] Test if this happens with ALL nodes or just specific types

---

## Proposed Solutions

### Option A: Always Switch to Node (Preferred)

```typescript
selectNode(node: NodeGraphEditorNode) {
  if (this.readOnly) {
    this.notifyListeners('readOnlyNodeClicked', node.model);
    return;
  }

  if (!node.selected) {
    this.clearSelection();
    this.commentLayer?.clearSelection();
    node.selected = true;
    this.selector.select([node]);
  }

  // ✅ ALWAYS switch to node, even if already selected
  SidebarModel.instance.switchToNode(node.model);

  // Handle double-click navigation separately
  if (this.leftButtonIsDoubleClicked) {
    if (node.model.type instanceof ComponentModel) {
      this.switchToComponent(node.model.type, { pushHistory: true });
    } else {
      SidebarModel.instance.invokeActive('doubleClick', node);
    }
  }

  this.repaint();
}
```

### Option B: Clear Selected State on Panel Hide

Update the `SidebarModelEvent.activeChanged` handler to clear `node.selected` when switching away from PropertyEditor:

```typescript
SidebarModel.instance.on(
  SidebarModelEvent.activeChanged,
  (activeId) => {
    const isNodePanel = activeId === 'PropertyEditor' || activeId === 'PortEditor';
    if (isNodePanel === false) {
      // Clear node.selected so next click will trigger switchToNode
      this.selector.nodes.forEach((n) => (n.selected = false));
      this.repaint();
    }
  },
  this
);
```

---

## Files to Investigate

1. **`packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`**

   - `selectNode()` method (~line 1150)
   - `SidebarModelEvent.activeChanged` handler (~line 220)

2. **`packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.ts`**

   - `switchToNode()` method
   - `hidePanels()` method
   - State management

3. **Property Panel Files**
   - Check if panel properly reports when it's closed/hidden

---

## Testing Plan

### Manual Testing

1. Open editor with multiple nodes
2. Click node A → verify panel shows A
3. Click node B directly → verify panel shows B (NOT A)
4. Click node C → verify panel shows C
5. Click between nodes rapidly → should always show correct node
6. Test with different node types (Function, Expression, Script, Component)

### Edge Cases

- Clicking same node twice (should keep panel open with same node)
- Clicking node while another panel is active (should switch to PropertyEditor)
- Multiselect scenarios
- Read-only mode

---

## Related Code Patterns

Similar selection logic exists in:

- Comment selection
- Component selection in ComponentsPanel
- These might have the same issue

---

## Success Criteria

- [ ] Can click any node and see its properties immediately
- [ ] No need to click blank canvas as workaround
- [ ] Double-click navigation still works
- [ ] Panel stays open when clicking same node repeatedly
- [ ] No regressions in node selection behavior

---

_Last Updated: January 13, 2026_
