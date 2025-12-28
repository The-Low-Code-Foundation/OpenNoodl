# Phase 4: Variants Integration

## Overview

Extend the existing Variants system to support breakpoint-specific values. When a user creates a variant (e.g., "Big Blue Button"), they should be able to define different margin/padding/width values for each breakpoint within that variant.

**Estimate:** 1-2 days

**Dependencies:** Phases 1-3

## Goals

1. Add `breakpointParameters` to VariantModel
2. Extend variant editing UI to show breakpoint selector
3. Implement value resolution hierarchy: Variant breakpoint → Variant base → Node base
4. Ensure variant updates propagate to all nodes using that variant

## Value Resolution Hierarchy

When a node uses a variant, values are resolved in this order:

```
1. Node instance breakpointParameters[currentBreakpoint][property]
   ↓ (if undefined)
2. Node instance parameters[property]
   ↓ (if undefined)
3. Variant breakpointParameters[currentBreakpoint][property]
   ↓ (if undefined, cascade to larger breakpoints)
4. Variant parameters[property]
   ↓ (if undefined)
5. Node type default
```

### Example

```javascript
// Variant "Big Blue Button"
{
  name: 'Big Blue Button',
  typename: 'net.noodl.visual.controls.button',
  parameters: {
    paddingLeft: '24px',      // base padding
    paddingRight: '24px'
  },
  breakpointParameters: {
    tablet: { paddingLeft: '16px', paddingRight: '16px' },
    phone: { paddingLeft: '12px', paddingRight: '12px' }
  }
}

// Node instance using this variant
{
  variantName: 'Big Blue Button',
  parameters: {},                    // no instance overrides
  breakpointParameters: {
    phone: { paddingLeft: '8px' }    // only override phone left padding
  }
}

// Resolution for paddingLeft on phone:
// 1. Check node.breakpointParameters.phone.paddingLeft → '8px' ✓ (use this)

// Resolution for paddingRight on phone:
// 1. Check node.breakpointParameters.phone.paddingRight → undefined
// 2. Check node.parameters.paddingRight → undefined
// 3. Check variant.breakpointParameters.phone.paddingRight → '12px' ✓ (use this)
```

## Implementation Steps

### Step 1: Extend VariantModel

**File:** `packages/noodl-editor/src/editor/src/models/VariantModel.ts`

