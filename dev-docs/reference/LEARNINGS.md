# Project Learnings

This document captures important discoveries and gotchas encountered during OpenNoodl development.

## React Hooks & EventDispatcher Integration (Dec 2025)

### Problem: EventDispatcher Events Not Reaching React Hooks

**Context**: During TASK-004B (ComponentsPanel React migration), discovered that `componentRenamed` events from ProjectModel weren't triggering UI updates in React components.

**Root Cause**: Array reference instability causing useEffect to constantly re-subscribe/unsubscribe.

**Discovery**:

```typescript
// ❌ BAD - Creates new array on every render
useEventListener(
  ProjectModel.instance,
  ['componentAdded', 'componentRemoved', 'componentRenamed', 'rootNodeChanged'],
  callback
);

// ✅ GOOD - Stable reference prevents re-subscription
const PROJECT_EVENTS = ['componentAdded', 'componentRemoved', 'componentRenamed', 'rootNodeChanged'];
useEventListener(ProjectModel.instance, PROJECT_EVENTS, callback);
```

**Location**:

- `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts`
- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`

**Keywords**: EventDispatcher, React hooks, useEffect, event subscription, array reference, re-render

---

## Hot Reload Issues with React Hooks (Dec 2025)

**Context**: Code changes to React hooks not taking effect despite webpack hot reload.

**Discovery**: React hooks sometimes require a **hard browser refresh** or **dev server restart** to pick up changes, especially:

- Changes to `useEffect` dependencies
- Changes to custom hooks
- Changes to event subscription logic

**Solution**:

1. Try hard refresh first: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. If that fails, restart dev server: Stop (Ctrl+C) and `npm run dev`
3. Clear browser cache if issues persist

**Location**: Affects all React hook development

**Keywords**: hot reload, React hooks, webpack, dev server, browser cache

---

## Webpack 5 Persistent Caching Issues (Dec 2025)

### Problem: Code Changes Not Loading Despite Dev Server Restart

**Context**: During TASK-004B, discovered that TypeScript source file changes weren't appearing in the running Electron app, even after multiple `npm run dev` restarts and cache clearing attempts.

**Root Cause**: Webpack 5 enables aggressive persistent caching by default:

- **Primary cache**: `packages/noodl-editor/node_modules/.cache`
- **Electron cache**: `~/Library/Application Support/Electron` (macOS)
- **App cache**: `~/Library/Application Support/OpenNoodl` (macOS)

**Discovery**: Standard cache clearing may not be sufficient. The caches can persist across:

- Dev server restarts
- Electron restarts
- Multiple rapid development iterations

**Solution**:

```bash
# Kill any running processes first
killall node
killall Electron

# Clear all caches
cd packages/noodl-editor
rm -rf node_modules/.cache
rm -rf ~/Library/Application\ Support/Electron
rm -rf ~/Library/Application\ Support/OpenNoodl

# Start fresh
npm run dev
```

**Best Practice**: When debugging webpack/compilation issues, add module-level console.log markers at the TOP of your files to verify new code is loading:

```typescript
// At top of file
console.log('🔥 MyModule.ts LOADED - Version 2.0');
```

If you don't see this marker in the console, your changes aren't loading - it's a cache/build issue, not a code issue.

**Location**: Affects all webpack-compiled code in `packages/noodl-editor/`

**Keywords**: webpack, cache, persistent caching, hot reload, dev server, Electron

---

## React 19 useEffect with Array Dependencies (Dec 2025)

### Problem: useEffect with Array Dependency Never Executes

**Context**: During TASK-004B, discovered that passing an array as a single dependency to useEffect prevents the effect from ever running.

**Root Cause**: React 19's `Object.is()` comparison for dependencies doesn't work correctly when an array is passed as a single dependency item.

**Discovery**:

```typescript
// ❌ BROKEN - useEffect NEVER runs
const eventNames = ['event1', 'event2', 'event3'];
useEffect(() => {
  console.log('This never prints!');
}, [dispatcher, eventNames]); // eventNames is an array reference

// ✅ CORRECT - Spread array into individual dependencies
const eventNames = ['event1', 'event2', 'event3'];
useEffect(() => {
  console.log('This runs correctly');
}, [dispatcher, ...eventNames]); // Spreads to: [dispatcher, 'event1', 'event2', 'event3']

// ✅ ALSO CORRECT - Use stable array reference outside component
const EVENT_NAMES = ['event1', 'event2', 'event3']; // Outside component

function MyComponent() {
  useEffect(() => {
    // Works because EVENT_NAMES reference is stable
  }, [dispatcher, ...EVENT_NAMES]);
}
```

**Critical Rule**: **Never pass an array as a dependency to useEffect. Always spread it.**

**Location**: Affects `useEventListener` hook and any custom hooks with array dependencies

**Keywords**: React 19, useEffect, dependencies, array, Object.is, spread operator, hook lifecycle

---
