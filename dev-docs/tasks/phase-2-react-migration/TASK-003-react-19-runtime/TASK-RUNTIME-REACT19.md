# TASK: Runtime React 19 Upgrade

## Overview

Upgrade the OpenNoodl runtime (`noodl-viewer-react`) from React 16.8/17 to React 19. This affects deployed/published projects.

**Priority:** HIGH - Do this BEFORE adding new nodes to avoid migration debt.

**Estimated Duration:** 2-3 days focused work

## Goals

1. Replace bundled React 16.8 with React 19
2. Update entry point rendering to use `createRoot()` API
3. Ensure all built-in nodes are React 19 compatible
4. Update SSR to use React 19 server APIs
5. Maintain backward compatibility for simple user projects

## Pre-Work Checklist

Before starting, confirm you can:
- [ ] Run the editor locally (`npm run dev`)
- [ ] Build the viewer-react package
- [ ] Create a test project with various nodes (Group, Text, Button, Repeater, etc.)
- [ ] Deploy a test project

## Phase 1: React Bundle Replacement

### 1.1 Locate Current React Bundles

```bash
# Find all React bundles in the runtime
find packages/noodl-viewer-react -name "react*.js" -o -name "react*.min.js"
```

Expected locations:
- `packages/noodl-viewer-react/static/shared/react.production.min.js`
- `packages/noodl-viewer-react/static/shared/react-dom.production.min.js`

### 1.2 Download React 19 Production Bundles

Get React 19 UMD production builds from:
- https://unpkg.com/react@19/umd/react.production.min.js
- https://unpkg.com/react-dom@19/umd/react-dom.production.min.js

```bash
cd packages/noodl-viewer-react/static/shared

# Backup current files
cp react.production.min.js react.production.min.js.backup
cp react-dom.production.min.js react-dom.production.min.js.backup

# Download React 19
curl -o react.production.min.js https://unpkg.com/react@19/umd/react.production.min.js
curl -o react-dom.production.min.js https://unpkg.com/react-dom@19/umd/react-dom.production.min.js
```

### 1.3 Update SSR Dependencies

File: `packages/noodl-viewer-react/static/ssr/package.json`

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

## Phase 2: Entry Point Migration

### 2.1 Locate Entry Point Render Implementation

Search for where `_viewerReact.render` and `_viewerReact.renderDeployed` are defined:

```bash
grep -r "_viewerReact" packages/noodl-viewer-react/src --include="*.js" --include="*.ts"
grep -r "ReactDOM.render" packages/noodl-viewer-react/src --include="*.js" --include="*.ts"
```

### 2.2 Update to createRoot API

**Before (React 17):**
```javascript
import ReactDOM from 'react-dom';

window.Noodl._viewerReact = {
  render(rootElement, modules, options) {
    const App = createApp(modules, options);
    ReactDOM.render(<App />, rootElement);
  },
  
  renderDeployed(rootElement, modules, projectData) {
    const App = createDeployedApp(modules, projectData);
    ReactDOM.render(<App />, rootElement);
  }
};
```

**After (React 19):**
```javascript
import { createRoot } from 'react-dom/client';

// Store root reference for potential unmounting
let currentRoot = null;

window.Noodl._viewerReact = {
  render(rootElement, modules, options) {
    const App = createApp(modules, options);
    currentRoot = createRoot(rootElement);
    currentRoot.render(<App />);
  },
  
  renderDeployed(rootElement, modules, projectData) {
    const App = createDeployedApp(modules, projectData);
    currentRoot = createRoot(rootElement);
    currentRoot.render(<App />);
  },
  
  unmount() {
    if (currentRoot) {
      currentRoot.unmount();
      currentRoot = null;
    }
  }
};
```

### 2.3 Update SSR Rendering

File: `packages/noodl-viewer-react/static/ssr/index.js`

**Before:**
```javascript
const ReactDOMServer = require('react-dom/server');
const output = ReactDOMServer.renderToString(ViewerComponent);
```

**After (React 19):**
```javascript
// React 19 server APIs - check if this package structure changed
const { renderToString } = require('react-dom/server');
const output = renderToString(ViewerComponent);
```

Note: React 19 server rendering APIs should be similar but verify the import paths.

## Phase 3: Built-in Node Audit

### 3.1 Search for Legacy Lifecycle Methods

These are REMOVED in React 19 (not just deprecated):

```bash
cd packages/noodl-viewer-react

# Search for dangerous patterns
grep -rn "componentWillMount" src/
grep -rn "componentWillReceiveProps" src/
grep -rn "componentWillUpdate" src/
grep -rn "UNSAFE_componentWillMount" src/
grep -rn "UNSAFE_componentWillReceiveProps" src/
grep -rn "UNSAFE_componentWillUpdate" src/
```

### 3.2 Search for Other Deprecated Patterns

```bash
# String refs (removed)
grep -rn "ref=\"" src/
grep -rn "ref='" src/

# Legacy context (removed)
grep -rn "contextTypes" src/
grep -rn "childContextTypes" src/
grep -rn "getChildContext" src/

# createFactory (removed)
grep -rn "createFactory" src/

# findDOMNode (deprecated, may still work)
grep -rn "findDOMNode" src/
```

### 3.3 Fix Legacy Patterns

**componentWillMount → useEffect or componentDidMount:**
```javascript
// Before (class component)
componentWillMount() {
  this.setupData();
}

// After (class component)
componentDidMount() {
  this.setupData();
}

// Or convert to functional
useEffect(() => {
  setupData();
}, []);
```

