# Task: Noodl Design System Modernization

## Overview

Comprehensive overhaul of Noodl's visual design system to create a modern, clean, professional appearance. Moving from the dated 2015-era dark gray aesthetic to a contemporary design language inspired by tools like Linear, Raycast, and Figma.

**Primary Goals:**
- Clean, modern color palette (Rose + Violet with Zinc neutrals)
- Consistent token usage throughout the codebase
- Foundation for future light/dark theme switching
- Better visual hierarchy and spacing
- Improved component aesthetics

**Brand Direction:**
- Primary: Rose (`#f43f5e`) - Modern, bold, distinctive
- Secondary: Violet (`#a78bfa`) - Complementary, contemporary
- Neutrals: Zinc palette (clean grays, no brown/warm tints)

---

## Phase 1: Token Consolidation & Color Refresh

**Priority: CRITICAL**
**Effort: 1-2 hours**
**Risk: Low**

### Problem

The editor has duplicate color token files. The core-ui tokens are commented out and the editor uses its own copy:

```typescript
// packages/noodl-editor/src/editor/index.ts
//Design tokens for later
// import '../../../noodl-core-ui/src/styles/custom-properties/animations.css';
// import '../../../noodl-core-ui/src/styles/custom-properties/fonts.css';
// import '../../../noodl-core-ui/src/styles/custom-properties/colors.css';
import '../editor/src/styles/custom-properties/animations.css';
import '../editor/src/styles/custom-properties/fonts.css';
import '../editor/src/styles/custom-properties/colors.css';
```

### Tasks

#### 1.1 Consolidate to Single Source of Truth

1. Replace the contents of `packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css` with the new modern palette (see Appendix A)

2. Also update `packages/noodl-core-ui/src/styles/custom-properties/colors.css` with the same content

3. Verify the viewer frame also uses the correct colors:
   - Check `packages/noodl-editor/src/frames/viewer-frame/index.js`

#### 1.2 Verify Token Application

After replacing, verify these key tokens are working:

| Token | Expected Value | Where to Check |
|-------|---------------|----------------|
| `--theme-color-bg-1` | `#09090b` (near black) | Main app background |
| `--theme-color-bg-2` | `#18181b` | Panel backgrounds |
| `--theme-color-bg-3` | `#27272a` | Card/input backgrounds |
| `--theme-color-primary` | `#f43f5e` (rose) | CTA buttons |
| `--theme-color-secondary` | `#a78bfa` (violet) | Secondary elements |

### Testing Checklist

- [ ] App background is clean dark (not brownish)
- [ ] Primary buttons are rose colored
- [ ] Text is readable with good contrast
- [ ] Node colors on canvas still distinguishable
- [ ] Success/error/warning states still visible
- [ ] No console errors related to missing CSS variables

---

## Phase 2: Hardcoded Color Audit & Cleanup

**Priority: HIGH**
**Effort: 3-4 hours**
**Risk: Low-Medium**

### Problem

Many components have hardcoded hex colors instead of using design tokens. This breaks consistency and prevents theming.

### Tasks

#### 2.1 Find All Hardcoded Colors

Search the codebase for hardcoded hex colors in these locations:

```
packages/noodl-editor/src/editor/src/styles/
packages/noodl-editor/src/editor/src/views/
packages/noodl-core-ui/src/components/
```

Common patterns to find:
```css
/* Bad - hardcoded */
background-color: #383838;
background: #444444;
border: 1px solid #2a2a2a;
color: #b9b9b9;

/* Good - tokenized */
background-color: var(--theme-color-bg-3);
```

#### 2.2 Create Mapping Reference

Map discovered hardcoded colors to appropriate tokens:

