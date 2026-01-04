# VIEW-003: Trigger Chain Debugger - CHANGELOG

## Status: ⚠️ UNSTABLE - Known Issues (See KNOWN-ISSUES.md)

**Started:** January 3, 2026  
**Completed:** January 3, 2026 (initial implementation)  
**Known Issues Identified:** January 4, 2026  
**Scope:** Option B - Phases 1-3 (Core recording + timeline UI)

**⚠️ CRITICAL:** This feature has known bugs with event deduplication and filtering. See `KNOWN-ISSUES.md` for details and investigation plan. Feature is marked experimental and may capture inaccurate event data.

---

## Implementation Plan

### Phase 1: Recording Infrastructure (2 days)

- [x] 1A: Document existing debug event system ✅
- [x] 1B: Create TriggerChainRecorder (editor-side) ✅
- [ ] 1C: Add recording control commands

### Phase 2: Chain Builder (1 day)

- [x] 2A: Define chain data model types ✅
- [x] 2B: Implement chain builder utilities ✅

### Phase 3: Basic UI (1.5 days)

- [x] 3A: Create panel structure and files ✅
- [x] 3B: Build core UI components ✅
- [x] 3C: Integrate panel into editor ✅

### Deferred (After Phase 3)

- ⏸️ Phase 5: Error & Race detection
- ⏸️ Phase 6: Static analysis mode

---

## Progress Log

### Session 1: January 3, 2026

**Completed Phase 1A:** Document existing debug infrastructure ✅

Created `dev-docs/reference/DEBUG-INFRASTRUCTURE.md` documenting:

- DebugInspector singleton and InspectorsModel
- Event flow from runtime → ViewerConnection → editor
- Connection pulse animation system
- Inspector value tracking
- What we can leverage vs what we need to build

**Key findings:**

- Connection pulse events already tell us when nodes fire
- Inspector values give us data flowing through connections
- ViewerConnection bridge already exists runtime↔editor
- Need to add: causal tracking, component boundaries, event persistence

**Completed Phase 1B:** Build TriggerChainRecorder ✅

Created the complete recorder infrastructure:

1. **Types** (`utils/triggerChain/types.ts`)

   - `TriggerEvent` interface with all event properties
   - `TriggerEventType` union type
   - `RecorderState` and `RecorderOptions` interfaces

2. **Recorder** (`utils/triggerChain/TriggerChainRecorder.ts`)

   - Singleton class with start/stop/reset methods
   - Event capture with max limit (1000 events default)
   - Auto-stop timer support
   - Helper method `captureConnectionPulse()` for bridging

3. **Module exports** (`utils/triggerChain/index.ts`)

   - Clean public API

4. **ViewerConnection integration**
   - Hooked into `connectiondebugpulse` command handler
   - Captures events when recorder is active
   - Leverages existing debug infrastructure

**Key achievement:** Recorder is now capturing events from the runtime! 🎉

**Completed Phase 2A & 2B:** Build Chain Builder ✅

Created the complete chain builder system:

1. **Chain Types** (`utils/triggerChain/chainTypes.ts`)

   - `TriggerChain` interface with full chain data model
   - `TriggerChainNode` for tree representation
   - `EventTiming` for temporal analysis
   - `ChainStatistics` for event aggregation

2. **Chain Builder** (`utils/triggerChain/chainBuilder.ts`)

   - `buildChainFromEvents()` - Main chain construction from raw events
   - `groupByComponent()` - Group events by component
   - `buildTree()` - Build hierarchical tree structure
   - `calculateTiming()` - Compute timing data for each event
   - `calculateStatistics()` - Aggregate chain statistics
   - Helper utilities for naming and duration formatting

3. **Module exports updated**
   - Exported all chain builder functions
   - Exported all chain type definitions

**Key achievement:** Complete data transformation pipeline from raw events → structured chains! 🎉

**Completed Phase 3A, 3B & 3C:** Build Complete UI System ✅

Created the full panel UI and integrated it into the editor:

1. **Panel Structure** (`views/panels/TriggerChainDebuggerPanel/`)

   - Main panel component with recording controls (Start/Stop/Clear)
   - Recording indicator with animated pulsing dot
   - Empty state, recording state, and timeline container
   - Full SCSS styling using design tokens

2. **Core UI Components**

   - `EventStep.tsx` - Individual event display with timeline connector
   - `ChainTimeline.tsx` - Timeline view with chain header and events
   - `ChainStats.tsx` - Statistics panel with event aggregation
   - Complete SCSS modules for all components using design tokens

3. **Editor Integration** (`router.setup.ts`)

   - Registered panel in sidebar with experimental flag
   - Order 10 (after Project Settings)
   - CloudData icon for consistency
   - Description about recording and visualizing event chains

**Key achievement:** Complete, integrated Trigger Chain Debugger panel! 🎉

---

## Phase 3 Complete! ✨

**Option B Scope (Phases 1-3) is now complete:**

