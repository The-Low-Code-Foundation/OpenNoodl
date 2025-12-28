# VIEW-007: Semantic Layers

**View Type:** 🎨 Canvas Overlay (filters what's visible on canvas)

## Overview

Split the chaotic canvas into conceptual layers that can be shown/hidden independently. See just the visual tree, just the data nodes, just the logic, or any combination. Reduce cognitive load by focusing on one concern at a time.

**Estimate:** 2-3 days  
**Priority:** MEDIUM  
**Complexity:** Low  
**Dependencies:** VIEW-000 (Foundation), PREREQ-003 (Canvas Overlay Pattern)

---

## The Problem

A typical complex Noodl canvas has:
- Visual components (Groups, Text, Images) forming a hierarchy
- Data nodes (Variables, Objects, Arrays) scattered around
- Logic nodes (Conditions, Expressions, Switches) everywhere
- API nodes (REST, Functions) mixed in
- Event nodes (Send/Receive Event) connecting things

All of these are shown simultaneously, creating overwhelming visual noise. You can't see the forest for the trees.

---

## The Solution

A layer system that:
1. Categorizes all nodes into semantic layers
2. Allows showing/hiding each layer independently
3. Shows connection counts when layers are hidden
4. Maintains connection visibility (optionally) across hidden layers
5. Provides quick presets for common views

---

## User Stories

1. **As a developer understanding layout**, I want to see only visual components so I can understand the DOM structure.

2. **As a developer debugging data flow**, I want to see only data nodes to understand the state model.

3. **As a developer reviewing logic**, I want to see only logic nodes to verify conditional behavior.

4. **As a developer cleaning up**, I want to quickly see how many nodes are in each category.

---

## UI Design

### Layer Control Panel

```
┌─────────────────────────────────────────────────────────────────┐
│ Semantic Layers                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PRESETS                                                         │
│ [All] [Visual Only] [Data Only] [Logic Only] [Custom]          │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ LAYERS                                   Nodes  Visible         │
│                                                                 │
│ [👁] 📦 Visual Structure                  45    ████████████    │
│      Groups, Pages, Text, Images...                             │
│                                                                 │
│ [👁] 💾 Data / State                      22    ████████░░░░    │
│      Variables, Objects, Arrays...                              │
│                                                                 │
│ [  ] ⚡ Logic / Control                   38    ██████████████  │
│      Conditions, Expressions, Switches...         (hidden)      │
│                                                                 │
│ [👁] 🌐 API / External                     8    ████░░░░░░░░    │
│      REST, Functions, Cloud...                                  │
│                                                                 │
│ [  ] 📡 Events / Signals                  15    ██████░░░░░░    │
│      Send Event, Receive Event...                 (hidden)      │
│                                                                 │
│ [👁] 🔧 Navigation                         4    ██░░░░░░░░░░    │
│      Page Router, Navigate...                                   │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ OPTIONS                                                         │
│ [✓] Show connections to hidden layers (dotted)                 │
│ [✓] Fade hidden layers instead of removing                     │
│ [ ] Auto-hide empty layers                                      │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Currently showing: 79 of 132 nodes (60%)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Canvas with Hidden Layers

When a layer is hidden, nodes can either:
1. **Disappear completely** - Node gone, connections rerouted or hidden
2. **Fade to ghost** - 20% opacity, non-interactive
3. **Collapse to indicator** - Small badge showing "12 hidden logic nodes"

Example with "fade" mode:

```
┌─────────────────────────────────────────────────────────────────┐
│                         CANVAS                                   │
│                                                                 │
│   ┌─────────┐                                                   │
│   │  Page   │  ← Full opacity (Visual layer visible)            │
│   └────┬────┘                                                   │
│        │                                                        │
│   ┌────┴────┐     ┌╌╌╌╌╌╌╌╌╌╌╌┐                                │
│   │  Group  │╌╌╌╌╌│ Condition │  ← 20% opacity (Logic hidden)  │
│   └────┬────┘     └╌╌╌╌╌╌╌╌╌╌╌┘                                │
│        │               ╎                                        │
│   ┌────┴────┐     ╎                                            │
│   │  Text   │◄╌╌╌╌┘  ← Dotted connection to hidden layer       │
│   └─────────┘                                                   │
│                                                                 │
│   ┌─────────┐                                                   │
│   │ Variable│  ← Full opacity (Data layer visible)             │
│   └─────────┘                                                   │
│                                                                 │
│        ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐                           │
│        │  ⚡ 12 Logic nodes hidden  │  ← Collapse indicator     │
│        └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Toggle (Keyboard Shortcuts)

```
Cmd+1  →  Toggle Visual layer
Cmd+2  →  Toggle Data layer
Cmd+3  →  Toggle Logic layer
Cmd+4  →  Toggle API layer
Cmd+5  →  Toggle Events layer
Cmd+0  →  Show all layers
```

---

## Technical Design

### Layer Definition

```typescript
interface SemanticLayer {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;  // For connection coloring
  
  // Which node types belong to this layer
  nodeTypes: string[];
  
  // Match function for complex cases
  matchNode?: (node: NodeGraphNode) => boolean;
}

const SEMANTIC_LAYERS: SemanticLayer[] = [
  {
    id: 'visual',
    name: 'Visual Structure',
    icon: '📦',
    description: 'Groups, Pages, Text, Images...',
    color: '#4A90D9',
    nodeTypes: [
      'Group', 'Page', 'Text', 'Image', 'Video', 'Button',
      'Checkbox', 'Radio', 'Dropdown', 'TextInput', 'Repeater',
      'Columns', 'Circle', 'Rectangle', 'Icon', 'Lottie'
      // ... all visual node types
    ]
  },
  {
    id: 'data',
    name: 'Data / State',
    icon: '💾',
    description: 'Variables, Objects, Arrays...',
    color: '#50C878',
    nodeTypes: [
      'Variable', 'Object', 'Array', 'String', 'Number', 'Boolean',
      'Color', 'Set Variable', 'Create Object', 'Array Filter',
      'Array Map', 'Insert Into Array', 'Remove From Array'
    ]
  },
  {
    id: 'logic',
    name: 'Logic / Control',
    icon: '⚡',
    description: 'Conditions, Expressions, Switches...',
    color: '#F5A623',
    nodeTypes: [
      'Condition', 'Expression', 'Switch', 'And', 'Or', 'Not',
      'Inverter', 'Delay', 'Debounce', 'Counter', 'States',
      'For Each', 'Run Tasks'
    ]
  },
  {
    id: 'api',
    name: 'API / External',
    icon: '🌐',
    description: 'REST, Functions, Cloud...',
    color: '#BD10E0',
    nodeTypes: [
      'REST', 'REST Query', 'GraphQL', 'Function', 'Javascript',
      'Cloud Function', 'Query Records', 'Create Record',
      'Update Record', 'Delete Record'
    ]
  },
  {
    id: 'events',
    name: 'Events / Signals',
    icon: '📡',
    description: 'Send Event, Receive Event...',
    color: '#FF6B6B',
    nodeTypes: [
      'Send Event', 'Receive Event', 'Component Inputs',
      'Component Outputs', 'Page Inputs', 'Page Outputs'
    ]
  },
  {
    id: 'navigation',
    name: 'Navigation',
    icon: '🔧',
    description: 'Page Router, Navigate...',
    color: '#9B9B9B',
    nodeTypes: [
      'Page Router', 'Navigate', 'Navigate Back', 'External Link',
      'Open Popup', 'Close Popup'
    ]
  }
];
```

### Layer State

```typescript
interface LayerState {
  layers: {
    [layerId: string]: {
      visible: boolean;
      nodeCount: number;
    };
  };
  
  options: {
    showHiddenConnections: boolean;  // Show dotted lines to hidden nodes
    fadeHiddenLayers: boolean;       // Fade instead of hide
    autoHideEmpty: boolean;          // Hide layers with 0 nodes
  };
  
  preset: 'all' | 'visual' | 'data' | 'logic' | 'custom';
}

// Presets
const PRESETS = {
  all: ['visual', 'data', 'logic', 'api', 'events', 'navigation'],
  visual: ['visual'],
  data: ['data'],
  logic: ['logic', 'data'],  // Logic often needs data context
  custom: null  // User-defined
};
```

### Integration with Canvas

```typescript
// In NodeGraphEditor or similar

interface LayerFilterOptions {
  visibleLayers: string[];
  fadeHidden: boolean;
  showHiddenConnections: boolean;
}

function applyLayerFilter(options: LayerFilterOptions): void {
  this.nodes.forEach(node => {
    const layer = getNodeLayer(node.model);
    const isVisible = options.visibleLayers.includes(layer);
    
    if (options.fadeHidden) {
      node.setOpacity(isVisible ? 1.0 : 0.2);
      node.setInteractive(isVisible);
    } else {
      node.setVisible(isVisible);
    }
  });
  
  this.connections.forEach(conn => {
    const fromVisible = options.visibleLayers.includes(getNodeLayer(conn.from));
    const toVisible = options.visibleLayers.includes(getNodeLayer(conn.to));
    
    if (fromVisible && toVisible) {
      conn.setStyle('solid');
      conn.setOpacity(1.0);
    } else if (options.showHiddenConnections) {
      conn.setStyle('dotted');
      conn.setOpacity(0.3);
    } else {
      conn.setVisible(false);
    }
  });
  
  this.repaint();
}
```

---

## Implementation Phases

### Phase 1: Layer Categorization (0.5 day)

1. Define all semantic layers with node type mappings
2. Create `getNodeLayer()` function
3. Handle edge cases (unknown types → "Other")
4. Test categorization accuracy

**Verification:**
- [ ] All node types categorized
- [ ] Categories make sense
- [ ] No nodes fall through

### Phase 2: Layer State Management (0.5 day)

1. Create layer state store/context
2. Implement toggle functions
3. Add preset switching
4. Persist state to session/preferences

**Verification:**
- [ ] Toggle works
- [ ] Presets switch correctly
- [ ] State persists

### Phase 3: Canvas Integration (1 day)

1. Hook layer state into NodeGraphEditor
2. Implement node visibility/opacity changes
3. Implement connection styling
4. Handle selection in hidden layers
5. Performance optimization

**Verification:**
- [ ] Nodes show/hide correctly
- [ ] Connections styled appropriately
- [ ] Selection works
- [ ] Performance acceptable

### Phase 4: UI Panel (0.5-1 day)

1. Create `SemanticLayersPanel` component
2. Show layer toggles with counts
3. Add options checkboxes
4. Add preset buttons
5. Integrate into Analysis Panel or as floating control

**Verification:**
- [ ] Panel renders correctly
- [ ] Toggles work
- [ ] Counts accurate

### Phase 5: Keyboard Shortcuts & Polish (0.5 day)

1. Add keyboard shortcuts
2. Add visual indicator for active filter
3. Toast notification when layers change
4. Help tooltip explaining layers

**Verification:**
- [ ] Shortcuts work
- [ ] User knows filter is active
- [ ] UX polished

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/
├── SemanticLayersPanel/
│   ├── index.ts
│   ├── SemanticLayersPanel.tsx
│   ├── SemanticLayersPanel.module.scss
│   ├── LayerToggle.tsx
│   ├── PresetButtons.tsx
│   └── LayerOptions.tsx
└── context/
    └── SemanticLayersContext.tsx

packages/noodl-editor/src/editor/src/utils/
└── semanticLayers.ts
```

---

## Success Criteria

- [ ] All nodes correctly categorized into layers
- [ ] Toggling layers shows/hides nodes
- [ ] Connections styled appropriately when crossing layers
- [ ] Presets work correctly
- [ ] Keyboard shortcuts functional
- [ ] Performance acceptable (< 100ms to toggle)
- [ ] Clear indication when filter is active

---

## Future Enhancements

- **Custom layers** - Let users define their own categorizations
- **Layer locking** - Prevent editing nodes in certain layers
- **Layer-based minimap** - Color-coded minimap by layer
- **Save filter as preset** - Save custom combinations
- **Per-component layer memory** - Remember last layer state per component

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Some nodes hard to categorize | Add "Other" category, let user recategorize |
| Performance with many nodes | Use efficient DOM updates, consider virtualization |
| Confusion about hidden nodes | Clear indicator, easy "show all" escape hatch |
| Selection in hidden layers | Either prevent or show warning |

---

## Dependencies

- VIEW-000 Foundation (for categorization utilities)
- Canvas editor integration

## Blocks

- None (independent view)

## Runtime Integration (PRESERVE EXISTING)

**This view modifies the canvas display, so it MUST preserve the existing runtime debugging features.**

### What Must Keep Working

When layers are filtered, the following must still function:

| Feature | Behavior with hidden layers |
|---------|----------------------------|
| **Node highlighting** | Hidden nodes should still flash (at reduced opacity if faded) |
| **Data flow animation** | Connections to hidden nodes should animate (dotted style) |
| **Debug inspector** | Should still work on faded/hidden nodes |
| **Click-to-select in preview** | Should reveal hidden node if clicked |

### Implementation Consideration

The layer system should be a **visual filter only**, not a functional filter. The runtime doesn't care about layers - it still executes all nodes. We're just changing what the user sees.

```typescript
// WRONG: Don't exclude nodes from runtime
nodes.filter(n => isLayerVisible(n)).forEach(n => n.execute());

// RIGHT: Only change visual presentation
nodes.forEach(node => {
  const isVisible = isLayerVisible(node);
  node.setOpacity(isVisible ? 1.0 : 0.2);
  // Runtime highlighting still works on faded nodes
});
```

### Auto-Reveal on Activity

Consider: when a hidden node fires (lights up due to runtime activity), should it:
1. **Stay hidden/faded** - Consistent filtering, but user might miss activity
2. **Temporarily reveal** - Shows what's happening, but breaks filter
3. **Pulse indicator** - Small badge shows "activity in hidden layers"

Recommend option 3 - shows activity without breaking the filter.

---

## Alternative: Non-Invasive Implementation

If modifying the canvas is too risky, an alternative is a **read-only layer view** that:

1. Creates a simplified representation of the canvas
2. Shows only selected layers in this separate view
3. Click to jump to actual canvas location

This would be safer but less integrated.
