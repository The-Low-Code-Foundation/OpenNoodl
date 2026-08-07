# Phase 5: Visual States + Breakpoints Combo

## Overview

Enable granular control where users can define values for specific combinations of visual state AND breakpoint. For example: "button hover state on tablet" can have different padding than "button hover state on desktop".

**Estimate:** 2 days

**Dependencies:** Phases 1-4

## Goals

1. Add `stateBreakpointParameters` storage for combined state+breakpoint values
2. Implement resolution hierarchy with combo values at highest priority
3. Update property panel UI to show combo editing option
4. Ensure runtime correctly resolves combo values

## When This Is Useful

Without combo support:
- Button hover padding is `20px` (all breakpoints)
- Button tablet padding is `16px` (all states)
- When hovering on tablet → ambiguous! Which wins?

With combo support:
- Can explicitly set: "button hover ON tablet = `18px`"
- Clear, deterministic resolution

## Data Model

```javascript
{
  parameters: {
    paddingLeft: '24px'           // base
  },
  stateParameters: {
    hover: { paddingLeft: '28px' } // hover state (all breakpoints)
  },
  breakpointParameters: {
    tablet: { paddingLeft: '16px' } // tablet (all states)
  },
  // NEW: Combined state + breakpoint
  stateBreakpointParameters: {
    'hover:tablet': { paddingLeft: '20px' },  // hover ON tablet
    'hover:phone': { paddingLeft: '14px' },   // hover ON phone
    'pressed:tablet': { paddingLeft: '18px' } // pressed ON tablet
  }
}
```

## Resolution Hierarchy

From highest to lowest priority:

```
1. stateBreakpointParameters['hover:tablet']  // Most specific
   ↓ (if undefined)
2. stateParameters['hover']                   // State-specific
   ↓ (if undefined)  
3. breakpointParameters['tablet']             // Breakpoint-specific
   ↓ (if undefined, cascade to larger breakpoints)
4. parameters                                 // Base value
   ↓ (if undefined)
5. variant values (same hierarchy)
   ↓ (if undefined)
6. type default
```

## Implementation Steps

### Step 1: Extend NodeGraphNode Model

**File:** `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts`

```typescript
export class NodeGraphNode {
  // ... existing properties
  
  // NEW
  stateBreakpointParameters: Record<string, Record<string, any>>;
  
  constructor(args) {
    // ... existing initialization
    this.stateBreakpointParameters = args.stateBreakpointParameters || {};
  }
  
  // NEW methods
  getStateBreakpointKey(state: string, breakpoint: string): string {
    return `${state}:${breakpoint}`;
  }
  
  hasStateBreakpointParameter(name: string, state: string, breakpoint: string): boolean {
    const key = this.getStateBreakpointKey(state, breakpoint);
    return this.stateBreakpointParameters?.[key]?.[name] !== undefined;
  }
  
  getStateBreakpointParameter(name: string, state: string, breakpoint: string): any {
    const key = this.getStateBreakpointKey(state, breakpoint);
    return this.stateBreakpointParameters?.[key]?.[name];
  }
  
  setStateBreakpointParameter(
    name: string, 
    value: any, 
    state: string, 
    breakpoint: string, 
    args?: any
  ): void {
    const key = this.getStateBreakpointKey(state, breakpoint);
    
    if (!this.stateBreakpointParameters) {
      this.stateBreakpointParameters = {};
    }
    if (!this.stateBreakpointParameters[key]) {
      this.stateBreakpointParameters[key] = {};
    }
    
    const oldValue = this.stateBreakpointParameters[key][name];
    
    if (value === undefined) {
      delete this.stateBreakpointParameters[key][name];
      // Clean up empty objects
      if (Object.keys(this.stateBreakpointParameters[key]).length === 0) {
        delete this.stateBreakpointParameters[key];
      }
    } else {
      this.stateBreakpointParameters[key][name] = value;
    }
    
    this.notifyListeners('parametersChanged', { 
      name, 
      value, 
      state, 
      breakpoint,
      combo: true 
    });
    
    // Undo support
    if (args?.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;
      
      undo.push({
        label: args.label || `change ${name} for ${state} on ${breakpoint}`,
        do: () => this.setStateBreakpointParameter(name, value, state, breakpoint),
        undo: () => this.setStateBreakpointParameter(name, oldValue, state, breakpoint)
      });
    }
  }
  
  // Updated getParameter with full resolution
  getParameter(name: string, args?: { state?: string; breakpoint?: string }): any {
    const state = args?.state;
    const breakpoint = args?.breakpoint;
    const defaultBreakpoint = ProjectModel.instance.getBreakpointSettings().defaultBreakpoint;
    
    // 1. Check state + breakpoint combo (most specific)
    if (state && state !== 'neutral' && breakpoint && breakpoint !== defaultBreakpoint) {
      const comboValue = this.getStateBreakpointParameter(name, state, breakpoint);
      if (comboValue !== undefined) return comboValue;
    }
    
    // 2. Check state-specific value
    if (state && state !== 'neutral') {
      if (this.stateParameters?.[state]?.[name] !== undefined) {
        return this.stateParameters[state][name];
      }
    }
    
    // 3. Check breakpoint-specific value (with cascade)
    if (breakpoint && breakpoint !== defaultBreakpoint) {
      const breakpointValue = this.getBreakpointParameterWithCascade(name, breakpoint);
      if (breakpointValue !== undefined) return breakpointValue;
    }
    
    // 4. Check base parameters
    if (this.parameters[name] !== undefined) {
      return this.parameters[name];
    }
    
    // 5. Check variant (with same hierarchy)
    if (this.variant) {
      return this.variant.getParameter(name, args);
    }
    
    // 6. Type default
    const port = this.getPort(name, 'input');
    return port?.default;
  }
  
  // Extend toJSON
  toJSON(): object {
    return {
      ...existingFields,
      stateBreakpointParameters: this.stateBreakpointParameters
    };
  }
}
```