**componentWillReceiveProps → getDerivedStateFromProps or useEffect:**
```javascript
// Before
componentWillReceiveProps(nextProps) {
  if (nextProps.value !== this.props.value) {
    this.setState({ derived: computeDerived(nextProps.value) });
  }
}

// After (class component)
static getDerivedStateFromProps(props, state) {
  if (props.value !== state.prevValue) {
    return {
      derived: computeDerived(props.value),
      prevValue: props.value
    };
  }
  return null;
}

// Or functional with useEffect
useEffect(() => {
  setDerived(computeDerived(value));
}, [value]);
```

**String refs → createRef or useRef:**
```javascript
// Before
<input ref="myInput" />
this.refs.myInput.focus();

// After (class)
constructor() {
  this.myInputRef = React.createRef();
}
<input ref={this.myInputRef} />
this.myInputRef.current.focus();

// After (functional)
const myInputRef = useRef();
<input ref={myInputRef} />
myInputRef.current.focus();
```

## Phase 4: createNodeFromReactComponent Wrapper

### 4.1 Locate the Wrapper Implementation

```bash
grep -rn "createNodeFromReactComponent" packages/noodl-viewer-react/src --include="*.js" --include="*.ts"
```

### 4.2 Audit the Wrapper

Check if the wrapper:
1. Uses any legacy lifecycle methods internally
2. Uses legacy context for passing data
3. Uses findDOMNode

The wrapper likely manages:
- `forceUpdate()` calls (should still work)
- Ref handling (ensure using callback refs or createRef)
- Style injection
- Child management

### 4.3 Update if Necessary

If the wrapper uses class components internally, ensure they don't use deprecated lifecycles.

## Phase 5: Testing

### 5.1 Create Test Project

Create a Noodl project that uses:
- [ ] Group nodes (basic container)
- [ ] Text nodes
- [ ] Button nodes with click handlers
- [ ] Image nodes
- [ ] Repeater (For Each) nodes
- [ ] Navigation/Page Router
- [ ] States and Variants
- [ ] Custom JavaScript nodes (if the API supports it)

### 5.2 Test Scenarios

1. **Basic Rendering**
   - Open project in editor preview
   - Verify all nodes render correctly

2. **Interactions**
   - Click buttons, verify signals fire
   - Hover states work
   - Input fields accept text

3. **Dynamic Updates**
   - Repeater data changes reflect in UI
   - State changes trigger re-renders

4. **Navigation**
   - Page transitions work
   - URL routing works

5. **Deploy Test**
   - Export/deploy project
   - Open in browser
   - Verify everything works in production build

### 5.3 SSR Test (if applicable)

```bash
cd packages/noodl-viewer-react/static/ssr
npm install
npm run build
npm start
# Visit http://localhost:3000 and verify server rendering works
```

## Phase 6: Documentation & Migration Guide

### 6.1 Create Migration Guide for Users

File: `docs/REACT-19-MIGRATION.md`

```markdown
# React 19 Runtime Migration Guide

## What Changed

OpenNoodl runtime now uses React 19. This affects deployed projects.

## Who Needs to Act

Most projects will work without changes. You may need updates if you have:
- Custom JavaScript nodes using React class components
- Custom modules using legacy React patterns

## Breaking Changes

These patterns NO LONGER WORK:

1. **componentWillMount** - Use componentDidMount instead
2. **componentWillReceiveProps** - Use getDerivedStateFromProps or effects
3. **componentWillUpdate** - Use getSnapshotBeforeUpdate
4. **String refs** - Use createRef or useRef
5. **Legacy context** - Use React.createContext

## How to Check Your Project

1. Open your project in the new OpenNoodl
2. Check the console for warnings
3. Test all interactive features
4. If issues, review custom JavaScript code

## Need Help?

- Community Discord: [link]
- GitHub Issues: [link]
```

## Verification Checklist

Before considering this task complete:

- [ ] React 19 bundles are in place
- [ ] Entry point uses `createRoot()`
- [ ] All built-in nodes render correctly
- [ ] No console errors about deprecated APIs
- [ ] Deploy builds work
- [ ] SSR works (if used)
- [ ] Documentation updated

## Rollback Plan

If issues are found:
1. Restore backup React bundles
2. Revert entry point changes
3. Document what broke for future fix

Keep backups:
```bash
packages/noodl-viewer-react/static/shared/react.production.min.js.backup
packages/noodl-viewer-react/static/shared/react-dom.production.min.js.backup
```

## Files Modified Summary

| File | Change |
|------|--------|
| `static/shared/react.production.min.js` | Replace with React 19 |
| `static/shared/react-dom.production.min.js` | Replace with React 19 |
| `static/ssr/package.json` | Update React version |
| `src/[viewer-entry].js` | Use createRoot API |
| `src/nodes/*.js` | Fix any legacy patterns |

## Notes for Cline

1. **Confidence Check:** Before each major change, verify you understand what the code does
2. **Small Steps:** Make one change, test, commit. Don't batch large changes.
3. **Console is King:** Watch for React warnings in browser console
4. **Backup First:** Always backup before replacing files
5. **Ask if Unsure:** If you hit something unexpected, pause and analyze

## Expected Warnings You Can Ignore

React 19 may show these development-only warnings that are OK:
- "React DevTools" messages
- Strict Mode double-render warnings (expected behavior)

## Red Flags - Stop and Investigate

- "Invalid hook call" - Something is using hooks incorrectly
- "Cannot read property of undefined" - Likely a ref issue
- White screen with no errors - Check the console in DevTools
- "Element type is invalid" - Component not exported correctly
