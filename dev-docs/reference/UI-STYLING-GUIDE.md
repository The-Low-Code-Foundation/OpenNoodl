# UI Styling Guide for Noodl Editor

> **For Cline:** Read this document before doing ANY UI/styling work in the editor.

## Why This Document Exists

The Noodl editor has accumulated styling debt from 2015-era development. Many components use hardcoded hex colors instead of the design token system. This guide ensures consistent, modern styling.

**Key Rule:** NEVER copy patterns from legacy CSS files. They're full of hardcoded colors.

---

## Part 1: Token System Architecture

### Token Files Location

```
packages/noodl-editor/src/editor/src/styles/custom-properties/
├── colors.css      ← COLOR TOKENS (this is what's imported)
├── fonts.css       ← Typography tokens
├── animations.css  ← Motion tokens
├── spacing.css     ← Spacing tokens (add if missing)
```

### Import Chain

The editor entry point (`packages/noodl-editor/src/editor/index.ts`) imports tokens from the editor's own copies, NOT from noodl-core-ui:

```typescript
// What's actually used:
import '../editor/src/styles/custom-properties/colors.css';
```

---

## Part 2: Design Token Reference

### Background Colors (Dark to Light)

| Token                | Use For             | Approximate Value |
| -------------------- | ------------------- | ----------------- |
| `--theme-color-bg-0` | Deepest black       | `#000000`         |
| `--theme-color-bg-1` | App/modal backdrops | `#09090b`         |
| `--theme-color-bg-2` | Panel backgrounds   | `#18181b`         |
| `--theme-color-bg-3` | Cards, inputs       | `#27272a`         |
| `--theme-color-bg-4` | Elevated surfaces   | `#3f3f46`         |
| `--theme-color-bg-5` | Highest elevation   | `#52525b`         |

### Foreground Colors (Muted to Bright)

| Token                               | Use For                     |
| ----------------------------------- | --------------------------- |
| `--theme-color-fg-muted`            | Disabled text, placeholders |
| `--theme-color-fg-default-shy`      | Secondary/helper text       |
| `--theme-color-fg-default`          | Normal body text            |
| `--theme-color-fg-default-contrast` | Emphasized text             |
| `--theme-color-fg-highlight`        | Maximum emphasis (white)    |

### Brand Colors

| Token                               | Use For                    | Color            |
| ----------------------------------- | -------------------------- | ---------------- |
| `--theme-color-primary`             | CTA buttons, active states | Rose             |
| `--theme-color-primary-highlight`   | Primary hover states       | Rose (lighter)   |
| `--theme-color-secondary`           | Secondary elements         | Violet           |
| `--theme-color-secondary-highlight` | Secondary hover            | Violet (lighter) |

### Status Colors

| Token                   | Use For                     |
| ----------------------- | --------------------------- |
| `--theme-color-success` | Success states              |
| `--theme-color-notice`  | Warnings                    |
| `--theme-color-danger`  | Errors, destructive actions |

### Border Colors

| Token                          | Use For            |
| ------------------------------ | ------------------ |
| `--theme-color-border-subtle`  | Light dividers     |
| `--theme-color-border-default` | Standard borders   |
| `--theme-color-border-strong`  | Emphasized borders |

---

## Part 3: Hardcoded Color Replacement Map

When you encounter hardcoded hex colors, replace them using this table:

### Backgrounds

| If You See                      | Replace With              |
| ------------------------------- | ------------------------- |
| `#000000`                       | `var(--theme-color-bg-0)` |
| `#0a0a0a`, `#09090b`            | `var(--theme-color-bg-1)` |
| `#151515`, `#171717`, `#18181b` | `var(--theme-color-bg-2)` |
| `#1d1f20`, `#202020`            | `var(--theme-color-bg-2)` |
| `#272727`, `#27272a`, `#2a2a2a` | `var(--theme-color-bg-3)` |
| `#2f3335`, `#303030`            | `var(--theme-color-bg-3)` |
| `#333333`, `#383838`, `#3c3c3c` | `var(--theme-color-bg-4)` |
| `#444444`, `#4a4a4a`            | `var(--theme-color-bg-5)` |
| `#555555`                       | `var(--theme-color-bg-5)` |

### Text/Foregrounds

