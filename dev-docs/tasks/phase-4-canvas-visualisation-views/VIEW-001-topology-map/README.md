# VIEW-001: Project Topology Map

**View Type:** 🗺️ Meta View (replaces canvas with project-wide view)

## Overview

A high-level "Google Maps" view of the entire project's component structure. Shows how components relate to each other as a navigable graph, with a "You Are Here" indicator and the ability to jump to any component.

**Estimate:** 4-5 days  
**Priority:** HIGH  
**Complexity:** Medium  
**Dependencies:** VIEW-000 (Foundation)

---

## The Problem

When working in a complex Noodl project:

- You can't see how many components exist or how they relate
- You lose track of where you are when deep in nested components
- There's no way to get a "big picture" view of the project architecture
- Finding a component means hunting through the Components Panel tree

---

## The Solution

A visual map showing:

- Every component as a box/node
- Arrows showing which components use which others
- "You Are Here" highlight on the current component
- Click-to-navigate to any component
- Breadcrumb trail showing how you got to your current location

---

## User Stories

1. **As a new developer** joining a project, I want to see the overall structure so I can understand how the app is organized.

2. **As a developer debugging**, I want to see where the current component fits in the hierarchy so I understand the context.

3. **As a developer navigating**, I want to click on any component in the map to jump directly to it.

4. **As a developer planning**, I want to see which components are reused in multiple places.

---

## UI Design

### Main View

```
┌─────────────────────────────────────────────────────────────────┐
│ Project Topology                                    [Fit] [−][+]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐                  │
│   │  Login  │     │  Home   │     │ Profile │   📄 PAGES       │
│   │  Page   │     │  Page   │     │  Page   │                  │
│   └────┬────┘     └────┬────┘     └────┬────┘                  │
│        │               │               │                        │
│        │    ┌──────────┼───────────────┤                       │
│        │    │          │               │                        │
│        ▼    ▼          ▼               ▼                        │
│   ┌─────────────┐ ┌─────────┐ ┌──────────────┐                 │
│   │   AuthFlow  │ │  NavBar │ │  UserCard    │  🧩 SHARED      │
│   │ ★ YOU ARE   │ │  (×3)   │ │   (×2)       │                 │
│   │    HERE     │ └─────────┘ └──────────────┘                 │
│   └──────┬──────┘                    │                          │
│          │                           │                          │
│          ▼                           ▼                          │
│   ┌─────────────┐            ┌──────────────┐                  │
│   │ LoginForm   │            │  AvatarIcon  │  🔧 NESTED       │
│   │ Component   │            │  Component   │                  │
│   └─────────────┘            └──────────────┘                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 📍 Path: App Shell → Login Page → AuthFlow                      │
│ 📊 23 components total | 8 pages | 12 shared | 3 nested         │
└─────────────────────────────────────────────────────────────────┘
```

### Component Node Styling

| Component Type           | Visual Style                        |
| ------------------------ | ----------------------------------- |
| Page                     | Larger box, 📄 icon, distinct color |
| Shared (used 2+ times)   | Badge showing usage count (×3)      |
| Current ("You Are Here") | Highlighted border, ★ indicator     |
| Has subcomponents        | Subtle "expandable" indicator       |
| Orphan (unused)          | Dimmed, warning style               |

### Interactions

- **Click component** → Jump to that component in canvas
- **Hover component** → Show tooltip with summary (node count, I/O ports)
- **Double-click** → Expand to show internal structure (optional)
- **Drag to pan** → Navigate large maps
- **Scroll to zoom** → Zoom in/out
- **[Fit] button** → Fit entire map in view
- **Click breadcrumb** → Navigate to that ancestor component

---

## Technical Design

### Data Model

```typescript
interface TopologyNode {
  component: ComponentModel;
  name: string;
  fullName: string;
  type: 'page' | 'component';
  usageCount: number; // How many places use this component
  usedBy: string[]; // Which components use this one
  uses: string[]; // Which components this one uses
  depth: number; // Nesting depth from root
  isCurrentComponent: boolean;
}

interface TopologyEdge {
  from: string; // Component fullName
  to: string; // Component fullName
  count: number; // How many instances
}

interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  currentPath: string[]; // Breadcrumb path
}
```

### Building the Graph

```typescript
function buildTopologyGraph(project: ProjectModel): TopologyGraph {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];

  // 1. Collect all components
  project.forEachComponent((component) => {
    nodes.push({
      component,
      name: component.name,
      fullName: component.fullName,
      type: isPageComponent(component) ? 'page' : 'component',
      usageCount: 0,
      usedBy: [],
      uses: [],
      depth: 0,
      isCurrentComponent: false
    });
  });

  // 2. Find all component usages (nodes of type that matches a component name)
  nodes.forEach((node) => {
    node.component.graph.forEachNode((graphNode) => {
      if (isComponentInstance(graphNode)) {
        const usedComponentName = graphNode.type.name;
        const usedNode = nodes.find((n) => n.fullName === usedComponentName);
        if (usedNode) {
          usedNode.usageCount++;
          usedNode.usedBy.push(node.fullName);
          node.uses.push(usedComponentName);

          edges.push({
            from: node.fullName,
            to: usedComponentName,
            count: 1 // Aggregate later
          });
        }
      }
    });
  });

  // 3. Calculate depths (BFS from pages)
  calculateDepths(nodes, edges);

  return { nodes, edges, currentPath: [] };
}
```