| Hardcoded | Replace With |
|-----------|--------------|
| `#000000` | `var(--theme-color-bg-0)` |
| `#151414`, `#151515` | `var(--theme-color-bg-1)` |
| `#292828`, `#2a2a2a` | `var(--theme-color-bg-2)` |
| `#383838`, `#3c3c3c` | `var(--theme-color-bg-3)` |
| `#444444`, `#4a4a4a` | `var(--theme-color-bg-4)` |
| `#666666`, `#6a6a6a` | `var(--theme-color-fg-muted)` |
| `#999999`, `#9a9a9a` | `var(--theme-color-fg-default-shy)` |
| `#b8b8b8`, `#b9b9b9` | `var(--theme-color-fg-default)` |
| `#d4d4d4` | `var(--theme-color-fg-default-contrast)` |
| `#f5f5f5`, `#ffffff` | `var(--theme-color-fg-highlight)` |

#### 2.3 Priority Files to Fix

Start with these high-impact files:

1. **Popup Layer Styles**
   - `packages/noodl-editor/src/editor/src/styles/popuplayer.css`
   
2. **Property Editor**
   - `packages/noodl-editor/src/editor/src/styles/propertyeditor.css`
   
3. **Node Graph Editor**
   - `packages/noodl-editor/src/editor/src/views/nodegrapheditor/` (all .css/.scss files)

4. **Inspect Popup**
   - `packages/noodl-editor/src/editor/src/views/nodegrapheditor/InspectJSONView/InspectPopup.module.scss`

5. **Connection Popup**
   - `packages/noodl-editor/src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss`

### Testing Checklist

- [ ] All replaced colors render correctly
- [ ] Hover states still work
- [ ] Focus states visible
- [ ] No visual regressions in property panel
- [ ] Popups/modals look correct
- [ ] Node graph colors unaffected

---

## Phase 3: Typography & Spacing Refresh

**Priority: MEDIUM**
**Effort: 2-3 hours**
**Risk: Low**

### Problem

Current typography feels cramped and dated. Font sizes are small and spacing is inconsistent.

### Tasks

#### 3.1 Update Font Tokens

File: `packages/noodl-core-ui/src/styles/custom-properties/fonts.css`

```css
:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-code: 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace;

  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* New: Font size scale */
  --font-size-xs: 10px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-2xl: 24px;

  /* New: Line height scale */
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;

  /* New: Letter spacing */
  --letter-spacing-tight: -0.02em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.02em;
}
```

#### 3.2 Add Spacing Tokens

Create new file: `packages/noodl-core-ui/src/styles/custom-properties/spacing.css`

```css
:root {
  --spacing-0: 0;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;

  /* Component-specific spacing */
  --spacing-panel-padding: var(--spacing-4);
  --spacing-card-padding: var(--spacing-3);
  --spacing-input-padding-x: var(--spacing-2);
  --spacing-input-padding-y: var(--spacing-1);
  --spacing-button-padding-x: var(--spacing-3);
  --spacing-button-padding-y: var(--spacing-2);

  /* Border radius */
  --radius-sm: 2px;
  --radius-default: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
}
```

#### 3.3 Import New Token Files

Update imports in:
- `packages/noodl-editor/src/editor/index.ts`
- `packages/noodl-core-ui/.storybook/preview.ts`

### Testing Checklist

- [ ] Text is readable at all sizes
- [ ] Spacing feels balanced
- [ ] Components don't overflow
- [ ] Modal/dialog layouts intact

---

## Phase 4: Component Visual Updates

**Priority: MEDIUM**
**Effort: 4-6 hours**
**Risk: Medium**

### Problem

Individual components need visual refinement beyond just color tokens.

### Tasks

#### 4.1 Button Refinements

File: `packages/noodl-core-ui/src/components/inputs/PrimaryButton/PrimaryButton.module.scss`

Updates needed:
- Slightly rounded corners (`border-radius: 6px`)
- Subtle shadow on hover
- Better disabled state (not just opacity)
- Smooth transitions

```scss
.Root {
  border-radius: var(--radius-md);
  transition: all 150ms ease;
  
  &.is-variant-cta {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    
    &:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}
```

#### 4.2 Input Field Refinements

File: `packages/noodl-core-ui/src/components/inputs/TextInput/TextInput.module.scss`

Updates needed:
- Subtle border (not just background change)
- Focus ring using new token
- Better placeholder styling

```scss
.InputArea {
  border: 1px solid var(--theme-color-border-subtle);
  border-radius: var(--radius-default);
  transition: border-color 150ms ease, box-shadow 150ms ease;
  
  &.is-focused {
    border-color: var(--theme-color-focus-ring);
    box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.15);
  }
}
```

