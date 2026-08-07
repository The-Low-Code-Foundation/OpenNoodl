# VIEW-000: Foundation & Shared Utilities

## Overview

Build the shared infrastructure that all visualization views will depend on: graph traversal utilities, cross-component resolution, the view panel framework, and navigation helpers.

**Estimate:** 4-5 days  
**Priority:** CRITICAL (blocks all other VIEW tasks)  
**Complexity:** Medium  

---

## Goals

1. Create graph analysis utilities for traversing nodes and connections
2. Build cross-component connection resolution (follow Component Inputs/Outputs)
3. Implement the view panel framework (tabbed container for all views)
4. Create "Jump to Canvas" navigation helper
5. Establish patterns and types for view implementations

---

## Why Foundation First?

Every view needs to:
- Traverse the node graph in some way
- Potentially cross component boundaries
- Display in a consistent panel/container
- Allow navigation back to the canvas

Building this once, correctly, saves massive duplication and ensures consistency.

### 4. Real-Time Update System

Views must stay in sync with canvas changes and runtime state. This requires a subscription system.

```typescript
// viewUpdates.ts

export interface ViewUpdateSource {
  // Canvas/model changes
  onNodeAdded: (callback: (node: NodeGraphNode) => void) => Unsubscribe;
  onNodeRemoved: (callback: (nodeId: string) => void) => Unsubscribe;
  onConnectionAdded: (callback: (conn: Connection) => void) => Unsubscribe;
  onConnectionRemoved: (callback: (conn: Connection) => void) => Unsubscribe;
  onNodeParameterChanged: (callback: (nodeId: string, param: string, value: unknown) => void) => Unsubscribe;
  
  // Component changes
  onComponentSwitched: (callback: (component: ComponentModel) => void) => Unsubscribe;
  
  // Runtime events (for views that need them)
  onRuntimeEvent: (callback: (event: RuntimeEvent) => void) => Unsubscribe;
}

// Hook for views to subscribe to updates
export function useViewUpdates(
  dependencies: ('nodes' | 'connections' | 'runtime')[],
  callback: () => void
): void {
  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];
    
    if (dependencies.includes('nodes')) {
      unsubscribes.push(viewUpdateSource.onNodeAdded(callback));
      unsubscribes.push(viewUpdateSource.onNodeRemoved(callback));
    }
    
    if (dependencies.includes('connections')) {
      unsubscribes.push(viewUpdateSource.onConnectionAdded(callback));
      unsubscribes.push(viewUpdateSource.onConnectionRemoved(callback));
    }
    
    if (dependencies.includes('runtime')) {
      unsubscribes.push(viewUpdateSource.onRuntimeEvent(callback));
    }
    
    return () => unsubscribes.forEach(unsub => unsub());
  }, [dependencies, callback]);
}
```

#### Update Strategy Per View

| View | Update Triggers | Debounce? |
|------|-----------------|-----------|
| Topology Map | Component added/removed | Yes (500ms) |
| Component X-Ray | Nodes/connections in current component | Yes (200ms) |
| Trigger Chain | Runtime events (when recording) | No (real-time) |
| Node Census | Nodes/connections changed | Yes (300ms) |
| Data Lineage | Connections changed, runtime values | Yes (200ms) |
| Impact Radar | Component interface changed | Yes (500ms) |
| Semantic Layers | Nodes added/removed | Yes (100ms) |

### 5. Understanding Existing Debug Infrastructure (CRITICAL)

**Several views need to integrate with Noodl's existing runtime debugging.** Before building those views, we need to document how the current system works.

The existing canvas already has powerful runtime features:
- Nodes "light up" when they fire
- Connections animate when data flows
- DebugInspector shows live values on hover
- You can pin inspectors to track values over time

#### Key Components to Investigate

