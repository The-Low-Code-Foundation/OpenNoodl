# Phase 14.5 — Revival Debt — Progress

**Phase status:** In progress (created 2026-07-24 from the phases 12–14 audit)

| Task | Title | Priority | Status | Notes |
|---|---|---|---|---|
| DEBT-001 | Cloud Function node crashes in deployed apps | 🔴 Critical | ✅ Done (code) | Fix + characterisation tests landed 2026-07-24; deployed-build spot-check folded into DEBT-002 |
| DEBT-002 | The live verification pass | 🔴 High | ✅ Done (2 items blocked, recorded) | 6 of 8 checks executed 2026-07-24; findings list below; SUB-001 kill-mid-save and installer launches blocked with precise reasons |
| DEBT-003 | Expressions cannot see Variables | 🔴 High | Not started | AI-authoring critical path |
| DEBT-004 | Component port rename silently breaks wirings | 🔴 High | Not started | + two undocumented `xit` quarantines |
| DEBT-005 | Editor test-infrastructure debt | 🟡 Medium | Not started | Resolve the `@jest/globals` export hazard first |
| DEBT-006 | Runtime latent-defect batch | 🟡 Medium | Not started | After DEBT-001; PLAT-003's ledger |
| DEBT-007 | Release & dependency hygiene | 🔴 High | Not started | Must precede first signed release |
| DEBT-008 | Legacy ES5 modules vs class runtime | 🟡 Medium | Not started | Corpus project doesn't paint |
| DEBT-009 | External-authoring friction | 🟡 Medium | Not started | Coordinate with in-flight AIX-002 |
| DEBT-010 | Small cleanups & record-keeping | 🟢 Low | Not started | Includes doc-staleness corrections |

## DEBT-002 — the live pass: what ran, what it found (2026-07-24)

Run via the `run-editor` harness (CDP-driven, no human at the keyboard) against a real user
project (read-only), a disposable test project (`DebtLivePass`, created through the real
Quick Start wizard), and the GitHub Actions history. Evidence screenshots in the session
scratchpad; the durable record is this section plus annotations in each originating doc.

### Checklist outcomes

