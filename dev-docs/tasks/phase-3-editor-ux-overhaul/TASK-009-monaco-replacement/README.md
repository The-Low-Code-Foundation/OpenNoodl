# TASK-009: Replace Monaco Code Editor in Expression/Function/Script Nodes

## Overview

Replace the broken Monaco code editor in Expression, Function, and Script nodes with a lightweight, custom React-based JavaScript editor that works reliably in Electron.

**Critical Requirement:** **100% backward compatible** - All existing projects must load their code without any data loss or connection loss.

## Problem Statement

### Current State

- **Monaco is broken in Electron** - Web worker loading failures flood the console
- **Expression nodes don't work** - Users can't type or see their code
- **Function/Script nodes at risk** - Same Monaco dependency, likely same issues
- **User trust at stake** - Every Noodl project has Expression/Function/Script nodes

### Error Symptoms

```
Error: Unexpected usage
at EditorSimpleWorker.loadForeignModule
Cannot use import statement outside a module
```

### Why Monaco Fails

Monaco relies on **web workers** for TypeScript/JavaScript language services. In Electron's CommonJS environment, the worker module loading is broken. TASK-008 encountered the same issue with JSON editing and solved it by **ditching Monaco entirely**.

## Solution Design

### Approach: Custom React-Based Editor

Following TASK-008's successful pattern, build a **simple, reliable code editor** without Monaco:

- **Textarea-based** - No complex dependencies
- **Validation on blur** - Catch syntax errors without real-time overhead
- **Line numbers** - Essential for debugging
- **Format button** - Basic code prettification
- **No syntax highlighting** - Keeps it simple and performant

### Why This Will Work

1. **Proven Pattern** - TASK-008 already did this successfully for JSON
2. **Electron Compatible** - No web workers, no module loading issues
3. **Lightweight** - Fast, reliable, maintainable
4. **Backward Compatible** - Reads/writes same string format as before

## Critical Safety Requirements

### 1. Data Preservation (ABSOLUTE PRIORITY)

**The new editor MUST:**

- Read code from the exact same model property: `model.getParameter('code')`
- Write code to the exact same model property: `model.setParameter('code', value)`
- Support all existing code without any transformation
- Handle multiline strings, special characters, Unicode, etc.

**Test criteria:**

```typescript
// Before migration:
const existingCode = model.getParameter('code'); // "return a + b;"

// After migration (with new editor):
const loadedCode = model.getParameter('code'); // MUST BE: "return a + b;"

// Identity test:
expect(loadedCode).toBe(existingCode); // MUST PASS
```

### 2. Connection Preservation (CRITICAL)

**Node connections are NOT stored in the editor** - they're in the node definition and graph model.

- Inputs/outputs defined by node configuration, not editor
- Editor only edits the code string
- Changing editor UI **cannot** affect connections

**Test criteria:**

1. Open project with Expression nodes that have connections
2. Verify all input/output connections are visible
3. Edit code in new editor
4. Close and reopen project
5. Verify all connections still intact

### 3. No Data Migration Required

**Key insight:** The editor is just a UI component for editing a string property.

```typescript
// Old Monaco editor:
<MonacoEditor
  value={model.getParameter('code')}
  onChange={(value) => model.setParameter('code', value)}
/>

// New custom editor:
<JavaScriptEditor
  value={model.getParameter('code')}
  onChange={(value) => model.setParameter('code', value)}
/>
```

**Same input, same output, just different UI.**

## Technical Implementation

### Component Structure

```
packages/noodl-core-ui/src/components/
└── code-editor/
    ├── JavaScriptEditor.tsx         # Main editor component
    ├── JavaScriptEditor.module.scss
    ├── index.ts
    │
    ├── components/
    │   ├── LineNumbers.tsx          # Line number gutter
    │   ├── ValidationBar.tsx        # Error/warning display
    │   └── CodeTextarea.tsx         # Textarea with enhancements
    │
    └── utils/
        ├── jsValidator.ts           # Syntax validation (try/catch eval)
        ├── jsFormatter.ts           # Simple indentation
        └── types.ts                 # TypeScript definitions
```

### API Design

