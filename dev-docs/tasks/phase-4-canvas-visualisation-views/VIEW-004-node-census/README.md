# VIEW-004: Node Census

**View Type:** 📋 Sidebar Panel (opens alongside canvas)

## Overview

A searchable inventory of every node in a component (or the entire project), grouped by type with automatic duplicate detection and conflict warnings. The "find anything" tool for complex canvases.

**Estimate:** 2-3 days  
**Priority:** HIGH  
**Complexity:** Low  
**Dependencies:** VIEW-000 (Foundation)

---

## The Problem

In a complex canvas:
- You can't find that Variable node you know exists somewhere
- You accidentally create duplicate nodes with the same name
- Two Variables with the same name cause subtle bugs
- You don't know how many REST calls or Functions the component has
- Cleaning up unused nodes requires manual hunting

---

## The Solution

A comprehensive node inventory that:
1. Lists all nodes grouped by type/category
2. Detects duplicates (same name + same type)
3. Warns about potential conflicts
4. Enables quick search by name or type
5. Click to jump to any node

---

## User Stories

1. **As a developer searching**, I want to find a node by name without scrolling around the canvas.

2. **As a developer cleaning up**, I want to see all nodes grouped by type so I can identify unused or redundant ones.

3. **As a developer debugging**, I want to know if I have duplicate Variables that might be causing conflicts.

4. **As a developer auditing**, I want to see a count of each node type to understand component complexity.

---

## UI Design

### Main View

```
┌─────────────────────────────────────────────────────────────────┐
│ Node Census                                  [Scope: Component ▼]│
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search nodes...                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ⚠️ POTENTIAL ISSUES (3)                              [Collapse] │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⚠️ "currentUser" Object appears 2 times                     │ │
│ │    ├─ Presales Page (near top)              [→ Jump]        │ │
│ │    └─ Presales Page (near bottom)           [→ Jump]        │ │
│ │    May cause: Value conflicts, unexpected overwrites        │ │
│ │                                                             │ │
│ │ ⚠️ "activeConversation" Variable appears 3 times            │ │
│ │    ├─ Presales Page                         [→ Jump]        │ │
│ │    ├─ Presales Page (duplicate!)            [→ Jump]        │ │
│ │    └─ Chat Component                        [→ Jump]        │ │
│ │    May cause: Race conditions, stale data                   │ │
│ │                                                             │ │
│ │ ⚠️ "response.output.trigger_" Expression appears 4 times    │ │
│ │    Consider: Consolidate or rename for clarity              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 📊 BY CATEGORY                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ▼ 💾 Data (18 nodes)                                        │ │
│ │   ├─ Variable (8)                                           │ │
│ │   │   ├─ activeConversation ×2 ⚠️           [→ Jump]        │ │
│ │   │   ├─ presales                           [→ Jump]        │ │
│ │   │   ├─ messageText                        [→ Jump]        │ │
│ │   │   ├─ errorMessage                       [→ Jump]        │ │
│ │   │   └─ ... 3 more                                         │ │
│ │   ├─ Object (6)                                             │ │
│ │   │   ├─ currentUser ×2 ⚠️                  [→ Jump]        │ │
│ │   │   ├─ userData                           [→ Jump]        │ │
│ │   │   └─ ... 3 more                                         │ │
│ │   └─ Array (4)                                              │ │
│ │       ├─ firstResponderMessages             [→ Jump]        │ │
│ │       ├─ currentConversationMes...          [→ Jump]        │ │
│ │       └─ ... 2 more                                         │ │
│ │                                                             │ │
│ │ ▶ ⚡ Logic (22 nodes)                                        │ │
│ │ ▶ 📦 Visual (45 nodes)                                       │ │
│ │ ▶ 🌐 API (8 nodes)                                           │ │
│ │ ▶ 📡 Events (6 nodes)                                        │ │
│ │ ▶ 🔧 Other (9 nodes)                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ────────────────────────────────────────────────────────────── │
│ Total: 108 nodes | 3 potential issues                          │
└─────────────────────────────────────────────────────────────────┘
```

