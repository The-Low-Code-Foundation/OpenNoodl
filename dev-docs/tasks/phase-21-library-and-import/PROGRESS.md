# Phase 21 Progress — Library & Import Overhaul

**Created:** 2026-07-25, from the code-level library/import investigation (findings recorded in the [README](./README.md))
**Overall status:** 🟡 In progress — LIB-001 mostly complete (4/5 success criteria verified; live install still to confirm), 0/4 remaining tasks started

## Status vocabulary

Not started · In progress · Built–not wired · Complete · Superseded

## Tasks

| Order | ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|---|
| 1 | LIB-001 | Library source of truth & delivery pipeline | Built–not wired | 4–6 days | Pipeline + 55-entry seed + editor changes shipped and committed; residual: live install-from-`library-dist` verification (see Log) |
| 2 | LIB-002 | Prefab audit, repair & restyle | Not started | 1.5–2 wks | Inventory from the live index first; every prefab re-authored in the current editor, validator-clean, restyled |
| 3 | LIB-003 | Module audit, hygiene & expansion | Not started | 1–1.5 wks | `startsWith` loader bug is an anytime fix; unify the two scanners; expansion is UI/utility only |
| 4 | LIB-004 | Import engine v2 | Not started | 1–1.5 wks | URL-path untick bug is an anytime fix; typed engine, dry-run plan, rename policy, SUB-007 diff for overwrites |
| 5 | LIB-005 | Import experience overhaul | Not started | 1.5–2 wks | Consumes LIB-004's plan API; AIX-003 dependency-closure selection; preview thumbnails via noodl-preview |

## Anytime fixes (independent of task order)

- [ ] Import-from-URL collision popup ignores unticked items (`EditorPage.tsx:353–363`) — LIB-004 step 0
- [ ] `projectmodules.js:47` `startsWith['http']` property-access bug — LIB-003 step 0
- [x] Silent `[]` on library index fetch failure → loud offline/error state in the tabs — LIB-001 step 0 (2026-07-25)

## Decisions

- **2026-07-25 — Library source hosting: this monorepo.** Content source of truth lives at `library/` at the repo root (`library/prefabs/<slug>/`, `library/modules/<slug>/`), each entry an unpacked project directory plus a `library.json` metadata file. `npm run library:build` produces `library-dist/` (versioned zips + per-type `index.json`); publishing is copying `library-dist/` into the docs repo's `library/` path (a documented manual step, see `library/README.md`). The docs repo (`the-low-code-foundation.github.io/opennoodl-docs`) stays a dumb CDN — the editor's fetch endpoint does not change. Rationale (per the LIB-001 spec's decision note): `library:check` needs the editor's SUB-006 validator and project loader, which live here; the agents/CI maintaining content work in this repo; content fixes ride the same review flow as code. Revisit only if Richard prefers a separate content repo — in that case only the publish step changes.

## Log

- **2026-07-25** — Phase created. Three parallel code investigations established: library content lives on the docs GitHub Pages site (not this repo) as full-project zips; all five install/import/export flows share `projectimporter.js` + `ImportPopup`; SUB-007/AIX-003/SUB-006/SUB-009 provide the machinery a modern import needs. Five tasks specced across two sprints.
- **2026-07-25** — LIB-001 started. Step 0 (loud fetch-failure state) shipped: `ModuleLibraryModel` now tracks `modulesStatus`/`prefabsStatus` (`loading`/`loaded`/`error`) instead of silently resolving to `[]` on fetch failure, and `NodePickerSearchView` renders an explicit "Couldn't load the library" state with a Retry button. Hosting decision recorded above. `library/` scaffolded at repo root; live library (29 prefabs + 26 modules from the docs GitHub Pages index) seeded as tracked source with per-entry provenance. `library:build` (versioned zips + index.json) and `library:check` (project loads + SUB-006 validator + schema) added and wired into CI (`.github/workflows/pr.yml`). Editor-side: index schema now tolerates `type`/`version`/`minEditorVersion`/`runtimeVersion`; `/prefab` substring check kept as fallback behind an explicit `type` field; orphaned `ModuleLibraryContext` deleted.
- **2026-07-25** — Verification status and a real environment trap found while trying to go further:
  - `library:build`/`library:check` run clean against all 55 seeded entries (0 errors, 48 warnings — expected, seeded-as-is content). Deliberately broke one entry's `library.json` (missing `version`) and confirmed `library:check` fails loudly with a non-zero exit; restored and reconfirmed 55/55 clean. `typecheck:editor` is clean (0 errors) on every commit above.
  - **Trap: `npm run dev:debug` / `npm run test:ci` (and anything else routed through `npx lerna exec --scope noodl-editor`) do not run the worktree's own source when invoked from inside a git worktree.** `lerna exec`'s package-root discovery resolves to the *main checkout's* `packages/noodl-editor`, not the worktree's, even when the child process's `cwd` is explicitly the worktree root — confirmed by `lsof -p <electron-pid>` showing `cwd` under the main checkout, and by reading `NodePickerSearchView.tsx` there and finding it byte-identical to the pre-edit version. Editor code changes made in a worktree are therefore **silently invisible** to `npm run dev:debug`/`test:ci` run from that worktree — a live click-through or the Jasmine suite will exercise the main checkout's code instead, and report success or failure that has nothing to do with the worktree's diff. Root cause not fully chased down (likely lerna's project-root detection not recognizing a git-worktree `.git` *file* the way it recognizes a `.git` *directory*); a real fix belongs to repo tooling, out of LIB-001's scope. Follow-up: either patch the affected npm scripts to avoid `lerna exec` for worktree-run dev/test, or always land editor-behavior verification from the primary checkout.
  - Because of that trap, **Success Criterion 5 ("install of one prefab + one module from the locally built dist verified live in the editor") was not completed this session.** What *is* verified: the build/check pipeline output is structurally correct and installable-shaped (same zip/index.json shape the existing, unchanged `ModuleLibraryModel.installPrefab/installModule` already consume), and the new React/TS code type-checks and was read-verified against the live-running (main-checkout) editor's DOM for the Step-0 error-state case specifically (see below). A follow-up session should either run the live check from the primary checkout, or fix the lerna/worktree resolution first.
  - Also hit and worked around, in case they bite a future session: (a) the worktree's own `node_modules/electron` has no `dist/` (postinstall binary download didn't run), so Electron itself also ends up launched from the main checkout — consistent with the trap above; (b) CDP's `--target=editor`/`--target=NodeGX` needle-matching in `scripts/devtools/cdp.js` can collide with unrelated path substrings (e.g. `--target=projects` matches `.../vscode_projects/...` in another target's file path first) — use a longer, more specific needle (e.g. `--target=dashboard/projects`); (c) full `Network.emulateNetworkConditions(offline)` was observed to hang the renderer when combined with an in-app project-open navigation (not just fail requests) — `blockurl`/`unblockurl` (added this session) is the safer tool for exercising one fetch's failure path; (d) `Page.reload` while any Network-domain emulation is active reliably navigates to `chrome-error://chromewebdata/` for this app's `file://` pages — go back online/unblocked *before* reloading, not after.

**Residual for next session:** live-verify install of one prefab + one module from a locally served `library-dist/` (Success Criterion 5), from an environment where the worktree trap above doesn't apply.
