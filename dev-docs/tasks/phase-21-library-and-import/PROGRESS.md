# Phase 21 Progress — Library & Import Overhaul

**Created:** 2026-07-25, from the code-level library/import investigation (findings recorded in the [README](./README.md))
**Overall status:** 🔴 Not started — 0 / 5 tasks

## Status vocabulary

Not started · In progress · Built–not wired · Complete · Superseded

## Tasks

| Order | ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|---|
| 1 | LIB-001 | Library source of truth & delivery pipeline | Not started | 4–6 days | Content into `library/` in this monorepo; build → index.json + zips; versioned cache keys kill the stale-zip trap |
| 2 | LIB-002 | Prefab audit, repair & restyle | Not started | 1.5–2 wks | Inventory from the live index first; every prefab re-authored in the current editor, validator-clean, restyled |
| 3 | LIB-003 | Module audit, hygiene & expansion | Not started | 1–1.5 wks | `startsWith` loader bug is an anytime fix; unify the two scanners; expansion is UI/utility only |
| 4 | LIB-004 | Import engine v2 | Not started | 1–1.5 wks | URL-path untick bug is an anytime fix; typed engine, dry-run plan, rename policy, SUB-007 diff for overwrites |
| 5 | LIB-005 | Import experience overhaul | Not started | 1.5–2 wks | Consumes LIB-004's plan API; AIX-003 dependency-closure selection; preview thumbnails via noodl-preview |

## Anytime fixes (independent of task order)

- [ ] Import-from-URL collision popup ignores unticked items (`EditorPage.tsx:353–363`) — LIB-004 step 0
- [ ] `projectmodules.js:47` `startsWith['http']` property-access bug — LIB-003 step 0
- [ ] Silent `[]` on library index fetch failure → loud offline/error state in the tabs — LIB-001 step 0

## Decisions

- **2026-07-25 — Library source hosting: this monorepo.** Content source of truth lives at `library/` at the repo root (`library/prefabs/<slug>/`, `library/modules/<slug>/`), each entry an unpacked project directory plus a `library.json` metadata file. `npm run library:build` produces `library-dist/` (versioned zips + per-type `index.json`); publishing is copying `library-dist/` into the docs repo's `library/` path (a documented manual step, see `library/README.md`). The docs repo (`the-low-code-foundation.github.io/opennoodl-docs`) stays a dumb CDN — the editor's fetch endpoint does not change. Rationale (per the LIB-001 spec's decision note): `library:check` needs the editor's SUB-006 validator and project loader, which live here; the agents/CI maintaining content work in this repo; content fixes ride the same review flow as code. Revisit only if Richard prefers a separate content repo — in that case only the publish step changes.

## Log

- **2026-07-25** — Phase created. Three parallel code investigations established: library content lives on the docs GitHub Pages site (not this repo) as full-project zips; all five install/import/export flows share `projectimporter.js` + `ImportPopup`; SUB-007/AIX-003/SUB-006/SUB-009 provide the machinery a modern import needs. Five tasks specced across two sprints.
- **2026-07-25** — LIB-001 started. Step 0 (loud fetch-failure state) shipped: `ModuleLibraryModel` now tracks `modulesStatus`/`prefabsStatus` (`loading`/`loaded`/`error`) instead of silently resolving to `[]` on fetch failure, and `NodePickerSearchView` renders an explicit "Couldn't load the library" state with a Retry button. Hosting decision recorded above. `library/` scaffolded at repo root; live library (29 prefabs + 26 modules from the docs GitHub Pages index) seeded as tracked source with per-entry provenance. `library:build` (versioned zips + index.json) and `library:check` (project loads + SUB-006 validator + schema) added and wired into CI (`.github/workflows/pr.yml`). Editor-side: index schema now tolerates `type`/`version`/`minEditorVersion`/`runtimeVersion`; `/prefab` substring check kept as fallback behind an explicit `type` field; orphaned `ModuleLibraryContext` deleted.
