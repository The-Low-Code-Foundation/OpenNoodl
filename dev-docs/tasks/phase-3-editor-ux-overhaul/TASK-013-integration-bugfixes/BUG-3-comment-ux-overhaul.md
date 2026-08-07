# BUG-3: Comment System UX Overhaul

**Priority:** P1 - Significant UX annoyance  
**Status:** 🎨 Design phase  
**Introduced in:** Existing feature, but UX needs improvement

---

## Problems

### 1. Inconsistent Positioning

Function/Expression/Script nodes have comment icon on the **LEFT** side, while other nodes have it on the **RIGHT** side.

### 2. Too Easy to Click Accidentally

When clicking a node to view its properties, it's very easy to accidentally click the comment icon instead, opening the comment modal unexpectedly.

---

## Agreed UX Solution

Based on user feedback, the new design will:

1. **Remove comment button from canvas node entirely**
2. **Show small indicator icon on node ONLY when comment exists**
3. **Add comment button to property panel header**
4. **Show comment preview on hover over indicator icon**

---

## New UX Flow

### When Node Has NO Comment

**Canvas:**

- No comment indicator visible on node
- Clean, minimal appearance

**Property Panel:**

- Comment button in header bar (e.g., next to other actions)
- Clicking opens modal to add comment

### When Node HAS Comment

**Canvas:**

- Small indicator icon visible (e.g., 💬 or note icon)
- Icon positioned consistently (top-right corner)
- Icon does NOT intercept clicks (proper z-index/hit area)

**On Hover:**

- Tooltip/popover appears showing comment preview
- Preview shows first 2-3 lines of comment
- Clear visual indication it's a preview

**Property Panel:**

- Comment button shows "Edit Comment" or similar
- Clicking opens modal with existing comment

---

## Visual Design

### Canvas Node With Comment

```
┌────────────────────────┐
│ 💬                     │ ← Small indicator (top-right)
│   MyFunctionNode       │
│                        │
│  ○ input    output ○   │
└────────────────────────┘
```

### Hover Preview

```
┌────────────────────────┐
│ 💬                     │
│   MyFunctionNode  ┌────┴───────────────────────┐
│                   │ Comment Preview            │
│  ○ input    output│ This function handles...   │
└───────────────────│ the user authentication    │
                    │ [...more]                  │
                    └────────────────────────────┘
```

### Property Panel Header

```
┌────────────────────────────────┐
│ MyFunctionNode  [💬] [⋮] [×]   │ ← Comment button in header
├────────────────────────────────┤
│ Properties...                  │
│                                │
```

---

## Implementation Plan

### Phase 1: Property Panel Comment Button

1. Add comment button to property panel header
2. Wire up to existing comment modal
3. Show different text based on comment existence:
   - "Add Comment" if no comment
   - "Edit Comment" if has comment

### Phase 2: Canvas Indicator (Conditional)

1. Modify node rendering to show indicator ONLY when `node.comment` exists
2. Position indicator consistently (top-right, 6px from edge)
3. Make indicator small (10px × 10px)
4. Ensure indicator doesn't interfere with node selection clicks

### Phase 3: Hover Preview

1. Add hover detection on indicator icon
2. Show popover with comment preview
3. Style popover to look like tooltip
4. Position intelligently (avoid screen edges)

### Phase 4: Remove Old Canvas Button

1. Remove comment button from all node types
2. Clean up related CSS
3. Verify no regressions

---

## Files to Modify

### Property Panel Header

**Create new component:**

- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/PropertyPanelHeader.tsx`

Or modify existing if header component already exists.

### Node Rendering

**Update:**

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts`
  - Remove comment button rendering
  - Add conditional comment indicator
  - Fix positioning inconsistency

### Comment Indicator Component

**Create:**

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/CommentIndicator.ts`
  - Render small icon
  - Handle hover events
  - Show preview popover

---

## Detailed Specs

### Comment Indicator Icon

- **Size:** 10px × 10px
- **Position:** 6px from top-right corner of node
- **Icon:** 💬 or SVG note icon
- **Color:** `--theme-color-fg-default-shy` (subtle)
- **Color (hover):** `--theme-color-fg-highlight` (emphasized)
- **Z-index:** Should not block node selection clicks

### Comment Preview Popover

- **Max width:** 300px
- **Max height:** 150px
- **Padding:** 12px
- **Background:** `--theme-color-bg-2`
- **Border:** 1px solid `--theme-color-border-default`
- **Shadow:** `0 4px 12px rgba(0,0,0,0.15)`
- **Text:** First 200 characters of comment
- **Overflow:** Ellipsis ("...") if comment is longer
- **Positioning:** Smart (avoid screen edges, prefer top-right of indicator)

### Property Panel Comment Button

- **Position:** Header bar, near other action buttons
- **Icon:** 💬 or comment icon
- **Tooltip:** "Add Comment" or "Edit Comment"
- **Style:** Consistent with other header buttons

---

## Edge Cases

- **Long comments:** Preview shows first 200 chars with "..."
- **Multiline comments:** Preview preserves line breaks (max 3-4 lines)
- **Empty comments:** Treated as no comment (no indicator shown)
- **Node selection:** Indicator doesn't interfere with clicking node
- **Multiple nodes:** Each shows own indicator/preview independently
- **Read-only mode:** Indicator shown, but button disabled or hidden

---

## Testing Plan

### Canvas Indicator

- [ ] Indicator ONLY shows when comment exists
- [ ] Indicator positioned consistently on all node types
- [ ] Indicator doesn't interfere with node selection
- [ ] Indicator small and subtle

### Hover Preview

- [ ] Preview appears on hover over indicator
- [ ] Preview shows first ~200 chars of comment
- [ ] Preview positioned intelligently
- [ ] Preview disappears when hover ends
- [ ] Preview doesn't block other UI interactions

### Property Panel Button

- [ ] Button visible in header for all nodes
- [ ] Button opens existing comment modal
- [ ] Modal functions identically to before
- [ ] Button text changes based on comment existence

### Removed Old Button

- [ ] No comment button on canvas nodes
- [ ] No positioning inconsistencies
- [ ] No leftover CSS or dead code

---

## Success Criteria

- [ ] Comment button only in property panel (no accidental clicks)
- [ ] Canvas indicator only when comment exists
- [ ] Indicator positioned consistently across all node types
- [ ] Hover preview is helpful and doesn't obstruct workflow
- [ ] Can add/edit/remove comments same as before
- [ ] No confusion about how to access comments
- [ ] Overall cleaner, more intentional UX

---

_Last Updated: January 13, 2026_
