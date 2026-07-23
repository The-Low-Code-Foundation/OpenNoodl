# PLAT-001 NOTES — Canvas Decomposition Design

Status: design recorded 2026-07-24, before first extraction. This is the deliverable of
Implementation Step 1 (map the file, revise the module shape). Updated as extractions land.

## 1. Inventory of `nodegrapheditor.ts` (3,481 lines at start)

Responsibilities found, with approximate line ranges in the pre-refactor file:

| Range | Responsibility | Destination |
|---|---|---|
| 1–107 | Imports, template/CSS require, shared types (`IVector2`, `PanAndScale`, `AABB`, `CenterToFitMode`) | stays (types move to `canvas/types.ts`) |
| 108–149 | `Selector` class (selection state) | `canvas/NodeSelector.ts` |
| 250–439 | Constructor: EventDispatcher subscriptions (pulse repaint, project switch, ComponentPanel, LogicBuilder), keyboard commands (space, arrow nudge), canvas icon loading, Sidebar listener | coordinator (icons → `canvas/CanvasIcons.ts`) |
| 441–515 | `dispose` / `reset` | coordinator |
| 517–813 | `bindModel`, `bindNodeModel`, `bindDebugInspector`, `bindProjectModel` — model→view sync | coordinator |
| 817–837 | `startNodeAnimations` / `stopNodeAnimations` (rAF loop) | coordinator |
| 839–959 | `render()` — jQuery template bind, canvas bind, 5 deferred overlay mounts | coordinator (mount calls go through `OverlayHost`) |
| 961–1174 | Overlay renderers: canvas tabs, editor banner, highlight overlay, execution overlay, `getNodeBounds`, `setCanvasVisibility` | `canvas/OverlayHost.ts` + coordinator glue |
| 1178–1191 | `resize` | coordinator |
| 1193–1406 | Clipboard: copy/cut/paste/delete, `insertNodeSet` | coordinator |
| 1408–1433 | undo/redo | coordinator |
| 1435–1513 | `bindCanvas` (DPI, jQuery event binding), `getDevicePixelRatio` | coordinator (math → viewport) |
| 1515–1582 | Wheel handling + `updateZoomLevel` | input: `InteractionController`; zoom math: `CanvasViewport` |
| 1584–1705 | `forEachNode`, selection ops, `startDraggingNode(s)`, `startDraggingConnection`, `moveRoots` | interaction state → `InteractionController`; traversal → `HitTester` |
| 1707–1757 | `createNewNode`, `deselect`, `clearSelection` | coordinator |
| 1759–1913 | Title/component trail, `switchToComponent`, navigation | coordinator |
| 1915–2028 | `selectNode`, highlight + debug-inspector management | coordinator |
| 2030–2064 | `isPointInsideNodes`, `multiselectNodes` | `canvas/HitTester.ts` |
| 2070–2222 | Connection popup panels (two ad-hoc React roots) | coordinator, roots via `OverlayHost` |
| 2224–2300 | attach/detach/nudge/snap/`commitMoveNode` | coordinator (model mutation + undo) |
| 2306–2489 | `doDragNodesAndComments`, `doDragging` — drag state machines | `canvas/InteractionController.ts` |
| 2491–2583 | Node toolbar (ad-hoc React roots) | coordinator, roots via `OverlayHost` |
| 2597–2846 | `mouse()` — the input dispatcher (double-click detection, pan, right-click menu, multiselect start) | `canvas/InteractionController.ts` |
| 2848–2931 | Context menu actions | coordinator |
| 2933–2974 | `layoutAndPaint` scheduling (`relayout`/`repaint`) | coordinator |
| 2976–3014 | `calculateAABB` (graph bounds incl. comments) | `canvas/CanvasViewport.ts` |
| 3015–3039 | `findNodeWithId`, `findConnectionWithModel/Key`, `findInspectorWithModel` | `canvas/HitTester.ts` (inspector find stays) |
| 3041–3273 | `paint()` + `paintMultiselectBox` (hierarchy lines, connections, nodes, drag ghosts, connection-drag indicator, multiselect box) | `canvas/CanvasRenderer.ts` |
| 3275–3296 | `verifyWithModel` (test hook) | coordinator |
| 3298–3438 | Viewport math: `centerToFit`, `get/setPanAndScale`, `clampPanAndScale`, `getCenter*PanAndScale`, `calculateNodesAABB` | `canvas/CanvasViewport.ts` |
| 3440–3481 | `nodesetFromSelection`, `extractSelectionToComponent` | coordinator |

## 2. Coupling map (who reaches into the editor)

**Scene items** (`NodeGraphEditorNode`, `NodeGraphEditorConnection`) via `this.owner.*`:
`repaint`, `relayout`, `selector`, `highlighted`/`setHighlightedNode`,
`highlightedConnection`/`setHighlightedConnection`, `deleteModeConnection`,
`clearDeleteModeTimer`, `isHighlighted`, `connections`, `el`, `model`, `readOnly`,
`startDraggingNode`, `startDraggingConnection`, `selectNode`, `removeConnection`,
`addNodeToSelection`, and the icon images (`homeIcon`, `componentIcon`, `warningIcon`,
`aiAssistantInner/OuterIcon`). This set is the internal "owner contract".

**Comment layer** (`commentlayer.ts`): `topLeftCanvasPos`, `setMouseEventsEnabled`,
`selector`, `repaint`, `relayout`, `clearSelection`, `startDraggingNodes`, `spaceKeyDown`,
`relativeCoordsToNodeGraphCords`, `mouse`, `handleMouseWheelEvent`.

