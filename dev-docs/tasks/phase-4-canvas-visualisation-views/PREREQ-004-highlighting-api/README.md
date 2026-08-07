# PREREQ-004: Canvas Highlighting API

## Overview

**Priority:** HIGH  
**Estimate:** 1-2 days  
**Status:** Not started  
**Blocked by:** VIEW-000 (Foundation), PREREQ-003 (Overlay Pattern)

---

## The Goal

Create an API for **persistent, multi-channel highlighting** on the canvas.

This is the "Level 5000" feature that makes Data Lineage and Impact Radar legendary:
- Highlights persist until explicitly dismissed
- Multiple highlight channels can coexist (lineage = blue, impact = orange)
- Highlights persist across component navigation

---

## Current State

The canvas already has some highlighting:
- Nodes flash when they fire (debug visualization)
- Connections animate during data flow
- Selection highlighting exists

But these are:
- Temporary (fade after a few seconds)
- Single-purpose (can't have multiple types at once)
- Component-local (don't persist across navigation)

---

## Required API

```typescript
// canvasHighlight.ts

export interface CanvasHighlightAPI {
  // Create highlights (returns handle to control them)
  highlightNodes(
    nodeIds: string[], 
    options: HighlightOptions
  ): HighlightHandle;
  
  highlightConnections(
    connections: ConnectionRef[], 
    options: HighlightOptions
  ): HighlightHandle;
  
  highlightPath(
    path: PathDefinition, 
    options: HighlightOptions
  ): HighlightHandle;
  
  // Query
  getActiveHighlights(): HighlightInfo[];
  getHighlightsForChannel(channel: string): HighlightInfo[];
  
  // Clear
  clearChannel(channel: string): void;
  clearAll(): void;
}

export interface HighlightOptions {
  channel: string;           // 'lineage', 'impact', 'selection', etc.
  color?: string;            // Override default channel color
  style?: 'solid' | 'pulse' | 'glow';
  persistent?: boolean;      // Stay until dismissed (default: true)
  label?: string;            // Optional label near highlight
}

export interface HighlightHandle {
  id: string;
  channel: string;
  
  // Control
  update(nodeIds: string[]): void;  // Change what's highlighted
  setLabel(label: string): void;
  dismiss(): void;
  
  // Query
  isActive(): boolean;
  getNodeIds(): string[];
}

export interface PathDefinition {
  nodes: string[];              // Ordered node IDs in the path
  connections: ConnectionRef[]; // Connections between them
  crossesComponents?: boolean;
  componentBoundaries?: ComponentBoundary[];
}

export interface ConnectionRef {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

export interface ComponentBoundary {
  componentName: string;
  entryNodeId?: string;    // Component Input
  exitNodeId?: string;     // Component Output
}
```

---

## Channel System

Different highlight channels for different purposes:

```typescript
const HIGHLIGHT_CHANNELS = {
  lineage: {
    color: '#4A90D9',      // Blue
    style: 'glow',
    description: 'Data lineage traces'
  },
  impact: {
    color: '#F5A623',      // Orange
    style: 'pulse',
    description: 'Impact/dependency highlights'
  },
  selection: {
    color: '#FFFFFF',      // White
    style: 'solid',
    description: 'Current selection'
  },
  warning: {
    color: '#FF6B6B',      // Red
    style: 'pulse',
    description: 'Issues or duplicates'
  }
};
```

Channels can coexist - a node can have both lineage AND impact highlights.

---

## Persistence Across Navigation

**The key feature:** Highlights persist when you navigate to different components.

### Implementation Approach

```typescript
// Global highlight state (not per-component)
class HighlightManager {
  private highlights: Map<string, HighlightState> = new Map();
  
  // When component changes, update what's visible
  onComponentChanged(newComponent: ComponentModel) {
    this.highlights.forEach((state, id) => {
      // Find which nodes in this highlight are in the new component
      state.visibleNodes = state.allNodes.filter(
        nodeId => this.nodeExistsInComponent(nodeId, newComponent)
      );
      
      // Update the visual highlighting
      this.updateVisualHighlight(id);
    });
  }
}
```

### Cross-Component Indicators

When a highlight path crosses component boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔗 Lineage: messageText                                     │
│                                                             │
│ ⬆️ Path continues in parent: App Shell              [Go ↗] │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ REST /api/user → userData.name → String Format → ★ HERE     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ⬇️ Path continues in child: TextField              [Go ↗]  │
└─────────────────────────────────────────────────────────────┘
```

---

## Rendering Highlights

### Option A: Canvas-Based (Recommended)

Modify the canvas paint loop to render highlights:

```typescript
// In NodeGraphEditor paint cycle
paintHighlights() {
  const highlights = HighlightManager.getHighlightsForCurrentComponent();
  
  highlights.forEach(highlight => {
    highlight.visibleNodes.forEach(nodeId => {
      const node = this.getNodeById(nodeId);
      this.paintNodeHighlight(node, highlight.options);
    });
    
    highlight.visibleConnections.forEach(conn => {
      this.paintConnectionHighlight(conn, highlight.options);
    });
  });
}
```

**Pros:** Native canvas rendering, performant
**Cons:** Requires modifying NodeGraphEditor paint loop

### Option B: Overlay-Based

Use the canvas overlay system (PREREQ-003) to render highlights as a layer:

```typescript
// HighlightOverlay.tsx
function HighlightOverlay({ highlights, viewport }) {
  return (
    <svg style={{ position: 'absolute', pointerEvents: 'none' }}>
      {highlights.map(h => (
        <HighlightPath key={h.id} path={h} viewport={viewport} />
      ))}
    </svg>
  );
}
```

**Pros:** Uses overlay infrastructure, easier to implement
**Cons:** May have z-order issues with canvas content

### Recommendation

Start with **Option B** (overlay-based) for faster implementation, then optimize to **Option A** if performance requires.

---

## Implementation Steps

### Phase 1: Core API (4-6 hours)

1. Create `canvasHighlight.ts` with TypeScript interfaces
2. Implement `HighlightManager` singleton
3. Implement channel system
4. Add highlight state storage

### Phase 2: Visual Rendering (4-6 hours)

1. Create `HighlightOverlay` component (using overlay pattern from PREREQ-003)
2. Implement node highlighting visuals
3. Implement connection highlighting visuals
4. Implement glow/pulse effects

### Phase 3: Persistence (2-4 hours)

1. Hook into component navigation
2. Update visible nodes on component change
3. Create boundary indicators UI

### Phase 4: Integration (2-4 hours)

1. Expose API to view components
2. Create hooks for easy use: `useHighlight()`
3. Test with sample data

---

## Files to Create

```
packages/noodl-editor/src/editor/src/
├── services/
│   └── HighlightManager/
│       ├── index.ts
│       ├── HighlightManager.ts
│       ├── types.ts
│       └── channels.ts
└── views/
    └── CanvasOverlays/
        └── HighlightOverlay/
            ├── index.ts
            ├── HighlightOverlay.tsx
            ├── NodeHighlight.tsx
            ├── ConnectionHighlight.tsx
            └── BoundaryIndicator.tsx
```

---

## Usage Example

```typescript
// In Data Lineage view
function traceLineage(nodeId: string) {
  const path = graphAnalysis.traceUpstream(nodeId);
  
  const handle = highlightAPI.highlightPath(path, {
    channel: 'lineage',
    style: 'glow',
    persistent: true,
    label: `Lineage for ${nodeName}`
  });
  
  // Store handle to dismiss later
  setActiveLineageHandle(handle);
}

// When user clicks dismiss
function dismissLineage() {
  activeLineageHandle?.dismiss();
}
```

---

## Verification Checklist

- [ ] Can highlight individual nodes
- [ ] Can highlight connections
- [ ] Can highlight entire paths
- [ ] Multiple channels work simultaneously
- [ ] Highlights persist across component navigation
- [ ] Boundary indicators show correctly
- [ ] Dismiss button works
- [ ] Performance acceptable with many highlights

---

## Success Criteria

1. Highlighting API fully functional
2. Glow/pulse effects visually appealing
3. Persists across navigation
4. Multiple channels coexist
5. Easy to use from view components
6. Performance acceptable
