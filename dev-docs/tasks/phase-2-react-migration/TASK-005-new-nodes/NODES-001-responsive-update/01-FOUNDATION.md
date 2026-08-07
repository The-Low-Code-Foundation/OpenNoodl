# Phase 1: Foundation - Data Model

## Overview

Establish the data structures and model layer support for responsive breakpoints. This phase adds `breakpointParameters` storage to nodes, extends the model proxy, and adds project-level breakpoint configuration.

**Estimate:** 2-3 days

## Goals

1. Add `breakpointParameters` field to NodeGraphNode model
2. Extend NodeModel (runtime) with breakpoint parameter support
3. Add breakpoint configuration to project settings
4. Extend ModelProxy to handle breakpoint context
5. Add `allowBreakpoints` flag support to node definitions

## Technical Architecture

### Data Storage Pattern

Following the existing visual states pattern (`stateParameters`), we add parallel `breakpointParameters`:

```javascript
// NodeGraphNode / NodeModel
{
  id: 'group-1',
  type: 'Group',
  parameters: {
    marginTop: '40px',      // base/default breakpoint value
    backgroundColor: '#fff'  // non-breakpoint property
  },
  stateParameters: {        // existing - visual states
    hover: { backgroundColor: '#eee' }
  },
  breakpointParameters: {   // NEW - breakpoints
    tablet: { marginTop: '24px' },
    phone: { marginTop: '16px' },
    smallPhone: { marginTop: '12px' }
  }
}
```

### Project Settings Schema

```javascript
// project.settings.responsiveBreakpoints
{
  enabled: true,
  cascadeDirection: 'desktop-first', // or 'mobile-first'
  defaultBreakpoint: 'desktop',
  breakpoints: [
    { id: 'desktop', name: 'Desktop', minWidth: 1024, icon: 'desktop' },
    { id: 'tablet', name: 'Tablet', minWidth: 768, maxWidth: 1023, icon: 'tablet' },
    { id: 'phone', name: 'Phone', minWidth: 320, maxWidth: 767, icon: 'phone' },
    { id: 'smallPhone', name: 'Small Phone', minWidth: 0, maxWidth: 319, icon: 'phone-small' }
  ]
}
```

### Node Definition Flag

```javascript
// In node definition
{
  inputs: {
    marginTop: {
      type: { name: 'number', units: ['px', '%'], defaultUnit: 'px' },
      allowBreakpoints: true,  // NEW flag
      group: 'Margin and Padding'
    },
    backgroundColor: {
      type: 'color',
      allowVisualStates: true,
      allowBreakpoints: false  // colors don't support breakpoints
    }
  }
}
```

## Implementation Steps

### Step 1: Extend NodeGraphNode Model

**File:** `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts`

```typescript
// Add to class properties
breakpointParameters: Record<string, Record<string, any>>;

// Add to constructor/initialization
this.breakpointParameters = args.breakpointParameters || {};

// Add new methods
hasBreakpointParameter(name: string, breakpoint: string): boolean {
  return this.breakpointParameters?.[breakpoint]?.[name] !== undefined;
}

getBreakpointParameter(name: string, breakpoint: string): any {
  return this.breakpointParameters?.[breakpoint]?.[name];
}

setBreakpointParameter(name: string, value: any, breakpoint: string, args?: any): void {
  // Similar pattern to setParameter but for breakpoint-specific values
  // Include undo support
}

// Extend getParameter to support breakpoint context
getParameter(name: string, args?: { state?: string, breakpoint?: string }): any {
  // If breakpoint specified, check breakpointParameters first
  // Then cascade to larger breakpoints
  // Finally fall back to base parameters
}

// Extend toJSON to include breakpointParameters
toJSON(): object {
  return {
    ...existingFields,
    breakpointParameters: this.breakpointParameters
  };
}
```

### Step 2: Extend Runtime NodeModel

**File:** `packages/noodl-runtime/src/models/nodemodel.js`

