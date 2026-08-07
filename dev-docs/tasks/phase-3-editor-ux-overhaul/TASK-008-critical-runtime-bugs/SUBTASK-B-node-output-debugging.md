# SUBTASK-B: Debug & Fix Expression/Function Node Outputs

**Parent Task:** TASK-008  
**Status:** 🔴 Not Started  
**Priority:** CRITICAL  
**Estimated Effort:** 3-5 hours

---

## Problem

Expression and Function nodes evaluate/run but don't send output data to connected downstream nodes, breaking core functionality.

---

## Affected Nodes

1. **Expression Node** (`packages/noodl-runtime/src/nodes/std-library/expression.js`)
2. **Function Node** (`packages/noodl-runtime/src/nodes/std-library/simplejavascript.js`)

Both nodes share similar output mechanisms, suggesting a common underlying issue.

---

## Investigation Strategy

This is a **debugging task** - the root cause is unknown. We'll use systematic investigation to narrow down the issue.

### Phase 1: Minimal Reproduction 🔍

Create the simplest possible test case:

1. **Expression Node Test:**

   - Create Expression node with `1 + 1`
   - Connect output to Text node
   - Expected: Text shows "2"
   - Actual: Text shows nothing or old value

2. **Function Node Test:**
   - Create Function node with `Outputs.result = 42;`
   - Connect output to Text node
   - Expected: Text shows "42"
   - Actual: Text shows nothing or old value

**Document:**

- Exact steps to reproduce
- Screenshots of node graph
- Console output
- Any error messages

---

### Phase 2: Add Debug Logging 🔬

Add strategic console.log statements to trace execution flow.

#### Expression Node Logging

**File:** `packages/noodl-runtime/src/nodes/std-library/expression.js`

**Location 1 - Input Change:**

```javascript
// Line ~50, in expression input set()
set: function (value) {
  console.log('🟢 [Expression] Input changed:', value);
  var internal = this._internal;
  internal.currentExpression = functionPreamble + 'return (' + value + ');';
  // ... rest of code
  if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
}
```

**Location 2 - Schedule:**

```javascript
// Line ~220, _scheduleEvaluateExpression
_scheduleEvaluateExpression: {
  value: function () {
    console.log('🔵 [Expression] Schedule evaluation called');
    var internal = this._internal;
    if (internal.hasScheduledEvaluation === false) {
      console.log('🔵 [Expression] Scheduling callback');
      internal.hasScheduledEvaluation = true;
      this.flagDirty();
      this.scheduleAfterInputsHaveUpdated(function () {
        console.log('🔥 [Expression] Callback FIRED');
        var lastValue = internal.cachedValue;
        internal.cachedValue = this._calculateExpression();
        console.log('🔥 [Expression] Calculated:', internal.cachedValue, 'Previous:', lastValue);
        if (lastValue !== internal.cachedValue) {
          console.log('🚩 [Expression] Flagging outputs dirty');
          this.flagOutputDirty('result');
          this.flagOutputDirty('isTrue');
          this.flagOutputDirty('isFalse');
        }
        if (internal.cachedValue) this.sendSignalOnOutput('isTrueEv');
        else this.sendSignalOnOutput('isFalseEv');
        internal.hasScheduledEvaluation = false;
      });
    } else {
      console.log('⚠️ [Expression] Already scheduled, skipping');
    }
  }
}
```

**Location 3 - Output Getter:**

```javascript
// Line ~145, result output getter
result: {
  group: 'Result',
  type: '*',
  displayName: 'Result',
  getter: function () {
    console.log('📤 [Expression] Result getter called, returning:', this._internal.cachedValue);
    if (!this._internal.currentExpression) {
      return 0;
    }
    return this._internal.cachedValue;
  }
}
```

#### Function Node Logging

**File:** `packages/noodl-runtime/src/nodes/std-library/simplejavascript.js`

**Location 1 - Schedule:**

