# BLD-005 — The long run is legible

**Status:** ✅ **built, driven and closed** (2026-08-09) · **Track A** · ⭐ · closes **correction 2**

> ⚠️ **Listed as "after BLD-004" and built before it.** Only step 4's *motion* needed the heartbeat,
> and motion is the one thing here that must not be faked — see the register (R2). Everything else
> reads `PlanOperationState.startedAt/endedAt`, which AIB-002 already publishes and which is a
> different clock from the activity timestamps C8 wants.

## What the drive measured

Four runs in `ai-test`, scripted provider, from a thread asserted empty (0 turns, **0 run headers**).
Five operations, paced 5s/5s/25s/5s/5s so the estimate rule had something to be wrong about.

**The headline criterion — the header at every scroll position, while live:**

| scrollTop | header top | header bottom | visible | above the scroller | h-overflow |
|---|---|---|---|---|---|
| 0 | 151 | 198 | ✅ | ✅ | **0** |
| 604 | 151 | 198 | ✅ | ✅ | **0** |
| 1209 (bottom) | 151 | 198 | ✅ | ✅ | **0** |

Identical to the pixel at all three depths, in a panel **364px** wide — narrower than the 400px the
criterion names, so a stricter test than it asked for.

**The estimate rule, as it actually behaved:**

| position | completed | header |
|---|---|---|
| Building 1 of 5 | 0 | `Building 1 of 5 · 5s · $0.00` — **no estimate** |
| Building 2 of 5 | 1 | `Building 2 of 5 · 10s · $0.06` — **still no estimate** |
| Building 3 of 5 | 2 | `… · about 18s left (estimate)` — **appears here** |
| Building 3 of 5 | 2 | `… about 16s` → `13s` → `12s` → **`12s`** → **`12s`** |
| 5 of 5 built | 5 | `5 of 5 built · 54s · $0.31` — **estimate gone** |

The two rows that matter are the last two of the live ones. Operation 3 ran 25s against a 6s median,
so its own share of the estimate hit zero — and the figure **held at 12s** (the two queued
operations) instead of counting to `0:00` and sitting there while the run continued. That is the
acceptance criterion, observed rather than reasoned.

**Accuracy:** on a separate recorded run, at t=12s it predicted 18s remaining → 30s total; the run
finished at **36s**. **17% under**, inside the ±40% the criterion allows.

**A run that fails is counted honestly.** One drive submitted components the gate rejected, and the
header read **`0 of 5 built`** — not `5 of 5`. The live form counts the operation in flight; the
finished form counts what staged.

## ⚠️ The finding this task nearly shipped, and the rule it re-proves

**Pending rows were dimmed with `opacity: 0.55`, and that measured 3.27:1 — below AA.** The comment
sitting directly above it said *"a row nobody can read is not a quieter row"*. It was written before
the value was measured, which is the entire lesson.

Swept on the real composited pixels, `fg-default` on this surface:

| opacity | 0.55 | 0.65 | 0.70 | 0.75 | 0.80 | 0.85 |
|---|---|---|---|---|---|---|
| **dark** | 3.27 ❌ | 4.03 ❌ | 4.46 ❌ | 4.92 ✅ | 5.41 ✅ | 5.93 ✅ |
| **light** | 2.53 ❌ | 3.10 ❌ | 3.46 ❌ | 3.87 ❌ | 4.34 ❌ | 4.89 ✅ |

> **Every opacity that reads as dimmed fails AA in light mode, and the first one that passes in both
> (0.85) is too subtle to read as dimming at all. There is no value that is both.**

That is [the muted-button trap](../../../CLAUDE.md) in a new place: opacity expresses de-emphasis by
destroying contrast, and it does it without ever appearing in a colour token, so nothing in the code
says a ratio changed. Replaced with `fg-default-shy` — a real step down that is **5.57 dark / 5.06
light** — plus the status icon, which already differed.

**Measured after the fix, both themes, on the surface each row actually paints:**

| | headline | current target | current sub-line | current row | pending row |
|---|---|---|---|---|---|
| **dark** | 15.05 | 7.70 | 5.57 | 7.70 | **5.57** ✅ |
| **light** | 15.41 | 7.10 | 5.06 | 7.10 | **5.06** ✅ |

