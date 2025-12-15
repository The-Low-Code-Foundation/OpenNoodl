# TASK-000B: Hardcoded Color Audit - Legacy Styles

## Overview

Find and replace all hardcoded hex colors in the legacy styles directory. This eliminates inconsistencies and ensures all colors can be changed via design tokens.

**Priority:** HIGH  
**Effort:** 1-2 hours  
**Risk:** Low-Medium  
**Dependencies:** TASK-000A (Token Consolidation)

---

## Objective

Replace all hardcoded hex color values with CSS variable references in the legacy styles directory, ensuring centralized color control.

---

## Target Directory

```
packages/noodl-editor/src/editor/src/styles/
```

---

## Step 1: Find All Hardcoded Colors

Run this search to identify all hardcoded hex colors:

```bash
# Find all hex colors in CSS/SCSS files
grep -rn "#[0-9a-fA-F]\{3,8\}" packages/noodl-editor/src/editor/src/styles/ --include="*.css" --include="*.scss"
```

Or use VSCode search with regex:
```
#[0-9a-fA-F]{3,8}
```

---

## Step 2: Color Mapping Reference

Use this mapping to convert hardcoded colors to tokens:

### Background Colors
| Hardcoded | Token | Notes |
|-----------|-------|-------|
| `#000000`, `#000` | `var(--theme-color-bg-0)` | Pure black |
| `#0a0a0a`, `#0d0d0d`, `#111`, `#111111` | `var(--theme-color-bg-1)` | Near black |
| `#121212`, `#151515`, `#141414` | `var(--theme-color-bg-2)` | Dark panels |
| `#1a1a1a`, `#191919`, `#1c1c1c` | `var(--theme-color-bg-3)` | Elevated panels |
| `#262626`, `#252525`, `#282828` | `var(--theme-color-bg-4)` | Cards |
| `#333333`, `#303030`, `#363636` | `var(--theme-color-bg-5)` | Highest elevation |

### Text/Foreground Colors
| Hardcoded | Token | Notes |
|-----------|-------|-------|
| `#ffffff`, `#fff` | `var(--theme-color-fg-highlight)` | Bright white |
| `#e5e5e5`, `#eaeaea`, `#eeeeee` | `var(--theme-color-fg-default-contrast)` | High contrast text |
| `#d4d4d4`, `#cccccc`, `#c8c8c8` | `var(--theme-color-fg-default)` | Default text |
| `#a3a3a3`, `#aaaaaa`, `#9e9e9e` | `var(--theme-color-fg-default-shy)` | Secondary text |
| `#737373`, `#666666`, `#707070` | `var(--theme-color-fg-muted)` | Muted/disabled text |

### Border Colors
| Hardcoded | Token | Notes |
|-----------|-------|-------|
| `#262626`, `#2a2a2a` | `var(--theme-color-border-subtle)` | Subtle borders |
| `#333333`, `#363636` | `var(--theme-color-border-default)` | Default borders |
| `#444444`, `#4a4a4a` | `var(--theme-color-border-strong)` | Strong borders |

### Accent Colors
| Hardcoded | Token | Notes |
|-----------|-------|-------|
| `#d21f3c`, `#e11d48`, `#dc2626` | `var(--theme-color-primary)` | Primary red |
| Any teal/cyan colors | `var(--theme-color-secondary)` | Now white |

### Status Colors
| Hardcoded | Token | Notes |
|-----------|-------|-------|
| `#10b981`, `#22c55e` (green) | `var(--theme-color-success)` | Success |
| `#ef4444`, `#dc2626` (red) | `var(--theme-color-danger)` | Danger/Error |
| `#f59e0b`, `#fbbf24` (yellow) | `var(--theme-color-notice)` | Warning |

---

## Step 3: Priority Files to Fix

Process these files in order of importance:

### Critical (High Impact)
1. **`popuplayer.css`** - All popup/dropdown backgrounds
2. **`propertyeditor.css`** - Property panel styling
3. **`common.css`** / `base.css` - Global styles

### Important
4. **`projectsview.css`** - Dashboard/projects list
5. **`sidepanel.css`** - Side panel backgrounds
6. **`menubar.css`** - Top menu styling

### Secondary
7. All remaining `.css` and `.scss` files in the directory

---

## Step 4: Implementation Pattern

For each hardcoded color found:

```css
/* BEFORE - Hardcoded */
.popup {
  background: #1a1a1a;
  border: 1px solid #333333;
  color: #d4d4d4;
}

/* AFTER - Tokenized */
.popup {
  background: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  color: var(--theme-color-fg-default);
}
```

---

## Step 5: Handle Edge Cases

### Colors Not in Token System
If you find a color that doesn't map to any token:
1. Check if it's close enough to an existing token
2. If unique and necessary, add it to colors.css
3. Document why the new token was needed

### RGBA Colors
Convert rgba values too:
```css
/* BEFORE */
background: rgba(0, 0, 0, 0.8);

/* AFTER */
background: var(--base-color-black-transparent-80);
```

### Gradient Colors
For gradients, replace each color in the gradient:
```css
/* BEFORE */
background: linear-gradient(#1a1a1a, #121212);

/* AFTER */
background: linear-gradient(var(--theme-color-bg-3), var(--theme-color-bg-2));
```

---

## Testing Checklist

After each file is updated:

- [ ] No CSS compilation errors
- [ ] Visual appearance matches original (or is intentionally improved)
- [ ] Hover states still work
- [ ] Focus states visible
- [ ] No missing backgrounds (transparent where should be solid)
- [ ] Text contrast is acceptable

### Full Test After All Changes
- [ ] Open/close all popup types
- [ ] Property editor functions correctly
- [ ] Menus display correctly
- [ ] No visual regressions in editor

---

## Verification Command

After completing, run this to ensure no hardcoded colors remain:

```bash
# Should return minimal results (only node-specific colors are acceptable)
grep -rn "#[0-9a-fA-F]\{6\}" packages/noodl-editor/src/editor/src/styles/ --include="*.css" --include="*.scss" | grep -v "node-" | wc -l
```

**Target: 0 hardcoded UI colors remaining**

---

## Success Criteria

- [ ] All UI colors in `packages/noodl-editor/src/editor/src/styles/` use CSS variables
- [ ] No visual regressions
- [ ] Grep search returns no hardcoded hex colors (except node-specific)
- [ ] Ready for component-level audit (TASK-000C, 000D)
