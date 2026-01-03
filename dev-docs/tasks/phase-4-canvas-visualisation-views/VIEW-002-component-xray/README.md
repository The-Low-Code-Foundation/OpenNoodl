# VIEW-002: Component X-Ray

**View Type:** 📋 Sidebar Panel (opens alongside canvas)

## Overview

A summary card view that shows everything important about a component at a glance: what it does, what goes in and out, what it contains, where it's used, and what external calls it makes. Think of it as the "component profile page."

**Estimate:** 2-3 days  
**Priority:** HIGH  
**Complexity:** Low  
**Dependencies:** VIEW-000 (Foundation)

---

## The Problem

To understand a component today, you have to:

1. Open it in the canvas
2. Scroll around to see all nodes
3. Mentally categorize what's there
4. Check the Component Inputs/Outputs nodes to understand the interface
5. Hunt for REST/Function calls scattered around
6. Go back to the Components Panel to see if it's used elsewhere

There's no quick "tell me about this component" view.

---

## The Solution

A single-screen summary that answers:

- **What does this component do?** (Node breakdown by category)
- **What's the interface?** (Inputs and outputs)
- **What's inside?** (Subcomponents used)
- **Where is it used?** (Parent components)
- **What external things does it touch?** (REST, Functions, Events)

---

## User Stories

1. **As a developer reviewing code**, I want to quickly understand what a component does without diving into the canvas.

2. **As a developer debugging**, I want to see all external dependencies (API calls, events) in one place.

3. **As a developer refactoring**, I want to know everywhere this component is used before I change it.

4. **As a new team member**, I want to understand component interfaces (inputs/outputs) without reading the implementation.

---

## UI Design

### X-Ray Card View

```
┌─────────────────────────────────────────────────────────────────┐
│ Component X-Ray                                     [Open →]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🧩 AuthFlow                                                 │ │
│ │ /Components/Auth/AuthFlow                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ USED IN (3 places) ────────────────────────────────────────┐ │
│ │ 📄 Login Page          [→ Open]                             │ │
│ │ 📄 Settings Page       [→ Open]                             │ │
│ │ 📄 App Shell           [→ Open]                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ INTERFACE ─────────────────────────────────────────────────┐ │
│ │ INPUTS                      │ OUTPUTS                       │ │
│ │ ────────                    │ ─────────                     │ │
│ │ → onLoginRequest (signal)   │ currentUser (object) →        │ │
│ │ → redirectUrl (string)      │ authError (string) →          │ │
│ │ → initialMode (string)      │ isAuthenticated (boolean) →   │ │
│ │                             │ onSuccess (signal) →          │ │
│ │                             │ onFailure (signal) →          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ CONTAINS ──────────────────────────────────────────────────┐ │
│ │ SUBCOMPONENTS                                               │ │
│ │ └─ LoginForm (component)            [→ X-Ray]               │ │
│ │ └─ SignupForm (component)           [→ X-Ray]               │ │
│ │ └─ ForgotPassword (component)       [→ X-Ray]               │ │
│ │                                                             │ │
│ │ NODE BREAKDOWN                                              │ │
│ │ ├─ 📦 Visual      12 nodes (Groups, Text, Images)          │ │
│ │ ├─ 💾 Data         5 nodes (Variables, Objects)            │ │
│ │ ├─ ⚡ Logic        8 nodes (Conditions, Expressions)       │ │
│ │ ├─ 📡 Events       3 nodes (Send/Receive Event)            │ │
│ │ └─ 🔧 Other        2 nodes                                  │ │
│ │                    ─────                                    │ │
│ │                    30 total                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ EXTERNAL DEPENDENCIES ─────────────────────────────────────┐ │
│ │ 🌐 REST Calls                                               │ │
│ │    POST /api/auth/login           [→ Find]                  │ │
│ │    POST /api/auth/signup          [→ Find]                  │ │
│ │    POST /api/auth/reset-password  [→ Find]                  │ │
│ │                                                             │ │
│ │ 📨 Events Sent                                              │ │
│ │    "auth:success"                 [→ Find receivers]        │ │
│ │    "auth:failure"                 [→ Find receivers]        │ │
│ │                                                             │ │
│ │ 📩 Events Received                                          │ │
│ │    "app:logout"                   [→ Find senders]          │ │
│ │                                                             │ │
│ │ 🔧 Functions                                                │ │
│ │    validateEmail                  [→ Find]                  │ │
│ │    hashPassword                   [→ Find]                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ INTERNAL STATE ────────────────────────────────────────────┐ │
│ │ Variables: authMode, errorMessage, isLoading                │ │
│ │ Objects: pendingUser, formData                              │ │
│ │ States: formState (login|signup|reset), loadingState        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Collapsed View (for quick scanning)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🧩 AuthFlow                  Used in: 3 | Nodes: 30 | APIs: 3  │
│    ↓ 3 inputs  ↑ 5 outputs   Contains: LoginForm +2            │
└─────────────────────────────────────────────────────────────────┘
```