```javascript
// Add breakpointParameters storage
NodeModel.prototype.setBreakpointParameter = function(name, value, breakpoint) {
  if (!this.breakpointParameters) this.breakpointParameters = {};
  if (!this.breakpointParameters[breakpoint]) this.breakpointParameters[breakpoint] = {};
  
  if (value === undefined) {
    delete this.breakpointParameters[breakpoint][name];
  } else {
    this.breakpointParameters[breakpoint][name] = value;
  }
  
  this.emit("breakpointParameterUpdated", { name, value, breakpoint });
};

NodeModel.prototype.setBreakpointParameters = function(breakpointParameters) {
  this.breakpointParameters = breakpointParameters;
};
```

### Step 3: Add Project Settings Schema

**File:** `packages/noodl-editor/src/editor/src/models/projectmodel.ts`

```typescript
// Add default breakpoint settings
const DEFAULT_BREAKPOINT_SETTINGS = {
  enabled: true,
  cascadeDirection: 'desktop-first',
  defaultBreakpoint: 'desktop',
  breakpoints: [
    { id: 'desktop', name: 'Desktop', minWidth: 1024, icon: 'DeviceDesktop' },
    { id: 'tablet', name: 'Tablet', minWidth: 768, maxWidth: 1023, icon: 'DeviceTablet' },
    { id: 'phone', name: 'Phone', minWidth: 320, maxWidth: 767, icon: 'DevicePhone' },
    { id: 'smallPhone', name: 'Small Phone', minWidth: 0, maxWidth: 319, icon: 'DevicePhone' }
  ]
};

// Add helper methods
getBreakpointSettings(): BreakpointSettings {
  return this.settings.responsiveBreakpoints || DEFAULT_BREAKPOINT_SETTINGS;
}

setBreakpointSettings(settings: BreakpointSettings): void {
  this.setSetting('responsiveBreakpoints', settings);
}

getBreakpointForWidth(width: number): string {
  const settings = this.getBreakpointSettings();
  const breakpoints = settings.breakpoints;
  
  // Find matching breakpoint based on width
  for (const bp of breakpoints) {
    const minMatch = bp.minWidth === undefined || width >= bp.minWidth;
    const maxMatch = bp.maxWidth === undefined || width <= bp.maxWidth;
    if (minMatch && maxMatch) return bp.id;
  }
  
  return settings.defaultBreakpoint;
}
```

### Step 4: Extend ModelProxy

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/models/modelProxy.ts`

```typescript
export class ModelProxy {
  model: NodeGraphNode;
  editMode: string;
  visualState: string;
  breakpoint: string;  // NEW

  constructor(args) {
    this.model = args.model;
    this.visualState = 'neutral';
    this.breakpoint = 'desktop';  // NEW - default breakpoint
  }

  setBreakpoint(breakpoint: string) {
    this.breakpoint = breakpoint;
  }

  // Extend getParameter to handle breakpoints
  getParameter(name: string) {
    const source = this.editMode === 'variant' ? this.model.variant : this.model;
    const port = this.model.getPort(name, 'input');
    
    // Check if this property supports breakpoints
    if (port?.allowBreakpoints && this.breakpoint && this.breakpoint !== 'desktop') {
      // Check for breakpoint-specific value
      const breakpointValue = source.getBreakpointParameter(name, this.breakpoint);
      if (breakpointValue !== undefined) return breakpointValue;
      
      // Cascade to larger breakpoints (desktop-first)
      // TODO: Support mobile-first cascade
    }
    
    // Check visual state
    if (this.visualState && this.visualState !== 'neutral') {
      // existing visual state logic
    }
    
    // Fall back to base parameters
    return source.getParameter(name, { state: this.visualState });
  }

  // Extend setParameter to handle breakpoints
  setParameter(name: string, value: any, args: any = {}) {
    const port = this.model.getPort(name, 'input');
    
    // If setting a breakpoint-specific value
    if (port?.allowBreakpoints && this.breakpoint && this.breakpoint !== 'desktop') {
      args.breakpoint = this.breakpoint;
    }
    
    // existing state handling
    args.state = this.visualState;
    
    const target = this.editMode === 'variant' ? this.model.variant : this.model;
    
    if (args.breakpoint) {
      target.setBreakpointParameter(name, value, args.breakpoint, args);
    } else {
      target.setParameter(name, value, args);
    }
  }

