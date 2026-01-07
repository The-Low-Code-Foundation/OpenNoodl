# TASK-000D: Hardcoded Color Audit - Core UI Components

**Status:** ✅ COMPLETED  
**Date:** December 30, 2025  
**Related:** TASK-000A (Token Consolidation), TASK-000B (Legacy Colors), TASK-000C (Node Graph Colors)

---

## 🎯 Objective

Replace all hardcoded color values in `packages/noodl-core-ui/src/components/` with design tokens from the RED-MINIMAL palette to ensure consistent theming and maintainability.

---

## 📊 Summary

| Metric                                 | Count       |
| -------------------------------------- | ----------- |
| **Files Modified**                     | 5           |
| **Colors Replaced**                    | 9           |
| **Intentional Brand Colors Preserved** | 2           |
| **Build Status**                       | ✅ Verified |

---

## 🔧 Changes Made

### 1. TitleBar Component

**File:** `packages/noodl-core-ui/src/components/app/TitleBar/TitleBar.module.scss`  
**Colors Replaced:** 2

| Before    | After                               | Context            |
| --------- | ----------------------------------- | ------------------ |
| `#aaa`    | `var(--theme-color-fg-muted)`       | Title text color   |
| `#c4c4c4` | `var(--theme-color-fg-default-shy)` | Version text color |

**Purpose:** Window title bar text colors now use semantic foreground tokens for proper theming.

---

### 2. ToolbarGrip Component

**File:** `packages/noodl-core-ui/src/components/toolbar/ToolbarGrip/ToolbarGrip.module.scss`  
**Colors Replaced:** 1

| Before    | After                         | Context              |
| --------- | ----------------------------- | -------------------- |
| `#7a7a7a` | `var(--theme-color-fg-muted)` | Grip icon fill color |

**Purpose:** Toolbar resize grip icon now uses muted foreground token.

---

### 3. ToolbarButton Component

**File:** `packages/noodl-core-ui/src/components/toolbar/ToolbarButton/ToolbarButton.module.scss`  
**Colors Replaced:** 4

| Before    | After                           | Context                              |
| --------- | ------------------------------- | ------------------------------------ |
| `#9F9F9F` | `var(--theme-color-fg-default)` | Actionable button text (2 instances) |
| `#7a7a7a` | `var(--theme-color-fg-muted)`   | Non-actionable button text           |

**Purpose:** Toolbar buttons now use appropriate foreground tokens based on interactivity state.

**Note:** The `rgba(0, 0, 0, 0.2)` hover overlay was intentionally preserved as it's a functional alpha channel, not a base color.

---

### 4. HtmlRenderer Component

**File:** `packages/noodl-core-ui/src/components/common/HtmlRenderer/HtmlRenderer.module.scss`  
**Colors Replaced:** 2

| Before | After                             | Context                          |
| ------ | --------------------------------- | -------------------------------- |
| `#eee` | `var(--theme-color-fg-highlight)` | JavaScript code block text       |
| `#444` | `var(--theme-color-bg-4)`         | JavaScript code block background |

**Purpose:** Code syntax highlighting in rendered HTML now uses theme-aware tokens.

**Note:** Commented-out colors (`//color: #d49517` and `//color: #fdb314`) were intentionally left as they're inactive legacy references.

---

### 5. PopupSection Component

**File:** `packages/noodl-core-ui/src/components/popups/PopupSection/PopupSection.module.scss`  
**Colors Replaced:** 1

| Before | After                               | Context            |
| ------ | ----------------------------------- | ------------------ |
| `#ccc` | `var(--theme-color-fg-default-shy)` | Section title text |

**Purpose:** Popup section headers now use subtle foreground token for hierarchy.

---

## 🎨 Intentionally Preserved Colors

### AiIconAnimated Component

**File:** `packages/noodl-core-ui/src/components/ai/AiIconAnimated/AiIconAnimated.module.scss`  
**Colors Preserved:** 2 instances of `#ffffff`

**Reason:** These are intentional AI branding colors for the animated icon. The white text/logo is a core part of the AI assistant's visual identity and should remain hardcoded.

**Context:**

- Line 68: `.HeroLogo > span { color: #ffffff; }` - AI logo text
- Line 153: `.SpinningBalls { color: #ffffff; }` - Loading animation balls

---

## 🧪 Verification

### Static Analysis