```typescript
// These likely exist and need documentation:

// 1. DebugInspector - manages live value inspection
// Location: packages/noodl-editor/src/editor/src/models/DebugInspector/
DebugInspector.instance.getValueForPort(nodeId, port);
DebugInspector.InspectorsModel; // Manages pinned inspectors

// 2. Node highlighting in canvas
// Location: packages/noodl-editor/src/editor/src/views/nodegrapheditor/
nodeGraphEditor.highlightNode(node, duration);
nodeGraphEditor.highlightConnection(connection, duration);

// 3. Runtime event emission
// Location: packages/noodl-runtime/src/
nodeInstance.on('outputChanged', handler);
nodeInstance.on('signalSent', handler);
```

#### Documentation Task

Before implementing VIEW-003 (Trigger Chain) or live features in VIEW-005 (Data Lineage), add a research phase:

1. **Map the debug event flow**: How do runtime events get from node execution to canvas highlighting?
2. **Document DebugInspector API**: What methods are available? How does pinning work?
3. **Identify extension points**: Where can we tap in to record events?
4. **Find component boundary handling**: How does debugging work across nested components?

This research will be invaluable for:
- VIEW-003: Trigger Chain Debugger (needs to record all debug events)
- VIEW-005: Data Lineage live mode (needs live value access)
- VIEW-007: Semantic Layers (needs to preserve highlighting behavior)

---

## Technical Design

### 1. Graph Analysis Module

**Location:** `packages/noodl-editor/src/editor/src/utils/graphAnalysis/`

```typescript
// index.ts - public API
export * from './traversal';
export * from './crossComponent';
export * from './categorization';
export * from './duplicateDetection';
export * from './types';
```

#### 1.1 Traversal Utilities

```typescript
// traversal.ts

export interface ConnectionPath {
  node: NodeGraphNode;
  port: string;
  direction: 'input' | 'output';
  connection?: Connection;
}

export interface TraversalResult {
  path: ConnectionPath[];
  crossedComponents: ComponentCrossing[];
  terminatedAt: 'source' | 'sink' | 'cycle' | 'component-boundary';
}

/**
 * Trace a connection chain from a starting point.
 * Follows connections upstream (to sources) or downstream (to sinks).
 */
export function traceConnectionChain(
  component: ComponentModel,
  startNodeId: string,
  startPort: string,
  direction: 'upstream' | 'downstream',
  options?: {
    maxDepth?: number;
    crossComponents?: boolean;
    stopAtTypes?: string[];  // Stop when hitting these node types
  }
): TraversalResult;

/**
 * Get all nodes directly connected to a given node.
 */
export function getConnectedNodes(
  component: ComponentModel,
  nodeId: string
): { inputs: NodeGraphNode[]; outputs: NodeGraphNode[] };

/**
 * Get all connections for a specific port.
 */
export function getPortConnections(
  component: ComponentModel,
  nodeId: string,
  portName: string,
  direction: 'input' | 'output'
): Connection[];

/**
 * Build adjacency list representation of the graph.
 */
export function buildAdjacencyList(
  component: ComponentModel
): Map<string, { inputs: string[]; outputs: string[] }>;
```

#### 1.2 Cross-Component Resolution

```typescript
// crossComponent.ts

export interface ComponentCrossing {
  fromComponent: ComponentModel;
  toComponent: ComponentModel;
  viaPort: string;
  direction: 'into' | 'outof';
}

export interface ComponentUsage {
  component: ComponentModel;      // The component being used
  usedIn: ComponentModel;         // Where it's used
  instanceNodeId: string;         // The node ID of the instance
  connectedPorts: {
    port: string;
    connectedTo: { nodeId: string; port: string }[];
  }[];
}

/**
 * Find all places where a component is instantiated across the project.
 */
export function findComponentUsages(
  project: ProjectModel,
  componentName: string
): ComponentUsage[];

/**
 * Resolve a Component Input/Output to its external connections.
 * Given a Component Inputs node, find what feeds into it from the parent.
 */
export function resolveComponentBoundary(
  project: ProjectModel,
  component: ComponentModel,
  boundaryNodeId: string,  // Component Inputs or Component Outputs node
  portName: string
): ExternalConnection[];

/**
 * Build complete component dependency graph for the project.
 */
export function buildComponentDependencyGraph(
  project: ProjectModel
): {
  nodes: ComponentModel[];
  edges: { from: string; to: string; count: number }[];
};
```