  // Check if current value is inherited or explicitly set
  isBreakpointValueInherited(name: string): boolean {
    if (!this.breakpoint || this.breakpoint === 'desktop') return false;
    
    const source = this.editMode === 'variant' ? this.model.variant : this.model;
    return !source.hasBreakpointParameter(name, this.breakpoint);
  }
}
```

### Step 5: Update Node Type Registration

**File:** `packages/noodl-editor/src/editor/src/models/nodelibrary/nodelibrary.ts`

```typescript
// When registering node types, process allowBreakpoints flag
// Similar to how allowVisualStates is handled

processNodeType(nodeType) {
  // existing processing...
  
  // Process allowBreakpoints for inputs
  if (nodeType.inputs) {
    for (const [name, input] of Object.entries(nodeType.inputs)) {
      if (input.allowBreakpoints) {
        // Mark this port as breakpoint-aware
        // This will be used by property panel to show breakpoint controls
      }
    }
  }
}
```

### Step 6: Update GraphModel (Runtime)

**File:** `packages/noodl-runtime/src/models/graphmodel.js`

```javascript
// Add method to update breakpoint parameters
GraphModel.prototype.updateNodeBreakpointParameter = function(
  nodeId,
  parameterName,
  parameterValue,
  breakpoint
) {
  const node = this.getNodeWithId(nodeId);
  if (!node) return;
  
  node.setBreakpointParameter(parameterName, parameterValue, breakpoint);
};

// Extend project settings handling
GraphModel.prototype.getBreakpointSettings = function() {
  return this.settings?.responsiveBreakpoints || DEFAULT_BREAKPOINT_SETTINGS;
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts` | Add breakpointParameters field, getter/setter methods |
| `packages/noodl-editor/src/editor/src/models/projectmodel.ts` | Add breakpoint settings helpers |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/models/modelProxy.ts` | Add breakpoint context, extend get/setParameter |
| `packages/noodl-runtime/src/models/nodemodel.js` | Add breakpoint parameter methods |
| `packages/noodl-runtime/src/models/graphmodel.js` | Add breakpoint settings handling |

## Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-editor/src/editor/src/models/breakpointSettings.ts` | TypeScript interfaces for breakpoint settings |

## Testing Checklist

- [ ] NodeGraphNode can store and retrieve breakpointParameters
- [ ] NodeGraphNode serializes breakpointParameters to JSON correctly
- [ ] NodeGraphNode loads breakpointParameters from JSON correctly
- [ ] ModelProxy correctly returns breakpoint-specific values
- [ ] ModelProxy correctly identifies inherited vs explicit values
- [ ] Project settings store and load breakpoint configuration
- [ ] Cascade works correctly (tablet falls back to desktop)
- [ ] Undo/redo works for breakpoint parameter changes

## Success Criteria

1. ✅ Can programmatically set `node.setBreakpointParameter('marginTop', '24px', 'tablet')`
2. ✅ Can retrieve with `node.getBreakpointParameter('marginTop', 'tablet')`
3. ✅ Project JSON includes breakpointParameters when saved
4. ✅ Project JSON loads breakpointParameters when opened
5. ✅ ModelProxy returns correct value based on current breakpoint context

## Gotchas & Notes

1. **Undo Support**: Make sure breakpoint parameter changes are undoable. Follow the same pattern as `setParameter` with undo groups.

2. **Cascade Order**: Desktop-first means `tablet` inherits from `desktop`, `phone` inherits from `tablet`, `smallPhone` inherits from `phone`. Mobile-first reverses this.

3. **Default Breakpoint**: When `breakpoint === 'desktop'` (or whatever the default is), we should NOT use breakpointParameters - use base parameters instead.

4. **Parameter Migration**: Existing projects won't have breakpointParameters. Handle gracefully (undefined → empty object).

5. **Port Flag**: The `allowBreakpoints` flag on ports determines which properties show breakpoint controls in the UI. This is read-only metadata, not stored per-node.

## Confidence Checkpoints

After completing each step, verify:

| Step | Checkpoint |
|------|------------|
| 1 | Can add/get breakpoint params in editor console |
| 2 | Runtime node model accepts breakpoint params |
| 3 | Project settings UI shows breakpoint config |
| 4 | ModelProxy returns correct value per breakpoint |
| 5 | Saving/loading project preserves breakpoint data |
