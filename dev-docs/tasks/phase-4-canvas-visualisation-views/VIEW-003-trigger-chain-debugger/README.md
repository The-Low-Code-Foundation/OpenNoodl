# VIEW-003: Trigger Chain Debugger

**View Type:** 🗺️ Meta View (replaces canvas with timeline view)

## Overview

An interactive timeline/sequence view that shows the chain of events from a user action through all the nodes it triggers, across component boundaries. Like a "call stack" for visual programming, with the ability to record live interactions or simulate paths.

**Estimate:** 5-7 days  
**Priority:** HIGH  
**Complexity:** High  
**Dependencies:** VIEW-000 (Foundation), PREREQ-002 (React 19 Debug Fixes)

---

## The Problem

When something goes wrong in a Noodl app:
- You don't know what triggered what
- Events cross component boundaries invisibly  
- Race conditions are nearly impossible to debug
- You can't see *when* things happened relative to each other
- Tracing a click through 5 components is manual detective work

The classic question: "The login isn't working. What's happening between the button click and the API call?"

---

## The Solution

A debugger that:
1. **Records** actual runtime events as they happen (live mode)
2. **Traces** potential paths through the graph (static analysis mode)
3. **Shows timing** - when each step happened
4. **Crosses boundaries** - follows data/signals into child components
5. **Highlights failures** - shows where things stopped or errored

---

## User Stories

1. **As a developer debugging**, I want to see exactly what happened when I clicked a button, step by step.

2. **As a developer debugging race conditions**, I want to see the timing of events to understand ordering.

3. **As a developer understanding code**, I want to trace what *would* happen from a given trigger without running the app.

4. **As a developer fixing bugs**, I want to see where in the chain something failed or got blocked.

---

## UI Design

### Main View - Recorded Chain

```
┌─────────────────────────────────────────────────────────────────┐
│ Trigger Chain Debugger                            [🔴 Record]   │
├─────────────────────────────────────────────────────────────────┤
│ Chain: "Login Button Click"                    Total: 847ms     │
│ Started: 14:32:05.123                          Steps: 12        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Login Page ────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  ┌──────────────────────────────────────────────────────┐  │ │
│ │  │ 1  14:32:05.123  [Button] "Login" clicked            │  │ │
│ │  │    └─ onClick signal fired                           │  │ │
│ │  └──────────────────────────────────────────────────────┘  │ │
│ │                         │                                   │ │
│ │                         ▼ 2ms                               │ │
│ │  ┌──────────────────────────────────────────────────────┐  │ │
│ │  │ 2  14:32:05.125  [Function] validateForm             │  │ │
│ │  │    ├─ Input: { email: "test@...", password: "***" }  │  │ │
│ │  │    └─ Output: Success ✓                              │  │ │
│ │  └──────────────────────────────────────────────────────┘  │ │
│ │                         │                                   │ │
│ │                         ▼ 1ms                               │ │
│ └─────────────────────────┼───────────────────────────────────┘ │
│                           │                                     │
│         ┌─────────────────┴─────────────────┐                  │
│         │ ↓ Entering: AuthFlow Component    │                  │
│         └─────────────────┬─────────────────┘                  │
│                           │                                     │
│ ┌─ AuthFlow Component ────┼───────────────────────────────────┐ │
│ │                         ▼                                   │ │
│ │  ┌──────────────────────────────────────────────────────┐  │ │
│ │  │ 3  14:32:05.126  [Component Input] loginTriggered    │  │ │
│ │  │    └─ Signal received from parent                    │  │ │
│ │  └──────────────────────────────────────────────────────┘  │ │
│ │                         │                                   │ │
│ │                         ▼ 0ms                               │ │
│ │  ┌──────────────────────────────────────────────────────┐  │ │
│ │  │ 4  14:32:05.126  [Variable] isLoading ← true         │  │ │
│ │  └──────────────────────────────────────────────────────┘  │ │
│ │                         │                                   │ │
│ │              ┌──────────┴──────────┐                       │ │
│ │              ▼                     ▼                        │ │
│ │  ┌────────────────────┐  ┌────────────────────┐            │ │
│ │  │ 5  [States]        │  │ 6  [REST] POST     │            │ │
│ │  │    → "loading"     │  │    /api/auth/login │            │ │
│ │  └────────────────────┘  └────────────────────┘            │ │
│ │                                   │                         │ │
│ │                                   ▼ ⏳ 523ms                │ │
│ │  ┌──────────────────────────────────────────────────────┐  │ │
│ │  │ 7  14:32:05.649  [REST] Response received            │  │ │
│ │  │    ├─ Status: 200 OK                                 │  │ │
│ │  │    └─ Body: { user: { id: 123, name: "..." } }       │  │ │
│ │  └──────────────────────────────────────────────────────┘  │ │
│ │                         │                                   │ │
│ │                         ▼                                   │ │
│ └─────────────────────────┼───────────────────────────────────┘ │
│                           │                                     │
│         ┌─────────────────┴─────────────────┐                  │
│         │ ↑ Exiting: AuthFlow Component     │                  │
│         └─────────────────┬─────────────────┘                  │
│                           │                                     │
│ ┌─ Login Page ────────────┼───────────────────────────────────┐ │
│ │                         ▼                                   │ │
│ │  ┌──────────────────────────────────────────────────────┐  │ │
│ │  │ 8  14:32:05.651  [Navigate] → /home                  │  │ │
│ │  │    └─ ✓ Navigation successful                        │  │ │
│ │  └──────────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [< Prev]  Step 8 of 8  [Next >]    [Clear]    [↗ Jump to Node] │
└─────────────────────────────────────────────────────────────────┘
```

