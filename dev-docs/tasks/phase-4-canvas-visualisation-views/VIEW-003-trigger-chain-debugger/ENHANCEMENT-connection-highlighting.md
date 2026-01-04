# ENHANCEMENT: Connection Highlighting for Signal Flow Visualization

**Status:** 💡 Proposed Enhancement  
**Priority:** MEDIUM  
**Effort:** 2-3 days  
**Depends on:** VIEW-003 core functionality + KNOWN-ISSUES fixes

---

## Overview

Visual highlighting of connections when clicking events in the timeline to show signal flow through the node graph. This creates a "visual debugger" experience where you can see exactly which connections triggered which nodes.

## User Value

**Current Experience:**

- Click event → Navigate to component → Node is highlighted
- User must mentally trace connections to understand flow

**Enhanced Experience:**

- Click event → Navigate + highlight node + highlight incoming connection + highlight outgoing connections
- Visual "breadcrumb trail" showing signal path through graph
- Immediately understand cause and effect

## Visual Design

### Highlighting Layers

When clicking an event in timeline:

1. **Source Node** (already implemented)

   - Node border highlighted
   - Node selected in canvas

2. **Incoming Connection** (NEW)

   - Connection line highlighted with pulse animation
   - Shows "where the signal came from"
   - Color: theme accent (e.g., blue)

3. **Outgoing Connections** (NEW)
   - All connections triggered by this event highlighted
   - Shows "what happened next"
   - Color: theme success (e.g., green)
   - Optional: Show in sequence if multiple

### UI States

**Single Step Mode** (default):

- Shows one event's flow at a time
- Clear highlighting persists until next event clicked

**Chain Mode** (future):

- Shows entire recorded chain overlaid
- Each step in sequence with different colors
- Creates "flow animation" through graph

## Technical Design

### Data Requirements

**Current TriggerEvent:**

```typescript
interface TriggerEvent {
  nodeId?: string; // ✅ Have this
  componentName: string; // ✅ Have this
  // MISSING:
  connectionId?: string; // Need for incoming connection
  triggeredConnections?: string[]; // Need for outgoing
}
```

**Required Changes:**

1. Capture connectionId in TriggerChainRecorder
2. Capture triggered connections (next events in chain)
3. Store in TriggerEvent interface

### Implementation Plan

#### Phase 1: Data Capture (1 day)

**Update TriggerEvent interface:**

```typescript
interface TriggerEvent {
  // ... existing fields
  connectionId?: string; // ID of connection that triggered this
  sourcePort?: string; // Output port name
  targetPort?: string; // Input port name
  nextEvents?: string[]; // IDs of events this triggered
}
```

**Update TriggerChainRecorder:**

- Capture connectionId from ViewerConnection data
- Parse source/target ports from connectionId
- Build forward links (nextEvents) during chain building

#### Phase 2: Connection Lookup (0.5 days)

**Add connection lookup to EventStep click handler:**

```typescript
// Find the connection from connectionId
const connection = component.graph.connections.find(/* match */);
if (connection) {
  // Highlight it
}
```

**Challenge:** Connection ID format may not match graph model format
**Solution:** Use port + node matching as fallback

#### Phase 3: Highlighting System (1 day)

**Use existing HighlightManager:**

```typescript
// In EventStep.tsx click handler
HighlightManager.instance.highlightConnections(
  [event.connectionId], // Incoming
  {
    channel: 'trigger-chain-incoming',
    color: 'accent',
    animated: true
  }
);

HighlightManager.instance.highlightConnections(
  event.nextConnectionIds, // Outgoing
  {
    channel: 'trigger-chain-outgoing',
    color: 'success',
    animated: false
  }
);
```

**Fallback:** If HighlightManager doesn't support connections, extend it or use ViewerConnection highlighting

#### Phase 4: UI Controls (0.5 days)

**Add toggle in panel:**

- "Show connection flow" checkbox
- Enabled by default
- Persisted in user preferences

## Benefits for Step-by-Step Debugger

This enhancement directly enables step-by-step debugging by:

1. **Visual confirmation:** User sees exactly what will execute next
2. **Flow prediction:** Outgoing connections show multiple paths
3. **Debugging aid:** Easily spot unexpected connections
4. **Learning tool:** New users understand signal flow visually

## Edge Cases

1. **Cross-component signals:** Connection spans components

   - Solution: Highlight in both components, navigate as needed

2. **Fan-out:** One signal triggers multiple nodes

   - Solution: Highlight all outgoing connections

3. **Missing data:** ConnectionId not captured

   - Solution: Graceful degradation (node-only highlighting)

4. **Performance:** Many connections highlighted
   - Solution: Limit to 10 connections max, show "and X more"

## Success Criteria

- [ ] Clicking event highlights incoming connection
- [ ] Clicking event highlights all outgoing connections
- [ ] Highlighting persists until another event clicked
- [ ] Works across simple and complex signal chains
- [ ] Performance acceptable with 50+ nodes
- [ ] Graceful fallback if connection data missing

## Related Enhancements

- **ENHANCEMENT-step-by-step-debugger.md:** Uses this for visual feedback
- **KNOWN-ISSUES.md:** Connection data capture depends on event filtering fixes

## Files to Modify

- `packages/noodl-editor/src/editor/src/utils/triggerChain/types.ts`
- `packages/noodl-editor/src/editor/src/utils/triggerChain/TriggerChainRecorder.ts`
- `packages/noodl-editor/src/editor/src/views/panels/TriggerChainDebuggerPanel/components/EventStep.tsx`
- Potentially: `packages/noodl-editor/src/editor/src/services/HighlightManager.ts` (if connection support needed)
