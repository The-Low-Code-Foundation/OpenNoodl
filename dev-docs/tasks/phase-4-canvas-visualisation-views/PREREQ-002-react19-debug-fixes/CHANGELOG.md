# PREREQ-002: React 19 Debug Fixes - CHANGELOG

## Status: ✅ COMPLETED

**Completion Date:** March 1, 2026

---

## Overview

Fixed React 18/19 `createRoot` memory leaks and performance issues where new React roots were being created unnecessarily instead of reusing existing roots. These issues caused memory accumulation and potential performance degradation over time.

---

## Problem Statement

### Issue 1: ConnectionPopup Memory Leaks

In `nodegrapheditor.ts`, the `openConnectionPanels()` method created React roots properly for the initial render, but then created **new roots** inside the `onPortSelected` callback instead of reusing the existing roots. This caused a new React root to be created every time a user selected connection ports.

### Issue 2: Hot Module Replacement Root Duplication

In `router.tsx`, the HMR (Hot Module Replacement) accept handlers created new React roots on every hot reload instead of reusing the existing roots stored in variables.

### Issue 3: News Modal Root Accumulation

In `whats-new.ts`, a new React root was created each time the modal opened without properly unmounting and cleaning up the previous root when the modal closed.

---

## Changes Made

### 1. Fixed ConnectionPopup Root Leaks

**File:** `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`

**Problem Pattern:**

```typescript
// BROKEN - Created new roots in callbacks
const fromDiv = document.createElement('div');
const root = createRoot(fromDiv);  // Created once
root.render(...);

onPortSelected: (fromPort) => {
  createRoot(toDiv).render(...);    // ❌ NEW root every selection!
  createRoot(fromDiv).render(...);  // ❌ NEW root every selection!
}
```

**Fixed Pattern:**

```typescript
// FIXED - Reuses cached roots
const fromDiv = document.createElement('div');
const fromRoot = createRoot(fromDiv);  // Created once
fromRoot.render(...);

const toDiv = document.createElement('div');
const toRoot = createRoot(toDiv);     // Created once
toRoot.render(...);

onPortSelected: (fromPort) => {
  toRoot.render(...);    // ✅ Reuses root
  fromRoot.render(...);  // ✅ Reuses root
}

onClose: () => {
  fromRoot.unmount();    // ✅ Proper cleanup
  toRoot.unmount();      // ✅ Proper cleanup
}
```

**Impact:**

- Prevents memory leak on every connection port selection
- Improves performance when creating multiple node connections
- Proper cleanup when connection panels close

### 2. Fixed HMR Root Duplication

**File:** `packages/noodl-editor/src/editor/src/router.tsx`

**Problem Pattern:**

```typescript
// BROKEN - Created new root on every HMR
function createToastLayer() {
  const toastLayer = document.createElement('div');
  createRoot(toastLayer).render(...);

  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('./views/ToastLayer', () => {
      createRoot(toastLayer).render(...);  // ❌ NEW root on HMR!
    });
  }
}
```

**Fixed Pattern:**

```typescript
// FIXED - Stores and reuses roots
let toastLayerRoot: ReturnType<typeof createRoot> | null = null;
let dialogLayerRoot: ReturnType<typeof createRoot> | null = null;

function createToastLayer() {
  const toastLayer = document.createElement('div');
  toastLayerRoot = createRoot(toastLayer);
  toastLayerRoot.render(...);

  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('./views/ToastLayer', () => {
      if (toastLayerRoot) {
        toastLayerRoot.render(...);  // ✅ Reuses root!
      }
    });
  }
}
```

**Impact:**

- Prevents root accumulation during development HMR
- Improves hot reload performance
- Reduces memory usage during development

### 3. Fixed News Modal Root Accumulation

**File:** `packages/noodl-editor/src/editor/src/whats-new.ts`

**Problem Pattern:**

```typescript
// BROKEN - No cleanup when modal closes
createRoot(modalContainer).render(
  React.createElement(NewsModal, {
    content: latestChangelogPost.content_html,
    onFinished: () => ipcRenderer.send('viewer-show') // ❌ No cleanup!
  })
);
```

