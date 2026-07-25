# VIEW-003: Trigger Chain Debugger - Known Issues

## Status: ✅ CORE BUGS FIXED (DEBT-012, 2026-07-25) — still experimental

**Last Updated:** July 25, 2026

This document tracks critical bugs and issues discovered during testing that require investigation and fixing before VIEW-003 can be considered production-ready.

---

## Resolution — DEBT-012 (2026-07-25)

Both critical issues below (aggressive dedup dropping steps; ~40 events per click)
are **fixed**. The root cause turned out to be a wrong mental model of the data,
not a tuning problem:

- `connectiondebugpulse` sends a **full snapshot of every connection currently
  pulsing on each frame**, not a stream of discrete "fired" events. A single real
  pulse lingers in that set for ~100ms (`clearOldConnectionPulsing` evicts only
  after 100ms), so one firing reappears across many consecutive snapshots.
- The old recorder logged one row per connection id per snapshot and leaned on a
  5ms wall-clock threshold. That is backwards on both counts: snapshots arrive
  tens-to-hundreds of ms apart, so 5ms never caught the lingering re-emissions
  (→ the ~40-row flood), while a genuine rapid repeat on the same wire (<5ms)
  was dropped as a "duplicate" (→ the data loss).

**Fix (no time heuristic):** the recorder now does **rising-edge detection** on
the snapshot membership — a connection is a new pulse only on the frame it
transitions *absent → present* in the set; while it stays present it is the same
lingering pulse and is ignored; if it leaves the set and returns, that return is a
genuine repeat and is recorded again. Pure logic lives in
`utils/triggerChain/snapshotDiff.ts`; `ViewerConnection.ts` now hands the whole
snapshot to `TriggerChainRecorder.captureConnectionSnapshot()`.

**Noise filter:** `chainBuilder.groupByInteraction()` segments events into
interaction groups by quiet-gap (250ms) and collapses same-frame identical pulses
into one row with a count, so a button click reads as one grouped interaction
instead of dozens of loose rows. The panel timeline renders these groups.

**Test:** `packages/noodl-editor/tests/utils/TriggerChainRecorder.spec.ts` pins
both directions (no dropped legit repeat, no dupe flood) plus the grouping.

The panel remains **experimental** (trustworthy, not polished). The original
investigation plan below is retained for history.

---

## 🔴 Critical Issues

### Issue #1: Deduplication Too Aggressive

**Status:** CRITICAL - Causing data loss  
**Priority:** HIGH  
**Discovered:** January 4, 2026

**Problem:**
The 5ms deduplication threshold implemented to fix "duplicate events" is now **dropping legitimate signal steps**. Real events that should be captured are being incorrectly filtered out.

**Symptoms:**

- Recording shows fewer events than actually occurred
- Missing steps in signal chains
- Incomplete trigger sequences in timeline
- User reports: "some actual signal steps missing from the recording"

**Root Cause (Hypothesis):**

- ViewerConnection's `connectiondebugpulse` handler may fire multiple times legitimately for:
  - Rapid sequential signals (e.g., button click → show toast → navigate)
  - Fan-out patterns (one signal triggering multiple downstream nodes)
  - Component instantiation events
- Our deduplication logic can't distinguish between:
  - **True duplicates:** Same event sent multiple times by ViewerConnection bug
  - **Legitimate rapid events:** Multiple distinct events happening within 5ms

**Impact:**

- Feature is unreliable for debugging
- Cannot trust recorded data
- May miss critical steps in complex flows

**Required Investigation:**

1. Add verbose debug logging to `ViewerConnection.ts` → `connectiondebugpulse` handler
2. Capture ALL raw events before deduplication with timestamps
3. Analyze patterns across different scenarios:
   - Simple button click → single action
   - Button click → multiple chained actions
   - Data flow through multiple nodes
   - Component navigation events
   - Hover/focus events (should these even be recorded?)
4. Determine if ViewerConnection bug exists vs legitimate high-frequency events
5. Design smarter deduplication strategy (see Investigation Plan below)

**Files Affected:**

- `packages/noodl-editor/src/editor/src/utils/triggerChain/TriggerChainRecorder.ts`
- `packages/noodl-editor/src/editor/src/ViewerConnection.ts`

---

### Issue #2: Event Filtering Strategy Undefined

**Status:** CRITICAL - No clear design  
**Priority:** HIGH  
**Discovered:** January 4, 2026

**Problem:**
There is **no defined strategy** for what types of events should be captured vs ignored. We're recording everything that comes through `connectiondebugpulse`, which may include:

- Visual updates (not relevant to signal flow)
- Hover/mouse events (noise)
- Render cycles (noise)
- Layout recalculations (noise)
- Legitimate signal triggers (SIGNAL - what we want!)

**Symptoms:**

- Event count explosion (40 events for simple actions)
- Timeline cluttered with irrelevant events
- Hard to find actual signal flow in the noise
- Performance concerns with recording high-frequency events

**Impact:**

- Feature unusable for debugging complex flows
- Cannot distinguish signal from noise
- Recording performance may degrade with complex projects

**Required Investigation:**

1. **Categorize all possible event types:**

   - What does `connectiondebugpulse` actually send?
   - What are the characteristics of each event type?
   - Can we identify event types from connectionId format?

2. **Define filtering rules:**

   - What makes an event a "signal trigger"?
   - What events should be ignored?
   - Should we have recording modes (all vs signals-only)?