### Interactions

- **[Open →]** - Jump to this component in the canvas
- **[→ X-Ray]** - Show X-Ray for that subcomponent
- **[→ Find]** - Jump to that node in the canvas
- **[→ Find receivers/senders]** - Show all nodes that receive/send that event
- **Click "USED IN" item** - Jump to the parent component
- **Expand/Collapse sections** - Toggle visibility of sections

---

## Technical Design

### Data Model

```typescript
interface ComponentXRay {
  // Identity
  name: string;
  fullName: string;
  path: string; // Folder path

  // Usage
  usedIn: {
    component: ComponentModel;
    instanceCount: number;
  }[];

  // Interface
  inputs: {
    name: string;
    type: string;
    isSignal: boolean;
  }[];
  outputs: {
    name: string;
    type: string;
    isSignal: boolean;
  }[];

  // Contents
  subcomponents: {
    name: string;
    component: ComponentModel;
  }[];
  nodeBreakdown: {
    category: NodeCategory;
    count: number;
    nodeTypes: { type: string; count: number }[];
  }[];
  totalNodes: number;

  // External dependencies
  restCalls: {
    method: string;
    endpoint: string;
    nodeId: string;
  }[];
  eventsSent: {
    eventName: string;
    nodeId: string;
  }[];
  eventsReceived: {
    eventName: string;
    nodeId: string;
  }[];
  functionCalls: {
    functionName: string;
    nodeId: string;
  }[];

  // Internal state
  variables: { name: string; nodeId: string }[];
  objects: { name: string; nodeId: string }[];
  statesNodes: {
    name: string;
    nodeId: string;
    states: string[];
  }[];
}
```

### Building X-Ray Data

```typescript
function buildComponentXRay(project: ProjectModel, component: ComponentModel): ComponentXRay {
  const xray: ComponentXRay = {
    name: component.name,
    fullName: component.fullName,
    path: getComponentPath(component),
    usedIn: findComponentUsages(project, component.fullName),
    inputs: getComponentInputs(component),
    outputs: getComponentOutputs(component),
    subcomponents: [],
    nodeBreakdown: [],
    totalNodes: 0,
    restCalls: [],
    eventsSent: [],
    eventsReceived: [],
    functionCalls: [],
    variables: [],
    objects: [],
    statesNodes: []
  };

  // Analyze all nodes in the component
  component.graph.forEachNode((node) => {
    xray.totalNodes++;

    // Check for subcomponents
    if (isComponentInstance(node)) {
      xray.subcomponents.push({
        name: node.type.name,
        component: findComponent(project, node.type.name)
      });
    }

    // Check for REST calls
    if (node.type.name === 'REST' || node.type.name.includes('REST')) {
      xray.restCalls.push({
        method: node.parameters.method || 'GET',
        endpoint: node.parameters.endpoint || node.parameters.url,
        nodeId: node.id
      });
    }

    // Check for events
    if (node.type.name === 'Send Event') {
      xray.eventsSent.push({
        eventName: node.parameters.eventName || node.parameters.channel,
        nodeId: node.id
      });
    }
    if (node.type.name === 'Receive Event') {
      xray.eventsReceived.push({
        eventName: node.parameters.eventName || node.parameters.channel,
        nodeId: node.id
      });
    }

    // Check for functions
    if (node.type.name === 'Function' || node.type.name === 'Javascript') {
      xray.functionCalls.push({
        functionName: node.label || node.parameters.name || 'Anonymous',
        nodeId: node.id
      });
    }

    // Check for state nodes
    if (node.type.name === 'Variable') {
      xray.variables.push({ name: node.label || 'Unnamed', nodeId: node.id });
    }
    if (node.type.name === 'Object') {
      xray.objects.push({ name: node.label || 'Unnamed', nodeId: node.id });
    }
    if (node.type.name === 'States') {
      xray.statesNodes.push({
        name: node.label || 'Unnamed',
        nodeId: node.id,
        states: extractStatesFromNode(node)
      });
    }
  });

  // Build category breakdown
  xray.nodeBreakdown = buildCategoryBreakdown(component);

  return xray;
}
```

---

## Implementation Phases

### Phase 1: Data Collection (0.5-1 day)