### Search Results View

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 currentUser                                          [Clear] │
├─────────────────────────────────────────────────────────────────┤
│ Found 4 matches for "currentUser"                               │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💾 "currentUser" Object                                     │ │
│ │    Component: Presales Page                                 │ │
│ │    Connections: 5 outputs connected                         │ │
│ │    [→ Jump to Node]                                         │ │
│ │                                                             │ │
│ │ 💾 "currentUser" Object                                     │ │
│ │    Component: AuthFlow                                      │ │
│ │    Connections: 3 outputs connected                         │ │
│ │    [→ Jump to Node]                                         │ │
│ │                                                             │ │
│ │ ⚡ Expression containing "currentUser"                       │ │
│ │    Component: Presales Page                                 │ │
│ │    Expression: currentUser.name + " - " + ...               │ │
│ │    [→ Jump to Node]                                         │ │
│ │                                                             │ │
│ │ 🔧 Function referencing "currentUser"                       │ │
│ │    Component: App Shell                                     │ │
│ │    [→ Jump to Node]                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Scope Selector

```
┌────────────────────────────┐
│ Scope:                     │
│ ○ Current Component        │  ← Show nodes in current component only
│ ○ Component + Children     │  ← Include subcomponents  
│ ● Entire Project           │  ← Search all components
└────────────────────────────┘
```

### Interactions

- **Search** - Filter by name, type, or content
- **Click category** - Expand/collapse
- **Click node** - Select (highlight in list)
- **[→ Jump]** - Navigate to node in canvas
- **Scope dropdown** - Change search scope
- **Click issue** - Expand to show all instances

---

## Technical Design

### Data Model

```typescript
interface NodeCensus {
  scope: 'component' | 'componentWithChildren' | 'project';
  component?: ComponentModel;  // If scoped to component
  
  totalNodes: number;
  
  byCategory: {
    category: NodeCategory;
    count: number;
    types: {
      typeName: string;
      displayName: string;
      count: number;
      nodes: CensusNode[];
    }[];
  }[];
  
  duplicates: DuplicateGroup[];
  warnings: CensusWarning[];
}

interface CensusNode {
  id: string;
  type: string;
  label: string;  // User-assigned label or generated name
  displayName: string;
  componentName: string;
  componentPath: string;
  
  // Connection info
  inputCount: number;
  outputCount: number;
  connectedInputs: number;
  connectedOutputs: number;
  
  // For search
  searchableContent: string;  // Includes parameters, expressions, etc.
  
  // Position hint for "near top/bottom" descriptions
  positionHint: 'top' | 'middle' | 'bottom';
}

interface DuplicateGroup {
  name: string;
  type: string;
  instances: CensusNode[];
  severity: 'info' | 'warning' | 'error';
  reason: string;
  suggestion: string;
}

interface CensusWarning {
  type: 'duplicate' | 'orphan' | 'complexity' | 'naming';
  message: string;
  nodes: CensusNode[];
  severity: 'info' | 'warning' | 'error';
}
```

### Building the Census

```typescript
function buildNodeCensus(
  project: ProjectModel,
  scope: CensusScope,
  currentComponent?: ComponentModel
): NodeCensus {
  const nodes: CensusNode[] = [];
  
  // Collect nodes based on scope
  if (scope === 'component' && currentComponent) {
    collectNodesFromComponent(currentComponent, nodes);
  } else if (scope === 'componentWithChildren' && currentComponent) {
    collectNodesRecursive(currentComponent, nodes);
  } else {
    project.forEachComponent(comp => collectNodesFromComponent(comp, nodes));
  }
  
  // Categorize
  const byCategory = categorizeNodes(nodes);
  
  // Detect duplicates
  const duplicates = findDuplicates(nodes);
  
  // Generate warnings
  const warnings = generateWarnings(nodes, duplicates);
  
  return {
    scope,
    component: currentComponent,
    totalNodes: nodes.length,
    byCategory,
    duplicates,
    warnings
  };
}

function collectNodesFromComponent(
  component: ComponentModel,
  nodes: CensusNode[]
): void {
  component.graph.forEachNode(node => {
    nodes.push({
      id: node.id,
      type: node.type.name,
      label: node.label || getDefaultLabel(node),
      displayName: node.type.displayName || node.type.name,
      componentName: component.name,
      componentPath: component.fullName,
      inputCount: node.getPorts('input').length,
      outputCount: node.getPorts('output').length,
      connectedInputs: countConnectedInputs(component, node),
      connectedOutputs: countConnectedOutputs(component, node),
      searchableContent: buildSearchableContent(node),
      positionHint: calculatePositionHint(node)
    });
  });
}
```

