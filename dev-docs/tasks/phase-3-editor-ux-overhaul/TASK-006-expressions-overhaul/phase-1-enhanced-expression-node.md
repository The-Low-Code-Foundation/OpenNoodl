# TASK: Enhanced Expression Node & Expression Evaluator Foundation

## Overview

Upgrade the existing Expression node to support full JavaScript expressions with access to `Noodl.Variables`, `Noodl.Objects`, and `Noodl.Arrays`, plus reactive dependency tracking. This establishes the foundation for Phase 2 (inline expression properties throughout the editor).

**Estimated effort:** 2-3 weeks  
**Priority:** High - Foundation for Expression Properties feature  
**Dependencies:** None

---

## Background & Motivation

### Current Expression Node Limitations

The existing Expression node (`packages/noodl-runtime/src/nodes/std-library/expression.js`):

1. **Limited context** - Only provides Math helpers (min, max, cos, sin, etc.)
2. **No Noodl globals** - Cannot access `Noodl.Variables.X`, `Noodl.Objects.Y`, `Noodl.Arrays.Z`
3. **Boolean-focused outputs** - Primarily `isTrue`/`isFalse`, though `result` exists as `*` type
4. **Workaround required** - Users must create connected input ports to pass in variable values
5. **No reactive updates** - Doesn't automatically re-evaluate when referenced Variables/Objects change

### Desired State

Users should be able to write expressions like:
```javascript
Noodl.Variables.isLoggedIn ? `Welcome, ${Noodl.Variables.userName}!` : "Please log in"
```

And have the expression automatically re-evaluate whenever `isLoggedIn` or `userName` changes.

---

## Files to Analyze First

Before making changes, thoroughly read and understand these files:

### Core Expression Implementation
```
@packages/noodl-runtime/src/nodes/std-library/expression.js
```
- Current expression compilation using `new Function()`
- `functionPreamble` that injects Math helpers
- `parsePorts()` for extracting variable references
- Scheduling and caching mechanisms

### Noodl Global APIs
```
@packages/noodl-runtime/src/model.js
@packages/noodl-viewer-react/src/noodl-js-api.js
@packages/noodl-viewer-cloud/src/noodl-js-api.js
```
- How `Noodl.Variables`, `Noodl.Objects`, `Noodl.Arrays` are implemented
- The Model class and its change event system
- `Model.get('--ndl--global-variables')` pattern

### Type Definitions (for autocomplete later)
```
@packages/noodl-viewer-react/static/viewer/global.d.ts.keep
@packages/noodl-viewer-cloud/static/viewer/global.d.ts.keep
```
- TypeScript definitions for the Noodl namespace
- Documentation of the API surface

### JavaScript/Function Node (reference)
```
@packages/noodl-runtime/src/nodes/std-library/javascriptfunction.js
```
- How full JavaScript nodes access Noodl context
- Pattern for providing richer execution context

---

## Implementation Plan

### Step 1: Create Expression Evaluator Module

Create a new shared module that handles expression compilation, dependency tracking, and evaluation.

**Create file:** `packages/noodl-runtime/src/expression-evaluator.js`

