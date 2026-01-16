# BUG-8: Node Picker Search Not Auto-Expanding Categories

**Priority:** P1 - UX regression  
**Status:** 🔴 Research needed  
**Reported:** January 16, 2026

---

## Issue

When typing in the Node Picker search box:

- ✅ Categories are correctly **filtered** to only show those containing matching nodes
- ❌ Categories stay **collapsed** and must be manually opened to see results
- **Expected:** Categories should auto-expand when search filter is active

---

## Previous Behavior (Working)

1. Open Node Picker
2. Start typing a node name (e.g., "button")
3. Categories filter to only show matching results
4. **Categories automatically expand** to show the matching nodes

---

## Current Behavior (Broken)

1. Open Node Picker
2. Start typing a node name
3. Categories filter correctly
4. **Categories stay collapsed** - user must click each category to see results

---

## Code Investigation

### Key Files

**NodeLibrary.tsx** uses these from hooks:

```typescript
const {
  cursorState,
  openAllCategories, // Function exists to expand all
  closeAllCategories, // Function exists to collapse all
  handleSearchUpdate,
  focusSearch
  // ...
} = useKeyboardCursor(renderedNodes);
```

**Category collapse is controlled by:**

```typescript
// NodeLibrary.tsx line ~105
isCollapsed={getIsCategoryCollapsed(cursorState, category.name)}
```

**Selector in NodePicker.selectors.ts:**

```typescript
export function getIsCategoryCollapsed(cursorState: ICursorState, categoryName: string) {
  const category = cursorState?.allCategories.find((category) => category.name === categoryName);
  return category ? category.isCollapsed : true; // Defaults to true (collapsed)
}
```

### Where Auto-Expand Should Happen

The `useSearchBar` hook is passed `openAllCategories`:

```typescript
// NodeLibrary.tsx line ~68
const setSearchTerm = useSearchBar(
  searchInput,
  setRenderedNodes,
  items,
  cursorState.cursorContext,
  openAllCategories, // ← This should be called when searching
  closeAllCategories,
  handleSearchUpdate
);
```

---

## Hypothesis

The `useSearchBar` hook should be calling `openAllCategories()` when the search term is non-empty, but either:

1. It's not calling it at all
2. It's calling it but the state isn't being applied to categories
3. The category `isCollapsed` state is being reset elsewhere

---

## Files to Investigate

1. `packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.hooks.ts`

   - Check `useSearchBar` implementation
   - Verify `openAllCategories` is being called

2. `packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.reducer.ts`

   - Check how `isCollapsed` state is managed
   - Verify the action for opening all categories works

3. `packages/noodl-editor/src/editor/src/views/NodePicker/tabs/NodeLibrary/NodeLibrary.tsx`
   - Verify the wiring is correct

---

## Potential Fixes

### Option A: Call openAllCategories in useSearchBar

Ensure `useSearchBar` calls `openAllCategories()` when search term becomes non-empty:

```typescript
// In useSearchBar hook
useEffect(() => {
  if (searchTerm.length > 0) {
    openAllCategories(); // Expand when searching
  } else {
    closeAllCategories(); // Collapse when search cleared
  }
}, [searchTerm, openAllCategories, closeAllCategories]);
```

### Option B: Force Expand via Selector

Modify the selector to return `false` (expanded) when there's an active search:

```typescript
export function getIsCategoryCollapsed(cursorState: ICursorState, categoryName: string) {
  // If searching, always show expanded
  if (cursorState.searchTerm && cursorState.searchTerm.length > 0) {
    return false;
  }

  const category = cursorState?.allCategories.find((category) => category.name === categoryName);
  return category ? category.isCollapsed : true;
}
```

### Option C: Check for Stale State Issue

The `openAllCategories` might be called but the state change isn't propagating because of a stale closure or missing dependency.

---

## Testing Plan

- [ ] Open Node Picker
- [ ] Start typing "button" in search
- [ ] Verify categories containing "Button" auto-expand
- [ ] Clear search
- [ ] Verify categories collapse back
- [ ] Test with keyboard navigation (arrow keys)
- [ ] Test search → collapse/expand → search again flow

---

## Success Criteria

- [ ] Categories auto-expand when search filter is active
- [ ] User can immediately see matching nodes without manual clicks
- [ ] Categories collapse when search is cleared
- [ ] Keyboard navigation still works correctly
- [ ] No performance regression with many categories

---

## Related

- NodePicker uses React state management via `useReducer`
- The `cursorState` contains category collapse states
- This is likely a regression from previous changes to NodePicker

---

_Last Updated: January 16, 2026_
