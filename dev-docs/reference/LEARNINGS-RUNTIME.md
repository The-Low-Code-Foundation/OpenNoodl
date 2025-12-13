# OpenNoodl Runtime Architecture - Deep Dive

This document captures learnings about the Noodl runtime system, specifically how `noodl-runtime` and `noodl-viewer-react` work together to render Noodl projects.

---

## Overview

The Noodl runtime is split into two main packages:

| Package | Purpose |
|---------|---------|
| `noodl-runtime` | Core node execution, data flow, graph processing |
| `noodl-viewer-react` | React-based rendering of visual nodes |

The **editor** uses these packages to render the preview, and **deployed projects** use them directly in the browser.

---

## How React is Loaded

**Key Insight:** React is NOT an npm dependency of noodl-viewer-react. Instead, it's loaded as external UMD scripts.

### Webpack Configuration
```javascript
// webpack-configs/webpack.common.js
module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM'
  }
};
```

This means:
- `import React from 'react'` actually references `window.React`
- `import ReactDOM from 'react-dom'` references `window.ReactDOM`

### Where React Bundles Live
```
packages/noodl-viewer-react/static/shared/
├── react.production.min.js       # React UMD bundle
└── react-dom.production.min.js   # ReactDOM UMD bundle
```

These are loaded via `<script>` tags before the viewer bundle in deployed projects.

---

## Entry Points

The package has three entry points for different use cases:

| Entry File | Purpose | Used By |
|------------|---------|---------|
| `index.viewer.js` | Editor preview | Editor iframe |
| `index.deploy.js` | Production deployments | Exported projects |
| `index.ssr.js` | Server-side rendering | SSR builds |

### The `_viewerReact` API

All entry points expose `window.Noodl._viewerReact`:

```javascript
// index.viewer.js
window.Noodl._viewerReact = NoodlViewerReact;
```

The API provides:
- `render(element, modules, options)` - Render in editor preview
- `renderDeployed(element, modules, projectData)` - Render deployed project
- `createElement(modules, projectData)` - Create React element (SSR)

---

## Main Render Flow

### 1. noodl-viewer-react.js

This is the heart of the rendering system:

```javascript
export default {
  render(element, noodlModules, { isLocal = false }) {
    const noodlRuntime = new NoodlRuntime(runtimeArgs);
    ReactDOM.render(
      React.createElement(Viewer, { noodlRuntime, noodlModules }),
      element
    );
  },
  
  renderDeployed(element, noodlModules, projectData) {
    // Supports SSR hydration
    if (element.children[0]?.hasAttribute('data-reactroot')) {
      ReactDOM.hydrate(this.createElement(...), element);
    } else {
      ReactDOM.render(this.createElement(...), element);
    }
  }
};
```

### 2. Viewer Component (viewer.jsx)

The `Viewer` is a React class component that:
- Initializes the runtime
- Registers built-in nodes
- Manages popup overlays
- Handles editor connectivity (websocket)
- Renders the root component

```javascript
export default class Viewer extends React.Component {
  constructor(props) {
    // Initialize runtime
    registerNodes(noodlRuntime);
    NoodlJSAPI(noodlRuntime);
    
    // Listen for graph updates
    noodlRuntime.eventEmitter.on('rootComponentUpdated', () => {
      requestAnimationFrame(() => this.forceUpdate());
    });
  }
  
  render() {
    const rootComponent = this.props.noodlRuntime.rootComponent;
    return rootComponent.render();
  }
}
```

---

## The Node-to-React Bridge

### createNodeFromReactComponent

This is the **most important function** for understanding visual nodes. Located in `react-component-node.js`, it creates a Noodl node definition from a React component definition.

```javascript
// Example node definition
const GroupNodeDef = {
  name: 'net.noodl.visual.group',
  getReactComponent: () => Group,
  frame: {
    dimensions: true,
    position: true
  },
  inputs: { ... },
  outputs: { ... }
};

// Create node from definition
const groupNode = createNodeFromReactComponent(GroupNodeDef);
```

### NoodlReactComponent Wrapper

Every visual node gets wrapped in `NoodlReactComponent`:

```javascript
class NoodlReactComponent extends React.Component {
  render() {
    const { noodlNode, style, ...otherProps } = this.props;
    
    // Merge Noodl styling with React props
    let finalStyle = noodlNode.style;
    if (style) {
      finalStyle = { ...noodlNode.style, ...style };
    }
    
    // Render the actual React component
    return React.createElement(
      noodlNode.reactComponent,
      props,
      noodlNode.renderChildren()
    );
  }
}
```

### The Render Method

Each Noodl node has a `render()` method that returns React elements:

```javascript
render() {
  if (!this.wantsToBeMounted) return;
  
  return React.createElement(NoodlReactComponent, {
    key: this.reactKey,
    noodlNode: this,
    ref: (ref) => {
      this.reactComponentRef = ref;
      // DOM node tracking via findDOMNode (deprecated)
      this.boundingBoxObserver.setTarget(ReactDOM.findDOMNode(ref));
    }
  });
}
```

---

## State Synchronization Pattern

### The forceUpdate Pattern

Noodl nodes don't use React state. Instead, they use `forceUpdate()`:

```javascript
forceUpdate() {
  if (this.forceUpdateScheduled) return;
  this.forceUpdateScheduled = true;

  // Wait until end of frame to batch updates
  this.context.eventEmitter.once('frameEnd', () => {
    this.forceUpdateScheduled = false;
    
    // Don't re-render if already rendered this frame
    if (this.renderedAtFrame === this.context.frameNumber) return;
    
    this.reactComponentRef?.setState({});
  });
  
  this.context.scheduleUpdate();
}
```

