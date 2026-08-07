# TASK-003: Runtime React 18.3.1 Upgrade - CHANGELOG

## Summary

Upgraded the `noodl-viewer-react` runtime package from React 16.8/17 to React 18.3.1. This affects deployed/published Noodl projects.

> **Note**: Originally targeted React 19, but React 19 removed UMD build support. React 18.3.1 is the latest version with UMD bundles and provides 95%+ compatibility with React 19 APIs.

## Date: December 13, 2025

---

## Changes Made

### 1. Main Entry Point (`noodl-viewer-react.js`)

**File**: `packages/noodl-viewer-react/noodl-viewer-react.js`

- **Changed** `ReactDOM.render()` → `ReactDOM.createRoot().render()`
- **Changed** `ReactDOM.hydrate()` → `ReactDOM.hydrateRoot()`
- **Added** `currentRoot` variable for root management
- **Added** `unmount()` method for cleanup

```javascript
// Before (React 16/17)
ReactDOM.render(element, container);
ReactDOM.hydrate(element, container);

// After (React 18)
const root = ReactDOM.createRoot(container);
root.render(element);

const root = ReactDOM.hydrateRoot(container, element);
```

### 2. React Component Node (`react-component-node.js`)

**File**: `packages/noodl-viewer-react/src/react-component-node.js`

- **Removed** `ReactDOM.findDOMNode()` usage (deprecated in React 18)
- **Added** `_domElement` storage in `NoodlReactComponent` ref callback
- **Updated** `getDOMElement()` method to use stored DOM element reference
- **Removed** unused `ReactDOM` import after findDOMNode removal

```javascript
// Before (React 16/17)
import ReactDOM from 'react-dom';
// ...
const domElement = ReactDOM.findDOMNode(ref);

// After (React 18)
// No ReactDOM import needed
// DOM element stored via ref callback
if (ref && ref instanceof Element) {
  noodlNode._domElement = ref;
}
```

### 3. Group Component (`Group.tsx`)

**File**: `packages/noodl-viewer-react/src/components/visual/Group/Group.tsx`

- **Converted** `UNSAFE_componentWillReceiveProps` → `componentDidUpdate(prevProps)`
- **Merged** scroll initialization logic into single `componentDidUpdate`

### 4. Drag Component (`Drag.tsx`)

**File**: `packages/noodl-viewer-react/src/components/visual/Drag/Drag.tsx`

- **Converted** `UNSAFE_componentWillReceiveProps` → `componentDidUpdate(prevProps)`

### 5. UMD Bundles (`static/shared/`)

**Files**:
- `packages/noodl-viewer-react/static/shared/react.production.min.js`
- `packages/noodl-viewer-react/static/shared/react-dom.production.min.js`

- **Updated** from React 16.8.1 to React 18.3.1 UMD bundles
- Downloaded from `unpkg.com/react@18.3.1/umd/`

### 6. SSR Package (`static/ssr/package.json`)

**File**: `packages/noodl-viewer-react/static/ssr/package.json`

- **Updated** `react` dependency: `^17.0.2` → `^18.3.1`
- **Updated** `react-dom` dependency: `^17.0.2` → `^18.3.1`

---

## API Migration Summary

| Old API (React 16/17) | New API (React 18) | Status |
|----------------------|-------------------|--------|
| `ReactDOM.render()` | `ReactDOM.createRoot().render()` | ✅ Migrated |
| `ReactDOM.hydrate()` | `ReactDOM.hydrateRoot()` | ✅ Migrated |
| `ReactDOM.findDOMNode()` | Ref callbacks with DOM storage | ✅ Migrated |
| `UNSAFE_componentWillReceiveProps` | `componentDidUpdate(prevProps)` | ✅ Migrated |

---

## Build Verification

- ✅ `npm run ci:build:viewer` passed successfully
- ✅ Webpack compiled with no errors
- ✅ React externals properly configured (`external "React"`, `external "ReactDOM"`)

---

## Why React 18.3.1 Instead of React 19?

React 19 (released December 2024) **removed UMD build support**. The Noodl runtime architecture relies on loading React as external UMD bundles via webpack externals:

```javascript
// webpack.config.js
externals: {
  react: 'React',
  'react-dom': 'ReactDOM'
}
```

React 18.3.1 is:
- The last version with official UMD bundles
- Fully compatible with createRoot/hydrateRoot APIs
- Provides a stable foundation for deployed projects

Future consideration: Evaluate ESM-based loading or custom React 19 bundle generation.

---

## Files Modified

1. `packages/noodl-viewer-react/noodl-viewer-react.js`
2. `packages/noodl-viewer-react/src/react-component-node.js`
3. `packages/noodl-viewer-react/src/components/visual/Group/Group.tsx`
4. `packages/noodl-viewer-react/src/components/visual/Drag/Drag.tsx`
5. `packages/noodl-viewer-react/static/shared/react.production.min.js`
6. `packages/noodl-viewer-react/static/shared/react-dom.production.min.js`
7. `packages/noodl-viewer-react/static/ssr/package.json`
8. `dev-docs/reference/LEARNINGS-RUNTIME.md` (created - runtime documentation)
