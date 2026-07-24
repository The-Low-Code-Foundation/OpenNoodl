# LIB-005: Import Experience Overhaul

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LIB-005 |
| **Phase** | Phase 21 — Library & Import Overhaul |
| **Priority** | 🟠 High |
| **Difficulty** | 🔴 Hard (the design problem, not the plumbing — LIB-004 does the plumbing) |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | LIB-004 (`analyze`/`plan`/`apply` API); AIX-003's accept components as reference/reuse |
| **Recommended executor** | 🔵 **Fable 5** — a genuine interaction-design problem over a new API, composing prior art (AIX-003 closure-accept, SUB-007 diff views, noodl-preview thumbnails) into something coherent. |

## Objective

Replace the tick-every-checkbox-and-hope dialog with an import flow where you can see what you're taking, understand what it drags along, resolve each conflict deliberately, and read afterwards exactly what changed.

## Background

Today's `ImportPopup` ([importpopup.ts](../../../packages/noodl-editor/src/editor/src/views/importpopup.ts) + [ImportPopupView.tsx](../../../packages/noodl-editor/src/editor/src/views/importpopup/ImportPopupView.tsx)) presents six flat sections (components, resources, modules, variants, color styles, text styles) as a folder tree of checkboxes. Dependencies get auto-ticked with a subtly different check style and no explanation. There is no search, no preview, no sense of scale, and the collision pass is a second identical popup where "overwrite" means "replace the whole component with no view of the delta". The same popup serves import, collision, and export — three jobs, one blunt instrument.

The ingredients for something much better already shipped: AIX-003 made dependency-closure selection *unrepresentable-invalid* (you cannot accept a subset that doesn't stand alone) on the diff canvas; SUB-007 diffs say precisely what an overwrite changes; `noodl-preview` (SUB-009) renders components headlessly for thumbnails. This task composes them behind LIB-004's `ImportPlan`.

## Current State

- One popup class, three variants, `TSFixme`-typed state, hosting a React root inside legacy popup plumbing.
- After LIB-004, it runs on a thin adapter over the new engine — functional, unchanged in experience.
- Export (Cmd+Shift+E) uses the same popup in reverse.

## Desired State

A new import surface (modal or side panel — decide in-task against how NodePicker hosts it) with:

- **Browse & select:** searchable, filterable component list honoring folder structure (LIB-002's hygiene pays off here), with headless-rendered thumbnails for visual components where cheap. Selection works at folder and item level as today, but the *dependency closure is first-class*: selecting a component shows what it pulls in and why ("uses `Button`", "reads `icons/arrow.svg`", "colors: `Primary`"), in AIX-003's manner — the closure travels with the selection, and an invalid partial selection cannot be expressed. Heuristic-confidence edges (LIB-004's `inferred` flag) are visually distinct and individually droppable.
- **Understand the impact before committing:** the plan stage renders as a summary — N new components into these folders, M files, styles added vs. colliding, modules. Collisions are inline, per item, with three explicit resolutions: **skip / overwrite / rename**. Overwrite shows the SUB-007 diff (node-level: what changes in *your* version); rename proposes a non-colliding name. No second popup; resolution happens where the item is listed. Prefab installs stop silently dropping colliding styles — the drop becomes a visible "kept yours" resolution.
- **Commit & review:** apply with progress; then a result summary (what landed where, renames applied, files written) with the whole model change as **one undo step**, stated in the summary ("Undo removes the imported components; files on disk remain").
- **All entry points converge:** import-from-project, import-from-URL, and prefab/module install with collisions all use this surface (prefab/module installs with *no* collisions stay one-click, as today). Export gets the same selection component with an export-appropriate frame — dependency closure matters identically there.

## Scope

### In Scope
- [ ] The new surface + selection model over `ImportPlan`, including closure visualization and confidence-flagged edges
- [ ] Inline collision resolution (skip/overwrite/rename) with SUB-007 diff display for overwrites — reuse GraphDiffPanel/AIX-003 rendering components, don't rebuild
- [ ] Thumbnails via `noodl-preview` where renderable; graceful icon fallback where not (headless render of arbitrary corpus components has known incompatibilities — treat failures as fallback, never blockers)
- [ ] Result summary + one-undo-step behavior surfaced honestly
- [ ] Migration of all entry points; export reframed on the shared selection component
- [ ] Delete `importpopup.ts` / `ImportPopupView.tsx` and the LIB-004 adapter when the last caller moves
- [ ] Live UI smoke in a clean session: import between two real projects, a prefab collision, a URL import, an export

### Out of Scope
- Three-way merge of an imported component with local edits (plan API leaves room; not this sprint)
- Import *sources* beyond today's (no GitHub URLs, no registry browsing — ECO-002)
- Canvas placement of imported components ("drop at cursor") — tempting, separate
- NodePicker's Prefabs/Modules browsing tabs themselves (they stay; only their collision path changes)

## Implementation Steps

1. Design pass first: one written interaction spec (states, empty/edge cases, where each entry point lands) reviewed against the three prior-art components before code.
2. Selection model + closure UI over `analyze`/`plan`, behind a feature flag, import-from-project path first.
3. Collision resolution inline, diff view wired to SUB-007 output.
4. Thumbnails + fallbacks; result summary + undo verification.
5. Migrate remaining entry points; export reframe.
6. Clean-session live smoke (the AIX-003 residual taught this: ship the smoke, not just the build); delete the old popup.

## Success Criteria

- [ ] A fresh user can import a component and correctly predict, before applying, everything that will enter their project — closure, files, styles, collisions
- [ ] Overwrite is never chosen blind: the node-level diff is one interaction away at the point of decision
- [ ] Rename resolution produces a working import, reflected in the summary
- [ ] Prefab style collisions are visible resolutions, not silent drops
- [ ] One undo step reverts the model changes of any import, and the summary says so
- [ ] All entry points live-verified in a clean session; old popup deleted
- [ ] Selection with an unsatisfied dependency is unrepresentable, not merely warned about

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Scope balloons into a redesign of NodePicker | The surface is the import flow only; NodePicker hosts an entry point, nothing more |
| Thumbnail rendering slow or crashy on odd components | Async, cached, fallback-first; a thumbnail is decoration, never a gate |
| Diff view overwhelms non-technical users | Summary line first ("changes 4 nodes, removes 1 connection"), full diff behind it — AIX-003's before/after framing already solved this register |
| Export reframe breaks a muscle-memory flow | Keep Cmd+Shift+E and the zip output identical; only the selection surface changes |
| Feature-flag limbo | The flag exists only within this task's lifetime; the task isn't done until the old popup is deleted |

## References

- [README.md](./README.md) — current popup anatomy with file:line references
- LIB-004 — the `ImportPlan` contract this UI renders
- AIX-003 (phase 15) — dependency-closure accept, before/after views; its clean-session-smoke residual is this task's cautionary tale
- SUB-007 `GraphDiffPanel`, SUB-009 `noodl-preview`
