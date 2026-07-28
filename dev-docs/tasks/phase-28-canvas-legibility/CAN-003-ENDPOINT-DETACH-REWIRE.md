# CAN-003: Detach an Endpoint to Rewire or Delete

## Metadata

| Field | Value |
|-------|-------|
| **ID** | CAN-003 |
| **Phase** | Phase 28 — Canvas Legibility & Authoring Intent (Track M) |
| **Tier** | 2 |
| **Priority** | 🟡 Medium — but it *unblocks* CAN-002 by freeing double-click, and adds rewiring the editor has never had |
| **Difficulty** | 🟡 Medium–High — the only task in the phase that adds an interaction mode; needs live QA on a dense graph |
| **Estimated Time** | 1.5–2 weeks |
| **Prerequisites** | None. Do this **before** CAN-002. |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — replacing a core gesture in a hand-rolled canvas hit-test stack, where the failure mode is muscle-memory destruction rather than a test failure |

## Objective

Let the author grab either end of a wire and drag it: drop it on another node to **rewire**, drop it on
empty canvas to **delete**. Retire the two-click arm-then-confirm delete, and give wires a selection and
a right-click menu so deletion has ordinary routes too.

## Background

### What the delete gesture actually is

Not a double-click handler. The first mouse-**up** on a wire sets `owner.deleteModeConnection = this` and
paints a red dot with an X glyph; a second click *anywhere on the wire's 10px-wide hit stroke* within 3
seconds calls `removeConnection`
([`NodeGraphEditorConnection.ts:185-214`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L185-L214),
marker at [`:469-491`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L469-L491)).

Two consequences worth stating precisely, because both were misremembered (**F55**):
- The X is **never** visible on hover alone. Hover only highlights the wire and may show a health or
  annotation tooltip.
- A double-click deletes as a *side effect* — click 1 arms, click 2 confirms — so double-click is not
  available for anything else while this gesture exists.

There is no right-click path at all: `mouse()` returns on `evt.button !== 0`
([`:145`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L145)),
and no connection context menu exists anywhere (**F54**). There is also no wire *selection* — only
`highlightedConnection` (hover) and `deleteModeConnection` (armed), so nothing exists for a Delete key to
act on (**F58**).

### Why endpoints are the hard part

