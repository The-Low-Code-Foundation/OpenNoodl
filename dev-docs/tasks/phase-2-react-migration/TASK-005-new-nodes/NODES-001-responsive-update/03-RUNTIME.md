# Phase 3: Runtime - Viewport Detection

## Overview

Implement the runtime system that detects viewport width changes and applies the correct breakpoint-specific values to nodes. This includes creating a BreakpointManager singleton, wiring up resize listeners, and ensuring nodes reactively update when the breakpoint changes.

**Estimate:** 2-3 days

**Dependencies:** Phase 1 (Foundation)

## Goals

1. Create BreakpointManager singleton for viewport detection
2. Implement viewport resize listener with debouncing
3. Wire nodes to respond to breakpoint changes
4. Implement value resolution with cascade logic
5. Support both desktop-first and mobile-first cascades
6. Ensure smooth transitions when breakpoint changes

## Technical Architecture

### BreakpointManager

Central singleton that:
- Monitors `window.innerWidth`
- Determines current breakpoint based on project settings
- Notifies subscribers when breakpoint changes
- Handles both desktop-first and mobile-first cascade

```
┌─────────────────────────────────────────┐
│           BreakpointManager             │
├─────────────────────────────────────────┤
│ - currentBreakpoint: string             │
│ - settings: BreakpointSettings          │
│ - listeners: Set<Function>              │
├─────────────────────────────────────────┤
│ + initialize(settings)                  │
│ + getCurrentBreakpoint(): string        │
│ + getBreakpointForWidth(width): string  │
│ + subscribe(callback): unsubscribe      │
│ + getCascadeOrder(): string[]           │
└─────────────────────────────────────────┘
          │
          │ notifies
          ▼
┌─────────────────────────────────────────┐
│          Visual Nodes                   │
│  (subscribe to breakpoint changes)      │
└─────────────────────────────────────────┘
```

### Value Resolution Flow

```
getResolvedValue(propertyName)
    │
    ▼
Is property breakpoint-aware?
    │
    ├─ No → return parameters[propertyName]
    │
    └─ Yes → Get current breakpoint
              │
              ▼
         Check breakpointParameters[currentBreakpoint]
              │
              ├─ Has value → return it
              │
              └─ No value → Cascade to next breakpoint
                            │
                            ▼
                       (repeat until found or reach default)
                            │
                            ▼
                       return parameters[propertyName]
```

## Implementation Steps

### Step 1: Create BreakpointManager

**File:** `packages/noodl-runtime/src/breakpointmanager.js`