```javascript
// Line ~100, scheduleRun method
scheduleRun: function () {
  console.log('🔵 [Function] Schedule run called');
  if (this.runScheduled) {
    console.log('⚠️ [Function] Already scheduled, skipping');
    return;
  }
  this.runScheduled = true;

  this.scheduleAfterInputsHaveUpdated(() => {
    console.log('🔥 [Function] Callback FIRED');
    this.runScheduled = false;

    if (!this._deleted) {
      this.runScript();
    }
  });
}
```

**Location 2 - Proxy:**

```javascript
// Line ~25, Proxy set trap
this._internal.outputValuesProxy = new Proxy(this._internal.outputValues, {
  set: (obj, prop, value) => {
    console.log('🔵 [Function] Proxy intercepted:', prop, '=', value);
    //a function node can continue running after it has been deleted. E.g. with timeouts or event listeners that hasn't been removed.
    //if the node is deleted, just do nothing
    if (this._deleted) {
      console.log('⚠️ [Function] Node deleted, ignoring output');
      return;
    }

    //only send outputs when they change.
    //Some Noodl projects rely on this behavior, so changing it breaks backwards compability
    if (value !== this._internal.outputValues[prop]) {
      console.log('🚩 [Function] Flagging output dirty:', 'out-' + prop);
      this.registerOutputIfNeeded('out-' + prop);

      this._internal.outputValues[prop] = value;
      this.flagOutputDirty('out-' + prop);
    } else {
      console.log('⏭️ [Function] Output unchanged, skipping');
    }
    return true;
  }
});
```

**Location 3 - Output Getter:**

```javascript
// Line ~185, getScriptOutputValue method
getScriptOutputValue: function (name) {
  console.log('📤 [Function] Output getter called:', name, 'value:', this._internal.outputValues[name]);
  if (this._isSignalType(name)) {
    return undefined;
  }
  return this._internal.outputValues[name];
}
```

---

### Phase 3: Test with Logging 📊

1. Add all debug logging above
2. Run `npm run dev` to start editor
3. Create test nodes (Expression and Function)
4. Watch console output
5. Document what logs appear and what logs are missing

**Expected Log Flow (Expression):**

```
🟢 [Expression] Input changed: 1 + 1
🔵 [Expression] Schedule evaluation called
🔵 [Expression] Scheduling callback
🔥 [Expression] Callback FIRED
🔥 [Expression] Calculated: 2 Previous: 0
🚩 [Expression] Flagging outputs dirty
📤 [Expression] Result getter called, returning: 2
```

**Expected Log Flow (Function):**

```
🔵 [Function] Schedule run called
🔥 [Function] Callback FIRED
🔵 [Function] Proxy intercepted: result = 42
🚩 [Function] Flagging output dirty: out-result
📤 [Function] Output getter called: result value: 42
```

**If logs stop at certain point, that's where the bug is.**

---

### Phase 4: Narrow Down Root Cause 🎯

Based on Phase 3 findings, investigate specific areas:

#### Scenario A: Callback Never Fires

**Symptoms:**

- See "Schedule" logs but never see "Callback FIRED"
- `scheduleAfterInputsHaveUpdated()` not working

**Investigation:**

- Check `packages/noodl-runtime/src/node.js` - `scheduleAfterInputsHaveUpdated` implementation
- Verify `this._afterInputsHaveUpdatedCallbacks` array exists
- Check if `_performDirtyUpdate` is being called
- Look for React 19 related changes that might have broken scheduling

**Potential Fix:**

- Fix scheduling mechanism
- Ensure callbacks are executed properly

#### Scenario B: Outputs Flagged But Getters Not Called

**Symptoms:**

- See "Flagging outputs dirty" logs
- Never see "Output getter called" logs
- `flagOutputDirty()` works but doesn't trigger downstream updates

**Investigation:**

- Check base `Node` class `flagOutputDirty()` implementation
- Verify downstream nodes are checking for dirty outputs
- Check if connection system is broken
- Look for changes to output propagation mechanism

**Potential Fix:**

- Fix output propagation system
- Ensure getters are called when outputs are dirty

#### Scenario C: Context/Scope Missing

**Symptoms:**

