# Technical Notes: EventDispatcher + React Investigation

## Discovery Context

**Task**: TASK-004B ComponentsPanel React Migration, Phase 5 (Inline Rename)  
**Date**: 2025-12-22  
**Discovered by**: Debugging why rename UI wasn't updating after successful renames

---

## Detailed Timeline of Discovery

### Initial Problem

User renamed a component/folder in ComponentsPanel. The rename logic executed successfully:

- `performRename()` returned `true`
- ProjectModel showed the new name
- Project file saved to disk
- No errors in console

BUT: The UI didn't update to show the new name. The tree still displayed the old name until manual refresh.

### Investigation Steps

#### Step 1: Added Debug Logging

Added console.logs throughout the callback chain:

```typescript
// In RenameInput.tsx
const handleConfirm = () => {
  console.log('🎯 RenameInput: Confirming rename');
  onConfirm(value);
};

// In ComponentsPanelReact.tsx
onConfirm={(newName) => {
  console.log('📝 ComponentsPanelReact: Rename confirmed', { newName });
  const success = performRename(renamingItem, newName);
  console.log('✅ ComponentsPanelReact: Rename result:', success);
}}

// In useComponentActions.ts
export function performRename(...) {
  console.log('🔧 performRename: Starting', { item, newName });
  // ...
  console.log('✅ performRename: Success!');
  return true;
}
```

**Result**: All callbacks fired, logic worked, but UI didn't update.

#### Step 2: Checked Event Subscription

The `useComponentsPanel` hook had event subscription code:

```typescript
useEffect(() => {
  const handleUpdate = (eventName: string) => {
    console.log('🔔 useComponentsPanel: Event received:', eventName);
    setUpdateCounter((c) => c + 1);
  };

  const listener = { handleUpdate };

  ProjectModel.instance.on('componentAdded', () => handleUpdate('componentAdded'), listener);
  ProjectModel.instance.on('componentRemoved', () => handleUpdate('componentRemoved'), listener);
  ProjectModel.instance.on('componentRenamed', () => handleUpdate('componentRenamed'), listener);

  console.log('✅ useComponentsPanel: Event listeners registered');

  return () => {
    console.log('🧹 useComponentsPanel: Cleaning up event listeners');
    ProjectModel.instance.off('componentAdded', listener);
    ProjectModel.instance.off('componentRemoved', listener);
    ProjectModel.instance.off('componentRenamed', listener);
  };
}, []);
```

**Expected**: "🔔 useComponentsPanel: Event received: componentRenamed" log after rename

**Actual**: NOTHING. No event reception logs at all.

#### Step 3: Verified Event Emission

Added logging to ProjectModel.renameComponent():

```typescript
renameComponent(component, newName) {
  // ... do the rename ...
  console.log('📢 ProjectModel: Emitting componentRenamed event');
  this.notifyListeners('componentRenamed', { component, oldName, newName });
}
```

**Result**: Event WAS being emitted! The emit log appeared, but the React hook never received it.

#### Step 4: Tried Different Subscription Patterns

Attempted various subscription patterns to see if any worked:

**Pattern A: Direct function**

```typescript
ProjectModel.instance.on('componentRenamed', () => {
  console.log('Event received!');
  setUpdateCounter((c) => c + 1);
});
```

Result: ❌ No event received

**Pattern B: Named function**

```typescript
function handleRenamed() {
  console.log('Event received!');
  setUpdateCounter((c) => c + 1);
}
ProjectModel.instance.on('componentRenamed', handleRenamed);
```

Result: ❌ No event received

**Pattern C: With useCallback**

```typescript
const handleRenamed = useCallback(() => {
  console.log('Event received!');
  setUpdateCounter((c) => c + 1);
}, []);
ProjectModel.instance.on('componentRenamed', handleRenamed);
```

Result: ❌ No event received

**Pattern D: Without context object**

```typescript
ProjectModel.instance.on('componentRenamed', () => {
  console.log('Event received!');
});
// No third parameter (context object)
```

Result: ❌ No event received

**Pattern E: With useRef for stable reference**

```typescript
const listenerRef = useRef({ handleUpdate });
ProjectModel.instance.on('componentRenamed', listenerRef.current.handleUpdate, listenerRef.current);
```

Result: ❌ No event received

#### Step 5: Checked Legacy jQuery Views

Found that the old ComponentsPanel (jQuery-based View) subscribed to the same events:

```javascript
// In componentspanel/index.tsx (legacy)
this.projectModel.on('componentRenamed', this.onComponentRenamed, this);
```

