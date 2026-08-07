# BUG-7: Broken Editor Icons (SVG Files Not Found)

**Priority:** P0 - Visual breakage  
**Status:** 🔴 Research completed - Ready to implement  
**Reported:** January 16, 2026

---

## Issue

Several editor icons are broken. The console shows errors like:

```
/assets/icons/editor/right_arrow_22.svg:1
       Failed to load resource: net::ERR_FILE_NOT_FOUND
/assets/icons/comment.svg:1
       Failed to load resource: net::ERR_FILE_NOT_FOUND
```

These icons appear as broken images in:

- Node Picker category collapse/expand arrows
- Comment action button in Node Picker
- Possibly other places throughout the editor

---

## Root Cause Found

The icons are referenced using **absolute paths** that don't resolve correctly in Electron:

### NodePickerCategory.tsx (line 85):

```typescript
<img
  className={classNames([css['Arrow'], ...])}
  src="/assets/icons/editor/right_arrow_22.svg"  // ❌ Broken
/>
```

### NodeLibrary.tsx (line 168):

```typescript
<NodePickerOtherItem
  title="Comment"
  description="Place a comment in the node graph"
  onClick={(e) => {...}}
  icon={<img src="/assets/icons/comment.svg" />}  // ❌ Broken
/>
```

In Electron, absolute paths like `/assets/...` resolve to the file system root, not the app's asset directory. This is why the resources aren't found.

---

## Solution

Replace absolute paths with:

1. **Webpack imports** (preferred for type safety)
2. **Relative paths** from the component location

### Option A: Use Icon Components (Recommended)

Use the existing `Icon` component from `@noodl-core-ui`:

```typescript
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

// Instead of:
<img src="/assets/icons/editor/right_arrow_22.svg" />

// Use:
<Icon icon={IconName.CaretRight} size={IconSize.Default} />
```

### Option B: Import SVG as Module

```typescript
// Import the SVG
import rightArrowIcon from '../../../../assets/icons/editor/right_arrow_22.svg';

// Use with img tag
<img src={rightArrowIcon} />;
```

### Option C: Use Relative Path

If the asset is in the public folder and properly configured:

```typescript
// Relative to the Electron app root
<img src="./assets/icons/editor/right_arrow_22.svg" />
```

---

## Files to Fix

### 1. NodePickerCategory.tsx

**Location:** `packages/noodl-editor/src/editor/src/views/NodePicker/components/NodePickerCategory/NodePickerCategory.tsx`

**Line 85:**

```typescript
// BEFORE:
src="/assets/icons/editor/right_arrow_22.svg"

// AFTER (Option A - preferred):
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
// Replace <img> with:
<Icon icon={IconName.CaretRight} size={IconSize.Small} />
```

### 2. NodeLibrary.tsx

**Location:** `packages/noodl-editor/src/editor/src/views/NodePicker/tabs/NodeLibrary/NodeLibrary.tsx`

**Line 168:**

```typescript
// BEFORE:
icon={<img src="/assets/icons/comment.svg" />}

// AFTER:
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
// ...
icon={<Icon icon={IconName.Comment} />}
```

---

## Investigation: Find All Broken Icon Paths

Run this to find all potentially broken icon references:

```bash
grep -rn '"/assets/icons' packages/noodl-editor/src/editor/src/
grep -rn "'/assets/icons" packages/noodl-editor/src/editor/src/
```

Expected files to check:

- NodePickerCategory.tsx
- NodeLibrary.tsx
- Any other legacy components using old icon patterns

---

## Alternative: Asset Path Configuration

If many places use this pattern, consider configuring Webpack to resolve `/assets/` to the correct directory. But individual fixes are cleaner for now.

---

## Testing Plan

- [ ] Open the Node Picker (double-click on canvas or press space)
- [ ] Verify category expand/collapse arrows are visible
- [ ] Verify Comment action icon is visible in "Other" section
- [ ] Check browser console for any remaining asset errors
- [ ] Test in both dev mode and production build

---

## Success Criteria

- [ ] No "ERR_FILE_NOT_FOUND" errors for icon assets in console
- [ ] All Node Picker icons display correctly
- [ ] Arrow icons animate correctly on expand/collapse
- [ ] Comment icon visible and recognizable

---

_Last Updated: January 16, 2026_
