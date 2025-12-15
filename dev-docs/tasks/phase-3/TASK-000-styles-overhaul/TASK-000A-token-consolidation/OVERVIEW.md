# TASK-000A: Token Consolidation & Color Refresh

## Overview

Replace the color token files with the new RED-MINIMAL palette. This is the foundation task - all other style tasks depend on this being completed first.

**Priority:** CRITICAL  
**Effort:** 30 minutes  
**Risk:** Low  
**Dependencies:** None

---

## Objective

Consolidate color definitions to a single source of truth using the RED-MINIMAL palette:
- **Primary**: Noodl Red (`#d21f3c`)
- **Secondary**: White (`#ffffff`)  
- **Neutrals**: Pure black/gray (no color tint)

---

## Files to Modify

### Primary Target
```
packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css
```
This is the file actually imported by the editor.

### Secondary Target
```
packages/noodl-core-ui/src/styles/custom-properties/colors.css
```
Should contain identical content for Storybook and component development.

### Verify These Entry Points
- `packages/noodl-editor/src/editor/index.ts` - Confirm which colors.css is imported
- `packages/noodl-editor/src/frames/viewer-frame/index.js` - Verify viewer uses same tokens
- `packages/noodl-core-ui/.storybook/preview.ts` - Verify Storybook imports

---

## Implementation Steps

### Step 1: Backup Current Colors
Before making changes, note what the current colors look like for visual comparison.

### Step 2: Replace Editor colors.css
Copy the contents from `dev-docs/tasks/phase-3/TASK-000-styles-overhaul/COLORS-RED-MINIMAL.md` to:
```
packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css
```

Note: The COLORS-RED-MINIMAL.md file contains CSS in markdown format. Copy the CSS content only.

### Step 3: Update Core UI colors.css
Copy the same content to:
```
packages/noodl-core-ui/src/styles/custom-properties/colors.css
```

### Step 4: Verify Imports
Confirm in `packages/noodl-editor/src/editor/index.ts`:
```typescript
// Should be using the editor's copy (not core-ui)
import '../editor/src/styles/custom-properties/colors.css';
```

### Step 5: Build & Test
```bash
npm run build:editor
npm run dev
```

---

## Key Color Mappings

| Token | Value | Usage |
|-------|-------|-------|
| `--theme-color-primary` | `#d21f3c` | Primary buttons, CTAs, focus rings |
| `--theme-color-secondary` | `#ffffff` | Secondary actions |
| `--theme-color-bg-1` | `#0a0a0a` | Main app background |
| `--theme-color-bg-2` | `#121212` | Panel backgrounds |
| `--theme-color-bg-3` | `#1a1a1a` | Card/input backgrounds |
| `--theme-color-fg-default` | `#d4d4d4` | Default text color |
| `--theme-color-fg-muted` | `#737373` | Secondary text |

---

## Testing Checklist

- [ ] App compiles without errors
- [ ] App background is pure dark (not brownish/warm)
- [ ] Primary buttons show red color (`#d21f3c`)
- [ ] Text is readable with good contrast
- [ ] Node colors on canvas still distinguishable
- [ ] Success states show green
- [ ] Error states show red
- [ ] No console errors about missing CSS variables
- [ ] Storybook still works

---

## Expected Visual Changes

After applying:
- **Backgrounds**: Will shift from warm/brownish grays to pure neutral blacks
- **Primary Color**: Yellow/teal accent → Red accent
- **Secondary Color**: Teal → White/neutral
- **Overall Feel**: Cleaner, more modern, higher contrast

---

## Rollback Plan

If something breaks, the original color file can be restored from git:
```bash
git checkout HEAD -- packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css
git checkout HEAD -- packages/noodl-core-ui/src/styles/custom-properties/colors.css
```

---

## Success Criteria

- [ ] Both color files contain identical RED-MINIMAL palette
- [ ] Editor runs without visual regressions
- [ ] All existing functionality unchanged
- [ ] Ready for hardcoded color audit (next tasks)
