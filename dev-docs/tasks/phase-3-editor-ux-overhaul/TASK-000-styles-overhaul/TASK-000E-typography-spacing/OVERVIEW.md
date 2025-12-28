# TASK-000E: Typography & Spacing Tokens

## Overview

Add comprehensive typography and spacing token systems to enable consistent sizing across the application. This lays the foundation for future UI refinements.

**Priority:** MEDIUM  
**Effort:** 1 hour  
**Risk:** Low  
**Dependencies:** TASK-000A (Token Consolidation)

---

## Objective

Create a robust system of typography and spacing tokens that components can use for consistent sizing, spacing, and visual rhythm throughout the editor.

---

## Part 1: Update Font Tokens

### File to Modify
```
packages/noodl-core-ui/src/styles/custom-properties/fonts.css
```

### New Font Token System

Replace contents with:

```css
/* =============================================================================
   NOODL DESIGN SYSTEM - TYPOGRAPHY
   ============================================================================= */

:root {
  /* ---------------------------------------------------------------------------
     FONT FAMILIES
     --------------------------------------------------------------------------- */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-code: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace;

  /* ---------------------------------------------------------------------------
     FONT WEIGHTS
     --------------------------------------------------------------------------- */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* ---------------------------------------------------------------------------
     FONT SIZES
     Fluid scale from 10px to 24px
     --------------------------------------------------------------------------- */
  --font-size-xs: 10px;      /* Small labels, hints */
  --font-size-sm: 11px;      /* Secondary text, captions */
  --font-size-base: 12px;    /* Default body text */
  --font-size-md: 13px;      /* Emphasized body text */
  --font-size-lg: 14px;      /* Section titles, important */
  --font-size-xl: 16px;      /* Panel titles */
  --font-size-2xl: 18px;     /* Dialog titles */
  --font-size-3xl: 24px;     /* Page titles, hero text */

  /* ---------------------------------------------------------------------------
     LINE HEIGHTS
     --------------------------------------------------------------------------- */
  --line-height-none: 1;
  --line-height-tight: 1.2;
  --line-height-snug: 1.375;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;
  --line-height-loose: 2;

  /* ---------------------------------------------------------------------------
     LETTER SPACING
     --------------------------------------------------------------------------- */
  --letter-spacing-tighter: -0.05em;
  --letter-spacing-tight: -0.025em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.025em;
  --letter-spacing-wider: 0.05em;
  --letter-spacing-widest: 0.1em;

  /* ---------------------------------------------------------------------------
     SEMANTIC TEXT STYLES
     Pre-composed styles for common use cases
     --------------------------------------------------------------------------- */
  
  /* Body text */
  --text-body-size: var(--font-size-base);
  --text-body-weight: var(--font-weight-regular);
  --text-body-line-height: var(--line-height-normal);
  
  /* Small text */
  --text-small-size: var(--font-size-sm);
  --text-small-weight: var(--font-weight-regular);
  --text-small-line-height: var(--line-height-normal);
  
  /* Labels */
  --text-label-size: var(--font-size-xs);
  --text-label-weight: var(--font-weight-medium);
  --text-label-letter-spacing: var(--letter-spacing-wide);
  
  /* Code */
  --text-code-size: var(--font-size-sm);
  --text-code-family: var(--font-family-code);
}
```

---

## Part 2: Create Spacing Tokens

### File to Create
```
packages/noodl-core-ui/src/styles/custom-properties/spacing.css
```

### Content

