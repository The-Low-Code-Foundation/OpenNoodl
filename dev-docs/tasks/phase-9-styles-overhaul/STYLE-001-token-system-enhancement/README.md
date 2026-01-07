# STYLE-001: Token System Enhancement

## Overview

Enhance Noodl's experimental style tokens into a comprehensive design token system inspired by Tailwind CSS. This task establishes the foundation that all other Phase 8 tasks build upon.

**Phase:** 8 (Styles Overhaul)  
**Priority:** CRITICAL (blocks STYLE-002, STYLE-003, STYLE-004)  
**Effort:** 12-16 hours  
**Risk:** Medium

---

## Background

### Current State

Noodl has an experimental "Style Tokens" panel that allows defining CSS custom properties. However:

- Limited token categories
- No pre-defined scales (spacing, typography, etc.)
- Requires manual setup for every project
- No visual token picker in property panels
- Tokens exist but aren't integrated into element defaults

### Target State

A complete design token system with:

- Pre-defined token categories (colors, spacing, typography, borders, shadows, animations)
- Tailwind-inspired scales with sensible defaults
- Visual token picker integrated throughout the editor
- Semantic tokens that reference base tokens
- Full CSS custom property integration

---

## Token Categories

### 1. Color Tokens

#### Semantic Colors (User-Facing)

```css
/* Primary - Main brand/action color */
--primary: #3b82f6;
--primary-hover: #2563eb;
--primary-foreground: #ffffff;

/* Secondary - Supporting actions */
--secondary: #64748b;
--secondary-hover: #475569;
--secondary-foreground: #ffffff;

/* Destructive - Dangerous actions, errors */
--destructive: #ef4444;
--destructive-hover: #dc2626;
--destructive-foreground: #ffffff;

/* Muted - Subtle backgrounds, disabled states */
--muted: #f1f5f9;
--muted-foreground: #64748b;

/* Accent - Highlights, selections */
--accent: #f1f5f9;
--accent-foreground: #0f172a;

/* Surface colors */
--background: #ffffff;
--foreground: #0f172a;
--surface: #f8fafc;
--surface-raised: #ffffff;

/* Border colors */
--border: #e2e8f0;
--border-subtle: #f1f5f9;
--border-strong: #cbd5e1;

/* Focus/Ring */
--ring: #3b82f6;
--ring-offset: #ffffff;
```

#### Palette Colors (Advanced - Optional)

```css
/* Gray scale */
--gray-50: #f8fafc;
--gray-100: #f1f5f9;
--gray-200: #e2e8f0;
--gray-300: #cbd5e1;
--gray-400: #94a3b8;
--gray-500: #64748b;
--gray-600: #475569;
--gray-700: #334155;
--gray-800: #1e293b;
--gray-900: #0f172a;
--gray-950: #020617;

/* Additional palettes: blue, red, green, yellow, purple, pink, etc. */
/* (Full Tailwind palette as optional advanced tokens) */
```

### 2. Spacing Tokens

```css
/* Numeric scale (Tailwind-style) */
--space-0: 0px;
--space-px: 1px;
--space-0.5: 2px;
--space-1: 4px;
--space-1.5: 6px;
--space-2: 8px;
--space-2.5: 10px;
--space-3: 12px;
--space-3.5: 14px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-9: 36px;
--space-10: 40px;
--space-11: 44px;
--space-12: 48px;
--space-14: 56px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
--space-28: 112px;
--space-32: 128px;

/* Semantic aliases */
--space-xs: var(--space-1); /* 4px */
--space-sm: var(--space-2); /* 8px */
--space-md: var(--space-4); /* 16px */
--space-lg: var(--space-6); /* 24px */
--space-xl: var(--space-8); /* 32px */
--space-2xl: var(--space-12); /* 48px */
--space-3xl: var(--space-16); /* 64px */
```

### 3. Typography Tokens

```css
/* Font families */
--font-sans: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
--font-serif: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
--font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;

/* Font sizes */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
--text-4xl: 36px;
--text-5xl: 48px;
--text-6xl: 60px;

/* Line heights */
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;

/* Font weights */
--font-thin: 100;
--font-extralight: 200;
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
--font-black: 900;

/* Letter spacing */
--tracking-tighter: -0.05em;
--tracking-tight: -0.025em;
--tracking-normal: 0em;
--tracking-wide: 0.025em;
--tracking-wider: 0.05em;
--tracking-widest: 0.1em;
```