```typescript
export class VariantModel extends Model {
  name: string;
  typename: string;
  parameters: Record<string, any>;
  stateParameters: Record<string, Record<string, any>>;
  stateTransitions: Record<string, any>;
  defaultStateTransitions: any;
  
  // NEW
  breakpointParameters: Record<string, Record<string, any>>;
  
  constructor(args) {
    super();
    
    this.name = args.name;
    this.typename = args.typename;
    this.parameters = {};
    this.stateParameters = {};
    this.stateTransitions = {};
    this.breakpointParameters = {};  // NEW
  }
  
  // NEW methods
  hasBreakpointParameter(name: string, breakpoint: string): boolean {
    return this.breakpointParameters?.[breakpoint]?.[name] !== undefined;
  }
  
  getBreakpointParameter(name: string, breakpoint: string): any {
    return this.breakpointParameters?.[breakpoint]?.[name];
  }
  
  setBreakpointParameter(name: string, value: any, breakpoint: string, args?: any) {
    if (!this.breakpointParameters) this.breakpointParameters = {};
    if (!this.breakpointParameters[breakpoint]) this.breakpointParameters[breakpoint] = {};
    
    const oldValue = this.breakpointParameters[breakpoint][name];
    
    if (value === undefined) {
      delete this.breakpointParameters[breakpoint][name];
    } else {
      this.breakpointParameters[breakpoint][name] = value;
    }
    
    this.notifyListeners('variantParametersChanged', {
      name,
      value,
      breakpoint
    });
    
    // Undo support
    if (args?.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;
      
      undo.push({
        label: args.label || 'change variant breakpoint parameter',
        do: () => this.setBreakpointParameter(name, value, breakpoint),
        undo: () => this.setBreakpointParameter(name, oldValue, breakpoint)
      });
    }
  }
  
  // Extend getParameter to support breakpoint context
  getParameter(name: string, args?: { state?: string; breakpoint?: string }): any {
    let value;
    
    // Check breakpoint-specific value
    if (args?.breakpoint && args.breakpoint !== 'desktop') {
      value = this.getBreakpointParameterWithCascade(name, args.breakpoint);
      if (value !== undefined) return value;
    }
    
    // Check state-specific value (existing logic)
    if (args?.state && args.state !== 'neutral') {
      if (this.stateParameters?.[args.state]?.[name] !== undefined) {
        value = this.stateParameters[args.state][name];
      }
      if (value !== undefined) return value;
    }
    
    // Check base parameters
    value = this.parameters[name];
    if (value !== undefined) return value;
    
    // Get default from port
    const port = this.getPort(name, 'input');
    return port?.default;
  }
  
  getBreakpointParameterWithCascade(name: string, breakpoint: string): any {
    // Check current breakpoint
    if (this.breakpointParameters?.[breakpoint]?.[name] !== undefined) {
      return this.breakpointParameters[breakpoint][name];
    }
    
    // Cascade to larger breakpoints
    const settings = ProjectModel.instance.getBreakpointSettings();
    const cascadeOrder = settings.breakpoints.map(bp => bp.id);
    const currentIndex = cascadeOrder.indexOf(breakpoint);
    
    for (let i = currentIndex - 1; i >= 0; i--) {
      const bp = cascadeOrder[i];
      if (this.breakpointParameters?.[bp]?.[name] !== undefined) {
        return this.breakpointParameters[bp][name];
      }
    }
    
    return undefined;
  }
  
  // Extend updateFromNode to include breakpoint parameters
  updateFromNode(node) {
    _merge(this.parameters, node.parameters);
    
    // Merge breakpoint parameters
    if (node.breakpointParameters) {
      if (!this.breakpointParameters) this.breakpointParameters = {};
      for (const breakpoint in node.breakpointParameters) {
        if (!this.breakpointParameters[breakpoint]) {
          this.breakpointParameters[breakpoint] = {};
        }
        _merge(this.breakpointParameters[breakpoint], node.breakpointParameters[breakpoint]);
      }
    }
    
    // ... existing state parameter merging
    
    this.notifyListeners('variantParametersChanged');
  }
  
  // Extend toJSON
  toJSON() {
    return {
      name: this.name,
      typename: this.typename,
      parameters: this.parameters,
      stateParameters: this.stateParameters,
      stateTransitions: this.stateTransitions,
      defaultStateTransitions: this.defaultStateTransitions,
      breakpointParameters: this.breakpointParameters  // NEW
    };
  }
}
```

### Step 2: Extend Runtime Variant Handling

**File:** `packages/noodl-runtime/src/models/graphmodel.js`

```javascript
// Add method to update variant breakpoint parameters
GraphModel.prototype.updateVariantBreakpointParameter = function(
  variantName,
  variantTypeName,
  parameterName,
  parameterValue,
  breakpoint
) {
  const variant = this.getVariant(variantTypeName, variantName);
  if (!variant) {
    console.log("updateVariantBreakpointParameter: can't find variant", variantName, variantTypeName);
    return;
  }
  
  if (!variant.breakpointParameters) {
    variant.breakpointParameters = {};
  }
  
  if (!variant.breakpointParameters[breakpoint]) {
    variant.breakpointParameters[breakpoint] = {};
  }
  
  if (parameterValue === undefined) {
    delete variant.breakpointParameters[breakpoint][parameterName];
  } else {
    variant.breakpointParameters[breakpoint][parameterName] = parameterValue;
  }
  
  this.emit('variantUpdated', variant);
};
```

### Step 3: Extend ModelProxy for Variant Editing

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/models/modelProxy.ts`

```typescript
export class ModelProxy {
  // ... existing properties
  