| If You See                   | Replace With                             |
| ---------------------------- | ---------------------------------------- |
| `#666666`, `#6a6a6a`         | `var(--theme-color-fg-muted)`            |
| `#888888`                    | `var(--theme-color-fg-muted)`            |
| `#999999`, `#9a9a9a`         | `var(--theme-color-fg-default-shy)`      |
| `#aaaaaa`, `#aaa`            | `var(--theme-color-fg-default-shy)`      |
| `#b8b8b8`, `#b9b9b9`         | `var(--theme-color-fg-default)`          |
| `#c4c4c4`, `#cccccc`, `#ccc` | `var(--theme-color-fg-default-contrast)` |
| `#d4d4d4`, `#ddd`, `#dddddd` | `var(--theme-color-fg-default-contrast)` |
| `#f5f5f5`, `#ffffff`, `#fff` | `var(--theme-color-fg-highlight)`        |

### Legacy Brand Colors

| If You See                           | Replace With                 |
| ------------------------------------ | ---------------------------- |
| `#d49517`, `#fdb314` (orange/yellow) | `var(--theme-color-primary)` |
| `#f67465`, `#f89387` (salmon/coral)  | `var(--theme-color-danger)`  |

---

## Part 4: Spacing System

Use consistent spacing based on 4px/8px grid:

```scss
4px   // --spacing-1  (tight)
8px   // --spacing-2  (small)
12px  // --spacing-3  (medium-small)
16px  // --spacing-4  (default)
20px  // --spacing-5  (medium)
24px  // --spacing-6  (large)
32px  // --spacing-8  (extra-large)
40px  // --spacing-10
48px  // --spacing-12
```

---

## Part 5: Typography Scale

```scss
/* Titles */
24px, weight 600, --theme-color-fg-highlight     // Dialog titles
18px, weight 600, --theme-color-fg-highlight     // Section titles
16px, weight 600, --theme-color-fg-default-contrast // Subsection headers

/* Body */
14px, weight 400, --theme-color-fg-default       // Normal text
14px, weight 400, --theme-color-fg-default-shy   // Secondary text

/* Small */
12px, weight 400, --theme-color-fg-muted         // Captions, hints
```

---

## Part 6: Component Patterns

### Use CSS Modules

```
ComponentName.tsx
ComponentName.module.scss  ← Use this pattern
```

### Standard Component Structure

```scss
// ComponentName.module.scss

.Root {
  display: flex;
  flex-direction: column;
  background-color: var(--theme-color-bg-2);
  border: 1px solid var(--theme-color-border-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.Header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--theme-color-border-subtle);
}

.Title {
  font-size: 18px;
  font-weight: 600;
  color: var(--theme-color-fg-highlight);
  margin: 0;
}

.Content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.Footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--theme-color-border-subtle);
}
```

### Button Patterns

```scss
// Primary Button
.PrimaryButton {
  background-color: var(--theme-color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background-color: var(--theme-color-primary-highlight);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Secondary Button
.SecondaryButton {
  background-color: var(--theme-color-bg-3);
  color: var(--theme-color-fg-default);
  border: 1px solid var(--theme-color-border-default);
  border-radius: 6px;
  padding: 10px 20px;

  &:hover {
    background-color: var(--theme-color-bg-4);
    color: var(--theme-color-fg-highlight);
  }
}
```

---

## Part 7: Legacy Files to Fix

These files contain hardcoded colors and need cleanup:

### High Priority (Most Visible)

- `packages/noodl-editor/src/editor/src/styles/popuplayer.css`
- `packages/noodl-editor/src/editor/src/styles/propertyeditor.css`

### Medium Priority

- Files in `packages/noodl-editor/src/editor/src/views/nodegrapheditor/`
- `packages/noodl-editor/src/editor/src/views/ConnectionPopup/`

### Reference Files (Good Patterns)

- `packages/noodl-core-ui/src/components/layout/BaseDialog/`
- `packages/noodl-core-ui/src/components/inputs/PrimaryButton/`

---

## Part 8: Pre-Commit Checklist

Before completing any UI task, verify:

- [ ] No hardcoded hex colors (search for `#` followed by hex)
- [ ] All colors use `var(--theme-color-*)` tokens
- [ ] Spacing uses consistent values (multiples of 4px)
- [ ] Hover states defined for interactive elements
- [ ] Focus states visible for accessibility
- [ ] Disabled states handled
- [ ] Border radius consistent (6px buttons, 8px cards)
- [ ] No new global CSS selectors that could conflict