Wires have no draggable ends (**F56**). A connection drag starts from a **node**:
`startDraggingConnection(fromNode)` clears selection, hides the DOM layer, and stores a synthetic
`mouseTarget` ([`InteractionController.ts:125-146`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/InteractionController.ts#L125-L146)).
On mouse-up over a candidate node it opens the port pickers via `openConnectionPanels()` →
`connectionPopups.open()` ([`:279-323`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/InteractionController.ts#L279-L323),
[`nodegrapheditor.ts:638`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts#L638)).

So the model is *node-to-node, ports resolved afterwards by popup*. The endpoints are only **painted** —
3px dots at `curve[0]` and `curve[3]`
([`NodeGraphEditorConnection.ts:444-451`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L444-L451)) —
with no hit region and nothing in the model that represents "a loose end". That is what this task adds.

The payoff is larger than the delete gesture: **the editor cannot currently rewire a connection at all.**
Changing where a wire lands means deleting it and drawing a new one, re-picking both ports.

## Current State

| Gesture on a wire | Today |
|---|---|
| hover | highlight + tooltip if unhealthy/annotated |
| click | arm delete (red X, 3s timeout) |
| click again | delete |
| double-click | delete (as the two clicks above) |
| right-click | nothing |
| drag an end | nothing — no hit region |
| Delete key | nothing — no selection |

## Desired State

| Gesture on a wire | After |
|---|---|
| hover | highlight + tooltip; **endpoint handles appear** |
| click | **select** the wire |
| double-click | edit its label (CAN-002) |
| right-click | context menu: Delete connection · Edit label |
| drag an end onto a node | **rewire** that end |
| drag an end onto empty canvas | **delete** the connection |
| Delete/Backspace with a wire selected | delete |
| click, then click again | nothing special — the arm-then-confirm gesture is **gone** |

### 1. Endpoint handles

When a wire is highlighted, grow the existing 3px dots into grabbable handles — 4px painted, **8px hit
radius**. Do not add handles to unhighlighted wires: on a dense graph that is a hundred new hit targets
competing with the node cards.

Hit-test in graph coordinates against `curve[0]` and `curve[3]`, which `paint()` has already computed for
this frame. Test endpoints **before** the wire-stroke test, so grabbing an end never arms anything else.

### 2. The rewire drag

A new `reroutingConnection` mode on `InteractionController`, alongside `draggingConnection`:

```ts
reroutingConnection?: {
  connection: NodeGraphEditorConnection;
  end: 'from' | 'to';       // which end is loose
  pos: IVector2;            // where the loose end currently is
  toNode?: NodeGraphEditorNode;  // hover candidate
}
```

- **On grab:** hide the DOM layer and clear highlight, exactly as `startDraggingConnection` does. Do
  **not** mutate the model yet — the connection stays intact and rendered until the drop resolves, so a
  cancelled drag needs no restore.
- **During move:** paint the wire with the loose end following the cursor. Candidate targets come from
  the existing `roots[i].shouldConnect(pos, fixedEndNode)`, the same call the new-connection drag uses,
  which already excludes the origin node and handles border highlighting.
- **On drop over a node:** re-open the port picker through `openConnectionPanels()`, pre-filled with the
  **fixed** end and asking only for the moved end's port. Resolve as *remove old + add new* in a single
  `UndoActionGroup` so one undo restores the original wire. A rewire that resolves to the identical
  endpoints is a no-op and must push nothing.
- **On drop over empty canvas:** `removeConnection(this.model)` with undo. This is the new delete.
- **On Escape mid-drag:** cancel, nothing changes.

`shouldConnect` and the popups both assume "one new connection between two nodes". Reusing them is the
point — a rewire is that same operation with one end pinned. If the popup cannot express a pinned end
without modification, add the parameter to `ConnectionPopups.open()`; do not fork the popup.

### 3. Selection, menu, keyboard

- `selectedConnection` on the editor, set on click, cleared on canvas click or node selection. Painted as
  a slightly heavier stroke — **not** a colour change, because wire colour already encodes type, health,
  pulse and diff annotation, and this would be the fifth meaning on one channel.
- Right-click opens a connection context menu (**F54** — `mouse()` must stop returning early on
  `button !== 0` for the `down` case). Entries: *Delete connection*, *Edit label* (CAN-002; omit until it
  lands).
- Delete/Backspace deletes the selected wire, in the existing key handling.

### 4. Retire arm-then-confirm

Delete `deleteModeConnection`, `clearDeleteModeTimer`, the 3-second timeout, the marker paint block, and
the `deleteMarker`/`deleteMarkerGlyph` theme tokens if nothing else reads them.

**This changes a gesture users have muscle memory for.** The three replacements (drag-to-void,
right-click, select+Delete) must all work before the old one is removed — in one commit, not staged
across two.

## Implementation Steps

1. Endpoint hit-testing + handle painting on highlight. No behaviour change yet; confirm handles appear
   and the wire still arms/deletes as before.
2. Wire selection, the context menu, and the Delete key. Now there are two working delete routes.
3. The `reroutingConnection` drag: grab, follow, cancel. Drop does nothing yet.
4. Drop on empty canvas → delete, undoable.
5. Drop on a node → the pinned-end port picker → remove+add in one undo group.
6. Remove arm-then-confirm and its marker, same commit as nothing-left-depends-on-it.
7. Live pass on a dense real graph: rewire, delete by drag, delete by menu, delete by key, undo each,
   and confirm no gesture fires when the user meant another.

## Success Criteria

1. Hovering a wire shows two handles; dragging either detaches only that end and the other stays pinned.
2. Dropping on a node rewires that end; the wire's other end is untouched; **one** undo restores the
   original.
3. Dropping on empty canvas deletes the wire; one undo restores it with both original ports.
4. Escape mid-drag leaves the graph byte-identical.
5. Right-click offers Delete; select + Delete key deletes; both undoable.
6. Clicking a wire twice in a row does **nothing** destructive.
7. Double-click reaches CAN-002's editor when present, and does nothing when not.
8. A rewire that lands back on the same port pushes no undo entry and dirties nothing.
9. `grep -rn deleteModeConnection packages/noodl-editor/src` returns nothing.
10. Editor suite green (`test:ci`).

## Out of Scope

- Dragging an endpoint onto a *specific port row* to skip the picker. Ports are resolved by popup in this
  codebase; changing that is a much larger change and would fork the connection model.
- Multi-select of wires, or box-selecting wires.
- Reconnecting a wire to a node that is not a valid target — `shouldConnect` decides, unchanged.
- Wire routing changes.

## Traps

- **Hit-test order is the whole task.** Endpoint handles must be tested before the wire stroke, and the
  wire stroke before the canvas. `InteractionController.mouse` propagates to nodes first, then to
  connections only `if (!evt.consumed)`
  ([`:414-424`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/InteractionController.ts#L414-L424)) —
  and an endpoint handle sits *on top of a node's edge*, where the node will consume the event first.
  Expect to special-case endpoint testing ahead of node propagation, and expect that to be the bug that
  eats the most time.
- **`isPointInStroke` leaves `ctx.lineWidth = 10`** after the wire hit-test
  ([`:150-152`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L150-L152))
  and never restores it. Anything drawing after a hit-test inherits it.
- **`disconnect()` nulls `fromNode`/`toNode`/both properties**
  ([`:77-89`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L77-L89)).
  Do not call it to represent a loose end — the drag must keep the connection whole and only *paint*
  differently, or `paint()` will throw on the next frame.
- **`ipcRenderer.send('viewer-hide')` / `'viewer-show'`** bracket the existing connection drag. A rerouting
  drag that forgets `viewer-show` on cancel leaves the preview window hidden with no way back.
- **The DOM layer visibility is a global.** `setDOMLayerVisible(false)` on grab must be paired on *every*
  exit path including Escape, or inspectors and CAN-002's editor stay invisible.
- **Removing a gesture is not covered by tests.** The editor suite will stay green through a change that
  destroys muscle memory. The live pass is the acceptance gate, not the suite.
- **`--target=editor` attaches to the preview window** — use `--target=dashboard`, launch detached, and
  never `cdp reload`.
- **Launching the dev editor rewrites `project-examples/agent-chat/project.json`.** Revert after the live
  pass.
