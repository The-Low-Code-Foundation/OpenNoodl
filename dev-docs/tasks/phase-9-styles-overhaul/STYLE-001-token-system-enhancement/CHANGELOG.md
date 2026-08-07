# STYLE-001: Token System Enhancement - Changelog

## 2026-02-18 - Phase 1 & 2 Complete

### Phase 1: Token Data Structure

#### New Files

**`packages/noodl-editor/src/editor/src/models/StyleTokensModel/`**

- **`TokenCategories.ts`** — TypeScript types for the design token system:

  - `TokenCategory` union type (13 categories: color-semantic, color-palette, spacing, typography-_, border-_, shadow, animation-\*)
  - `StyleToken`, `StyleTokenRecord`, `StyleTokensData` interfaces
  - `TOKEN_CATEGORIES` metadata map (label, description, group)
  - `TOKEN_CATEGORY_GROUPS` ordered display groups

- **`DefaultTokens.ts`** — Full Tailwind-inspired default token set:

  - ~24 semantic colors (primary, secondary, destructive, muted, accent, surface, border, ring)
  - ~90 palette colors (gray, blue, red, green, amber, purple at 10 shades each)
  - ~32 spacing tokens (0–128px numeric scale + semantic aliases xs/sm/md/lg/xl/2xl/3xl)
  - 10 font sizes, 9 font weights, 6 line heights, 6 letter spacings, 3 font families
  - 8 border radii, 5 border widths
  - 7 shadow scales
  - 8 animation durations + 5 easing functions
  - **Only overrides stored in project.json** — defaults never persisted

- **`TokenResolver.ts`** — CSS `var()` reference resolution:

  - Resolves chained references (e.g. `--space-xs` → `var(--space-1)` → `4px`)
  - LRU-style cache with targeted invalidation
  - `generateCss()` for `:root { ... }` CSS block generation
  - Max depth protection against circular references

- **`StyleTokensModel.ts`** — Main model class:

  - Extends `Model` (EventDispatcher-compatible)
  - `getTokens()`, `getTokensByCategory()`, `getTokensByGroup()`, `getTokensGrouped()`
  - `setToken()`, `addCustomToken()`, `deleteCustomToken()`, `resetAllToDefaults()` — all undo-aware
  - `generateCss()`, `exportCustomTokensJson()`, `importCustomTokensJson()`
  - Persists only custom overrides under `designTokens` metadata key
  - Auto-reloads on `ProjectModel.importComplete` / `ProjectModel.instanceHasChanged`
  - Properly uses `new UndoActionGroup(...)` for undo stack integration

- **`index.ts`** — Clean public exports

### Phase 2: Context & Panel Enhancement

#### Modified

- **`ProjectDesignTokenContext.tsx`** — Enhanced with:
  - `designTokens: StyleTokenRecord[]` — live token array, re-renders on `tokensChanged`
  - `styleTokensModel: StyleTokensModel | null` — model instance for direct interaction
  - Uses `useEventListener` hook (correct pattern, no direct `.on()`)
  - Backward compatible — existing `staticColors`, `dynamicColors`, `textStyles` unchanged

#### New

- **`DesignTokenPanel.tsx`** — Replaced basic 2-tab panel with proper structure:
  - New "Tokens" tab (primary) + legacy "Colors" tab preserved
- **`components/DesignTokensTab/`** — Tokens tab:

  - Groups all tokens by display category (Colors, Spacing, Typography, Borders, Effects, Animation)
  - Collapsible sections per group via `CollapsableSection`
  - Shows "N overrides" banner with "Reset all" when tokens are customised

- **`components/TokenCategorySection/`** — Per-group token list:
  - Color swatches for color tokens
  - Spacing bars for spacing tokens (proportional width)
  - Border radius preview boxes
  - Shadow preview boxes
  - Font size "Aa" previews
  - Override indicator (highlighted name) with reset button (↺) on hover
  - SCSS using design tokens throughout (no hardcoded values)

---

## What's Still Pending

### Phase 3: TokenPicker Component (STYLE-001)

- Reusable `<TokenPicker>` dropdown for use in property panels
- Currently `onTokenChange` prop exists but inline editing not yet wired
- Will be built as part of STYLE-002/STYLE-004 integration

### Phase 4: CSS Variable Injection (STYLE-001)

- `StyleTokensModel.generateCss()` is ready
- Need to inject into preview iframe when tokens change
- Requires investigation of preview server injection point in `noodl-viewer-react`

---

_Started: 2026-02-18_
