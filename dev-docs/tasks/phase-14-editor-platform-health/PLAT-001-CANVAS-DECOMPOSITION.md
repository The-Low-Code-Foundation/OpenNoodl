# PLAT-001: Canvas Decomposition

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PLAT-001 |
| **Phase** | Phase 14 — Editor Platform Health (Revival Track B) |
| **Priority** | 🟠 High |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 6–8 weeks |
| **Prerequisites** | REV-003 (CI merge gates) |
| **Branch** | `task/plat-001-canvas-decomposition` |
| **Recommended executor** | 🔵 **Fable 5** — decomposing a 3,481-line god object requires deciding the *right* seams in code with thin test coverage, where a wrong boundary is worse than none. The module design is the deliverable; individual extractions are delegable to Opus once the target architecture is agreed. |

## Objective

Break `nodegrapheditor.ts` into modular, individually testable units — in place, preserving the HTML5 canvas rendering approach — so the canvas stops being the file nobody dares change.

## Background

The node graph canvas is the heart of the editor: it renders the graph, handles all direct manipulation, and hosts the overlay UI. It is also a single 3,481-line file that mixes a jQuery-bound DOM shell, canvas drawing, hit-testing, input handling, selection and drag state, and the mounting of five independent React roots.

This has a specific and compounding cost. Every canvas feature — the visualisation views of Phase 4, the AI review overlay planned in Phase 15, the comment layer — must be threaded through this file, and each addition makes the next one harder. The git history contains several candid failure commits from canvas work ("Tried to add data lineage view, implementation failed", "Failed to add connection highlighting"), which is what a god object looks like from the outside: features that should be straightforward turn out not to be, and nobody can say in advance which ones.

There is also an AI-collaboration angle that matters for the revival strategy specifically. A 3,481-line file with implicit coupling is close to the worst case for AI-assisted modification: too large to hold reliably in context, too interconnected to change safely in pieces. Making the canvas tractable for humans makes it tractable for agents, and the roadmap depends on both.

A design for this work already exists — `dev-docs/future-projects/CANVAS-MODERNISATION-PROJECT.md` — and it is explicit that this is **not** a migration to React Flow or any other graph library. That constraint is correct and this task keeps it: the canvas renderer performs well, handles large graphs, and is not the problem. The file's organisation is.

## Current State

`packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`, 3,481 lines, containing at minimum:

- A jQuery-bound view shell built from an HTML template via `bindView`, with `find()`-based access to named sub-containers
- Canvas rendering and hit-testing for nodes, connections, and comments
- Input handling: mouse, keyboard, drag, selection, panning, zooming
- Five independently mounted React roots (canvas tabs, editor banner, highlight overlay, execution overlay, comment layer), each created once and re-rendered
- Coordination with the rest of the editor through `EventDispatcher`
- Debug/inspection hooks (`nodegrapheditor.debuginspectors.js` alongside it)

The React roots are correctly implemented — created once, reused, unmounted on dispose — following the pattern documented in `dev-docs/reference/LEARNINGS.md`. The problem is not correctness; it is that everything lives in one place.

## Architecture review (2026-07-23)

The keep-the-renderer / decompose-the-file decision was re-examined adversarially — against the live code and the full set of downstream demands (Phase 4 visualisation views, AIX-002 live authoring, AIX-003 diff overlay, CF11-007 execution overlay, TASK-000J minimap/Smart Frames) — and it holds. Three findings from that review sharpen this task:

**1. The renderer is the high-ceiling choice; a library swap would cap it.** The canvas is imperative HTML5 Canvas-2D — all nodes/wires painted into one bitmap per frame with viewport culling (`isOutsidePaintArea`), not DOM-per-node. Real corpus projects reach ~2,900 nodes; ReactFlow's DOM-per-node model walls exactly there. The rejection of React Flow for the editing surface is therefore a performance decision, not just an ergonomic one. (React Flow remains the right call for the *shelved read-only Topology Map* — a separate meta-view — see `phase-4-canvas-visualisation-views/VIEW-001-topology-map/SHELVED.md`. Do not conflate the two.)

