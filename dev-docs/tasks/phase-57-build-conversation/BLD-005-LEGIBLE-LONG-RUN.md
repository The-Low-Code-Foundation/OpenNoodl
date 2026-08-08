# BLD-005 — The long run is legible

**Status:** 📋 not started · **Track A** · ⭐ · after BLD-001, BLD-004 · closes **correction 2**

## ⚠️ The premise this task nearly shipped with was wrong

Richard's report: *"it takes like 10–20 mins to create one page and during that time it's hard to
know if it's stuck, thinking, which component it's currently building or not."* That reads as
"there is no progress reporting". **There is.** AIB-002 built:

- a run headline with position, elapsed and cumulative cost
  ([ProjectAuthoringView.tsx:1309-1313](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1309));
- a row per operation with status icon, target and **its own live clock**
  ([:1315-1330](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1315),
  `useElapsedClock` at [:255](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L255));
- an expandable per-operation activity feed;
- honest cost formatting that refuses to print `$0.00` for unknown pricing
  ([:168-172](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L168)).

**It feels like nothing because the headline is inside the scroll area.** The `ScrollArea` opens at
[:1091](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1091)
and `runHeadline` renders inside it. Thirty seconds into a seven-operation run, the one element
answering *"where am I"* has scrolled off, and what remains is a column of identical
`IconName.MagicWand` glyphs ([statusIcon](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L105),
`case 'authoring'`).

**So this task is mostly placement and one honest number — not a new instrumentation layer.** Do not
rebuild what AIB-002 already got right.

## Build

1. **Pin the run header outside the scroll area.** Position, target, elapsed, cost, and the BLD-004
   heartbeat, always visible while a run is live. This alone is most of the fix.
2. **The plan is the map, from operation zero.** All operations listed from the first second: done
   ones collapsed to a tick and a duration, the current one expanded with a live sub-line, pending
   ones dimmed. "Which component is it building" becomes a glance, not a read.
3. **The current operation gets a live sub-line** — *"reading node docs"*, *"writing 19 nodes"*,
   *"repairing 2 problems"* — derived from the last activity of that operation, promoted. The data
   is already there; nothing new is measured.
4. **Distinguish the statuses visually.** `authoring` currently shares a static wand with nothing to
   distinguish it from the row above. Current = accent + motion (the heartbeat); pending = dim;
   done = success tick; failed = warning.
5. **An honest estimate, and only when it is honest.** Median completed-operation duration ×
   remaining, shown **only after ≥ 2 operations have completed**, and labelled *"(estimate)"*.
   ⚠️ Never show an estimate from one sample, and never let it count *down* past zero — a countdown
   that hits 0:00 and keeps running is worse than no estimate.
6. **Stop says what stopping costs.** The existing copy already does this well for docs
   ([:1077-1085](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1077)
   — including the AIB-009 F4 note about "The 1 document are written last"). Keep that care and
   extend it: *"Stop — keeps the 2 built so far"*.

## Acceptance

- [ ] A seven-operation run: the header is visible at every scroll position, from second 1 to the end.
      Driven live, screenshotted at three scroll depths.
- [ ] The current operation is identifiable without reading text (icon + motion + weight).
- [ ] No estimate is shown before two operations complete; after that it is within ±40% on a
      recorded run, or it is not shown.
- [ ] At 400px the run map does not scroll horizontally — POL-007's rules still hold. **Re-check;
      this task adds a sub-line to a row POL-007 fought to fit.**
- [ ] Cancelling mid-run keeps everything already staged (existing property — pin it, do not
      re-derive it).

## Register

| # | Finding | State |
|---|---|---|
| | | |
