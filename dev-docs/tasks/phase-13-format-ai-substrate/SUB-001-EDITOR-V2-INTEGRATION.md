# SUB-001: Editor Integration of the v2 Project Format

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-001 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | REV-001, REV-002 (Phase 12) — the format tests must be runnable |
| **Branch** | `task/sub-001-editor-v2-integration` |
| **Recommended executor** | 🟠 **Opus 4.8** — the specs (STRUCT-005/006) exist and the target is clear, but this touches the editor's save/load hot path, project lifecycle, and undo/dirty-state handling. Large surface, high blast radius, sustained care required. Escalate to Fable if the save-path redesign turns out to need architectural decisions the STRUCT specs did not anticipate. |

## Objective

Make the editor natively read and write the decomposed v2 project format in day-to-day operation — implementing lazy component loading (STRUCT-005) and component-level saving (STRUCT-006) — so that projects stop being a single monolithic `project.json`.

## Background

An OpenNoodl project has historically been one large JSON file containing every component, node, and connection in the application. That design blocks several things at once: git diffs are unreadable and merges are painful, large projects load slowly, and — most consequentially for the revival strategy — an AI cannot work on one page without ingesting the entire project.

Phase 10 produced the answer to this: a v2 format that splits a project into per-component files with a registry, along with pure exporter/importer engines and a format detector, all covered by roughly 149 tests. That work (STRUCT-001…004) is genuinely complete and good.

The problem is that **none of it is connected to the application**. A search of the editor source for call sites of the new `io/` classes finds references only from tests. Day-to-day saves still write the monolithic file. The v2 format is, at present, a well-tested library that the product does not use.

This task closes that gap. It is the single highest-leverage piece of work in the revival plan, because every other strategic capability — AI authoring, graph-native diffs, an MCP server, code export — consumes per-component files.

## Current State

- `packages/noodl-editor/src/editor/src/io/ProjectExporter.ts` — pure transform, legacy → v2. File layout declared at the top of the file: `nodegx.project.json`, optional `nodegx.routes.json` / `nodegx.styles.json`, `components/_registry.json`, and per component `components/<Path>/{component,nodes,connections}.json`.
- `packages/noodl-editor/src/editor/src/io/ProjectImporter.ts` — pure transform, v2 → legacy in-memory project.
- `packages/noodl-editor/src/editor/src/io/ProjectFormatDetector.ts` — detects v1 vs v2 by presence scoring of marker files.
- `packages/noodl-editor/src/editor/src/schemas/` — 8 JSON schemas plus an Ajv validator.
- **Zero application call sites.** The `ProjectImporter` referenced from `models/` and `pages/EditorPage/` is the unrelated legacy `@noodl-utils/projectimporter` (module/component import), not the v2 engine.
- The editor's project lifecycle lives in `packages/noodl-editor/src/editor/src/models/projectmodel.ts`, which reads and writes the single-file format.
- Specs for the unbuilt pieces are in `dev-docs/tasks/phase-10-ai-powered-development/README.md`: STRUCT-005 (`ComponentLoader`: on-demand load, LRU cache, ~5 min TTL, ~50-component cap, `preloadComponents`, `invalidate`) and STRUCT-006 (`ComponentSaver`: atomic per-component 3-file write, ~500 ms debounce, incremental registry update, sub-100 ms target).

## Desired State