### Error State View

```
┌──────────────────────────────────────────────────────────────┐
│ 7  14:32:05.649  [REST] Response received                    │
│    ├─ Status: 401 Unauthorized                               │
│    └─ Body: { error: "Invalid credentials" }                 │
│                                                              │
│    ❌ ERROR: Request failed                                  │
│    Chain terminated here                                     │
│                                                              │
│    Expected next: [Variable] currentUser                     │
│    But: Error output triggered instead                       │
└──────────────────────────────────────────────────────────────┘
```

### Race Condition View

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️  POTENTIAL RACE CONDITION DETECTED                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Timeline:                                                       │
│                                                                 │
│ Chain A (Login)        Chain B (Auto-refresh)                   │
│ ──────────────         ───────────────────────                  │
│                                                                 │
│ 05.123  Button click                                            │
│ 05.125  │                 05.130  Timer fired                   │
│ 05.126  │ REST call        05.131  │ REST call                  │
│         │ started                  │ started                    │
│         ▼                          ▼                            │
│ 05.649  │ Response ────────05.645  │ Response                   │
│         │                          │                            │
│ 05.651  │ Set user ←───────05.647  │ Set user  ← CONFLICT!     │
│         ▼                          ▼                            │
│                                                                 │
│ Both chains write to 'currentUser' within 4ms                   │
│ Final value depends on timing                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Controls

- **[🔴 Record]** - Start/stop recording live events
- **[< Prev] [Next >]** - Step through the chain
- **[Clear]** - Clear recorded chain
- **[↗ Jump to Node]** - Jump to the selected step's node in canvas
- **Click any step** - Select it, show details
- **Hover step** - Preview the node

---

## Technical Design

### Recording Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RUNTIME                                   │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Node A    │───▶│   Node B    │───▶│   Node C    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                  │                  │                   │
│        │ event            │ event            │ event             │
│        ▼                  ▼                  ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              TriggerChainRecorder (singleton)               ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ events: [                                           │   ││
│  │  │   { timestamp, nodeId, type, data, component },     │   ││
│  │  │   { timestamp, nodeId, type, data, component },     │   ││
│  │  │   ...                                               │   ││
│  │  │ ]                                                   │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EDITOR                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              TriggerChainDebuggerView                       ││
│  │                                                             ││
│  │  - Subscribes to recorder                                   ││
│  │  - Builds visual chain from events                          ││
│  │  - Groups by component                                      ││
│  │  - Calculates timing                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
interface TriggerEvent {
  id: string;
  timestamp: number;  // High-resolution timestamp
  
  // What happened
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  eventType: 'signal' | 'value-change' | 'api-call' | 'api-response' | 'navigation' | 'error';
  
  // Context
  componentName: string;
  componentPath: string[];  // Full path for nested components
  