---

## Part 9: Selected/Active State Patterns

### Decision Matrix: Which Background to Use?

When styling selected or active items, choose based on the **level of emphasis** needed:

| Context              | Background Token        | Text Color                              | Use Case                                       |
| -------------------- | ----------------------- | --------------------------------------- | ---------------------------------------------- |
| **Subtle highlight** | `--theme-color-bg-4`    | `--theme-color-fg-highlight`            | Breadcrumb current page, sidebar selected item |
| **Medium highlight** | `--theme-color-bg-5`    | `--theme-color-fg-highlight`            | Hovered list items, tabs                       |
| **Bold accent**      | `--theme-color-primary` | `var(--theme-color-on-primary)` (white) | Dropdown selected item, focused input          |

### Common Pattern: Dropdown/Menu Selected Items

```scss
.MenuItem {
  padding: 8px 12px;
  cursor: pointer;

  // Default state
  color: var(--theme-color-fg-default);
  background-color: transparent;

  // Hover state (if not selected)
  &:hover:not(.is-selected) {
    background-color: var(--theme-color-bg-3);
    color: var(--theme-color-fg-highlight);
  }

  // Selected state - BOLD accent for visibility
  &.is-selected {
    background-color: var(--theme-color-primary);
    color: var(--theme-color-on-primary);

    // Icons and child elements also need white
    svg path {
      fill: var(--theme-color-on-primary);
    }
  }

  // Disabled state
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

### Common Pattern: Navigation/Breadcrumb Current Item

```scss
.BreadcrumbItem {
  padding: 6px 12px;
  border-radius: 4px;
  color: var(--theme-color-fg-default);

  // Current/active page - SUBTLE highlight
  &.is-current {
    background-color: var(--theme-color-bg-4);
    color: var(--theme-color-fg-highlight);
  }
}
```

### ⚠️ CRITICAL: Never Use These for Backgrounds

**DO NOT use these tokens for selected/active backgrounds:**

```scss
/* ❌ WRONG - These are now WHITE after token consolidation */
background-color: var(--theme-color-secondary);
background-color: var(--theme-color-secondary-highlight);
background-color: var(--theme-color-fg-highlight);

/* ❌ WRONG - Poor contrast on dark backgrounds */
background-color: var(--theme-color-bg-1); /* Too dark */
background-color: var(--theme-color-bg-2); /* Too dark */
```

### Visual Hierarchy Example

```scss
// List with multiple states
.ListItem {
  // Normal
  background: transparent;
  color: var(--theme-color-fg-default);

  // Hover (not selected)
  &:hover:not(.is-selected) {
    background: var(--theme-color-bg-3); // Subtle lift
  }

  // Selected
  &.is-selected {
    background: var(--theme-color-primary); // Bold, can't miss it
    color: white;
  }

  // Selected AND hovered
  &.is-selected:hover {
    background: var(--theme-color-primary-highlight); // Slightly lighter red
  }
}
```

### Accessibility Checklist for Selected States

- [ ] Selected item is **immediately visible** (high contrast)
- [ ] Color is not the **only** indicator (use icons/checkmarks too)
- [ ] Keyboard focus state is **distinct** from selection
- [ ] Text contrast meets **WCAG AA** (4.5:1 minimum)

### Real-World Examples

✅ **Good patterns** (fixed December 2025):

- `MenuDialog.module.scss` - Uses `--theme-color-primary` for selected dropdown items
- `NodeGraphComponentTrail.module.scss` - Uses `--theme-color-bg-4` for current breadcrumb
- `search-panel.module.scss` - Uses `--theme-color-bg-4` for active search result

❌ **Anti-patterns** (to avoid):

- Using `--theme-color-secondary` as background (it's white now!)
- No visual distinction between selected and unselected items
- Low contrast text on selected backgrounds

---

## Quick Grep Commands

```bash
# Find hardcoded colors in a file
grep -E '#[0-9a-fA-F]{3,6}' path/to/file.css

# Find all hardcoded colors in editor styles
grep -rE '#[0-9a-fA-F]{3,6}' packages/noodl-editor/src/editor/src/styles/

# Find usage of a specific token
grep -r "theme-color-primary" packages/

# Find potential white-on-white issues
grep -r "theme-color-secondary" packages/ --include="*.scss" --include="*.css"
```

---

_Last Updated: December 2025_
