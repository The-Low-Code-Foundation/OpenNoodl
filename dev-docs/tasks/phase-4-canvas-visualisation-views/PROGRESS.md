# Phase 4: Canvas Visualisation Views - Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** 🟡 In progress — prerequisites and 2 of 8 views wired, tested-by-usage, and enabled in the running editor; 1 view is wired but its core algorithm is documented as broken; 1 view was built then deliberately shelved (disabled, zero call sites); 3 views are spec-only with no code at all.

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests.
- **Complete** — deliverable exists, is tested, AND has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Summary

The previous PROGRESS.md (dated 2026-07-01) was already a reasonably honest self-audit and its qualitative picture mostly holds up: prerequisites are done, X-Ray works, Trigger Chain is unstable, Data Lineage has real bugs, and Node Census/Impact Radar/Semantic Layers were never built. This pass corrects it in four places. First, none of this phase's code has automated tests anywhere — the "Complete" verdicts below rest on real call sites in the running app (verified via `router.setup.ts` sidebar registration and cross-file imports), not on test coverage, which simply does not exist for this phase. Second, VIEW-001 (Topology Map) is not "in progress with phases 3-5 pending" — it was deliberately shelved and its sidebar registration is commented out (commit `bb9f4df`, "shelve Topology Map panel due to visual quality issues"), so it currently has zero reachable call sites in the app; no successor task in the repo is scoped to re-wire or rebuild it. Third, VIEW-005 (Data Lineage) is not "disabled" as the old file claimed — its sidebar panel registration is active and reachable (`router.setup.ts`, id `data-lineage`, not marked `isDisabled`); only its right-click context-menu shortcut was commented out in `nodegrapheditor.ts`. The feature is genuinely reachable in the UI today, just unreliable per its own `NOT-PRODUCTION-READY.md`. Fourth, several dates recorded in the old PROGRESS.md and task docs ("March 2026" for the webpack fix, "April 1, 2026" for the topology shelving) do not match git history — the actual commit for PREREQ-001/PREREQ-002 is `eb90c5a` dated 2026-01-04, and the topology shelving commit `bb9f4df` is also 2026-01-04. Timestamps embedded in this repo's docs and commit messages are not reliable; git commit dates are used as ground truth below.

---

## Task Table

