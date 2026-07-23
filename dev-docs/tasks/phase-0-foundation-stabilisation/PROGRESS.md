# Phase 0: Foundation Stabilisation - Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** ✅ Complete — verified against code and git history, not just task-spec checkboxes

---

## Status Vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests.
- **Complete** — deliverable exists, is tested/verified, AND has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Summary

The previous PROGRESS.md (dated 2026-01-07) already claimed 100%/complete for all five tasks, and this audit largely confirms that — for once, the stale-docs pattern found elsewhere in this repo (see REV-006 / the 2026-07-22 viability assessment) does **not** apply to Phase 0. What the old file got wrong is *how* things finished, not *whether*: TASK-009's title ("Webpack Cache Elimination") and its own subfolder's content don't match — the real TASK-009 deliverable is cache-clearing scripts + a build canary, verified in code below. There are also two unrelated tasks both numbered **TASK-010** (an `eventlistener-verification` folder and a separate `project-creation-bug-fix` folder) — both are legitimately complete but the ID collision should be noted for anyone searching by task number. Finally, the original TASK-010 project-creation fix (raw JSON structure patch in `LocalProjectsModel.ts`) was itself superseded a few days later by the TASK-009 embedded-template system, which is what actually ships today — the old PROGRESS.md doesn't surface this lineage. No `PROGRESS-*.md` per-developer file exists in this folder, so there was nothing to merge.

---

## Task Table

| ID | Title | Status | Evidence (commit / path) | Notes |
|----|-------|--------|---------------------------|-------|
| TASK-008 | EventDispatcher + React Hooks Investigation | **Complete** | `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts` (exists, exported); commits `5f8ce8d`, `fad9f10` on `cline-dev`; `TASK-008-eventdispatcher-react-investigation/CHANGELOG.md` records root cause + solution | Investigation's own deliverable was the `useEventListener` hook. Confirmed root-cause (EventDispatcher's context-object cleanup pattern breaks under React closures) and the hook it produced is now used far beyond the original ComponentsPanel case — see TASK-010 evidence below. |
| TASK-009 | Webpack Cache Elimination (folder titled "verification-checklist") | **Complete** | `package.json` has `"clean:cache"`, `"clean:electron"`, `"clean:all"` (composes both), `"dev:clean"`; `packages/noodl-editor/webpackconfigs/shared/webpack.renderer.core.js:15` — `cacheDirectory: false`; `packages/noodl-editor/src/editor/index.ts:24` — `console.log('🔥🔥 BUILD TIMESTAMP:', ...)` | Task title/folder name mismatch: the task doc is literally the cache-elimination task but its folder is named `TASK-009-verification-checklist`. Implementation detail differs slightly from the doc's example (`clean:all` now composes `clean:cache` + `clean:electron` rather than one inline `rimraf`), but the net effect (all caches cleared, babel cache off in dev, build canary present) matches the spec. Verified live via `node scripts/health-check.js`, which checks all three. |
| TASK-010 (eventlistener-verification) | EventListener Verification | **Complete** | `useEventListener` hook has 15+ non-test call sites: `ComponentsPanelNew/hooks/useComponentsPanel.ts`, `GitHubPanel/GitHubPanel.tsx` (+ `hooks/useIssues.ts`, `hooks/usePullRequests.ts`), `ComponentXRayPanel/hooks/useComponentXRay.ts`, `BackendServicesPanel/BackendServicesPanel.tsx`, `DataLineagePanel/hooks/useDataLineage.ts`, `AppSetupPanel/AppSetupPanel.tsx`, `UBAPanel/UBAPanel.tsx`, `VersionControlPanel/.../CredentialsSection.tsx`, `TopologyMapPanel/hooks/{useTopologyGraph,useFolderGraph}.ts`, `CanvasOverlays/{ExecutionOverlay,HighlightOverlay}.tsx`, `ProjectsPage/ProjectsPage.tsx`, `contexts/ProjectDesignTokenContext/ProjectDesignTokenContext.tsx` | Verification checklist itself (manual test component `EventListenerTest.tsx`) was never wired into the router per its own success-criteria checkboxes (all unchecked in the doc), but that's moot — real production usage across 15+ files is far stronger evidence than the planned manual test would have been. No dedicated `.test.ts`/`.spec.ts` file exists for the hook, but `scripts/health-check.js` asserts its existence/shape automatically, and its behavior is exercised continuously by every panel listed above. |
| TASK-010 (project-creation-bug-fix) | Critical Bug: Project Creation Fails (missing JSON structure) | **Superseded** | Original fix: commit `a104a3a` "fix(editor): resolve project creation bug - missing graph structure" (Jan 9, 2026), patched `LocalProjectsModel.ts` to add `graph`/`comments`/`connections`. Current `LocalProjectsModel.ts` no longer contains that inline JSON at all — `newProject()` now delegates to `EmbeddedTemplateProvider` (`../models/template/EmbeddedTemplateProvider`), part of the TASK-009 (embedded template system) work landed shortly after (commit `6aa4532`) | The bug is fixed, but not by the code this task shipped — the fix was superseded within days by the embedded-template rewrite. A related follow-on issue is also resolved in current code: `CURRENT-STATUS.md` (dated Jan 12, French-language notes, status "EN COURS") describes a "No HOME component" preview bug and a `rootComponent` fix-in-progress; `rootComponent` handling is now present and shipped in `projectmodel.ts:180-184` and `ProjectTemplate.ts`/`hello-world.template.ts`. That in-progress status note was never updated after the fix landed — flagging as resolved-but-undocumented rather than rewriting the French status file itself (out of scope; only the shared `PROGRESS.md` is being corrected here). |
| TASK-011 | React Event Pattern Guide Documentation | **Complete** | `TASK-011-react-event-pattern-guide/GOLDEN-PATTERN.md` exists; `.clinerules` contains a "React + EventDispatcher Integration" section (confirmed via grep: lines ~166, 181-183, 377-420) instructing use of `useEventListener` and warning against direct `.on()` | Documentation-only deliverable, verified present and non-empty in both locations named by the task. |
| TASK-012 | Foundation Health Check Script | **Complete** | `scripts/health-check.js` exists; `package.json` has `"health:check": "node scripts/health-check.js"`; ran live — exits with "PASSED WITH WARNINGS" (7 pass / 3 warn / 0 fail) | The 3 warnings are a real, minor bug in the script itself: it checks doc paths under `phase-0-foundation-stabalisation` (typo, missing the "i") but the folder is actually named `phase-0-foundation-stabilisation` — those 3 checks will always warn until the script's hardcoded paths are corrected. Not a phase-0 blocker; noted here as a small follow-up for whoever touches this script next. |

