# Potential Solutions: EventDispatcher + React Hooks

This document outlines potential solutions to the EventDispatcher incompatibility with React hooks.

---

## Solution 1: Fix EventDispatcher for React Compatibility

### Overview

Modify EventDispatcher to be compatible with React's lifecycle and closure patterns.

### Approach

1. **Remove context object requirement for React**:

   - Add a new subscription method that doesn't require context matching
   - Use WeakMap to track subscriptions by callback reference
   - Auto-cleanup when callback is garbage collected

2. **Stable callback references**:
   - Store callbacks with stable IDs
   - Allow re-subscription with same ID to update callback

### Implementation Sketch

```typescript
class EventDispatcher {
  private listeners: Map<string, Array<{ callback: Function; context?: any; id?: string }>>;
  private nextId = 0;

  // New React-friendly subscription
  onReact(event: string, callback: Function): () => void {
    const id = `react_${this.nextId++}`;

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event).push({ callback, id });

    // Return cleanup function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (!eventListeners) return;
      this.listeners.set(
        event,
        eventListeners.filter((l) => l.id !== id)
      );
    };
  }

  // Existing methods remain for backward compatibility
  on(event: string, callback: Function, context?: any) {
    // ... existing implementation
  }
}
```

### Usage in React

```typescript
useEffect(() => {
  const cleanup = ProjectModel.instance.onReact('componentRenamed', () => {
    setUpdateCounter((c) => c + 1);
  });

  return cleanup;
}, []);
```

### Pros

