# SUBTASK-A: Fix Error Tooltip Styling

**Parent Task:** TASK-008  
**Status:** 🔴 Not Started  
**Priority:** HIGH  
**Estimated Effort:** 1-2 hours

---

## Problem

Error tooltips that appear when hovering over nodes with errors have white background and white text, making error messages unreadable.

---

## Root Cause

Legacy CSS file (`popuplayer.css`) uses hardcoded white/light colors that don't work with the current theme system.

---

## Files to Modify

1. `packages/noodl-editor/src/editor/src/styles/popuplayer.css`
   - Replace hardcoded colors with theme tokens
   - Follow UI-STYLING-GUIDE.md patterns

---

## Implementation Plan

### Step 1: Locate Hardcoded Colors

Search for color values in `popuplayer.css`:

- Background colors (likely `#fff`, `#ffffff`, or light grays)
- Text colors (likely `#fff`, `#ffffff`, or light grays)
- Border colors
- Arrow colors

**Classes to check:**

- `.popup-layer-tooltip`
- `.popup-layer-tooltip-content`
- `.popup-layer-tooltip-arrow`
- `.popup-layer-tooltip-arrow.top`
- `.popup-layer-tooltip-arrow.bottom`
- `.popup-layer-tooltip-arrow.left`
- `.popup-layer-tooltip-arrow.right`

---

### Step 2: Apply Theme Tokens

Replace hardcoded colors with appropriate theme tokens:

**Background:**

- Use `var(--theme-color-bg-3)` or `var(--theme-color-bg-panel-dark)` for tooltip background
- Ensures proper contrast with text in all themes

**Text:**

- Use `var(--theme-color-fg-default)` for main text
- Ensures readable text in all themes

**Border (if present):**

- Use `var(--theme-color-border-default)` or `var(--theme-color-border-subtle)`

**Arrow:**

- Match the background color of the tooltip body
- Use same theme token as background

---

### Step 3: Test in Both Themes

1. Create a node with an error (e.g., invalid connection)
2. Hover over the node to trigger error tooltip
3. Verify tooltip is readable in **light theme**
4. Switch to **dark theme**
5. Verify tooltip is readable in **dark theme**
6. Check all tooltip positions (top, bottom, left, right)

---

### Step 4: Verify All Tooltip Types

Test other tooltip uses to ensure we didn't break anything:

- Info tooltips (hover help text)
- Warning tooltips
- Connection tooltips
- Any other PopupLayer.showTooltip() uses

---

## Example Implementation

**Before (hardcoded):**

```css
.popup-layer-tooltip {
  background-color: #ffffff;
  color: #333333;
  border: 1px solid #cccccc;
}
```

**After (theme tokens):**

```css
.popup-layer-tooltip {
  background-color: var(--theme-color-bg-3);
  color: var(--theme-color-fg-default);
  border: 1px solid var(--theme-color-border-default);
}
```

---

## Success Criteria

- [ ] Error tooltips readable in light theme
- [ ] Error tooltips readable in dark theme
- [ ] Text has sufficient contrast with background
- [ ] Arrow matches tooltip background
- [ ] All tooltip positions work correctly
- [ ] Other tooltip types still work correctly
- [ ] No hardcoded colors remain in tooltip CSS

---

## Testing Checklist

- [ ] Create node with error (invalid expression, disconnected required input, etc.)
- [ ] Hover over node to show error tooltip
- [ ] Verify readability in light theme
- [ ] Switch to dark theme
- [ ] Verify readability in dark theme
- [ ] Test tooltip appearing above node (position: top)
- [ ] Test tooltip appearing below node (position: bottom)
- [ ] Test tooltip appearing left of node (position: left)
- [ ] Test tooltip appearing right of node (position: right)
- [ ] Test info tooltips (hover on port, etc.)
- [ ] No visual regressions in other popups/tooltips

---

## Related Documentation

- `dev-docs/reference/UI-STYLING-GUIDE.md` - Theme token reference
- `dev-docs/reference/COMMON-ISSUES.md` - UI styling patterns

---

## Notes

- This is a straightforward CSS fix
- Should be quick to implement and test
- May uncover other hardcoded colors in popuplayer.css
- Consider fixing all hardcoded colors in that file while we're at it