#### 4.3 Dialog/Modal Refinements

File: `packages/noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.module.scss`

Updates needed:
- Subtle border
- Refined shadow
- Better backdrop blur (if supported)

```scss
.VisibleDialog {
  border: 1px solid var(--theme-color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 10px 15px -3px rgba(0, 0, 0, 0.2),
    0 20px 25px -5px rgba(0, 0, 0, 0.15);
}

.Root.has-backdrop {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
```

#### 4.4 Panel/Section Refinements

Files:
- `packages/noodl-core-ui/src/components/sidebar/BasePanel/`
- `packages/noodl-core-ui/src/components/sidebar/Section/`

Updates needed:
- Consistent padding using spacing tokens
- Subtle dividers between sections
- Better header styling

### Testing Checklist

- [ ] Buttons look polished and modern
- [ ] Inputs have clear focus states
- [ ] Dialogs/modals feel elevated
- [ ] Panels have clear visual hierarchy
- [ ] All interactive states (hover, focus, active, disabled) work

---

## Phase 5: Migration Dialog Specific Fixes

**Priority: HIGH** (User-facing feature)
**Effort: 2-3 hours**
**Risk: Low**

### Problem

The React 19 migration dialog needs specific attention beyond global token changes.

### Tasks

#### 5.1 Identify Migration Dialog Files

Search for migration-related components:
```bash
find . -name "*.tsx" -o -name "*.jsx" | xargs grep -l -i "migrat"
```

#### 5.2 Dialog Structure Improvements

The migration wizard should have:
- Clear step indicator (not just numbered text list)
- Progress visualization
- Distinct sections with proper spacing
- Better icon usage
- Clear primary/secondary actions

#### 5.3 Suggested Component Structure

```tsx
<DialogContainer>
  <DialogHeader>
    <Title>Migrate Project to React 19</Title>
    <Subtitle>Migration Complete</Subtitle>
  </DialogHeader>
  
  <StepIndicator 
    steps={['Confirm', 'Scan', 'Report', 'Migrate', 'Complete']}
    currentStep={4}
  />
  
  <DialogBody>
    <SuccessBanner>
      <Icon name="checkmark-circle" />
      <Text>Your project has been migrated successfully</Text>
    </SuccessBanner>
    
    <StatsCard>
      <Stat value={62} label="Migrated" status="success" />
    </StatsCard>
    
    <Section title="Project Locations">
      <LocationItem icon="lock" label="Original" path="..." />
      <LocationItem icon="folder" label="Migrated" path="..." />
    </Section>
    
    <Section title="What's Next?">
      <ChecklistItem>Test your app thoroughly</ChecklistItem>
      <ChecklistItem>Archive or delete original when ready</ChecklistItem>
    </Section>
  </DialogBody>
  
  <DialogFooter>
    <PrimaryButton label="Open Migrated Project" />
  </DialogFooter>
</DialogContainer>
```

### Testing Checklist

- [ ] All wizard steps render correctly
- [ ] Progress is clear
- [ ] Success/error states are obvious
- [ ] Actions are clear
- [ ] Dialog is responsive to content length

---

## Phase 6: Light Theme Foundation

**Priority: LOW** (Future enhancement)
**Effort: 3-4 hours**
**Risk: Medium**

### Problem

Currently no infrastructure for theme switching.

### Tasks

#### 6.1 Theme Provider Setup

Create theme context and provider for React components.

#### 6.2 CSS Theme Classes

The colors.css file already includes a commented `.theme-light` block. Uncomment and refine.

#### 6.3 Theme Toggle

Add settings option to switch between light/dark.

#### 6.4 Persist Preference

Store theme preference in localStorage.

### Testing Checklist

- [ ] Theme toggle works
- [ ] All components respect theme
- [ ] No hardcoded colors breaking theme
- [ ] Preference persists across sessions

---

## Appendix A: Complete colors.css File

See the Rose + Violet palette file provided separately. Key values:

