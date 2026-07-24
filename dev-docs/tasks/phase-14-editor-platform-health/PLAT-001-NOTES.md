# PLAT-001 NOTES — Canvas Decomposition Design

Status: design recorded 2026-07-24, before first extraction; updated same day as the first
extraction wave landed. This is the deliverable of Implementation Step 1 (map the file,
revise the module shape), plus the as-built record (§6).

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

## 5. Verification gates (as planned)

- Characterisation tests must pass unchanged after every extraction.
- `npm run typecheck:editor` clean (baseline recorded before starting).
- Manual regression matrix (run-editor skill) at the end: create/move/delete nodes,
  draw/delete connections, multi/box select, pan, zoom extremes, comments, all five
  overlays, undo/redo.
- Large-graph pan/zoom smoke on a corpus project before/after.

## 6. As-built record (first extraction wave, 2026-07-24)

Landed on `cline-dev`. All modules live in
`packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/`; the
public API and owner contract are documented in `canvas/README.md`.

Line counts after the wave (from 3,481):

| File | Lines |
|---|---|
| `nodegrapheditor.ts` (coordinator) | 2,681 |
| `canvas/InteractionController.ts` | 568 |
| `canvas/CanvasRenderer.ts` | 269 |
| `canvas/CanvasViewport.ts` | 203 |
| `canvas/HitTester.ts` | 124 |
| `canvas/OverlayHost.ts` | 99 |
| `canvas/CanvasIcons.ts` | 49 |
| `canvas/types.ts` | 41 |

Decisions made while extracting (beyond §3):

- **Accessor-compat layer.** All moved state (pan/zoom on the viewport,
  interaction state on the controller) is still reachable through the original
  field names via get/set accessors on `NodeGraphEditor`. The comment layer,
  the drag helpers, the debug inspectors and the recorded-events tests all
  keep working untouched; the accessors also mark exactly which fields have
  external readers. They can be retired only by migrating those callers.
- **`zoomAtPoint` returns unclamped.** Clamping is guarded on "model has
  roots", and that guard lives with the editor (`clampPanAndScale`), so the
  viewport math returns the raw result and the editor clamps. Keeping the
  guard inside the viewport would have changed behaviour for empty graphs
  (empty AABB = ±MAX_VALUE poisons the clamp).
- **Renderer takes a per-frame `FrameState` snapshot** instead of holding
  references — `bindModel` reassigns `roots`/`connections` wholesale, so any
  retained reference would go stale. Same reason `HitTester` is pure
  functions over arguments.
- **Dispose now unmounts all overlay roots.** Pre-decomposition only 2 of 7
  React roots were unmounted on dispose (highlight overlay, canvas tabs); the
  banner, execution overlay, title-trail and toolbar roots leaked. This is
  the one deliberate behaviour delta of the wave — a resource-leak fix
  mandated by the LEARNINGS overlay rules that OverlayHost now enforces.
- **Commit granularity.** The plan was one commit per extraction; in practice
  the wave landed as two commits (characterisation tests; extraction stack)
  because the extractions were validated together against one full-suite run
  — the 15-minute Electron suite makes per-extraction runs impractical
  locally. CI (REV-003) gates the tree as a whole.

Characterisation-harness findings worth keeping:

