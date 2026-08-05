# FH-012 — A pin follows its workflow; the picker beats the pin

Covers reported item **12**.

## What was reported

> When you're in one cloud workflow and you go to the execution history and click an execution of
> a DIFFERENT cloud workflow and click 'Pin', it pins the data on the node canvas but stays in the
> first workflow you had open… Also the pinned overlay has a higher Z value than the node picker.

## Mechanism 1 — the pin captures the wrong identity

POL-009 made pins hide on non-owning canvases, but its slice-2 warning — *"put an identity on the
pin event rather than matching on a display name"* — was not honoured. The shipped guard captures
the identity **at pin time from whatever canvas is open**:

[`ExecutionOverlay.tsx:88`](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx#L88)
— `setPinnedComponentName(NodeGraphContextTmp.nodeGraph?.activeComponent?.fullName ?? null)`.

Pin workflow B's run while A is open ⇒ the pin is tagged as belonging to **A**, renders over A
(where zero steps resolve, so you get the "Nothing to show on this graph" notice), and vanishes
when you open B. Pinned to the wrong canvas, invisible where it belongs.

## What to build (1)

1. **Tag the pin from the execution, not the viewport**: derive the owning component name from
   `execution.workflowId` via `workflowComponentName(workflowId)`
   (`WorkflowComponentModel.ts:25` — produces exactly the `/#__workflow__/<id>` fullName the
   guard compares; POL-009's live pass confirmed the value).
2. **Auto-navigate on pin**: in `ExecutionHistoryPanel.tsx:51-59` (and the `WorkflowsPanel`
   Run-&-pin path), call
   `WorkflowEditorService.instance.open({ backendId: execution.metadata.backendId, id: execution.workflowId, … })`
   before emitting `execution:pinToCanvas` — `isOpen()` is the no-op guard when you're already
   there. `metadata.backendId` is already read for cancel in `ExecutionDetail.tsx:85`.

With both, pinning B's run from inside A takes you to B with the pin showing — which is what the
click meant.

## Mechanism 2 — the overlay outranks the node picker

The pin bars are `z-index: 200` (`ExecutionOverlay.module.scss:40`, `:107`;
`ExecutionTimeline.module.scss:19`); the node picker lives in the PopupLayer at `z-index: 10`
(`popuplayer.css:6-15`). The overlay's chain to `<body>` creates no intervening stacking context,
so 200 beats 10 and the pin bars draw over the picker. (`popuplayer.css:1-4` already says
"TODO: Clean up order of layers".)

## What to build (2)

Give the canvas-overlay layer its own stacking context below the popup layer — one
`isolation: isolate` (or `z-index: 0` + position) on `executionOverlayLayer`'s wrapper
(`CanvasShell.ts:78-99`) contains all three bars' z-indexes inside it; then PopupLayer's 10 wins
at the top level. That fixes the class, not the instance — do **not** bump the popup layer to 201.

## Criteria

1. In A, pin a run of B from Execution History → editor navigates to B, pin visible, step bar
   correct.
2. POL-009's five criteria still hold (hide on navigate away, survive return, unpin everywhere).
3. Run-&-pin from the Workflows panel unchanged (already on the right canvas; `isOpen` no-ops).
4. With a pin showing, open the node picker → picker draws over every pin bar.
5. Verified in the running editor (navigation + stacking are invisible to jasmine).

## Traps

- POL-009's traps still apply: don't read pin state through `__reactFiber$` (alternate-fiber
  staleness) — assert on rendered text; the overlay re-renders on every pan/zoom, keep the
  identity check cheap.
- Opening a component closes the workflow document (known); `WorkflowEditorService.open` is the
  correct reopen path, not tab history.
