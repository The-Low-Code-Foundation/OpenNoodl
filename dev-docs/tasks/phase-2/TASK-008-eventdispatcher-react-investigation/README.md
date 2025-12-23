# TASK-008: EventDispatcher + React Hooks Investigation

## Status: 🟡 Investigation Needed

**Created**: 2025-12-22  
**Priority**: Medium  
**Complexity**: High

---

## Overview

During Task 004B (ComponentsPanel React Migration), we discovered that the legacy EventDispatcher pub/sub pattern does not work with React hooks. Events are emitted by legacy models but never received by React components subscribed in `useEffect`. This investigation task aims to understand the root cause and propose long-term solutions.

---

## Problem Statement

### What's Broken

When a React component subscribes to ProjectModel events using the EventDispatcher pattern:

```typescript
// In useComponentsPanel.ts
useEffect(() => {
  const handleUpdate = (eventName: string) => {
    console.log('🔔 Event received:', eventName);
    setUpdateCounter((c) => c + 1);
  };

  const listener = { handleUpdate };

  ProjectModel.instance.on('componentAdded', () => handleUpdate('componentAdded'), listener);
  ProjectModel.instance.on('componentRemoved', () => handleUpdate('componentRemoved'), listener);
  ProjectModel.instance.on('componentRenamed', () => handleUpdate('componentRenamed'), listener);

  return () => {
    ProjectModel.instance.off('componentAdded', listener);
    ProjectModel.instance.off('componentRemoved', listener);
    ProjectModel.instance.off('componentRenamed', listener);
  };
}, []);
```

**Expected behavior**: When `ProjectModel.renameComponent()` is called, it emits 'componentRenamed' event, and the React hook receives it.

**Actual behavior**:

- ProjectModel.renameComponent() DOES emit the event (verified with logs)
- The subscription code runs without errors
- BUT: The event handler is NEVER called
- No console logs, no state updates, complete silence

### Current Workaround

Manual refresh callback pattern (see NOTES.md for details):

1. Hook provides a `forceRefresh()` function that increments a counter
2. Action handlers accept an `onSuccess` callback parameter
3. Component passes `forceRefresh` as the callback
4. Successful actions call `onSuccess()` to trigger manual refresh

**Problem with workaround**:

- Creates tech debt
- Must remember to call `onSuccess()` in ALL code paths
- Doesn't scale to complex event chains
- Loses the benefits of reactive event-driven architecture

---

## Investigation Goals

### Primary Questions

1. **Why doesn't EventDispatcher work with React hooks?**

   - Is it a closure issue?
   - Is it a timing issue?
   - Is it the context object pattern?
   - Is it React's StrictMode double-invocation?

2. **What is the scope of the problem?**

   - Does it affect ALL React components?
   - Does it work in class components?
   - Does it work in legacy jQuery Views?
   - Are there any React components successfully using EventDispatcher?

3. **Is EventDispatcher fundamentally incompatible with React?**
   - Or can it be fixed?
   - What would need to change?

### Secondary Questions

4. **What are the migration implications?**

   - How many places use EventDispatcher?
   - How many are already React components?
   - How hard would migration be?

5. **What is the best long-term solution?**
   - Fix EventDispatcher?
   - Replace with modern state management?
   - Create a React bridge?

---

## Hypotheses

### Hypothesis 1: Context Object Reference Mismatch

EventDispatcher uses a context object for listener cleanup:

```typescript
model.on('event', handler, contextObject);
// Later:
model.off('event', contextObject); // Must be same object reference
```

React's useEffect cleanup may run in a different closure, causing the context object reference to not match, preventing proper cleanup and potentially blocking event delivery.

**How to test**: Try without context object, or use a stable ref.

### Hypothesis 2: Stale Closure

The handler function captures variables from the initial render. When the event fires later, those captured variables are stale, causing issues.

**How to test**: Use `useRef` to store the handler, update ref on every render.

### Hypothesis 3: Event Emission Timing

Events might be emitted before React components are ready to receive them, or during React's render phase when state updates are not allowed.

**How to test**: Add extensive timing logs, check React's render phase detection.

### Hypothesis 4: EventDispatcher Implementation Bug

The EventDispatcher itself may have issues with how it stores/invokes listeners, especially when mixed with React's lifecycle.

**How to test**: Deep dive into EventDispatcher.ts, add comprehensive logging.

---

## Test Plan

### Phase 1: Reproduce Minimal Case

Create the simplest possible reproduction:

1. Minimal EventDispatcher instance
2. Minimal React component with useEffect
3. Single event emission
4. Comprehensive logging at every step

### Phase 2: Comparative Testing

Test in different scenarios:

- React functional component with useEffect
- React class component with componentDidMount
- Legacy jQuery View
- React StrictMode on/off
- Development vs production build

### Phase 3: EventDispatcher Deep Dive

Examine EventDispatcher implementation:

- How are listeners stored?
- How are events emitted?
- How does context object matching work?
- Any special handling needed?

### Phase 4: Solution Prototyping

Test potential fixes:

- EventDispatcher modifications
- React bridge wrapper
- Migration to alternative patterns

---

## Success Criteria

This investigation is complete when we have:

1. ✅ Clear understanding of WHY events don't reach React hooks
2. ✅ Documented root cause with evidence
3. ✅ Evaluation of all potential solutions
4. ✅ Recommendation for long-term fix
5. ✅ Proof-of-concept implementation (if feasible)
6. ✅ Migration plan (if solution requires changes)

---

## Affected Areas

### Current Known Issues

- ✅ **ComponentsPanel**: Uses workaround (Task 004B)

### Potential Future Issues

Any React component that needs to:

- Subscribe to ProjectModel events
- Subscribe to NodeGraphModel events
- Subscribe to any EventDispatcher-based model
- React to data changes from legacy systems

### Estimated Impact

- **High**: If we continue migrating jQuery Views to React
- **Medium**: If we keep jQuery Views and only use React for new features
- **Low**: If we migrate away from EventDispatcher entirely

---

## Related Documentation

- [LEARNINGS.md](../../../reference/LEARNINGS.md#2025-12-22---eventdispatcher-events-dont-reach-react-hooks)
- [Task 004B Phase 5](../TASK-004B-componentsPanel-react-migration/phases/PHASE-5-INLINE-RENAME.md)
- EventDispatcher implementation: `packages/noodl-editor/src/editor/src/shared/utils/EventDispatcher.ts`
- Example workaround: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentActions.ts`

---

## Timeline

**Status**: Not started  
**Estimated effort**: 1-2 days investigation + 2-4 days implementation (depending on solution)  
**Blocking**: No other tasks currently blocked  
**Priority**: Should be completed before migrating more Views to React
