# TASK-002: React 19 UI Fixes

## Overview

This task addresses critical React 19 API migration issues that were not fully completed during Phase 1. These issues are causing multiple UI bugs in the node graph editor.

## Problem Statement

After the React 19 migration in Phase 1, several legacy React 17 APIs are still being used in the codebase:
- `ReactDOM.render()` - Removed in React 18+
- `ReactDOM.unmountComponentAtNode()` - Removed in React 18+
- Incorrect `createRoot()` usage (creating new roots on every render)

These errors crash the node graph editor's mouse event handlers, causing:
- Right-click shows 'grab' hand instead of node picker
- Plus icon node picker appears at wrong position and overflows
- Node config panel doesn't appear when clicking nodes
- Wire connectors don't respond to clicks

## Error Messages

```
ReactDOM.render is not a function
    at DebugInspectorPopup.render (nodegrapheditor.debuginspectors.js:60)

ReactDOM.unmountComponentAtNode is not a function
    at DebugInspectorPopup.dispose (nodegrapheditor.debuginspectors.js:64)

You are calling ReactDOMClient.createRoot() on a container that has already 
been passed to createRoot() before.
    at _renderReact (commentlayer.ts:145)
```

## Affected Files

| File | Issue | Priority |
|------|-------|----------|
| `nodegrapheditor.debuginspectors.js` | Uses legacy `ReactDOM.render()` & `unmountComponentAtNode()` | **Critical** |
| `commentlayer.ts` | Creates new `createRoot()` on every render | **High** |
| `TextStylePicker.jsx` | Uses legacy `ReactDOM.render()` & `unmountComponentAtNode()` | **Medium** |

## Solution

### Pattern 1: Replace ReactDOM.render() / unmountComponentAtNode()

```javascript
// Before (React 17):
const ReactDOM = require('react-dom');
ReactDOM.render(<Component />, container);
ReactDOM.unmountComponentAtNode(container);

// After (React 18+):
import { createRoot } from 'react-dom/client';
const root = createRoot(container);
root.render(<Component />);
root.unmount();
```

### Pattern 2: Reuse Existing Roots

```typescript
// Before (Wrong):
_renderReact() {
  this.root = createRoot(this.div);
  this.root.render(<Component />);
}

// After (Correct):
_renderReact() {
  if (!this.root) {
    this.root = createRoot(this.div);
  }
  this.root.render(<Component />);
}
```

## Related Tasks

- TASK-001B-react19-migration (Phase 1) - Initial React 19 migration
- TASK-006-typescript5-upgrade (Phase 1) - TypeScript 5 upgrade

## References

- [React 18 Migration Guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
- [createRoot API](https://react.dev/reference/react-dom/client/createRoot)