| Check | Outcome |
|---|---|
| PLAT-003 live editor pass | ✅ Real project (Shine Phase 2) opens, canvas paints, preview renders real content, warnings popup works, **zero renderer/viewer exceptions** in a full session log. Second project created from scratch, imported into, merged, validated — same result. Owed since slice 2; paid. |
| SUB-006 validator panel smoke | ✅ Problems panel renders real diagnostics (unknown node type from a legacy import), badge count updates, **click-to-navigate switches component and selects the offending node**. Note: panel is registered `experimental: true` and hidden until `experimental.panel.problems` is enabled — the validator UI is effectively dark-launched. |
| SUB-007 conflict UI | ✅ First-ever live render. Real merge engine (`mergeProject`) produced a `parameter` conflict; the metadata channel (`MERGE_CONFLICTS_KEY`) fed `MergeConflicts`/`GraphConflictList`; panel shows grouped conflicts with Yours/Theirs values, bulk + per-conflict actions; **"Use theirs" applied the value to the live graph** without hand-editing JSON. Git init exercised through the panel's own button. Git-driver plumbing itself not re-run (covered by `parity.test.ts`). |
| SUB-007 large-diff legibility | ✅ Observed at 151 changed components: a flat list with add/change markers and a count in the tab header; **no folder grouping, no collapse, no kind rollup** ("150 added, 1 changed"). Rows navigate the canvas on click. Filed as concrete asks against AIX-003 (below). |
| SUB-001 large-project claims | ⛔ **Not verified.** Two honest attempts, both ended by environment failures (below): (a) the 176-component corpus is React-17-legacy and now hard-gated read-only behind the migration wizard; (b) a synthetic 155-component project opened fine but the session was killed by the HMR full-reload bug before save-latency / kill-mid-save could run. Needs one clean run in a quiet tree; the claim stays unproven. |
| PLAT-002 import-popup variants | ✅ Owed since wave 3; paid. Import variant: tree indentation, folder toggle, implicit-dependency marker (dimmed check) all render; import lands on disk and in the components panel and survives reload. Collisions/overwrite variant: filters to genuinely colliding items only, partial overwrite works, no exceptions. |
| Nightly workflow | ⛔ **Cannot run, and never could**: `nightly.yml` exists only on `cline-dev`; GitHub only schedules (and dispatches) workflows from the default branch (`main`). This is the whole explanation for REV-003's "no scheduled run has executed". Unblock = land it on `main` (human-gated: pushing to the default branch). |
| Installers | ◐ Partially evidence-backed via the v0.1.0 Release run (29995532502): **win32-x64 installer built successfully** (first evidence a Windows installer has ever been produced); **linux-x64 fails** with `electron-builder: Please specify author 'email' in the application package.json`; **darwin-arm64** electron-builder failed; **darwin-x64 hung 24h and was cancelled** (`release.yml` has no `timeout-minutes`). No artifacts were uploaded, so no installer has ever been *launched* — that remains unverified and needs hardware/VMs. All four routed to DEBT-007. |
| DEBT-001 deployed-build spot-check | ◐ The fix is proven by characterisation tests in the exact deploy-shaped context (no `editorConnection`, no `cloudServices` → no throw, `failure` signalled). Live: the deployed bundle (`noodl.deploy.js` via `noodl-preview`) loads a project containing a triggered Cloud Function node with **zero uncaught errors/TypeErrors** in the console — pre-fix, every call threw. A visual assert of the error-output wiring failed on tooling (headless Chrome dumps the DOM before the app's first paint), not on the app. |

### Findings (new, discovered by this pass)

1. **HMR full reload kills the editor window.** When webpack HMR cannot hot-apply (seen: `TypeError ... isLesson` in `EditorPage.tsx` during apply), it forces a full reload, which resolves the SPA's pushed route as `file:///dashboard/projects` → `ERR_FILE_NOT_FOUND` → permanently dead window. Hit **three times** in one session; any source edit while the editor runs can trigger it. This is the single biggest obstacle to long scripted editor sessions and deserves its own small fix (serve index.html for unknown file routes, or pin the reload URL).
2. **Runtime-detection false positive (unconfirmed cause).** `DebtLivePass` has `runtimeVersion: "react19"` in project.json (detection check 1, high confidence), yet after adding 150 components on disk and reopening, the editor showed "Legacy Project (React 17) — Read-Only Mode". Needs a repro in a quiet session; if real, fresh projects can spuriously lock read-only. Routed to DEBT-006 as a new item.
3. **Problems panel is dark-launched** (experimental, off by default) — decide whether SUB-006's surface should be on by default before Phase 17 leans on it.
4. **Dev-stack fragility**: the viewer webpack watcher died once (`lerna ERR! npm run start exited undefined`) and took the whole stack down; "Exit project" quit the entire app once while the window was in the dead-HMR state. Both harness-level, both worth noting in DEBUG-INFRASTRUCTURE docs.
5. **AIX-003 asks from the large diff**: group changed components by folder prefix; add a kind rollup ("N added / M changed / K deleted"); consider virtualizing the list (151 rows render fine, but the corpus-scale case is untested).
6. **`release.yml` needs `timeout-minutes`** (the 24h darwin-x64 hang is a whole day of macOS runner spend) and package.json needs `author.email` for the Linux build — both DEBT-007.

## Log

- **2026-07-24** — DEBT-002 executed (see section above). Six of eight checks done with evidence; SUB-001 large-project claims and installer launches remain open with precise reasons. New findings routed: HMR-reload harness bug (new small task candidate), runtime-detection false positive → DEBT-006, release-workflow fixes → DEBT-007, diff-legibility asks → AIX-003. Originating docs annotated: PLAT-003-NOTES §18, PLAT-002-NOTES §8, SUB-006, SUB-007, REV-003, REV-004.
- **2026-07-24** — DEBT-001 code complete. `cloudfunction2.doCall` no longer throws in deploy-shaped contexts: the missing-`cloudServices` path routes to the `failure` output via `setError` and returns; the `isRunningLocally()` read is guarded on `editorConnection` being present. Characterisation tests added (`noodl-viewer-react/tests/cloudfunction2.test.ts`, 2 tests, both passing); full viewer-react suite green; `catalog:check` clean; no new tsc errors. PLAT-003-NOTES §17.7 #1 marked resolved. The spec's step-5 deployed-build verification is deferred into DEBT-002's live pass, which is the next task and covers exactly this kind of check.
- **2026-07-24** — Phase created. Source: cross-phase audit of phases 12–14 (three parallel doc-vs-repo reviews). All items were already recorded in those phases' NOTES/PROGRESS files but had no owning task; this phase assigns owners. Items with existing owners elsewhere (STYLE-005 → PLAT-005, CF11 pipeline → WF-001, large-diff review UI → AIX-003, migration wizard UI → SUB-003 deferral, PLAT-003 remaining slices → PLAT-003) were deliberately excluded.