**External consumers** (documents, contexts, topbar, Clippy, drag helpers):
`switchToComponent`, `activeComponent`, `on`/`off`, `copy`/`cut`/`paste`/`delete`,
`undo`/`redo`, `latestMousePos`, `navigationHistory`, `getPanAndScale`, `model`,
`runtimeType`, `setReadOnly`, `centerToFit`, `dispose`, `resize`, `createNewNode`,
`highlighted`, `readOnly`, `getNodeBounds`.

Implication: the *public* API is small and stable; the dangerous coupling is the owner
contract used by scene items and the comment layer's reach into input handling. Extractions
must leave every name above working (delegation is fine).

## 3. Final module design

All new modules live in `views/nodegrapheditor/canvas/`. `nodegrapheditor.ts` stays the
single entry point and keeps its exports (`NodeGraphEditor`, `IVector2`, `CenterToFitMode`).

| Module | Owns | Depends on |
|---|---|---|
| `canvas/types.ts` | `PanAndScale`, `AABB`, `IVector2`, `MouseEventType`, shared constants (`SnapSpacing`) | nothing |
| `canvas/NodeSelector.ts` | the `Selector` class, verbatim | `NodeGraphEditorNode` (type only) |
| `canvas/CanvasViewport.ts` | pan/zoom state + math: clamp, zoom-at-point, center-to-fit, canvas↔graph coordinate conversion, graph/nodes AABB computation, device-pixel-ratio | `types.ts` only — **no DOM, no jQuery, no editor back-reference**. Notifies a single `onChanged` callback; the editor syncs comment layer + overlays from it. |
| `canvas/HitTester.ts` | pure spatial queries over roots/connections: `findNodeWithId`, `findConnectionWithModel/Key`, `nodeAtPoint`, `isPointInsideNodes`, `nodesInRect` (multiselect rect collection), multiselect mode resolution (select/union/reduce) | node/connection view types (read-only) |
| `canvas/CanvasIcons.ts` | loading the 5 canvas-painted icon images, repaint-on-load callback | asset requires |
| `canvas/CanvasRenderer.ts` | the per-frame paint: hierarchy lines, connections (incl. highlighted-on-top pass), nodes, drag ghosts, insert-location indicator, connection-drag indicator, multiselect box + shadow | `CanvasViewport` (transform), scene passed per frame as a `FrameState` object |
| `canvas/InteractionController.ts` | input state machines: mouse dispatch, double-click detection, node/comment drag, connection drag, rect multiselect, panning, wheel/zoom routing, space-key pan mode | `CanvasViewport`, `HitTester`, and an `InteractionDelegate` interface implemented by the editor for model mutations (attach/detach/commit-move/undo groups/popups) |
| `canvas/OverlayHost.ts` | one documented mechanism for React roots over the canvas: named slots, create-once/render-many/unmount-on-dispose, the `{ viewport, getNodeBounds }` contract | react-dom/client |
| `nodegrapheditor.ts` | coordinator: model binding, clipboard, undo/redo, component switching/navigation, context menus, inspectors, public API (delegating) | all of the above |

Notes on decisions that differ from the task's starting hypothesis:

- **Scene-item internals stay put.** `NodeGraphEditorNode.ts` (1,290) and
  `NodeGraphEditorConnection.ts` (416) keep their own paint/hit logic — they are already
  separate files under the 800-line ceiling (node view is over 800 but is a single cohesive
  class; splitting it is not required by the success criteria and would multiply risk).
  The owner contract they use is formalised as an interface (`NodeGraphEditorOwner` in
  `canvas/types.ts`) so the coupling is at least explicit and documented.
- **Zoom math lives in the viewport, wheel routing in the controller.** `updateZoomLevel`
  is viewport math (scale clamping against graph AABB); the wheel-mode detection and
  ctrl/trackpad split is input policy.
- **Model mutations stay on the coordinator.** The controller runs the state machines but
  calls back through a narrow delegate for anything that touches `NodeGraphModel`, undo
  groups, popups, or the viewer connection. A wrong seam here would smear undo semantics
  across two files; the delegate keeps mutation in one place.
- **`OverlayHost` also absorbs the ad-hoc roots** (title trail, node toolbar, connection
  popups) — not just the five documented mounts — because they follow the same
  create/render/unmount pattern and two of them had leak-prone manual handling.

## 4. Extraction order & commit plan (strangler-fig)

1. Characterisation tests (`tests/nodegraph/canvas-characterisation.spec.js`) — real
   `NodeGraphEditor` in the Electron Jasmine runner (same harness as
   `tests/nodegraph/nodegrapheditor.js`): viewport math at multiple zooms, clamping,
   zoom-at-point formula, coordinate conversion, AABB, multiselect modes, drag/pan/select
   state transitions via synthetic `mouse()` calls, model commit + undo of drags.
2. `CanvasViewport` — most self-contained; everything depends on it.
3. `HitTester`.
4. `CanvasRenderer` (+ `CanvasIcons`).
5. `InteractionController`.
6. `OverlayHost` — convert mounts one at a time.
7. Public API doc + final slim-down of the coordinator.

One extraction per commit, each leaving the full suite green:
`npm run typecheck:editor` + `npm run test:editor` (Electron suite).

## 5. Verification gates

- Characterisation tests must pass unchanged after every extraction.
- `npm run typecheck:editor` clean (baseline recorded before starting).
- Manual regression matrix (run-editor skill) at the end: create/move/delete nodes,
  draw/delete connections, multi/box select, pan, zoom extremes, comments, all five
  overlays, undo/redo.
- Large-graph pan/zoom smoke on a corpus project before/after.