  getParameter(name: string) {
    const source = this.editMode === 'variant' ? this.model.variant : this.model;
    const port = this.model.getPort(name, 'input');
    
    // Breakpoint handling
    if (port?.allowBreakpoints && this.breakpoint && this.breakpoint !== 'desktop') {
      // Check for breakpoint-specific value in source
      const breakpointValue = source.getBreakpointParameter?.(name, this.breakpoint);
      if (breakpointValue !== undefined) return breakpointValue;
      
      // Cascade logic...
    }
    
    // ... existing visual state and base parameter logic
    
    return source.getParameter(name, { 
      state: this.visualState,
      breakpoint: this.breakpoint
    });
  }
  
  setParameter(name: string, value: any, args: any = {}) {
    const port = this.model.getPort(name, 'input');
    const target = this.editMode === 'variant' ? this.model.variant : this.model;
    
    // If setting a breakpoint-specific value
    if (port?.allowBreakpoints && this.breakpoint && this.breakpoint !== 'desktop') {
      target.setBreakpointParameter(name, value, this.breakpoint, {
        ...args,
        undo: args.undo
      });
      return;
    }
    
    // ... existing parameter setting logic
  }
  
  isBreakpointValueInherited(name: string): boolean {
    if (!this.breakpoint || this.breakpoint === 'desktop') return false;
    
    const source = this.editMode === 'variant' ? this.model.variant : this.model;
    return !source.hasBreakpointParameter?.(name, this.breakpoint);
  }
}
```

### Step 4: Update Variant Editor UI

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/VariantStates/variantseditor.tsx`

```tsx
// Add breakpoint selector to variant editing mode

export class VariantsEditor extends React.Component<VariantsEditorProps, State> {
  // ... existing implementation
  
  renderEditMode() {
    const hasBreakpointPorts = this.hasBreakpointAwarePorts();
    
    return (
      <div style={{ width: '100%' }}>
        <div className="variants-edit-mode-header">Edit variant</div>
        
        {/* Show breakpoint selector in variant edit mode */}
        {hasBreakpointPorts && (
          <BreakpointSelector
            breakpoints={this.getBreakpoints()}
            selectedBreakpoint={this.state.breakpoint || 'desktop'}
            overrideCounts={this.calculateVariantOverrideCounts()}
            onBreakpointChange={this.onBreakpointChanged.bind(this)}
          />
        )}
        
        <div className="variants-section">
          <label>{this.state.variant.name}</label>
          <button
            className="variants-button teal"
            style={{ marginLeft: 'auto', width: '78px' }}
            onClick={this.onDoneEditingVariant.bind(this)}
          >
            Close
          </button>
        </div>
      </div>
    );
  }
  
  onBreakpointChanged(breakpoint: string) {
    this.setState({ breakpoint });
    this.props.onBreakpointChanged?.(breakpoint);
  }
  
  calculateVariantOverrideCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    const variant = this.state.variant;
    const settings = ProjectModel.instance.getBreakpointSettings();
    
    for (const bp of settings.breakpoints) {
      if (bp.id === settings.defaultBreakpoint) continue;
      
      const overrides = variant.breakpointParameters?.[bp.id];
      counts[bp.id] = overrides ? Object.keys(overrides).length : 0;
    }
    
    return counts;
  }
  
  hasBreakpointAwarePorts(): boolean {
    const type = NodeLibrary.instance.getNodeTypeWithName(this.state.variant?.typename);
    if (!type?.ports) return false;
    
    return type.ports.some(p => p.allowBreakpoints);
  }
}
```

### Step 5: Update NodeGraphNode Value Resolution

**File:** `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts`