**2. The model/view seam is already clean — the decomposition risk is the view, not the boundary.** The data model is renderer-agnostic and event-emitting: `models/nodegraphmodel/NodeGraphModel.ts` / `NodeGraphNode.ts` / `NodeGraphNodeSet.ts` and `models/commentsmodel.ts` know nothing about pixels. A renderer attaches at `NodeGraphEditor.bindModel(model)` (`views/nodegrapheditor.ts:517`) and switches graphs at `switchToComponent(component)` (`:1817` → `bindModel(component.graph)`); "components as nested graphs" is literally `ComponentModel.graph` (`models/componentmodel.ts`). React overlays already couple through one small contract — `{ viewport: {x, y, zoom}, getNodeBounds }` (`views/nodegrapheditor.ts:1077-1091`) — which is exactly what `OverlayHost` should formalise. **Implication for this task:** the model boundary is not where the danger is; the danger is the imperative view internals and the ~25 editor subsystems reached through `this` on the view. A useful side effect is that because the model is a legitimate plug-in point, this decomposition preserves the option of ever swapping the renderer later without touching the graph model — decomposition is not lock-in.

**3. Corrected line counts.** The design doc's table predates the file's growth. Actuals as of this review: `nodegrapheditor.ts` **3,481**, `NodeGraphEditorNode.ts` **1,290**, `NodeGraphEditorConnection.ts` **416**; core canvas ≈ **5,900 LOC**.

**Sequencing note:** this task is a prerequisite/enabler for the AI-collaboration differentiators — AIX-002 (live authoring rendered on canvas) and AIX-003 (`views/CanvasOverlays/DiffOverlay/`). Treat it as on the critical path *to* those, not as later cleanup that can trail them. Several features a library would not provide — canvas-painted animated/rotating node icons, the wire "pulse" live-data animation, the debug value inspectors, diff-annotation colouring, and the drag-time connection-compatibility popups — are the primitives those AI features build on, which is a further reason to harden this renderer rather than replace it.

## Desired State

- No file in the canvas subsystem exceeds roughly 800 lines.
- Clear separation between: rendering, hit-testing, input/interaction state, React overlay hosting, and the public API other editor code uses.
- Each unit independently unit-testable, with tests that did not previously exist.
- Behaviour unchanged — this is a structural refactor, and any behavioural difference is a bug.
- Adding a new overlay or interaction becomes a local change rather than a surgical one.

## Scope

### In Scope
- [ ] Extract rendering (node, connection, comment drawing) into dedicated modules
- [ ] Extract hit-testing and spatial queries
- [ ] Extract input/interaction handling and the state machines behind drag, selection, pan, and zoom
- [ ] Extract React overlay hosting into a single documented mechanism rather than five ad-hoc mounts
- [ ] Define and document the canvas's public API for the rest of the editor
- [ ] Add unit tests for each extracted unit as it is extracted
- [ ] Keep the jQuery shell for now if removing it would balloon scope — PLAT-002 handles jQuery removal

### Out of Scope
- Migrating to React Flow or another graph library (explicitly rejected in the existing design doc)
- Changing the rendering approach or visual appearance
- New canvas features (Phase 4 views, Phase 15 AI review) — this task makes them cheaper, it does not deliver them
- Performance optimisation beyond avoiding regressions

## Technical Approach

### Proposed module shape

Treat this as a starting hypothesis to be revised during step 1, not a fixed answer:

| Module | Responsibility |
|---|---|
| `canvas/CanvasRenderer.ts` | Draw nodes, connections, comments to the canvas context |
| `canvas/HitTester.ts` | Spatial queries: what is at this point, what is in this rect |
| `canvas/InteractionController.ts` | Input events → interaction state machine (drag/select/pan/zoom) |
| `canvas/OverlayHost.ts` | One documented mechanism for mounting and disposing React overlay roots |
| `canvas/CanvasViewport.ts` | Pan/zoom transform, coordinate conversion |
| `nodegrapheditor.ts` | Thin coordinator + public API, ideally under 500 lines |