Nothing in this header or map is below AA in either theme, and `current` (7.70/7.10) is a real step
above `pending` (5.57/5.06) rather than a brightness trick.

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

## What was built

| Step | State |
|---|---|
| 1 — pin the header | ✅ `thread/RunHeader.tsx`, in the header row `BuildThread` has kept free since BLD-001. The copy that was inside the scroll area is **removed**, not duplicated. |
| 2 — the map from operation zero | ✅ already listed every operation; what was missing was that they all looked alike. Five roles now, `operationRole`. |
| 3 — the live sub-line | ✅ `authoringDetail` promoted into the header. It already existed on the row; it moved to the model so the two renderers cannot disagree. |
| 4 — distinguish the statuses | ⚠️ **partly, deliberately** — accent and weight, **no motion**. See R2. |
| 5 — the honest estimate | ✅ `estimateRemaining`, with three separate refusals and 25 specs. |
| 6 — stop says what it costs | ✅ `stopCost`, and it now exists for **every** run rather than only ones with pending documents. |

## Acceptance

- [x] A seven-operation run: the header is visible at every scroll position, from second 1 to the end.
      Driven live, screenshotted at three scroll depths. **Five operations, not seven — the table
      above; identical geometry at scrollTop 0 / 604 / 1209.**
- [x] The current operation is identifiable without reading text (icon + motion + weight).
      **Icon and weight and accent — 7.70/7.10 against pending's 5.57/5.06. ⚠️ Not motion; see R2.**
- [x] No estimate is shown before two operations complete; after that it is within ±40% on a
      recorded run, or it is not shown. **Absent at 0 and 1 completed; 17% under on the recorded run.**
- [x] At 400px the run map does not scroll horizontally — POL-007's rules still hold.
      **Measured at 364px: `scrollWidth - clientWidth = 0` at all three scroll depths.**
- [x] Cancelling mid-run keeps everything already staged (existing property — pin it, do not
      re-derive it). **Pinned by `stopCost`, which now says so before the click: driven, and it read
      *"Stopping keeps the 4 built so far."***

## Register

| # | Finding | State |
|---|---|---|
| **R1** | ⚠️ **`opacity` cannot express "pending" and stay legible.** Shipped at 0.55 → **3.27:1 dark, 2.53:1 light**, both below AA, under a comment asserting the opposite. The full sweep is in the table above: no value is both visibly dimmed and AA-clear in both themes. Opacity is uniquely dangerous here because it changes contrast *without appearing in any colour token* — nothing in the code says a ratio moved, and `tsc`, every pure spec and a dark-mode-only screenshot all pass. | **fixed** — `fg-default-shy`, measured 5.57 dark / 5.06 light, plus the status icon that already differed |
| **R2** | ⚠️ **The current operation deliberately does NOT animate, and step 4 asked for motion.** A pulse driven by `busy` animates most confidently at exactly the moment nothing is happening — `busy` stays true when the provider has hung, which is the failure this whole phase's correction 2 is about. Motion has to be driven by `onActivity`. | **not built, deliberately** — rule 5. Filed for **BLD-004**, which owns the heartbeat, alongside C8 |
| **R3** | ⚠️ **A CSS-module class the stylesheet does not define renders as no class at all.** Found while driving: a five-row map reported **four** roles the moment the first operation staged, because `done` and `failed` styled nothing and so `css['Operation-done']` was `undefined`. The rows were fine and had become *unmeasurable* — a role that vanishes from the DOM when it changes is one no spec, no drive and no later task can see. | **fixed** — all five roles declared, two of them with no declarations and a comment saying why |
| **R4** | ℹ️ **The stop sentence had two authors and one of them never spoke.** *"Stopping keeps everything built so far"* rendered **only when documents were pending**, so a five-component plan offered Stop with no statement of its cost at all. F4's document clause is kept exactly; the count is added; the sentence now exists for every run. | **fixed** — one `stopCost`, specced across every count 0–4 in both halves |
| **R5** | ℹ️ **Cost was not verified by this drive.** The scripted hook returns a fixed `usage`, so `$0.31` is an artefact of the script, not evidence about pricing. AIB-002's `formatCost` is moved verbatim and its `null → "cost unknown"` rule is specced, but the *accumulation* path was not exercised. | **open** — needs a real-provider pass; belongs with BLD-010 |

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
