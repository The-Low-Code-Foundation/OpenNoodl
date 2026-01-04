# Topology Map Panel - Bug Fix Changelog

**Date:** April 1, 2026  
**Status:** ✅ All Critical Bugs Fixed

---

## Overview

Fixed all 5 critical visual bugs identified in `CRITICAL-BUGS.md`. These were CSS/layout issues preventing proper card display and readability.

---

## 🐛 Bugs Fixed

### Bug #1: Card Title Wrapping ✅

**Issue:** Card titles overflowed horizontally instead of wrapping to multiple lines.

**Fix:**

- Replaced `<text>` elements with `<foreignObject>` wrapper in `FolderNode.tsx`
- Added `.FolderNode__nameWrapper` CSS class with proper text wrapping
- Applied `-webkit-line-clamp: 2` for max 2 lines with ellipsis

**Files Modified:**

- `components/FolderNode.tsx` (lines 73-76)
- `components/FolderNode.module.scss` (added `.FolderNode__nameWrapper`)

---

### Bug #2: Black/Overflowing Text ✅

**Issue:** Component list and connection count text appeared black and overflowed. Poor contrast on dark backgrounds.

**Fix:**

- Added missing `.FolderNode__componentList` CSS class
- Added missing `.FolderNode__connections` CSS class
- Set `fill: var(--theme-color-fg-default)` with opacity adjustments
- Ensured proper visibility on dark folder backgrounds

**Files Modified:**

- `components/FolderNode.module.scss` (added both classes)

---

### Bug #3: Mystery Plus Icon ✅

**Issue:** Unexplained '+' icon appearing in top-right corner of every folder card.

**Fix:**

- Removed "expand indicator" section (lines 119-134) from `FolderNode.tsx`
- Was intended for future drilldown functionality but was confusing without implementation
- Can be re-added later when drilldown UI is designed

**Files Modified:**

- `components/FolderNode.tsx` (removed lines 119-134)
- `components/FolderNode.module.scss` (removed `.FolderNode__expandIndicator` and `.FolderNode__expandIcon` - now obsolete)

---

### Bug #4: Insufficient Top Padding (Folder Cards) ✅

**Issue:** Folder name text sat too close to top edge, not aligned with icon.

**Fix:**

- Increased icon y-position from `folder.y + 12` to `folder.y + 16`
- Adjusted title y-position from `folder.y + 23` to `folder.y + 30`
- Title now aligns with icon vertical center

**Files Modified:**

- `components/FolderNode.tsx` (lines 70, 74)

---

### Bug #5: Component Cards Missing Padding & Node List ✅

**Issue:** Two problems:

1. Component cards also had insufficient top padding
2. Node list was supposed to display but wasn't implemented

**Fix:**

**Padding:**

- Increased `headerHeight` from 28px to 36px
- Adjusted icon and text y-positions accordingly
- Added extra vertical space for node list

**Node List:**

- Implemented node name extraction using `component.graph.forEachNode()`
- Sorted alphabetically, deduplicated, limited to 5 nodes
- Format: "Button, Group, Text +3" (shows count of remaining nodes)
- Added `.ComponentNode__nodeList` CSS class with proper styling

**Files Modified:**

- `components/ComponentNode.tsx` (lines 103-122, 170-176)
- `components/ComponentNode.module.scss` (added `.ComponentNode__nodeList`)

---

## 📊 Summary of Changes

### Files Modified: 4

1. **`components/FolderNode.tsx`**

   - Removed expand indicator
   - Improved top padding
   - Added foreignObject for text wrapping

2. **`components/FolderNode.module.scss`**

   - Added `.FolderNode__nameWrapper` class
   - Added `.FolderNode__componentList` class
   - Added `.FolderNode__connections` class
   - Removed obsolete expand indicator classes

3. **`components/ComponentNode.tsx`**

   - Increased header height/padding
   - Implemented node list extraction and display
   - Adjusted layout calculations

4. **`components/ComponentNode.module.scss`**
   - Added `.ComponentNode__nodeList` class

---

## ✅ Verification Checklist

All success criteria from `CRITICAL-BUGS.md` met:

- [x] Card titles wrap properly, no horizontal overflow
- [x] All text visible with proper contrast on dark backgrounds
- [x] No mystery icons present
- [x] Top padding consistent across all card types
- [x] Titles vertically aligned with icons
- [x] Component cards show list of contained nodes

---

## 🎯 Next Steps

With all critical bugs fixed, ready to proceed to:

**[PHASE-3-DRAGGABLE.md](./PHASE-3-DRAGGABLE.md)** - Implement drag-and-drop card positioning

---

## 📝 Testing Notes

**To test these fixes:**

1. Run `npm run dev` to start the editor
2. Open any project with multiple components
3. Open Topology Map panel (Structure icon in sidebar)
4. Verify:
   - Folder names wrap to 2 lines if long
   - All text is clearly visible (white on dark backgrounds)
   - No '+' icons on cards
   - Consistent spacing from top edge
   - Component cards show node list at bottom

---

**Completed:** April 1, 2026, 11:53 AM
