# LIB-001: Library Source of Truth & Delivery Pipeline

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LIB-001 |
| **Phase** | Phase 21 — Library & Import Overhaul |
| **Priority** | 🟠 High (first task; LIB-002/003 publish through it) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 4–6 days |
| **Prerequisites** | None |
| **Recommended executor** | 🟢 **Sonnet 5** — build tooling and plumbing along paths the code already implies; the one judgment call (hosting) has a recommended answer below. |

## Objective

Give the prefab/module library a version-controlled source of truth with a build step, so content is authored as real project directories (reviewable, diffable, testable) instead of hand-maintained zips on a docs site — and fix the editor-side delivery defects (stale cache, silent failure) that make even good content unreliable.

## Background

Today the library exists only as artifacts: `index.json` files and full-project zips hosted on the docs GitHub Pages site (`the-low-code-foundation.github.io/opennoodl-docs/library/…`). There is no source form anywhere — no way to diff a prefab change, no validation before publish, and no coupling to editor/runtime versions. The editor fetches the index at launch ([modulelibrarymodel.ts:56–66](../../../packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts)) and silently shows empty tabs on failure. Downloaded zips are cached per-URL in `<userData>/library/` and **never re-downloaded once the folder is non-empty** (`getModuleTemplateRoot`, lines 190–234) — republishing a fixed prefab at the same URL does nothing for existing users.

The phase-3 COMP-001/002 planning docs proposed a multi-source `PrefabSource` abstraction and bundled built-in prefabs; neither was built. This task delivers the useful core of both with less machinery.

## Current State

- Library index: `IModule { label, desc, project, icon, docs, tags }` (modulelibrarymodel.ts:15–22); `project`/`icon` resolved relative to the docs endpoint unless absolute (ModuleCard.tsx:40,71).
- Prefab-vs-module distinction is a `/prefab` substring check on the zip URL (ModuleCard.tsx:35).
- Dev mode: `useLocalDocs` global points the endpoint at `localhost:3000` ([main.js:140–171](../../../packages/noodl-editor/src/main/main.js)); `userconfig-dev.js` references an `external/library/` directory that does not exist.
- An orphaned `ModuleLibraryContext` (duplicate `IModule` shape, zero consumers) sits in `src/editor/src/contexts/ModuleLibraryContext/`.

## Desired State

- `library/` at the monorepo root: each prefab/module is an **unpacked project directory** plus a `library.json` metadata file (label, description, tags, icon source, version, `minEditorVersion`, `runtimeVersion` compatibility).
- `npm run library:build` produces a `library-dist/` tree: `index.json` per type + one zip per entry, zip filenames carrying the content version (`date-picker-2.0.0.zip`) so URLs change when content changes — which makes the existing forever-cache *correct* instead of a trap.
- `npm run library:check` validates every entry: project loads, semantic validator (SUB-006) error-clean, metadata schema valid. Wired into CI.
- Publishing = copying `library-dist/` into the docs repo's `library/` path (a documented manual step or a small sync script; the editor-side endpoint does not change).
- Editor: library tabs show a visible offline/error state instead of silently empty; index schema tolerates the new fields; entries incompatible with the current editor/runtime version render as such rather than failing on install.
- Dev loop: `library:build` output servable at the existing `localhost:3000` dev-docs path so content authors can point a dev editor at local content.
- Orphaned `ModuleLibraryContext` deleted; the `/prefab` substring check replaced by an explicit `type` field in the index (with the substring check kept as fallback for the transition).

## Scope

### In Scope
- [x] **Step 0 (anytime fix):** loud fetch-failure state in the Prefabs/Modules tabs
- [x] Decide and record the hosting layout (see decision note), then scaffold `library/`
- [x] Build + check scripts; CI wiring for `library:check`
- [x] Versioned zip naming; index schema extension (`type`, `version`, compatibility fields)
- [x] Editor-side: schema tolerance, compatibility rendering, explicit `type` field use
- [x] Seed the tree by importing the **current live content** (download today's zips, unpack into `library/`, commit as-is) so LIB-002/003 start from tracked sources
- [x] Delete the orphaned context; document the publish step in `library/README.md`

### Out of Scope
- Fixing or restyling any actual content — LIB-002/003
- Bundling a starter set into the editor binary (worth doing eventually; record as a follow-up, don't build now)
- Multi-source registries, user-added sources — ECO-002 territory
- Changing the docs endpoint or the `useLocalDocs` mechanism

### Decision note: where the source lives

Recommendation: **this monorepo** (`library/` at root), publishing artifacts to the docs repo. Reasons: the agents and CI that will maintain content work here; `library:check` needs the editor's validator and project loader, which live here; and content fixes ride the same review flow as code. The docs repo remains a dumb CDN. The alternatives (source in the docs repo, or a third repo) both split content from the tooling that validates it. Record the decision and its date in PROGRESS.md; if Richard prefers a separate content repo, only the publish step changes.

## Implementation Steps

1. Step 0 fix; ship it independently.
2. Record the hosting decision; scaffold `library/prefabs/`, `library/modules/`, metadata schema, `library/README.md`.
3. Download and unpack the live library into the tree (provenance note per entry: source URL + date).
4. Write `library:build` (zip + index generation, versioned names) and `library:check` (load + SUB-006 + schema); wire CI.
5. Editor-side index/schema work; compatibility rendering; delete the orphan.
6. Verify end to end: point a dev editor at a locally served `library-dist/`, install one prefab and one module into a fresh project.

## Success Criteria

- [x] Every live library entry exists as tracked source in `library/` and rebuilds byte-comparable-enough to install identically — 55/55 seeded, `library:build` produces a well-formed `library-dist/`
- [x] `library:check` runs in CI and fails on a validator-dirty prefab — wired into `pr.yml`; deliberately broke one entry and confirmed a non-zero exit, then restored
- [ ] A republished entry with a bumped version is picked up by an editor that had the old one cached — true by construction (versioned zip filenames change `getModuleTemplateRoot`'s cache key), **not live-verified** this session
- [ ] Killing the network shows an explicit offline state in the library tabs, not empty grids — code/logic verified by review + typecheck only; **live UI confirmation blocked** by the lerna/worktree trap (see PROGRESS.md log) — the live screenshots taken this session turned out to be exercising the main checkout's *unmodified* code, not this worktree's
- [ ] Install of one prefab + one module from the locally built dist verified live in the editor — **not completed**, same blocker

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Live zips contain formats the current editor loads oddly (optional-parameters v2 crash class) | Seeding commits content **as-is**; repair belongs to LIB-002/003 where each entry gets opened and re-saved |
| Index schema change breaks released editors | New fields are additive; `type` field has substring fallback; old editors ignore unknown fields |
| Docs-repo publish step gets forgotten | The publish script prints the exact copy destination; PROGRESS.md log entry per publish |
| Cache versioning misses the icon files | Icons resolve through the same versioned-path scheme as zips |

## References

- [README.md](./README.md) — investigation findings
- [COMP-001](../phase-3-editor-ux-overhaul/TASK-003-shared-component-system/COMP-001-prefab-system-refactoring.md), [COMP-002](../phase-3-editor-ux-overhaul/TASK-003-shared-component-system/COMP-002-builtin-prefabs.md) — superseded planning docs (source of the bundling idea)
- SUB-006 validator; SUB-004 catalog (compatibility vocabulary)