| ID | Title | Status | Evidence (commit / path) | Notes |
|---|---|---|---|---|
| PREREQ-001 | Webpack Caching Fix | Complete | `eb90c5a` (2026-01-04); `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js` — `cache: false` + `Cache-Control: no-store` dev-server header | Live in the current dev webpack config. Touched again later by `1502581` (2026-07-22, unrelated REV dev-loop fix), confirming the file is still active. No automated test; verified by reading the config directly. |
| PREREQ-002 | React 19 Debug Fixes | Complete | `eb90c5a` (2026-01-04); `createRoot` root-reuse pattern present in `whats-new.ts`, `ShowContextMenuInPopup.tsx`, and ~25 further call sites across the editor | `createRoot` usage is broad and consistent; no leak/crash markers remain in the files this task targeted (ConnectionPopup/news modal/HMR). |
| PREREQ-003 | Canvas Overlay Pattern (docs) | Complete | `eb90c5a` (2026-01-04); 5 docs under `dev-docs/reference/CANVAS-OVERLAY-*.md` | This task's deliverable is documentation, not code — the docs exist and are cited by later PREREQ-004/VIEW-000+ work. Nothing to "wire" for a doc task. |
| PREREQ-004 | Highlighting API | Complete | `eb90c5a` (2026-01-04); `packages/noodl-editor/src/editor/src/services/HighlightManager/` (HighlightManager, channels, HighlightHandle) + `views/CanvasOverlays/HighlightOverlay/` | Real call sites outside tests: `ComponentXRayPanel.tsx`, `DataLineagePanel.tsx`, and `nodegrapheditor.ts` all import `HighlightManager`/`HighlightOverlay`. Component-boundary highlighting remains skeleton-only per its own changelog, but that's out of this task's stated scope. |
| VIEW-000 | Foundation & Utils | Complete | `eb90c5a` (2026-01-04) for `traversal.ts`/`crossComponent.ts`/`categorization.ts`/`duplicateDetection.ts`; `d144166` (2026-01-04) added `lineage.ts` | Consumed by `ComponentXRayPanel/hooks/useComponentXRay.ts`, all of `DataLineagePanel` (panel, hooks, components), and `TopologyMapPanel` (shelved consumer, still a real import). Real call sites outside tests exist; no automated tests exist for the module itself. |
| VIEW-001 | Project Topology Map | Built–not wired (shelved) | Built by `eb90c5a` (2026-01-04); shelved same day by `bb9f4df` ("feat(topology): shelve Topology Map panel due to visual quality issues") | Import and sidebar registration are commented out in `router.setup.ts` — zero reachable call sites in the running app today. Deliverables were also incomplete even before shelving: Phase 3 (draggable cards), Phase 4 (sticky notes), Phase 5 (drilldown) were never finished (`REMAINING-WORK-INDEX.md`). No automated tests. **No task elsewhere in this repo is scoped to re-wire or rebuild it** — `SHELVED.md` recommends a from-scratch rebuild on React Flow but assigns no task ID to that work; flagging as a genuine gap rather than inventing an owner. |
| VIEW-002 | Component X-Ray | Complete | `eb90c5a` (2026-01-04); `packages/noodl-editor/src/editor/src/views/panels/ComponentXRayPanel/` | Registered and enabled (experimental) in `router.setup.ts` (`id: 'component-xray'`); consumes VIEW-000 utils and PREREQ-004 highlighting. One documented non-blocking bug: AI function nodes can cause the sidebar to disappear (workaround: close property editor). No automated tests; verified by code + live registration. |
| VIEW-003 | Trigger Chain Debugger | Fixed (DEBT-012, `62fc611`) | `eb90c5a` (2026-01-04); DEBT-012 `62fc611` (2026-07-25); `packages/noodl-editor/src/editor/src/utils/triggerChain/` + `views/panels/TriggerChainDebuggerPanel/` | The critical 5ms-dedup data-loss bug is **fixed**: root cause was `connectiondebugpulse` being a full per-frame state snapshot (a pulse lingers ~100ms), so the wall-clock heuristic both flooded and dropped legit steps. Replaced with rising-edge snapshot-membership detection (`snapshotDiff.ts`) + per-interaction grouping/collapse + a recorder smoke test. First automated tests in this phase. Live-editor smoke still pending. |
| VIEW-004 | Node Census | Not started | No implementation directory exists; only `VIEW-004-node-census/README.md` (spec, added `fad9f10`, 2025-12-28) | `grep -ri "nodecensus\|node census"` across `packages/` returns nothing outside the spec doc. |
| VIEW-005 | Data Lineage View | Retired from reach (DEBT-012, `62fc611`) | `d144166` (2026-01-04, "…implementation failed and requires rethink"); retired by DEBT-012 `62fc611` (2026-07-25); `packages/noodl-editor/src/editor/src/views/panels/DataLineagePanel/` + `utils/graphAnalysis/lineage.ts` | Per the DEBT-012 decision (do not attempt algorithm fix #6): the sidebar registration is now **unregistered** in `router.setup.ts` — no longer reachable — and the `🔗 [DataLineage]` console spew is stripped. Panel/`lineage.ts` code left in place one cycle behind the dead registration; **next-cycle cleanup: delete `DataLineagePanel/`, keep `lineage.ts`.** The deterministic-lineage-as-substrate-service idea is recorded in `dev-docs/future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md`; Explain Mode (AIX-004) is the shipped human-facing answer to the same question. |
| VIEW-006 | Impact Radar | Not started | No implementation directory exists; only `VIEW-006-impact-radar/README.md` (spec, added `fad9f10`, 2025-12-28) | No code anywhere in the repo. |
| VIEW-007 | Semantic Layers | Not started | No implementation directory exists; only `VIEW-007-semantic-layers/README.md` (spec, added `fad9f10`, 2025-12-28) | No code anywhere in the repo. |

---

## Integration-gap summary (exists ≠ integrated)

- **VIEW-001 (Topology Map):** code exists, zero reachable call sites (import + registration both commented out). **No task in the repo closes this gap** — recommend a human decide whether to schedule a rebuild (per `SHELVED.md`'s React-Flow suggestion) or drop it.
- **VIEW-005 (Data Lineage):** ~~code exists and *is* reachable via the sidebar…~~ **Resolved by DEBT-012 (`62fc611`, 2026-07-25):** the panel is unregistered (no longer reachable — a panel that confidently shows wrong data-flow answers next to Explain Mode is worse than none), and the rewrite decision is made — not a patch, but a future deterministic-lineage substrate service (`future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md`). Next-cycle: delete `DataLineagePanel/`.
- VIEW-001 (Topology Map) remains the one genuinely unowned gap; VIEW-003/005 are now owned/resolved by DEBT-012.

---

## Recent Updates

| Date       | Update                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| 2026-07-23 | REV-006 documentation truth pass: rewritten against code + git history (this file)                |
| 2026-07-01 | Prior audit/correction pass (superseded by this one; qualitative conclusions mostly held up)       |
| 2026-01-04 | `d144166` — Data Lineage attempted, marked not-production-ready the same day                       |
| 2026-01-04 | `bb9f4df` — Topology Map shelved; sidebar registration commented out                                |
| 2026-01-04 | `eb90c5a` — Prerequisites + X-Ray + Trigger Chain + Highlighting API + graph-analysis utils landed  |
| 2025-12-28 | `fad9f10` — All phase-4 task specs (READMEs) authored, incl. VIEW-004/006/007 (never implemented)  |

---

## Notes

### What's actually working in the running editor today

- Component X-Ray (sidebar, experimental, enabled)
- Trigger Chain Debugger (sidebar, enabled — dedup data-loss bug fixed by DEBT-012 `62fc611`; live-editor smoke pending)
- Data Lineage panel **unregistered** by DEBT-012 `62fc611` (no longer reachable); code kept one cycle behind the dead registration for next-cycle deletion
- Highlighting API and graph-analysis (VIEW-000) utilities underpin all of the above and have real call sites

### What's not reachable at all

- Topology Map (code present, sidebar registration commented out, no owning task)
- Node Census, Impact Radar, Semantic Layers (spec-only, no code)

### Testing caveat

No automated tests (unit, integration, or otherwise) were found anywhere under this phase's code paths (`graphAnalysis/`, `triggerChain/`, `TopologyMapPanel/`, `ComponentXRayPanel/`, `TriggerChainDebuggerPanel/`, `DataLineagePanel/`). All "Complete" verdicts above rest on code existence + real call sites in the running app, not on test coverage — there isn't any for this phase. Worth flagging for anyone resuming work here.

### Recommended next steps

1. Decide ownership for the two unowned integration gaps (Topology Map re-wire/rebuild; Data Lineage algorithm rewrite) — currently nobody's job.
2. Fix VIEW-003's deduplication data-loss bug before calling Trigger Chain trustworthy.
3. If Node Census / Impact Radar / Semantic Layers are still wanted, they need to be scheduled as net-new work — nothing beyond VIEW-000 utilities exists to build on.
4. Add automated tests for the phase-4 code that does exist; none currently has any.

---

## Per-developer progress files

No `PROGRESS-*.md` file exists in this folder as of this audit — this shared file is the only progress record for phase 4.