```javascript
'use strict';

const EventEmitter = require('events');

const DEFAULT_SETTINGS = {
  enabled: true,
  cascadeDirection: 'desktop-first',
  defaultBreakpoint: 'desktop',
  breakpoints: [
    { id: 'desktop', minWidth: 1024 },
    { id: 'tablet', minWidth: 768, maxWidth: 1023 },
    { id: 'phone', minWidth: 320, maxWidth: 767 },
    { id: 'smallPhone', minWidth: 0, maxWidth: 319 }
  ]
};

class BreakpointManager extends EventEmitter {
  constructor() {
    super();
    
    this.settings = DEFAULT_SETTINGS;
    this.currentBreakpoint = DEFAULT_SETTINGS.defaultBreakpoint;
    this._resizeTimeout = null;
    this._boundHandleResize = this._handleResize.bind(this);
    
    // Don't auto-initialize - wait for settings from project
  }
  
  initialize(settings) {
    this.settings = settings || DEFAULT_SETTINGS;
    this.currentBreakpoint = this.settings.defaultBreakpoint;
    
    // Set up resize listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._boundHandleResize);
      window.addEventListener('resize', this._boundHandleResize);
      
      // Initial detection
      this._updateBreakpoint(window.innerWidth);
    }
  }
  
  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._boundHandleResize);
    }
    this.removeAllListeners();
  }
  
  _handleResize() {
    // Debounce resize events
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
    }
    
    this._resizeTimeout = setTimeout(() => {
      this._updateBreakpoint(window.innerWidth);
    }, 100);  // 100ms debounce
  }
  
  _updateBreakpoint(width) {
    const newBreakpoint = this.getBreakpointForWidth(width);
    
    if (newBreakpoint !== this.currentBreakpoint) {
      const previousBreakpoint = this.currentBreakpoint;
      this.currentBreakpoint = newBreakpoint;
      
      this.emit('breakpointChanged', {
        breakpoint: newBreakpoint,
        previousBreakpoint,
        width
      });
    }
  }
  
  getBreakpointForWidth(width) {
    if (!this.settings.enabled) {
      return this.settings.defaultBreakpoint;
    }
    
    const breakpoints = this.settings.breakpoints;
    
    for (const bp of breakpoints) {
      const minMatch = bp.minWidth === undefined || width >= bp.minWidth;
      const maxMatch = bp.maxWidth === undefined || width <= bp.maxWidth;
      
      if (minMatch && maxMatch) {
        return bp.id;
      }
    }
    
    return this.settings.defaultBreakpoint;
  }
  
  getCurrentBreakpoint() {
    return this.currentBreakpoint;
  }
  
  /**
   * Get the cascade order for value inheritance.
   * Desktop-first: ['desktop', 'tablet', 'phone', 'smallPhone']
   * Mobile-first: ['smallPhone', 'phone', 'tablet', 'desktop']
   */
  getCascadeOrder() {
    const breakpointIds = this.settings.breakpoints.map(bp => bp.id);
    
    if (this.settings.cascadeDirection === 'mobile-first') {
      return breakpointIds.slice().reverse();
    }
    
    return breakpointIds;
  }
  
  /**
   * Get breakpoints that a given breakpoint inherits from.
   * For desktop-first with current='phone':
   *   returns ['tablet', 'desktop'] (phone inherits from tablet, which inherits from desktop)
   */
  getInheritanceChain(breakpointId) {
    const cascadeOrder = this.getCascadeOrder();
    const currentIndex = cascadeOrder.indexOf(breakpointId);
    
    if (currentIndex <= 0) return [];  // First in cascade inherits from nothing
    
    return cascadeOrder.slice(0, currentIndex);
  }
  
  /**
   * Subscribe to breakpoint changes.
   * Returns unsubscribe function.
   */
  subscribe(callback) {
    this.on('breakpointChanged', callback);
    return () => this.off('breakpointChanged', callback);
  }
  
  /**
   * Force a breakpoint (for testing/preview).
   * Pass null to return to auto-detection.
   */
  forceBreakpoint(breakpointId) {
    if (breakpointId === null) {
      // Return to auto-detection
      if (typeof window !== 'undefined') {
        this._updateBreakpoint(window.innerWidth);
      }
    } else {
      const previousBreakpoint = this.currentBreakpoint;
      this.currentBreakpoint = breakpointId;
      
      this.emit('breakpointChanged', {
        breakpoint: breakpointId,
        previousBreakpoint,
        forced: true
      });
    }
  }
}

// Singleton instance
const breakpointManager = new BreakpointManager();

module.exports = breakpointManager;
```

### Step 2: Integrate with GraphModel

**File:** `packages/noodl-runtime/src/models/graphmodel.js`

```javascript
const breakpointManager = require('../breakpointmanager');

// In setSettings method, initialize breakpoint manager
GraphModel.prototype.setSettings = function(settings) {
  this.settings = settings;
  
  // Initialize breakpoint manager with project settings
  if (settings.responsiveBreakpoints) {
    breakpointManager.initialize(settings.responsiveBreakpoints);
  }
  
  this.emit('projectSettingsChanged', settings);
};
```

### Step 3: Add Value Resolution to Node Base

**File:** `packages/noodl-runtime/src/nodes/nodebase.js` (or equivalent base class)

```javascript
const breakpointManager = require('../breakpointmanager');

// Add to node initialization
{
  _initializeBreakpointSupport() {
    // Subscribe to breakpoint changes
    this._breakpointUnsubscribe = breakpointManager.subscribe(
      this._onBreakpointChanged.bind(this)
    );
  },
  
  _disposeBreakpointSupport() {
    if (this._breakpointUnsubscribe) {
      this._breakpointUnsubscribe();
      this._breakpointUnsubscribe = null;
    }
  },
  
  _onBreakpointChanged({ breakpoint, previousBreakpoint }) {
    // Re-apply all breakpoint-aware properties
    this._applyBreakpointValues();
  },
  
  _applyBreakpointValues() {
    const ports = this.getPorts ? this.getPorts('input') : [];
    
    for (const port of ports) {
      if (port.allowBreakpoints) {
        const value = this.getResolvedParameterValue(port.name);
        this._applyParameterValue(port.name, value);
      }
    }
    
    // Force re-render if this is a React node
    if (this.forceUpdate) {
      this.forceUpdate();
    }
  },
  
  /**
   * Get the resolved value for a parameter, considering breakpoints and cascade.
   */
  getResolvedParameterValue(name) {
    const port = this.getPort ? this.getPort(name, 'input') : null;
    
    // If not breakpoint-aware, just return the base value
    if (!port || !port.allowBreakpoints) {
      return this.getParameterValue(name);
    }
    
    const currentBreakpoint = breakpointManager.getCurrentBreakpoint();
    const settings = breakpointManager.settings;
    
    // If at default breakpoint, use base parameters
    if (currentBreakpoint === settings.defaultBreakpoint) {
      return this.getParameterValue(name);
    }
    
    // Check for value at current breakpoint
    if (this._model.breakpointParameters?.[currentBreakpoint]?.[name] !== undefined) {
      return this._model.breakpointParameters[currentBreakpoint][name];
    }
    
    // Cascade: check inheritance chain
    const inheritanceChain = breakpointManager.getInheritanceChain(currentBreakpoint);
    
    for (const bp of inheritanceChain.reverse()) {  // Check from closest to furthest
      if (this._model.breakpointParameters?.[bp]?.[name] !== undefined) {
        return this._model.breakpointParameters[bp][name];
      }
    }
    
    // Fall back to base parameters
    return this.getParameterValue(name);
  },
  
  _applyParameterValue(name, value) {
    // Override in specific node types to apply the value
    // For visual nodes, this might update CSS properties
  }
}
```

