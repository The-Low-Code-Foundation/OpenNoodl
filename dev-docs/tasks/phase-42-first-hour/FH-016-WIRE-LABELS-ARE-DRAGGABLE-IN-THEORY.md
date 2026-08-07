# FH-016 — Wire labels are draggable, behind an interaction nobody can find

Covers reported item **17**.

## What was reported

> I thought we made it possible to move the custom labels on node connectors, but right now I
> can't click drag them and I can't see any other way to move them.

## Status — built, shipped, and gated behind the wire-stroke hover

CAN-001 (phase 28) built the whole path: label chip painting with a bounds cache
(`NodeGraphEditorConnection.ts:437-480`), `isPointInLabel` hit test (`:482-488`), drag via
`InteractionController.startDraggingWireLabel` (`:230-238`, `:371-395`), `labelT` clamped to
[0.15, 0.85], one undo entry, persisted end to end (exporter/importer/snapshots/merge). The
gesture that works **today**: hover the *wire itself* until the chip appears, keep the pointer
within ±5 graph units of the stroke, press on the chip *while still over the stroke*, drag.

## Why it feels unbuilt — the spec's own trap, shipped

CAN-001's spec warned (`CAN-001-CONNECTOR-LABELS.md:202-206`): *"Chip hit-testing must sit
**before** the existing wire hit-test in the move/down paths… the single most likely way to ship
an infuriating regression."* That ordering was not honoured:

1. The mousedown branch is gated on `highlightedConnection`
   ([`NodeGraphEditorConnection.ts:278`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L278)),
   which is only ever set by the **stroke** hit test (`:239-241`, `isPointInStroke` at ±5 units).
   The move path never consults `isPointInLabel`. So the grabbable area is the *intersection* of
   the chip and the stroke band — for a 2-3-line label, the middle ~26%; the chip's wide ends on
   any sloped wire are dead. Moving up onto the chip and off the stroke actively *clears* the
   highlight (`:271-274`), making the chip vanish under the cursor.
2. Chips made visible by **node selection/hover** (`isHighlighted()`, `:182-190`) or by the
   always-on setting are completely inert — visible label, zero interactivity.
3. Zero affordance: no cursor change (cursor is only set for panning), no tooltip, and the wire's
   context menu (`NodeContextMenu.ts:328-361`) has Add/Edit label but nothing about position.
4. `tests/canvas/WireLabels.test.ts` covers visibility/clamp/undo but has **no drag or hit-region
   test** — nothing could have caught this.

## What to build

1. In the `move` path, check `isPointInLabel` independently of the stroke test: point in
   `labelBounds` → set `highlightedConnection` + `grab` cursor.
2. Hoist the `isPointInLabel` check above the stroke gate in the `down` path: a press on a
   *painted* chip is honoured, however the chip became visible.
3. Cursor affordance: `grab`/`grabbing` over a chip.
4. Add the missing drag test (hit region for a wide chip on a sloped wire; drag from a
   selection-lit chip).

## Criteria

1. Select a node → attached wires' chips light → click-drag any chip works immediately.
2. Drag from the far end of a wide chip on a diagonal wire works.
3. Cursor shows grab over a chip, grabbing during drag.
4. `labelT` still clamps, still one undo entry, still survives save/reload.
5. Wire hover inspector popup (200ms debug inspector) doesn't eat the press — check the overlap
   the research flagged (`InspectorActions.ts:44-69` positions it ~2-3 units above the chip).
6. Verified in the running editor.