```typescript
interface JavaScriptEditorProps {
  /** Code value (string) */
  value: string;

  /** Called when code changes */
  onChange: (value: string) => void;

  /** Called on save (Cmd+S) */
  onSave?: (value: string) => void;

  /** Validation mode */
  validationType?: 'expression' | 'function' | 'script';

  /** Read-only mode */
  disabled?: boolean;

  /** Height */
  height?: number | string;

  /** Placeholder text */
  placeholder?: string;
}

// Usage in Expression node:
<JavaScriptEditor
  value={model.getParameter('code')}
  onChange={(code) => model.setParameter('code', code)}
  onSave={(code) => model.setParameter('code', code)}
  validationType="expression"
  height="200px"
/>;
```

### Validation Strategy

**Expression nodes:** Validate as JavaScript expression

```javascript
function validateExpression(code) {
  try {
    // Try to eval as expression (in isolated context)
    new Function('return (' + code + ')');
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
      suggestion: 'Check for syntax errors in your expression'
    };
  }
}
```

**Function nodes:** Validate as function body

```javascript
function validateFunction(code) {
  try {
    new Function(code);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
      line: extractLineNumber(err)
    };
  }
}
```

**Script nodes:** Same as function validation

## Integration Strategy

### Phase 1: Expression Nodes (HIGHEST PRIORITY)

**Why Expression first:**

- Most commonly used (every project has them)
- Simpler validation (single expression)
- Least risky to change

**Integration steps:**

1. Create JavaScriptEditor component
2. Find where Expression nodes use Monaco
3. Replace Monaco import with JavaScriptEditor import
4. Test with existing projects (NO data migration needed)
5. Verify all connections work

**Safety checkpoint:**

- Load 10 real Noodl projects
- Open every Expression node
- Verify code loads correctly
- Verify connections intact
- Edit and save
- Reopen - verify changes persisted

### Phase 2: Function Nodes (PROCEED WITH CAUTION)

**Why Function second:**

- Less common than Expression
- More complex (multiple statements)
- Users likely have critical business logic here

**Integration steps:**

1. Use same JavaScriptEditor component
2. Change validation mode to 'function'
3. Test extensively with real-world Function nodes
4. Verify input/output definitions preserved

**Safety checkpoint:**

- Test with Functions that have:
  - Multiple inputs/outputs
  - Complex logic
  - Dependencies on other nodes
  - Async operations

### Phase 3: Script Nodes (MOST CAREFUL)

**Why Script last:**

- Can contain any JavaScript
- May have side effects
- Least used (gives us time to perfect editor)

**Integration steps:**

1. Use same JavaScriptEditor component
2. Validation mode: 'script'
3. Test with real Script nodes from projects
4. Ensure lifecycle hooks preserved

## Subtasks

### Phase 1: Core JavaScript Editor (2-3 days)

- [ ] **CODE-001**: Create JavaScriptEditor component structure
- [ ] **CODE-002**: Implement CodeTextarea with line numbers
- [ ] **CODE-003**: Add syntax validation (expression mode)
- [ ] **CODE-004**: Add ValidationBar with error display
- [ ] **CODE-005**: Add format/indent button
- [ ] **CODE-006**: Add keyboard shortcuts (Cmd+S)

### Phase 2: Expression Node Integration (1-2 days)

- [ ] **CODE-007**: Locate Expression node Monaco usage
- [ ] **CODE-008**: Replace Monaco with JavaScriptEditor
- [ ] **CODE-009**: Test with 10 real projects (data preservation)
- [ ] **CODE-010**: Test with various expression patterns
- [ ] **CODE-011**: Verify connections preserved

### Phase 3: Function Node Integration (1-2 days)

- [ ] **CODE-012**: Add function validation mode
- [ ] **CODE-013**: Replace Monaco in Function nodes
- [ ] **CODE-014**: Test with real Function nodes
- [ ] **CODE-015**: Verify input/output preservation

### Phase 4: Script Node Integration (1 day)

- [ ] **CODE-016**: Add script validation mode
- [ ] **CODE-017**: Replace Monaco in Script nodes
- [ ] **CODE-018**: Test with real Script nodes
- [ ] **CODE-019**: Final integration testing