### 4. Border Tokens

```css
/* Border radius */
--radius-none: 0px;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-3xl: 32px;
--radius-full: 9999px;

/* Border width */
--border-0: 0px;
--border-1: 1px;
--border-2: 2px;
--border-4: 4px;
--border-8: 8px;
```

### 5. Shadow Tokens

```css
--shadow-none: none;
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
```

### 6. Animation Tokens

```css
/* Durations */
--duration-75: 75ms;
--duration-100: 100ms;
--duration-150: 150ms;
--duration-200: 200ms;
--duration-300: 300ms;
--duration-500: 500ms;
--duration-700: 700ms;
--duration-1000: 1000ms;

/* Timing functions */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

---

## Implementation

### Phase 1: Token Data Structure (4-6 hrs)

**Files to create/modify:**

```
packages/noodl-editor/src/editor/src/models/
├── StyleTokens/
│   ├── StyleTokensModel.ts      # Main model class
│   ├── TokenCategories.ts       # Token category definitions
│   ├── DefaultTokens.ts         # Default token values
│   ├── TokenResolver.ts         # CSS variable resolution
│   └── index.ts
```

**Tasks:**

1. Define TypeScript interfaces for token categories
2. Create default token values (as shown above)
3. Build token resolution system (semantic → base → value)
4. Integrate with ProjectModel for persistence
5. Ensure backward compatibility with existing style tokens

**Token Data Structure:**

```typescript
interface StyleToken {
  name: string; // e.g., "--primary"
  value: string; // e.g., "#3b82f6" or "var(--blue-500)"
  category: TokenCategory;
  isCustom: boolean; // User-defined vs system default
  description?: string;
}

type TokenCategory = 'color-semantic' | 'color-palette' | 'spacing' | 'typography' | 'border' | 'shadow' | 'animation';

