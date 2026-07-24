# Phase 14.5 — Revival Debt — Progress

**Phase status:** In progress (created 2026-07-24 from the phases 12–14 audit)

| Task | Title | Priority | Status | Notes |
|---|---|---|---|---|
| DEBT-001 | Cloud Function node crashes in deployed apps | 🔴 Critical | ✅ Done (code) | Fix + characterisation tests landed 2026-07-24; deployed-build spot-check folded into DEBT-002 |
| DEBT-002 | The live verification pass | 🔴 High | Not started | Go second — evidence, not features |
| DEBT-003 | Expressions cannot see Variables | 🔴 High | Not started | AI-authoring critical path |
| DEBT-004 | Component port rename silently breaks wirings | 🔴 High | Not started | + two undocumented `xit` quarantines |
| DEBT-005 | Editor test-infrastructure debt | 🟡 Medium | Not started | Resolve the `@jest/globals` export hazard first |
| DEBT-006 | Runtime latent-defect batch | 🟡 Medium | Not started | After DEBT-001; PLAT-003's ledger |
| DEBT-007 | Release & dependency hygiene | 🔴 High | Not started | Must precede first signed release |
| DEBT-008 | Legacy ES5 modules vs class runtime | 🟡 Medium | Not started | Corpus project doesn't paint |
| DEBT-009 | External-authoring friction | 🟡 Medium | Not started | Coordinate with in-flight AIX-002 |
| DEBT-010 | Small cleanups & record-keeping | 🟢 Low | Not started | Includes doc-staleness corrections |

## Log

- **2026-07-24** — DEBT-001 code complete. `cloudfunction2.doCall` no longer throws in deploy-shaped contexts: the missing-`cloudServices` path routes to the `failure` output via `setError` and returns; the `isRunningLocally()` read is guarded on `editorConnection` being present. Characterisation tests added (`noodl-viewer-react/tests/cloudfunction2.test.ts`, 2 tests, both passing); full viewer-react suite green; `catalog:check` clean; no new tsc errors. PLAT-003-NOTES §17.7 #1 marked resolved. The spec's step-5 deployed-build verification is deferred into DEBT-002's live pass, which is the next task and covers exactly this kind of check.
- **2026-07-24** — Phase created. Source: cross-phase audit of phases 12–14 (three parallel doc-vs-repo reviews). All items were already recorded in those phases' NOTES/PROGRESS files but had no owning task; this phase assigns owners. Items with existing owners elsewhere (STYLE-005 → PLAT-005, CF11 pipeline → WF-001, large-diff review UI → AIX-003, migration wizard UI → SUB-003 deferral, PLAT-003 remaining slices → PLAT-003) were deliberately excluded.