### Phase 5: Cleanup (1 day)

- [ ] **CODE-020**: Remove Monaco dependencies (if unused elsewhere)
- [ ] **CODE-021**: Add Storybook stories
- [ ] **CODE-022**: Documentation and migration notes

## Data Safety Testing Protocol

### For Each Node Type (Expression, Function, Script):

**Test 1: Load Existing Code**

1. Open project created before migration
2. Click on node to open code editor
3. ✅ Code appears exactly as saved
4. ✅ No garbling, no loss, no transformation

**Test 2: Connection Preservation**

1. Open node with multiple input/output connections
2. Verify connections visible in graph
3. Open code editor
4. Edit code
5. Close editor
6. ✅ All connections still intact

**Test 3: Save and Reload**

1. Edit code in new editor
2. Save
3. Close project
4. Reopen project
5. ✅ Code changes persisted correctly

**Test 4: Special Characters**

1. Test with code containing:
   - Multiline strings
   - Unicode characters
   - Special symbols (`, ", ', \n, etc.)
   - Comments with special chars
2. ✅ All characters preserved

**Test 5: Large Code**

1. Test with Function/Script containing 100+ lines
2. ✅ Loads quickly
3. ✅ Edits smoothly
4. ✅ Saves correctly

## Acceptance Criteria

### Functional

1. ✅ Expression, Function, and Script nodes can edit code without Monaco
2. ✅ Syntax errors are caught and displayed clearly
3. ✅ Line numbers help locate errors
4. ✅ Format button improves readability
5. ✅ Keyboard shortcuts work (Cmd+S to save)

### Safety (CRITICAL)

6. ✅ **All existing projects load their code correctly**
7. ✅ **No data loss when opening/editing/saving**
8. ✅ **All input/output connections preserved**
9. ✅ **Code with special characters works**
10. ✅ **Multiline code works**

### Performance

11. ✅ Editor opens instantly (no Monaco load time)
12. ✅ No console errors (no web worker issues)
13. ✅ Typing is smooth and responsive

### User Experience

14. ✅ Clear error messages when validation fails
15. ✅ Visual feedback for valid/invalid code
16. ✅ Works reliably in Electron

## Dependencies

- React 19 (existing)
- No new npm packages required (pure React)
- Remove monaco-editor dependency (if unused elsewhere)

## Design Tokens

Use existing Noodl design tokens:

- `--theme-color-bg-2` for editor background
- `--theme-color-bg-3` for line numbers gutter
- `--theme-font-mono` for monospace font
- `--theme-color-error` for error state
- `--theme-color-success` for valid state

## Migration Notes for Users

**No user action required!**

- Your code will load automatically
- All connections will work
- No project updates needed
- Just opens faster and more reliably

## Known Limitations

### No Syntax Highlighting

**Reason:** Keeping it simple and reliable

**Mitigation:** Line numbers and indentation help readability

### Basic Validation Only

**Reason:** Can't run full JavaScript parser without complex dependencies

**Mitigation:** Catches most common errors (missing brackets, quotes, etc.)

### No Autocomplete

**Reason:** Would require Monaco-like complexity

**Mitigation:** Users can reference documentation; experienced users type without autocomplete

## Future Enhancements

- Syntax highlighting via simple tokenizer (not Monaco)
- Basic autocomplete for common patterns
- Code snippets library
- AI-assisted code suggestions
- Search/replace within editor
- Multiple tabs for large scripts

## Related Tasks

- **TASK-008**: JSON Editor (same pattern, proven approach)
- **TASK-006B**: Expression rendering fixes (data model understanding)

---

**Priority**: **HIGH** (Expression nodes are broken right now)
**Risk Level**: **Medium** (mitigated by careful testing)
**Estimated Effort**: 7-10 days
**Critical Success Factor**: **Zero data loss**

---

## Emergency Rollback Plan

If critical issues discovered after deployment:

1. **Revert PR** - Go back to Monaco (even if broken)
2. **Communicate** - Tell users to not edit code until fixed
3. **Fix Quickly** - Address specific issue
4. **Re-deploy** - With fix applied

**Safety net:** Git history preserves everything. No permanent data loss possible.