interface StyleTokensState {
  tokens: Map<string, StyleToken>;
  customTokens: Map<string, StyleToken>;
  presetName: string | null;
}
```

### Phase 2: Token Panel Enhancement (4-5 hrs)

**Files to modify:**

```
packages/noodl-editor/src/editor/src/views/panels/StyleTokensPanel/
├── StyleTokensPanel.tsx         # Main panel (enhance existing)
├── TokenCategorySection.tsx     # Collapsible category sections
├── TokenEditor.tsx              # Individual token editor
├── TokenColorPicker.tsx         # Enhanced color picker with palette
├── TokenPreview.tsx             # Visual preview of token
└── StyleTokensPanel.module.scss
```

**Tasks:**

1. Reorganize panel into collapsible category sections
2. Add visual previews for each token type
3. Create enhanced color picker showing palette options
4. Add "Reset to Default" per token and per category
5. Add Import/Export functionality

**Panel UI Structure:**

```
┌─────────────────────────────────────────────────────────────────┐
│ STYLE TOKENS                                    [Import][Export]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ▼ SEMANTIC COLORS                               [Reset Section] │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ --primary         [■ #3b82f6] [🎨] Main brand color     │   │
│   │ --primary-hover   [■ #2563eb] [🎨] Hover state          │   │
│   │ --secondary       [■ #64748b] [🎨] Secondary actions    │   │
│   │ ...                                                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ▶ PALETTE COLORS (Advanced)                                     │
│                                                                 │
│ ▼ SPACING                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ --space-xs  [4px  ▼] ████                               │   │
│   │ --space-sm  [8px  ▼] ████████                           │   │
│   │ --space-md  [16px ▼] ████████████████                   │   │
│   │ ...                                                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ▼ TYPOGRAPHY                                                    │
│ ▼ BORDERS                                                       │
│ ▼ SHADOWS                                                       │
│ ▼ ANIMATIONS                                                    │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ + Add Custom Token                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Token Picker Component (3-4 hrs)

**Files to create:**

```
packages/noodl-core-ui/src/components/inputs/
├── TokenPicker/
│   ├── TokenPicker.tsx          # Main component
│   ├── TokenPicker.module.scss
│   ├── TokenPicker.stories.tsx
│   ├── TokenPickerDropdown.tsx  # Dropdown with categories
│   ├── TokenPreviewSwatch.tsx   # Visual preview swatch
│   └── index.ts
```

**Tasks:**

1. Create reusable TokenPicker component
2. Support all token categories with appropriate previews
3. Include "Custom Value" escape hatch option
4. Show token resolution (what the actual value is)
5. Write Storybook stories for all states

**TokenPicker Interface:**

```typescript
interface TokenPickerProps {
  category: TokenCategory | TokenCategory[]; // Filter to specific categories
  value: string; // Current value (token name or raw)
  onChange: (value: string, isToken: boolean) => void;
  allowCustom?: boolean; // Show "Custom Value" option
  placeholder?: string;
  showPreview?: boolean; // Show visual swatch
}
```

### Phase 4: CSS Variable Injection (2-3 hrs)

**Files to modify:**

```
packages/noodl-viewer-react/src/
├── viewer.jsx                   # Inject tokens into preview
├── styles/
│   └── tokens.css               # Generated token CSS

packages/noodl-editor/src/editor/src/
├── preview/
│   └── PreviewServer.ts         # Token injection for preview
```

**Tasks:**

1. Generate CSS from token model
2. Inject token CSS into preview iframe
3. Update tokens in real-time when changed
4. Include tokens in deployed projects
5. Handle dark mode variant tokens (future consideration)

---

## Technical Considerations

### Backward Compatibility

Existing projects with custom style tokens must continue to work:

```typescript
// Migration logic in ProjectModel
function migrateStyleTokens(legacyTokens: any): StyleTokensState {
  // Preserve all custom tokens
  // Map legacy names to new structure where possible
  // Add new default tokens that don't conflict
}
```

### Performance

Token resolution should be efficient:

```typescript
// Cache resolved values
class TokenResolver {
  private cache = new Map<string, string>();

  resolve(tokenName: string): string {
    if (this.cache.has(tokenName)) {
      return this.cache.get(tokenName)!;
    }
    // Resolution logic...
    this.cache.set(tokenName, resolvedValue);
    return resolvedValue;
  }

  invalidate(tokenName?: string) {
    if (tokenName) {
      this.cache.delete(tokenName);
    } else {
      this.cache.clear();
    }
  }
}
```

### CSS Variable Naming

Follow conventions that avoid conflicts:

```css
/* Noodl tokens use --noodl- prefix internally */
--noodl-primary: #3b82f6;

/* Exposed to users without prefix for cleaner usage */
--primary: var(--noodl-primary);
```

---

## Testing Strategy

### Unit Tests

- Token resolution (semantic → base → value chains)
- Token validation (valid CSS values)
- Migration logic (legacy → new format)
- Import/export (JSON round-trip)

### Integration Tests

- Token changes reflect in preview
- Tokens persist across project save/load
- Token picker shows correct categories

### Manual Testing Checklist

- [ ] Create new project, verify default tokens present
- [ ] Modify token, see preview update in real-time
- [ ] Export tokens, import into another project
- [ ] Open legacy project with custom tokens, verify preserved
- [ ] Use token picker in property panel, apply to element

---

## Success Criteria

- [ ] All default tokens defined and documented
- [ ] Token panel shows all categories with previews
- [ ] Token picker component works in property panels
- [ ] Tokens inject into preview correctly
- [ ] Tokens include in deployed projects
- [ ] Legacy projects migrate without data loss
- [ ] Import/export functionality works

---

## Dependencies

**Blocks:**

- STYLE-002 (Element Configs) - needs tokens to reference
- STYLE-003 (Presets) - needs token system to populate
- STYLE-004 (Property Panel UX) - needs token picker component

**Blocked By:**

- None (can start immediately)

---

## References

- Tailwind CSS Colors: https://tailwindcss.com/docs/customizing-colors
- Tailwind CSS Spacing: https://tailwindcss.com/docs/customizing-spacing
- CSS Custom Properties: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
- shadcn/ui CSS Variables: https://ui.shadcn.com/docs/theming

---

_Last Updated: January 2026_