### Step 4: Integrate with Visual Nodes

**File:** `packages/noodl-viewer-react/src/nodes/visual/visualbase.js` (or equivalent)

```javascript
const breakpointManager = require('@noodl/runtime/src/breakpointmanager');

// In visual node base

{
  initialize() {
    // ... existing initialization
    
    // Set up breakpoint support
    this._initializeBreakpointSupport();
  },
  
  _onNodeDeleted() {
    // ... existing cleanup
    
    this._disposeBreakpointSupport();
  },
  
  // Override to apply CSS property values
  _applyParameterValue(name, value) {
    // Map parameter name to CSS property
    const cssProperty = this._getCSSPropertyForParameter(name);
    
    if (cssProperty && this._internal.element) {
      this._internal.element.style[cssProperty] = value;
    }
    
    // Or if using React, set state/props
    if (this._internal.reactComponent) {
      // Trigger re-render with new value
      this.forceUpdate();
    }
  },
  
  _getCSSPropertyForParameter(name) {
    // Map Noodl parameter names to CSS properties
    const mapping = {
      marginTop: 'marginTop',
      marginRight: 'marginRight',
      marginBottom: 'marginBottom',
      marginLeft: 'marginLeft',
      paddingTop: 'paddingTop',
      paddingRight: 'paddingRight',
      paddingBottom: 'paddingBottom',
      paddingLeft: 'paddingLeft',
      width: 'width',
      height: 'height',
      minWidth: 'minWidth',
      maxWidth: 'maxWidth',
      minHeight: 'minHeight',
      maxHeight: 'maxHeight',
      fontSize: 'fontSize',
      lineHeight: 'lineHeight',
      letterSpacing: 'letterSpacing',
      flexDirection: 'flexDirection',
      alignItems: 'alignItems',
      justifyContent: 'justifyContent',
      flexWrap: 'flexWrap',
      gap: 'gap'
    };
    
    return mapping[name];
  },
  
  // Override getStyle to use resolved breakpoint values
  getStyle(name) {
    // Check if this is a breakpoint-aware property
    const port = this.getPort(name, 'input');
    
    if (port?.allowBreakpoints) {
      return this.getResolvedParameterValue(name);
    }
    
    // Fall back to existing behavior
    return this._existingGetStyle(name);
  }
}
```

### Step 5: Update React Component Props

**File:** For React-based visual nodes, update how props are computed

```javascript
// In the React component wrapper

getReactProps() {
  const props = {};
  const ports = this.getPorts('input');
  
  for (const port of ports) {
    // Use resolved value for breakpoint-aware properties
    if (port.allowBreakpoints) {
      props[port.name] = this.getResolvedParameterValue(port.name);
    } else {
      props[port.name] = this.getParameterValue(port.name);
    }
  }
  
  return props;
}
```

### Step 6: Add Transition Support (Optional Enhancement)

**File:** `packages/noodl-runtime/src/breakpointmanager.js`

```javascript
// Add transition support for smooth breakpoint changes

class BreakpointManager extends EventEmitter {
  // ... existing code
  
  _updateBreakpoint(width) {
    const newBreakpoint = this.getBreakpointForWidth(width);
    
    if (newBreakpoint !== this.currentBreakpoint) {
      const previousBreakpoint = this.currentBreakpoint;
      this.currentBreakpoint = newBreakpoint;
      
      // Add CSS class for transitions
      if (typeof document !== 'undefined') {
        document.body.classList.add('noodl-breakpoint-transitioning');
        
        // Remove after transition completes
        setTimeout(() => {
          document.body.classList.remove('noodl-breakpoint-transitioning');
        }, 300);
      }
      
      this.emit('breakpointChanged', {
        breakpoint: newBreakpoint,
        previousBreakpoint,
        width
      });
    }
  }
}
```

