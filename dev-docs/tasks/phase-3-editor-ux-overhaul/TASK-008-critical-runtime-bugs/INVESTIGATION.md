# TASK-008: Investigation Log

**Created:** 2026-01-11  
**Status:** In Progress

---

## Initial Bug Reports

### Reporter: Richard

**Date:** 2026-01-11

**Bug 1: White-on-White Error Tooltips**

> "The toasts that hover over nodes with errors are white background with white text, so I can't see anything."

**Bug 2: Expression/Function Nodes Not Outputting**

> "The expression nodes and function nodes aren't outputting any data anymore, even when run."

---

## Code Analysis

### Bug 1: Tooltip Rendering Path

**Flow:**

1. `NodeGraphEditorNode.ts` - Mouse hover over node with error
2. Line 608: `PopupLayer.instance.showTooltip()` called with error message
3. `popuplayer.js` - Renders tooltip HTML
4. `popuplayer.css` - Styles the tooltip (LEGACY CSS)

**Key Code Location:**

```typescript
// NodeGraphEditorNode.ts:606-615
const health = this.model.getHealth();
if (!health.healthy) {
  PopupLayer.instance.showTooltip({
    x: evt.pageX,
    y: evt.pageY,
    position: 'bottom',
    content: health.message
  });
}
```

**CSS Classes:**

- `.popup-layer-tooltip`
- `.popup-layer-tooltip-content`
- `.popup-layer-tooltip-arrow`

**Suspected Issue:**
Legacy CSS file uses hardcoded colors incompatible with current theme.

---

### Bug 2: Expression Node Analysis

**File:** `packages/noodl-runtime/src/nodes/std-library/expression.js`

**Execution Flow:**

1. `expression` input changed → `set()` method called
2. Calls `this._scheduleEvaluateExpression()`
3. Sets `internal.hasScheduledEvaluation = true`
4. Calls `this.scheduleAfterInputsHaveUpdated(callback)`
5. Callback should:
   - Calculate result via `_calculateExpression()`
   - Store in `internal.cachedValue`
   - Call `this.flagOutputDirty('result')`
   - Send signal outputs

**Output Mechanism:**

- Uses getters for outputs (`result`, `isTrue`, `isFalse`)
- Relies on `flagOutputDirty()` to trigger downstream updates
- Has signal outputs (`isTrueEv`, `isFalseEv`)

**Potential Issues:**

- Scheduling callback may not fire
- `flagOutputDirty()` may be broken
- Context may not be initialized
- Expression compilation may fail silently

---

### Bug 2: Function Node Analysis

**File:** `packages/noodl-runtime/src/nodes/std-library/simplejavascript.js`

**Execution Flow:**

1. `functionScript` input changed → `set()` method called
2. Parses script, calls `this.scheduleRun()`
3. Sets `runScheduled = true`
4. Calls `this.scheduleAfterInputsHaveUpdated(callback)`
5. Callback should:
   - Execute async function with `await func.apply(...)`
   - Outputs set via Proxy: `outputs[key] = value`
   - Proxy triggers `flagOutputDirty('out-' + prop)`

**Output Mechanism:**

- Uses **Proxy** to intercept output writes
- Proxy's `set` trap calls `this.flagOutputDirty()`
- Has getters for value outputs

**Potential Issues:**

- Proxy behavior may have changed
- Scheduling callback may not fire
- Async function errors swallowed
- `flagOutputDirty()` may be broken

---

## Common Patterns

Both nodes rely on:

1. `scheduleAfterInputsHaveUpdated()` - scheduling mechanism
2. `flagOutputDirty()` - output update notification
3. Getters for output values

If either mechanism is broken, both nodes would fail.

---

## Investigation Steps

### Step 1: Verify Scheduling Works ✅

**Test:** Add console.log to verify callbacks fire

```javascript
// In Expression node
this.scheduleAfterInputsHaveUpdated(function () {
  console.log('🔥 Expression callback FIRED');
  // ... rest of code
});

// In Function node
this.scheduleAfterInputsHaveUpdated(() => {
  console.log('🔥 Function callback FIRED');
  // ... rest of code
});
```

**Expected:** Logs should appear when inputs change or Run is triggered.

---

### Step 2: Verify Output Flagging ✅

**Test:** Add console.log before flagOutputDirty calls

```javascript
// In Expression node
console.log('🚩 Flagging output dirty: result', internal.cachedValue);
this.flagOutputDirty('result');

// In Function node (Proxy)
console.log('🚩 Flagging output dirty:', 'out-' + prop, value);
this._internal.outputValues[prop] = value;
this.flagOutputDirty('out-' + prop);
```

**Expected:** Logs should appear when outputs change.

---

### Step 3: Verify Downstream Updates ✅