### Step 2: Extend ModelProxy

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/models/modelProxy.ts`

```typescript
export class ModelProxy {
  // ... existing properties
  
  getParameter(name: string) {
    const source = this.editMode === 'variant' ? this.model.variant : this.model;
    const port = this.model.getPort(name, 'input');
    const state = this.visualState;
    const breakpoint = this.breakpoint;
    const defaultBreakpoint = ProjectModel.instance.getBreakpointSettings().defaultBreakpoint;
    
    // Check if both state and breakpoint are set (combo scenario)
    const hasState = state && state !== 'neutral';
    const hasBreakpoint = breakpoint && breakpoint !== defaultBreakpoint;
    
    // For combo: only check if BOTH the property allows states AND breakpoints
    if (hasState && hasBreakpoint && port?.allowVisualStates && port?.allowBreakpoints) {
      const comboValue = source.getStateBreakpointParameter?.(name, state, breakpoint);
      if (comboValue !== undefined) return comboValue;
    }
    
    // ... existing resolution logic
    return source.getParameter(name, { state, breakpoint });
  }
  
  setParameter(name: string, value: any, args: any = {}) {
    const port = this.model.getPort(name, 'input');
    const target = this.editMode === 'variant' ? this.model.variant : this.model;
    const state = this.visualState;
    const breakpoint = this.breakpoint;
    const defaultBreakpoint = ProjectModel.instance.getBreakpointSettings().defaultBreakpoint;
    
    const hasState = state && state !== 'neutral';
    const hasBreakpoint = breakpoint && breakpoint !== defaultBreakpoint;
    
    // If BOTH state and breakpoint are active, and property supports both
    if (hasState && hasBreakpoint && port?.allowVisualStates && port?.allowBreakpoints) {
      target.setStateBreakpointParameter(name, value, state, breakpoint, {
        ...args,
        undo: args.undo
      });
      return;
    }
    
    // If only breakpoint (and property supports it)
    if (hasBreakpoint && port?.allowBreakpoints) {
      target.setBreakpointParameter(name, value, breakpoint, {
        ...args,
        undo: args.undo
      });
      return;
    }
    
    // ... existing parameter setting logic (state or base)
    args.state = state;
    target.setParameter(name, value, args);
  }
  
  // NEW: Check if current value is from combo
  isComboValue(name: string): boolean {
    if (!this.visualState || this.visualState === 'neutral') return false;
    if (!this.breakpoint || this.breakpoint === 'desktop') return false;
    
    const source = this.editMode === 'variant' ? this.model.variant : this.model;
    return source.hasStateBreakpointParameter?.(name, this.visualState, this.breakpoint) || false;
  }
  
