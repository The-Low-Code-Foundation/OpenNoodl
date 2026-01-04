# Critical Bugs - Topology Map Panel

**Priority:** 🔴 **HIGHEST - Fix These First**  
**Status:** Pending Fixes

## Overview

These are visual bugs identified by user that must be fixed before continuing with Phase 3 (draggable cards). All bugs are CSS/layout issues in the card components.

---

## 🐛 Bug List

### 1. Card Titles Overflow Instead of Wrapping

**Issue:** Card title text overflows with horizontal scrolling instead of wrapping to multiple lines.

**Location:** Both `FolderNode.tsx` and `ComponentNode.tsx`

**Expected:** Title should wrap to 2-3 lines if needed, with ellipsis on final line

**Files to Fix:**

- `components/FolderNode.module.scss` - `.FolderNode__path` class
- `components/ComponentNode.module.scss` - `.ComponentNode__name` class

**Fix Approach:**

```scss
// Add to text elements
word-wrap: break-word;
overflow-wrap: break-word;
white-space: normal; // Override any nowrap
max-width: [card-width - padding];
```

---

### 2. Internal Card Text is Black and Overflows

**Issue:** The path text and "X in • Y out" connection counters appear black and overflow instead of wrapping. Should be white.

**Location:** `FolderNode.tsx` - The component preview names and connection count text

**Expected:**

- Text should be white (using design tokens)
- Text should wrap if needed
- Should be clearly visible on dark backgrounds

**Files to Fix:**

- `components/FolderNode.module.scss` - `.FolderNode__path` and `.FolderNode__count` classes

**Current Issue:**

```scss
.FolderNode__path {
  fill: var(--theme-color-fg-default); // May not be visible enough
}

.FolderNode__count {
  fill: var(--theme-color-fg-default-shy); // Too subtle?
}
```

**Fix Approach:**

- Ensure proper contrast on dark backgrounds
- Consider using `--theme-color-fg-highlight` for better visibility
- Add text wrapping properties

---

### 3. Mystery Plus Icon on Every Card

**Issue:** There's a '+' icon appearing in the top-right corner of every card. Purpose unknown, user questions "wtf is that for?"

**Location:** Likely in both `FolderNode.tsx` and `ComponentNode.tsx` SVG rendering

**Expected:** Remove this icon (or explain what it's for if intentional)

**Investigation Needed:**

1. Search for plus icon or expand indicator in TSX files
2. Check if related to `.FolderNode__expandIndicator` or similar classes
3. Verify it's not part of the Icon component rendering

**Files to Check:**

- `components/FolderNode.tsx`
- `components/ComponentNode.tsx`
- Look for `IconName.Plus` or similar

---

### 4. Top-Level Cards Need More Top Padding

**Issue:** The title in top-level folder cards sits too close to the top edge. Should align with the icon height.

**Location:** `FolderNode.module.scss`

**Expected:** Title should vertically align with the center of the SVG icon

**Files to Fix:**

- `components/FolderNode.module.scss`
- `components/FolderNode.tsx` - Check SVG `<text>` y positioning

**Fix Approach:**

- Add more padding-top to the card header area
- Adjust y coordinate of title text to match icon center
- Ensure consistent spacing across all folder card types

---

### 5. Drilldown Cards Missing Top Padding and Component List

**Issue:** Two problems with drilldown (component-level) cards:

1. They also need more top padding (same as bug #4)
2. They're supposed to show a list of node names but don't

**Location:** `ComponentNode.tsx`

**Expected:**

- More top padding to align title with icon
- Display list of nodes contained in the component (like the X-Ray panel shows)

**Files to Fix:**

- `components/ComponentNode.module.scss` - Add padding
- `components/ComponentNode.tsx` - Add node list rendering

**Implementation Notes:**

- Node list should be in footer area below stats
- Format: "Button, Text, Group, Number, ..." (comma-separated)
- Limit to first 5-7 nodes, then "... +X more"
- Use `component.graph.nodes` to get node list
- Sort alphabetically

---

## 📝 Fix Order

Suggest fixing in this order:

1. **Bug #3** (Mystery plus icon) - Quick investigation and removal
2. **Bug #1** (Title wrapping) - CSS fix, affects readability
3. **Bug #2** (Black/overflowing text) - CSS fix, visibility issue
4. **Bug #4** (Top padding folder cards) - CSS/positioning fix
5. **Bug #5** (Drilldown padding + node list) - CSS + feature addition

---

## 🎯 Success Criteria

All bugs fixed when:

- ✅ Card titles wrap properly, no horizontal overflow
- ✅ All text is visible with proper contrast on dark backgrounds
- ✅ No mystery icons present (or purpose is clear)
- ✅ Top padding consistent across all card types
- ✅ Titles vertically aligned with icons
- ✅ Drilldown cards show list of contained nodes

---

## 🔗 Related Files

```
components/FolderNode.tsx
components/FolderNode.module.scss
components/ComponentNode.tsx
components/ComponentNode.module.scss
```

---

**Next Step After Fixes:** Proceed to [PHASE-3-DRAGGABLE.md](./PHASE-3-DRAGGABLE.md)
