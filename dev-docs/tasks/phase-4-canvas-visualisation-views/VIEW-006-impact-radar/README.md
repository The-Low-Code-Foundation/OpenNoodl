# VIEW-006: Impact Radar

**View Type:** 🎨 Canvas Overlay (enhances existing canvas with highlighting)

## Overview

Before you change something, see everywhere it's used and what might break. A pre-change impact analysis tool that shows the blast radius of modifications. **Highlights persist on the canvas until dismissed!**

**Estimate:** 3-4 days  
**Priority:** MEDIUM  
**Complexity:** Medium  
**Dependencies:** VIEW-000 (Foundation), PREREQ-004 (Canvas Highlighting API)

---

## The Problem

When you want to change something in a Noodl project:
- You don't know everywhere a component is used
- You don't know what depends on a specific output
- Changing a component's interface might break 5 other places
- Renaming a variable might affect components you forgot about
- "I'll just change this real quick" → breaks production

---

## The Solution

An impact analysis that:
1. Shows everywhere a component/node is used
2. Shows what depends on specific outputs
3. Warns about breaking changes
4. Lets you preview "what if I change this?"
5. Provides a checklist of things to update

---

## User Stories

1. **As a developer refactoring**, I want to know everywhere this component is used before I change its interface.

2. **As a developer renaming**, I want to see all places that reference this name so I don't break anything.

3. **As a developer removing**, I want to know if anything depends on this before I delete it.

4. **As a developer planning**, I want to understand the impact of a proposed change before implementing it.

---

## UI Design

### Component Impact View

```
┌─────────────────────────────────────────────────────────────────┐
│ Impact Radar                                        [Refresh]   │
├─────────────────────────────────────────────────────────────────┤
│ Analyzing: AuthFlow Component                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📊 USAGE SUMMARY                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Used in 3 components across 2 pages                         │ │
│ │                                                             │ │
│ │ Impact level: 🟡 MEDIUM                                     │ │
│ │ Reason: Changes affect multiple pages                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 📍 USAGE LOCATIONS                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ ┌─ Login Page ────────────────────────────────────────────┐ │ │
│ │ │ Instance: authFlow_1                        [→ Jump]    │ │ │
│ │ │                                                         │ │ │
│ │ │ Connected inputs:                                       │ │ │
│ │ │   • onLoginRequest ← LoginButton.onClick               │ │ │
│ │ │   • redirectUrl ← "/dashboard" (static)                │ │ │
│ │ │                                                         │ │ │
│ │ │ Connected outputs:                                      │ │ │
│ │ │   • currentUser → NavBar.user, ProfileWidget.user      │ │ │
│ │ │   • onSuccess → Navigate("/dashboard")                 │ │ │
│ │ │   • authError → ErrorToast.message                     │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ ┌─ Settings Page ─────────────────────────────────────────┐ │ │
│ │ │ Instance: authFlow_2                        [→ Jump]    │ │ │
│ │ │                                                         │ │ │
│ │ │ Connected inputs:                                       │ │ │
│ │ │   • onLogoutRequest ← LogoutButton.onClick             │ │ │
│ │ │                                                         │ │ │
│ │ │ Connected outputs:                                      │ │ │
│ │ │   • onSuccess → Navigate("/login")                     │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ ┌─ App Shell ─────────────────────────────────────────────┐ │ │
│ │ │ Instance: authFlow_global                   [→ Jump]    │ │ │
│ │ │                                                         │ │ │
│ │ │ Connected outputs:                                      │ │ │
│ │ │   • isAuthenticated → RouteGuard.condition             │ │ │
│ │ │   • currentUser → (passed to 12 child components)      │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ⚠️ CHANGE IMPACT ANALYSIS                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ If you MODIFY these outputs:                               │ │
│ │                                                             │ │
│ │ • currentUser                           Impact: 🔴 HIGH    │ │
│ │   └─ Used by 14 consumers across 3 components             │ │
│ │   └─ Breaking changes will affect: NavBar, ProfileWidget, │ │
│ │      UserSettings, ChatHeader, and 10 more...             │ │
│ │                                                             │ │
│ │ • onSuccess                             Impact: 🟡 MEDIUM  │ │
│ │   └─ Used by 3 consumers                                   │ │
│ │   └─ Navigation flows depend on this signal               │ │
│ │                                                             │ │
│ │ • authError                             Impact: 🟢 LOW     │ │
│ │   └─ Used by 2 consumers                                   │ │
│ │   └─ Only affects error display                           │ │
│ │                                                             │ │
│ │ If you REMOVE these inputs:                                │ │
│ │                                                             │ │
│ │ • redirectUrl                           Impact: 🟡 MEDIUM  │ │
│ │   └─ Login Page passes static value                       │ │
│ │   └─ Would need to handle internally or change caller     │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 📋 CHANGE CHECKLIST                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ If changing currentUser output structure:                   │ │
│ │ □ Update Login Page → NavBar connection                    │ │
│ │ □ Update Login Page → ProfileWidget connection             │ │
│ │ □ Update App Shell → RouteGuard connection                 │ │
│ │ □ Update App Shell → 12 child components                   │ │
│ │ □ Test login flow on Login Page                            │ │
│ │ □ Test auth guard on protected routes                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Port-Specific Impact

```
┌─────────────────────────────────────────────────────────────────┐
│ Impact Radar: currentUser output                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ This output feeds into:                                         │
│                                                                 │
│        ┌─────────────────────┐                                 │
│        │     AuthFlow        │                                 │
│        │  currentUser output │                                 │
│        └──────────┬──────────┘                                 │
│                   │                                             │
│     ┌─────────────┼─────────────┬─────────────┐                │
│     ▼             ▼             ▼             ▼                 │
│ ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│ │ NavBar │  │ Profile  │  │ Settings │  │ +9 more  │          │
│ │ .user  │  │ Widget   │  │ .user    │  │          │          │
│ └────────┘  │ .user    │  └──────────┘  └──────────┘          │
│             └──────────┘                                        │
│                                                                 │
│ Properties accessed:                                            │
│ • .name (used in 8 places)                                     │
│ • .email (used in 3 places)                                    │
│ • .avatar (used in 4 places)                                   │
│ • .role (used in 2 places)                                     │
│                                                                 │
│ ⚠️ If you change the structure of currentUser:                  │
│    All 17 usages will need to be verified                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Impact Badge (for Components Panel)

