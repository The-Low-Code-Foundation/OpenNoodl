# Cline Rules: Runtime React 19 Upgrade

## Task Context
Upgrading noodl-viewer-react runtime from React 16.8 to React 19. This is the code that runs in deployed user projects.

## Key Constraints

### DO NOT
- Touch the editor code (noodl-editor) - that's a separate task
- Remove any existing node functionality
- Change the public API of `window.Noodl._viewerReact`
- Batch multiple large changes in one commit

### MUST DO
- Backup files before replacing
- Test after each significant change
- Watch browser console for React errors
- Preserve existing node behavior exactly

## Critical Files

### Replace These React Bundles
```
packages/noodl-viewer-react/static/shared/react.production.min.js
packages/noodl-viewer-react/static/shared/react-dom.production.min.js
```
Source: https://unpkg.com/react@19/umd/

### Update Entry Point (location TBD - search for it)
Find where `_viewerReact.render` is defined and change:
```javascript
// OLD
ReactDOM.render(<App />, element);

// NEW
import { createRoot } from 'react-dom/client';
const root = createRoot(element);
root.render(<App />);
```

### Update SSR
```
packages/noodl-viewer-react/static/ssr/package.json  // Change React version
packages/noodl-viewer-react/static/ssr/index.js      // May need API updates
```

## Search Patterns for Broken Code

Run these and fix any matches:
```bash
# CRITICAL - These are REMOVED in React 19
grep -rn "componentWillMount" src/
grep -rn "componentWillReceiveProps" src/
grep -rn "componentWillUpdate" src/
grep -rn "UNSAFE_componentWill" src/

# REMOVED - String refs
grep -rn 'ref="' src/
grep -rn "ref='" src/

# REMOVED - Legacy context
grep -rn "contextTypes" src/
grep -rn "childContextTypes" src/
grep -rn "getChildContext" src/
```

## Lifecycle Migration Patterns

### componentWillMount → componentDidMount
```javascript
// Just move the code - componentDidMount runs after first render but that's usually fine
componentDidMount() {
  // code that was in componentWillMount
}
```

### componentWillReceiveProps → getDerivedStateFromProps
```javascript
static getDerivedStateFromProps(props, state) {
  if (props.value !== state.prevValue) {
    return { computed: derive(props.value), prevValue: props.value };
  }
  return null;
}
```

### String refs → createRef
```javascript
// OLD
<input ref="myInput" />
this.refs.myInput.focus();

// NEW
this.myInputRef = React.createRef();
<input ref={this.myInputRef} />
this.myInputRef.current.focus();
```

## Testing Checkpoints

After each phase, verify in browser:
1. ✓ Editor preview loads without console errors
2. ✓ Basic nodes render (Group, Text, Button)
3. ✓ Click events fire signals
4. ✓ Hover states work
5. ✓ Repeater renders lists
6. ✓ Deploy build works

## Red Flags - Stop and Ask

- White screen with no console output
- "Invalid hook call" error
- Any error mentioning "fiber" or "reconciler"
- Build fails after React bundle replacement

## Commit Strategy

```
feat(runtime): replace React bundles with v19
feat(runtime): migrate entry point to createRoot
fix(runtime): update [node-name] for React 19 compatibility
feat(runtime): update SSR for React 19
docs: add React 19 migration guide
```

## When Done

- [ ] All grep searches return zero results for deprecated patterns
- [ ] Editor preview works
- [ ] Deploy build works
- [ ] No React warnings in console
- [ ] SSR still functions (if it was working before)