#### 1.3 Node Categorization

```typescript
// categorization.ts

export type NodeCategory = 
  | 'visual'        // Groups, Text, Image, etc.
  | 'data'          // Variables, Objects, Arrays
  | 'logic'         // Conditions, Expressions, Switches
  | 'events'        // Send Event, Receive Event, Component I/O
  | 'api'           // REST, Function, Cloud Functions
  | 'navigation'    // Page Router, Navigate
  | 'animation'     // Transitions, States (animation-related)
  | 'utility'       // Other/misc

export interface CategorizedNodes {
  byCategory: Map<NodeCategory, NodeGraphNode[]>;
  byType: Map<string, NodeGraphNode[]>;
  totals: { category: NodeCategory; count: number }[];
}

/**
 * Categorize all nodes in a component by semantic type.
 */
export function categorizeNodes(component: ComponentModel): CategorizedNodes;

/**
 * Get the category for a specific node type.
 */
export function getNodeCategory(nodeType: string): NodeCategory;

/**
 * Check if a node is a visual node (has visual hierarchy).
 */
export function isVisualNode(node: NodeGraphNode): boolean;

/**
 * Check if a node is a data source (Variable, Object, Array, etc.).
 */
export function isDataSourceNode(node: NodeGraphNode): boolean;
```

#### 1.4 Duplicate Detection

```typescript
// duplicateDetection.ts

export interface DuplicateGroup {
  name: string;
  type: string;
  instances: {
    node: NodeGraphNode;
    component: ComponentModel;
    connectionCount: number;
  }[];
  severity: 'info' | 'warning' | 'error';
  reason: string;  // Why this might be a problem
}

/**
 * Find potential duplicate nodes within a component.
 * Duplicates = same type + same/similar name.
 */
export function findDuplicatesInComponent(
  component: ComponentModel
): DuplicateGroup[];

/**
 * Find potential duplicate nodes across the entire project.
 */
export function findDuplicatesInProject(
  project: ProjectModel
): DuplicateGroup[];

/**
 * Analyze if duplicates might cause conflicts.
 * E.g., two Variables with same name writing to same output.
 */
export function analyzeDuplicateConflicts(
  duplicates: DuplicateGroup[]
): ConflictAnalysis[];
```

### 2. View Panel Framework

**Location:** `packages/noodl-editor/src/editor/src/views/AnalysisPanel/`

```typescript
// AnalysisPanel.tsx

export interface AnalysisView {
  id: string;
  name: string;
  icon: IconName;
  component: React.ComponentType<AnalysisViewProps>;
}

export interface AnalysisViewProps {
  project: ProjectModel;
  currentComponent: ComponentModel | null;
  selectedNodes: NodeGraphNode[];
  onNavigateToNode: (componentName: string, nodeId: string) => void;
  onNavigateToComponent: (componentName: string) => void;
}

export function AnalysisPanel({ 
  views,
  activeViewId,
  onViewChange 
}: AnalysisPanelProps): JSX.Element;
```

#### Panel Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Analysis                                              [×]   │
├─────────────────────────────────────────────────────────────┤
│ [🗺️] [📋] [🔍] [📊] [🔗] [💥] [📑]                          │
│  Map Census Find  Lin  Imp  Layers                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              {Active View Component}                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 📍 Current: Presales Page                    [↗ Canvas]    │
└─────────────────────────────────────────────────────────────┘
```

### 2. View Infrastructure

**Location:** `packages/noodl-editor/src/editor/src/views/`

The visualization system has three types of components:

#### 2a. Meta View Tabs

These replace the canvas entirely (like Topology Map, Trigger Chain):

```typescript
// MetaViewTabs.tsx - Tab bar for switching between Canvas and meta views

