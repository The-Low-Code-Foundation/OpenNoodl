# VIEW-005: Data Lineage View

**View Type:** 🎨 Canvas Overlay (enhances existing canvas with highlighting)

## Overview

A complete trace of where any value originates and where it flows to, crossing component boundaries. The "where does this come from?" and "where does this go?" tool. **Highlights persist on the canvas until dismissed!**

**Estimate:** 3-4 days  
**Priority:** HIGH  
**Complexity:** Medium  
**Dependencies:** VIEW-000 (Foundation), PREREQ-004 (Canvas Highlighting API)

---

## The Problem

In a complex Noodl project:
- Data comes from parent components, API calls, user input... but where exactly?
- A value passes through 5 transformations before reaching its destination
- Component boundaries hide the full picture
- "The login data isn't showing up" - but why? Where did it get lost?

The question: "I'm looking at this `userName` value in a Text node. Where does it actually come from? The user input? The database? A parent component?"

---

## The Solution

A visual lineage trace that:
1. Shows the complete upstream path (all the way to the source)
2. Shows the complete downstream path (all the way to final usage)
3. Crosses component boundaries transparently
4. Shows each transformation along the way
5. Allows jumping to any point in the chain

---

## User Stories

1. **As a developer debugging**, I want to trace where a value originates to understand why it's wrong.

2. **As a developer understanding code**, I want to see what a value feeds into to understand its impact.

3. **As a developer refactoring**, I want to know the full data flow before changing a node.

4. **As a new team member**, I want to understand how data moves through the application.

---

## UI Design

### Lineage View

```
┌─────────────────────────────────────────────────────────────────┐
│ Data Lineage                         [↗ Canvas] [Refresh]       │
├─────────────────────────────────────────────────────────────────┤
│ Selected: messageText (in Create chat message)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ▲ UPSTREAM (where does this value come from?)                   │
│ ═══════════════════════════════════════════════════════════════ │
│                                                                 │
│ ┌─ App Shell ─────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ 🌐 REST: GET /api/user                              │   │ │
│ │   │    Response.body.name                               │   │ │
│ │   └────────────────────┬────────────────────────────────┘   │ │
│ │                        │                                    │ │
│ │                        ▼ .name                              │ │
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ 💾 currentUser (Object)                             │   │ │
│ │   │    Stores user data from API                        │   │ │
│ │   └────────────────────┬────────────────────────────────┘   │ │
│ │                        │                                    │ │
│ │                        ▼ → Component Output                 │ │
│ │                                                             │ │
│ └────────────────────────┼────────────────────────────────────┘ │
│                          │                                      │
│          ╔═══════════════╧═══════════════╗                     │
│          ║   Crosses into: Presales Page ║                     │
│          ╚═══════════════╤═══════════════╝                     │
│                          │                                      │
│ ┌─ Presales Page ────────┼────────────────────────────────────┐ │
│ │                        ▼ ← Component Input                  │ │
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ 💾 userData (Object)                                │   │ │
│ │   │    Local reference to user                          │   │ │
│ │   └────────────────────┬────────────────────────────────┘   │ │
│ │                        │                                    │ │
│ │                        ▼ .name property                     │ │
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ ⚡ String Format                                     │   │ │
│ │   │    "{name}: {message}"                              │   │ │
│ │   └────────────────────┬────────────────────────────────┘   │ │
│ │                        │                                    │ │
│ │                        ▼ Result                             │ │
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ ★ messageText (Selected)                            │   │ │
│ │   │    The value you asked about                        │   │ │
│ │   └─────────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ═══════════════════════════════════════════════════════════════ │
│ ▼ DOWNSTREAM (where does this value go?)                        │
│                                                                 │
│ ┌─ Presales Page ─────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ ★ messageText                                       │   │ │
│ │   └────────────────────┬────────────────────────────────┘   │ │
│ │                        │                                    │ │
│ │          ┌─────────────┴─────────────┐                     │ │
│ │          ▼                           ▼                      │ │
│ │   ┌─────────────────┐   ┌─────────────────────────────┐    │ │
│ │   │ 🧩 Create chat  │   │ 💾 firstResponderMessages   │    │ │
│ │   │    message      │   │    (Array)                  │    │ │
│ │   │    .messageText │   │    Stores for history       │    │ │
│ │   └────────┬────────┘   └─────────────────────────────┘    │ │
│ │            │                                                │ │
│ │            ▼                                                │ │
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ 🌐 REST: POST /api/messages                         │   │ │
│ │   │    Sends to server                                  │   │ │
│ │   └─────────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Path summary: REST response → Object → Component I/O →          │
│               Object → String Format → [HERE] → REST + Array    │
│                                                                 │
│ [Click any node to jump to canvas]                              │
└─────────────────────────────────────────────────────────────────┘
```

### Compact Lineage (for sidebar)