### Layout Algorithm

Use a hierarchical layout (like Dagre) to position nodes:

```typescript
import dagre from 'dagre';

function layoutTopology(graph: TopologyGraph): PositionedTopologyGraph {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with estimated sizes
  graph.nodes.forEach((node) => {
    const width = node.type === 'page' ? 140 : 120;
    const height = 60;
    g.setNode(node.fullName, { width, height });
  });

  // Add edges
  graph.edges.forEach((edge) => {
    g.setEdge(edge.from, edge.to);
  });

  dagre.layout(g);

  // Extract positions
  return graph.nodes.map((node) => ({
    ...node,
    x: g.node(node.fullName).x,
    y: g.node(node.fullName).y
  }));
}
```

### Rendering

Could use:

- **SVG** - Simple, good for moderate sizes
- **Canvas** - Better performance for large graphs
- **React Flow** - Library specifically for this (already used elsewhere?)

Recommend starting with SVG for simplicity, refactor to Canvas if performance issues.

---

## Implementation Phases

### Phase 1: Data Collection (1 day)

1. Implement `buildTopologyGraph()` using VIEW-000 utilities
2. Correctly identify component instances vs regular nodes
3. Calculate usage counts and relationships
4. Determine page vs component classification

**Verification:**

- [ ] All components in project appear in graph
- [ ] Component usage relationships are correct
- [ ] Pages correctly identified

### Phase 2: Layout Algorithm (1 day)

1. Integrate Dagre.js for hierarchical layout
2. Position pages at top, shared components in middle, nested at bottom
3. Handle edge cases (cycles, orphans)
4. Calculate viewport bounds

**Verification:**

- [ ] Layout produces non-overlapping nodes
- [ ] Hierarchy is visually clear
- [ ] Large graphs don't break

### Phase 3: Basic Rendering (1 day)

1. Create `TopologyMapView` React component
2. Render nodes as styled boxes
3. Render edges as lines/arrows
4. Implement pan and zoom
5. Add "Fit to View" button

**Verification:**

- [ ] Graph renders correctly
- [ ] Can pan and zoom
- [ ] Fit button works

### Phase 4: Interactivity (1 day)

1. Click node → Navigate to component
2. Hover → Show tooltip
3. Highlight current component
4. Show breadcrumb path
5. Add "You Are Here" indicator

**Verification:**

- [ ] Clicking navigates correctly
- [ ] Current component highlighted
- [ ] Breadcrumb shows path

### Phase 5: Polish (0.5-1 day)

1. Style refinement (colors, icons, badges)
2. Add usage count badges
3. Add orphan warnings
4. Performance optimization if needed
5. Add to Analysis Panel tabs

**Verification:**

- [ ] Visually polished
- [ ] Integrates with Analysis Panel
- [ ] Performance acceptable on large projects

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/AnalysisPanel/
└── TopologyMapView/
    ├── index.ts
    ├── TopologyMapView.tsx
    ├── TopologyMapView.module.scss
    ├── TopologyNode.tsx
    ├── TopologyEdge.tsx
    ├── TopologyTooltip.tsx
    ├── Breadcrumbs.tsx
    └── useTopologyGraph.ts
```

---

## Success Criteria

- [ ] Shows all components in the project
- [ ] Correctly displays which components use which
- [ ] "You Are Here" correctly highlights current component
- [ ] Click navigation works
- [ ] Breadcrumb trail is accurate
- [ ] Renders reasonably fast (< 1s) for projects with 50+ components
- [ ] Layout is readable (no major overlaps)

---

## Future Enhancements

- **Expand/collapse** - Click to expand a component and show its internal node summary
- **Filter** - Show only pages, only shared, only orphans
- **Search** - Find and highlight a component by name
- **Minimap** - Small overview when zoomed in
- **Export** - Export as PNG/SVG for documentation

---

## Risks & Mitigations

| Risk                                 | Mitigation                                |
| ------------------------------------ | ----------------------------------------- |
| Large projects (100+ components)     | Virtual rendering, progressive loading    |
| Complex nesting causes layout issues | Test with deeply nested projects early    |
| Dagre.js performance                 | Consider WebWorker for layout calculation |

---

## Dependencies

- VIEW-000 Foundation (for `buildComponentDependencyGraph`)
- Dagre.js (layout library)

## Blocks

- None (independent view)