```javascript
/**
 * Expression Evaluator
 * 
 * Compiles JavaScript expressions with access to Noodl globals
 * and tracks dependencies for reactive updates.
 * 
 * Features:
 * - Full Noodl.Variables, Noodl.Objects, Noodl.Arrays access
 * - Math helpers (min, max, cos, sin, etc.)
 * - Dependency detection and change subscription
 * - Expression versioning for future compatibility
 * - Caching of compiled functions
 */

'use strict';

const Model = require('./model');

// Expression system version - increment when context changes
const EXPRESSION_VERSION = 1;

// Cache for compiled functions
const compiledFunctionsCache = new Map();

// Math helpers to inject
const mathHelpers = {
  min: Math.min,
  max: Math.max,
  cos: Math.cos,
  sin: Math.sin,
  tan: Math.tan,
  sqrt: Math.sqrt,
  pi: Math.PI,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  random: Math.random,
  pow: Math.pow,
  log: Math.log,
  exp: Math.exp
};

/**
 * Detect dependencies in an expression string
 * Returns { variables: string[], objects: string[], arrays: string[] }
 */
function detectDependencies(expression) {
  const dependencies = {
    variables: [],
    objects: [],
    arrays: []
  };
  
  // Remove strings to avoid false matches
  const exprWithoutStrings = expression
    .replace(/"([^"\\]|\\.)*"/g, '""')
    .replace(/'([^'\\]|\\.)*'/g, "''")
    .replace(/`([^`\\]|\\.)*`/g, '``');
  
  // Match Noodl.Variables.X or Noodl.Variables["X"]
  const variableMatches = exprWithoutStrings.matchAll(
    /Noodl\.Variables\.([a-zA-Z_$][a-zA-Z0-9_$]*)|Noodl\.Variables\[["']([^"']+)["']\]/g
  );
  for (const match of variableMatches) {
    const varName = match[1] || match[2];
    if (varName && !dependencies.variables.includes(varName)) {
      dependencies.variables.push(varName);
    }
  }
  
  // Match Noodl.Objects.X or Noodl.Objects["X"]
  const objectMatches = exprWithoutStrings.matchAll(
    /Noodl\.Objects\.([a-zA-Z_$][a-zA-Z0-9_$]*)|Noodl\.Objects\[["']([^"']+)["']\]/g
  );
  for (const match of objectMatches) {
    const objId = match[1] || match[2];
    if (objId && !dependencies.objects.includes(objId)) {
      dependencies.objects.push(objId);
    }
  }
  
  // Match Noodl.Arrays.X or Noodl.Arrays["X"]
  const arrayMatches = exprWithoutStrings.matchAll(
    /Noodl\.Arrays\.([a-zA-Z_$][a-zA-Z0-9_$]*)|Noodl\.Arrays\[["']([^"']+)["']\]/g
  );
  for (const match of arrayMatches) {
    const arrId = match[1] || match[2];
    if (arrId && !dependencies.arrays.includes(arrId)) {
      dependencies.arrays.push(arrId);
    }
  }
  
  return dependencies;
}

/**
 * Create the Noodl context object for expression evaluation
 */
function createNoodlContext(modelScope) {
  const scope = modelScope || Model;
  
  return {
    Variables: scope.get('--ndl--global-variables')?.data || {},
    Objects: new Proxy({}, {
      get(target, prop) {
        const obj = scope.get(prop);
        return obj ? obj.data : undefined;
      }
    }),
    Arrays: new Proxy({}, {
      get(target, prop) {
        const arr = scope.get(prop);
        return arr ? arr.data : undefined;
      }
    }),
    Object: scope
  };
}

/**
 * Compile an expression string into a callable function
 */
function compileExpression(expression) {
  const cacheKey = `v${EXPRESSION_VERSION}:${expression}`;
  
  if (compiledFunctionsCache.has(cacheKey)) {
    return compiledFunctionsCache.get(cacheKey);
  }
  
  // Build parameter list for the function
  const paramNames = ['Noodl', ...Object.keys(mathHelpers)];
  
  // Wrap expression in return statement
  const functionBody = `
    "use strict";
    try {
      return (${expression});
    } catch (e) {
      console.error('Expression evaluation error:', e.message);
      return undefined;
    }
  `;
  
  try {
    const fn = new Function(...paramNames, functionBody);
    compiledFunctionsCache.set(cacheKey, fn);
    return fn;
  } catch (e) {
    console.error('Expression compilation error:', e.message);
    return null;
  }
}

/**
 * Evaluate a compiled expression with the current context
 */
function evaluateExpression(compiledFn, modelScope) {
  if (!compiledFn) return undefined;
  
  const noodlContext = createNoodlContext(modelScope);
  const mathValues = Object.values(mathHelpers);
  
  try {
    return compiledFn(noodlContext, ...mathValues);
  } catch (e) {
    console.error('Expression evaluation error:', e.message);
    return undefined;
  }
}

/**
 * Subscribe to changes in expression dependencies
 * Returns an unsubscribe function
 */
function subscribeToChanges(dependencies, callback, modelScope) {
  const scope = modelScope || Model;
  const listeners = [];
  
  // Subscribe to variable changes
  if (dependencies.variables.length > 0) {
    const variablesModel = scope.get('--ndl--global-variables');
    if (variablesModel) {
      const handler = (args) => {
        // Check if any of our dependencies changed
        if (dependencies.variables.some(v => args.name === v || !args.name)) {
          callback();
        }
      };
      variablesModel.on('change', handler);
      listeners.push(() => variablesModel.off('change', handler));
    }
  }
  
  // Subscribe to object changes
  for (const objId of dependencies.objects) {
    const objModel = scope.get(objId);
    if (objModel) {
      const handler = () => callback();
      objModel.on('change', handler);
      listeners.push(() => objModel.off('change', handler));
    }
  }
  
  // Subscribe to array changes
  for (const arrId of dependencies.arrays) {
    const arrModel = scope.get(arrId);
    if (arrModel) {
      const handler = () => callback();
      arrModel.on('change', handler);
      listeners.push(() => arrModel.off('change', handler));
    }
  }
  
  // Return unsubscribe function
  return () => {
    listeners.forEach(unsub => unsub());
  };
}

