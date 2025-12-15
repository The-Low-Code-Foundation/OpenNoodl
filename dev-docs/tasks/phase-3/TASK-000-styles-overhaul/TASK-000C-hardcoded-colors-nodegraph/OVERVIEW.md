# TASK-000C: Hardcoded Color Audit - Node Graph Editor

## Overview

Find and replace all hardcoded hex colors in the node graph editor views directory. This is a high-visibility area where users spend most of their time.

**Priority:** HIGH  
**Effort:** 1-2 hours  
**Risk:** Low-Medium  
**Dependencies:** TASK-000A (Token Consolidation)

---

## Objective

Replace all hardcoded hex color values in the node graph editor views with CSS variable references.

---

## Target Directory

```
packages/noodl-editor/src/editor/src/views/
```

Focus especially on:
```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/
packages/noodl-editor/src/editor/src/views/ConnectionPopup/
```

---

## Step 1: Find All Hardcoded Colors

```bash
# Find all hex colors in views directory
grep -rn "#[0-9a-fA-F]\{3,8\}" packages/noodl-editor/src/editor/src/views/ --include="*.css" --include="*.scss"
```

---

## Step 2: Priority Files

### Critical Files
1. **`InspectPopup.module.scss`**
   - `packages/noodl-editor/src/editor/src/views/nodegrapheditor/InspectJSONView/InspectPopup.module.scss`
   - Used for debugging/inspecting node values

2. **`ConnectionPopup.module.scss`**
   - `packages/noodl-editor/src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss`
   - Shown when creating connections between nodes

3. **Node Graph Editor Styles**
   - Any `.css` or `.scss` files in `nodegrapheditor/` directory

### Other View Files
4. **Migration Wizard files** (if any remain hardcoded)
   - `packages/noodl-editor/src/editor/src/views/migration/`

5. **Project views**
   - `packages/noodl-editor/src/editor/src/views/projectsview.ts` (check inline styles)

---

## Step 3: Node-Specific Color Handling

**IMPORTANT**: Some colors in node graph views are intentionally distinct for different node types. These should use the node-specific tokens, not general UI tokens:

### Node Type Color Tokens
```css
/* Data nodes - Green */
var(--theme-color-node-data-1)
var(--theme-color-node-data-2)
var(--theme-color-node-data-3)

/* Visual nodes - Blue */
var(--theme-color-node-visual-1)
var(--theme-color-node-visual-2)

/* Custom nodes - Pink */
var(--theme-color-node-custom-1)
var(--theme-color-node-custom-2)

/* Logic nodes - Gray */
var(--theme-color-node-logic-1)
var(--theme-color-node-logic-2)

/* Component nodes - Purple */
var(--theme-color-node-component-1)
var(--theme-color-node-component-2)
```

### Connection Color Tokens
```css
/* Signal connections (events) */
var(--theme-color-signal)  /* Red */

/* Data connections (values) */
var(--theme-color-data)    /* Gray/neutral */
```

---

## Step 4: Color Mapping for Views

### Background Colors (same as TASK-000B)
| Hardcoded | Token |
|-----------|-------|
| `#0a0a0a`, `#111111` | `var(--theme-color-bg-1)` |
| `#121212`, `#151515` | `var(--theme-color-bg-2)` |
| `#1a1a1a`, `#191919` | `var(--theme-color-bg-3)` |
| `#262626`, `#282828` | `var(--theme-color-bg-4)` |
| `#333333`, `#363636` | `var(--theme-color-bg-5)` |

### Foreground Colors
| Hardcoded | Token |
|-----------|-------|
| `#ffffff`, `#fff` | `var(--theme-color-fg-highlight)` |
| `#d4d4d4`, `#cccccc` | `var(--theme-color-fg-default)` |
| `#a3a3a3`, `#999999` | `var(--theme-color-fg-default-shy)` |
| `#737373`, `#666666` | `var(--theme-color-fg-muted)` |

### Popup/Dialog Colors
| Hardcoded | Token |
|-----------|-------|
| Dark backgrounds | `var(--theme-color-bg-3)` |
| Borders | `var(--theme-color-border-default)` |
| Hover states | `var(--theme-color-bg-hover)` |

---

## Step 5: Check for Inline Styles in TSX/JSX

Some TypeScript/React files may have inline styles with hardcoded colors:

```bash
# Find hardcoded colors in TypeScript files
grep -rn "['\"](#[0-9a-fA-F]\{3,8\})['\"]" packages/noodl-editor/src/editor/src/views/ --include="*.tsx" --include="*.ts"
```

If found, convert to CSS class or use CSS variables:

```tsx
// BEFORE - Inline hardcoded
<div style={{ background: '#1a1a1a' }}>

// AFTER - Use CSS variable
<div style={{ background: 'var(--theme-color-bg-3)' }}>

// BEST - Use CSS class
<div className={styles.container}>
```

---

## Testing Checklist

### InspectPopup
- [ ] Opens correctly when debugging nodes
- [ ] Text is readable
- [ ] JSON syntax highlighting still works (if applicable)
- [ ] Scrollable content works

### ConnectionPopup
- [ ] Opens when dragging connections
- [ ] List items readable and clickable
- [ ] Hover states visible
- [ ] Search/filter works (if applicable)

### Node Graph Editor
- [ ] Node colors are distinguishable by type
- [ ] Connection lines render correctly
- [ ] Selection highlights visible
- [ ] Canvas background correct
- [ ] Zoom/pan doesn't break colors

### General
- [ ] No CSS errors in console
- [ ] No visual regressions
- [ ] All interactive states work

---

## Verification Command

```bash
# Check for remaining hardcoded colors in views
grep -rn "#[0-9a-fA-F]\{6\}" packages/noodl-editor/src/editor/src/views/ --include="*.css" --include="*.scss" | grep -v "node-color" | wc -l
```

**Target: 0 hardcoded UI colors (only intentional node-specific colors allowed)**

---

## Success Criteria

- [ ] All UI colors in views directory use CSS variables
- [ ] Node-specific colors use appropriate node tokens
- [ ] Connection colors use signal/data tokens
- [ ] Popups look consistent with rest of UI
- [ ] No visual regressions in node editor
