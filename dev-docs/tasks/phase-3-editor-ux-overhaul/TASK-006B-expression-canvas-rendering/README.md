# TASK-006B: Expression Parameter Canvas Rendering

**Status:** 🔴 Not Started  
**Priority:** P0 - Critical (blocks TASK-006)  
**Created:** 2026-01-10  
**Parent Task:** TASK-006 Expressions Overhaul

---

## Problem Statement

After implementing inline expression support in TASK-006, the canvas node rendering system crashes when trying to display nodes with expression parameters. The error manifests as:

```
TypeError: text.split is not a function
  at textWordWrap (NodeGraphEditorNode.ts:34)
```

### Impact

- ❌ Canvas becomes unusable after toggling any property to expression mode
- ❌ Cannot pan/zoom or interact with node graph
- ❌ Expressions feature is completely blocked
- ⚠️ Affects all node types with text/number properties

### Current Behavior

1. User toggles a property (e.g., Text node's `text` property) to expression mode
2. Property is saved as `{mode: 'expression', expression: '...', fallback: '...', version: 1}`
3. Property panel correctly extracts `fallback` value to display
4. **BUT** Canvas rendering code gets the raw expression object
5. NodeGraphEditorNode tries to call `.split()` on the object → **crash**

---

## Root Cause Analysis

### The Core Issue

The canvas rendering system (`NodeGraphEditorNode.ts`) directly accesses node parameters without any abstraction layer:

```typescript
// NodeGraphEditorNode.ts:34
function textWordWrap(text, width, font) {
  return text.split('\n'); // ❌ Expects text to be a string
}
```

When a property contains an expression parameter object instead of a primitive value, this crashes.

### Why This Happens

1. **No Parameter Value Resolver**

   - Canvas code assumes all parameters are primitives
   - No centralized place to extract values from expression parameters
   - Each consumer (property panel, canvas, runtime) handles values differently

2. **Direct Parameter Access**

   - `node.getParameter(name)` returns raw storage value
   - Could be a primitive OR an expression object
   - No type safety or value extraction

3. **Inconsistent Value Extraction**
   - Property panel: Fixed in BasicType.ts to use `paramValue.fallback`
   - Canvas rendering: Still using raw parameter values
   - Runtime evaluation: Uses `_evaluateExpressionParameter()`
   - **No shared utility**

### Architecture Gap

```
┌─────────────────────────────────────────────────────────┐
│ Parameter Storage (NodeGraphModel)                      │
│ - Stores raw values (primitives OR expression objects)  │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                  ↓
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ Property │      │  Canvas  │      │ Runtime  │
  │  Panel   │      │ Renderer │      │   Eval   │
  └──────────┘      └──────────┘      └──────────┘
       ✅                ❌                 ✅
   (extracts          (crashes)      (evaluates)
    fallback)       (expects str)   (expressions)
```

**Missing:** Centralized ParameterValueResolver

---

## Proposed Solution

### Architecture: Parameter Value Resolution Layer

Create a **centralized parameter value resolution system** that sits between storage and consumers:

```
┌─────────────────────────────────────────────────────────┐
│ Parameter Storage (NodeGraphModel)                      │
│ - Stores raw values (primitives OR expression objects)  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ ⭐ Parameter Value Resolver (NEW)                       │
│ - Detects expression parameters                         │
│ - Extracts fallback for display contexts               │
│ - Evaluates expressions for runtime contexts            │
│ - Always returns primitives                             │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                  ↓
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ Property │      │  Canvas  │      │ Runtime  │
  │  Panel   │      │ Renderer │      │   Eval   │
  └──────────┘      └──────────┘      └──────────┘
       ✅                ✅                 ✅
```

### Solution Components

#### 1. ParameterValueResolver Utility

```typescript
// packages/noodl-editor/src/editor/src/utils/ParameterValueResolver.ts

import { isExpressionParameter } from '@noodl-models/ExpressionParameter';

export enum ValueContext {
  Display = 'display', // For UI display (property panel, canvas)
  Runtime = 'runtime', // For runtime evaluation
  Serialization = 'serial' // For saving/loading
}

export class ParameterValueResolver {
  /**
   * Resolves a parameter value to a primitive based on context
   */
  static resolve(paramValue: unknown, context: ValueContext): string | number | boolean | undefined {
    // If not an expression parameter, return as-is
    if (!isExpressionParameter(paramValue)) {
      return paramValue as any;
    }

    // Handle expression parameters based on context
    switch (context) {
      case ValueContext.Display:
        // For display, use fallback value
        return paramValue.fallback ?? '';

      case ValueContext.Runtime:
        // For runtime, this should go through evaluation
        // (handled separately by node.js)
        return paramValue.fallback ?? '';

      case ValueContext.Serialization:
        // For serialization, return the whole object
        return paramValue;

      default:
        return paramValue.fallback ?? '';
    }
  }

  /**
   * Safely converts any value to a string for display
   */
  static toString(paramValue: unknown): string {
    const resolved = this.resolve(paramValue, ValueContext.Display);
    return String(resolved ?? '');
  }

  /**
   * Safely converts any value to a number for display
   */
  static toNumber(paramValue: unknown): number | undefined {
    const resolved = this.resolve(paramValue, ValueContext.Display);
    const num = Number(resolved);
    return isNaN(num) ? undefined : num;
  }
}
```

#### 2. Integration Points

**A. NodeGraphModel Enhancement**

```typescript
// packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts

import { ParameterValueResolver, ValueContext } from '../utils/ParameterValueResolver';

class NodeGraphModel {
  // New method: Get display value (always returns primitive)
  getParameterDisplayValue(name: string): string | number | boolean | undefined {
    const rawValue = this.getParameter(name);
    return ParameterValueResolver.resolve(rawValue, ValueContext.Display);
  }

  // Existing method remains unchanged (for backward compatibility)
  getParameter(name: string) {
    return this.parameters[name];
  }
}
```

**B. Canvas Rendering Integration**

```typescript
// packages/noodl-editor/src/editor/src/views/NodeGraphEditorNode.ts

// Before (CRASHES):
const label = this.model.getParameter('label');
const wrappedText = textWordWrap(label, width, font);  // ❌ label might be object

// After (SAFE):
import { ParameterValueResolver } from '../../../utils/ParameterValueResolver';

const labelValue = this.model.getParameter('label');
const labelString = ParameterValueResolver.toString(labelValue);
const wrappedText = textWordWrap(labelString, width, font);  // ✅ Always string
```

**C. Defensive Guard in textWordWrap**

As an additional safety layer:

```typescript
// NodeGraphEditorNode.ts
function textWordWrap(text: unknown, width: number, font: string): string[] {
  // Defensive: Ensure text is always a string
  const textString = typeof text === 'string' ? text : String(text ?? '');
  return textString.split('\n');
}
```

---

## Implementation Plan

### Phase 1: Create Utility (30 min)

- [ ] Create `ParameterValueResolver.ts` in `/utils`
- [ ] Implement `resolve()`, `toString()`, `toNumber()` methods
- [ ] Add JSDoc documentation
- [ ] Write unit tests

### Phase 2: Integrate with Canvas (1-2 hours)

- [ ] Audit NodeGraphEditorNode.ts for all parameter accesses
- [ ] Replace with `ParameterValueResolver.toString()` where needed
- [ ] Add defensive guard in `textWordWrap()`
- [ ] Add defensive guard in `measureTextHeight()`
- [ ] Test with String, Text, Group nodes

### Phase 3: Extend to NodeGraphModel (30 min)

- [ ] Add `getParameterDisplayValue()` method
- [ ] Update canvas code to use new method
- [ ] Ensure backward compatibility

### Phase 4: Testing & Validation (1 hour)

- [ ] Test all node types with expression parameters
- [ ] Verify canvas rendering works
- [ ] Verify pan/zoom functionality
- [ ] Check performance (should be negligible overhead)
- [ ] Test undo/redo still works

### Phase 5: Documentation (30 min)

- [ ] Update LEARNINGS.md with pattern
- [ ] Document in code comments
- [ ] Update TASK-006 progress

---

## Success Criteria

### Must Have

- ✅ Canvas renders without crashes when properties have expressions
- ✅ Can pan/zoom/interact with canvas normally
- ✅ All node types work correctly
- ✅ Expression toggle works end-to-end
- ✅ No performance regression

### Should Have

- ✅ Centralized value resolution utility
- ✅ Clear documentation of pattern
- ✅ Unit tests for resolver

### Nice to Have

- Consider future: Evaluated expression values displayed on canvas
- Consider future: Visual indicator on canvas for expression properties

---

## Alternative Approaches Considered

### ❌ Option 1: Quick Fix in textWordWrap

**Approach:** Add `String(text)` conversion in textWordWrap

**Pros:**

- Quick 1-line fix
- Prevents immediate crash

**Cons:**

- Doesn't address root cause
- Problem will resurface elsewhere
- Converts `{object}` to "[object Object]" (wrong)
- Not maintainable

**Decision:** Rejected - Band-aid, not a solution

### ❌ Option 2: Disable Expressions for Canvas Properties

**Approach:** Block expression toggle on label/title properties

**Pros:**

- Prevents the specific crash
- Arguably better UX (labels shouldn't be dynamic)

**Cons:**

- Doesn't fix the architectural issue
- Will hit same problem on other properties
- Limits feature usefulness
- Still need proper value extraction

**Decision:** Rejected - Too restrictive, doesn't solve core issue

### ✅ Option 3: Parameter Value Resolution Layer (CHOSEN)

**Approach:** Create centralized resolver utility

**Pros:**

- Fixes root cause
- Reusable across codebase
- Type-safe
- Maintainable
- Extensible for future needs

**Cons:**

- Takes longer to implement (~3-4 hours)
- Need to audit code for integration points

**Decision:** **ACCEPTED** - Proper architectural solution

---

## Files to Modify

### New Files

- `packages/noodl-editor/src/editor/src/utils/ParameterValueResolver.ts` (new utility)
- `packages/noodl-editor/tests/utils/ParameterValueResolver.test.ts` (tests)

### Modified Files

- `packages/noodl-editor/src/editor/src/views/NodeGraphEditorNode.ts` (canvas rendering)
- `packages/noodl-editor/src/editor/src/models/nodegraphmodel.ts` (optional enhancement)
- `dev-docs/reference/LEARNINGS.md` (document pattern)

---

## Testing Strategy

### Unit Tests

```typescript
describe('ParameterValueResolver', () => {
  it('should return primitive values as-is', () => {
    expect(ParameterValueResolver.resolve('hello', ValueContext.Display)).toBe('hello');
    expect(ParameterValueResolver.resolve(42, ValueContext.Display)).toBe(42);
  });

  it('should extract fallback from expression parameters', () => {
    const exprParam = {
      mode: 'expression',
      expression: 'Variables.x',
      fallback: 'default',
      version: 1
    };
    expect(ParameterValueResolver.resolve(exprParam, ValueContext.Display)).toBe('default');
  });

  it('should safely convert to string', () => {
    const exprParam = { mode: 'expression', expression: '', fallback: 'test', version: 1 };
    expect(ParameterValueResolver.toString(exprParam)).toBe('test');
    expect(ParameterValueResolver.toString(null)).toBe('');
    expect(ParameterValueResolver.toString(undefined)).toBe('');
  });
});
```

### Integration Tests

1. Create String node with expression on `text` property
2. Verify canvas renders without crash
3. Verify can pan/zoom canvas
4. Toggle expression on/off multiple times
5. Test with all node types

### Manual Testing Checklist

- [ ] String node with expression on `text`
- [ ] Text node with expression on `text`
- [ ] Group node with expression on `marginLeft`
- [ ] Number node with expression on `value`
- [ ] Create 10+ nodes, toggle all to expressions
- [ ] Pan/zoom canvas smoothly
- [ ] Select/deselect nodes
- [ ] Copy/paste nodes with expressions
- [ ] Undo/redo expression toggles

---

## Dependencies

### Depends On

- ✅ TASK-006 Phase 1 (expression foundation)
- ✅ TASK-006 Phase 2A (UI components)

### Blocks

- ⏸️ TASK-006 Phase 2B (completion)
- ⏸️ TASK-006 Phase 3 (testing & polish)

---

## Risks & Mitigations

| Risk                          | Impact | Probability | Mitigation                                     |
| ----------------------------- | ------ | ----------- | ---------------------------------------------- |
| Performance degradation       | Medium | Low         | Resolver is lightweight; add benchmarks        |
| Missed integration points     | High   | Medium      | Comprehensive audit of parameter accesses      |
| Breaks existing functionality | High   | Low         | Extensive testing; keep backward compatibility |
| Doesn't fix all canvas issues | Medium | Low         | Defensive guards as safety net                 |

---

## Estimated Effort

- **Implementation:** 3-4 hours
- **Testing:** 1-2 hours
- **Documentation:** 0.5 hours
- **Total:** 4.5-6.5 hours

---

## Notes

### Key Insights

1. The expression parameter system changed the **type** of stored values (primitive → object)
2. Consumers weren't updated to handle the new type
3. Need an abstraction layer to bridge storage and consumers
4. This pattern will be useful for future parameter enhancements

### Future Considerations

- Could extend resolver to handle evaluated values (show runtime result on canvas)
- Could add visual indicators on canvas for expression vs fixed
- Pattern applicable to other parameter types (colors, enums, etc.)

---

## Changelog

| Date       | Author | Change                |
| ---------- | ------ | --------------------- |
| 2026-01-10 | Cline  | Created task document |

---

## Related Documents

- [TASK-006: Expressions Overhaul](../TASK-006-expressions-overhaul/README.md)
- [ExpressionParameter.ts](../../../../packages/noodl-editor/src/editor/src/models/ExpressionParameter.ts)
- [LEARNINGS.md](../../../reference/LEARNINGS.md)
