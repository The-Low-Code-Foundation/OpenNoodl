# Canvas Overlay Architecture

## Overview

This document explains how canvas overlays integrate with the NodeGraphEditor and the editor's data flow.

## Integration Points

### 1. NodeGraphEditor Initialization

The overlay is created when the NodeGraphEditor is constructed:

```typescript
// In nodegrapheditor.ts constructor
export default class NodeGraphEditor {
  commentLayer: CommentLayer;

  constructor(domElement, options) {
    // ... canvas setup

    // Create overlay
    this.commentLayer = new CommentLayer(this);
    this.commentLayer.setReadOnly(this.readOnly);
  }
}
```

### 2. DOM Structure

The overlay requires two divs in the DOM hierarchy:

```html
<div id="nodegraph-editor">
  <canvas id="nodegraph-canvas"></canvas>
  <div id="nodegraph-background-layer"></div>
  <!-- Behind canvas -->
  <div id="nodegraph-dom-layer"></div>
  <!-- In front of canvas -->
</div>
```

CSS z-index layering:

- Background layer: `z-index: 0`
- Canvas: `z-index: 1`
- Foreground layer: `z-index: 2`

### 3. Render Target Setup

The overlay attaches to the DOM layers:

```typescript
// In nodegrapheditor.ts
const backgroundDiv = this.el.find('#nodegraph-background-layer').get(0);
const foregroundDiv = this.el.find('#nodegraph-dom-layer').get(0);

this.commentLayer.renderTo(backgroundDiv, foregroundDiv);
```

### 4. Viewport Synchronization

The overlay updates whenever the canvas pan/zoom changes:

```typescript
// In nodegrapheditor.ts paint() method
paint() {
  // ... canvas drawing

  // Update overlay transform
  this.commentLayer.setPanAndScale({
    x: this.xOffset,
    y: this.yOffset,
    scale: this.scale
  });
}
```

## Data Flow

### EventDispatcher Integration

Overlays typically subscribe to model changes using EventDispatcher:

```typescript
class MyOverlay {
  setComponentModel(model: ComponentModel) {
    if (this.model) {
      this.model.off(this); // Clean up old subscriptions
    }

    this.model = model;

    // Subscribe to changes
    model.on('nodeAdded', this.onNodeAdded.bind(this), this);
    model.on('nodeRemoved', this.onNodeRemoved.bind(this), this);
    model.on('connectionChanged', this.onConnectionChanged.bind(this), this);

    this.render();
  }

  onNodeAdded(node) {
    // Update overlay state
    this.render();
  }
}
```

### Typical Data Flow

```
User Action
    ↓
Model Change (ProjectModel/ComponentModel)
    ↓
EventDispatcher fires event
    ↓
Overlay handler receives event
    ↓
Overlay updates React state
    ↓
React re-renders overlay
```

## Lifecycle Management

### Creation

```typescript
constructor(nodegraphEditor: NodeGraphEditor) {
  this.nodegraphEditor = nodegraphEditor;
  this.props = { /* initial state */ };
}
```

### Attachment

```typescript
renderTo(backgroundDiv: HTMLDivElement, foregroundDiv: HTMLDivElement) {
  this.backgroundDiv = backgroundDiv;
  this.foregroundDiv = foregroundDiv;

  // Create React roots
  this.backgroundRoot = createRoot(backgroundDiv);
  this.foregroundRoot = createRoot(foregroundDiv);

  // Initial render
  this._renderReact();
}
```

### Updates

```typescript
setPanAndScale(viewport: Viewport) {
  // Update CSS transform
  const transform = `scale(${viewport.scale}) translate(${viewport.x}px, ${viewport.y}px)`;
  this.backgroundDiv.style.transform = transform;
  this.foregroundDiv.style.transform = transform;

  // Notify React if scale changed (important for react-rnd)
  if (this.props.scale !== viewport.scale) {
    this.props.scale = viewport.scale;
    this._renderReact();
  }
}
```

### Disposal

```typescript
dispose() {
  // Unmount React
  if (this.backgroundRoot) {
    this.backgroundRoot.unmount();
  }
  if (this.foregroundRoot) {
    this.foregroundRoot.unmount();
  }

  // Unsubscribe from models
  if (this.model) {
    this.model.off(this);
  }

  // Clean up DOM event listeners
  // (CommentLayer uses a clever cloneNode trick to remove all listeners)
}
```