export type MetaViewId = 'canvas' | 'topology' | 'triggers';

export interface MetaViewDefinition {
  id: MetaViewId;
  name: string;
  icon: IconName;
  shortcut?: string;
  component: React.ComponentType<MetaViewProps>;
}

export interface MetaViewProps {
  project: ProjectModel;
  onNavigateToCanvas: (componentName: string, nodeId?: string) => void;
}
```

```
┌─────────────────────────────────────────────────────────────────┐
│  ◀ ▶  │ [🗺️ Canvas] [📊 Topology] [⚡ Triggers]     │ ▶ Preview │
└─────────────────────────────────────────────────────────────────┘
```

#### 2b. Sidebar Panels

These open alongside the canvas (using existing SidebarModel):

```typescript
// Already supported by SidebarModel!
// Just register new React components:

SidebarModel.instance.register({
  id: 'xray',
  name: 'X-Ray',
  icon: IconName.Search,
  panel: ComponentXRayPanel  // React component
});

SidebarModel.instance.register({
  id: 'census', 
  name: 'Census',
  icon: IconName.List,
  panel: NodeCensusPanel  // React component
});
```

#### 2c. Canvas Overlays (THE BIG ONE)

These enhance the existing canvas with toggleable overlays:

```typescript
// CanvasOverlayManager.tsx

export type OverlayId = 'layers' | 'lineage' | 'impact';

export interface CanvasOverlay {
  id: OverlayId;
  name: string;
  icon: IconName;
  
  // The React component that renders over the canvas
  component: React.ComponentType<CanvasOverlayProps>;
  
  // Optional panel component for controls/details
  panelComponent?: React.ComponentType<OverlayPanelProps>;
}

export interface CanvasOverlayProps {
  // Canvas transform info (for positioning overlays)
  scale: number;
  pan: { x: number; y: number };
  
  // Current component context
  component: ComponentModel;
  
  // Callback to control canvas highlighting
  highlightAPI: CanvasHighlightAPI;
}

export interface CanvasOverlayManagerProps {
  activeOverlays: Set<OverlayId>;
  onToggleOverlay: (id: OverlayId) => void;
}

// Toolbar for toggling overlays
export function CanvasOverlayToolbar({ 
  activeOverlays, 
  onToggleOverlay 
}: CanvasOverlayManagerProps): JSX.Element;
```

**Based on CommentLayer pattern** - this already exists and works!

```
┌─────────────────────────────────────────────────────────────────┐
│ Login Page                         [Layers] [Lineage ✓] [Impact]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Canvas with overlays rendered on top...                       │
│   Lineage highlights glowing on connections...                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 🔗 Lineage Panel (when active)                             [×] │
│ Details about the current lineage trace...                      │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Canvas Highlighting API (Critical for Overlays)

**This is what makes the overlays legendary!**

The canvas needs an API for persistent, multi-channel highlighting:

```typescript
// canvasHighlight.ts

export interface CanvasHighlightAPI {
  // Create a new highlight (returns handle to control it)
  highlightNodes(nodeIds: string[], options: HighlightOptions): HighlightHandle;
  highlightConnections(connections: ConnectionRef[], options: HighlightOptions): HighlightHandle;
  highlightPath(path: PathDefinition, options: HighlightOptions): HighlightHandle;
  
  // Query active highlights
  getActiveHighlights(): HighlightInfo[];
  
  // Clear all highlights in a channel
  clearChannel(channel: string): void;
  
  // Clear everything
  clearAll(): void;
}

export interface HighlightOptions {
  channel: string;           // 'lineage', 'impact', 'selection', etc.
  color?: string;            // Override default channel color
  style?: 'solid' | 'pulse' | 'glow';
  persistent?: boolean;      // Stay until explicitly dismissed (default: true)
  label?: string;            // Optional label shown near highlight
}

export interface HighlightHandle {
  id: string;
  channel: string;
  update(nodeIds: string[]): void;  // Change what's highlighted
  dismiss(): void;                   // Remove this highlight
}

export interface PathDefinition {
  nodes: string[];              // Ordered list of node IDs in the path
  connections: ConnectionRef[]; // Connections between them
  crossesComponents?: boolean;  // True if path spans multiple components
}

// Channel defaults
const HIGHLIGHT_CHANNELS = {
  lineage: { color: '#4A90D9', style: 'glow' },     // Blue glow for data flow
  impact: { color: '#F5A623', style: 'pulse' },     // Orange pulse for dependencies
  selection: { color: '#FFFFFF', style: 'solid' },  // White for selection
  warning: { color: '#FF6B6B', style: 'pulse' }     // Red pulse for issues
};
```