1. Implement `buildComponentXRay()` function
2. Extract inputs/outputs from Component Inputs/Outputs nodes
3. Detect subcomponent usages
4. Find REST, Event, Function nodes
5. Find state-related nodes (Variables, Objects, States)

**Verification:**

- [ ] All sections populated correctly for test component
- [ ] Subcomponent detection works
- [ ] External dependencies found

### Phase 2: Basic UI (1 day)

1. Create `ComponentXRayView` React component
2. Implement collapsible sections
3. Style the card layout
4. Add icons for categories

**Verification:**

- [ ] All sections render correctly
- [ ] Sections expand/collapse
- [ ] Looks clean and readable

### Phase 3: Interactivity (0.5-1 day)

1. Implement "Open in Canvas" navigation
2. Implement "Find Node" navigation
3. Implement "Show X-Ray" for subcomponents
4. Add "Find receivers/senders" for events
5. Wire up to Analysis Panel context

**Verification:**

- [ ] All navigation links work
- [ ] Can drill into subcomponents
- [ ] Event tracking works

### Phase 4: Polish (0.5 day)

1. Add collapsed summary view
2. Improve typography and spacing
3. Add empty state handling
4. Performance optimization

**Verification:**

- [ ] Collapsed view useful
- [ ] Empty sections handled gracefully
- [ ] Renders quickly

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/AnalysisPanel/
└── ComponentXRayView/
    ├── index.ts
    ├── ComponentXRayView.tsx
    ├── ComponentXRayView.module.scss
    ├── XRaySection.tsx
    ├── InterfaceSection.tsx
    ├── ContentsSection.tsx
    ├── DependenciesSection.tsx
    ├── StateSection.tsx
    └── useComponentXRay.ts
```

---

## Success Criteria

- [ ] Shows accurate usage count
- [ ] Shows correct inputs/outputs with types
- [ ] Lists all subcomponents
- [ ] Finds all REST calls with endpoints
- [ ] Finds all Send/Receive Events
- [ ] Finds all Function nodes
- [ ] Node breakdown by category is accurate
- [ ] All navigation links work
- [ ] Renders in < 500ms

---

## Future Enhancements

- **Diff view** - Compare two components side by side
- **History** - See how component changed over time (if git integrated)
- **Documentation** - Allow adding/viewing component descriptions
- **Complexity score** - Calculate a complexity metric
- **Warnings** - Flag potential issues (unused inputs, orphan nodes)

---

## Risks & Mitigations

| Risk                                     | Mitigation                                       |
| ---------------------------------------- | ------------------------------------------------ |
| Node type detection misses edge cases    | Start with common types, expand based on testing |
| Component inputs/outputs detection fails | Test with various component patterns             |
| Too much information overwhelming        | Use collapsible sections, start collapsed        |

---

## Dependencies

- VIEW-000 Foundation (for traversal and categorization utilities)

## Blocks

- None (independent view)

---

## Known Issues

### AI Function Node Sidebar Disappearing Bug

**Status:** Open (Not Fixed)  
**Severity:** Medium  
**Date Discovered:** January 2026

**Description:**
When clicking on AI-generated function nodes in the Component X-Ray panel's "Functions" section, the left sidebar navigation toolbar disappears from view.

**Technical Details:**

- The `.Toolbar` CSS class in `SideNavigation.module.scss` loses its `flex-direction: column` property
- This appears to be related to the `AiPropertyEditor` component which uses `TabsVariant.Sidebar` tabs
- The AiPropertyEditor renders for AI-generated nodes and displays tabs for "AI Chat" and "Properties"
- Investigation showed the TabsVariant.Sidebar CSS doesn't directly manipulate parent elements
- Attempted fix with CSS `!important` rules on the Toolbar did not resolve the issue

**Impact:**

- Users cannot access the main left sidebar navigation after clicking AI function nodes from X-Ray panel
- Workaround: Close the property editor or switch to a different panel to restore the toolbar

**Root Cause:**
Unknown - the exact mechanism causing the CSS property to disappear has not been identified. The issue likely involves complex CSS cascade interactions between:

- SideNavigation component styles
- AiPropertyEditor component styles
- TabsVariant.Sidebar tab system styles

**Investigation Files:**

- `packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.module.scss`
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/index.tsx` (AiPropertyEditor)
- `packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.tsx` (switchToNode method)

**Next Steps:**
Future investigation should focus on:

1. Using React DevTools to inspect component tree when bug occurs
2. Checking if TabsVariant.Sidebar modifies parent DOM structure
3. Looking for JavaScript that directly manipulates Toolbar styles
4. Testing if the issue reproduces with other sidebar panels open