- Opening a v2 project loads it lazily — the registry and the active component first, others on demand.
- Editing a component and saving writes only that component's files plus an incremental registry update, atomically.
- Opening a legacy v1 project still works unchanged (detection is automatic; conversion is SUB-003's migration wizard, not an implicit rewrite).
- Save latency for a single component change is well under a second on a large project.
- Nothing about the editing experience changes visibly except that it gets faster and the files on disk become readable.

## Scope

### In Scope
- [ ] `ComponentLoader` service per the STRUCT-005 spec (lazy load, LRU cache, invalidation)
- [ ] `ComponentSaver` service per the STRUCT-006 spec (atomic per-component write, debounce, incremental registry)
- [ ] Wire both into `projectmodel.ts` load/save paths behind the format detector
- [ ] Legacy v1 path preserved and unchanged
- [ ] Crash-safety: a partial write must never corrupt a project (write-temp-then-rename, or equivalent)
- [ ] Dirty-state/undo integration: saving one component must not lose unsaved state in another
- [ ] Feature flag to switch v2 read/write on and off during rollout

### Out of Scope
- Migration of existing projects (SUB-003)
- Fixing the known export fidelity gaps (SUB-002 — land that **first or in parallel**, since writing v2 with a lossy exporter would damage real projects)
- Merge/diff behaviour (SUB-007)
- Any AI functionality (Phase 15)

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-editor/src/editor/src/services/ProjectStructure/ComponentLoader.ts` | Lazy, cached component loading (STRUCT-005) |
| `packages/noodl-editor/src/editor/src/services/ProjectStructure/ComponentSaver.ts` | Atomic per-component saving (STRUCT-006) |
| `packages/noodl-editor/src/editor/src/services/ProjectStructure/index.ts` | Service surface used by the project model |
| `packages/noodl-editor/tests/services/ProjectStructure/*.test.ts` | Unit + integration tests |

### Key Files to Modify

| File | Changes |
|------|---------|
| `.../models/projectmodel.ts` | Route load/save through the format detector and the new services |
| `.../io/ProjectExporter.ts`, `ProjectImporter.ts` | Only if integration reveals gaps; keep them pure |

## Implementation Steps

1. **Confirm SUB-002 status.** Do not enable v2 *writing* on real projects until the fidelity gaps (dropped `comments`, `visualRoots`, `lesson`) are fixed, or you will silently destroy user data. Reading is safe to build first.
2. **`ComponentLoader`** — implement against the spec, with the registry as the index and the importer for reconstruction. Cache keyed by component path; explicit invalidation on external file change.
3. **`ComponentSaver`** — atomic three-file write per component plus incremental registry update. Use write-to-temp-then-rename so an interrupted save cannot leave a half-written component.
4. **Wire into `projectmodel.ts`** behind the detector: v2 projects use the new path, v1 projects use the existing one. Put the whole thing behind a feature flag.
5. **Dirty-state and undo.** The editor currently reasons about "the project" as one unit; verify that per-component saving does not confuse the undo stack or the unsaved-changes indicator.
6. **Performance pass** against a large real project: measure open time and single-component save latency; compare with the monolithic baseline.
7. **Crash testing** — kill the process mid-save repeatedly; the project must always reopen cleanly.

## Testing Plan

### Unit
- [ ] Loader returns correct components; cache hit/miss/eviction/TTL behave per spec
- [ ] Saver writes exactly the three files for the edited component plus registry, and nothing else
- [ ] Interrupted save leaves the on-disk project valid

### Integration
- [ ] Open a v2 project, edit several components, save, reopen — state matches exactly
- [ ] Open a v1 project — behaviour unchanged
- [ ] Feature flag off — behaviour identical to today

### Manual
- [ ] Large real project: open, navigate, edit, save; watch for stalls
- [ ] Kill the app mid-save; reopen; confirm no corruption

## Success Criteria

- [ ] Editor opens and saves v2 projects natively in normal use
- [ ] Single-component save writes only that component's files + registry, atomically
- [ ] Legacy v1 projects still open and save exactly as before
- [ ] Save latency meets the STRUCT-006 target (<100 ms typical) on a large project
- [ ] No corruption across repeated mid-save process kills
- [ ] Feature-flagged, with the flag documented

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Writing v2 with the known lossy exporter destroys user data | Hard dependency on SUB-002; reading before writing; never enable write on real projects until fidelity tests pass |
| Lazy loading breaks code that assumes the whole project is in memory | Audit `projectmodel.ts` consumers for whole-project iteration; provide an explicit "load all" for those paths until they are fixed |
| Per-component saves desynchronise the registry | Registry update in the same atomic operation; add a validation pass that detects registry/filesystem drift |
| Undo/dirty-state regressions are subtle and user-visible | Explicit manual test matrix; feature flag allows instant rollback |

## References

- [Viability report — §4.2 (monolithic JSON) and Appendix G](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track A](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/tasks/phase-10-ai-powered-development/README.md` — STRUCT-005/006 specs
- Related: SUB-002 (fidelity), SUB-003 (migration), SUB-007 (diff/merge)

## Checklist

- [x] Confirm SUB-002 landed (done — commit 616280b); work committed to `cline-dev` per repo convention
- [x] Implement `ComponentLoader` per spec + tests (lazy load, TTL/LRU cache, preload, invalidate)
- [x] Implement `ComponentSaver` per spec + tests (two-phase atomic writes, incremental registry, hash-diff change detection)
- [x] Wire into `projectmodel.ts` / `projectmodel.editor.ts` behind detector + feature flag (`formatV2.enabled`, default off)
- [x] Dirty-state/undo integrity (whole project stays in memory → undo stack untouched; save is content-diff, no per-component confusion)
- [x] Crash-safety covered by unit tests (interrupted write leaves prior files intact; mid-save failure rolls back baselines)
- [x] Change log updated ([PROGRESS.md](./PROGRESS.md)); combined io+new suite **270 specs, 0 failures**

**Deferred (documented, not blocking):** true on-demand lazy loading (needs a whole-project-consumer audit — see Risks); performance pass + crash testing on a *large real project* in the running app; wiring `reloadComponentFromDisk` to a live file watcher (collab / SUB-007). The feature flag ships **off**, so none of this is on the default path.