```
┌───────────────────────────────────────┐
│ messageText Lineage                   │
├───────────────────────────────────────┤
│ ▲ FROM:                               │
│   REST /api/user                      │
│     ↓ .name                           │
│   currentUser (Object)                │
│     ↓ Component boundary              │
│   userData (Object)                   │
│     ↓ .name                           │
│   String Format                       │
│     ↓                                 │
│   ★ messageText                       │
│                                       │
│ ▼ TO:                                 │
│   ├─ Create chat message              │
│   │    ↓                              │
│   │    REST POST /api/messages        │
│   └─ firstResponderMessages           │
└───────────────────────────────────────┘
```

### Interactions

- **Select any node on canvas** - Shows lineage for that node
- **Click node in lineage** - Jump to that node on canvas
- **Hover node** - Highlight on canvas
- **[Expand/Collapse]** - Toggle upstream/downstream sections
- **[Refresh]** - Recalculate lineage
- **Click path summary** - Highlight full path on canvas

---

## Technical Design

### Data Model

```typescript
interface LineageResult {
  selectedNode: {
    id: string;
    label: string;
    type: string;
    componentName: string;
  };
  
  upstream: LineagePath;
  downstream: LineagePath[];  // Can branch to multiple destinations
}

interface LineagePath {
  steps: LineageStep[];
  crossings: ComponentCrossing[];
}

interface LineageStep {
  node: NodeGraphNode;
  component: ComponentModel;
  port: string;
  portType: 'input' | 'output';
  transformation?: string;  // Description of what happens (.name, Expression, etc.)
  isSource?: boolean;       // True if this is the ultimate origin
  isSink?: boolean;         // True if this is a final destination
}

interface ComponentCrossing {
  from: ComponentModel;
  to: ComponentModel;
  viaPort: string;
  direction: 'into' | 'outof';
  stepIndex: number;  // Where in the path this crossing occurs
}
```

### Building Lineage

```typescript
function buildLineage(
  project: ProjectModel,
  component: ComponentModel,
  nodeId: string,
  port?: string  // Optional: specific port to trace
): LineageResult {
  const node = component.graph.findNodeWithId(nodeId);
  
  // Trace upstream (find sources)
  const upstream = traceUpstream(project, component, node, port);
  
  // Trace downstream (find destinations)
  const downstream = traceDownstream(project, component, node, port);
  
  return {
    selectedNode: {
      id: node.id,
      label: node.label || getDefaultLabel(node),
      type: node.type.name,
      componentName: component.name
    },
    upstream,
    downstream
  };
}

function traceUpstream(
  project: ProjectModel,
  component: ComponentModel,
  node: NodeGraphNode,
  port?: string,
  visited: Set<string> = new Set()
): LineagePath {
  const steps: LineageStep[] = [];
  const crossings: ComponentCrossing[] = [];
  
  // Prevent infinite loops
  const nodeKey = `${component.fullName}:${node.id}`;
  if (visited.has(nodeKey)) {
    return { steps, crossings };
  }
  visited.add(nodeKey);
  
  // Get input connections
  const inputs = port 
    ? getConnectionsToPort(component, node.id, port)
    : getAllInputConnections(component, node.id);
  
  for (const connection of inputs) {
    const sourceNode = component.graph.findNodeWithId(connection.fromId);
    
    steps.push({
      node: sourceNode,
      component,
      port: connection.fromProperty,
      portType: 'output',
      transformation: describeTransformation(sourceNode, connection.fromProperty)
    });
    
    // Check if this is a Component Input (crosses boundary)
    if (sourceNode.type.name === 'Component Inputs') {
      const parentInfo = findParentConnection(project, component, connection.fromProperty);
      if (parentInfo) {
        crossings.push({
          from: parentInfo.parentComponent,
          to: component,
          viaPort: connection.fromProperty,
          direction: 'into',
          stepIndex: steps.length
        });
        
        // Continue tracing in parent component
        const parentLineage = traceUpstream(
          project,
          parentInfo.parentComponent,
          parentInfo.sourceNode,
          parentInfo.sourcePort,
          visited
        );
        steps.push(...parentLineage.steps);
        crossings.push(...parentLineage.crossings);
      }
    } else if (!isSourceNode(sourceNode)) {
      // Continue tracing recursively
      const prevLineage = traceUpstream(project, component, sourceNode, undefined, visited);
      steps.push(...prevLineage.steps);
      crossings.push(...prevLineage.crossings);
    } else {
      // Mark as source
      steps[steps.length - 1].isSource = true;
    }
  }
  
  return { steps, crossings };
}

function isSourceNode(node: NodeGraphNode): boolean {
  // These node types are considered "sources" - don't trace further
  const sourceTypes = [
    'REST',           // API response is a source
    'Variable',       // Unless we want to trace where it was set
    'Object',
    'Page Inputs',
    'Receive Event',
    'Function',       // Function output is a source
    'String',         // Literal values
    'Number',
    'Boolean'
  ];
  return sourceTypes.includes(node.type.name);
}
```

---

## Implementation Phases

### Phase 1: Basic Upstream Tracing (1 day)

1. Implement `traceUpstream()` within a single component
2. Follow connections to find sources
3. Handle branching (multiple inputs)
4. Detect source nodes (REST, Variable, etc.)