#### Key Behavior: Persistent Across Navigation!

When you navigate from Presales Page to its parent App Shell, the lineage highlights should:
1. Stay visible on any nodes that exist in the new view
2. Show an indicator: "⬆️ Path continues in child: Presales Page [Go ↗]"

```typescript
// Highlight state is stored globally, not per-component
interface GlobalHighlightState {
  activeHighlights: Map<string, {
    handle: HighlightHandle;
    affectedComponents: string[];  // Which components have nodes in this highlight
    currentlyVisible: string[];    // Node IDs visible in current component
  }>;
}
```

#### Navigation Helpers

```typescript
// navigation.ts

/**
 * Navigate to a specific node on the canvas.
 * - Switches to the correct component if needed
 * - Pans the canvas to center on the node
 * - Selects the node
 * - Does NOT dismiss active highlights (they persist!)
 */
export function navigateToNode(
  componentName: string,
  nodeId: string,
  options?: {
    select?: boolean;
    highlight?: boolean;       // Add temporary highlight on top of persistent ones
    zoomToFit?: boolean;
  }
): void;

/**
 * Navigate to a component (open it in the canvas).
 * Active highlights update to show relevant portions.
 */
export function navigateToComponent(
  componentName: string
): void;
```

### 4. Shared Types

```typescript
// types.ts

export interface NodeSummary {
  id: string;
  type: string;
  displayName: string;
  label: string | null;  // User-assigned label
  category: NodeCategory;
  inputCount: number;
  outputCount: number;
  connectedInputs: number;
  connectedOutputs: number;
  hasChildren: boolean;  // For visual nodes
  childCount: number;
}

export interface ConnectionSummary {
  fromNode: NodeSummary;
  fromPort: string;
  toNode: NodeSummary;
  toPort: string;
}

export interface ComponentSummary {
  name: string;
  fullName: string;
  nodeCount: number;
  connectionCount: number;
  inputPorts: string[];
  outputPorts: string[];
  usedComponents: string[];  // Subcomponents used
  usedByComponents: string[];  // Components that use this one
  categories: { category: NodeCategory; count: number }[];
}
```

---

## Implementation Phases

### Phase 1: Core Traversal (1 day)

1. Create `graphAnalysis/` folder structure
2. Implement `traversal.ts`:
   - `traceConnectionChain()`
   - `getConnectedNodes()`
   - `getPortConnections()`
   - `buildAdjacencyList()`
3. Write unit tests for traversal functions
4. Test with real component data

**Verification:**
- [ ] Can trace a connection chain forward and backward
- [ ] Correctly handles branching (one output to multiple inputs)
- [ ] Stops at specified depth limits
- [ ] Handles cycles without infinite loops

### Phase 2: Cross-Component Resolution (1 day)

1. Implement `crossComponent.ts`:
   - `findComponentUsages()`
   - `resolveComponentBoundary()`
   - `buildComponentDependencyGraph()`
2. Handle Component Inputs/Outputs nodes specially
3. Test with nested component scenarios

**Verification:**
- [ ] Can find all places a component is used
- [ ] Can resolve what feeds into a Component Input from the parent
- [ ] Dependency graph correctly shows component relationships