### Method

Use **strangler-fig extraction**: pull one responsibility out at a time behind its existing call sites, keep the old entry points working, and land each extraction as its own reviewable, revertible commit. Do not attempt a big-bang restructure; the file has too little test coverage to survive one.

Characterisation tests come first. Before extracting anything, write tests that capture current behaviour — especially around hit-testing and interaction state, where the semantics are implicit in the code and easy to change by accident.

## Implementation Steps

1. **Map the file.** Produce an inventory of every responsibility, its dependencies, and its consumers. Revise the module shape above against what you find; record the final design in NOTES.md before writing code.
2. **Characterisation tests** for the behaviours most at risk: hit-testing accuracy, drag/selection state transitions, coordinate conversion at various zoom levels.
3. **Extract the viewport/coordinate logic first** — it is the most self-contained and everything else depends on it, so it validates the approach cheaply.
4. **Extract hit-testing**, then **rendering**, then **interaction handling** — in that order, since each depends on the prior.
5. **Unify overlay hosting** into `OverlayHost`, converting the five existing mounts one at a time.
6. **Define the public API** explicitly and update consumers (the comment layer calls into the canvas through public methods today — those calls become the documented surface).
7. **Reduce `nodegrapheditor.ts`** to coordination, and confirm the line-count target.

## Testing Plan

- Characterisation tests written in step 2 must pass unchanged after every extraction.
- New unit tests per extracted module.
- Manual regression on the canvas: create/move/delete nodes, draw and delete connections, multi-select, box-select, pan, zoom at extremes, comments, all five overlays, undo/redo of canvas operations.
- Performance check on a large graph (several hundred nodes) before and after — no regression in pan/zoom smoothness.

## Success Criteria

- [ ] No canvas-subsystem file over ~800 lines; `nodegrapheditor.ts` reduced to a coordinator
- [ ] Rendering, hit-testing, interaction, viewport, and overlay hosting separated
- [ ] Each extracted module has unit tests that did not exist before
- [ ] Characterisation tests pass unchanged; no behavioural difference observable
- [ ] Overlay mounting follows one documented mechanism
- [ ] Public canvas API documented; consumers updated
- [ ] No performance regression on a large graph

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Subtle interaction regressions that tests do not catch | Characterisation tests first; extract one responsibility per commit; thorough manual regression matrix; CI (REV-003) gating every step |
| The chosen seams turn out to be wrong halfway through | Map and design in step 1 before coding; strangler-fig means a wrong seam can be revised without unwinding everything |
| Scope creep into jQuery removal or new features | jQuery shell stays (PLAT-002's job); no new features in this task, explicitly |
| Merge conflicts with parallel canvas work (Phase 4, Phase 15) | Coordinate scheduling — this task should own the canvas while it runs; land extractions frequently to keep branches short-lived |

## References

- [`dev-docs/future-projects/CANVAS-MODERNISATION-PROJECT.md`](../../future-projects/CANVAS-MODERNISATION-PROJECT.md) — the design this implements
- [Viability report — §4.4, Appendix E](../../reviews/NOODL-VIABILITY-REPORT.md)
- `dev-docs/reference/LEARNINGS.md` — React-over-canvas layering and overlay-root rules
- Related: PLAT-002 (jQuery removal), Phase 15 AIX-003 (a future consumer of the overlay mechanism)

## Checklist

- [ ] Branch `task/plat-001-canvas-decomposition`; confirm CI is enforcing gates
- [ ] Map responsibilities; finalise and record the module design
- [ ] Write characterisation tests for at-risk behaviours
- [ ] Extract viewport → hit-testing → rendering → interaction, one commit each
- [ ] Unify overlay hosting; document the public API
- [ ] Full manual regression + large-graph performance check
- [ ] CHANGELOG with before/after line counts; open PR
