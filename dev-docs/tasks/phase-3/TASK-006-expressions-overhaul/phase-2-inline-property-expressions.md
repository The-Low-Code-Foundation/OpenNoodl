# TASK: Inline Expression Properties in Property Panel

## Overview

Add the ability to toggle any node property between "fixed value" and "expression mode" directly in the property panel - similar to n8n's approach. When in expression mode, users can write JavaScript expressions that evaluate at runtime with full access to Noodl globals.

**Estimated effort:** 3-4 weeks  
**Priority:** High - Major UX modernization  
**Dependencies:** Phase 1 (Enhanced Expression Node) must be complete

---

## Background & Motivation

### The Problem Today

To make any property dynamic in Noodl, users must:
1. Create a separate Expression, Variable, or Function node
2. Configure that node with the logic
3. Draw a connection cable to the target property
4. Repeat for every dynamic value

**Result:** Canvas cluttered with helper nodes, hard to understand data flow.

### The Solution

Every property input gains a toggle between:
- **Fixed Mode** (default): Traditional static value editing
- **Expression Mode**: JavaScript expression evaluated at runtime

```
┌─────────────────────────────────────────────────────────────┐
│ Margin Left                                                  │
│ ┌────────┬────────────────────────────────────────────┬───┐ │
│ │ Fixed  │ 16                                         │ ⚡ │ │
│ └────────┴────────────────────────────────────────────┴───┘ │
│                                                              │
│ After clicking ⚡ toggle:                                    │
│                                                              │
│ ┌────────┬────────────────────────────────────────────┬───┐ │
│ │   fx   │ Noodl.Variables.isMobile ? 8 : 16          │ ⚡ │ │
│ └────────┴────────────────────────────────────────────┴───┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Analyze First

### Phase 1 Foundation (must be complete)
```
@packages/noodl-runtime/src/expression-evaluator.js
```
- Expression compilation and evaluation
- Dependency detection
- Change subscription

### Property Panel Architecture
```
@packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.tsx
@packages/noodl-core-ui/src/components/property-panel/README.md
@packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.ts
@packages/noodl-editor/src/editor/src/views/panels/propertyeditor/index.tsx
```
- Property panel component structure
- How different property types are rendered
- Property value flow from model to UI and back

### Type-Specific Editors
```
@packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts
@packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BooleanType.ts
@packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/ColorType.ts
@packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/VariableType.ts
```
- Pattern for different input types
- How values are stored and retrieved

### Node Model & Parameters
```
@packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts
@packages/noodl-runtime/src/node.js
```
- How parameters are stored
- Parameter update events
- Visual state parameter patterns (`paramName_stateName`)

### Port/Connection System
```
@packages/noodl-editor/src/editor/src/models/nodelibrary/nodelibrary.ts
```
- Port type definitions
- Connection state detection (`isConnected`)

---

## Implementation Plan

### Step 1: Extend Parameter Storage Model

Parameters need to support both simple values and expression metadata.

**Modify:** Node model parameter handling

```typescript
// New parameter value types
interface FixedParameter {
  value: any;
}

interface ExpressionParameter {
  mode: 'expression';
  expression: string;
  fallback?: any;  // Value to use if expression errors
  version?: number; // Expression system version for migration
}

type ParameterValue = any | ExpressionParameter;

// Helper to check if parameter is expression
function isExpressionParameter(param: any): param is ExpressionParameter {
  return param && typeof param === 'object' && param.mode === 'expression';
}

// Helper to get display value
function getParameterDisplayValue(param: ParameterValue): any {
  if (isExpressionParameter(param)) {
    return param.expression;
  }
  return param;
}
```

**Ensure backward compatibility:**
- Simple values (strings, numbers, etc.) continue to work as-is
- Expression parameters are objects with `mode: 'expression'`
- Serialization/deserialization handles both formats

### Step 2: Create Expression Toggle Component

**Create file:** `packages/noodl-core-ui/src/components/property-panel/ExpressionToggle/ExpressionToggle.tsx`

```tsx
import React from 'react';
import { IconButton, IconButtonVariant } from '../../inputs/IconButton';
import { IconName, IconSize } from '../../common/Icon';
import { Tooltip } from '../../popups/Tooltip';
import css from './ExpressionToggle.module.scss';