**Fixed Pattern:**

```typescript
// FIXED - Properly unmounts root and removes DOM
const modalRoot = createRoot(modalContainer);
modalRoot.render(
  React.createElement(NewsModal, {
    content: latestChangelogPost.content_html,
    onFinished: () => {
      ipcRenderer.send('viewer-show');
      modalRoot.unmount(); // ✅ Unmount root
      modalContainer.remove(); // ✅ Remove DOM
    }
  })
);
```

**Impact:**

- Prevents root accumulation when changelog modal is shown multiple times
- Proper DOM cleanup
- Better memory management

---

## React Root Lifecycle Best Practices

### ✅ Correct Pattern: Create Once, Reuse, Unmount

```typescript
// 1. Create root ONCE
const container = document.createElement('div');
const root = createRoot(container);

// 2. REUSE root for updates
root.render(<MyComponent prop="value1" />);
root.render(<MyComponent prop="value2" />); // Same root!

// 3. UNMOUNT when done
root.unmount();
container.remove(); // Optional: cleanup DOM
```

### ❌ Anti-Pattern: Creating New Roots

```typescript
// DON'T create new roots for updates
createRoot(container).render(<MyComponent prop="value1" />);
createRoot(container).render(<MyComponent prop="value2" />); // ❌ Memory leak!
```

### ✅ Pattern for Conditional/Instance Roots

```typescript
// Store root as instance variable
class MyView {
  private root: ReturnType<typeof createRoot> | null = null;

  render() {
    if (!this.root) {
      this.root = createRoot(this.el);
    }
    this.root.render(<MyComponent />);
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
```

---

## Verification

### Audit Results

Searched entire codebase for `createRoot` usage patterns. Found 36 instances across 26 files. Analysis:

**✅ Already Correct (23 files):**

- Most files already use the `if (!this.root)` pattern correctly
- Store roots as instance/class variables
- Properly gate root creation

**✅ Fixed (3 files):**

1. `nodegrapheditor.ts` - Connection popup root reuse
2. `router.tsx` - HMR root caching
3. `whats-new.ts` - Modal cleanup

**✅ No Issues Found:**

- No other problematic patterns detected
- All other usages follow React 18/19 best practices

### Test Verification

To verify these fixes:

1. **Test ConnectionPopup:**

   - Create multiple node connections
   - Select different ports repeatedly
   - Memory should remain stable

2. **Test HMR:**

   - Make changes to ToastLayer/DialogLayer components
   - Hot reload multiple times
   - Dev tools should show stable root count

3. **Test News Modal:**
   - Trigger changelog modal multiple times (adjust localStorage dates)
   - Memory should not accumulate

---

## Files Modified

```
packages/noodl-editor/src/editor/src/
├── views/
│   ├── nodegrapheditor.ts          # ConnectionPopup root lifecycle
│   └── whats-new.ts                # News modal cleanup
└── router.tsx                       # HMR root caching
```

---

## Related Documentation

- **React 18/19 Migration:** Phase 1 - TASK-001B-react19-migration
- **createRoot API:** https://react.dev/reference/react-dom/client/createRoot
- **Root Lifecycle:** https://react.dev/reference/react-dom/client/createRoot#root-render

---

## Follow-up Actions

### Completed ✅

- [x] Fix nodegrapheditor.ts ConnectionPopup leaks
- [x] Fix router.tsx HMR root duplication
- [x] Fix whats-new.ts modal cleanup
- [x] Audit all createRoot usage in codebase
- [x] Document best practices

### Future Considerations 💡

- Consider adding ESLint rule to catch `createRoot` anti-patterns
- Add memory profiling tests to CI for regression detection
- Create developer guide section on React root management

---

## Notes

- **Breaking Change:** None - all changes are internal improvements
- **Performance Impact:** Positive - reduces memory usage
- **Development Impact:** Better HMR experience with no root accumulation

**Key Learning:** In React 18/19, `createRoot` returns a root object that should be reused for subsequent renders to the same DOM container. Creating new roots for the same container causes memory leaks and degrades performance.