**Why this pattern?**
- Noodl's data flow system may update many inputs in one frame
- Batching prevents excessive re-renders
- The `renderedAtFrame` check prevents duplicate renders

### scheduleAfterInputsHaveUpdated

For actions that depend on multiple inputs settling:

```javascript
this.scheduleAfterInputsHaveUpdated(() => {
  // All inputs have been processed
  this.updateChildIndices();
});
```

---

## Visual States and Variants

### Visual States

Nodes can have states like `hover`, `pressed`, `focused`:

```javascript
setVisualStates(newStates) {
  const prevStateParams = this.getParametersForStates(this.currentVisualStates);
  const newStateParams = this.getParametersForStates(newStates);
  
  for (const param in newValues) {
    // Apply transitions or immediate updates
    if (stateTransition[param]?.curve) {
      transitionParameter(this, param, newValues[param], stateTransition[param]);
    } else {
      this.queueInput(param, newValues[param]);
    }
  }
}
```

### Variants

Variants allow pre-defined style variations:

```javascript
setVariant(variant) {
  this.variant = variant;
  
  // Merge parameters: base variant → node parameters → states
  const parameters = {};
  variant && mergeDeep(parameters, variant.parameters);
  mergeDeep(parameters, this.model.parameters);
  
  if (this.currentVisualStates) {
    const stateParameters = this.getParametersForStates(this.currentVisualStates);
    mergeDeep(parameters, stateParameters);
  }
}
```

---

## Children Management

### Adding/Removing Children

```javascript
addChild(child, index) {
  child.parent = this;
  this.children.splice(index, 0, child);
  this.cachedChildren = undefined;  // Invalidate cache
  this.scheduleUpdateChildCountAndIndicies();
  this.forceUpdate();
}

removeChild(child) {
  const index = this.children.indexOf(child);
  if (index !== -1) {
    this.children.splice(index, 1);
    child.parent = undefined;
    this.cachedChildren = undefined;
    this.forceUpdate();
  }
}
```

### The cachedChildren Optimization

```javascript
renderChildren() {
  if (!this.cachedChildren) {
    let c = this.children.map((child) => child.render());
    let children = [];
    flattenArray(children, c);
    
    // Handle edge cases
    if (children.length === 0) children = null;
    else if (children.length === 1) children = children[0];
    
    this.cachedChildren = children;
  }
  return this.cachedChildren;
}
```

---

## DOM Access Patterns

### Current Pattern (Deprecated)

```javascript
getDOMElement() {
  const ref = this.getRef();
  return ReactDOM.findDOMNode(ref);  // ← Deprecated in React 18+
}
```

### The setStyle Method

Direct DOM manipulation for performance:

```javascript
setStyle(newStyles, styleTag) {
  // Update internal style object
  for (const p in newStyles) {
    styleObject[p] = newStyles[p];
  }
  
  const domElement = this.getDOMElement();
  
  // Some changes require a full React re-render
  if (needsForceUpdate) {
    this.forceUpdate();
  } else {
    // Direct DOM update for performance
    setStylesOnDOMNode(domElement, newStyles, styleTag);
  }
}
```

---

## SSR Support

### Server Setup Function

```javascript
export function ssrSetupRuntime(noodlRuntime, noodlModules, projectData) {
  registerNodes(noodlRuntime);
  NoodlJSAPI(noodlRuntime);
  noodlRuntime.setProjectSettings(projectSettings);
  
  // Register modules
  for (const module of noodlModules) {
    noodlRuntime.registerModule(module);
  }
  
  noodlRuntime.setData(projectData);
  noodlRuntime._disableLoad = true;
}
```

### triggerDidMount for SSR

```javascript
triggerDidMount() {
  if (this.wantsToBeMounted && !this.didCallTriggerDidMount) {
    this.didCallTriggerDidMount = true;
    
    if (this.hasOutput('didMount')) {
      this.sendSignalOnOutput('didMount');
    }
    
    // Recursively trigger for children
    this.children.forEach((child) => {
      child.triggerDidMount?.();
    });
  }
}
```

---

## Known Issues & Gotchas

### 1. UNSAFE_componentWillReceiveProps

Used in `Group.tsx` and `Drag.tsx` for prop comparison. These need to be converted to `componentDidUpdate(prevProps)` for React 19 compatibility.

### 2. ReactDOM.findDOMNode

Used throughout `react-component-node.js` for DOM access. This is deprecated and needs replacement with callback refs.

### 3. Class Components

The runtime uses class components extensively because:
- Need lifecycle control (`componentDidMount`, `componentWillUnmount`)
- `forceUpdate()` pattern doesn't work with function components
- Historical reasons

### 4. React Key Counter

```javascript
let reactKeyCounter = 0;

function createNodeFromReactComponent(def) {
  // ...
  initialize() {
    this.reactKey = 'key' + reactKeyCounter;
    reactKeyCounter++;
  }
}
```

Keys are global counters to ensure uniqueness. The `_resetReactVirtualDOM` method can reset a node's key to force complete re-render.

---

## File Reference

| File | Purpose |
|------|---------|
| `noodl-viewer-react.js` | Main render API, ReactDOM calls |
| `viewer.jsx` | Root Viewer component |
| `react-component-node.js` | Node-to-React bridge |
| `register-nodes.js` | Built-in node registration |
| `styles.ts` | CSS/style system |
| `highlighter.js` | Editor node highlighting |
| `inspector.js` | Editor inspector integration |
| `node-shared-port-definitions.js` | Common input/output definitions |

---

## Related Packages

- **noodl-runtime**: Core execution engine, graph model, node execution
- **noodl-viewer-cloud**: Cloud deployment variant
- **noodl-platform**: Platform abstraction layer

---

*Last Updated: December 2024*
*Related Task: Phase 2 Task 3 - Runtime React 19 Upgrade*
