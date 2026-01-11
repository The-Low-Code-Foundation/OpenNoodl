# TASK-011 Phase 4: Fix Document State Corruption (Final 5%)

**Status**: 🟡 Ready to Start  
**Priority**: P1 - High (Editor 95% working, final polish needed)  
**Started**: 2026-01-11  
**Depends on**: TASK-011-PHASE-3 (Completed)

---

## Context

Phase 3 successfully fixed the critical cursor positioning and feedback loop issues! The editor is now **95% functional** with excellent features:

### ✅ **What's Working Perfectly (Phase 3 Fixes):**

- ✅ Syntax highlighting with VSCode Dark+ theme
- ✅ Autocompletion with Noodl-specific completions
- ✅ Linting and inline error display
- ✅ **Cursor positioning** (FIXED - no more jumps!)
- ✅ **Click positioning** (accurate)
- ✅ **Arrow navigation** (smooth)
- ✅ **Basic typing** (no lag)
- ✅ Format button (Prettier integration)
- ✅ History tracking and restore
- ✅ Resize functionality
- ✅ Keyboard shortcuts (Cmd+S, Cmd+/, etc.)
- ✅ Line numbers, active line highlighting
- ✅ Search/replace
- ✅ Undo/redo

---

## 🔴 Remaining Issues (5%)

### Issue 1: Empty Braces + Enter Key Corruption

**Problem:**
When typing `{}` and pressing Enter between braces, document state becomes corrupted:

1. Type `{` → closing `}` appears automatically ✅
2. Press Enter between braces
3. **BUG:** Closing brace moves to line 2 (should be line 3)
4. **BUG:** Left gutter highlights lines 2+ as if "inside braces"
5. Try to type text → each character appears on new line (SEVERE)
6. Fold/unfold the braces → temporarily fixes, but re-breaks on unfold

**Expected Behavior:**

```javascript
{
  █  // Cursor here with proper indentation
}
```

**Actual Behavior:**

```javascript
{
}█  // Cursor here, no indentation
// Then each typed character creates a new line
```

### Issue 2: JSON Object Literal Validation

**Problem:**
Typing `{"foo": "bar"}` shows error: `Unexpected token ':'`

**Needs Investigation:**

- This might be **correct** for Expression validation (objects need parens in expressions)
- Need to verify:
  - Does `({"foo": "bar"})` work without error?
  - Is this only in Expression nodes (correct) or also in Script nodes (wrong)?
  - Should we detect object literals and suggest wrapping in parens?

---

## Root Cause Analysis

### Issue 1 Root Cause: Race Condition in State Synchronization

**The Problem:**

```typescript
const handleChange = useCallback(
  (newValue: string) => {
    isInternalChangeRef.current = true;
    // ... update validation, call onChange ...

    setTimeout(() => {
      isInternalChangeRef.current = false; // ❌ NOT RELIABLE
    }, 0);
  },
  [onChange, validationType]
);

useEffect(() => {
  if (isInternalChangeRef.current) return; // Skip internal changes

  // Sync external value changes
  editorViewRef.current.dispatch({
    changes: {
      /* full document replacement */
    }
  });
}, [value, validationType]);
```

**What Goes Wrong:**

1. `closeBrackets()` auto-adds `}` → triggers `handleChange`
2. Sets `isInternalChangeRef.current = true`
3. Calls parent `onChange` with `"{}"`
4. Schedules reset with `setTimeout(..., 0)`
5. **BEFORE setTimeout fires:** React re-renders (validation state change)
6. Value sync `useEffect` sees `isInternalChangeRef` still true → skips (good!)
7. **AFTER setTimeout fires:** Flag resets to false
8. **Another React render happens** (from fold, or validation, or something)
9. Value sync `useEffect` runs with flag = false
10. **Full document replacement** → CORRUPTION

**Additional Factors:**

- `indentOnInput()` extension might be interfering
- `closeBrackets()` + custom Enter handler conflict
- `foldGutter()` operations trigger unexpected re-renders
- Enter key handler may not be firing due to keymap order

---

## Solution Strategy

### Strategy 1: Eliminate Race Condition (Recommended)