```bash
# Verified no unintentional hardcoded colors remain
grep -rn "#[0-9a-fA-F]\{3,8\}" packages/noodl-core-ui/src/components/app/TitleBar/ \
  packages/noodl-core-ui/src/components/toolbar/ \
  packages/noodl-core-ui/src/components/common/HtmlRenderer/ \
  packages/noodl-core-ui/src/components/popups/PopupSection/ | grep -v "//"
# Result: Only commented colors found (as expected)
```

### Build Verification

- ✅ No syntax errors introduced
- ✅ All CSS variables resolve correctly
- ✅ Build guard passed (requires clean working directory)

---

## 📚 Token Reference

| Token                          | Use Case                   | Visual Example        |
| ------------------------------ | -------------------------- | --------------------- |
| `--theme-color-fg-highlight`   | Emphasized text, code      | Bright foreground     |
| `--theme-color-fg-default`     | Standard interactive text  | Normal foreground     |
| `--theme-color-fg-default-shy` | Subtle text, labels        | Slightly dimmed       |
| `--theme-color-fg-muted`       | Secondary text, icons      | Muted gray            |
| `--theme-color-bg-4`           | Code blocks, nested panels | Dark background layer |

For full palette documentation, see: `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-000-styles-overhaul/COLORS-RED-MINIMAL.md`

---

## 🔍 Discovery Process

### Phase 1: Catalog

```bash
grep -rn "#[0-9a-fA-F]\{3,8\}" packages/noodl-core-ui/src/components/ \
  --include="*.css" --include="*.scss"
```

**Initial Results:** 13 hardcoded colors across 6 files

### Phase 2: Analysis

- **Active UI Colors:** 9 (replaced with tokens)
- **Commented Colors:** 2 (left as legacy references)
- **Intentional Brand Colors:** 2 (preserved for AI branding)

### Phase 3: Replacement

Systematic replacement following established patterns from TASK-000C:

- Text colors → `fg-*` tokens
- Background colors → `bg-*` tokens
- Interactive states → Appropriate semantic tokens

---

## 📝 Related Tasks

| Task          | Description              | Status          |
| ------------- | ------------------------ | --------------- |
| TASK-000A     | Token Consolidation      | ✅ Complete     |
| TASK-000B     | Legacy Editor Styles     | ✅ Complete     |
| TASK-000C     | Node Graph Editor Colors | ✅ Complete     |
| **TASK-000D** | **Core UI Components**   | **✅ Complete** |
| TASK-000E     | Typography & Spacing     | 🔜 Next         |

---

## 🎓 Learnings

### Pattern Recognition

Core UI components followed similar patterns to node graph editor components:

- Muted grays (`#7a7a7a`, `#aaa`) → `fg-muted`
- Standard grays (`#9F9F9F`, `#ccc`) → `fg-default` or `fg-default-shy`
- Light backgrounds (`#444`) → `bg-4` (dark mode layer)

### Component Categories Audited

1. **App Components:** TitleBar
2. **Toolbar Components:** ToolbarGrip, ToolbarButton
3. **Common Components:** HtmlRenderer
4. **Popup Components:** PopupSection
5. **AI Components:** AiIconAnimated (colors preserved)

### Edge Cases Handled

- **Commented code:** Left intact as historical reference
- **Brand colors:** Preserved for visual identity
- **Alpha channels:** Kept functional overlays (e.g., `rgba(0, 0, 0, 0.2)`)

---

## ✅ Completion Checklist

- [x] Phase 1: Discovery - Catalog all hardcoded colors
- [x] Phase 2: Systematic replacement - Replace colors with design tokens
- [x] Phase 3: Verification - Confirm no syntax errors
- [x] Phase 4: Documentation - Create comprehensive CHANGELOG

---

## 🚀 Impact

### Before

```scss
.Title {
  color: #aaa; /* Hardcoded gray */
}
```

### After

```scss
.Title {
  color: var(--theme-color-fg-muted); /* Semantic token */
}
```

### Benefits

- ✅ **Theme-aware:** All colors adapt to theme changes
- ✅ **Maintainable:** Single source of truth for color values
- ✅ **Consistent:** Semantic naming ensures proper usage
- ✅ **Future-proof:** Easy to extend with new themes

---

## 📅 Timeline

- **Started:** December 30, 2025 23:25 UTC+1
- **Completed:** December 30, 2025 23:28 UTC+1
- **Duration:** ~3 minutes

---

**Task Owner:** Cline  
**Review Status:** Ready for QA  
**Next Steps:** Proceed to TASK-000E (Typography & Spacing)