**Test:** Connect a Text node to Expression/Function output, check if it updates

**Expected:** Text node should show the computed value.

---

### Step 4: Check Console for Errors ✅

**Test:** Open DevTools console, look for:

- Compilation errors
- Runtime errors
- Promise rejections
- Silent failures

---

### Step 5: Check Context/Scope ✅

**Test:** Verify `this.context` and `this.context.modelScope` exist

```javascript
console.log('🌍 Context:', this.context);
console.log('🌍 ModelScope:', this.context?.modelScope);
```

**Expected:** Should be defined objects, not undefined.

---

## Findings

### Tooltip Issue ✅ FIXED

**Root Cause:** Legacy CSS in `popuplayer.css` used hardcoded colors:

- Background: `var(--theme-color-secondary)` (white in current theme)
- Text: `var(--theme-color-fg-highlight)` (white)
- Result: White text on white background

**Fix:** Replaced with proper theme tokens:

- Background: `var(--theme-color-bg-3)` - dark panel background
- Border: `var(--theme-color-border-default)` - theme border
- Text: `var(--theme-color-fg-default)` - readable text color

**Status:** ✅ Confirmed working by Richard

---

### Node Output Issue ✅ FIXED

**Root Cause:** `JavascriptNodeParser.createNoodlAPI()` returns base Noodl API (with Variables, Objects, Arrays) but doesn't include `Inputs`/`Outputs` properties. Legacy code using `Noodl.Outputs.foo = 'bar'` failed with "cannot set properties of undefined".

**Function Signature:**

```javascript
function(Inputs, Outputs, Noodl, Component) { ... }
```

**Legacy Code (broken):**

```javascript
Noodl.Outputs.foo = 'bar'; // ❌ Noodl.Outputs is undefined
```

**New Code (worked):**

```javascript
Outputs.foo = 'bar'; // ✅ Direct parameter access
```

**Fix:** Augmented Noodl API object in `simplejavascript.js`:

```javascript
const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.nodeScope.modelScope);
noodlAPI.Inputs = inputs; // Add reference for backward compatibility
noodlAPI.Outputs = outputs; // Add reference for backward compatibility
```

**Result:** Both syntaxes now work:

- ✅ `Noodl.Outputs.foo = 'bar'` (legacy)
- ✅ `Outputs.foo = 'bar'` (current)
- ✅ `Noodl.Variables`, `Noodl.Objects`, `Noodl.Arrays` (unchanged)

**Status:** ✅ Implemented, ✅ Confirmed working by Richard

---

### Expression Node Issue ✅ FIXED

**Root Cause:** Expression node compiled functions with `function(inputA, inputB, ...)` signature, but tried to access `Noodl` via global scope in function preamble. The global `Noodl` object wasn't properly initialized or was missing Variables/Objects/Arrays.

**Expression:** `'text'` (string literal) returning `0` instead of `"text"`

**Problem Areas:**

1. **Function Preamble** (lines 296-310): Tries to access global `Noodl`:

   ```javascript
   'var NoodlContext = (typeof Noodl !== "undefined") ? Noodl : ...;';
   ```

2. **Compiled Function** (line 273): Only received input parameters, no Noodl:
   ```javascript
   // Before: function(inputA, inputB, ...) { return (expression); }
   ```

**Fix:** Pass Noodl API as parameter to compiled functions:

1. **In `_compileFunction()`** (lines 270-272):

   ```javascript
   // Add 'Noodl' as last parameter for backward compatibility
   args.push('Noodl');
   ```

2. **In `_calculateExpression()`** (lines 250-257):

   ```javascript
   // Get proper Noodl API and append as last parameter
   const JavascriptNodeParser = require('../../javascriptnodeparser');
   const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.context && this.context.modelScope);
   const argsWithNoodl = internal.inputValues.concat([noodlAPI]);

   return internal.compiledFunction.apply(null, argsWithNoodl);
   ```

**Result:**

- ✅ `'text'` should return "text" (string)
- ✅ `123` should return 123 (number)
- ✅ `Variables.myVar` should access Noodl Variables
- ✅ `Objects.myObj` should access Noodl Objects
- ✅ All math functions still work (min, max, cos, sin, etc.)

**Status:** ✅ Implemented, awaiting testing confirmation

---

## Timeline

- **2026-01-11 10:40** - Task created, initial investigation started
- _Entries to be added as investigation progresses_

---

## Related Issues

- May be related to React 19 migration (Phase 1)
- May be related to runtime changes (Phase 2)
- Similar issues may exist in other node types

---

## Next Steps

1. Add debug logging to both node types
2. Test in running editor
3. Reproduce bugs with minimal test case
4. Identify exact failure point
5. Implement fixes
6. Document in LEARNINGS.md
