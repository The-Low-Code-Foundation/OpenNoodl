# Canvas subsystem (PLAT-001)

`nodegrapheditor.ts` is the single entry point and coordinator for the node
graph canvas. The imperative HTML5 Canvas-2D renderer is deliberate (it
outperforms DOM-per-node approaches on large graphs — see
`dev-docs/future-projects/CANVAS-MODERNISATION-PROJECT.md`); these modules
exist so its responsibilities are separated and individually testable.

## Modules

| Module | Responsibility |
|---|---|
| `types.ts` | Shared types (`IVector2`, `PanAndScale`, `AABB`, `Rect`, `CenterToFitMode`) and constants |
| `CanvasViewport.ts` | Pan/zoom state and math: clamping, zoom-at-point, center-to-fit, canvas↔graph conversion, graph AABB. Pure — no DOM, no editor back-reference |
| `HitTester.ts` | Spatial queries over the scene as pure functions: node/connection lookup, point and rect hit-testing, multiselect mode resolution |
| `CanvasRenderer.ts` | Per-frame painting from a `FrameState` snapshot: hierarchy lines, connections, nodes, drag ghosts, connection-drag indicator, multiselect box |
| `CanvasIcons.ts` | The five canvas-painted icon images |
| `InteractionController.ts` | Input state machines: mouse dispatch, double-click, node/connection drag, rect multiselect, pan, wheel routing. Owns all interaction state |
| `OverlayHost.ts` | The one mechanism for React roots over the canvas: named slots for long-lived overlays, handles for ephemeral ones, unmount-all on dispose |

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
`spaceKeyDown`, `latestMousePos`, `topLeftCanvasPos`.

**Events** (via `View`'s `on`/`off`) — `'activeComponentChanged'`,
`'deselect'`, `'readOnlyNodeClicked'`.

## The owner contract (scene items → editor)

`NodeGraphEditorNode` / `NodeGraphEditorConnection` are constructed with
`owner: NodeGraphEditor` and use, beyond the public API: `repaint()`,
`relayout()`, `selector`, `highlighted` / `setHighlightedNode`,
`highlightedConnection` / `setHighlightedConnection`, `deleteModeConnection`,
`clearDeleteModeTimer`, `isHighlighted(node)`, `connections`, `el`,
`readOnly`, `startDraggingNode` / `startDraggingConnection`,
`addNodeToSelection`, `removeConnection`, and the icon getters
(`homeIcon`, `componentIcon`, `warningIcon`, `aiAssistant*Icon`).
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
