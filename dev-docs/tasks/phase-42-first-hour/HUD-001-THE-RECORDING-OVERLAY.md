# HUD-001 — the recording overlay: one control, two states

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md), talked 2026-08-05. ~~Blocked on
[FH-011](FH-011-RECORD-RECORDS-NOTHING.md)~~ — unblocked 2026-08-06 when FH-011 moved the poll
into `TraceSession`.

**Status:** shipped 2026-08-06 — all five slices. Two of this doc's premises were wrong and are
corrected below. **Criterion 5 (the live drive, both themes) is outstanding** — the recipe is at
the foot of this doc.

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
  one React root per named slot, created once, re-rendered on updates. ✅ verified.
- **The template** is `ExecutionOverlay`
  ([ExecutionOverlay.tsx](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx)):
  fixed header outside the transform container, canvas-space content inside it. ✅ verified.
- **The state** is `TraceSession.instance` — a `Model` that emits `recordingChanged`,
  `eventsChanged`, `topologyChanged`, `portValuesChanged`, and (FH-011) `eventsPulled`
  ([TraceSession.ts:136-247](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L136-L247)).
  The overlay is a second consumer of the same singleton; it computes nothing. ✅ verified —
  the line range had drifted by FH-011's edits, the events had not.

⚠️ **The `execution-overlay` slot is already owned.** `OverlayViews.renderExecutionOverlay`
([OverlayViews.ts](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/OverlayViews.ts))
renders into it, and `renderSlot` unmounts the previous root when a slot is re-rendered with a
different element. TALK-003 proposed sharing it; don't. This gets its own layer. ✅ verified.

## Slices

**Slice 1 — the layer.** ✅ Added `recordingOverlayLayer` to `CanvasShell`, in a
`clippingWrapper(..., 'none', '6')` — one above `EXECUTION_OVERLAY_Z` and still below
`.popup-layer`'s 10, so the node picker keeps drawing over the HUD (FH-012's ceiling).
`renderRecordingOverlay()` / `updateRecordingOverlay()` on `OverlayViews`, called from
`nodegrapheditor.render()`, `setPanAndScale` and `setReadOnly` — the same three places as the
execution-overlay twin plus the one the `enabled` prop needs. The layer also joins
`setCanvasVisibility`'s hide list: the Logic Builder takes the whole canvas over, and a Record
pill floating on a Blockly workspace is a control over a surface it has nothing to say about.

**Slice 2 — the component.** ✅ `views/CanvasOverlays/RecordingOverlay/`, subscribed to
`TraceSession` for `recordingChanged` and `eventsChanged`. Idle → pill; recording →
`● recording · 47 events · Stop`, with `session.traceEvents.length` as the live count. Arms via
`session.start()`, stops via `session.stop()` (not awaited — `recording` flips synchronously
inside it, so the control returns to idle on the press rather than after the ≤2s pull).

⚠️ **Correction — "a fixed corner of the canvas" is wrong: there is no free corner.** PAR-003's
AI pill owns bottom-left and its zoom cluster bottom-right
([CanvasHud.module.scss](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/CanvasHud/CanvasHud.module.scss)),
and `ExecutionOverlay` spans the *entire* top edge (header + notice) and the entire bottom edge
(timeline) whenever a workflow run is pinned. The control ships **bottom centre**, on the same
52px baseline as the other two pills — the only position that collides with none of them, and
one that makes the three read as a single HUD row instead of three unrelated widgets.

**Slice 3 — the panel gives up the button.** ✅ The Record button is gone from `ProvenancePanel`'s
toolbar and `handleRecord` with it; Refresh stays (it is the manual pull, and FH-011 makes it
rarely needed rather than useless). The empty state now names the location: *press **Record** on
the canvas — the pill at the bottom of the node graph*.

**Slice 4 — honest arming states.** ✅ All three:

- no preview running → `start()` returns `false` and the HUD says *No preview is running — open
  the app, then press Record*, clearing itself on the next `ViewerRegistered`;
- recording, nothing captured yet → `recording · 0 events` plus *Nothing has fired yet — use the
  app in the preview*, never a placeholder;
- recording, events arriving → the live count.

⚠️ **Correction — `isPreviewRunning` is the wrong check for the pill, even though it is the right
one for Refresh.** It is a derived getter over `NodeLibraryImporter`, not an observable, and this
overlay re-renders only on session events and on pan/zoom — so a pill rendered *disabled because
no preview* would stay disabled after a preview started, and enabled after one closed. `start()`'s
`false` return (FH-011) is the signal that cannot go stale, because it is read at the instant of
the press.

**Slice 5 — a jasmine spec.** ✅ `tests/utils/recordinghud.spec.ts`, over the pure module
`utils/provenance/recordingHud.ts`. **Scoped down, deliberately:** the editor suite is jasmine in
Electron and nothing in it renders React (no `@testing-library`, no `createRoot` anywhere under
`tests/`), so "Stop calls `stop()`" is not assertable here — it is one line, covered by the
typecheck and by the live drive. What *is* asserted is the part that can be silently wrong: the
counter's wording, and the fact that a recording with zero events says so out loud instead of
showing a placeholder.

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
  looks exactly like a HUD that has nothing to show. (This is why slice 4's second line exists:
  the HUD always says *something* while recording, so silence is diagnostic.)

## Live QA — the recipe

Not run: a dev launch rewrites the example project and this checkout is shared. **Run it in both
themes** — the canvas repalettes on `nodegx:themechanged` (UIX-005) and the pill sits on top of
it. And **restart the editor rather than relying on HMR**: this overlay's subscription is a mount
effect in a root that is created once, so a hot update will not re-run it.

1. Open any project. **Do not open the Provenance panel.** The pill reads `● Record` at the
   bottom centre of the canvas, level with the *Ask AI* pill and the zoom cluster.
2. Press **Record** with no preview running → the pill stays on `Record` and a line appears above
   it: *No preview is running — open the app, then press Record.*
3. Start the preview. The line clears by itself (`ViewerRegistered`).
4. Press **Record** → `● recording · 0 events · Stop`, red dot pulsing, and beneath it *Nothing
   has fired yet*.
5. Click something in the preview → within ~1.5s the count climbs and the second line goes away.
6. Pan and zoom → the pill does not move (it is fixed-position, outside the transform container).
7. Press **Stop** → back to `● Record` immediately. *Now* open Provenance: **Recorded
   interactions** is populated (FH-011 slice 1) and there is no Record button in its toolbar.
8. Criterion 3: pin a cloud-workflow execution from the Executions panel while recording. Both
   overlays draw — the execution header at the top, the recording pill at the bottom centre —
   and neither unmounts the other.
9. Criterion 4: with nothing recording, watch the network/profiler during a pan. No timers and no
   relay traffic — idle is one `TraceSession` subscription and a pill, and the pan re-render is
   the cadence the highlight and execution overlays already pay. On a **diff or review** canvas
   the overlay renders `null` outright (`enabled: !editor.readOnly`).