### Search Implementation

```typescript
function searchNodes(
  census: NodeCensus,
  query: string
): CensusNode[] {
  const lowerQuery = query.toLowerCase();
  
  return census.byCategory
    .flatMap(cat => cat.types.flatMap(t => t.nodes))
    .filter(node => 
      node.label.toLowerCase().includes(lowerQuery) ||
      node.type.toLowerCase().includes(lowerQuery) ||
      node.displayName.toLowerCase().includes(lowerQuery) ||
      node.searchableContent.toLowerCase().includes(lowerQuery)
    )
    .sort((a, b) => {
      // Exact matches first
      const aExact = a.label.toLowerCase() === lowerQuery;
      const bExact = b.label.toLowerCase() === lowerQuery;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      
      // Then by relevance (starts with)
      const aStarts = a.label.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.label.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
      
      return a.label.localeCompare(b.label);
    });
}
```

---

## Implementation Phases

### Phase 1: Data Collection (0.5-1 day)

1. Implement `buildNodeCensus()` function
2. Implement scope handling (component, recursive, project)
3. Build searchable content from node parameters
4. Calculate position hints

**Verification:**
- [ ] All nodes collected correctly
- [ ] Scopes work as expected
- [ ] Searchable content includes expressions, URLs, etc.

### Phase 2: Categorization & Duplicates (0.5 day)

1. Implement node categorization
2. Implement duplicate detection
3. Generate warnings with appropriate severity
4. Create suggestions for fixing issues

**Verification:**
- [ ] Categories correct for all node types
- [ ] Duplicates detected reliably
- [ ] Warnings helpful

### Phase 3: Basic UI (1 day)

1. Create `NodeCensusView` component
2. Implement collapsible category tree
3. Show duplicate warnings section
4. Add scope selector
5. Display node counts

**Verification:**
- [ ] Tree renders correctly
- [ ] Collapse/expand works
- [ ] Warnings display prominently

### Phase 4: Search & Navigation (0.5-1 day)

1. Implement search input with filtering
2. Add keyboard navigation
3. Implement "Jump to Node" navigation
4. Add search result highlighting

**Verification:**
- [ ] Search filters correctly
- [ ] Results update live
- [ ] Jump to node works across components

### Phase 5: Polish (0.5 day)

1. Add loading states
2. Improve typography and icons
3. Add empty states
4. Performance optimization for large projects

**Verification:**
- [ ] UI polished
- [ ] Large projects handled well
- [ ] Responsive

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/AnalysisPanel/
└── NodeCensusView/
    ├── index.ts
    ├── NodeCensusView.tsx
    ├── NodeCensusView.module.scss
    ├── CategoryTree.tsx
    ├── NodeListItem.tsx
    ├── DuplicateWarnings.tsx
    ├── SearchInput.tsx
    ├── ScopeSelector.tsx
    └── useNodeCensus.ts
```

---

## Success Criteria

- [ ] All nodes in scope appear in census
- [ ] Categories correctly assigned
- [ ] Duplicates detected and warned
- [ ] Search finds nodes by name, type, and content
- [ ] Jump to node works reliably
- [ ] Scope switching works
- [ ] Renders fast (< 500ms) for 200+ nodes

---

## Future Enhancements

- **Bulk actions** - Select multiple nodes, delete orphans
- **Export** - Export node list as CSV
- **Comparison** - Compare census between two components
- **History** - Track node count over time
- **Orphan detection** - Find nodes with no connections

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large projects slow to census | Cache results, incremental updates |
| False positive duplicates | Allow user to dismiss warnings |
| Categorization misses node types | Maintain mapping, default to "Other" |

---

## Dependencies

- VIEW-000 Foundation (for categorization utilities)

## Blocks

- None (independent view)