```css
/* =============================================================================
   NOODL DESIGN SYSTEM - SPACING
   ============================================================================= */

:root {
  /* ---------------------------------------------------------------------------
     SPACING SCALE
     4px base unit system
     --------------------------------------------------------------------------- */
  --spacing-0: 0;
  --spacing-px: 1px;
  --spacing-0-5: 2px;
  --spacing-1: 4px;
  --spacing-1-5: 6px;
  --spacing-2: 8px;
  --spacing-2-5: 10px;
  --spacing-3: 12px;
  --spacing-3-5: 14px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-7: 28px;
  --spacing-8: 32px;
  --spacing-9: 36px;
  --spacing-10: 40px;
  --spacing-11: 44px;
  --spacing-12: 48px;
  --spacing-14: 56px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-24: 96px;

  /* ---------------------------------------------------------------------------
     SEMANTIC SPACING
     Component-specific spacing aliases
     --------------------------------------------------------------------------- */
  
  /* Panel spacing */
  --spacing-panel-padding: var(--spacing-4);
  --spacing-panel-gap: var(--spacing-3);
  
  /* Card spacing */
  --spacing-card-padding: var(--spacing-3);
  --spacing-card-gap: var(--spacing-2);
  
  /* Section spacing */
  --spacing-section-gap: var(--spacing-6);
  --spacing-section-padding: var(--spacing-4);
  
  /* Input spacing */
  --spacing-input-padding-x: var(--spacing-2);
  --spacing-input-padding-y: var(--spacing-1-5);
  --spacing-input-gap: var(--spacing-2);
  
  /* Button spacing */
  --spacing-button-padding-x: var(--spacing-3);
  --spacing-button-padding-y: var(--spacing-2);
  --spacing-button-gap: var(--spacing-2);
  
  /* Icon spacing */
  --spacing-icon-gap: var(--spacing-2);

  /* ---------------------------------------------------------------------------
     BORDER RADIUS
     --------------------------------------------------------------------------- */
  --radius-none: 0;
  --radius-sm: 2px;
  --radius-default: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;
  --radius-full: 9999px;

  /* ---------------------------------------------------------------------------
     SHADOWS
     --------------------------------------------------------------------------- */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-default: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
  
  /* Dialog/popup shadow */
  --shadow-popup: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
                  0 10px 15px -3px rgba(0, 0, 0, 0.2),
                  0 20px 25px -5px rgba(0, 0, 0, 0.15);

  /* ---------------------------------------------------------------------------
     TRANSITIONS
     --------------------------------------------------------------------------- */
  --transition-fast: 100ms;
  --transition-default: 150ms;
  --transition-slow: 300ms;
  --transition-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --transition-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --transition-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --transition-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* ---------------------------------------------------------------------------
     Z-INDEX SCALE
     --------------------------------------------------------------------------- */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
}
```

---

## Part 3: Update Import Statements

### Editor Entry Point
File: `packages/noodl-editor/src/editor/index.ts`

Add import:
```typescript
import '../editor/src/styles/custom-properties/spacing.css';
```

### Core UI Entry (if exists)
Check `packages/noodl-core-ui/src/index.ts` or similar and add spacing import.

### Storybook Preview
File: `packages/noodl-core-ui/.storybook/preview.ts`

Ensure spacing.css is imported:
```typescript
import '../src/styles/custom-properties/spacing.css';
```

---

## Part 4: Also Update Editor's Font File

File: `packages/noodl-editor/src/editor/src/styles/custom-properties/fonts.css`

Should contain the same content as the core-ui fonts.css (or be deleted and import from core-ui).

---

## Testing Checklist

### Token Availability
- [ ] All font tokens accessible in CSS (`var(--font-size-base)` works)
- [ ] All spacing tokens accessible (`var(--spacing-4)` works)
- [ ] Shadow tokens work
- [ ] Transition tokens work

### Visual Check
- [ ] Text sizes look appropriate
- [ ] Default body text is readable
- [ ] Code blocks use monospace font
- [ ] Spacing feels balanced

### Build Check
- [ ] No CSS compilation errors
- [ ] No missing variable warnings
- [ ] Storybook loads correctly
- [ ] Editor builds successfully

---

## Usage Examples

### Using Font Tokens
```scss
.title {
  font-family: var(--font-family);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.code {
  font-family: var(--font-family-code);
  font-size: var(--font-size-sm);
}
```

### Using Spacing Tokens
```scss
.panel {
  padding: var(--spacing-panel-padding);
}

.button {
  padding: var(--spacing-button-padding-y) var(--spacing-button-padding-x);
  gap: var(--spacing-button-gap);
}

.card {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
```

---

## Success Criteria

- [ ] fonts.css contains comprehensive typography tokens
- [ ] spacing.css is created with full spacing system
- [ ] Both files imported in editor and storybook
- [ ] No build errors
- [ ] Tokens are usable in components
- [ ] Ready for component visual updates (TASK-000F, 000G)