  // Data
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  error?: { message: string; stack?: string };
  
  // Chain info
  triggeredBy?: string;  // ID of event that caused this one
  triggers?: string[];   // IDs of events this one caused
}

interface TriggerChain {
  id: string;
  name: string;  // User-assigned or auto-generated
  startTime: number;
  endTime: number;
  duration: number;
  events: TriggerEvent[];
  
  // Organized view
  byComponent: Map<string, TriggerEvent[]>;
  tree: TriggerEventNode;  // Tree structure for rendering
  
  // Analysis
  warnings: ChainWarning[];
  errors: ChainError[];
}

interface TriggerEventNode {
  event: TriggerEvent;
  children: TriggerEventNode[];
  componentBoundary?: 'enter' | 'exit';
}
```

### Static Analysis Mode

For tracing without running:

```typescript
interface StaticTraceResult {
  possiblePaths: TracePath[];
  warnings: string[];
}

interface TracePath {
  steps: TraceStep[];
  probability: 'certain' | 'conditional' | 'unlikely';
  conditions: string[];  // What conditions must be true for this path
}

interface TraceStep {
  node: NodeGraphNode;
  component: ComponentModel;
  inputPort?: string;
  outputPort?: string;
  crossesComponent?: {
    from: string;
    to: string;
    direction: 'into' | 'outof';
  };
}

/**
 * Trace all possible paths from a starting node.
 * Uses graph traversal + condition analysis.
 */
function traceStaticPaths(
  project: ProjectModel,
  startComponent: ComponentModel,
  startNodeId: string,
  startPort: string
): StaticTraceResult;
```

---

## Implementation Phases

### Phase 1: Recording Infrastructure (2 days)

1. Create `TriggerChainRecorder` singleton
2. Hook into runtime event system
3. Capture node activations with timestamps
4. Track causal relationships (what triggered what)
5. Handle component boundary crossings
6. Store events in memory (with size limits)

**Verification:**
- [ ] Recorder captures node events
- [ ] Timestamps are accurate
- [ ] Causal chains are tracked
- [ ] Component boundaries marked

### Phase 2: Chain Builder (1 day)

1. Implement chain construction from raw events
2. Group events by component
3. Build tree structure for rendering
4. Calculate timing between steps
5. Detect parallel branches

**Verification:**
- [ ] Chain builds correctly from events
- [ ] Component grouping works
- [ ] Timing calculations accurate

### Phase 3: Basic UI (1.5 days)

1. Create `TriggerChainDebuggerView` component
2. Render event timeline
3. Show component boundaries
4. Display event details
5. Implement step navigation

**Verification:**
- [ ] Timeline renders correctly
- [ ] Component sections visible
- [ ] Step details shown
- [ ] Navigation works

### Phase 4: Recording Controls (0.5 days)

1. Add Record/Stop button
2. Add Clear button
3. Show recording indicator
4. Handle multiple chains
5. Auto-name chains

**Verification:**
- [ ] Can start/stop recording
- [ ] Multiple chains supported
- [ ] UI updates in real-time during recording

### Phase 5: Error & Race Detection (1 day)

1. Detect and highlight errors in chain
2. Implement race condition detection
3. Show warnings for potential issues
4. Add conflict highlighting

**Verification:**
- [ ] Errors clearly shown
- [ ] Race conditions detected
- [ ] Warnings displayed

### Phase 6: Static Analysis Mode (1 day)

1. Implement `traceStaticPaths()`
2. Add "Trace from here" context menu
3. Show possible paths without running
4. Indicate conditional branches

**Verification:**
- [ ] Static trace works
- [ ] Conditional paths shown
- [ ] Context menu integration works

---

## Files to Create

```
packages/noodl-runtime/src/
└── debug/
    └── TriggerChainRecorder.ts

packages/noodl-editor/src/editor/src/views/AnalysisPanel/
└── TriggerChainDebuggerView/
    ├── index.ts
    ├── TriggerChainDebuggerView.tsx
    ├── TriggerChainDebuggerView.module.scss
    ├── ChainTimeline.tsx
    ├── EventStep.tsx
    ├── ComponentBoundary.tsx
    ├── RecordingControls.tsx
    ├── ChainWarnings.tsx
    ├── useTriggerChainRecorder.ts
    └── staticAnalysis.ts