**CSS:** Add to runtime styles

```css
/* Smooth transitions when breakpoint changes */
.noodl-breakpoint-transitioning * {
  transition: 
    margin 0.2s ease-out,
    padding 0.2s ease-out,
    width 0.2s ease-out,
    height 0.2s ease-out,
    font-size 0.2s ease-out,
    gap 0.2s ease-out !important;
}
```

### Step 7: Editor-Runtime Communication

**File:** `packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts`

```typescript
// When breakpoint settings change in editor, sync to runtime

onBreakpointSettingsChanged(settings: BreakpointSettings) {
  this.tryWebviewCall(() => {
    this.webview.executeJavaScript(`
      if (window.NoodlRuntime && window.NoodlRuntime.breakpointManager) {
        window.NoodlRuntime.breakpointManager.initialize(${JSON.stringify(settings)});
      }
    `);
  });
}

// Optionally: Force breakpoint for preview purposes
forceRuntimeBreakpoint(breakpointId: string | null) {
  this.tryWebviewCall(() => {
    this.webview.executeJavaScript(`
      if (window.NoodlRuntime && window.NoodlRuntime.breakpointManager) {
        window.NoodlRuntime.breakpointManager.forceBreakpoint(${JSON.stringify(breakpointId)});
      }
    `);
  });
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-runtime/src/models/graphmodel.js` | Initialize breakpointManager with settings |
| `packages/noodl-runtime/src/nodes/nodebase.js` | Add breakpoint value resolution |
| `packages/noodl-viewer-react/src/nodes/visual/visualbase.js` | Wire up breakpoint subscriptions |
| `packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts` | Add breakpoint sync to runtime |

## Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-runtime/src/breakpointmanager.js` | Central breakpoint detection and management |
| `packages/noodl-runtime/src/styles/breakpoints.css` | Optional transition styles |

## Testing Checklist

- [ ] BreakpointManager correctly detects breakpoint from window width
- [ ] BreakpointManager fires 'breakpointChanged' event on resize
- [ ] Debouncing prevents excessive events during resize drag
- [ ] Nodes receive breakpoint change notifications
- [ ] Nodes apply correct breakpoint-specific values
- [ ] Cascade works correctly (tablet inherits desktop values)
- [ ] Mobile-first cascade works when configured
- [ ] Values update smoothly during breakpoint transitions
- [ ] `forceBreakpoint` works for testing/preview
- [ ] Memory cleanup works (no leaks on node deletion)
- [ ] Works in both editor preview and deployed app

## Success Criteria

1. ✅ Resizing browser window changes applied breakpoint
2. ✅ Visual nodes update their dimensions/spacing instantly
3. ✅ Values cascade correctly when not overridden
4. ✅ Both desktop-first and mobile-first work
5. ✅ No performance issues with many nodes

## Gotchas & Notes

1. **SSR Considerations**: If Noodl supports SSR, `window` won't exist on server. Guard all window access with `typeof window !== 'undefined'`.

2. **Performance**: With many nodes subscribed, breakpoint changes could cause many re-renders. Consider:
   - Batch updates using requestAnimationFrame
   - Only re-render nodes whose values actually changed

3. **Debounce Tuning**: 100ms debounce is a starting point. May need adjustment based on feel.

4. **Transition Timing**: The CSS transition duration (0.2s) should match user expectations. Could make configurable.

5. **Initial Load**: On first load, breakpoint should be set BEFORE first render to avoid flash of wrong layout.

6. **Testing Breakpoints**: Add `breakpointManager.forceBreakpoint()` to allow testing different breakpoints without resizing window.

7. **React Strict Mode**: If using React Strict Mode, ensure subscriptions are properly cleaned up (may fire twice in dev).

## Performance Optimization Ideas

1. **Selective Updates**: Track which properties actually differ between breakpoints, only update those.

2. **CSS Variables**: Consider using CSS custom properties for breakpoint values, letting browser handle changes:
   ```javascript
   // Set CSS variable per breakpoint
   document.documentElement.style.setProperty('--node-123-margin-top', '24px');
   ```

3. **Batch Notifications**: Collect all changed nodes and update in single batch:
   ```javascript
   requestAnimationFrame(() => {
     changedNodes.forEach(node => node.forceUpdate());
   });
   ```
