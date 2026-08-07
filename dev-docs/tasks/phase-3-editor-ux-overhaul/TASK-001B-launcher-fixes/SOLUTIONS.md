# Solutions: Project Creation Bugs

**Date**: January 12, 2026  
**Status**: Ready for Implementation

---

## 🎯 Priority Order

1. **CRITICAL** - BUG-002 & BUG-003 (Same fix)
2. **Medium** - BUG-001 (UI improvement)
3. **Low** - BUG-004 (CSS fix)

---

## 🔴 CRITICAL FIX: Add `allowAsExportRoot` to Router

**Fixes**: BUG-002 (App not Home) + BUG-003 ("Make Home" fails)

### File to Edit

`packages/noodl-viewer-react/src/nodes/navigation/router.tsx`

### The Fix (ONE LINE!)

```typescript
const RouterNode = {
  name: 'Router',
  displayNodeName: 'Page Router',
  allowAsExportRoot: true, // ✅ ADD THIS LINE
  category: 'Visuals',
  docs: 'https://docs.noodl.net/nodes/navigation/page-router',
  useVariants: false
  // ... rest of the definition
};
```

### Why This Works

- `ProjectModel.setRootComponent()` searches for nodes with `allowAsExportRoot: true`
- Router node currently doesn't have this property
- Adding it allows Router to be set as the root of a component
- This fixes both project creation AND "Make Home" functionality

### Testing

```bash
# 1. Apply the fix
# 2. Restart dev server: npm run dev
# 3. Create new project
# 4. Preview should show "Hello World!"
# 5. "Make Home" should work on any component
```

---

## 🟡 BUG-001: Fix Home Component Display

**Severity**: Medium (Cosmetic)

### Investigation Needed

The template correctly creates `'/#__page__/Home'` with the page prefix.

**Check**: `useComponentsPanel.ts` line where it builds tree data.

### Potential Fix

Ensure `isPage` flag is properly set:

```typescript
// In tree data building logic
const isPage = component.name.startsWith('/#__page__/');

return {
  // ...
  isPage: isPage,  // ✅ Ensure this is set
  // ...
};
```

### Alternative

Check `ComponentItem.tsx` icon logic:

```typescript
let icon = IconName.Component;
if (component.isRoot) {
  icon = IconName.Home;
} else if (component.isPage) {
  // ← Must be true for pages
  icon = IconName.PageRouter;
}
```

---

## 🟡 BUG-004: Fix Modal Styling

**Severity**: Low (Cosmetic)

### File to Edit

`packages/noodl-editor/src/editor/src/styles/propertyeditor/pages.css`

### Investigation Steps

1. Inspect the popup when it appears
2. Check CSS classes on triangle and rectangle
3. Look for positioning offsets

### Likely Fix

Adjust vertical alignment:

```css
.popup-layer-content {
  margin-top: 0 !important;
  /* or adjust to match triangle position */
}

.popup-layer-arrow {
  /* Ensure positioned correctly relative to content */
}
```

### Long-term Solution

Migrate from legacy PopupLayer to modern `PopupMenu` from `@noodl-core-ui`.

---

## ✅ Implementation Checklist

### Phase 1: Critical Fix (30 minutes)

- [ ] Add `allowAsExportRoot: true` to Router node
- [ ] Test new project creation
- [ ] Test "Make Home" functionality
- [ ] Verify preview works

### Phase 2: UI Improvements (1-2 hours)

- [ ] Debug BUG-001 (page icon not showing)
- [ ] Fix if needed
- [ ] Debug BUG-004 (modal alignment)
- [ ] Fix CSS positioning

### Phase 3: Documentation (30 minutes)

- [ ] Update LEARNINGS.md with findings
- [ ] Document `allowAsExportRoot` requirement
- [ ] Add regression test notes

---

## 📝 Regression Test Plan

After fixes, test:

1. **New Project Flow**

   - Create project from launcher
   - App should be Home automatically
   - Preview shows "Hello World!"

2. **Make Home Feature**

   - Create second component
   - Right-click → "Make Home"
   - Should work without errors

3. **Page Router**
   - App has Router as root
   - Can add pages to Router
   - Modal styling looks correct

---

## 🚀 Expected Results

| Bug | Before                    | After                     |
| --- | ------------------------- | ------------------------- |
| #1  | Home shows component icon | Home shows page icon      |
| #2  | Preview error             | Preview works immediately |
| #3  | "Make Home" does nothing  | "Make Home" works         |
| #4  | Modal misaligned          | Modal looks professional  |

---

_Ready for implementation!_
