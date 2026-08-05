# HUD-001 — the recording overlay: one control, two states

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md), talked 2026-08-05. **Blocked on
[FH-011](FH-011-RECORD-RECORDS-NOTHING.md)** — a HUD over a recorder that records nothing is a
prettier version of the same defect.

## What this is

Q1 was answered **yes**: Record leaves the Provenance panel and becomes a canvas control. The
product split is *panel = ask questions about wiring; HUD = watch the app run*, and today's
weirdness is that arming a recorder lives inside a question-answering panel.

One component, `RecordingOverlay`, with two states — not two surfaces:

- **idle** — a compact `● Record` pill in a fixed corner of the canvas.
- **recording** — the pill expands into a header bar: `● recording · 47 events · Stop`, plus the
  expand affordance [HUD-003](HUD-003-EXPAND-TO-THE-WALK.md) fills.

A separate always-there pill *plus* a recording header would be two controls for one switch, and
the state a user is trying to read is exactly "is it on?".

## The machinery, confirmed

- **The slot mechanism** is `OverlayHost.renderSlot(slot, element, node)`
  ([OverlayHost.ts:38-57](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/OverlayHost.ts#L38-L57)) —
  one React root per named slot, created once, re-rendered on updates.
- **The template** is `ExecutionOverlay`
  ([ExecutionOverlay.tsx](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx)):
  fixed header outside the transform container, canvas-space content inside it.
- **The state** is `TraceSession.instance` — a `Model` that already emits `recordingChanged`,
  `eventsChanged`, `topologyChanged`, `portValuesChanged`
  ([TraceSession.ts:190-203](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L190-L203)).
  The overlay is a second consumer of the same singleton; it computes nothing.

⚠️ **The `execution-overlay` slot is already owned.** `OverlayViews.renderExecutionOverlay`
([OverlayViews.ts:163-181](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/OverlayViews.ts#L163-L181))
renders into it, and `renderSlot` unmounts the previous root when a slot is re-rendered with a
different element. TALK-003 proposed sharing it; don't. This gets its own layer.

## Slices

**Slice 1 — the layer.** Add `recordingOverlayLayer` to `CanvasShell`
([CanvasShell.ts:78-102](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/CanvasShell.ts#L78-L102)),
appended in a `clippingWrapper(..., 'none')` like the other two, above `executionOverlayLayer` in
paint order. Add `renderRecordingOverlay()` / `updateRecordingOverlay()` to `OverlayViews`, called
from the same places as their execution-overlay twins so the viewport prop stays current on pan
and zoom.

**Slice 2 — the component.** `views/CanvasOverlays/RecordingOverlay/`, subscribed to
`TraceSession` for `recordingChanged` and `eventsChanged`. Idle → pill; recording → header with
`session.traceEvents.length` as a live count and a Stop button calling `session.stop()`. Arm via
`session.start()`.

**Slice 3 — the panel gives up the button.** Remove the Record button from
`ProvenancePanel`'s toolbar ([ProvenancePanel.tsx:312-317](../../../packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.tsx#L312-L317)).
Refresh stays (it is the manual pull, and FH-011 makes it rarely needed rather than useless). The
panel's empty state still says *press Record* — it must now say **where** Record is, because a
user reading that sentence inside the panel will look for a button that is no longer there.

**Slice 4 — honest arming states.** The header must distinguish three things FH-011 also touches:

- no preview running → the pill says so and does not arm (`session.isPreviewRunning` is already
  the check the Refresh button uses, [ProvenancePanel.tsx:322](../../../packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.tsx#L322));
- recording, nothing captured yet → `recording · 0 events`, never a placeholder;
- recording, events arriving → the live count.

**Slice 5 — a jasmine spec** over the state mapping: session recording ⇄ overlay state, count
follows `traceEvents`, Stop calls `stop()`. (Editor specs are jasmine, not jest.)

## Criteria

1. With the Provenance panel never opened, pressing Record on the canvas arms the runtime and the
   header counts events as they arrive.
2. Stop returns the overlay to the idle pill; the panel's "Recorded interactions" list is
   populated (FH-011's slice 1).
3. Pinning a cloud-workflow execution and recording at the same time renders both overlays; the
   execution overlay is not unmounted.
4. Idle costs nothing: no poll, no subscription churn, no repaint on pan/zoom beyond the existing
   overlay cadence.
5. Verified in the running editor, both themes.

## Traps

- **The Provenance panel is not mounted until it is first opened** —
  [SidePanel.tsx:57-68](../../../packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx#L57-L68)
  constructs the component on first `switch`, so "hidden but mounted" does not apply to a panel
  nobody has opened. Anything this HUD needs must live in `TraceSession`, not in the panel. That
  is why FH-011's poll moves (see that task's amended slice 2).
- HMR will not re-run effects in a mounted overlay root — restart the editor before concluding a
  subscription does not fire.
- `renderSlot` warns and no-ops when the container is missing; a HUD that silently fails to mount
  looks exactly like a HUD that has nothing to show.
