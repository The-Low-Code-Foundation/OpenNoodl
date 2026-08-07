# React + EventDispatcher: The Golden Pattern

> **TL;DR:** Always use `useEventListener` hook. Never use `.on()` directly in React.

---

## Quick Start

```typescript
import { useEventListener } from '@noodl-hooks/useEventListener';

import { ProjectModel } from '@noodl-models/projectmodel';

function MyComponent() {
  // Subscribe to events - it just works
  useEventListener(ProjectModel.instance, 'componentRenamed', (data) => {
    console.log('Component renamed:', data);
  });

  return <div>...</div>;
}
```

---

## The Problem

EventDispatcher uses a context-object pattern for cleanup:

```typescript
// How EventDispatcher works internally
model.on('event', callback, contextObject); // Subscribe
model.off(contextObject); // Unsubscribe by context
```

React's closure-based lifecycle is incompatible with this:

```typescript
// ❌ This compiles, runs without errors, but SILENTLY FAILS
useEffect(() => {
  const context = {};
  ProjectModel.instance.on('event', handler, context);
  return () => ProjectModel.instance.off(context); // Context reference doesn't match!
}, []);
```

The event is never received. No errors. Complete silence. Hours of debugging.

---

## The Solution

The `useEventListener` hook handles all the complexity:

```typescript
// ✅ This actually works
useEventListener(ProjectModel.instance, 'event', handler);
```

Internally, the hook:

1. Uses `useRef` to maintain a stable callback reference
2. Creates a unique group object per subscription
3. Properly cleans up on unmount
4. Updates the callback without re-subscribing

---

## API Reference

### Basic Usage

```typescript
useEventListener(dispatcher, eventName, callback);
```

| Parameter    | Type                          | Description                   |
| ------------ | ----------------------------- | ----------------------------- |
| `dispatcher` | `IEventEmitter \| null`       | The EventDispatcher instance  |
| `eventName`  | `string \| string[]`          | Event name(s) to subscribe to |
| `callback`   | `(data?, eventName?) => void` | Handler function              |

### With Multiple Events

```typescript
useEventListener(
  ProjectModel.instance,
  ['componentAdded', 'componentRemoved', 'componentRenamed'],
  (data, eventName) => {
    console.log(`${eventName}:`, data);
  }
);
```

### With Dependencies

Re-subscribe when dependencies change:

```typescript
const [filter, setFilter] = useState('all');

useEventListener(
  ProjectModel.instance,
  'componentAdded',
  (data) => {
    // Uses current filter value
    if (matchesFilter(data, filter)) {
      // ...
    }
  },
  [filter] // Re-subscribe when filter changes
);
```

### Conditional Subscription

Pass `null` to disable:

```typescript
useEventListener(isEnabled ? ProjectModel.instance : null, 'event', handler);
```

---

## Common Patterns

### Pattern 1: Trigger Re-render on Changes

```typescript
function useProjectData() {
  const [updateCounter, setUpdateCounter] = useState(0);

  useEventListener(ProjectModel.instance, ['componentAdded', 'componentRemoved', 'componentRenamed'], () =>
    setUpdateCounter((c) => c + 1)
  );

  // Data recomputes when updateCounter changes
  const data = useMemo(() => {
    return computeFromProject(ProjectModel.instance);
  }, [updateCounter]);

  return data;
}
```

### Pattern 2: Sync State with Model

```typescript
function WarningsPanel() {
  const [warnings, setWarnings] = useState([]);

  useEventListener(WarningsModel.instance, 'warningsChanged', () => {
    setWarnings(WarningsModel.instance.getWarnings());
  });

  return <WarningsList warnings={warnings} />;
}
```

### Pattern 3: Side Effects

```typescript
function AutoSaver() {
  useEventListener(
    ProjectModel.instance,
    'settingsChanged',
    debounce(() => {
      ProjectModel.instance.save();
    }, 1000)
  );

  return null;
}
```

---

## Available Dispatchers

| Instance                   | Common Events                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `ProjectModel.instance`    | componentAdded, componentRemoved, componentRenamed, rootNodeChanged, settingsChanged |
| `NodeLibrary.instance`     | libraryUpdated, moduleRegistered, moduleUnregistered                                 |
| `WarningsModel.instance`   | warningsChanged                                                                      |
| `UndoQueue.instance`       | undoHistoryChanged                                                                   |
| `EventDispatcher.instance` | Model.\*, viewer-refresh, ProjectModel.instanceHasChanged                            |

---

## Debugging

### Verify Events Are Received

```typescript
useEventListener(ProjectModel.instance, 'componentRenamed', (data) => {
  console.log('🔔 Event received:', data); // Should appear in console
  // ... your handler
});
```

### If Events Aren't Received

1. **Check event name:** Spelling matters. Use the exact string.
2. **Check dispatcher instance:** Is it `null`? Is it the right singleton?
3. **Check webpack cache:** Run `npm run clean:all` and restart
4. **Check if component mounted:** Add a console.log in the component body

### Verify Cleanup

Watch for this error (indicates cleanup failed):

```
Warning: Can't perform a React state update on an unmounted component
```

If you see it, the cleanup isn't working. Check that you're using `useEventListener`, not manual `.on()/.off()`.

---

## Anti-Patterns

### ❌ Direct .on() in useEffect

```typescript
// BROKEN - Will compile but events never received
useEffect(() => {
  ProjectModel.instance.on('event', handler, {});
  return () => ProjectModel.instance.off({});
}, []);
```

### ❌ Manual forceRefresh Callbacks

```typescript
// WORKS but creates tech debt
const forceRefresh = useCallback(() => setCounter((c) => c + 1), []);
performAction(data, forceRefresh); // Must thread through everywhere
```

### ❌ Class Component Style

```typescript
// DOESN'T WORK in functional components
this.model.on('event', this.handleEvent, this);
```

---

## Migration Guide

Converting existing broken code:

### Before

```typescript
function MyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const listener = {};
    ProjectModel.instance.on('componentRenamed', (d) => setData(d), listener);
    return () => ProjectModel.instance.off(listener);
  }, []);

  return <div>{data}</div>;
}
```

### After

```typescript
import { useEventListener } from '@noodl-hooks/useEventListener';

function MyComponent() {
  const [data, setData] = useState(null);

  useEventListener(ProjectModel.instance, 'componentRenamed', setData);

  return <div>{data}</div>;
}
```

---

## History

- **Discovered:** 2025-12-22 during TASK-004B (ComponentsPanel React Migration)
- **Investigated:** TASK-008 (EventDispatcher React Investigation)
- **Verified:** TASK-010 (EventListener Verification)
- **Documented:** TASK-011 (This document)

The root cause is a fundamental incompatibility between EventDispatcher's context-object cleanup pattern and React's closure-based lifecycle. The `useEventListener` hook bridges this gap.
