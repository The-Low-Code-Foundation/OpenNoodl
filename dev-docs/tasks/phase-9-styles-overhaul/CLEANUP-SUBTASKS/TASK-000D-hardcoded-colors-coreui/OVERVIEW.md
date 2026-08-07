# TASK-000D: Hardcoded Color Audit - Core UI Components

## Overview

Find and replace all hardcoded hex colors in the shared Core UI component library. These components are used throughout the editor, so fixing them has wide impact.

**Priority:** HIGH  
**Effort:** 1-2 hours  
**Risk:** Low-Medium  
**Dependencies:** TASK-000A (Token Consolidation)

---

## Objective

Replace all hardcoded hex color values in `noodl-core-ui` components with CSS variable references, ensuring consistent theming across all shared components.

---

## Target Directory

```
packages/noodl-core-ui/src/components/
```

---

## Step 1: Find All Hardcoded Colors

```bash
# Find all hex colors in core-ui components
grep -rn "#[0-9a-fA-F]\{3,8\}" packages/noodl-core-ui/src/components/ --include="*.css" --include="*.scss"
```

List total files to fix:
```bash
grep -rl "#[0-9a-fA-F]\{3,8\}" packages/noodl-core-ui/src/components/ --include="*.css" --include="*.scss"
```

---

## Step 2: Component Categories to Audit

### Input Components (`inputs/`)
Priority files:
- `PrimaryButton/PrimaryButton.module.scss`
- `TextInput/TextInput.module.scss`
- `Select/Select.module.scss`
- `Checkbox/Checkbox.module.scss`
- `Slider/Slider.module.scss`

### Layout Components (`layout/`)
Priority files:
- `BaseDialog/BaseDialog.module.scss`
- `DialogRenderRoot/DialogRenderRoot.module.scss`
- `Container/Container.module.scss`

### Sidebar Components (`sidebar/`)
Priority files:
- `BasePanel/BasePanel.module.scss`
- `Section/Section.module.scss`
- `SidebarItem/SidebarItem.module.scss`

### Typography Components (`typography/`)
- `Text/Text.module.scss`
- `Label/Label.module.scss`
- `Title/Title.module.scss`

### Common Components (`common/`)
- `Icon/Icon.module.scss`
- `Tooltip/Tooltip.module.scss`
- Any other shared components

---

## Step 3: Color Mapping Reference

### Background Colors
| Hardcoded | Token | Usage |
|-----------|-------|-------|
| `#000000` | `var(--theme-color-bg-0)` | Darkest backgrounds |
| `#0a0a0a` | `var(--theme-color-bg-1)` | App background |
| `#121212` | `var(--theme-color-bg-2)` | Panel backgrounds |
| `#1a1a1a` | `var(--theme-color-bg-3)` | Input/card backgrounds |
| `#262626` | `var(--theme-color-bg-4)` | Elevated elements |
| `#333333` | `var(--theme-color-bg-5)` | Highest elevation |

### Foreground Colors
| Hardcoded | Token | Usage |
|-----------|-------|-------|
| `#ffffff` | `var(--theme-color-fg-highlight)` | Bright text |
| `#e5e5e5` | `var(--theme-color-fg-default-contrast)` | High contrast |
| `#d4d4d4` | `var(--theme-color-fg-default)` | Default text |
| `#a3a3a3` | `var(--theme-color-fg-default-shy)` | Secondary text |
| `#737373` | `var(--theme-color-fg-muted)` | Muted/disabled |

### Primary/Accent Colors
| Hardcoded | Token | Usage |
|-----------|-------|-------|
| Old yellow/teal | `var(--theme-color-primary)` | Now red primary |
| `#d21f3c` | `var(--theme-color-primary)` | Primary buttons |
| Any purple/violet | `var(--theme-color-secondary)` | Now white |

### Button-Specific
| State | Token |
|-------|-------|
| Default BG | `var(--theme-color-bg-4)` or `var(--theme-color-primary)` |
| Hover BG | `var(--theme-color-bg-5)` or `var(--theme-color-primary-highlight)` |
| Active BG | `var(--theme-color-bg-3)` or `var(--theme-color-primary-dim)` |
| Disabled | Use opacity or `var(--theme-color-fg-muted)` |

### Input-Specific
| Element | Token |
|---------|-------|
| Background | `var(--theme-color-bg-3)` |
| Border | `var(--theme-color-border-default)` |
| Border focused | `var(--theme-color-focus-ring)` |
| Placeholder | `var(--theme-color-fg-muted)` |

---

## Step 4: Examples

### Button Before/After
```scss
// BEFORE
.button {
  background: #363636;
  color: #ffffff;
  
  &:hover {
    background: #444444;
  }
}

// AFTER
.button {
  background: var(--theme-color-bg-5);
  color: var(--theme-color-fg-highlight);
  
  &:hover {
    background: var(--theme-color-bg-hover);
  }
}
```

### Input Before/After
```scss
// BEFORE
.input {
  background: #1a1a1a;
  border: 1px solid #333333;
  color: #d4d4d4;
  
  &::placeholder {
    color: #666666;
  }
  
  &:focus {
    border-color: #d21f3c;
  }
}

// AFTER
.input {
  background: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  color: var(--theme-color-fg-default);
  
  &::placeholder {
    color: var(--theme-color-fg-muted);
  }
  
  &:focus {
    border-color: var(--theme-color-focus-ring);
  }
}
```

---

## Step 5: Check Storybook

After updating components, verify in Storybook:

```bash
npm run storybook
```

Navigate to each updated component and check:
- Default state renders correctly
- All variants look correct
- Interactive states work (hover, focus, active, disabled)
- Dark theme shows proper contrast

---

## Testing Checklist

### Per Component Type

#### Buttons
- [ ] Primary button is red (`#d21f3c`)
- [ ] Secondary button is neutral/white
- [ ] Hover states visible
- [ ] Focus ring visible
- [ ] Disabled state clear

#### Inputs
- [ ] Input background visible
- [ ] Border visible
- [ ] Focus state shows red ring
- [ ] Placeholder text visible but muted
- [ ] Error state shows red

#### Dialogs
- [ ] Dialog background distinct from page
- [ ] Backdrop visible
- [ ] Header/body/footer sections clear
- [ ] Close button visible

#### Panels/Sidebar
- [ ] Panel backgrounds correct
- [ ] Section headers readable
- [ ] Hover states on items
- [ ] Active/selected state visible

### Global Tests
- [ ] Storybook renders without errors
- [ ] All component stories pass visual check
- [ ] No broken contrast (text unreadable)

---

## Verification Command

```bash
# Check for remaining hardcoded colors
grep -rn "#[0-9a-fA-F]\{6\}" packages/noodl-core-ui/src/components/ --include="*.css" --include="*.scss" | wc -l
```

**Target: 0 hardcoded colors**

---

## Documentation

If you need to add any new tokens to handle edge cases, document them:

1. Add token to `colors.css`
2. Update this task's notes
3. Add comment explaining the token's purpose

---

## Success Criteria

- [ ] All components in `noodl-core-ui` use CSS variables
- [ ] Storybook shows all components correctly
- [ ] No hardcoded hex colors in component styles
- [ ] Consistent appearance across all components
- [ ] Ready for visual refinements (TASK-000F, 000G)
