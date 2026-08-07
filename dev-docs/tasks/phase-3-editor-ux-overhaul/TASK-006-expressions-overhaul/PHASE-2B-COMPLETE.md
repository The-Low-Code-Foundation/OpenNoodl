# Phase 2B: Inline Property Expressions - COMPLETE ✅

**Started:** 2026-01-10  
**Completed:** 2026-01-16  
**Status:** ✅ COMPLETE

---

## Summary

Inline property expressions are now fully functional! Users can set property values using JavaScript expressions that reference Noodl.Variables, Noodl.Objects, and Noodl.Arrays. Expressions update reactively when their dependencies change.

---

## ✅ What Was Implemented

### 1. ExpressionInput Component - COMPLETE ✅

**Files Created:**

- `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.tsx`
- `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.module.scss`

**Features:**

- Monospace input field with "fx" badge
- Expression mode toggle
- Expand button to open full editor modal
- Error state display

---

### 2. ExpressionEditorModal - COMPLETE ✅

**Files Created:**

- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/ExpressionEditorModal.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/ExpressionEditorModal.module.scss`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/index.ts`

**Features:**

- Full-screen modal for editing complex expressions
- Uses JavaScriptEditor (CodeMirror) for syntax highlighting
- Help documentation showing available globals (Noodl.Variables, etc.)
- Apply/Cancel buttons

---

### 3. PropertyPanelInput Integration - COMPLETE ✅

**Files Modified:**

- `packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.tsx`

**Features:**

- Added expression-related props (supportsExpression, expressionMode, expression, etc.)
- Conditional rendering: expression input vs fixed input
- Mode change handlers

---

### 4. PropertyPanelInputWithExpressionModal Wrapper - COMPLETE ✅

**Files Created:**

- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/PropertyPanelInputWithExpressionModal.tsx`

**Features:**

- Combines PropertyPanelInput with ExpressionEditorModal
- Manages modal open/close state
- Handles expression expand functionality

---

### 5. BasicType Property Editor Wiring - COMPLETE ✅

**Files Modified:**

- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts`

**Features:**

- Uses React for rendering via createRoot
- Supports expression mode toggle
- Integrates with ExpressionParameter model
- Uses ParameterValueResolver for safe value display

---

### 6. Runtime Reactive Subscriptions - COMPLETE ✅

**Files Modified:**

- `packages/noodl-runtime/src/node.js`

**Features:**

- `_evaluateExpressionParameter()` now sets up reactive subscriptions
- Uses `detectDependencies()` to find referenced Variables/Objects/Arrays
- Uses `subscribeToChanges()` to listen for dependency updates
- Re-queues input when dependencies change
- Cleanup in `_onNodeDeleted()`

---

## 🎯 How It Works

### User Experience

1. Select a node with text/number properties
2. Click the "fx" button to toggle expression mode
3. Enter an expression like `Noodl.Variables.userName`
4. The value updates automatically when the variable changes
5. Click the expand button for a full code editor modal

### Supported Expressions

```javascript
// Simple variable access
Noodl.Variables.userName;

// Math operations
Noodl.Variables.count * 2 + 1;

// Ternary conditionals
Noodl.Variables.isLoggedIn ? 'Logout' : 'Login';

// String concatenation
'Hello, ' + Noodl.Variables.userName + '!';

// Math helpers
min(Noodl.Variables.price, 100);
max(10, Noodl.Variables.quantity);
round(Noodl.Variables.total);

// Object/Array access
Noodl.Objects['user'].name;
Noodl.Arrays['items'].length;
```

---

## 📁 Files Changed

### Created

- `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.tsx`
- `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.module.scss`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/ExpressionEditorModal.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/ExpressionEditorModal.module.scss`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/index.ts`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/PropertyPanelInputWithExpressionModal.tsx`

### Modified

- `packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts`
- `packages/noodl-runtime/src/node.js` (added reactive subscriptions)

---

## 🐛 Bug Fixes (2026-01-16)

### Modal Showing Stale Expression

**Problem:** When editing an expression in the inline input field and then opening the modal, the modal showed the old expression text instead of the current one.

**Root Cause:** `BasicType.ts` was not re-rendering after `onExpressionChange`, so the modal component never received the updated expression prop.

**Fix:** Added `setTimeout(() => this.renderReact(), 0)` at the end of `onExpressionChange` in `BasicType.ts` to ensure the React tree updates with the new expression value.

### Variable Changes Not Updating Node Values

**Problem:** When using an expression like `Noodl.Variables.label_text`, changing the variable value didn't update the node's property until the expression was manually saved again.

**Root Cause:** The subscription callback in `node.js` captured the old `paramValue` object in a closure. When the subscription fired, it re-queued the old expression, not the current one stored in `_inputValues`.

**Fix:** Updated subscription management in `_evaluateExpressionParameter()`:

- Subscriptions now track both the unsubscribe function AND the expression string
- When expression changes, old subscription is unsubscribed before creating a new one
- The callback now reads from `this._inputValues[portName]` (current value) instead of using a closure

**Files Modified:**

- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts`
- `packages/noodl-runtime/src/node.js`

---

## 🎓 Key Learnings

### Context Issue

The `evaluateExpression()` function in expression-evaluator.js expects either `undefined` or a Model scope as the second parameter. Passing `this.context` (the runtime context with editorConnection, styles, etc.) caused "scope.get is not a function" errors. **Solution:** Pass `undefined` to use the global Model.

### Reactive Updates

The expression-evaluator module already had `detectDependencies()` and `subscribeToChanges()` functions. We just needed to wire them into `_evaluateExpressionParameter()` in node.js to enable reactive updates.

### Value Display

Expression parameters are objects (`{ mode: 'expression', expression: '...', fallback: ... }`). When displaying the value in the properties panel, we need to extract the fallback value, not display the object. The `ParameterValueResolver.toString()` helper handles this.

---

## 🚀 Future Enhancements

1. **Canvas rendering** - Show expression indicator on node ports (TASK-006B)
2. **More property types** - Extend to color, enum, and other types
3. **Expression autocomplete** - IntelliSense for Noodl.Variables names
4. **Expression validation** - Real-time syntax checking

---

**Last Updated:** 2026-01-16