### Phase 3: Categorization & Duplicate Detection (0.5 days)

1. Implement `categorization.ts`
2. Implement `duplicateDetection.ts`
3. Create category mapping for all known node types

**Verification:**
- [ ] All node types correctly categorized
- [ ] Duplicates detected based on name + type
- [ ] Severity levels assigned appropriately

### Phase 4: View Switcher Framework (1 day)

1. Create `ViewSwitcher/` component structure
2. Implement dropdown UI with view list
3. Wire up view switching (replace canvas area content)
4. Implement state persistence (localStorage)
5. Add keyboard shortcuts for view switching
6. Integrate with existing canvas header

**Verification:**
- [ ] Dropdown appears in canvas header
- [ ] Clicking view switches content area
- [ ] State persists across page reloads
- [ ] Keyboard shortcuts work
- [ ] "Node Canvas" view shows existing canvas (no regression)

### Phase 5: Navigation Helpers (0.5 days)

1. Implement `navigateToCanvas()` with all options
2. Implement `highlightNodes()` / `highlightConnectionPath()`
3. Integrate with NodeGraphEditor
4. Test jumping from placeholder views

**Verification:**
- [ ] Clicking a node reference in any view jumps to canvas
- [ ] Node is centered and selected
- [ ] Temporary highlight works for tracing
- [ ] Works across component boundaries

### Phase 6: Debug Infrastructure Documentation (0.5 days)

1. Research and document existing DebugInspector system
2. Document node highlighting mechanism
3. Document runtime event emission
4. Identify extension points for VIEW-003 and VIEW-005
5. Create `DEBUG-INFRASTRUCTURE.md` reference doc

**Verification:**
- [ ] DebugInspector API documented
- [ ] Node highlighting mechanism understood
- [ ] Clear path for Trigger Chain integration

---

## Files to Create

```
packages/noodl-editor/src/editor/src/
├── utils/
│   └── graphAnalysis/
│       ├── index.ts
│       ├── traversal.ts
│       ├── crossComponent.ts
│       ├── categorization.ts
│       ├── duplicateDetection.ts
│       ├── navigation.ts
│       └── types.ts
├── views/
│   ├── ViewSwitcher/
│   │   ├── index.ts
│   │   ├── ViewSwitcher.tsx
│   │   ├── ViewSwitcher.module.scss
│   │   ├── ViewDropdown.tsx
│   │   ├── viewDefinitions.ts
│   │   └── viewStateStore.ts
│   └── AnalysisViews/
│       ├── index.ts
│       ├── shared/
│       │   ├── ViewContainer.tsx      # Common wrapper for all views
│       │   ├── NodeReference.tsx      # Clickable node link component
│       │   └── ComponentBadge.tsx     # Component name badge with navigation
│       └── [individual view folders created by VIEW-001 through VIEW-007]
└── docs/
    └── DEBUG-INFRASTRUCTURE.md        # Documentation of existing debug system
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/traversal.test.ts

describe('traceConnectionChain', () => {
  it('follows a simple linear chain', () => { ... });
  it('handles branching outputs', () => { ... });
  it('stops at max depth', () => { ... });
  it('detects and handles cycles', () => { ... });
  it('crosses component boundaries when enabled', () => { ... });
});
```

### Integration Tests

- Load a real complex project
- Run traversal from various starting points
- Verify results match manual inspection

---

## Success Criteria

- [ ] All traversal functions work correctly on complex graphs
- [ ] Cross-component resolution handles nested components
- [ ] View panel integrates cleanly with existing sidebar
- [ ] Navigation to canvas works from external code
- [ ] Types are comprehensive and well-documented
- [ ] Unit tests cover edge cases

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Performance on large projects | Add pagination/lazy loading, cache results |
| Missing node type categorizations | Start with common types, add others as discovered |
| Complex component nesting | Test with deeply nested scenarios early |

---

## Dependencies

- None (this is the foundation)

## Blocks

- VIEW-001 through VIEW-007 (all visualization views)