```
┌────────────────────────────────────────┐
│ 🧩 AuthFlow                    (×3) 🔴 │
│    Used in 3 places, HIGH impact       │
└────────────────────────────────────────┘
```

---

## Technical Design

### Data Model

```typescript
interface ImpactAnalysis {
  target: {
    type: 'component' | 'node' | 'port';
    component?: ComponentModel;
    node?: NodeGraphNode;
    port?: string;
  };
  
  summary: {
    usageCount: number;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  };
  
  usages: ComponentUsageDetail[];
  
  portImpacts: PortImpact[];
  
  changeChecklist: ChecklistItem[];
}

interface ComponentUsageDetail {
  component: ComponentModel;       // Where it's used
  instanceNodeId: string;          // The instance node
  instanceLabel: string;
  
  connectedInputs: {
    port: string;
    connections: {
      fromNode: NodeGraphNode;
      fromPort: string;
      isStatic: boolean;
      staticValue?: unknown;
    }[];
  }[];
  
  connectedOutputs: {
    port: string;
    connections: {
      toNode: NodeGraphNode;
      toPort: string;
      transitiveUsages?: number;  // How many things depend on this downstream
    }[];
  }[];
}

interface PortImpact {
  port: string;
  direction: 'input' | 'output';
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  consumerCount: number;
  consumers: {
    component: string;
    node: string;
    port: string;
  }[];
  propertiesAccessed?: string[];  // For object outputs, what properties are used
}

interface ChecklistItem {
  action: string;
  component: string;
  priority: 'required' | 'recommended' | 'optional';
  completed: boolean;
}
```

### Building Impact Analysis

