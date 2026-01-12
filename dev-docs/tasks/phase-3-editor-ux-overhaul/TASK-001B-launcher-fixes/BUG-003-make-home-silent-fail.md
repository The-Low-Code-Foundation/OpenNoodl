# BUG-003: "Make Home" Context Menu Does Nothing

**Severity**: 🔴 CRITICAL  
**Status**: Root Cause Identified (Same as BUG-002)  
**Category**: Core Functionality

---

## 🐛 Symptom

When right-clicking on App component and selecting "Make Home":

- ❌ Nothing happens
- ❌ No console output
- ❌ No error messages
- ❌ Component doesn't become Home

**Expected**: App should be set as Home, preview should work.

**Actual**: Silent failure, no feedback.

---

## 🔍 Root Cause

**Same as BUG-002**: Router node missing `allowAsExportRoot: true`

### The Code Path

1. **User clicks "Make Home"** in context menu

2. **Handler is called correctly**:

```typescript
// useComponentActions.ts:27
const handleMakeHome = useCallback((node: TreeNode) => {
  const component = node.data.component;

  ProjectModel.instance?.setRootComponent(component); // ← This is called!
}, []);
```

3. **setRootComponent() FAILS SILENTLY**:

```typescript
// projectmodel.ts:233
setRootComponent(component: ComponentModel) {
  const root = _.find(component.graph.roots, function (n) {
    return n.type.allowAsExportRoot;  // ❌ Returns undefined for Router!
  });
  if (root) this.setRootNode(root);  // ❌ Never reaches here
  // ❌ NO ERROR, NO LOG, NO FEEDBACK
}
```

---

## 💡 Why It's Silent

The method doesn't throw errors or log anything. It just:

1. Searches for a node with `allowAsExportRoot: true`
2. Finds nothing (Router doesn't have it)
3. Exits quietly

**No one knows it failed!**

---

## 🛠️ Solution

**Same fix as BUG-002**: Add `allowAsExportRoot: true` to Router node.

```typescript
// packages/noodl-viewer-react/src/nodes/navigation/router.tsx
const RouterNode = {
  name: 'Router',
  displayNodeName: 'Page Router',
  allowAsExportRoot: true // ✅ ADD THIS LINE
  // ...
};
```

---

## ✅ Verification

After fix:

1. Create new project
2. Right-click App component
3. Click "Make Home"
4. App should get home icon
5. Preview should work

---

**Priority**: P0 - MUST FIX IMMEDIATELY  
**Fixes With**: BUG-002 (same root cause, same solution)
