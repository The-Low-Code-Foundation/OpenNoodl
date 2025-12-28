# TASK: Legacy CSS Token Migration

## Overview

Replace hardcoded hex colors with design tokens across legacy CSS files. This is mechanical find-and-replace work that dramatically improves maintainability.

**Estimated Sessions:** 3-4  
**Risk:** Low (no logic changes, just color values)  
**Confidence Check:** After each file, visually verify the editor still renders correctly

---

## Session 1: Foundation Check

### 1.1 Verify Token File Is Current

Check that `packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css` contains the modern token definitions.

Look for these tokens (if missing, update the file first):

```css
--theme-color-bg-0
--theme-color-bg-1
--theme-color-bg-2
--theme-color-bg-3
--theme-color-bg-4
--theme-color-bg-5
--theme-color-fg-muted
--theme-color-fg-default-shy
--theme-color-fg-default
--theme-color-fg-default-contrast
--theme-color-fg-highlight
--theme-color-primary
--theme-color-primary-highlight
--theme-color-border-subtle
--theme-color-border-default
```

### 1.2 Create Spacing Tokens (If Missing)

Create `packages/noodl-editor/src/editor/src/styles/custom-properties/spacing.css`:

```css
:root {
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
}
```

Add import to `packages/noodl-editor/src/editor/index.ts`:

```typescript
import '../editor/src/styles/custom-properties/spacing.css';
```

### 1.3 Verification

- [ ] Build editor: `npm run build` (or equivalent)
- [ ] Launch editor, confirm no visual regressions
- [ ] Tokens are available in DevTools

---

## Session 2: Clean popuplayer.css

**File:** `packages/noodl-editor/src/editor/src/styles/popuplayer.css`

### Replacement Map

Apply these replacements throughout the file:

```
#000000, black      → var(--theme-color-bg-0)
#171717             → var(--theme-color-bg-1)
#272727, #27272a    → var(--theme-color-bg-3)
#333333             → var(--theme-color-bg-4)
#555555             → var(--theme-color-bg-5)
#999999, #9a9a9a    → var(--theme-color-fg-default-shy)
#aaaaaa, #aaa       → var(--theme-color-fg-default-shy)
#cccccc, #ccc       → var(--theme-color-fg-default-contrast)
#dddddd, #ddd       → var(--theme-color-fg-default-contrast)
#d49517             → var(--theme-color-primary)
#fdb314             → var(--theme-color-primary-highlight)
#f67465             → var(--theme-color-danger)
#f89387             → var(--theme-color-danger-light) or primary-highlight
```

### Specific Sections to Update

1. `.popup-layer-blocker` - background color
2. `.popup-layer-activity-progress` - background colors
3. `.popup-title` - text color
4. `.popup-message` - text color
5. `.popup-button` - background, text colors, hover states
6. `.popup-button-grey` - background, text colors, hover states
7. `.confirm-modal` - all color references
8. `.confirm-button`, `.cancel-button` - backgrounds, text, hover

### Verification

- [ ] Open any popup/dialog in editor
- [ ] Check confirm dialogs
- [ ] Verify hover states work
- [ ] No console errors

---

## Session 3: Clean propertyeditor.css

**File:** `packages/noodl-editor/src/editor/src/styles/propertyeditor.css`

### Approach

1. Run: `grep -E '#[0-9a-fA-F]{3,6}' propertyeditor.css`
2. For each match, use the replacement map
3. Test property panel after changes

### Key Areas

- Input backgrounds
- Label colors
- Border colors
- Focus states
- Selection colors

### Verification

- [ ] Select a node in editor
- [ ] Property panel renders correctly
- [ ] Input fields have correct backgrounds
- [ ] Focus states visible
- [ ] Hover states work

---

## Session 4: Clean Additional Files

### Files to Process

Check these for hardcoded colors and fix:

1. `packages/noodl-editor/src/editor/src/views/nodegrapheditor/*.css`
2. `packages/noodl-editor/src/editor/src/views/ConnectionPopup/*.scss`
3. Any `.css` or `.scss` file that shows hardcoded colors

### Discovery Command

```bash
# Find all files with hardcoded colors
grep -rlE '#[0-9a-fA-F]{3,6}' packages/noodl-editor/src/editor/src/styles/
grep -rlE '#[0-9a-fA-F]{3,6}' packages/noodl-editor/src/editor/src/views/
```

### Process Each File

1. List hardcoded colors: `grep -E '#[0-9a-fA-F]{3,6}' filename`
2. Replace using the mapping
3. Test affected UI area

---

## Color Replacement Reference

### Backgrounds

| Hardcoded                       | Token                     |
| ------------------------------- | ------------------------- |
| `#000000`, `black`              | `var(--theme-color-bg-0)` |
| `#09090b`, `#0a0a0a`            | `var(--theme-color-bg-1)` |
| `#151515`, `#171717`, `#18181b` | `var(--theme-color-bg-2)` |
| `#1d1f20`, `#202020`            | `var(--theme-color-bg-2)` |
| `#272727`, `#27272a`, `#2a2a2a` | `var(--theme-color-bg-3)` |
| `#2f3335`, `#303030`            | `var(--theme-color-bg-3)` |
| `#333333`, `#383838`, `#3c3c3c` | `var(--theme-color-bg-4)` |
| `#444444`, `#4a4a4a`            | `var(--theme-color-bg-5)` |
| `#555555`                       | `var(--theme-color-bg-5)` |

### Text

| Hardcoded                             | Token                                    |
| ------------------------------------- | ---------------------------------------- |
| `#666666`, `#6a6a6a`                  | `var(--theme-color-fg-muted)`            |
| `#888888`                             | `var(--theme-color-fg-muted)`            |
| `#999999`, `#9a9a9a`                  | `var(--theme-color-fg-default-shy)`      |
| `#aaaaaa`, `#aaa`                     | `var(--theme-color-fg-default-shy)`      |
| `#b8b8b8`, `#b9b9b9`                  | `var(--theme-color-fg-default)`          |
| `#c4c4c4`, `#cccccc`, `#ccc`          | `var(--theme-color-fg-default-contrast)` |
| `#d4d4d4`, `#ddd`, `#dddddd`          | `var(--theme-color-fg-default-contrast)` |
| `#f5f5f5`, `#ffffff`, `#fff`, `white` | `var(--theme-color-fg-highlight)`        |

### Brand/Status

| Hardcoded            | Token                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `#d49517`, `#fdb314` | `var(--theme-color-primary)` / `var(--theme-color-primary-highlight)` |
| `#f67465`, `#f89387` | `var(--theme-color-danger)` / lighter variant                         |

---

## Success Criteria

After all sessions:

- [ ] `grep -rE '#[0-9a-fA-F]{3,6}' packages/noodl-editor/src/editor/src/styles/` returns minimal results (only legitimate uses like shadows)
- [ ] Editor launches without visual regressions
- [ ] All interactive states (hover, focus, disabled) still work
- [ ] Popups, dialogs, property panels render correctly
- [ ] No console errors related to CSS

---

## Notes for Cline

1. **Don't change logic** - Only replace color values
2. **Test incrementally** - After each file, verify the UI
3. **Preserve structure** - Keep selectors and properties, just change values
4. **When uncertain** - Use the closest token match; perfection isn't required
5. **Document edge cases** - If something doesn't fit the map, note it

This is grunt work but it sets up the codebase for proper theming later.