```typescript
function analyzeImpact(
  project: ProjectModel,
  target: ImpactTarget
): ImpactAnalysis {
  if (target.type === 'component') {
    return analyzeComponentImpact(project, target.component);
  } else if (target.type === 'node') {
    return analyzeNodeImpact(project, target.component, target.node);
  } else {
    return analyzePortImpact(project, target.component, target.node, target.port);
  }
}

function analyzeComponentImpact(
  project: ProjectModel,
  component: ComponentModel
): ImpactAnalysis {
  // Find all usages
  const usages = findComponentUsages(project, component.fullName);
  
  // Analyze each port
  const portImpacts: PortImpact[] = [];
  
  // Outputs - what depends on them?
  component.getPorts().filter(p => p.plug === 'output').forEach(port => {
    const consumers = findPortConsumers(project, component, port.name, usages);
    portImpacts.push({
      port: port.name,
      direction: 'output',
      impactLevel: calculateImpactLevel(consumers.length),
      consumerCount: consumers.length,
      consumers,
      propertiesAccessed: analyzePropertyAccess(consumers)
    });
  });
  
  // Inputs - what provides them?
  component.getPorts().filter(p => p.plug === 'input').forEach(port => {
    const providers = findPortProviders(project, component, port.name, usages);
    portImpacts.push({
      port: port.name,
      direction: 'input',
      impactLevel: calculateImpactLevel(providers.length),
      consumerCount: providers.length,
      consumers: providers
    });
  });
  
  // Calculate overall impact
  const maxImpact = Math.max(...portImpacts.map(p => impactScore(p.impactLevel)));
  
  // Generate checklist
  const checklist = generateChecklist(component, usages, portImpacts);
  
  return {
    target: { type: 'component', component },
    summary: {
      usageCount: usages.length,
      impactLevel: scoreToLevel(maxImpact),
      reason: generateImpactReason(usages, portImpacts)
    },
    usages: usages.map(u => buildUsageDetail(project, component, u)),
    portImpacts,
    changeChecklist: checklist
  };
}

function calculateImpactLevel(consumerCount: number): ImpactLevel {
  if (consumerCount === 0) return 'low';
  if (consumerCount <= 2) return 'low';
  if (consumerCount <= 5) return 'medium';
  if (consumerCount <= 10) return 'high';
  return 'critical';
}
```

---

## Implementation Phases

### Phase 1: Usage Finding (1 day)

1. Build on VIEW-000's `findComponentUsages()`
2. Add detailed connection analysis per usage
3. Track which ports are connected where
4. Count transitive dependencies

**Verification:**
- [ ] Finds all component usages
- [ ] Connection details accurate
- [ ] Transitive counts correct

### Phase 2: Impact Calculation (0.5-1 day)

1. Calculate impact level per port
2. Analyze property access patterns
3. Generate overall impact summary
4. Create impact reasons

**Verification:**
- [ ] Impact levels sensible
- [ ] Property analysis works
- [ ] Summary helpful

### Phase 3: UI - Usage Display (1 day)

1. Create `ImpactRadarView` component
2. Show usage locations with details
3. Display per-port impact
4. Add navigation to usages

**Verification:**
- [ ] Usages displayed clearly
- [ ] Port impacts visible
- [ ] Navigation works

### Phase 4: Checklist Generation (0.5 day)

1. Generate change checklist from analysis
2. Allow marking items complete
3. Prioritize checklist items

**Verification:**
- [ ] Checklist comprehensive
- [ ] Priorities sensible
- [ ] Can mark complete

### Phase 5: Polish & Integration (0.5-1 day)

1. Add impact badges to Components Panel
2. Context menu "Show Impact"
3. Quick impact preview on hover
4. Performance optimization

**Verification:**
- [ ] Badges show in panel
- [ ] Context menu works
- [ ] Performance acceptable

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/AnalysisPanel/
└── ImpactRadarView/
    ├── index.ts
    ├── ImpactRadarView.tsx
    ├── ImpactRadarView.module.scss
    ├── UsageSummary.tsx
    ├── UsageLocation.tsx
    ├── PortImpactList.tsx
    ├── ChangeChecklist.tsx
    ├── ImpactBadge.tsx
    └── useImpactAnalysis.ts

packages/noodl-editor/src/editor/src/utils/graphAnalysis/
└── impact.ts
```

---

## Success Criteria

- [ ] Shows all places component is used
- [ ] Impact level calculation sensible
- [ ] Port-level analysis accurate
- [ ] Checklist helpful for changes
- [ ] Navigation to usages works
- [ ] Renders in < 1s

---

## Future Enhancements

- **"What if" simulation** - Preview changes without making them
- **Diff preview** - Show what would change in each usage
- **Auto-update** - Automatically update simple changes across usages
- **Impact history** - Track changes and their actual impact over time

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Too many usages to display | Pagination, grouping, filtering |
| Property analysis misses patterns | Start simple, expand based on real usage |
| Impact levels feel wrong | Make configurable, learn from feedback |

---

## Dependencies

- VIEW-000 Foundation
- VIEW-001 (optional, for visual representation)

## Blocks

- None (independent view)
