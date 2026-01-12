# BUG-001: Home Component Shown as "Component" not "Page"

**Severity**: 🟡 Medium (Cosmetic/UX Issue)  
**Status**: Identified  
**Category**: UI Display

---

## 🐛 Symptom

When creating a new project, the Components panel shows:

- ✅ **App** - displayed as regular component
- ❌ **Home** - displayed as regular component (should show as "page")

**Expected**: Home should have a page icon (router icon) indicating it's a page component.

**Actual**: Home shows with standard component icon.

---

## 🔍 Root Cause

The component name **IS correct** in the template (`'/#__page__/Home'`), but the UI display logic may not be recognizing it properly.

### Template Structure (CORRECT)

```typescript
// packages/noodl-editor/src/editor/src/models/template/templates/hello-world.template.ts

components: [
  {
    name: 'App' // ✅ Regular component
    // ...
  },
  {
    name: '/#__page__/Home' // ✅ CORRECT - Has page prefix!
    // ...
  }
];
```

The `/#__page__/` prefix is the standard Noodl convention for marking page components.

---

## 💡 Analysis

**Location**: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`

The issue is likely in how the Components Panel determines if something is a page:

```typescript
// Pseudo-code of likely logic:
const isPage = component.name.startsWith('/#__page__/');
```

**Possible causes**:

1. The component naming is correct, but display logic has a bug
2. The icon determination logic doesn't check for page prefix
3. UI state not updated after project load

---

## 🛠️ Proposed Solution

### Option 1: Verify Icon Logic (Recommended)

Check `ComponentItem.tsx` line ~85:

```typescript
let icon = IconName.Component;
if (component.isRoot) {
  icon = IconName.Home;
} else if (component.isPage) {
  // ← Verify this is set correctly
  icon = IconName.PageRouter;
}
```

Ensure `component.isPage` is correctly detected from the `/#__page__/` prefix.

### Option 2: Debug Data Flow

Add temporary logging:

```typescript
console.log('Component:', component.name);
console.log('Is Page?', component.isPage);
console.log('Is Root?', component.isRoot);
```

---

## ✅ Verification Steps

1. Create new project from launcher
2. Open Components panel
3. Check icon next to "Home" component
4. Expected: Should show router/page icon, not component icon

---

**Impact**: Low - Cosmetic issue only, doesn't affect functionality  
**Priority**: P2 - Fix after critical bugs
