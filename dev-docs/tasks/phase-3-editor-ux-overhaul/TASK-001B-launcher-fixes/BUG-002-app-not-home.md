# BUG-002: App Component Not Set as Home

**Severity**: 🔴 CRITICAL  
**Status**: Root Cause Identified  
**Category**: Core Functionality

---

## 🐛 Symptom

After creating a new project:

- ❌ Preview shows error: **"No 🏠 HOME component selected"**
- ❌ App component is not marked as Home in Components panel
- ❌ `ProjectModel.instance.rootNode` is `undefined`

**Expected**: App component should be automatically set as Home, preview should work.

**Actual**: No home component is set, preview fails.

---

## 🔍 Root Cause

**Router node is missing `allowAsExportRoot: true`**

### The Problem Chain

1. **Template includes `rootComponent`**:

```typescript
// hello-world.template.ts
content: {
  rootComponent: 'App',  // ✅ This is correct
  components: [...]
}
```

2. **ProjectModel.fromJSON() tries to set it**:

```typescript
// projectmodel.ts:172
if (json.rootComponent && !_this.rootNode) {
  const rootComponent = _this.getComponentWithName(json.rootComponent);
  if (rootComponent) {
    _this.setRootComponent(rootComponent); // ← Calls the broken method
  }
}
```

3. **setRootComponent() SILENTLY FAILS**:

```typescript
// projectmodel.ts:233
setRootComponent(component: ComponentModel) {
  const root = _.find(component.graph.roots, function (n) {
    return n.type.allowAsExportRoot;  // ❌ Router returns undefined!
  });
  if (root) this.setRootNode(root);  // ❌ NEVER EXECUTES!
  // NO ERROR THROWN - Silent failure!
}
```

4. **Router node has NO `allowAsExportRoot`**:

```typescript
// packages/noodl-viewer-react/src/nodes/navigation/router.tsx
const RouterNode = {
  name: 'Router'
  // ❌ MISSING: allowAsExportRoot: true
  // ...
};
```

---

## 💥 Impact

This is a **BLOCKER**:

- New projects cannot be previewed
- Users see cryptic error message
- "Make Home" button also fails (same root cause)
- No console errors to debug

---

## 🛠️ Solution

**Add one line to router.tsx**:

```typescript
const RouterNode = {
  name: 'Router',
  displayNodeName: 'Page Router',
  allowAsExportRoot: true, // ✅ ADD THIS
  category: 'Visuals'
  // ...
};
```

**That's it!** This single line fixes both Bug #2 and Bug #3.

---

## ✅ Verification

After fix:

1. Create new project
2. Check Components panel - App should have home icon
3. Open preview - should show "Hello World!"
4. No error messages

---

**Priority**: P0 - MUST FIX IMMEDIATELY  
**Blocks**: All new project workflows