**Replace `setTimeout` with more reliable synchronization:**

```typescript
// Use a counter instead of boolean
const changeGenerationRef = useRef(0);

const handleChange = useCallback(
  (newValue: string) => {
    const generation = ++changeGenerationRef.current;

    // Propagate to parent
    if (onChange) onChange(newValue);

    // NO setTimeout - just track generation
  },
  [onChange]
);

useEffect(() => {
  // Check if this is from our last internal change
  const lastGeneration = lastExternalGenerationRef.current;

  if (changeGenerationRef.current > lastGeneration) {
    // We've had internal changes since last external update
    return;
  }

  // Safe to sync
  lastExternalGenerationRef.current = changeGenerationRef.current;
  // ... sync value
}, [value]);
```

### Strategy 2: Fix Extension Conflicts

**Test extensions in isolation:**

```typescript
// Start with MINIMAL extensions
const extensions: Extension[] = [
  javascript(),
  createOpenNoodlTheme(),
  lineNumbers(),
  history(),
  EditorView.lineWrapping,
  customKeybindings(options),
  EditorView.updateListener.of(onChange)
];

// Add back one at a time:
// 1. Test without closeBrackets() - does Enter work?
// 2. Test without indentOnInput() - does Enter work?
// 3. Test without foldGutter() - does Enter work?
```

### Strategy 3: Custom Enter Handler (Already Attempted)

**Current implementation not firing - needs to be FIRST in keymap order:**

```typescript
// Move customKeybindings BEFORE other keymaps in extensions array
const extensions: Extension[] = [
  javascript(),
  createOpenNoodlTheme(),

  // ⚠️ KEYBINDINGS MUST BE EARLY
  customKeybindings(options), // Has custom Enter handler

  // Then other extensions that might handle keys
  bracketMatching(),
  closeBrackets()
  // ...
];
```

---

## Implementation Plan

### Phase 1: Isolate the Problem (30 minutes)

**Goal:** Determine which extension causes the corruption

1. **Strip down to minimal extensions:**

   ```typescript
   const extensions: Extension[] = [
     javascript(),
     createOpenNoodlTheme(),
     lineNumbers(),
     history(),
     EditorView.lineWrapping,
     customKeybindings(options),
     onChange ? EditorView.updateListener.of(...) : []
   ];
   ```

2. **Test basic typing:**

   - Type `{}`
   - Press Enter
   - Does it work? If YES → one of the removed extensions is the culprit

3. **Add extensions back one by one:**
   - Add `closeBrackets()` → test
   - Add `indentOnInput()` → test
   - Add `foldGutter()` → test
   - Add `bracketMatching()` → test
4. **Identify culprit extension(s)**

### Phase 2: Fix Synchronization Race (1 hour)

**Goal:** Eliminate the setTimeout-based race condition

1. **Implement generation counter approach**
2. **Test that value sync doesn't corrupt during typing**
3. **Verify fold/unfold doesn't trigger corruption**

### Phase 3: Fix Enter Key Handler (30 minutes)

**Goal:** Custom Enter handler fires reliably

1. **Move keybindings earlier in extension order**
2. **Add logging to confirm handler fires**
3. **Test brace expansion works correctly**

### Phase 4: Fix JSON Validation (15 minutes)

**Goal:** Clarify if this is bug or correct behavior

1. **Test in Expression node:** `({"foo": "bar"})` - should work
2. **Test in Script node:** `{"foo": "bar"}` - should work
3. **If Expression requires parens:** Add helpful error message or auto-suggestion

### Phase 5: Comprehensive Testing (30 minutes)

**Run all original test cases:**

1. ✅ Basic typing: `hello world`
2. ✅ Empty braces: `{}` → Enter → type inside
3. ✅ Navigation: Arrow keys move correctly
4. ✅ Clicking: Cursor appears at click position
5. ✅ JSON: Object literals validate correctly
6. ✅ Multi-line: Complex code structures
7. ✅ Fold/unfold: No corruption
8. ✅ Format: Code reformats correctly
9. ✅ History: Restore previous versions
10. ✅ Resize: Editor resizes smoothly

---

## Success Criteria

### Must Have:

- [ ] Type `{}`, press Enter, type text → text appears on single line with proper indentation
- [ ] No "character per line" corruption
- [ ] Fold/unfold braces doesn't cause issues
- [ ] All Phase 3 fixes remain working (cursor, navigation, etc.)

### Should Have:

- [ ] JSON object literals handled correctly (or clear error message)
- [ ] Custom Enter handler provides nice brace expansion
- [ ] No console errors
- [ ] Smooth, responsive typing experience

### Nice to Have:

- [ ] Auto-indent works intelligently
- [ ] Bracket auto-closing works without conflicts
- [ ] Code folding available for complex functions

---

## Time Budget

**Estimated Time:** 2-3 hours  
**Maximum Time:** 4 hours before considering alternate approaches

**If exceeds 4 hours:**

- Consider disabling problematic extensions permanently
- Consider simpler Enter key handling
- Consider removing fold functionality if unsolvable

---

## Fallback Options

### Option A: Disable Problematic Extensions

If we can't fix the conflicts, disable:

- `closeBrackets()` - user can type closing braces manually
- `foldGutter()` - less critical feature
- `indentOnInput()` - user can use Tab key

**Pros:** Editor is 100% stable and functional  
**Cons:** Slightly less convenient

### Option B: Simplified Enter Handler

Instead of smart brace handling, just handle Enter normally:

```typescript
// Let default Enter behavior work
// Add one level of indentation when inside braces
// Don't try to auto-expand braces
```

### Option C: Keep Current State

The editor is 95% functional. We could:

- Document the brace issue as known limitation
- Suggest users type closing brace manually first
- Focus on other high-priority tasks

---

## Testing Checklist

After implementing fix:

### Core Functionality

- [ ] Basic typing works smoothly
- [ ] Cursor stays in correct position
- [ ] Click positioning is accurate
- [ ] Arrow key navigation works
- [ ] Syntax highlighting displays correctly

### Brace Handling (The Fix!)

- [ ] Type `{}` → closes automatically
- [ ] Press Enter between braces → creates 3 lines
- [ ] Cursor positioned on middle line with indentation
- [ ] Type text → appears on that line (NOT new lines)
- [ ] Closing brace is on its own line
- [ ] No corruption after fold/unfold

### Validation

- [ ] Invalid code shows error
- [ ] Valid code shows green checkmark
- [ ] Error messages are helpful
- [ ] Object literals handled correctly

### Advanced Features

- [ ] Format button works
- [ ] History restore works
- [ ] Cmd+S saves
- [ ] Cmd+/ toggles comments
- [ ] Resize grip works
- [ ] Search/replace works

### Edge Cases

- [ ] Empty editor → start typing works
- [ ] Select all → replace works
- [ ] Undo/redo doesn't corrupt
- [ ] Multiple nested braces work
- [ ] Long lines wrap correctly

---

## Notes

### What Phase 3 Accomplished

Phase 3 fixed the **critical** issue - the cursor feedback loop that made the editor unusable. The fixes were:

1. **Removed `setLocalValue()` during typing** - eliminated re-render storms
2. **Added `isInternalChangeRef` flag** - prevents value sync loops
3. **Made CodeMirror single source of truth** - cleaner architecture
4. **Preserved cursor during external updates** - smooth when needed

These changes brought the editor from "completely broken" to "95% excellent".

### What Phase 4 Needs to Do

Phase 4 is about **polishing the last 5%** - fixing edge cases with auto-bracket expansion and Enter key handling. This is much simpler than Phase 3's fundamental architectural fix.

### Key Insight

The issue is NOT with our Phase 3 fixes - those work great for normal typing. The issue is **conflicts between CodeMirror extensions** when handling special keys (Enter) and operations (fold/unfold).

---

## References

- **Phase 3 Task:** `TASK-011-PHASE-3-CURSOR-FIXES.md` - Background on cursor fixes
- **CodeMirror Docs:** https://codemirror.net/docs/
- **Extension Conflicts:** https://codemirror.net/examples/config/
- **Keymap Priority:** https://codemirror.net/docs/ref/#view.keymap

---

_Created: 2026-01-11_  
_Last Updated: 2026-01-11_