- **The full-suite 900s timeouts were the git suite, not the canvas work.**
  Jasmine randomises suite order, so the run died in different-looking places,
  but per-spec breadcrumbs (now emitted by `tests/index.ts` as `[spec-start]`
  lines) showed every hang stuck in `Git local tests` — dugite's embedded git
  resolves to `packages/node_modules/dugite/git` from the test bundle
  (`noodl-git/src/paths.ts` `getGitPath()`: `__dirname/../../node_modules/...`
  with the bundle's `__dirname` = `packages/noodl-editor/tests`), and when the
  binary is missing the git spec blocks the renderer until the runner's
  watchdog kills the run with no results. The suite passed on 2026-07-23
  evening, so the path was resolvable then; the local fix is a symlink
  `packages/node_modules/dugite -> ../node_modules/dugite`. If this recurs on
  other machines, the durable fix belongs in `scripts/run-electron-tests.js`
  (ensure the link) or in `getGitPath()` itself.
- React 19 commits `createRoot().render()` through its own scheduler; tests
  asserting DOM content after a render must poll (see `waitFor` in
  `tests/canvas/OverlayHost.test.ts`) — a single `setTimeout(0)` tick is not
  reliable under a loaded suite.
- `NodeGraphEditor` in the test runner needs `SidebarModel.instance.switchToNode`
  stubbed — node click-selection switches the sidebar to the PropertyEditor
  panel, which is not registered there ("Panel not found").
- The old mock pattern `require('.../ViewerConnection').instance = ...` sets a
  property on the module namespace, not the class static — mock
  `ViewerConnection.instance` (the named export) instead.

## 7. As-built record (second extraction wave, 2026-07-24)

Coordinator slim-down: `nodegrapheditor.ts` **2,681 → 1,274**. Ten modules
extracted, all under `views/nodegrapheditor/` (coordinator collaborators) or
`views/nodegrapheditor/canvas/` (the `Selector` move planned in §3):

| File | Lines | Contents |
|---|---|---|
| `ModelBindings.ts` | 324 | bindModel / bindNodeModel / bindDebugInspector / bindProjectModel |
| `EditorClipboard.ts` | 293 | copy/cut/paste/delete, insertNodeSet, extract-to-component |
| `OverlayViews.ts` | 257 | five long-lived overlay renders + title trail + canvas show/hide |
| `NodeContextMenu.ts` | 216 | node toolbar, context-menu actions, right-click menu |
| `ConnectionPopups.ts` | 175 | the two port-picker popouts |
| `EditorEventBindings.ts` | 152 | constructor EventDispatcher/Sidebar wiring + keyboard commands |
| `SelectionActions.ts` | 145 | selection policy incl. double-click navigation |
| `NodeOperations.ts` | 131 | create/attach/detach/commit-move/nudge/snap/removeConnection |
| `InspectorActions.ts` | 100 | inspector hover timers + registry actions |
| `canvas/NodeSelector.ts` | 52 | the `Selector` class, verbatim (unit-tested) |

Decisions:

- **Listener-context discipline.** Every subscription made inside a module
  passes the *editor* as the listener context. `reset()` (`model.off(this)`)
  and `dispose()` (`off(this)` on the singletons) are unchanged and still
  detach everything. This is the one rule that makes these moves safe;
  binding with module context would silently leak listeners.
- **The editor keeps delegating stubs** for every name with external callers:
  the public API (copy/cut/paste/delete/undo/redo, insertNodeSet,
  switchToComponent, getNodeBounds, bindModel, …), the owner contract used by
  scene items (setHighlightedNode/Connection, isHighlighted, removeConnection,
  addNodeToSelection, …) and the InteractionController surface
  (openConnectionPanels, updateNodeToolbar, hideNodeToolbar, hideInspectors,
  openRightClickMenu, selectNode, commitMoveNode, attach/detachNode, …).
  Verified by grep before extraction; `canvas/README.md` documents the split.
- `import.meta.webpackHot.accept('./createnewnodepanel')` stayed in the
  coordinator constructor — the accept path is resolved relative to the
  calling module, so moving it would change HMR behaviour.
- The `curtop` editor field (written by the popup `topLeft` walker) became a
  local; nothing read it.
- `NodeGraphEditor.clipboard` (the in-memory fallback nodeset) moved into
  `EditorClipboard` as a private field; no external readers (grep-verified).

What keeps the coordinator above the ~800 target (≈1,274 now): the
accessor-compat layer (~215 lines, retirement scheduled below), the delegating
stubs themselves (~180 lines — the documented public surface), `render()` +
`bindCanvas()` + viewport/paint/layout coordination, and `switchToComponent`
(genuine coordination). Getting under 800 is wave-3 work, mostly accessor
retirement.

### Remaining work (next waves)

1. ~~Retire accessor-compat fields~~ — done in wave 3 (§8).
2. **`NodeGraphEditorNode.ts` (1,290)** is still over the ceiling; splitting
   paint from hit/measure inside the node view is the likely seam, but only
   worth it with the characterisation suite green as the gate.
3. Manual regression matrix + large-graph performance check (task Testing
   Plan) before the task is closed.

## 8. As-built record (third wave — accessor retirement + coordinator ≤800, 2026-07-24)

Coordinator: `nodegrapheditor.ts` **1,274 → 790**. Two parts:

**Accessor-compat retirement.** The wave-1 accessors (17 interaction fields,
`panAndScale`/`graphAABB`, 5 icon getters — ~175 lines) are gone. Callers
migrated to the owning module instead:

- Wave-2 modules now read `editor.interaction.*` directly (EditorClipboard
  `latestMousePos`; NodeOperations `dragNodesUndoGroup`; SelectionActions
  `draggingConnection`/`leftButtonIsDoubleClicked`/`lastMultiselected`;
  ConnectionPopups `draggingConnection`).
- True external readers got explicit methods: `commentlayer.ts` →
  `editor.isSpaceKeyDown()`, `EditorDocument.tsx` → `editor.getLatestMousePos()`.
- Scene items read icons as `owner.icons.home` etc. (the `icons` field is the
  contract now, not per-icon getters).
- `canvas-characterisation.spec.js` reads `editor.interaction.*` /
  `editor.viewport.*` — same assertions, new field paths. The unit suites
  (`tests/canvas/*.test.ts`) already targeted the modules directly and needed
  no changes.
- Internal coordinator uses went to `this.interaction.*` / `this.viewport.*`;
  the constructor's `graphAABB` init was dropped (CanvasViewport already
  initialises it) as was `mouseEventsEnabled = true` (controller default).

**Three more collaborators + one move**, same pattern as wave 2 (bodies moved
verbatim, editor keeps delegating stubs for every public/owner-contract name):

| File | Lines | Contents |
|---|---|---|
| `ViewportActions.ts` | 141 | resize, moveRoots, updateZoomLevel, centerToFit family, get/set/clampPanAndScale, calculateNodesAABB — every pan/zoom change funnels through here to sync comment layer + overlays |
| `CanvasPainter.ts` | 122 | layout, calculateAABB, paint (FrameState assembly), node-animation rAF loop; scheduling (relayout/repaint/layoutAndPaint) stays on the editor |
| `CanvasDOMBindings.ts` | 77 | bindCanvas body: DPI sizing + jQuery mouse/wheel bindings (`bindNodeGraphCanvas(editor)`) |
| `ModelBindings.reset()` | — | the editor's `reset()` body (the inverse of bindModel) moved next to bindModel |

Also: `registerRenderEventBindings(editor)` in `EditorEventBindings.ts` took
the six render()-time model/library subscriptions (AiAssistant animation
start/stop, warnings repaint, node-library re-resolve, port add/remove,
module/type-removed switch-away). Same listener-context rule as ever.

What remains in the 790-line coordinator: field/collaborator declarations
(~160), constructor + dispose + render (~120), `switchToComponent` (~95,
genuine coordination), repaint/relayout/layoutAndPaint scheduling,
`verifyWithModel`, undo/redo, and ~65 delegating stubs — the documented
public API + owner contract. Deliberately *not* moved: undo/redo (trivial,
no better home), the scheduling methods (hot path, scene items call them
constantly), `switchToComponent` (touches nav history, comment layer,
highlights, viewport and model binding — it *is* coordination).
