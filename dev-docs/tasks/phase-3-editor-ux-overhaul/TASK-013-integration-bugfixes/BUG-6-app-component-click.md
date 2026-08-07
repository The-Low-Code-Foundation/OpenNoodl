# BUG-6: App Component Not Clickable in Component Menu

**Priority:** P0 - Blocks basic workflow  
**Status:** 🔴 Research completed - Ready to implement  
**Reported:** January 16, 2026

---

## Issue

Can't click on the 'App' component (or any component-folder) in the left component menu to view its node canvas. The App component is being treated like a folder - clicking it only expands/collapses it but doesn't open the component's node canvas.

---

## Root Cause Found

In `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`:

```typescript
// Handle item click
const handleItemClick = useCallback(
  (node: TreeNode) => {
    if (node.type === 'component') {
      setSelectedId(node.data.name);
      // Opens the component - works correctly
      const component = node.data.component;
      if (component) {
        EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', {
          component,
          pushHistory: true
        });
      }
    } else {
      // ❌ BUG: This only toggles folder expand/collapse
      // It NEVER opens component-folders!
      setSelectedId(node.data.path);
      toggleFolder(node.data.path);
    }
  },
  [toggleFolder]
);
```

The problem: When a component has nested children (like "App" with child components), it's rendered as a **folder** in the tree with `type: 'folder'`. Even though it's marked as `isComponentFolder: true` and has a `component` reference, clicking on it only toggles the folder - it never opens the component canvas.

---

## Expected Behavior

1. Single-click on a component-folder should **open the component canvas**
2. Expand/collapse should happen via the arrow icon OR could be a secondary behavior

---

## Solution Options

### Option A: Open on Click, Toggle via Arrow (Recommended)

Modify `handleItemClick` to open component-folders:

```typescript
const handleItemClick = useCallback(
  (node: TreeNode) => {
    if (node.type === 'component') {
      // Regular component - open it
      setSelectedId(node.data.name);
      const component = node.data.component;
      if (component) {
        EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', {
          component,
          pushHistory: true
        });
      }
    } else {
      // It's a folder
      setSelectedId(node.data.path);

      // ✅ FIX: If it's a component-folder, open the component
      if (node.data.isComponentFolder && node.data.component) {
        EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', {
          component: node.data.component,
          pushHistory: true
        });
      }

      // Still toggle the folder
      toggleFolder(node.data.path);
    }
  },
  [toggleFolder]
);
```

### Option B: Separate Click Targets

- Click on folder name = opens component
- Click on arrow = toggles expand/collapse

This requires UI changes to the FolderItem component.

---

## Files to Modify

1. `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`

   - Update `handleItemClick` to handle component-folders

2. Optionally: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/components/FolderItem.tsx`
   - If we want separate click targets for open vs expand

---

## Testing Plan

- [ ] Create a project with App component that has child components
- [ ] Click on 'App' in the component menu
- [ ] Verify the App component's node canvas is displayed
- [ ] Verify the folder still expands/collapses (either on same click or via arrow)
- [ ] Test with nested component-folders (multiple levels deep)
- [ ] Ensure regular folders (non-component) still only toggle expand

---

## Related

- Component-folders are created when a component like `/App` has child components like `/App/Header`
- The tree building logic correctly identifies these with `isComponentFolder: true`
- The click handler just wasn't using this information

---

_Last Updated: January 16, 2026_
