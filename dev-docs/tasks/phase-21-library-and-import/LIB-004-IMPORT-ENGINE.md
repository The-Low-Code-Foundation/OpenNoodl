# LIB-004: Import Engine v2

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LIB-004 |
| **Phase** | Phase 21 — Library & Import Overhaul |
| **Priority** | 🟠 High (Sprint B keystone; LIB-005 builds on its API) |
| **Difficulty** | 🔴 Hard (five call sites, live-model mutation, no existing tests worth the name) |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | None hard; LIB-001's `type` field is nice-to-have. Step 0 ships immediately. |
| **Recommended executor** | 🟠 **Opus 4.8** — a disciplined strangler-pattern replacement with a clear target design; the novel UX sits in LIB-005, not here. |

## Objective

Replace `projectimporter.js` with a typed engine that separates **planning** from **applying**: callers get a dry-run `ImportPlan` (what will be added, what collides, what each overwrite would actually change, what dependencies pulled what in), choose per-item policies (overwrite / skip / rename), and only then apply — atomically with respect to the live project model. All five flows (import-from-project, import-from-URL, prefab install, module install, component export) move onto it.

## Background

The current engine ([projectimporter.js](../../../packages/noodl-editor/src/editor/src/utils/projectimporter.js), 503 lines, untyped, singleton) dates from upstream Noodl:

- **Dependency detection is string matching** — any string parameter equal to a file path or style name counts (lines 30–51, 83–107); component deps are only caught for slash-prefixed type names.
- **Collisions are name matches with two outcomes** — overwrite the whole item or skip it. No rename, no merge, no preview of the delta.
- **It mutates its inputs** — the source project model gets components removed from it mid-import; `filterImports` mutates the caller's arrays.
- **Overwrite reuses the existing component's id** (lines 391–398) while all other ids are re-keyed — behavior LIB-005's UX must preserve (references keep working) but which nothing documents or tests.
- **The import-from-URL collision popup is a no-op** — [EditorPage.tsx:353–363](../../../packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx) never applies `getUnselectedImports()`, so unticking doesn't prevent overwrites.
- **No v2-format awareness** — source projects load through legacy `projectFromDirectory`; whether a multi-file-format source imports rests entirely on that loader.

Meanwhile SUB-007's engine (`src/editor/src/versioning/`) already diffs and merges exactly these component shapes (`fromLegacyComponent` converters included) and is production-proven as the git merge driver. The import engine should *consume* it for overwrite deltas — not reimplement diffing.

Naming trap: `src/editor/src/io/ProjectImporter.ts` is STRUCT-003's v2→legacy format converter, unrelated despite the name. The new engine needs a name that collides with neither (`ProjectImportEngine` / `src/editor/src/utils/import-engine/`).

## Current State

See Background; additionally — export (`exportProjectComponets.ts`, filename typo included) runs the same pipeline in reverse into an empty project and crashes on an empty export dir (lines 36–41); `checkForCollisions` failure vs. collisions is distinguished by duck-typed `.message`; `ImportPopup` state and engine coupling is `TSFixme` throughout.

## Desired State

A typed module with a three-stage API, no singletons, no input mutation:

1. **`analyze(sourceDir) → SourceInventory`** — components, resources, modules, styles, variants, plus a real dependency graph. Dependency edges from actual node/parameter semantics where knowable (component references from node types; file/style references from parameters whose **port type** says filepath/color/textstyle — the catalog and node registry know this), with the string-matching heuristic retained as a flagged fallback edge type (`confidence: 'inferred'`) rather than deleted.
2. **`plan(inventory, selection, targetProject) → ImportPlan`** — pure; resolves the dependency closure of the selection, detects collisions, and for each colliding component computes a SUB-007 `GraphDiff` against the target's version. Each planned item carries a policy: `add | overwrite | skip | rename(newName)`. Rename re-points references *within the imported set*.
3. **`apply(plan, targetProject) → ImportResult`** — performs the plan inside one undo group for model changes; id re-keying and overwrite-id-reuse semantics preserved and **tested**; file/module copies reported in the result (with the honest note that disk writes aren't undoable); viewer watch suspension and `importComplete`/`viewer-refresh` events as today.

All five call sites migrated. Old `projectimporter.js` deleted (the projectmerger precedent: replaced means removed). Export path moved onto `analyze`/`plan` with the empty-dir crash fixed and the filename spelled correctly.

## Scope

### In Scope
- [ ] **Step 0 (anytime fix, before any refactor):** apply `filterImports` correctly in the EditorPage URL path — three lines, ship immediately
- [ ] The three-stage engine, typed end to end, with unit tests per stage (test fixtures exist: `tests/testfs/import_proj5/`, `big-merge-test-mine/`)
- [ ] SUB-007 integration for overwrite diffs
- [ ] Port-type-driven dependency detection with flagged heuristic fallback
- [ ] Rename policy incl. reference re-pointing in the imported set
- [ ] Migration of all five call sites; `ImportPopup` kept working on a thin adapter until LIB-005 replaces it
- [ ] v2-format source handling: route source loading through the format-aware loader; a v2-format fixture in the tests
- [ ] Undo group for model changes; `ImportResult` reporting
- [ ] Delete `projectimporter.js`; fix + rename the export util

### Out of Scope
- Any new UI — LIB-005 (the adapter keeps today's popups alive meanwhile)
- Node-level *merge* on import (plan/diff yes; three-way merging an imported component with local edits is a later ambition — the plan API leaves room)
- Changing prefab silent-drop policy unilaterally — the plan makes it *visible* (skip policies on colliding styles); LIB-005 decides presentation
- Library content or delivery (Sprint A)

## Implementation Steps

1. Step 0; ship.
2. Characterization tests around the current engine using the existing fixtures — pin id-rekeying, overwrite-id-reuse, style merge, variant delete-then-add, resource copy behavior before touching anything.
3. Build `analyze` (new dependency detection alongside a port of the old inventory walk); diff its output against the old `listComponentsAndDependencies` on the fixtures.
4. Build `plan` (pure; SUB-007 diffs; policies; closure via the dependency graph).
5. Build `apply` against the characterization suite; undo group; events.
6. Migrate call sites one at a time (module install → prefab install → import-from-project → import-from-URL → export), verifying each live.
7. Delete the old engine; sweep for stragglers.

## Success Criteria

- [ ] Unticking in the URL-path collision dialog actually prevents the overwrite (step 0, verified live)
- [ ] Characterization behaviors preserved: overwrite reuses target component id; other ids re-keyed; references in imported components resolve post-import
- [ ] `plan` on a colliding component yields a SUB-007 diff naming the nodes that would change
- [ ] Rename policy produces a working import with re-pointed internal references
- [ ] A v2-format source project imports correctly (fixture-backed)
- [ ] All five flows verified live on the new engine; `projectimporter.js` deleted
- [ ] Import applies as one undo step for model changes; `ImportResult` lists file writes separately

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Hidden behaviors in the old engine break callers | Characterization tests first (step 2) — the suite is the contract, not the old code |
| Port-type dependency detection misses what string matching caught | Fallback heuristic edges retained and flagged; `analyze` diffed against old output on fixtures before cutover |
| SUB-007 shapes don't cover something import moves (variants, styles metadata) | Diff components via SUB-007; diff styles/variants as plain structured compare — don't force everything through GraphDiff |
| Five-call-site migration stalls half-done | Strangler adapter means old UI works on the new engine from step 6's first migration; no long-lived broken state |
| Undo group interacts badly with viewer-watch suspension | Same sequencing as today (suspend → apply → resume → refresh); the characterization pass pins event order |

## References

- [README.md](./README.md) — pipeline map with file:line references
- SUB-007: `src/editor/src/versioning/` + [design doc](../phase-13-format-ai-substrate/SUB-007-DESIGN.md); the projectmerger deletion precedent
- SUB-004 catalog — port types for dependency detection
- Fixtures: `packages/noodl-editor/tests/testfs/import_proj5/`, `big-merge-test-mine/`
