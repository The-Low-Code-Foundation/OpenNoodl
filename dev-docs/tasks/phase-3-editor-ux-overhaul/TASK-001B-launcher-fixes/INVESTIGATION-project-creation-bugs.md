# Investigation: Project Creation Bugs

**Date**: January 12, 2026  
**Status**: 🔴 CRITICAL - Multiple Issues Identified  
**Priority**: P0 - Blocks Basic Functionality

---

## 📋 Summary

Four critical bugs were identified when creating new projects from the launcher:

1. **Home component shown as "component" not "page"** in Components panel
2. **App component not set as Home** (preview fails with "No HOME component")
3. **"Make Home" context menu does nothing** (no console output, no error)
4. **"Create new page" modal misaligned** (triangle pointer detached from rectangle)

---

## 🎯 Root Cause Analysis

### CRITICAL: Router Node Missing `allowAsExportRoot`

**Location**: `packages/noodl-viewer-react/src/nodes/navigation/router.tsx`

The Router node definition is **missing the `allowAsExportRoot` property**:

```typescript
const RouterNode = {
  name: 'Router',
  displayNodeName: 'Page Router'
  // ❌ Missing: allowAsExportRoot: true
  // ...
};
```

This causes `ProjectModel.setRootComponent()` to fail silently:

```typescript
// packages/noodl-editor/src/editor/src/models/projectmodel.ts:233
setRootComponent(component: ComponentModel) {
  const root = _.find(component.graph.roots, function (n) {
    return n.type.allowAsExportRoot;  // ❌ Returns undefined for Router!
  });
  if (root) this.setRootNode(root);  // ❌ Never executes!
}
```

**Impact**: This single missing property causes bugs #2 and #3.

---

## 🔍 Detailed Analysis

See individual bug files for complete analysis:

- **[BUG-001-home-component-type.md](./BUG-001-home-component-type.md)** - Home shown as component not page
- **[BUG-002-app-not-home.md](./BUG-002-app-not-home.md)** - App component not set as Home
- **[BUG-003-make-home-silent-fail.md](./BUG-003-make-home-silent-fail.md)** - "Make Home" does nothing
- **[BUG-004-create-page-modal-styling.md](./BUG-004-create-page-modal-styling.md)** - Modal alignment issue

---

## 🛠️ Proposed Solutions

See **[SOLUTIONS.md](./SOLUTIONS.md)** for detailed fixes.

### Quick Summary

| Bug     | Solution                                | Complexity   | Files Affected |
| ------- | --------------------------------------- | ------------ | -------------- |
| #1      | Improve UI display logic                | Low          | 1 file         |
| #2 & #3 | Add `allowAsExportRoot: true` to Router | **Critical** | 1 file         |
| #4      | Fix CSS positioning                     | Low          | 1 file         |

---

## 📂 Related Files

### Core Files

- `packages/noodl-viewer-react/src/nodes/navigation/router.tsx` - Router node (NEEDS FIX)
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts` - Root component logic
- `packages/noodl-editor/src/editor/src/models/template/templates/hello-world.template.ts` - Template definition

### UI Files

- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentActions.ts` - "Make Home" handler
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/Pages/Pages.tsx` - Create page modal
- `packages/noodl-editor/src/editor/src/styles/propertyeditor/pages.css` - Modal styling

---

## ✅ Next Steps

1. **CRITICAL**: Add `allowAsExportRoot: true` to Router node
2. Test project creation flow end-to-end
3. Fix remaining UI issues (bugs #1 and #4)
4. Add regression tests

---

_Created: January 12, 2026_