```css
/* Primary - Rose */
--theme-color-primary: #f43f5e;
--theme-color-primary-highlight: #fb7185;
--theme-color-primary-dim: #be123c;
--theme-color-on-primary: #ffffff;

/* Secondary - Violet */
--theme-color-secondary: #a78bfa;
--theme-color-secondary-dim: #7c3aed;
--theme-color-secondary-highlight: #c4b5fd;
--theme-color-on-secondary: #ffffff;

/* Backgrounds - Zinc */
--theme-color-bg-0: #000000;
--theme-color-bg-1: #09090b;
--theme-color-bg-2: #18181b;
--theme-color-bg-3: #27272a;
--theme-color-bg-4: #3f3f46;

/* Foregrounds */
--theme-color-fg-highlight: #ffffff;
--theme-color-fg-default-contrast: #f4f4f5;
--theme-color-fg-default: #d4d4d8;
--theme-color-fg-default-shy: #a1a1aa;
--theme-color-fg-muted: #71717a;
```

---

## Appendix B: File Locations Quick Reference

### Token Files
- `packages/noodl-core-ui/src/styles/custom-properties/colors.css`
- `packages/noodl-core-ui/src/styles/custom-properties/fonts.css`
- `packages/noodl-core-ui/src/styles/custom-properties/animations.css`
- `packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css` (duplicate - primary)

### Entry Points
- `packages/noodl-editor/src/editor/index.ts` (main editor)
- `packages/noodl-editor/src/frames/viewer-frame/index.js` (viewer)
- `packages/noodl-core-ui/.storybook/preview.ts` (storybook)

### Key Component Directories
- `packages/noodl-core-ui/src/components/inputs/` (buttons, inputs)
- `packages/noodl-core-ui/src/components/layout/` (dialogs, containers)
- `packages/noodl-core-ui/src/components/sidebar/` (panels, sections)
- `packages/noodl-core-ui/src/components/typography/` (text, labels)

### Legacy Style Files (need hardcoded color audit)
- `packages/noodl-editor/src/editor/src/styles/`
- `packages/noodl-editor/src/editor/src/views/`

---

## Appendix C: Full colors.css Replacement