## Component Model Integration

### Accessing Graph Data

The overlay has access to the full component graph through NodeGraphEditor:

```typescript
class MyOverlay {
  getNodesInView(): NodeGraphNode[] {
    const model = this.nodegraphEditor.nodeGraphModel;
    const nodes: NodeGraphNode[] = [];

    model.forEachNode((node) => {
      nodes.push(node);
    });

    return nodes;
  }

  getConnections(): Connection[] {
    const model = this.nodegraphEditor.nodeGraphModel;
    return model.getAllConnections();
  }
}
```

### Node Position Access

Node positions are available through the graph model:

```typescript
getNodeScreenPosition(nodeId: string): Point | null {
  const model = this.nodegraphEditor.nodeGraphModel;
  const node = model.findNodeWithId(nodeId);

  if (!node) return null;

  // Node positions are in canvas space
  return {
    x: node.x,
    y: node.y
  };
}
```

## Communication with NodeGraphEditor

### From Overlay to Canvas

The overlay can trigger canvas operations:

```typescript
// Clear canvas selection
this.nodegraphEditor.clearSelection();

// Select nodes on canvas
this.nodegraphEditor.selectNode(node);

// Trigger repaint
this.nodegraphEditor.repaint();

// Navigate to node
this.nodegraphEditor.zoomToFitNodes([node]);
```

### From Canvas to Overlay

The canvas notifies the overlay of changes:

```typescript
// In nodegrapheditor.ts
selectNode(node) {
  // ... canvas logic

  // Notify overlay
  this.commentLayer.clearSelection();
}
```

## Best Practices

### ✅ Do

1. **Clean up subscriptions** - Always unsubscribe from EventDispatcher on dispose
2. **Use the context object pattern** - Pass `this` as context to EventDispatcher subscriptions
3. **Batch updates** - Group multiple state changes before calling render
4. **Check for existence** - Always check if DOM elements exist before using them

### ❌ Don't

1. **Don't modify canvas directly** - Work through NodeGraphEditor API
2. **Don't store duplicate data** - Reference the model as the source of truth
3. **Don't subscribe without context** - Direct EventDispatcher subscriptions leak
4. **Don't assume initialization order** - Check for null before accessing properties

## Example: Complete Overlay Setup

```typescript
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ComponentModel } from '@noodl-models/componentmodel';

import { NodeGraphEditor } from './nodegrapheditor';

export default class DataLineageOverlay {
  private nodegraphEditor: NodeGraphEditor;
  private model: ComponentModel;
  private root: Root;
  private container: HTMLDivElement;
  private viewport: Viewport;

  constructor(nodegraphEditor: NodeGraphEditor) {
    this.nodegraphEditor = nodegraphEditor;
  }

  renderTo(container: HTMLDivElement) {
    this.container = container;
    this.root = createRoot(container);
    this.render();
  }

  setComponentModel(model: ComponentModel) {
    if (this.model) {
      this.model.off(this);
    }

    this.model = model;

    if (model) {
      model.on('connectionChanged', this.onDataChanged.bind(this), this);
      model.on('nodeRemoved', this.onDataChanged.bind(this), this);
    }

    this.render();
  }

  setPanAndScale(viewport: Viewport) {
    this.viewport = viewport;
    const transform = `scale(${viewport.scale}) translate(${viewport.x}px, ${viewport.y}px)`;
    this.container.style.transform = transform;
  }

  private onDataChanged() {
    this.render();
  }

  private render() {
    if (!this.root) return;

    const paths = this.calculateDataPaths();

    this.root.render(
      <DataLineageView paths={paths} viewport={this.viewport} onPathClick={this.handlePathClick.bind(this)} />
    );
  }

  private calculateDataPaths() {
    // Analyze graph connections to build data flow paths
    // ...
  }

  private handlePathClick(path: DataPath) {
    // Select nodes involved in this path
    const nodeIds = path.nodes.map((n) => n.id);
    this.nodegraphEditor.selectNodes(nodeIds);
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
    }
    if (this.model) {
      this.model.off(this);
    }
  }
}
```

## Related Documentation

- [Main Overview](./CANVAS-OVERLAY-PATTERN.md)
- [Mouse Event Handling](./CANVAS-OVERLAY-EVENTS.md)
- [React Integration](./CANVAS-OVERLAY-REACT.md)
