# useEventListener Hook - Usage Guide

## Overview

The `useEventListener` hook provides a React-friendly way to subscribe to EventDispatcher events. It solves the fundamental incompatibility between EventDispatcher's context-object-based cleanup and React's closure-based lifecycle.

## Location

```typescript
import { useEventListener } from '@noodl-hooks/useEventListener';
```

**File**: `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts`

---

## Basic Usage

### Single Event

```typescript
import { ProjectModel } from '@noodl-models/projectmodel';

import { useEventListener } from '../../../../hooks/useEventListener';

function MyComponent() {
  const [updateCounter, setUpdateCounter] = useState(0);

  // Subscribe to a single event
  useEventListener(ProjectModel.instance, 'componentRenamed', () => {
    setUpdateCounter((c) => c + 1);
  });

  return <div>Components updated {updateCounter} times</div>;
}
```

### Multiple Events

```typescript
// Subscribe to multiple events with one subscription
useEventListener(ProjectModel.instance, ['componentAdded', 'componentRemoved', 'componentRenamed'], () => {
  console.log('Component changed');
  setUpdateCounter((c) => c + 1);
});
```

### With Event Data

```typescript
interface RenameData {
  component: ComponentModel;
  oldName: string;
  newName: string;
}

useEventListener<RenameData>(ProjectModel.instance, 'componentRenamed', (data) => {
  console.log(`Renamed from ${data.oldName} to ${data.newName}`);
  setUpdateCounter((c) => c + 1);
});
```

---

## Advanced Usage

### Conditional Subscription

Use the optional `deps` parameter to control when the subscription is active:

```typescript
const [isActive, setIsActive] = useState(true);

useEventListener(
  isActive ? ProjectModel.instance : null, // Pass null to disable
  'componentRenamed',
  () => {
    setUpdateCounter((c) => c + 1);
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
    // Callback uses current filter value
    if (shouldShowComponent(data.component, filter)) {
      addToList(data.component);
    }
  },
  [filter] // Re-subscribe when filter changes
);
```

### Multiple Dispatchers

```typescript
function MyComponent() {
  // Subscribe to ProjectModel events
  useEventListener(ProjectModel.instance, 'componentRenamed', handleProjectUpdate);

  // Subscribe to WarningsModel events
  useEventListener(WarningsModel.instance, 'warningsChanged', handleWarningsUpdate);

  // Subscribe to EventDispatcher singleton
  useEventListener(EventDispatcher.instance, 'viewer-refresh', handleViewerRefresh);
}
```

---

## Common Patterns

### Pattern 1: Trigger Re-render on Model Changes

```typescript
function useComponentsPanel() {
  const [updateCounter, setUpdateCounter] = useState(0);

  // Re-render whenever components change
  useEventListener(ProjectModel.instance, ['componentAdded', 'componentRemoved', 'componentRenamed'], () =>
    setUpdateCounter((c) => c + 1)
  );

  // This will re-compute whenever updateCounter changes
  const treeData = useMemo(() => {
    return buildTreeFromProject(ProjectModel.instance);
  }, [updateCounter]);

  return { treeData };
}
```

### Pattern 2: Update Local State from Events

```typescript
function WarningsPanel() {
  const [warnings, setWarnings] = useState([]);

  useEventListener(WarningsModel.instance, 'warningsChanged', () => {
    setWarnings(WarningsModel.instance.getWarnings());
  });

  return (
    <div>
      {warnings.map((warning) => (
        <WarningItem key={warning.id} warning={warning} />
      ))}
    </div>
  );
}
```

### Pattern 3: Side Effects on Events

```typescript
function AutoSaver() {
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEventListener(ProjectModel.instance, ['componentAdded', 'componentRemoved', 'componentRenamed'], () => {
    // Debounce saves
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      ProjectModel.instance.save();
    }, 1000);
  });

  return null;
}
```

---

## Migration from Manual Subscriptions

### Before (Broken)