**Question**: Does this work in the legacy View?  
**Answer**: YES! Legacy Views receive events perfectly fine.

This proved:

- The events ARE being emitted correctly
- The EventDispatcher itself works
- But something about React hooks breaks the subscription

### Conclusion: Fundamental Incompatibility

After exhaustive testing, the conclusion is clear:

**EventDispatcher's pub/sub pattern does NOT work with React hooks.**

Even though:

- ✅ Events are emitted (verified with logs)
- ✅ Subscriptions are registered (no errors)
- ✅ Code looks correct
- ✅ Works fine in legacy jQuery Views

The events simply never reach React hook callbacks. This appears to be a fundamental architectural incompatibility.

---

## Workaround Implementation

Since event subscription doesn't work, implemented manual refresh callback pattern:

### Step 1: Add forceRefresh Function

In `useComponentsPanel.ts`:

```typescript
const [updateCounter, setUpdateCounter] = useState(0);

const forceRefresh = useCallback(() => {
  console.log('🔄 Manual refresh triggered');
  setUpdateCounter((c) => c + 1);
}, []);

return {
  // ... other exports
  forceRefresh
};
```

### Step 2: Add onSuccess Parameter

In `useComponentActions.ts`:

```typescript
export function performRename(
  item: TreeItem,
  newName: string,
  onSuccess?: () => void // NEW: Success callback
): boolean {
  // ... do the rename ...

  if (success && onSuccess) {
    console.log('✅ Calling onSuccess callback');
    onSuccess();
  }

  return success;
}
```

### Step 3: Wire Through Component

In `ComponentsPanelReact.tsx`:

```typescript
const success = performRename(renamingItem, renameValue, () => {
  console.log('✅ Rename success callback - calling forceRefresh');
  forceRefresh();
});
```

### Step 4: Use Counter as Dependency

In `useComponentsPanel.ts`:

```typescript
const treeData = useMemo(() => {
  console.log('🔄 Rebuilding tree (updateCounter:', updateCounter, ')');
  return buildTree(ProjectModel.instance);
}, [updateCounter]); // Re-build when counter changes
```

### Bug Found: Missing Callback in Folder Rename

The folder rename branch didn't call `onSuccess()`:

```typescript
// BEFORE (bug):
if (item.type === 'folder') {
  const undoGroup = new UndoGroup();
  // ... rename logic ...
  undoGroup.do();
  return true;  // ❌ Didn't call onSuccess!
}

// AFTER (fixed):
if (item.type === 'folder') {
  const undoGroup = new UndoGroup();
  // ... rename logic ...
  undoGroup.do();

  // Call success callback to trigger UI refresh
  if (onSuccess) {
    onSuccess();
  }

  return true;  // ✅ Now triggers refresh
}
```

This bug meant folder renames didn't update the UI, but component renames did.

---

## EventDispatcher Implementation Details

From examining `EventDispatcher.ts`:

### How Listeners Are Stored

```typescript
class EventDispatcher {
  private listeners: Map<string, Array<{ callback: Function; context: any }>>;

  on(event: string, callback: Function, context?: any) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({ callback, context });
  }

  off(event: string, context?: any) {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    // Remove listeners matching the context object
    this.listeners.set(
      event,
      eventListeners.filter((l) => l.context !== context)
    );
  }
}
```

### How Events Are Emitted

```typescript
notifyListeners(event: string, data?: any) {
  const eventListeners = this.listeners.get(event);
  if (!eventListeners) return;

  // Call each listener
  for (const listener of eventListeners) {
    try {
      listener.callback.call(listener.context, data);
    } catch (e) {
      console.error('Error in event listener:', e);
    }
  }
}
```

### Potential Issues with React

1. **Context Object Matching**:

   - `off()` uses strict equality (`===`) to match context objects
   - React's useEffect cleanup may not have the same reference
   - Could prevent cleanup, leaving stale listeners

2. **Callback Invocation**:

   - Uses `.call(listener.context, data)` to invoke callbacks
   - If context is wrong, `this` binding might break
   - React doesn't rely on `this`, so this shouldn't matter...

3. **Timing**:
   - Events are emitted synchronously
   - React state updates are asynchronous
   - But setState in callbacks should work...

**Mystery**: Why don't the callbacks get invoked at all? The listeners should still be in the array, even if cleanup is broken.

---

## Hypotheses for Root Cause

### Hypothesis 1: React StrictMode Double-Invocation

React StrictMode (enabled in development) runs effects twice:

1. Mount → unmount → mount

This could:

- Register listener on first mount
- Remove listener on first unmount (wrong context?)
- Register listener again on second mount
- But now the old listener is gone?