```typescript
getParameter(name: string, args?: { state?: string; breakpoint?: string }): any {
  let value;
  
  // 1. Check instance breakpoint parameters
  if (args?.breakpoint && args.breakpoint !== 'desktop') {
    value = this.getBreakpointParameterWithCascade(name, args.breakpoint);
    if (value !== undefined) return value;
  }
  
  // 2. Check instance base parameters
  value = this.parameters[name];
  if (value !== undefined) return value;
  
  // 3. Check variant (if has one)
  if (this.variant) {
    value = this.variant.getParameter(name, args);
    if (value !== undefined) return value;
  }
  
  // 4. Get port default
  const port = this.getPort(name, 'input');
  return port?.default;
}

getBreakpointParameterWithCascade(name: string, breakpoint: string): any {
  // Check current breakpoint
  if (this.breakpointParameters?.[breakpoint]?.[name] !== undefined) {
    return this.breakpointParameters[breakpoint][name];
  }
  
  // Cascade to larger breakpoints (instance level)
  const settings = ProjectModel.instance.getBreakpointSettings();
  const cascadeOrder = settings.breakpoints.map(bp => bp.id);
  const currentIndex = cascadeOrder.indexOf(breakpoint);
  
  for (let i = currentIndex - 1; i >= 0; i--) {
    const bp = cascadeOrder[i];
    if (this.breakpointParameters?.[bp]?.[name] !== undefined) {
      return this.breakpointParameters[bp][name];
    }
  }
  
  // Check variant breakpoint parameters
  if (this.variant) {
    return this.variant.getBreakpointParameterWithCascade(name, breakpoint);
  }
  
  return undefined;
}
```

### Step 6: Sync Variant Changes to Runtime

**File:** `packages/noodl-editor/src/editor/src/models/projectmodel.ts`

```typescript
// When variant breakpoint parameters change, sync to runtime

onVariantParametersChanged(variant: VariantModel, changeInfo: any) {
  // ... existing sync logic
  
  // If breakpoint parameter changed, notify runtime
  if (changeInfo.breakpoint) {
    this.graphModel.updateVariantBreakpointParameter(
      variant.name,
      variant.typename,
      changeInfo.name,
      changeInfo.value,
      changeInfo.breakpoint
    );
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/src/editor/src/models/VariantModel.ts` | Add breakpointParameters field and methods |
| `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts` | Update value resolution to check variant breakpoints |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/models/modelProxy.ts` | Handle variant breakpoint context |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/VariantStates/variantseditor.tsx` | Add breakpoint selector to variant edit mode |
| `packages/noodl-runtime/src/models/graphmodel.js` | Add variant breakpoint parameter update method |

## Testing Checklist

- [ ] Can create variant with breakpoint-specific values
- [ ] Variant breakpoint values are saved to project JSON
- [ ] Variant breakpoint values are loaded from project JSON
- [ ] Node instance inherits variant breakpoint values correctly
- [ ] Node instance can override specific variant breakpoint values
- [ ] Cascade works: variant tablet inherits from variant desktop
- [ ] Editing variant in "Edit variant" mode shows breakpoint selector
- [ ] Changes to variant breakpoint values propagate to all instances
- [ ] Undo/redo works for variant breakpoint changes
- [ ] Runtime applies variant breakpoint values correctly

## Success Criteria

1. ✅ Variants can have different values per breakpoint
2. ✅ Node instances inherit variant breakpoint values
3. ✅ Node instances can selectively override variant values
4. ✅ UI allows editing variant breakpoint values
5. ✅ Runtime correctly resolves variant + breakpoint hierarchy

## Gotchas & Notes

1. **Resolution Order**: The hierarchy is complex. Make sure tests cover all combinations:
   - Instance breakpoint override > Instance base > Variant breakpoint > Variant base > Type default

2. **Variant Edit Mode**: When editing a variant, the breakpoint selector edits the VARIANT's breakpoint values, not the instance's.

3. **Variant Update Propagation**: When a variant's breakpoint values change, ALL nodes using that variant need to update. This could be performance-sensitive.

4. **State + Breakpoint + Variant**: The full combination is: variant/instance × state × breakpoint. For simplicity, we might NOT support visual state variations within variant breakpoint values (e.g., no "variant hover on tablet"). Confirm this is acceptable.

5. **Migration**: Existing variants won't have breakpointParameters. Handle gracefully (undefined → empty object).

## Complexity Note

This phase adds a third dimension to the value resolution:
- **Visual States**: hover, pressed, disabled
- **Breakpoints**: desktop, tablet, phone
- **Variants**: named style variations

The full matrix can get complex. For this phase, we're keeping visual states and breakpoints as independent axes (they don't interact with each other within variants). A future phase could add combined state+breakpoint support if needed.