export interface ExpressionToggleProps {
  mode: 'fixed' | 'expression';
  isConnected?: boolean;  // Port has cable connection
  onToggle: () => void;
  disabled?: boolean;
}

export function ExpressionToggle({
  mode,
  isConnected,
  onToggle,
  disabled
}: ExpressionToggleProps) {
  // If connected via cable, show connection indicator instead
  if (isConnected) {
    return (
      <Tooltip content="Connected via cable">
        <div className={css.connectionIndicator}>
          <Icon name={IconName.Connection} size={IconSize.Tiny} />
        </div>
      </Tooltip>
    );
  }
  
  const tooltipText = mode === 'expression'
    ? 'Switch to fixed value'
    : 'Switch to expression';
  
  return (
    <Tooltip content={tooltipText}>
      <IconButton
        icon={mode === 'expression' ? IconName.Function : IconName.Lightning}
        size={IconSize.Tiny}
        variant={mode === 'expression' 
          ? IconButtonVariant.Active 
          : IconButtonVariant.OpaqueOnHover}
        onClick={onToggle}
        isDisabled={disabled}
        UNSAFE_className={mode === 'expression' ? css.expressionActive : undefined}
      />
    </Tooltip>
  );
}
```

**Create file:** `packages/noodl-core-ui/src/components/property-panel/ExpressionToggle/ExpressionToggle.module.scss`

```scss
.connectionIndicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.expressionActive {
  background-color: var(--theme-color-expression-bg, #6366f1);
  color: white;
  
  &:hover {
    background-color: var(--theme-color-expression-bg-hover, #4f46e5);
  }
}
```

### Step 3: Create Expression Input Component

**Create file:** `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.tsx`

```tsx
import React, { useState, useCallback } from 'react';
import { TextInput, TextInputVariant } from '../../inputs/TextInput';
import { IconButton } from '../../inputs/IconButton';
import { IconName, IconSize } from '../../common/Icon';
import { Tooltip } from '../../popups/Tooltip';
import css from './ExpressionInput.module.scss';

export interface ExpressionInputProps {
  expression: string;
  onChange: (expression: string) => void;
  onOpenBuilder?: () => void;
  expectedType?: string;  // 'string', 'number', 'boolean', 'color'
  hasError?: boolean;
  errorMessage?: string;
}

export function ExpressionInput({
  expression,
  onChange,
  onOpenBuilder,
  expectedType,
  hasError,
  errorMessage
}: ExpressionInputProps) {
  const [localValue, setLocalValue] = useState(expression);
  
  const handleBlur = useCallback(() => {
    if (localValue !== expression) {
      onChange(localValue);
    }
  }, [localValue, expression, onChange]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      onChange(localValue);
    }
  }, [localValue, onChange]);
  
  return (
    <div className={css.container}>
      <span className={css.badge}>fx</span>
      <TextInput
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        variant={TextInputVariant.Transparent}
        placeholder="Enter expression..."
        UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px' }}
        UNSAFE_className={hasError ? css.hasError : undefined}
      />
      {onOpenBuilder && (
        <Tooltip content="Open expression builder (Cmd+Shift+E)">
          <IconButton
            icon={IconName.Expand}
            size={IconSize.Tiny}
            onClick={onOpenBuilder}
          />
        </Tooltip>
      )}
      {hasError && errorMessage && (
        <Tooltip content={errorMessage}>
          <div className={css.errorIndicator}>!</div>
        </Tooltip>
      )}
    </div>
  );
}
```

**Create file:** `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.module.scss`

```scss
.container {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--theme-color-expression-input-bg, rgba(99, 102, 241, 0.1));
  border-radius: 4px;
  padding: 0 4px;
  border: 1px solid var(--theme-color-expression-border, rgba(99, 102, 241, 0.3));
}

.badge {
  font-family: monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-color-expression-badge, #6366f1);
  padding: 2px 4px;
  background-color: var(--theme-color-expression-badge-bg, rgba(99, 102, 241, 0.2));
  border-radius: 2px;
}