- Expression compilation fails silently
- No errors in console but calculation returns 0 or undefined

**Investigation:**

- Add logging to check `this.context`
- Add logging to check `this.context.modelScope`
- Verify Noodl globals (Variables, Objects, Arrays) are accessible

**Potential Fix:**

- Ensure context is properly initialized
- Fix scope setup

#### Scenario D: Proxy Not Working (Function Only)

**Symptoms:**

- Function runs but Proxy set trap never fires
- Output assignments don't trigger updates

**Investigation:**

- Test if Proxy works in current Node.js version
- Check if `this._internal` exists when Proxy is created
- Verify Proxy is being used (not bypassed)

**Potential Fix:**

- Fix Proxy initialization
- Use alternative output mechanism if Proxy is broken

---

### Phase 5: Implement Fix 🔧

Once root cause is identified:

1. Implement targeted fix
2. Remove debug logging (or make conditional)
3. Test thoroughly
4. Document fix in INVESTIGATION.md
5. Add entry to LEARNINGS.md

---

## Success Criteria

- [ ] Expression nodes output correct values to connected nodes
- [ ] Function nodes output correct values to connected nodes
- [ ] Signal outputs work correctly
- [ ] Reactive updates work (expression updates when inputs change)
- [ ] No console errors during evaluation
- [ ] Downstream nodes receive and display outputs
- [ ] Existing projects using these nodes work correctly

---

## Testing Checklist

### Expression Node Tests

- [ ] Simple math: `1 + 1` outputs `2`
- [ ] With inputs: Connect Number node to `x`, expression `x * 2` outputs correct value
- [ ] With signals: Connect Run signal, expression evaluates on trigger
- [ ] With Noodl globals: `Variables.myVar` outputs correct value
- [ ] Signal outputs: `isTrueEv` fires when result is truthy
- [ ] Multiple connected outputs: Both `result` and `asString` work

### Function Node Tests

- [ ] Simple output: `Outputs.result = 42` outputs `42`
- [ ] Multiple outputs: Multiple `Outputs.x = ...` assignments all work
- [ ] Signal outputs: `Outputs.done.send()` triggers correctly
- [ ] With inputs: Access `Inputs.x` and output based on it
- [ ] Async functions: `async` functions work correctly
- [ ] Error handling: Errors don't crash editor, show in warnings

### Integration Tests

- [ ] Chain: Expression → Function → Text all work
- [ ] Multiple connections: One output connected to multiple inputs
- [ ] Reactive updates: Changing upstream input updates downstream
- [ ] Component boundary: Nodes work inside components

---

## Related Files

**Core:**

- `packages/noodl-runtime/src/node.js` - Base Node class
- `packages/noodl-runtime/src/nodecontext.js` - Node context/scope
- `packages/noodl-runtime/src/nodes/std-library/expression.js` - Expression node
- `packages/noodl-runtime/src/nodes/std-library/simplejavascript.js` - Function node

**Related Systems:**

- `packages/noodl-runtime/src/expression-evaluator.js` - Expression evaluation
- `packages/noodl-runtime/src/outputproperty.js` - Output handling
- `packages/noodl-runtime/src/nodegraphcontext.js` - Graph-level context

---

## Notes

- This is investigation-heavy - expect to spend time debugging
- Root cause may affect other node types
- May uncover deeper runtime issues
- Document all findings thoroughly
- Consider adding automated tests for these nodes once fixed
- If fix is complex, consider creating separate LEARNINGS entry

---

## Debugging Tips

**If stuck:**

1. Compare with a known-working node type (e.g., Number node)
2. Check git history for recent changes to affected files
3. Test in older version to see if regression
4. Ask Richard about recent runtime changes
5. Check if similar issues reported in GitHub issues

**Useful console commands:**

```javascript
// Get node instance
const node = window.Noodl.Graphs['Component'].nodes[0];

// Check outputs
node._internal.cachedValue;
node._internal.outputValues;

// Test flagging manually
node.flagOutputDirty('result');

// Check scheduling
node._afterInputsHaveUpdatedCallbacks;
```