- ✅ Minimal changes to existing code
- ✅ Backward compatible (doesn't break existing Views)
- ✅ Clean React-friendly API
- ✅ Automatic cleanup

### Cons

- ❌ Doesn't explain WHY current implementation fails
- ❌ Adds complexity to EventDispatcher
- ❌ Maintains legacy pattern (not modern state management)
- ❌ Still have two different APIs (confusing)

### Effort

**Estimated**: 4-8 hours

- 2 hours: Implement onReact method
- 2 hours: Test with existing components
- 2 hours: Update React components to use new API
- 2 hours: Documentation

---

## Solution 2: React Bridge Wrapper

### Overview

Create a React-specific hook that wraps EventDispatcher subscriptions.

### Implementation

```typescript
// hooks/useEventListener.ts
export function useEventListener<T = any>(
  dispatcher: EventDispatcher,
  eventName: string,
  callback: (data?: T) => void
) {
  const callbackRef = useRef(callback);

  // Update ref on every render (avoid stale closures)
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    // Wrapper that calls current ref
    const wrapper = (data?: T) => {
      callbackRef.current(data);
    };

    // Create stable context object
    const context = { id: Math.random() };

    dispatcher.on(eventName, wrapper, context);

    return () => {
      dispatcher.off(eventName, context);
    };
  }, [dispatcher, eventName]);
}
```

### Usage

```typescript
function ComponentsPanel() {
  const [updateCounter, setUpdateCounter] = useState(0);

  useEventListener(ProjectModel.instance, 'componentRenamed', () => {
    setUpdateCounter((c) => c + 1);
  });

  // ... rest of component
}
```

### Pros

- ✅ Clean React API
- ✅ No changes to EventDispatcher
- ✅ Reusable across all React components
- ✅ Handles closure issues with useRef pattern

### Cons

- ❌ Still uses legacy EventDispatcher internally
- ❌ Adds indirection
- ❌ Doesn't fix the root cause

### Effort

**Estimated**: 2-4 hours

- 1 hour: Implement hook
- 1 hour: Test thoroughly
- 1 hour: Update existing React components
- 1 hour: Documentation

---

## Solution 3: Migrate to Modern State Management

### Overview

Replace EventDispatcher with a modern React state management solution.

### Option 3A: React Context + useReducer

```typescript
// contexts/ProjectContext.tsx
interface ProjectState {
  components: Component[];
  folders: Folder[];
  version: number; // Increment on any change
}

const ProjectContext = createContext<{
  state: ProjectState;
  actions: {
    renameComponent: (id: string, name: string) => void;
    addComponent: (component: Component) => void;
    removeComponent: (id: string) => void;
  };
}>(null!);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const actions = useMemo(
    () => ({
      renameComponent: (id: string, name: string) => {
        dispatch({ type: 'RENAME_COMPONENT', id, name });
        ProjectModel.instance.renameComponent(id, name); // Sync with legacy
      }
      // ... other actions
    }),
    []
  );

  return <ProjectContext.Provider value={{ state, actions }}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  return useContext(ProjectContext);
}
```

### Option 3B: Zustand

```typescript
// stores/projectStore.ts
import create from 'zustand';

interface ProjectStore {
  components: Component[];
  folders: Folder[];

  renameComponent: (id: string, name: string) => void;
  addComponent: (component: Component) => void;
  removeComponent: (id: string) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  components: [],
  folders: [],

  renameComponent: (id, name) => {
    set((state) => ({
      components: state.components.map((c) => (c.id === id ? { ...c, name } : c))
    }));
    ProjectModel.instance.renameComponent(id, name); // Sync with legacy
  }

  // ... other actions
}));
```

### Option 3C: Redux Toolkit

```typescript
// slices/projectSlice.ts
import { createSlice } from '@reduxjs/toolkit';

const projectSlice = createSlice({
  name: 'project',
  initialState: {
    components: [],
    folders: []
  },
  reducers: {
    renameComponent: (state, action) => {
      const component = state.components.find((c) => c.id === action.payload.id);
      if (component) {
        component.name = action.payload.name;
      }
    }
    // ... other actions
  }
});

export const { renameComponent } = projectSlice.actions;
```

### Pros

- ✅ Modern, React-native solution
- ✅ Better developer experience
- ✅ Time travel debugging (Redux DevTools)
- ✅ Predictable state updates
- ✅ Scales well for complex state

### Cons

- ❌ Major architectural change
- ❌ Need to sync with legacy ProjectModel
- ❌ High migration effort
- ❌ All React components need updating
- ❌ Risk of state inconsistencies during transition

### Effort

**Estimated**: 2-4 weeks

- Week 1: Set up state management, create stores
- Week 1-2: Implement sync layer with legacy models
- Week 2-3: Migrate all React components
- Week 3-4: Testing and bug fixes

---

## Solution 4: Proxy-based Reactive System

### Overview

Create a reactive wrapper around ProjectModel that React can subscribe to.

### Implementation

```typescript
// utils/createReactiveModel.ts
import { useSyncExternalStore } from 'react';

export function createReactiveModel<T extends EventDispatcher>(model: T) {
  const subscribers = new Set<() => void>();
  let version = 0;

  // Listen to ALL events from the model
  const eventProxy = new Proxy(model, {
    get(target, prop) {
      const value = target[prop];

      if (prop === 'notifyListeners') {
        return (...args: any[]) => {
          // Call original
          value.apply(target, args);

          // Notify React subscribers
          version++;
          subscribers.forEach((callback) => callback());
        };
      }

      return value;
    }
  });

  return {
    model: eventProxy,
    subscribe: (callback: () => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    getSnapshot: () => version
  };
}

// Usage hook
export function useModelChanges(reactiveModel: ReturnType<typeof createReactiveModel>) {
  return useSyncExternalStore(reactiveModel.subscribe, reactiveModel.getSnapshot, reactiveModel.getSnapshot);
}
```

### Usage

```typescript
// Create reactive wrapper once
const reactiveProject = createReactiveModel(ProjectModel.instance);

// In component
function ComponentsPanel() {
  const version = useModelChanges(reactiveProject);

  const treeData = useMemo(() => {
    return buildTree(reactiveProject.model);
  }, [version]);

  // ... rest of component
}
```

### Pros

- ✅ Uses React 18's built-in external store API
- ✅ No changes to EventDispatcher or ProjectModel
- ✅ Automatic subscription management
- ✅ Works with any EventDispatcher-based model

### Cons

- ❌ Proxy overhead
- ❌ All events trigger re-render (no granularity)
- ❌ Requires React 18+
- ❌ Complex debugging

### Effort

**Estimated**: 1-2 days

- 4 hours: Implement reactive wrapper
- 4 hours: Test with multiple models
- 4 hours: Update React components
- 4 hours: Documentation and examples

---

## Solution 5: Manual Callbacks (Current Workaround)

### Overview

Continue using manual refresh callbacks as implemented in Task 004B.

### Pattern

```typescript
// Hook provides forceRefresh
const forceRefresh = useCallback(() => {
  setUpdateCounter((c) => c + 1);
}, []);

// Actions accept onSuccess callback
function performAction(data: any, onSuccess?: () => void) {
  // ... do work ...
  if (success && onSuccess) {
    onSuccess();
  }
}

// Component wires them together
performAction(data, () => {
  forceRefresh();
});
```

### Pros

- ✅ Already implemented and working
- ✅ Zero architectural changes
- ✅ Simple to understand
- ✅ Explicit control over refreshes

### Cons

- ❌ Tech debt accumulates
- ❌ Easy to forget callback in new code paths
- ❌ Not scalable for complex event chains
- ❌ Loses reactive benefits

### Effort

**Estimated**: Already done

- No additional work needed
- Just document the pattern

---

## Recommendation

### Short-term (0-1 month): Solution 2 - React Bridge Wrapper

Implement `useEventListener` hook to provide clean API for existing event subscriptions.

**Why**:

- Low effort, high value
- Fixes immediate problem
- Doesn't block future migrations
- Can coexist with manual callbacks

### Medium-term (1-3 months): Solution 4 - Proxy-based Reactive System

Implement reactive model wrappers using `useSyncExternalStore`.

**Why**:

- Uses modern React patterns
- Minimal changes to existing code
- Works with legacy models
- Provides automatic reactivity

### Long-term (3-6 months): Solution 3 - Modern State Management

Gradually migrate to Zustand or Redux Toolkit.

**Why**:

- Best developer experience
- Scales well
- Standard patterns
- Better tooling

### Migration Path

1. **Phase 1** (Week 1-2):
   - Implement `useEventListener` hook
   - Update ComponentsPanel to use it
   - Document pattern
2. **Phase 2** (Month 2):
   - Implement reactive model system
   - Test with multiple components
   - Roll out gradually
3. **Phase 3** (Month 3-6):
   - Choose state management library
   - Create stores for major models
   - Migrate components one by one
   - Maintain backward compatibility

---

## Decision Criteria

Choose solution based on:

1. **Timeline**: How urgently do we need React components?
2. **Scope**: How many Views are we migrating to React?
3. **Resources**: How much dev time is available?
4. **Risk tolerance**: Can we handle breaking changes?
5. **Long-term vision**: Are we fully moving to React?

**If migrating many Views**: Invest in Solution 3 (state management)  
**If only a few React components**: Use Solution 2 (bridge wrapper)  
**If unsure**: Start with Solution 2, migrate to Solution 3 later

---

## Questions to Answer

Before deciding on a solution:

1. How many jQuery Views are planned to migrate to React?
2. What's the timeline for full React migration?
3. Are there performance concerns with current EventDispatcher?
4. What state management libraries are already in the codebase?
5. Is there team expertise with modern state management?
6. What's the testing infrastructure like?
7. Can we afford breaking changes during transition?

---

## Next Actions

1. ✅ Complete this investigation documentation
2. ⬜ Present options to team
3. ⬜ Decide on solution approach
4. ⬜ Create implementation task
5. ⬜ Test POC with ComponentsPanel
6. ⬜ Roll out to other components
