# VIEW-005: Data Lineage Panel - NOT PRODUCTION READY

**Status**: ⛔ **RETIRED FROM REACH** (DEBT-012, 2026-07-25) — was ⚠️ NOT PRODUCTION READY

**Date Marked**: January 4, 2026

---

## Resolution — DEBT-012 (2026-07-25)

The decision made in [DEBT-012](../../phase-14.5-revival-debt/DEBT-012-DATAFLOW-TRACKER-SALVAGE.md)
is **not to fix this panel** — patching the tracing algorithm would be attempt #6
of a documented dead end, and it sits next to Explain Mode, which answers the same
"where does this data come from / go to" question correctly. A reachable panel that
confidently shows wrong data-flow answers is worse than none. So the panel has been
**taken out of users' reach**, not repaired:

- **Sidebar registration commented out** in `packages/noodl-editor/src/editor/src/router.setup.ts`
  (the `data-lineage` panel no longer appears in the sidebar). The import is
  commented alongside it.
- **Console spew removed** from `hooks/useDataLineage.ts` (the `🔗 [DataLineage]`
  logs are gone; only a genuine error path logs now).
- **Context-menu entry** (`NodeContextMenu.ts`) was already disabled; its comment
  now records the retirement decision rather than "re-enable when fixed".
- **The panel + engine code is left in place, one release cycle**, behind the dead
  registration. **Next-cycle deletion is queued for DEBT-010's cleanup list**:
  `views/panels/DataLineagePanel/` (the whole directory). `utils/graphAnalysis/lineage.ts`
  is intentionally **left untouched** — it is a self-contained module that a future
  substrate service may reference, and other graphAnalysis consumers must not be
  disturbed by this retirement.
- If a deterministic lineage capability is wanted later, it is **rebuilt as a
  substrate service** (over the node catalog + v2 project format), not by reviving
  this panel — see
  [dev-docs/future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md](../../../future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md).

The original assessment below is retained for history.

---

## Summary

The Data Lineage panel was developed to trace data flow upstream (sources) and downstream (destinations) through the node graph. While the core engine and UI components were built, the feature has been **disabled from production** due to persistent issues that make it unusable in its current state.

---

## Issues Identified

### 1. **Event Handling / Timing Issues**

- Context menu event fires but panel shows "No node selected"
- Node selection state doesn't propagate correctly to the panel
- Attempted fixes with setTimeout and direct event passing didn't resolve the issue

### 2. **Excessive/Irrelevant Data in Results**

- Simple 3-node connections (Variable → String → Text) show 40+ upstream steps
- All unconnected ports being treated as "sources"
- Signal ports, metadata ports, and visual style properties included in traces
- Results are overwhelming and impossible to understand

### 3. **Filtering Inadequate**

- Port filtering (signals, metadata) only partially effective
- Primary port mapping not working as intended
- Depth limiting (MAX_DEPTH) not preventing noise

---

## What Was Implemented

✅ **Core Engine** (`graphAnalysis/lineage.ts`)

- Upstream/downstream tracing logic
- Component boundary crossing
- Connection resolution

✅ **UI Components**

- `DataLineagePanel.tsx` - Main panel component
- `LineagePath.tsx` - Path display component
- `PathSummary.tsx` - Summary statistics
- React hooks for lineage calculation

✅ **Integration** (Now Disabled)

- ~~Context menu "Show Data Lineage" option~~ (commented out)
- Sidebar panel registration
- EventDispatcher integration
- Canvas highlighting for lineage paths

---

## Attempted Fixes

### Fix Attempt 1: Port Filtering

**Approach**: Filter out signal ports (`changed`, `fetched`) and metadata ports (`name`, `savedValue`)  
**Result**: ❌ Reduced some noise but didn't solve the fundamental issue

### Fix Attempt 2: Skip Unconnected Ports

**Approach**: Don't treat every unconnected input as a "source"  
**Result**: ❌ Should have helped but issue persists

### Fix Attempt 3: Primary Ports Only