```css
/* =============================================================================
   NOODL DESIGN SYSTEM - COLORS
   Modern refresh: Rose + Violet palette
   ============================================================================= */

/* =============================================================================
   BASE COLORS
   These are the raw palette values. DO NOT use directly in components.
   Use the THEME COLOR TOKENS below instead.
   ============================================================================= */

:root {
  /* ---------------------------------------------------------------------------
     SEMANTIC COLORS
     --------------------------------------------------------------------------- */

  /* Success - Modern Emerald */
  --base-color-success-100: #ecfdf5;
  --base-color-success-200: #a7f3d0;
  --base-color-success-300: #6ee7b7;
  --base-color-success-400: #34d399;
  --base-color-success-500: #10b981;
  --base-color-success-600: #059669;
  --base-color-success-700: #047857;
  --base-color-success-800: #065f46;
  --base-color-success-900: #064e3b;
  --base-color-success-1000: #022c22;

  /* Error - Red (distinct from primary rose) */
  --base-color-error-100: #fef2f2;
  --base-color-error-200: #fecaca;
  --base-color-error-300: #fca5a5;
  --base-color-error-400: #f87171;
  --base-color-error-500: #ef4444;
  --base-color-error-600: #dc2626;
  --base-color-error-700: #b91c1c;
  --base-color-error-800: #991b1b;
  --base-color-error-900: #7f1d1d;
  --base-color-error-1000: #450a0a;

  /* ---------------------------------------------------------------------------
     NODE TYPE COLORS
     --------------------------------------------------------------------------- */

  /* Node-Pink - For Custom/User nodes */
  --base-color-node-pink-100: #fdf2f8;
  --base-color-node-pink-200: #fbcfe8;
  --base-color-node-pink-300: #f9a8d4;
  --base-color-node-pink-400: #f472b6;
  --base-color-node-pink-500: #ec4899;
  --base-color-node-pink-600: #db2777;
  --base-color-node-pink-700: #be185d;
  --base-color-node-pink-800: #9d174d;
  --base-color-node-pink-900: #831843;
  --base-color-node-pink-1000: #500724;

  /* Node-Purple - For Component nodes */
  --base-color-node-purple-100: #faf5ff;
  --base-color-node-purple-200: #e9d5ff;
  --base-color-node-purple-300: #d8b4fe;
  --base-color-node-purple-400: #c084fc;
  --base-color-node-purple-500: #a855f7;
  --base-color-node-purple-600: #9333ea;
  --base-color-node-purple-700: #7c3aed;
  --base-color-node-purple-800: #6d28d9;
  --base-color-node-purple-900: #5b21b6;
  --base-color-node-purple-1000: #2e1065;

  /* Node-Green - For Data nodes */
  --base-color-node-green-100: #f0fdf4;
  --base-color-node-green-200: #bbf7d0;
  --base-color-node-green-300: #86efac;
  --base-color-node-green-400: #4ade80;
  --base-color-node-green-500: #22c55e;
  --base-color-node-green-600: #16a34a;
  --base-color-node-green-700: #15803d;
  --base-color-node-green-800: #166534;
  --base-color-node-green-900: #14532d;
  --base-color-node-green-1000: #052e16;

  /* Node-Gray - For Logic nodes */
  --base-color-node-grey-100: #f4f4f5;
  --base-color-node-grey-200: #e4e4e7;
  --base-color-node-grey-300: #d4d4d8;
  --base-color-node-grey-400: #a1a1aa;
  --base-color-node-grey-500: #71717a;
  --base-color-node-grey-600: #52525b;
  --base-color-node-grey-700: #3f3f46;
  --base-color-node-grey-800: #27272a;
  --base-color-node-grey-900: #18181b;
  --base-color-node-grey-1000: #09090b;

  /* Node-Blue - For Visual nodes */
  --base-color-node-blue-100: #eff6ff;
  --base-color-node-blue-200: #dbeafe;
  --base-color-node-blue-300: #bfdbfe;
  --base-color-node-blue-400: #93c5fd;
  --base-color-node-blue-500: #60a5fa;
  --base-color-node-blue-600: #3b82f6;
  --base-color-node-blue-700: #2563eb;
  --base-color-node-blue-800: #1d4ed8;
  --base-color-node-blue-900: #1e40af;
  --base-color-node-blue-1000: #172554;

  /* ---------------------------------------------------------------------------
     BRAND COLORS
     --------------------------------------------------------------------------- */

  /* Primary - Rose (Modern pink-red) */
  --base-color-rose-100: #fff1f2;
  --base-color-rose-200: #fecdd3;
  --base-color-rose-300: #fda4af;
  --base-color-rose-400: #fb7185;
  --base-color-rose-500: #f43f5e;
  --base-color-rose-600: #e11d48;
  --base-color-rose-700: #be123c;
  --base-color-rose-800: #9f1239;
  --base-color-rose-900: #881337;
  --base-color-rose-1000: #4c0519;

  /* Secondary - Violet */
  --base-color-violet-100: #f5f3ff;
  --base-color-violet-200: #ede9fe;
  --base-color-violet-300: #ddd6fe;
  --base-color-violet-400: #c4b5fd;
  --base-color-violet-500: #a78bfa;
  --base-color-violet-600: #8b5cf6;
  --base-color-violet-700: #7c3aed;
  --base-color-violet-800: #6d28d9;
  --base-color-violet-900: #5b21b6;
  --base-color-violet-1000: #2e1065;

  /* Amber - For warnings/notices */
  --base-color-amber-100: #fffbeb;
  --base-color-amber-200: #fef3c7;
  --base-color-amber-300: #fcd34d;
  --base-color-amber-400: #fbbf24;
  --base-color-amber-500: #f59e0b;
  --base-color-amber-600: #d97706;
  --base-color-amber-700: #b45309;
  --base-color-amber-800: #92400e;
  --base-color-amber-900: #78350f;
  --base-color-amber-1000: #451a03;

  /* ---------------------------------------------------------------------------
     UI NEUTRALS - Clean Zinc palette
     --------------------------------------------------------------------------- */
  --base-color-zinc-50: #fafafa;
  --base-color-zinc-100: #f4f4f5;
  --base-color-zinc-200: #e4e4e7;
  --base-color-zinc-300: #d4d4d8;
  --base-color-zinc-400: #a1a1aa;
  --base-color-zinc-500: #71717a;
  --base-color-zinc-600: #52525b;
  --base-color-zinc-700: #3f3f46;
  --base-color-zinc-800: #27272a;
  --base-color-zinc-900: #18181b;
  --base-color-zinc-950: #09090b;

  /* Transparent variants */
  --base-color-zinc-950-transparent: rgba(9, 9, 11, 0.85);
  --base-color-zinc-950-transparent-light: rgba(9, 9, 11, 0.5);
  --base-color-white-transparent: rgba(255, 255, 255, 0.08);

  /* ---------------------------------------------------------------------------
     LEGACY ALIASES - For backwards compatibility
     --------------------------------------------------------------------------- */
  
  --base-color-grey-100: var(--base-color-zinc-100);
  --base-color-grey-100-transparent: rgba(244, 244, 245, 0.13);
  --base-color-grey-200: var(--base-color-zinc-200);
  --base-color-grey-300: var(--base-color-zinc-300);
  --base-color-grey-400: var(--base-color-zinc-400);
  --base-color-grey-500: var(--base-color-zinc-500);
  --base-color-grey-600: var(--base-color-zinc-600);
  --base-color-grey-700: var(--base-color-zinc-700);
  --base-color-grey-800: var(--base-color-zinc-800);
  --base-color-grey-900: var(--base-color-zinc-900);
  --base-color-grey-1000: var(--base-color-zinc-950);
  --base-color-grey-1000-transparent: var(--base-color-zinc-950-transparent);
  --base-color-grey-1000-transparent-2: var(--base-color-zinc-950-transparent-light);

  --base-color-teal-100: var(--base-color-violet-100);
  --base-color-teal-200: var(--base-color-violet-200);
  --base-color-teal-300: var(--base-color-violet-300);
  --base-color-teal-400: var(--base-color-violet-400);
  --base-color-teal-500: var(--base-color-violet-500);
  --base-color-teal-600: var(--base-color-violet-600);
  --base-color-teal-700: var(--base-color-violet-700);
  --base-color-teal-800: var(--base-color-violet-800);
  --base-color-teal-900: var(--base-color-violet-900);
  --base-color-teal-1000: var(--base-color-violet-1000);

  --base-color-yellow-100: var(--base-color-rose-100);
  --base-color-yellow-200: var(--base-color-rose-200);
  --base-color-yellow-300: var(--base-color-rose-300);
  --base-color-yellow-400: var(--base-color-rose-400);
  --base-color-yellow-500: var(--base-color-rose-500);
  --base-color-yellow-600: var(--base-color-rose-600);
  --base-color-yellow-700: var(--base-color-rose-700);
  --base-color-yellow-800: var(--base-color-rose-800);
  --base-color-yellow-900: var(--base-color-rose-900);
  --base-color-yellow-1000: var(--base-color-rose-1000);
}


/* =============================================================================
   THEME COLOR TOKENS - USE THESE IN COMPONENTS
   ============================================================================= */

:root {
  /* Backgrounds */
  --theme-color-bg-0: #000000;
  --theme-color-bg-1: var(--base-color-zinc-950);
  --theme-color-bg-1-transparent: var(--base-color-zinc-950-transparent);
  --theme-color-bg-1-transparent-2: var(--base-color-zinc-950-transparent-light);
  --theme-color-bg-2: var(--base-color-zinc-900);
  --theme-color-bg-3: var(--base-color-zinc-800);
  --theme-color-bg-4: var(--base-color-zinc-700);
  --theme-color-bg-5: var(--base-color-zinc-600);
  --theme-color-bg-hover: var(--base-color-white-transparent);

  /* Foregrounds */
  --theme-color-fg-highlight: #ffffff;
  --theme-color-fg-default-contrast: var(--base-color-zinc-100);
  --theme-color-fg-default: var(--base-color-zinc-300);
  --theme-color-fg-default-shy: var(--base-color-zinc-400);
  --theme-color-fg-muted: var(--base-color-zinc-500);
  --theme-color-fg-transparent: var(--base-color-grey-100-transparent);

  /* Primary - Rose */
  --theme-color-primary: var(--base-color-rose-500);
  --theme-color-primary-highlight: var(--base-color-rose-400);
  --theme-color-primary-dim: var(--base-color-rose-700);
  --theme-color-on-primary: #ffffff;

  /* Secondary - Violet */
  --theme-color-secondary: var(--base-color-violet-500);
  --theme-color-secondary-dim: var(--base-color-violet-700);
  --theme-color-secondary-highlight: var(--base-color-violet-400);
  --theme-color-secondary-bright: var(--base-color-violet-300);
  --theme-color-secondary-as-fg: var(--base-color-violet-400);
  --theme-color-on-secondary: #ffffff;

  /* Node Colors */
  --theme-color-node-data-1: var(--base-color-node-green-700);
  --theme-color-node-data-2: var(--base-color-node-green-600);
  --theme-color-node-data-3: var(--base-color-node-green-500);
  --theme-color-node-data-dim: var(--base-color-node-green-900);

  --theme-color-node-visual-1: var(--base-color-node-blue-700);
  --theme-color-node-visual-2: var(--base-color-node-blue-600);
  --theme-color-node-visual-2-highlight: var(--base-color-node-blue-500);
  --theme-color-node-visual-highlight: var(--base-color-node-blue-200);
  --theme-color-node-visual-default: var(--base-color-node-blue-300);
  --theme-color-node-visual-shy: var(--base-color-node-blue-400);
  --theme-color-node-visual-dim: var(--base-color-node-blue-900);

  --theme-color-node-custom-1: var(--base-color-node-pink-700);
  --theme-color-node-custom-2: var(--base-color-node-pink-600);
  --theme-color-node-custom-dim: var(--base-color-node-pink-900);

  --theme-color-node-logic-1: var(--base-color-node-grey-700);
  --theme-color-node-logic-2: var(--base-color-node-grey-600);
  --theme-color-node-logic-dim: var(--base-color-node-grey-900);

  --theme-color-node-component-1: var(--base-color-node-purple-700);
  --theme-color-node-component-2: var(--base-color-node-purple-600);
  --theme-color-node-component-dim: var(--base-color-node-purple-900);

  /* Status Colors */
  --theme-color-success: var(--base-color-success-400);
  --theme-color-success-dim: var(--base-color-success-600);
  --theme-color-success-bg: var(--base-color-success-900);

  --theme-color-notice: var(--base-color-amber-400);
  --theme-color-notice-dim: var(--base-color-amber-600);
  --theme-color-notice-bg: var(--base-color-amber-900);

  --theme-color-danger: var(--base-color-error-400);
  --theme-color-danger-light: var(--base-color-error-300);
  --theme-color-danger-dim: var(--base-color-error-600);
  --theme-color-danger-bg: var(--base-color-error-900);

  /* Connection Colors */
  --theme-color-signal: var(--base-color-rose-400);
  --theme-color-data: var(--base-color-violet-500);

  /* Border Colors */
  --theme-color-border-default: var(--base-color-zinc-700);
  --theme-color-border-subtle: var(--base-color-zinc-800);
  --theme-color-border-strong: var(--base-color-zinc-600);

  /* Focus Ring */
  --theme-color-focus-ring: var(--base-color-rose-500);
  --theme-color-focus-ring-offset: var(--base-color-zinc-950);
}
```

---

## Success Criteria

### Visual
- [ ] App feels modern and professional
- [ ] Colors are consistent throughout
- [ ] Good contrast and readability
- [ ] Visual hierarchy is clear

### Technical
- [ ] All colors use design tokens
- [ ] No hardcoded hex colors in component styles
- [ ] Token system supports future theming
- [ ] No visual regressions

### User Experience
- [ ] Migration dialog is clear and professional
- [ ] Interactive states (hover, focus) are obvious
- [ ] Success/error feedback is clear
- [ ] Overall polish matches modern dev tools