  // NEW: Get info about where current value comes from
  getValueSource(name: string): 'combo' | 'state' | 'breakpoint' | 'base' {
    const source = this.editMode === 'variant' ? this.model.variant : this.model;
    const state = this.visualState;
    const breakpoint = this.breakpoint;
    
    if (state && state !== 'neutral' && breakpoint && breakpoint !== 'desktop') {
      if (source.hasStateBreakpointParameter?.(name, state, breakpoint)) {
        return 'combo';
      }
    }
    
    if (state && state !== 'neutral') {
      if (source.stateParameters?.[state]?.[name] !== undefined) {
        return 'state';
      }
    }
    
    if (breakpoint && breakpoint !== 'desktop') {
      if (source.hasBreakpointParameter?.(name, breakpoint)) {
        return 'breakpoint';
      }
    }
    
    return 'base';
  }
}
```

### Step 3: Update Property Panel UI

**File:** Update property row to show combo indicators

```tsx
// In PropertyPanelRow or equivalent

export function PropertyPanelRow({
  label,
  children,
  isBreakpointAware,
  allowsVisualStates,
  valueSource,  // 'combo' | 'state' | 'breakpoint' | 'base'
  currentState,
  currentBreakpoint,
  onReset
}: PropertyPanelRowProps) {
  
  function getIndicator() {
    switch (valueSource) {
      case 'combo':
        return (
          <Tooltip content={`Set for ${currentState} on ${currentBreakpoint}`}>
            <span className={css.ComboIndicator}>
              ● {currentState} + {currentBreakpoint}
            </span>
          </Tooltip>
        );
      
      case 'state':
        return (
          <Tooltip content={`Set for ${currentState} state`}>
            <span className={css.StateIndicator}>● {currentState}</span>
          </Tooltip>
        );
      
      case 'breakpoint':
        return (
          <Tooltip content={`Set for ${currentBreakpoint}`}>
            <span className={css.BreakpointIndicator}>● {currentBreakpoint}</span>
          </Tooltip>
        );
      
      case 'base':
      default:
        if (currentState !== 'neutral' || currentBreakpoint !== 'desktop') {
          return <span className={css.Inherited}>(inherited)</span>;
        }
        return null;
    }
  }
  
  return (
    <div className={css.Root}>
      <label className={css.Label}>{label}</label>
      <div className={css.InputContainer}>
        {children}
        {getIndicator()}
        {valueSource !== 'base' && onReset && (
          <button className={css.ResetButton} onClick={onReset}>
            <Icon icon={IconName.Undo} size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Update Runtime Resolution

**File:** `packages/noodl-runtime/src/nodes/nodebase.js`

```javascript
{
  getResolvedParameterValue(name) {
    const port = this.getPort ? this.getPort(name, 'input') : null;
    const currentBreakpoint = breakpointManager.getCurrentBreakpoint();
    const currentState = this._internal?.currentVisualState || 'default';
    const defaultBreakpoint = breakpointManager.settings?.defaultBreakpoint || 'desktop';
    
    // 1. Check combo value (state + breakpoint)
    if (port?.allowVisualStates && port?.allowBreakpoints) {
      if (currentState !== 'default' && currentBreakpoint !== defaultBreakpoint) {
        const comboKey = `${currentState}:${currentBreakpoint}`;
        const comboValue = this._model.stateBreakpointParameters?.[comboKey]?.[name];
        if (comboValue !== undefined) return comboValue;
      }
    }
    
    // 2. Check state-specific value
    if (port?.allowVisualStates && currentState !== 'default') {
      const stateValue = this._model.stateParameters?.[currentState]?.[name];
      if (stateValue !== undefined) return stateValue;
    }
    
    // 3. Check breakpoint-specific value (with cascade)
    if (port?.allowBreakpoints && currentBreakpoint !== defaultBreakpoint) {
      const breakpointValue = this.getBreakpointValueWithCascade(name, currentBreakpoint);
      if (breakpointValue !== undefined) return breakpointValue;
    }
    
    // 4. Base parameters
    return this.getParameterValue(name);
  },
  
  getBreakpointValueWithCascade(name, breakpoint) {
    // Check current breakpoint
    if (this._model.breakpointParameters?.[breakpoint]?.[name] !== undefined) {
      return this._model.breakpointParameters[breakpoint][name];
    }
    
    // Cascade
    const inheritanceChain = breakpointManager.getInheritanceChain(breakpoint);
    for (const bp of inheritanceChain.reverse()) {
      if (this._model.breakpointParameters?.[bp]?.[name] !== undefined) {
        return this._model.breakpointParameters[bp][name];
      }
    }
    
    return undefined;
  }
}
```

### Step 5: Extend VariantModel (Optional)

If we want variants to also support combo values:

**File:** `packages/noodl-editor/src/editor/src/models/VariantModel.ts`

```typescript
export class VariantModel extends Model {
  // ... existing properties
  
  stateBreakpointParameters: Record<string, Record<string, any>>;
  
  // Add similar methods as NodeGraphNode:
  // - hasStateBreakpointParameter
  // - getStateBreakpointParameter
  // - setStateBreakpointParameter
  
  // Update getParameter to include combo resolution
  getParameter(name: string, args?: { state?: string; breakpoint?: string }): any {
    const state = args?.state;
    const breakpoint = args?.breakpoint;
    
    // 1. Check combo
    if (state && state !== 'neutral' && breakpoint && breakpoint !== 'desktop') {
      const comboKey = `${state}:${breakpoint}`;
      if (this.stateBreakpointParameters?.[comboKey]?.[name] !== undefined) {
        return this.stateBreakpointParameters[comboKey][name];
      }
    }
    
    // ... rest of resolution hierarchy
  }
}
```

### Step 6: Update Serialization

**File:** `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts`

```typescript
// In toJSON()
toJSON(): object {
  const json: any = {
    id: this.id,
    type: this.type.name,
    parameters: this.parameters,
    // ... other fields
  };
  
  // Only include if not empty
  if (this.stateParameters && Object.keys(this.stateParameters).length > 0) {
    json.stateParameters = this.stateParameters;
  }
  
  if (this.breakpointParameters && Object.keys(this.breakpointParameters).length > 0) {
    json.breakpointParameters = this.breakpointParameters;
  }
  
  if (this.stateBreakpointParameters && Object.keys(this.stateBreakpointParameters).length > 0) {
    json.stateBreakpointParameters = this.stateBreakpointParameters;
  }
  
  return json;
}

// In fromJSON / constructor
static fromJSON(json) {
  return new NodeGraphNode({
    ...json,
    stateBreakpointParameters: json.stateBreakpointParameters || {}
  });
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts` | Add stateBreakpointParameters field and methods |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/models/modelProxy.ts` | Handle combo context in get/setParameter |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts` | Pass combo info to property rows |
| `packages/noodl-runtime/src/nodes/nodebase.js` | Add combo resolution to getResolvedParameterValue |
| `packages/noodl-runtime/src/models/nodemodel.js` | Add stateBreakpointParameters storage |

## Files to Create

None - this phase extends existing files.

## Testing Checklist

- [ ] Can set combo value (e.g., hover + tablet)
- [ ] Combo value takes priority over individual state/breakpoint values
- [ ] When state OR breakpoint changes, combo value is no longer used (falls through to next priority)
- [ ] Combo values are saved to project JSON
- [ ] Combo values are loaded from project JSON
- [ ] UI shows correct indicator for combo values
- [ ] Reset button clears combo value correctly
- [ ] Runtime applies combo values correctly when both conditions match
- [ ] Undo/redo works for combo value changes

## Success Criteria

1. ✅ Can define "hover on tablet" as distinct from "hover" and "tablet"
2. ✅ Clear UI indication of what level value is set at
3. ✅ Values fall through correctly when combo doesn't match
4. ✅ Runtime correctly identifies when combo conditions are met

## Gotchas & Notes

1. **Complexity**: This adds significant complexity. Consider if this is really needed, or if the simpler "state values apply across all breakpoints" is sufficient.

2. **UI Clarity**: The UI needs to clearly communicate which level a value is set at. Consider using different colors:
   - Purple dot: combo value (state + breakpoint)
   - Blue dot: state value only
   - Green dot: breakpoint value only
   - Gray/no dot: base value

3. **Property Support**: Only properties that have BOTH `allowVisualStates: true` AND `allowBreakpoints: true` can have combo values. In practice, this might be a small subset (mostly spacing properties for interactive elements).

4. **Variant Complexity**: If variants also support combos, the full hierarchy becomes:
   - Instance combo → Instance state → Instance breakpoint → Instance base
   - → Variant combo → Variant state → Variant breakpoint → Variant base
   - → Type default
   
   This is 9 levels! Consider if variant combo support is worth it.

5. **Performance**: With 4 breakpoints × 4 states × N properties, the parameter space grows quickly. Make sure resolution is efficient.

## Alternative: Simpler Approach

If combo complexity is too high, consider this simpler alternative:

**States inherit from breakpoint, not base:**

```
Current: state value = same across all breakpoints
Alternative: state value = applied ON TOP OF current breakpoint value
```

Example:
```javascript
// Base: paddingLeft = 24px
// Tablet: paddingLeft = 16px
// Hover state: paddingLeft = +4px (relative)

// Result:
// Desktop hover = 24 + 4 = 28px
// Tablet hover = 16 + 4 = 20px
```

This avoids needing explicit combo values but requires supporting relative/delta values for states, which has its own complexity.