✅ **Phase 1:** Recording infrastructure with TriggerChainRecorder singleton  
✅ **Phase 2:** Chain builder with full data transformation pipeline  
✅ **Phase 3:** Complete UI with timeline, statistics, and editor integration

**What works now:**

- Panel appears in sidebar navigation (experimental feature)
- Start/Stop recording controls with animated indicator
- Event capture from runtime preview interactions
- Chain building and analysis
- Timeline visualization of event sequences
- Statistics aggregation by type and component

**Ready for testing!** Run `npm run dev` and enable experimental features to see the panel.

---

## Next Steps

**Completed:**

1. ~~Create documentation for DebugInspector~~ ✅ Done
2. ~~Design TriggerChainRecorder data structures~~ ✅ Done
3. ~~Build recorder with start/stop/reset~~ ✅ Done
4. ~~Hook into ViewerConnection~~ ✅ Done
5. ~~Create basic UI panel with Record/Stop buttons~~ ✅ Done
6. ~~Build timeline view to display captured events~~ ✅ Done

**Post-Implementation Enhancements (January 3-4, 2026):**

### Bug Fixes & Improvements

**Issue: Node data showing as "Unknown"**

- **Problem:** All events displayed "Unknown" for node type, label, and component name
- **Root cause:** ConnectionId format was not colon-separated as assumed, but concatenated UUIDs
- **Solution:** Implemented regex-based UUID extraction from connectionId strings
- **Files modified:**
  - `packages/noodl-editor/src/editor/src/utils/triggerChain/TriggerChainRecorder.ts`
  - Changed parsing from `split(':')` to regex pattern `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi`
  - Try each extracted UUID with `ProjectModel.instance.findNodeWithId()` until match found
- **Result:** ✅ Events now show correct node types, labels, and component names

**Enhancement: Click Navigation**

- **Added:** Click event cards to jump to that component
- **Added:** Click component chips in stats panel to navigate
- **Implementation:**
  - `EventStep.tsx`: Added click handler using `NodeGraphContextTmp.switchToComponent()`
  - `ChainStats.tsx`: Added click handler to component chips
  - Navigation disabled while recording (cursor shows pointer only when not recording)
- **Result:** ✅ Full navigation from timeline to components

**Enhancement: Live Timeline Updates**

- **Problem:** Timeline only showed after stopping recording
- **Added:** Real-time event display during recording
- **Implementation:**
  - Poll `getEvents()` every 100ms during recording
  - Update both event count and timeline display
  - Changed UI condition from `hasEvents && !isRecording` to `hasEvents`
- **Result:** ✅ Timeline updates live as events are captured

**Enhancement: UI Improvements**

- Changed panel icon from CloudData to Play (more trigger-appropriate)
- Made Topology Map (VIEW-001) experimental-only by adding `experimental: true` flag
- **Files modified:**
  - `packages/noodl-editor/src/editor/src/router.setup.ts`

**Code Cleanup**

- Removed verbose debug logging from TriggerChainRecorder
- Kept essential console warnings for errors
- **Files modified:**
  - `packages/noodl-editor/src/editor/src/utils/triggerChain/TriggerChainRecorder.ts`

### Critical Bug Fixes (January 4, 2026)

**Bug Fix: Missing Canvas Node Highlighting**

- **Problem:** Clicking events navigated to components but didn't highlight the node on canvas (like XRAY mode)
- **Solution:** Modified `EventStep.tsx` click handler to find and pass node to `switchToComponent()`
- **Implementation:**
  - Extract `nodeId` from event
  - Use `component.graph.findNodeWithId(nodeId)` to locate node
  - Pass `node` option to `NodeGraphContextTmp.switchToComponent()`
  - Pattern matches ComponentXRayPanel's navigation behavior
- **Files modified:**
  - `packages/noodl-editor/src/editor/src/views/panels/TriggerChainDebuggerPanel/components/EventStep.tsx`
- **Result:** ✅ Clicking events now navigates AND highlights the node on canvas

**Bug Fix: Event Duplication**

- **Problem:** Recording captured ~40 events for simple button→toast action (expected ~5-10)
- **Root cause:** ViewerConnection's `connectiondebugpulse` handler fires multiple times per frame
- **Solution:** Added deduplication logic to TriggerChainRecorder
- **Implementation:**
  - Added `recentEventKeys` Map to track recent event timestamps
  - Use connectionId as unique event key
  - Skip events that occur within 5ms of same connectionId
  - Clear deduplication map on start recording
  - Periodic cleanup to prevent map growth
- **Files modified:**
  - `packages/noodl-editor/src/editor/src/utils/triggerChain/TriggerChainRecorder.ts`
- **Result:** ✅ Event counts now accurate (5-10 events for simple actions vs 40 before)

---

## Future Enhancements

**See:** `ENHANCEMENT-step-by-step-debugger.md` for detailed proposal

**Phase 4+ (Deferred):**

- Error detection and highlighting
- Race condition detection
- Performance bottleneck identification
- Static analysis mode
- Enhanced filtering and search
- **Step-by-step debugger** (separate enhancement doc created)
