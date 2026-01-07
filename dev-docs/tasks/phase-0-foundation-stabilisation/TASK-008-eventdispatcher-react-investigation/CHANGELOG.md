# TASK-008: EventDispatcher + React Hooks Investigation - CHANGELOG

## 2025-12-22 - Solution Implemented ✅

### Root Cause Identified

**The Problem**: EventDispatcher's context-object-based cleanup pattern is incompatible with React's closure-based lifecycle.

**Technical Details**:

- EventDispatcher uses `on(event, listener, group)` and `off(group)`
- React's useEffect creates new closures on every render
- The `group` object reference used in cleanup doesn't match the one from subscription
- This prevents proper cleanup AND somehow blocks event delivery entirely

### Solution: `useEventListener` Hook

Created a React-friendly hook at `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts` that:

1. **Prevents Stale Closures**: Uses `useRef` to store callback, updated on every render
2. **Stable Group Reference**: Creates unique group object per subscription
3. **Automatic Cleanup**: Returns cleanup function that React can properly invoke
4. **Flexible Types**: Accepts EventDispatcher, Model subclasses, or any IEventEmitter

### Changes Made

#### 1. Created `useEventListener` Hook

**File**: `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts`

- Main hook: `useEventListener(dispatcher, eventName, callback, deps?)`
- Convenience wrapper: `useEventListenerMultiple(dispatcher, eventNames, callback, deps?)`
- Supports both single events and arrays of events
- Optional dependency array for conditional re-subscription

#### 2. Updated ComponentsPanel

**Files**:

- `hooks/useComponentsPanel.ts`: Replaced manual subscription with `useEventListener`
- `ComponentsPanelReact.tsx`: Removed `forceRefresh` workaround
- `hooks/useComponentActions.ts`: Removed `onSuccess` callback parameter

**Before** (manual workaround):

```typescript
const [updateCounter, setUpdateCounter] = useState(0);

useEffect(() => {
  const listener = { handleUpdate };
  ProjectModel.instance.on('componentRenamed', () => handleUpdate('componentRenamed'), listener);
  return () => ProjectModel.instance.off(listener);
}, []);

const forceRefresh = useCallback(() => {
  setUpdateCounter((c) => c + 1);
}, []);

// In actions: performRename(item, name, () => forceRefresh());
```

**After** (clean solution):

```typescript
useEventListener(
  ProjectModel.instance,
  ['componentAdded', 'componentRemoved', 'componentRenamed', 'rootNodeChanged'],
  () => {
    setUpdateCounter((c) => c + 1);
  }
);

// In actions: performRename(item, name);  // Events handled automatically!
```

### Benefits

✅ **No More Manual Callbacks**: Events are properly received automatically
✅ **No Tech Debt**: Removed workaround pattern from ComponentsPanel
✅ **Reusable Solution**: Hook works for any EventDispatcher-based model
✅ **Type Safe**: Proper TypeScript types with interface matching
✅ **Scalable**: Can be used by all 56+ React components that need event subscriptions

### Testing

Verified that:

- ✅ Component rename updates UI immediately
- ✅ Folder rename updates UI immediately
- ✅ No stale closure issues
- ✅ Proper cleanup on unmount
- ✅ TypeScript compilation successful

### Impact

**Immediate**:

- ComponentsPanel now works correctly without workarounds
- Sets pattern for future React migrations

**Future**:

- 56+ existing React component subscriptions can be migrated to use this hook
- Major architectural improvement for jQuery View → React migrations
- Removes blocker for migrating more panels to React

### Files Modified

1. **Created**:

   - `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts`

2. **Updated**:
   - `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`
   - `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanelReact.tsx`
   - `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentActions.ts`

### Next Steps

1. ✅ Document pattern in LEARNINGS.md
2. ⬜ Create usage guide for other React components
3. ⬜ Consider migrating other components to use useEventListener
4. ⬜ Evaluate long-term migration to modern state management (Zustand/Redux)

---

## Investigation Summary

**Time Spent**: ~2 hours
**Status**: ✅ RESOLVED
**Solution Type**: React Bridge Hook (Solution 2 from POTENTIAL-SOLUTIONS.md)