```typescript
❌ // This doesn't work!
useEffect(() => {
  const listener = { handleUpdate };
  ProjectModel.instance.on('componentRenamed', () => handleUpdate(), listener);
  return () => ProjectModel.instance.off(listener);
}, []);
```

### After (Working)

```typescript
✅ // This works perfectly!
useEventListener(ProjectModel.instance, 'componentRenamed', () => {
  handleUpdate();
});
```

### Before (Workaround)

```typescript
❌ // Manual callback workaround
const [updateCounter, setUpdateCounter] = useState(0);

const forceRefresh = useCallback(() => {
  setUpdateCounter((c) => c + 1);
}, []);

const performAction = (data, onSuccess) => {
  // ... do action ...
  if (onSuccess) onSuccess(); // Manual refresh
};

// In component:
performAction(data, () => forceRefresh());
```

### After (Clean)

```typescript
✅ // Automatic event handling
const [updateCounter, setUpdateCounter] = useState(0);

useEventListener(ProjectModel.instance, 'actionCompleted', () => {
  setUpdateCounter((c) => c + 1);
});

const performAction = (data) => {
  // ... do action ...
  // Event fires automatically, no callbacks needed!
};
```

---

## Type Safety

The hook is fully typed and works with TypeScript:

```typescript
interface ComponentData {
  component: ComponentModel;
  oldName?: string;
  newName?: string;
}

// Type the event data
useEventListener<ComponentData>(ProjectModel.instance, 'componentRenamed', (data) => {
  // data is typed as ComponentData | undefined
  if (data) {
    console.log(data.component.name); // ✅ TypeScript knows this is safe
  }
});
```

---

## Supported Dispatchers

The hook works with any object that implements the `IEventEmitter` interface:

- ✅ `EventDispatcher` (and `EventDispatcher.instance`)
- ✅ `Model` subclasses (ProjectModel, WarningsModel, etc.)
- ✅ Any class with `on(event, listener, group)` and `off(group)` methods

---

## Best Practices

### ✅ DO:

- Use `useEventListener` for all EventDispatcher subscriptions in React components
- Pass `null` as dispatcher if you want to conditionally disable subscriptions
- Use the optional `deps` array when your callback depends on props/state
- Type your event data with the generic parameter for better IDE support

### ❌ DON'T:

- Don't try to use manual `on()`/`off()` subscriptions in React - they won't work
- Don't forget to handle `null` dispatchers if using conditional subscriptions
- Don't create new objects in the deps array - they'll cause infinite re-subscriptions
- Don't call `setState` directly inside event handlers without checking if component is mounted

---

## Troubleshooting

### Events Not Firing

**Problem**: Event subscription seems to work, but callback never fires.

**Solution**: Make sure you're using `useEventListener` instead of manual `on()`/`off()` calls.

### Stale Closure Issues

**Problem**: Callback uses old values of props/state.

**Solution**: The hook already handles this with `useRef`. If you still see issues, add dependencies to the `deps` array.

### Memory Leaks

**Problem**: Component unmounts but subscriptions remain.

**Solution**: The hook handles cleanup automatically. Make sure you're not holding references to the callback elsewhere.

### TypeScript Errors

**Problem**: "Type X is not assignable to EventDispatcher"

**Solution**: The hook accepts any `IEventEmitter`. Your model might need to properly extend `EventDispatcher` or `Model`.

---

## Examples in Codebase

See these files for real-world usage examples:

- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`
- (More examples as other components are migrated)

---

## Future Improvements

Potential enhancements for the future:

1. **Selective Re-rendering**: Only re-render when specific event data changes
2. **Event Filtering**: Built-in support for conditional event handling
3. **Debouncing**: Optional built-in debouncing for high-frequency events
4. **Event History**: Debug mode that tracks all received events

---

## Related Documentation

- [TASK-008 README](./README.md) - Investigation overview
- [CHANGELOG](./CHANGELOG.md) - Implementation details
- [NOTES](./NOTES.md) - Discovery process
- [LEARNINGS.md](../../../reference/LEARNINGS.md) - Lessons learned
