# TASK-010: EventListener Verification

## Status: 🚧 READY FOR USER TESTING

## Summary

Verify that the `useEventListener` hook works correctly with EventDispatcher-based models (like ProjectModel). This validates the React + EventDispatcher integration pattern before using it throughout the codebase.

## Background

During TASK-004B (ComponentsPanel migration), we discovered that direct EventDispatcher subscriptions from React components fail silently. Events are emitted but never received due to incompatibility between React's closure-based lifecycle and EventDispatcher's context-object cleanup pattern.

The `useEventListener` hook was created to solve this, but it needs verification before proceeding.

## Prerequisites

✅ TASK-009 must be complete (cache fixes ensure we're testing fresh code)

## Hook Status

✅ **Hook exists:** `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts`
✅ **Hook has debug logging:** Console logs will show subscription/unsubscription
✅ **Test component ready:** `EventListenerTest.tsx` in this directory

## Verification Steps

### Step 1: Add Test Component to Editor

The test component needs to be added somewhere visible in the editor UI.

**Recommended location:** Add to the main Router component temporarily.

**File:** `packages/noodl-editor/src/editor/src/router.tsx` (or similar)

**Add import:**

```typescript
import { EventListenerTest } from '../../tasks/phase-0-foundation-stabalisation/TASK-010-eventlistener-verification/EventListenerTest';
```

**Add to JSX:**

```tsx
render() {
  return (
    <div>
      {/* Existing router content */}

      {/* TEMPORARY: Phase 0 verification */}
      <EventListenerTest />
    </div>
  );
}
```

### Step 2: Run the Editor

```bash
npm run clean:all  # Clear caches first
npm run dev        # Start editor
```

### Step 3: Verify Hook Subscription

1. Open DevTools Console
2. Look for these logs:

```
🔥🔥🔥 useEventListener.ts MODULE LOADED WITH DEBUG LOGS - Version 2.0 🔥🔥🔥
📡 useEventListener subscribing to: componentRenamed on dispatcher: [ProjectModel]
📡 useEventListener subscribing to: ["componentAdded", "componentRemoved"] ...
📡 useEventListener subscribing to: rootNodeChanged ...
```

✅ **SUCCESS:** If you see these logs, subscriptions are working

❌ **FAILURE:** If no subscription logs appear, the hook isn't being called

### Step 4: Test Manual Event Trigger

1. Click **"🧪 Trigger Test Event"** button in the test panel
2. Check console for:

```
🧪 Manually triggering componentRenamed event...
🔔 useEventListener received event: componentRenamed data: {...}
```

3. Check test panel - should show event in log

✅ **SUCCESS:** Event appears in both console and test panel
❌ **FAILURE:** No event received = hook not working

### Step 5: Test Real Events

1. In the Noodl editor, rename a component in the component tree
2. Check console for:

```
🔔 useEventListener received event: componentRenamed data: {oldName: ..., newName: ...}
```

3. Check test panel - should show the rename event

✅ **SUCCESS:** Real events are received
❌ **FAILURE:** No event = EventDispatcher not emitting or hook not subscribed

### Step 6: Test Component Add/Remove

1. Add a new component to the tree
2. Remove a component
3. Check that events appear in both console and test panel

### Step 7: Clean Up

Once verification is complete:

```typescript
// Remove from router.tsx
- import { EventListenerTest } from '...';
- <EventListenerTest />
```

## Troubleshooting

### No Subscription Logs Appear

**Problem:** Hook never subscribes

**Solutions:**

1. Verify EventListenerTest component is actually rendered
2. Check React DevTools - is component in the tree?
3. Verify import paths are correct
4. Run `npm run clean:all` and restart

### Subscription Logs But No Events Received

**Problem:** Hook subscribes but events don't arrive

**Solutions:**

1. Check if ProjectModel.instance exists: Add this to console:

```javascript
console.log('ProjectModel:', window.require('@noodl-models/projectmodel').ProjectModel);
```

2. Verify EventDispatcher is emitting events:

```javascript
// In ProjectModel code
this.notifyListeners('componentRenamed', data); // Should see this
```

3. Check for errors in console

### Events Work in Test But Not in Real Components

**Problem:** Test component works but other components don't receive events

**Cause:** Other components might be using direct `.on()` subscriptions instead of the hook

**Solution:** Those components need to be migrated to use `useEventListener`

## Expected Outcomes

After successful verification:

✅ Hook subscribes correctly (logs appear)
✅ Manual trigger event received
✅ Real component rename events received
✅ Component add/remove events received
✅ No errors in console
✅ Events appear in test panel

## Next Steps After Verification

1. **If all tests pass:**

   - Mark TASK-010 as complete
   - Proceed to TASK-011 (Documentation)
   - Use this pattern for all React + EventDispatcher integrations

2. **If tests fail:**
   - Debug the hook implementation
   - Check EventDispatcher compatibility
   - May need to create alternative solution

## Files Modified

- None (only adding temporary test component)

## Files to Check

- `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts` (hook implementation)
- `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-010-eventlistener-verification/EventListenerTest.tsx` (test component)

## Documentation References

- **Investigation:** `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-008-eventdispatcher-react-investigation/`
- **Pattern Guide:** Will be created in TASK-011
- **Learnings:** Add findings to `dev-docs/reference/LEARNINGS.md`

## Success Criteria

- [x] useEventListener hook exists and is properly exported
- [x] Test component created
- [ ] Test component added to editor UI
- [ ] Hook subscription logs appear in console
- [ ] Manual test event received
- [ ] Real component rename event received
- [ ] Component add/remove events received
- [ ] No errors or warnings
- [ ] Test component removed after verification

## Time Estimate

**Expected:** 1-2 hours (including testing and potential debugging)
**If problems found:** +2-4 hours for debugging/fixes