.hasError {
  border-color: var(--theme-color-error, #ef4444);
}

.errorIndicator {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--theme-color-error, #ef4444);
  color: white;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
}
```

### Step 4: Integrate with PropertyPanelInput

**Modify:** `packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.tsx`

```tsx
// Add to imports
import { ExpressionToggle } from '../ExpressionToggle';
import { ExpressionInput } from '../ExpressionInput';

// Extend props interface
export interface PropertyPanelInputProps extends Omit<PropertyPanelBaseInputProps, 'type'> {
  label: string;
  inputType: PropertyPanelInputType;
  properties: TSFixme;
  
  // Expression support (new)
  supportsExpression?: boolean;  // Default true for most types
  expressionMode?: 'fixed' | 'expression';
  expression?: string;
  isConnected?: boolean;
  onExpressionModeChange?: (mode: 'fixed' | 'expression') => void;
  onExpressionChange?: (expression: string) => void;
}

export function PropertyPanelInput({
  label,
  value,
  inputType = PropertyPanelInputType.Text,
  properties,
  isChanged,
  isConnected,
  onChange,
  // Expression props
  supportsExpression = true,
  expressionMode = 'fixed',
  expression,
  onExpressionModeChange,
  onExpressionChange
}: PropertyPanelInputProps) {
  
  // Determine if we should show expression UI
  const showExpressionToggle = supportsExpression && !isConnected;
  const isExpressionMode = expressionMode === 'expression';
  
  // Handle mode toggle
  const handleToggleMode = () => {
    if (onExpressionModeChange) {
      onExpressionModeChange(isExpressionMode ? 'fixed' : 'expression');
    }
  };
  
  // Render expression input or standard input
  const renderInput = () => {
    if (isExpressionMode && onExpressionChange) {
      return (
        <ExpressionInput
          expression={expression || ''}
          onChange={onExpressionChange}
          expectedType={inputType}
        />
      );
    }
    
    // Standard input rendering (existing code)
    const Input = useMemo(() => {
      switch (inputType) {
        case PropertyPanelInputType.Text:
          return PropertyPanelTextInput;
        // ... rest of existing switch
      }
    }, [inputType]);
    
    return (
      <Input
        value={value}
        properties={properties}
        isChanged={isChanged}
        isConnected={isConnected}
        onChange={onChange}
      />
    );
  };
  
  return (
    <div className={css.container}>
      <label className={css.label}>{label}</label>
      <div className={css.inputRow}>
        {renderInput()}
        {showExpressionToggle && (
          <ExpressionToggle
            mode={expressionMode}
            isConnected={isConnected}
            onToggle={handleToggleMode}
          />
        )}
      </div>
    </div>
  );
}
```

### Step 5: Wire Up to Property Editor

**Modify:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts`

This is where the connection between the model and property panel happens. Add expression support:

```typescript
// In the render or value handling logic:

// Check if current parameter value is an expression
const paramValue = parent.model.parameters[port.name];
const isExpressionMode = isExpressionParameter(paramValue);

// When mode changes:
onExpressionModeChange(mode) {
  if (mode === 'expression') {
    // Convert current value to expression parameter
    const currentValue = parent.model.parameters[port.name];
    parent.model.setParameter(port.name, {
      mode: 'expression',
      expression: String(currentValue || ''),
      fallback: currentValue,
      version: ExpressionEvaluator.EXPRESSION_VERSION
    });
  } else {
    // Convert back to fixed value
    const param = parent.model.parameters[port.name];
    const fixedValue = isExpressionParameter(param) ? param.fallback : param;
    parent.model.setParameter(port.name, fixedValue);
  }
}

// When expression changes:
onExpressionChange(expression) {
  const param = parent.model.parameters[port.name];
  if (isExpressionParameter(param)) {
    parent.model.setParameter(port.name, {
      ...param,
      expression
    });
  }
}
```

### Step 6: Runtime Expression Evaluation

**Modify:** `packages/noodl-runtime/src/node.js`

Add expression evaluation to the parameter update flow:

```javascript
// In Node.prototype._onNodeModelParameterUpdated or similar:

Node.prototype._evaluateExpressionParameter = function(paramName, paramValue) {
  const ExpressionEvaluator = require('./expression-evaluator');
  
  if (!paramValue || paramValue.mode !== 'expression') {
    return paramValue;
  }
  
  // Compile and evaluate
  const compiled = ExpressionEvaluator.compileExpression(paramValue.expression);
  if (!compiled) {
    return paramValue.fallback;
  }
  
  const result = ExpressionEvaluator.evaluateExpression(compiled, this.context?.modelScope);
  
  // Set up reactive subscription if not already
  if (!this._expressionSubscriptions) {
    this._expressionSubscriptions = {};
  }
  
  if (!this._expressionSubscriptions[paramName]) {
    const deps = ExpressionEvaluator.detectDependencies(paramValue.expression);
    if (deps.variables.length > 0 || deps.objects.length > 0 || deps.arrays.length > 0) {
      this._expressionSubscriptions[paramName] = ExpressionEvaluator.subscribeToChanges(
        deps,
        () => {
          // Re-evaluate and update
          const newResult = ExpressionEvaluator.evaluateExpression(compiled, this.context?.modelScope);
          this.queueInput(paramName, newResult);
        },
        this.context?.modelScope
      );
    }
  }
  
  return result !== undefined ? result : paramValue.fallback;
};

// Clean up subscriptions on delete
Node.prototype._onNodeDeleted = function() {
  // ... existing cleanup ...
  
  // Clean up expression subscriptions
  if (this._expressionSubscriptions) {
    for (const unsub of Object.values(this._expressionSubscriptions)) {
      if (typeof unsub === 'function') unsub();
    }
    this._expressionSubscriptions = null;
  }
};
```

### Step 7: Expression Builder Modal (Optional Enhancement)

**Create file:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionBuilder/ExpressionBuilder.tsx`

A full-featured modal for complex expression editing:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@noodl-core-ui/components/layout/Modal';
import { MonacoEditor } from '@noodl-core-ui/components/inputs/MonacoEditor';
import { TreeView } from '@noodl-core-ui/components/tree/TreeView';
import css from './ExpressionBuilder.module.scss';

interface ExpressionBuilderProps {
  isOpen: boolean;
  expression: string;
  expectedType?: string;
  onApply: (expression: string) => void;
  onCancel: () => void;
}

export function ExpressionBuilder({
  isOpen,
  expression: initialExpression,
  expectedType,
  onApply,
  onCancel
}: ExpressionBuilderProps) {
  const [expression, setExpression] = useState(initialExpression);
  const [preview, setPreview] = useState<{ result: any; error?: string }>({ result: null });
  
  // Build available completions tree
  const completionsTree = useMemo(() => {
    // This would be populated from actual project data
    return [
      {
        label: 'Noodl',
        children: [
          {
            label: 'Variables',
            children: [] // Populated from Noodl.Variables
          },
          {
            label: 'Objects',
            children: [] // Populated from known Object IDs
          },
          {
            label: 'Arrays',
            children: [] // Populated from known Array IDs
          }
        ]
      },
      {
        label: 'Math',
        children: [
          { label: 'min(a, b)', insertText: 'min()' },
          { label: 'max(a, b)', insertText: 'max()' },
          { label: 'round(n)', insertText: 'round()' },
          { label: 'floor(n)', insertText: 'floor()' },
          { label: 'ceil(n)', insertText: 'ceil()' },
          { label: 'abs(n)', insertText: 'abs()' },
          { label: 'sqrt(n)', insertText: 'sqrt()' },
          { label: 'pow(base, exp)', insertText: 'pow()' },
          { label: 'pi', insertText: 'pi' },
          { label: 'random()', insertText: 'random()' }
        ]
      }
    ];
  }, []);
  
  // Live preview
  useEffect(() => {
    const ExpressionEvaluator = require('@noodl/runtime/src/expression-evaluator');
    const validation = ExpressionEvaluator.validateExpression(expression);
    
    if (!validation.valid) {
      setPreview({ result: null, error: validation.error });
      return;
    }
    
    const compiled = ExpressionEvaluator.compileExpression(expression);
    if (compiled) {
      const result = ExpressionEvaluator.evaluateExpression(compiled);
      setPreview({ result, error: undefined });
    }
  }, [expression]);
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Expression Builder"
      size="large"
    >
      <div className={css.container}>
        <div className={css.editor}>
          <MonacoEditor
            value={expression}
            onChange={setExpression}
            language="javascript"
            options={{
              minimap: { enabled: false },
              lineNumbers: 'off',
              fontSize: 14,
              wordWrap: 'on'
            }}
          />
        </div>
        
        <div className={css.sidebar}>
          <div className={css.completions}>
            <h4>Available</h4>
            <TreeView
              items={completionsTree}
              onItemClick={(item) => {
                // Insert at cursor
                if (item.insertText) {
                  setExpression(prev => prev + item.insertText);
                }
              }}
            />
          </div>
          
          <div className={css.preview}>
            <h4>Preview</h4>
            {preview.error ? (
              <div className={css.error}>{preview.error}</div>
            ) : (
              <div className={css.result}>
                <div className={css.resultLabel}>Result:</div>
                <div className={css.resultValue}>
                  {JSON.stringify(preview.result)}
                </div>
                <div className={css.resultType}>
                  Type: {typeof preview.result}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className={css.actions}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => onApply(expression)}>Apply</button>
        </div>
      </div>
    </Modal>
  );
}
```

### Step 8: Add Keyboard Shortcuts

**Modify:** `packages/noodl-editor/src/editor/src/constants/Keybindings.ts`

```typescript
export namespace Keybindings {
  // ... existing keybindings ...
  
  // Expression shortcuts (new)
  export const TOGGLE_EXPRESSION_MODE = new Keybinding(KeyMod.CtrlCmd, KeyCode.KEY_E);
  export const OPEN_EXPRESSION_BUILDER = new Keybinding(KeyMod.CtrlCmd, KeyMod.Shift, KeyCode.KEY_E);
}
```

### Step 9: Handle Property Types

Different property types need type-appropriate expression handling:

| Property Type | Expression Returns | Coercion |
|--------------|-------------------|----------|
| `string` | Any → String | `String(result)` |
| `number` | Number | `Number(result) \|\| fallback` |
| `boolean` | Truthy/Falsy | `!!result` |
| `color` | Hex/RGB string | Validate format |
| `enum` | Enum value string | Validate against options |
| `component` | Component name | Validate exists |

**Create file:** `packages/noodl-runtime/src/expression-type-coercion.js`

```javascript
/**
 * Coerce expression result to expected property type
 */
function coerceToType(value, expectedType, fallback, enumOptions) {
  if (value === undefined || value === null) {
    return fallback;
  }
  
  switch (expectedType) {
    case 'string':
      return String(value);
      
    case 'number':
      const num = Number(value);
      return isNaN(num) ? fallback : num;
      
    case 'boolean':
      return !!value;
      
    case 'color':
      const str = String(value);
      // Basic validation for hex or rgb
      if (/^#[0-9A-Fa-f]{6}$/.test(str) || /^rgba?\(/.test(str)) {
        return str;
      }
      return fallback;
      
    case 'enum':
      const enumVal = String(value);
      if (enumOptions && enumOptions.some(opt => 
        opt === enumVal || opt.value === enumVal
      )) {
        return enumVal;
      }
      return fallback;
      
    default:
      return value;
  }
}

module.exports = { coerceToType };
```

---

## Success Criteria

### Functional Requirements

- [ ] Expression toggle button appears on supported property types
- [ ] Toggle switches between fixed and expression modes
- [ ] Expression mode shows `fx` badge and code-style input
- [ ] Expression evaluates correctly at runtime
- [ ] Expression re-evaluates when dependencies change
- [ ] Connected ports (via cables) disable expression mode
- [ ] Type coercion works for each property type
- [ ] Invalid expressions show error state
- [ ] Copy/paste expressions works
- [ ] Expression builder modal opens (Cmd+Shift+E)
- [ ] Undo/redo works for expression changes

### Property Types Supported

- [ ] String (`PropertyPanelTextInput`)
- [ ] Number (`PropertyPanelNumberInput`)
- [ ] Number with units (`PropertyPanelLengthUnitInput`)
- [ ] Boolean (`PropertyPanelCheckbox`)
- [ ] Select/Enum (`PropertyPanelSelectInput`)
- [ ] Slider (`PropertyPanelSliderInput`)
- [ ] Color (`ColorType` / color picker)

### Non-Functional Requirements

- [ ] No performance regression in property panel rendering
- [ ] Expressions compile once, evaluate efficiently
- [ ] Memory cleanup when nodes are deleted
- [ ] Backward compatibility with existing projects

---

## Testing Checklist

### Manual Testing

1. **Basic Toggle**
   - Select a Group node
   - Find the "Margin Left" property
   - Click expression toggle button
   - Verify UI changes to expression mode
   - Toggle back to fixed mode
   - Verify original value is preserved

2. **Expression Evaluation**
   - Set a Group's margin to expression mode
   - Enter: `Noodl.Variables.spacing || 16`
   - Set `Noodl.Variables.spacing = 32` in a Function node
   - Verify margin updates to 32

3. **Reactive Updates**
   - Create expression: `Noodl.Variables.isExpanded ? 200 : 50`
   - Add button that toggles `Noodl.Variables.isExpanded`
   - Click button, verify property updates
   
4. **Connected Port Behavior**
   - Connect an output to a property input
   - Verify expression toggle is disabled/hidden
   - Disconnect
   - Verify toggle is available again

5. **Type Coercion**
   - Number property with expression returning string "42"
   - Verify it coerces to number 42
   - Boolean property with expression returning "yes"
   - Verify it coerces to true

6. **Error Handling**
   - Enter invalid expression: `1 +`
   - Verify error indicator appears
   - Verify property uses fallback value
   - Fix expression
   - Verify error clears

7. **Undo/Redo**
   - Change property to expression mode
   - Undo (Cmd+Z)
   - Verify returns to fixed mode
   - Redo
   - Verify returns to expression mode

8. **Project Save/Load**
   - Create property with expression
   - Save project
   - Close and reopen project
   - Verify expression is preserved and working

### Property Type Coverage

- [ ] Text input with expression
- [ ] Number input with expression
- [ ] Number with units (px, %, etc.) with expression
- [ ] Checkbox/boolean with expression
- [ ] Dropdown/select with expression
- [ ] Color picker with expression
- [ ] Slider with expression

### Edge Cases

- [ ] Expression referencing non-existent variable
- [ ] Expression with runtime error (division by zero)
- [ ] Very long expression
- [ ] Expression with special characters
- [ ] Expression in visual state parameter
- [ ] Expression in variant parameter

---

## Migration Considerations

### Existing Projects

- Existing projects have simple parameter values
- These continue to work as-is (backward compatible)
- No automatic migration needed

### Future Expression Version Changes

If we need to change the expression context in the future:
1. Increment `EXPRESSION_VERSION` in expression-evaluator.js
2. Add migration logic to handle old version expressions
3. Show warning for expressions with old version

---

## Notes for Implementer

### Important Patterns

1. **Model-View Separation**
   - Property panel is the view
   - NodeGraphNode.parameters is the model
   - Changes go through `setParameter()` for undo support

2. **Port Connection Priority**
   - Connected ports take precedence over expressions
   - Connected ports take precedence over fixed values
   - This is existing behavior, preserve it

3. **Visual States**
   - Visual state parameters use `paramName_stateName` pattern
   - Expression parameters in visual states need same pattern
   - Example: `marginLeft_hover` could be an expression

### Edge Cases to Handle

1. **Expression references port that's also connected**
   - Expression should still work
   - Connected value might be available via `this.inputs.X`

2. **Circular expressions**
   - Expression A references Variable that's set by Expression B
   - Shouldn't cause infinite loop (dependency tracking prevents)

3. **Expressions in cloud runtime**
   - Cloud uses different Noodl.js API
   - Ensure expression-evaluator works in both contexts

### Questions to Resolve

1. **Which property types should NOT support expressions?**
   - Recommendation: component picker, image picker
   - These need special UI that doesn't fit expression pattern

2. **Should expressions work in style properties?**
   - Recommendation: Yes, if using inputCss pattern
   - CSS values often need to be dynamic

3. **Mobile/responsive expressions?**
   - Recommendation: Expressions can reference `Noodl.Variables.screenWidth`
   - Combine with existing variants system

---

## Files Created/Modified Summary

### New Files
- `packages/noodl-core-ui/src/components/property-panel/ExpressionToggle/ExpressionToggle.tsx`
- `packages/noodl-core-ui/src/components/property-panel/ExpressionToggle/ExpressionToggle.module.scss`
- `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.tsx`
- `packages/noodl-core-ui/src/components/property-panel/ExpressionInput/ExpressionInput.module.scss`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionBuilder/ExpressionBuilder.tsx`
- `packages/noodl-runtime/src/expression-type-coercion.js`

### Modified Files
- `packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BooleanType.ts`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/ColorType.ts`
- `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts`
- `packages/noodl-runtime/src/node.js`
- `packages/noodl-editor/src/editor/src/constants/Keybindings.ts`