3. **Test scenarios to document:**

   - Button click → Show Toast
   - REST API call → Update UI
   - Navigation between pages
   - Data binding updates
   - Component lifecycle events
   - Timer triggers
   - User input (typing, dragging)

4. **Design decisions needed:**
   - Should we filter at capture time or display time?
   - Should we expose filter controls to user?
   - Should we categorize events visually in timeline?

**Files Affected:**

- `packages/noodl-editor/src/editor/src/utils/triggerChain/TriggerChainRecorder.ts`
- `packages/noodl-editor/src/editor/src/ViewerConnection.ts`
- `packages/noodl-editor/src/editor/src/views/panels/TriggerChainDebuggerPanel/` (UI for filtering)

---

## 📋 Investigation Plan

### Phase 1: Data Collection (1-2 days)

**Goal:** Understand what we're actually receiving

1. **Add comprehensive debug logging:**

   ```typescript
   // In ViewerConnection.ts
   if (triggerChainRecorder.isRecording()) {
     console.log('🔥 RAW EVENT:', {
       connectionId,
       timestamp: performance.now(),
       extracted_uuids: uuids,
       found_node: foundNode?.type?.name
     });

     content.connectionsToPulse.forEach((connectionId: string) => {
       triggerChainRecorder.captureConnectionPulse(connectionId);
     });
   }
   ```

2. **Create test scenarios:**

   - Simple: Button → Show Toast
   - Medium: Button → REST API → Update Text
   - Complex: Navigation → Load Data → Populate List
   - Edge case: Rapid button clicks
   - Edge case: Hover + Click interactions

3. **Capture and analyze:**
   - Run each scenario
   - Export console logs
   - Count events by type
   - Identify patterns in connectionId format
   - Measure timing between events

### Phase 2: Pattern Analysis (1 day)

**Goal:** Categorize events and identify duplicates vs signals

1. **Categorize captured events:**

   - Group by connectionId patterns
   - Group by timing (< 1ms, 1-5ms, 5-50ms, > 50ms apart)
   - Group by node type
   - Group by component

2. **Identify true duplicates:**

   - Events with identical connectionId and data
   - Events within < 1ms (same frame)
   - Determine if ViewerConnection bug exists

3. **Identify signal patterns:**

   - What do button click signals look like?
   - What do data flow signals look like?
   - What do navigation signals look like?

4. **Identify noise patterns:**
   - Render updates?
   - Hover events?
   - Focus events?
   - Animation frame callbacks?

### Phase 3: Design Solution (1 day)

**Goal:** Design intelligent filtering strategy

1. **Deduplication Strategy:**

   - Option A: Per-connectionId + timestamp threshold (current approach)
   - Option B: Per-event-type + different thresholds
   - Option C: Semantic deduplication (same source node + same data = duplicate)
   - **Decision:** Choose based on Phase 1-2 findings

2. **Filtering Strategy:**

   - Option A: Capture all, filter at display time (user control)
   - Option B: Filter at capture time (performance)
   - Option C: Hybrid (capture signals only, but allow "verbose mode")
   - **Decision:** Choose based on performance measurements

3. **Event Classification:**
   - Add `eventCategory` to TriggerEvent type
   - Categories: `'signal' | 'data-flow' | 'visual' | 'lifecycle' | 'noise'`
   - Visual indicators in timeline (colors, icons)

### Phase 4: Implementation (2-3 days)

1. Implement chosen deduplication strategy
2. Implement event filtering/classification
3. Add UI controls for filter toggles (if needed)
4. Update documentation

### Phase 5: Testing & Validation (1 day)

1. Test all scenarios from Phase 1
2. Verify event counts are accurate
3. Verify no legitimate signals are dropped
4. Verify duplicates are eliminated
5. Verify performance is acceptable

---

## 🎯 Success Criteria

Before marking VIEW-003 as stable:

- [ ] Can record button click → toast action with accurate event count (5-10 events max)
- [ ] No legitimate signal steps are dropped
- [ ] True duplicates are consistently filtered
- [ ] Event timeline is readable and useful
- [ ] Recording doesn't impact preview performance
- [ ] Deduplication strategy is documented and tested
- [ ] Event filtering rules are clear and documented
- [ ] User can distinguish signal flow from noise

---

## 📚 Related Documentation

- `CHANGELOG.md` - Implementation history
- `ENHANCEMENT-connection-highlighting.md` - Visual flow feature proposal
- `ENHANCEMENT-step-by-step-debugger.md` - Step-by-step execution proposal
- `dev-docs/reference/DEBUG-INFRASTRUCTURE.md` - ViewerConnection architecture

---

## 🔧 Current Workarounds

**For developers testing VIEW-003:**

1. **Expect inaccurate event counts** - Feature is unstable
2. **Cross-reference with manual testing** - Don't trust timeline alone
3. **Look for missing steps** - Some events may be dropped
4. **Avoid rapid interactions** - May trigger worst-case deduplication bugs

**For users:**

- Feature is marked experimental for a reason
- Use for general observation, not precise debugging
- Report anomalies to help with investigation

---

## 💡 Notes for Future Implementation

When fixing these issues, consider:

1. **Connection metadata:** Can we get more info from ViewerConnection about event type?
2. **Runtime instrumentation:** Should we add explicit "signal fired" events from runtime?
3. **Performance monitoring:** Add metrics for recording overhead
4. **User feedback:** Add UI indication when events are filtered
5. **Debug mode:** Add "raw event log" panel for investigation
