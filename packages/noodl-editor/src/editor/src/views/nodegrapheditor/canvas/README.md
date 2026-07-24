# Canvas subsystem (PLAT-001)

`nodegrapheditor.ts` is the single entry point and coordinator for the node
graph canvas. The imperative HTML5 Canvas-2D renderer is deliberate (it
outperforms DOM-per-node approaches on large graphs — see
`dev-docs/future-projects/CANVAS-MODERNISATION-PROJECT.md`); these modules
exist so its responsibilities are separated and individually testable.

## Modules

### `canvas/` — rendering, input and viewport (wave 1)

| Module | Responsibility |
|---|---|
| `types.ts` | Shared types (`IVector2`, `PanAndScale`, `AABB`, `Rect`, `CenterToFitMode`) and constants |
| `CanvasViewport.ts` | Pan/zoom state and math: clamping, zoom-at-point, center-to-fit, canvas↔graph conversion, graph AABB. Pure — no DOM, no editor back-reference |
| `HitTester.ts` | Spatial queries over the scene as pure functions: node/connection lookup, point and rect hit-testing, multiselect mode resolution |
| `CanvasRenderer.ts` | Per-frame painting from a `FrameState` snapshot: hierarchy lines, connections, nodes, drag ghosts, connection-drag indicator, multiselect box |
| `CanvasIcons.ts` | The five canvas-painted icon images |
| `NodeSelector.ts` | Raw selection state (which node views are selected) |
| `InteractionController.ts` | Input state machines: mouse dispatch, double-click, node/connection drag, rect multiselect, pan, wheel routing. Owns all interaction state |
| `OverlayHost.ts` | The one mechanism for React roots over the canvas: named slots for long-lived overlays, handles for ephemeral ones, unmount-all on dispose |

### `nodegrapheditor/` — coordinator collaborators (waves 2–3)

Each holds a back-reference to the editor and is reached through the editor's
delegating methods (the public names below stay on `NodeGraphEditor`). Every
model/EventDispatcher subscription these make uses the *editor* as listener
context, so `reset()`/`dispose()` teardown is unchanged.

| Module | Responsibility |
|---|---|
| `ModelBindings.ts` | Model→view sync: `bindModel`, per-node model listeners, debug-inspector creation, project-model listeners |
| `EditorClipboard.ts` | Copy/cut/paste/delete, node-set insertion, extract-to-component (all undo-grouped) |
| `SelectionActions.ts` | Selection policy: click-select, add-to-selection, clear/deselect, rect multiselect, double-click navigation |
| `NodeOperations.ts` | Model mutations from canvas gestures: create, attach/detach, drag-commit with undo, snap/nudge |
| `InspectorActions.ts` | Debug-inspector hover/show timers and the inspector view registry |
| `NodeContextMenu.ts` | Floating node toolbar + right-click context menu |
| `ConnectionPopups.ts` | The two connection port-picker popouts on connection drop |
| `OverlayViews.ts` | The long-lived overlays: canvas tabs, banner, highlight/execution overlays, component-trail title, canvas show/hide |
| `EditorEventBindings.ts` | Editor-wide EventDispatcher/Sidebar/model-library subscriptions and canvas keyboard commands |
| `ViewportActions.ts` | Pan/zoom side effects: every viewport change funnels through here to sync the comment layer and overlays, clamp against graph bounds, and schedule repaints |
| `CanvasPainter.ts` | Layout/paint pipeline: node measuring + positioning, graph AABB, per-frame `FrameState` assembly for `CanvasRenderer`, the node-animation rAF loop |
| `CanvasDOMBindings.ts` | Canvas element setup: device-pixel-ratio sizing and the jQuery mouse/wheel bindings that feed `editor.mouse()` |

Scene item views (`../NodeGraphEditorNode.ts`, `../NodeGraphEditorConnection.ts`)
keep their own local paint and hit logic; they reach the editor through the
owner surface below.

## Public API of `NodeGraphEditor`

What the rest of the editor may use. Everything else is internal, even if
JavaScript lets you reach it.

**Lifecycle & binding** — `render()`, `resize(layout)`, `dispose()`,
`bindModel(model?)`, `setReadOnly(readOnly)`.

**Component switching & navigation** — `switchToComponent(component?, args?)`,
`getActiveComponent()` / `activeComponent`, `navigationHistory`,
`runtimeType`, `model`.

**Viewport** — `getPanAndScale()` / `setPanAndScale(ps)`,
`centerToFit(mode)`, `relativeCoordsToNodeGraphCords(pos)`,
`getNodeBounds(nodeId)`.

**Selection & clipboard** — `getSelectedNodes()`, `selectNode(node)`,
`clearSelection()` / `deselect()`, `copy()` / `cut()` / `paste()` /
`delete()`, `undo()` / `redo()`, `createNewNode(type, pos, options?)`.

**Input forwarding** (used by the comment layer, which shares the canvas
surface) — `mouse(type, pos, evt, args?)`, `handleMouseWheelEvent(event, args?)`,
`setMouseEventsEnabled(enabled)`, `startDraggingNodes(nodes)`,
`isSpaceKeyDown()`, `getLatestMousePos()`, `topLeftCanvasPos`.

Interaction and viewport *state* is not part of the public surface: it lives
on `editor.interaction` (InteractionController) and `editor.viewport`
(CanvasViewport). The wave-1 accessor-compat layer that mirrored those fields
onto the editor was retired in wave 3 — read the owning module directly.

**Events** (via `View`'s `on`/`off`) — `'activeComponentChanged'`,
`'deselect'`, `'readOnlyNodeClicked'`.

## The owner contract (scene items → editor)

`NodeGraphEditorNode` / `NodeGraphEditorConnection` are constructed with
`owner: NodeGraphEditor` and use, beyond the public API: `repaint()`,
`relayout()`, `selector`, `highlighted` / `setHighlightedNode`,
`highlightedConnection` / `setHighlightedConnection`, `deleteModeConnection`,
`clearDeleteModeTimer`, `isHighlighted(node)`, `connections`, `el`,
`readOnly`, `startDraggingNode` / `startDraggingConnection`,
`addNodeToSelection`, `removeConnection`, and the icon images
(`icons.home`, `icons.component`, `icons.warning`, `icons.aiAssistant*`).
Don't grow this list — new needs should go through an explicit method.

## Overlay contract

Overlays that track the canvas viewport (highlight, execution, future diff/AI
overlays) are React components mounted through `OverlayHost.renderSlot` and
re-rendered on every pan/zoom with:

```ts
{
  viewport: { x: number; y: number; zoom: number },
  getNodeBounds: (nodeId: string) => { x; y; width; height } | null
}
```

Screen position of a node: `(node.x + viewport.x) * viewport.zoom`.

Rules (from `dev-docs/reference/LEARNINGS.md`): roots are created once per
slot and re-rendered — never recreated per update — and every root is
unmounted on dispose. `OverlayHost` enforces both; add new overlays through
it rather than calling `createRoot` in the editor.

## Tests

- `tests/nodegraph/canvas-characterisation.spec.js` — full-stack behaviour
  pinned against a real editor instance; must pass unchanged by refactors.
- `tests/canvas/*.test.ts` — unit tests per module.