/**
 * Validate expression syntax without executing
 */
function validateExpression(expression) {
  try {
    new Function(`return (${expression})`);
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Get the current expression system version
 */
function getExpressionVersion() {
  return EXPRESSION_VERSION;
}

module.exports = {
  detectDependencies,
  compileExpression,
  evaluateExpression,
  subscribeToChanges,
  validateExpression,
  createNoodlContext,
  getExpressionVersion,
  EXPRESSION_VERSION
};
```

### Step 2: Upgrade Expression Node

Modify the existing Expression node to use the new evaluator and support reactive updates.

**Modify file:** `packages/noodl-runtime/src/nodes/std-library/expression.js`

Key changes:
1. Use `expression-evaluator.js` for compilation
2. Add Noodl globals to the function preamble
3. Implement dependency detection
4. Subscribe to changes for automatic re-evaluation
5. Add new typed outputs (`asString`, `asNumber`)
6. Clean up subscriptions on node deletion

```javascript
// Key additions to the expression node:

const ExpressionEvaluator = require('../../expression-evaluator');

// In initialize():
internal.unsubscribe = null;
internal.dependencies = { variables: [], objects: [], arrays: [] };

// In the expression input setter:
// After compiling the expression:
internal.dependencies = ExpressionEvaluator.detectDependencies(value);

// Set up reactive subscription
if (internal.unsubscribe) {
  internal.unsubscribe();
}

if (internal.dependencies.variables.length > 0 || 
    internal.dependencies.objects.length > 0 ||
    internal.dependencies.arrays.length > 0) {
  internal.unsubscribe = ExpressionEvaluator.subscribeToChanges(
    internal.dependencies,
    () => this._scheduleEvaluateExpression(),
    this.context?.modelScope
  );
}

// Add cleanup in _onNodeDeleted or add a delete listener
```

### Step 3: Update Function Preamble

Update the preamble to include Noodl globals:

```javascript
var functionPreamble = [
  // Math helpers (existing)
  'var min = Math.min,',
  '    max = Math.max,',
  '    cos = Math.cos,',
  '    sin = Math.sin,',
  '    tan = Math.tan,',
  '    sqrt = Math.sqrt,',
  '    pi = Math.PI,',
  '    round = Math.round,',
  '    floor = Math.floor,',
  '    ceil = Math.ceil,',
  '    abs = Math.abs,',
  '    pow = Math.pow,',
  '    log = Math.log,',
  '    exp = Math.exp,',
  '    random = Math.random;',
  // Noodl context shortcuts (new)
  'var Variables = Noodl.Variables,',
  '    Objects = Noodl.Objects,',
  '    Arrays = Noodl.Arrays;'
].join('\n');
```

### Step 4: Add New Outputs

Add typed output alternatives for better downstream compatibility:

```javascript
outputs: {
  // Existing outputs (keep for backward compatibility)
  result: { /* ... */ },
  isTrue: { /* ... */ },
  isFalse: { /* ... */ },
  isTrueEv: { /* ... */ },
  isFalseEv: { /* ... */ },
  
  // New typed outputs
  asString: {
    group: 'Typed Results',
    type: 'string',
    displayName: 'As String',
    getter: function() {
      const val = this._internal.cachedValue;
      return val !== undefined && val !== null ? String(val) : '';
    }
  },
  asNumber: {
    group: 'Typed Results',
    type: 'number',
    displayName: 'As Number',
    getter: function() {
      const val = this._internal.cachedValue;
      return typeof val === 'number' ? val : Number(val) || 0;
    }
  },
  asBoolean: {
    group: 'Typed Results',
    type: 'boolean',
    displayName: 'As Boolean',
    getter: function() {
      return !!this._internal.cachedValue;
    }
  }
}
```

### Step 5: Add Expression Validation in Editor

Enhance the editor-side validation to provide better error messages:

**Modify file:** `packages/noodl-runtime/src/nodes/std-library/expression.js` (setup function)

```javascript
// In the setup function, enhance evalCompileWarnings:
function evalCompileWarnings(editorConnection, node) {
  const expression = node.parameters.expression;
  if (!expression) {
    editorConnection.clearWarning(node.component.name, node.id, 'expression-compile-error');
    return;
  }
  
  const validation = ExpressionEvaluator.validateExpression(expression);
  
  if (!validation.valid) {
    editorConnection.sendWarning(node.component.name, node.id, 'expression-compile-error', {
      message: `Syntax error: ${validation.error}`
    });
  } else {
    editorConnection.clearWarning(node.component.name, node.id, 'expression-compile-error');
    
    // Also show detected dependencies as info (optional)
    const deps = ExpressionEvaluator.detectDependencies(expression);
    if (deps.variables.length > 0 || deps.objects.length > 0 || deps.arrays.length > 0) {
      // Could show this as info, not warning
    }
  }
}
```

### Step 6: Add Tests

**Create file:** `packages/noodl-runtime/test/expression-evaluator.test.js`

```javascript
const ExpressionEvaluator = require('../src/expression-evaluator');

describe('Expression Evaluator', () => {
  describe('detectDependencies', () => {
    test('detects Noodl.Variables references', () => {
      const deps = ExpressionEvaluator.detectDependencies(
        'Noodl.Variables.isLoggedIn ? Noodl.Variables.userName : "guest"'
      );
      expect(deps.variables).toContain('isLoggedIn');
      expect(deps.variables).toContain('userName');
    });
    
    test('detects bracket notation', () => {
      const deps = ExpressionEvaluator.detectDependencies(
        'Noodl.Variables["my variable"]'
      );
      expect(deps.variables).toContain('my variable');
    });
    
    test('ignores references inside strings', () => {
      const deps = ExpressionEvaluator.detectDependencies(
        '"Noodl.Variables.notReal"'
      );
      expect(deps.variables).toHaveLength(0);
    });
    
    test('detects Noodl.Objects references', () => {
      const deps = ExpressionEvaluator.detectDependencies(
        'Noodl.Objects.CurrentUser.name'
      );
      expect(deps.objects).toContain('CurrentUser');
    });
    
    test('detects Noodl.Arrays references', () => {
      const deps = ExpressionEvaluator.detectDependencies(
        'Noodl.Arrays.items.length'
      );
      expect(deps.arrays).toContain('items');
    });
  });
  
  describe('compileExpression', () => {
    test('compiles valid expression', () => {
      const fn = ExpressionEvaluator.compileExpression('1 + 1');
      expect(fn).not.toBeNull();
    });
    
    test('returns null for invalid expression', () => {
      const fn = ExpressionEvaluator.compileExpression('1 +');
      expect(fn).toBeNull();
    });
    
    test('caches compiled functions', () => {
      const fn1 = ExpressionEvaluator.compileExpression('2 + 2');
      const fn2 = ExpressionEvaluator.compileExpression('2 + 2');
      expect(fn1).toBe(fn2);
    });
  });
  
  describe('validateExpression', () => {
    test('validates correct syntax', () => {
      const result = ExpressionEvaluator.validateExpression('a > b ? 1 : 0');
      expect(result.valid).toBe(true);
    });
    
    test('catches syntax errors', () => {
      const result = ExpressionEvaluator.validateExpression('a >');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('evaluateExpression', () => {
    test('evaluates math expressions', () => {
      const fn = ExpressionEvaluator.compileExpression('min(10, 5) + max(1, 2)');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe(7);
    });
    
    test('handles pi constant', () => {
      const fn = ExpressionEvaluator.compileExpression('round(pi * 100) / 100');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe(3.14);
    });
  });
});
```

### Step 7: Update TypeScript Definitions

**Modify file:** `packages/noodl-editor/src/editor/src/utils/CodeEditor/model.ts`

Add the enhanced context for Expression nodes in the Monaco editor:

```typescript
// In registerOrUpdate_Expression function, add more complete typings
function registerOrUpdate_Expression(): TypescriptModule {
  return {
    uri: 'expression-context.d.ts',
    source: `
      declare const Noodl: {
        Variables: Record<string, any>;
        Objects: Record<string, any>;
        Arrays: Record<string, any>;
      };
      declare const Variables: Record<string, any>;
      declare const Objects: Record<string, any>;
      declare const Arrays: Record<string, any>;
      
      declare const min: typeof Math.min;
      declare const max: typeof Math.max;
      declare const cos: typeof Math.cos;
      declare const sin: typeof Math.sin;
      declare const tan: typeof Math.tan;
      declare const sqrt: typeof Math.sqrt;
      declare const pi: number;
      declare const round: typeof Math.round;
      declare const floor: typeof Math.floor;
      declare const ceil: typeof Math.ceil;
      declare const abs: typeof Math.abs;
      declare const pow: typeof Math.pow;
      declare const log: typeof Math.log;
      declare const exp: typeof Math.exp;
      declare const random: typeof Math.random;
    `,
    libs: []
  };
}
```

---

## Success Criteria

### Functional Requirements

- [ ] Expression node can evaluate `Noodl.Variables.X` syntax
- [ ] Expression node can evaluate `Noodl.Objects.X.property` syntax
- [ ] Expression node can evaluate `Noodl.Arrays.X` syntax
- [ ] Shorthand aliases work (`Variables.X`, `Objects.X`, `Arrays.X`)
- [ ] Expression auto-re-evaluates when referenced Variable changes
- [ ] Expression auto-re-evaluates when referenced Object property changes
- [ ] Expression auto-re-evaluates when referenced Array changes
- [ ] New typed outputs (`asString`, `asNumber`, `asBoolean`) work correctly
- [ ] Backward compatibility - existing expressions continue to work
- [ ] Math helpers continue to work (min, max, cos, sin, etc.)
- [ ] Syntax errors show clear warning messages in editor

### Non-Functional Requirements

- [ ] Compiled functions are cached for performance
- [ ] Memory cleanup - subscriptions are removed when node is deleted
- [ ] Expression version is tracked for future migration support
- [ ] No performance regression for expressions without Noodl globals

---

## Testing Checklist

### Manual Testing

1. **Basic Math Expression**
   - Create Expression node with `min(10, 5) + max(1, 2)`
   - Verify result output is 7

2. **Variable Reference**
   - Set `Noodl.Variables.testVar = 42` in a Function node
   - Create Expression node with `Noodl.Variables.testVar * 2`
   - Verify result is 84

3. **Reactive Update**
   - Create Expression with `Noodl.Variables.counter`
   - Connect a button to increment `Noodl.Variables.counter`
   - Verify Expression result updates automatically on button click

4. **Object Property Access**
   - Create an Object with ID "TestObject" and property "name"
   - Create Expression with `Noodl.Objects.TestObject.name`
   - Verify result shows the name value

5. **Ternary with Variables**
   - Set `Noodl.Variables.isAdmin = true`
   - Create Expression: `Noodl.Variables.isAdmin ? "Admin" : "User"`
   - Verify result is "Admin"
   - Toggle isAdmin to false, verify result changes to "User"

6. **Template Literals**
   - Set `Noodl.Variables.name = "Alice"`
   - Create Expression: `` `Hello, ${Noodl.Variables.name}!` ``
   - Verify result is "Hello, Alice!"

7. **Syntax Error Handling**
   - Create Expression with invalid syntax `1 +`
   - Verify warning appears in editor
   - Verify node doesn't crash

8. **Typed Outputs**
   - Create Expression: `"42"`
   - Connect `asNumber` output to a Number display
   - Verify it shows 42 as number

### Automated Testing

- [ ] Run `npm test` in packages/noodl-runtime
- [ ] All expression-evaluator tests pass
- [ ] Existing expression.test.js tests pass
- [ ] No TypeScript errors in editor package

---

## Rollback Plan

If issues are discovered:

1. The expression-evaluator.js module is additive - can be removed without breaking existing code
2. Expression node changes are backward compatible - old expressions work
3. New outputs are additive - removing them won't break existing connections
4. Keep original functionPreamble as fallback option

---

## Notes for Implementer

### Important Patterns to Preserve

1. **Input port generation** - The expression node dynamically creates input ports for referenced variables. This behavior should be preserved for explicit inputs while also supporting implicit Noodl.Variables access.

2. **Scheduling** - Use `scheduleAfterInputsHaveUpdated` pattern for batching evaluations.

3. **Caching** - The existing `cachedValue` pattern prevents unnecessary output updates.

### Edge Cases to Handle

1. **Circular dependencies** - What if Variable A's expression references Variable B and vice versa?
2. **Missing variables** - Handle gracefully when referenced variable doesn't exist
3. **Type coercion** - Be consistent with JavaScript's type coercion rules
4. **Async expressions** - Current system is sync-only, keep it that way

### Questions to Resolve During Implementation

1. Should the shorthand `Variables.X` work without `Noodl.` prefix?
   - **Recommendation:** Yes, add to preamble for convenience

2. Should we detect unused input ports and warn?
   - **Recommendation:** Not in this phase

3. How to handle expressions that error at runtime?
   - **Recommendation:** Return undefined, log error, don't crash