**Approach**: Only trace main data port (`value` for Variables, `text` for Text nodes)  
**Result**: ❌ Not effective, still too much data

### Fix Attempt 4: Depth Limiting

**Approach**: Reduced MAX_DEPTH from 50 to 5  
**Result**: ❌ Didn't prevent the proliferation of paths

### Fix Attempt 5: Event Timing

**Approach**: setTimeout wrapper, then removed it  
**Result**: ❌ Neither approach fixed selection state issue

---

## What Needs to be Done

### Critical Issues to Fix

1. **Debug Selection State**

   - Why doesn't the node ID reach the panel?
   - Is the event system working correctly?
   - Add comprehensive logging to trace the full event flow

2. **Rethink Tracing Algorithm**

   - Current approach of "trace all ports unless filtered" is fundamentally flawed
   - Need a "trace only connected ports" approach from the ground up
   - Should only follow actual wire connections, not enumerate ports

3. **Better Port Classification**

   - Distinguish between:
     - **Data ports** (value, text, items)
     - **Style ports** (color, fontSize, padding)
     - **Event ports** (onClick, onHover)
     - **Metadata ports** (name, id)
   - Only trace data ports by default

4. **Smarter Termination Conditions**
   - Don't mark unconnected ports as sources/sinks
   - Only mark actual source nodes (String, Number, etc.) as sources
   - Properly detect end of lineage chains

### Recommended Approach

**Start Fresh with a Focused Scope:**

1. **Phase 1**: Get the basics working for a single use case

   - Simple Variable → connection → Text node
   - Should show exactly 2-3 steps
   - Must display correctly in panel

2. **Phase 2**: Add one complexity at a time

   - Expression nodes (transformation)
   - Component boundaries
   - Multi-hop paths

3. **Phase 3**: Handle edge cases
   - Cycles
   - Multiple sources/destinations
   - Different node types

**Test-Driven Development:**

- Write tests FIRST for each scenario
- Verify traced paths match expectations
- Don't move on until tests pass

---

## Current Code State

The code is **present but disabled**:

### Disabled

- Context menu option (commented out in `nodegrapheditor.ts` lines ~2585-2600)
- Users cannot access the feature

### Still Present

- Panel component (`DataLineagePanel/`)
- Lineage engine (`utils/graphAnalysis/lineage.ts`)
- Sidebar registration (panel exists but hidden)
- All UI styling

**To Re-enable**: Uncomment the context menu section in `nodegrapheditor.ts` after issues are fixed.

---

## Files Involved

### Core Logic

- `packages/noodl-editor/src/editor/src/utils/graphAnalysis/lineage.ts` - Tracing engine
- `packages/noodl-editor/src/editor/src/utils/graphAnalysis/traversal.ts` - Port connections
- `packages/noodl-editor/src/editor/src/utils/graphAnalysis/crossComponent.ts` - Boundary crossing

### UI Components

- `packages/noodl-editor/src/editor/src/views/panels/DataLineagePanel/DataLineagePanel.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/DataLineagePanel/components/LineagePath.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/DataLineagePanel/components/PathSummary.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/DataLineagePanel/hooks/useDataLineage.ts`

### Integration Points

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts` - Context menu (disabled)
- `packages/noodl-editor/src/editor/src/router.setup.ts` - Sidebar routing
- `packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.ts` - Panel registration

---

## Conclusion

This feature **needs substantial rework** before it can be production-ready. The current implementation is not salvageable with small fixes - it requires a fundamental rethink of the tracing algorithm and careful test-driven development.

**Estimated Effort**: 2-3 days of focused work with proper debugging and testing

**Priority**: Low - This is a "nice to have" feature, not critical functionality

---

## Related Documentation

- See: `dev-docs/tasks/phase-4-canvas-visualisation-views/CLINE-INSTRUCTIONS.md`
- See: `dev-docs/reference/LEARNINGS.md` for general debugging patterns

---

**Last Updated**: January 4, 2026  
**Marked Not Ready By**: Cline (AI Assistant)  
**Approved By**: Richard Osborne
