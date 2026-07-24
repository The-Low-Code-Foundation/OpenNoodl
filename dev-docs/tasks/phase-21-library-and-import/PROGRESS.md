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

*(none yet — LIB-001 step 1 records the content-hosting decision here)*

## Log

- **2026-07-25** — Phase created. Three parallel code investigations established: library content lives on the docs GitHub Pages site (not this repo) as full-project zips; all five install/import/export flows share `projectimporter.js` + `ImportPopup`; SUB-007/AIX-003/SUB-006/SUB-009 provide the machinery a modern import needs. Five tasks specced across two sprints.