**Verification:**
- [ ] Can trace simple linear chains
- [ ] Handles multiple inputs
- [ ] Stops at source nodes

### Phase 2: Cross-Component Tracing (1 day)

1. Handle Component Inputs nodes
2. Find parent component context
3. Continue trace in parent
4. Handle Component Outputs similarly
5. Track component crossings

**Verification:**
- [ ] Crosses into parent components
- [ ] Crosses into child components
- [ ] Crossings tracked correctly

### Phase 3: Downstream Tracing (0.5-1 day)

1. Implement `traceDownstream()` with similar logic
2. Handle branching (one output to multiple destinations)
3. Track all destination paths

**Verification:**
- [ ] Finds all destinations
- [ ] Handles branching
- [ ] Crosses component boundaries

### Phase 4: UI Implementation (1 day)

1. Create `DataLineageView` component
2. Render upstream path with component sections
3. Render downstream paths (tree structure)
4. Show component boundary crossings
5. Add path summary

**Verification:**
- [ ] Lineage renders correctly
- [ ] Component sections clear
- [ ] Crossings visually distinct

### Phase 5: Interactivity & Polish (0.5 day)

1. Click to navigate to node
2. Hover to highlight on canvas
3. Context menu integration ("Show Lineage")
4. Handle edge cases (orphan nodes, cycles)

**Verification:**
- [ ] Navigation works
- [ ] Context menu works
- [ ] Edge cases handled gracefully

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/AnalysisPanel/
└── DataLineageView/
    ├── index.ts
    ├── DataLineageView.tsx
    ├── DataLineageView.module.scss
    ├── LineagePath.tsx
    ├── LineageStep.tsx
    ├── ComponentSection.tsx
    ├── CrossingIndicator.tsx
    ├── PathSummary.tsx
    └── useDataLineage.ts

packages/noodl-editor/src/editor/src/utils/graphAnalysis/
└── lineage.ts
```

---

## Success Criteria

- [ ] Traces upstream to source correctly
- [ ] Traces downstream to all destinations
- [ ] Crosses component boundaries
- [ ] Shows transformations along the way
- [ ] Path summary is accurate
- [ ] Navigation to any step works
- [ ] Handles cycles without infinite loops
- [ ] Renders in < 1s for complex paths

---

## Runtime Integration (OPTIONAL BUT POWERFUL)

While Data Lineage is primarily a **static analysis** tool (showing the graph structure), it becomes dramatically more powerful with **live runtime integration**.

### Static vs Live Mode

| Mode | What it shows | Runtime needed? |
|------|---------------|-----------------|
| **Static** | The *path* data takes through the graph | No |
| **Live** | The *path* + *actual current values* at each step | Yes |

### Live Value Display

Imagine the lineage view showing not just the path, but the actual data at each step:

```
┌─────────────────────────────────────────────────────────────┐
│ ▲ UPSTREAM                                                  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 🌐 REST: GET /api/user                              │   │
│   │    Response.body.name                               │   │
│   │    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │   │
│   │    📍 LIVE: "John Smith"              [last: 2s ago]│   │
│   └────────────────────┬────────────────────────────────┘   │
│                        │                                    │
│                        ▼ .name                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 💾 currentUser (Object)                             │   │
│   │    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │   │
│   │    📍 LIVE: { name: "John Smith", email: "j@..." }  │   │
│   └────────────────────┬────────────────────────────────┘   │
│                        ▼                                    │
```

This answers "where does this come from?" AND "what's the actual value right now?" in one view.

### Integration with Existing Debug Infrastructure

The live values can come from the same system that powers:
- **DebugInspector hover values** - Already shows live values on connection hover
- **Pinned inspectors** - Already tracks values over time

```typescript
// Leverage existing infrastructure:
import { DebugInspector } from '@noodl-models/DebugInspector';

function getLiveValueForNode(nodeId: string, port: string): unknown {
  // DebugInspector already knows how to get live values
  return DebugInspector.instance.getValueForPort(nodeId, port);
}
```

### Implementation Approach

1. **Start with static-only** (Phase 1-5 as documented)
2. **Add live mode toggle** (Phase 6 - optional enhancement)
3. **Subscribe to value changes** for nodes in the lineage path
4. **Update display** when values change

### Syncing with Canvas Highlighting

When the user hovers over a step in the lineage view:
- Highlight that node on the canvas (using existing highlighting)
- If the node is in a different component, show a "navigate" prompt
- Optionally flash the connection path on canvas

## Future Enhancements

- **Path highlighting** - Highlight entire path on canvas
- **Breakpoint insertion** - Add debug breakpoints along the path
- **Path comparison** - Compare two different lineage paths
- **Export** - Export lineage as documentation

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Deep component nesting | Limit depth, show "continue" option |
| Cycles in graph | Track visited nodes, break cycles |
| Many branches overwhelm UI | Collapse by default, expand on demand |
| Performance on complex graphs | Cache results, lazy expansion |

---

## Dependencies

- VIEW-000 Foundation (for cross-component resolution)

## Blocks

- None (independent view)