```

---

## Success Criteria

- [ ] Can record a live interaction chain
- [ ] Shows accurate timing between events
- [ ] Component boundaries clearly marked
- [ ] Can step through chain
- [ ] Can jump to any node in canvas
- [ ] Errors highlighted clearly
- [ ] Race conditions detected
- [ ] Static analysis provides useful paths
- [ ] Performance acceptable (< 5% overhead when recording)

---

## Future Enhancements

- **Export chain** - Export as JSON for bug reports
- **Replay** - Actually replay a recorded chain
- **Breakpoints** - Pause execution at certain nodes
- **Conditional breakpoints** - Break when condition is met
- **Time travel** - Step backwards through chain
- **Chain comparison** - Compare two chains side by side

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Performance overhead from recording | Make recording opt-in, use sampling |
| Too many events to display | Filtering, collapsing, pagination |
| Causal tracking misses relationships | Test extensively, allow manual linking |
| Runtime integration complex | Start with key node types, expand |

---

## Dependencies

- VIEW-000 Foundation
- Runtime integration (may require runtime changes)

## Blocks

- None (independent view)

---

## Runtime Integration (CRITICAL)

**This view REQUIRES tight integration with the app preview runtime.** It builds on the same infrastructure that makes nodes "light up" when you interact with the preview.

### Existing Debug Infrastructure

Noodl already has powerful runtime debugging:
- **DebugInspector** - Shows live values when hovering over connections
- **Node highlighting** - Nodes flash/highlight when they fire
- **Data flow visualization** - Connections animate when data flows

The Trigger Chain Debugger extends this by:
1. **Recording** these events instead of just displaying them momentarily
2. **Correlating** events across time to build causal chains
3. **Crossing component boundaries** to show the full picture
4. **Persisting** the chain for step-by-step review

### Integration Points

```typescript
// Existing infrastructure to leverage:

// 1. DebugInspector.InspectorsModel - already tracks pinned values
import { DebugInspector } from '@noodl-models/DebugInspector';

// 2. Node execution events - the runtime emits these
nodeInstance.on('outputChanged', (port, value) => { ... });
nodeInstance.on('signalSent', (port) => { ... });

// 3. Connection highlighting - already exists in NodeGraphEditor
this.highlightConnection(connection, duration);
this.highlightNode(node, duration);
```

### What We Need from Runtime

The recorder needs to subscribe to events that the runtime already emits (or can easily emit):

| Event | Currently Available? | Notes |
|-------|---------------------|-------|
| Node output changed | ✅ Yes | Used for debug inspector |
| Signal fired | ✅ Yes | Used for node highlighting |
| Component entered | ⚠️ Partial | May need enhancement |
| Component exited | ⚠️ Partial | May need enhancement |
| REST call started | ✅ Yes | Visible in network tab |
| REST call completed | ✅ Yes | Visible in network tab |
| Error occurred | ✅ Yes | Shown in console |

### Key Difference from Canvas Highlighting

The existing canvas highlighting shows you what's happening **right now** in **one component at a time**. You have to manually navigate between components to see different parts of the flow.

The Trigger Chain Debugger shows you what happened **over time** across **all components simultaneously**. It's the difference between:
- 🎥 **Existing**: Live TV with one camera angle, you switch channels manually
- 🎬 **New**: Recorded footage with all camera angles synced, scrub through timeline

### Synchronization with Preview

When recording:
1. User clicks [Record] in the debugger view
2. Debugger subscribes to runtime events via existing debug infrastructure
3. User interacts with preview window
4. Events stream into the debugger and build the chain
5. User clicks [Stop]
6. Chain is available for step-through review

When reviewing:
1. User steps through recorded chain
2. Each step highlights the corresponding node on canvas (using existing highlighting)
3. If user clicks "Jump to Node", canvas navigates and selects that node
4. Optionally: replay the highlighting animation at each step

### Implementation Priority

**Phase 1 of this task should focus on discovering and documenting the existing debug event infrastructure** before building UI. Key questions:
- What events does the runtime already emit?
- How does DebugInspector subscribe to them?
- How does node highlighting currently work?
- What's missing for cross-component tracking?