**Test needed**: Try with StrictMode disabled

### Hypothesis 2: Context Object Reference Lost

```typescript
const listener = { handleUpdate };
ProjectModel.instance.on('event', handler, listener);
// Later in cleanup:
ProjectModel.instance.off('event', listener);
```

If the cleanup runs in a different closure, `listener` might be a new object, causing the filter in `off()` to not find the original listener.

But this would ACCUMULATE listeners, not prevent them from firing...

### Hypothesis 3: EventDispatcher Requires Legacy Context

EventDispatcher might have hidden dependencies on jQuery View infrastructure:

- Maybe it checks for specific properties on the context object?
- Maybe it integrates with View lifecycle somehow?
- Maybe there's initialization that React doesn't do?

**Test needed**: Deep dive into EventDispatcher implementation

### Hypothesis 4: React Rendering Phase Detection

React might be detecting that state updates are happening during render phase and silently blocking them. But our callbacks are triggered by user actions (renames), not during render...

---

## Comparison with Working jQuery Views

Legacy Views use EventDispatcher successfully:

```javascript
class ComponentsPanel extends View {
  init() {
    this.projectModel = ProjectModel.instance;
    this.projectModel.on('componentRenamed', this.onComponentRenamed, this);
  }

  onComponentRenamed() {
    this.render(); // Just re-render the whole view
  }

  dispose() {
    this.projectModel.off('componentRenamed', this);
  }
}
```

**Key differences**:

- Views have explicit `init()` and `dispose()` lifecycle
- Context object is `this` (the View instance), a stable reference
- Views use instance methods, not closures
- No dependency arrays or React lifecycle complexity

**Why it works**:

- The View instance is long-lived and stable
- Context object reference never changes
- Simple, predictable lifecycle

**Why React is different**:

- Functional components re-execute on every render
- Closures capture different variables each render
- useEffect cleanup might not match subscription
- No stable `this` reference

---

## Next Steps for Investigation

1. **Create minimal reproduction**:

   - Simplest EventDispatcher + React hook
   - Isolate the problem
   - Add extensive logging

2. **Test in isolation**:

   - React class component (has stable `this`)
   - Without StrictMode
   - Without other React features

3. **Examine EventDispatcher internals**:

   - Add logging to every method
   - Trace listener registration and invocation
   - Check what's in the listeners array

4. **Explore solutions**:
   - Can EventDispatcher be fixed?
   - Should we migrate to modern state management?
   - Is a React bridge possible?

---

## Workaround Pattern for Other Uses

If other React components need to react to ProjectModel changes, use this pattern:

```typescript
// 1. In hook, provide manual refresh
const [updateCounter, setUpdateCounter] = useState(0);
const forceRefresh = useCallback(() => {
  setUpdateCounter((c) => c + 1);
}, []);

// 2. Export forceRefresh
return { forceRefresh, /* other exports */ };

// 3. In action functions, accept onSuccess callback
function performAction(data: any, onSuccess?: () => void) {
  // ... do the action ...
  if (success && onSuccess) {
    onSuccess();
  }
}

// 4. In component, wire them together
performAction(data, () => {
  forceRefresh();
});

// 5. Use updateCounter as dependency
const derivedData = useMemo(() => {
  return computeData();
}, [updateCounter]);
```

**Critical**: Call `onSuccess()` in ALL code paths (success, different branches, etc.)

---

## Files Changed During Discovery

- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts` - Added forceRefresh
- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentActions.ts` - Added onSuccess callback
- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanelReact.tsx` - Wired forceRefresh through
- `dev-docs/reference/LEARNINGS.md` - Documented the discovery
- `dev-docs/tasks/phase-2/TASK-008-eventdispatcher-react-investigation/` - Created this investigation task

---

## Open Questions

1. Why don't the callbacks get invoked AT ALL? Even with broken cleanup, they should be in the listeners array...

2. Are there ANY React components successfully using EventDispatcher? (Need to search codebase)

3. Is this specific to ProjectModel, or do ALL EventDispatcher subclasses have this issue?

4. Does it work with React class components? (They have stable `this` reference)

5. What happens if we add extensive logging to EventDispatcher itself?

6. Is there something special about how ProjectModel emits events?

7. Could this be related to the Proxy pattern used in some models?

---

## References

- EventDispatcher: `packages/noodl-editor/src/editor/src/shared/utils/EventDispatcher.ts`
- ProjectModel: `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
- Working example (legacy View): `packages/noodl-editor/src/editor/src/views/panels/componentspanel/index.tsx`
- Workaround implementation: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/`
