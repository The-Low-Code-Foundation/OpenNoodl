# PREREQ-002: React 19 Debug Infrastructure Fixes

## Overview

**Priority:** HIGH  
**Estimate:** 0.5-1 day  
**Status:** Not started  
**Blocked by:** PREREQ-001 (Webpack caching)

---

## The Problem

After the React 19 migration, several files still use legacy React 17/16 APIs that have been removed:

- `ReactDOM.render()` - Removed in React 18+
- `ReactDOM.unmountComponentAtNode()` - Removed in React 18+
- Creating new `createRoot()` on every render instead of reusing

These cause crashes in the debug inspector system, which is needed for:
- VIEW-003: Trigger Chain Debugger
- VIEW-005: Data Lineage (live values)

---

## Error Messages You'll See

```
ReactDOM.render is not a function
    at DebugInspectorPopup.render (nodegrapheditor.debuginspectors.js:60)

ReactDOM.unmountComponentAtNode is not a function
    at DebugInspectorPopup.dispose (nodegrapheditor.debuginspectors.js:64)

You are calling ReactDOMClient.createRoot() on a container that has already 
been passed to createRoot() before.
    at _renderReact (commentlayer.ts:145)
```

---

## Files to Fix

### 1. nodegrapheditor.debuginspectors.js

**Location:** `packages/noodl-editor/src/editor/src/views/nodegrapheditor/`

**Current (broken):**
```javascript
const ReactDOM = require('react-dom');

class DebugInspectorPopup {
  render() {
    ReactDOM.render(<InspectorComponent />, this.container);
  }
  
  dispose() {
    ReactDOM.unmountComponentAtNode(this.container);
  }
}
```

**Fixed:**
```javascript
import { createRoot } from 'react-dom/client';

class DebugInspectorPopup {
  constructor() {
    this.root = null;
  }
  
  render() {
    if (!this.root) {
      this.root = createRoot(this.container);
    }
    this.root.render(<InspectorComponent />);
  }
  
  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
```

### 2. commentlayer.ts

**Location:** `packages/noodl-editor/src/editor/src/views/nodegrapheditor/commentlayer.ts`

**Current (broken):**
```typescript
_renderReact() {
  this.root = createRoot(this.div);  // Creates new root every time!
  this.root.render(<CommentLayerView ... />);
}
```

**Fixed:**
```typescript
_renderReact() {
  if (!this.root) {
    this.root = createRoot(this.div);
  }
  this.root.render(<CommentLayerView ... />);
}

dispose() {
  if (this.root) {
    this.root.unmount();
    this.root = null;
  }
}
```

### 3. TextStylePicker.jsx

**Location:** `packages/noodl-editor/src/editor/src/views/` (search for it)

**Same pattern as debuginspectors** - replace ReactDOM.render/unmountComponentAtNode with createRoot pattern.

---

## Implementation Steps

### Phase 1: Fix Debug Inspectors

1. Open `nodegrapheditor.debuginspectors.js`
2. Change `require('react-dom')` to `import { createRoot } from 'react-dom/client'`
3. Store root instance on the class
4. Reuse root on subsequent renders
5. Use `root.unmount()` on dispose

### Phase 2: Fix CommentLayer

1. Open `commentlayer.ts`
2. Add root instance check before creating
3. Ensure dispose properly unmounts

### Phase 3: Fix TextStylePicker

1. Find the file (search for TextStylePicker)
2. Apply same pattern

### Phase 4: Search for Other Instances

```bash
# Find any remaining legacy ReactDOM usage
grep -r "ReactDOM.render" packages/noodl-editor/src/
grep -r "unmountComponentAtNode" packages/noodl-editor/src/
```

Fix any additional instances found.

---

## The Pattern

**Before (React 17):**
```javascript
// Import
const ReactDOM = require('react-dom');
// or
import ReactDOM from 'react-dom';

// Render
ReactDOM.render(<Component />, container);

// Cleanup
ReactDOM.unmountComponentAtNode(container);
```

**After (React 18+):**
```javascript
// Import
import { createRoot } from 'react-dom/client';

// Store root (create once, reuse)
if (!this.root) {
  this.root = createRoot(container);
}

// Render
this.root.render(<Component />);

// Cleanup
this.root.unmount();
```

---

## Verification Checklist

- [ ] Debug inspector popups appear without errors
- [ ] Hovering over connections shows value inspector
- [ ] Pinning inspectors works
- [ ] Comment layer renders without console errors
- [ ] Text style picker works (if applicable)
- [ ] No "createRoot called twice" warnings
- [ ] No "ReactDOM.render is not a function" errors

---

## Testing

1. Open any component in the canvas
2. Run the preview
3. Hover over a connection line
4. Debug inspector should appear
5. Check console for errors

---

## Related Documentation

- `dev-docs/tasks/phase-2/TASK-002-react19-ui-fixes/README.md`
- React 18 Migration Guide: https://react.dev/blog/2022/03/08/react-18-upgrade-guide

---

## Success Criteria

1. No React legacy API errors in console
2. Debug inspector fully functional
3. Comment layer renders properly
4. All existing functionality preserved