---

## Dependencies

None — this is the foundation phase.

---

## Notes / Follow-ups Surfaced by This Audit

1. **`scripts/health-check.js` path typo** — hardcodes `phase-0-foundation-stabalisation` instead of `phase-0-foundation-stabilisation`; causes 3 spurious warnings on every run. Cheap fix, not urgent.
2. **Two unrelated tasks share the ID "TASK-010"** in this folder (`TASK-010-eventlistener-verification` and `TASK-010-project-creation-bug-fix`). Both are complete/superseded respectively, but the collision is worth avoiding in future phase numbering.
3. **`TASK-010-project-creation-bug-fix/CURRENT-STATUS.md`** is a French-language, dated (Jan 12, 2026) "EN COURS" status note describing a since-resolved `rootComponent`/"No HOME component" issue. Left as-is per REV-006 scope (only shared `PROGRESS.md` is rewritten), but a human should confirm no other stale per-incident status files like this are being read as current elsewhere in the repo.
4. **Dashboard routing error** noted in the prior PROGRESS.md ("`ERR_FILE_NOT_FOUND` for `file:///dashboard/projects`", attributed to Phase 3 TASK-001B) was not re-verified in this audit — it's out of scope for Phase 0 (the prior doc itself says it belongs to Phase 3) and is left for whoever audits that phase folder.

No task IDs in this phase had unclear/contradictory evidence requiring escalation — all five (six, counting the duplicate TASK-010) resolved cleanly to one status each.
