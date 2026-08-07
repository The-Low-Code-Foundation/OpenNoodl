# Phase 1: Dependency Updates - Progress Tracker

**Audit date:** 2026-07-23 (REV-006 documentation truth pass)
**Last content update prior to audit:** 2026-01-07
**Overall Status:** 🟢 Complete — audit confirms this phase's own claim of 100%

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests.
- **Complete** — deliverable exists, is tested, AND has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Audit summary

This is the one phase folder in the revival audit so far where the pre-existing `PROGRESS.md` was **not** stale — it already claimed 100% complete (verified 2026-01-07), and independent re-verification against the code and git history on 2026-07-23 confirms every one of its seven task claims still holds true today, six-plus months later. `PHASE-1-SUMMARY.md` (dated December 2024/January 2025 in its own header, though its git-log evidence places the work in December 2025) tells the same story and does not contradict `PROGRESS.md` on any task; it is a narrative write-up rather than a status tracker, and its "Phase 1 Task Reference" table matches the task table below task-for-task. No per-developer `PROGRESS-*.md` file exists in this folder, so there was nothing to merge. The only correction of substance is precision, not verdict: dates in the old file's "Recent Updates" section say 2026-01-07, but the underlying commits are dated December 2025 (see evidence column) — a cosmetic discrepancy, not a status error.

---

## Task Status

| ID | Title | Status | Evidence (commit / path) | Notes |
|----|-------|--------|---------------------------|-------|
| TASK-000 | Dependency Analysis | Complete | Docs-only deliverable: `TASK-000-dependency-analysis/{DETAILED-ANALYSIS,IMPACT-MATRIX,RECOMMENDATIONS}.md` present in repo | Analysis/planning task; deliverable is the documents themselves, which exist and were clearly acted on (TASK-001/003/004/006 implement its recommendations). |
| TASK-001 | Dependency Updates | Complete | `package.json` / `packages/noodl-editor/package.json` show webpack-dev-server 4.15.2, css-loader 6.11.0, style-loader 3.3.4, webpack 5.101.3, webpack-cli 5.x — all matching the "after" column in `PHASE-1-SUMMARY.md`. Commit `2153baf` "Finished task 1." (2025-12-06) | Core dependency bump landed and is live in the build config actually used by `noodl-editor`. |
| TASK-001B | React 19 Migration | Complete | `packages/noodl-editor/package.json` and `packages/noodl-core-ui/package.json` pin `react`/`react-dom` `19.0.0`. `grep` finds 33 non-test files using `createRoot` from `react-dom/client`; the only two hits for `ReactDOM.render` are detection-string literals inside `ProjectScanner.ts` / `MigrationNotesManager.ts` (migration-tool code that *looks for* legacy patterns in other people's projects), not live legacy calls. Commit `8fed72d` "Updated project to React 19" (2025-12-07) | Old PROGRESS.md's "48 createRoot usages" figure is now 33 in this repo snapshot (file set has shifted since); the substance — full React 19 adoption, no live `ReactDOM.render` — still checks out. |
| TASK-002 | Legacy Project Migration | Complete | `packages/noodl-editor/src/editor/src/models/migration/` (types.ts, MigrationSession.ts, ProjectScanner.ts, AIMigrationOrchestrator.ts, BudgetController.ts, MigrationNotesManager.ts) + `views/migration/MigrationWizard.tsx`. Real call site: `pages/ProjectsPage/ProjectsPage.tsx` imports and renders `MigrationWizard` (3 call sites), and `ProjectsPage` is the live route wired in `router.tsx`. Commits `0b47d19` "Finished initial project migration workflow" (2025-12-15), `03a464f` "React 19 runtime migration complete, AI-assisted migration underway" (2025-12-20) | GUI wizard (not the originally planned CLI) — confirmed superior-alternative note is accurate. Note: an older duplicate, `views/projectsview.ts`, also references `MigrationWizard` but is itself unreferenced anywhere else in the codebase (dead/legacy file, superseded by `ProjectsPage.tsx`); this doesn't affect TASK-002's completion since the live route uses the wizard. The same migration code is reused/extended by Phase 2's runtime React-19-migration and AI-migration tasks — expected, not a red flag. |
| TASK-003 | TypeScript Config Cleanup | Complete | Root `tsconfig.json` `compilerOptions.paths` contains global aliases: `@noodl-core-ui/*`, `@noodl-hooks/*`, `@noodl-utils/*`, `@noodl-models/*`, `@noodl-constants/*`, `@noodl-contexts/*`, `@noodl-types/*`, `@noodl-store/*`, plus a package-specific alias for `@noodl-viewer-cloud/execution-history`. Commit `e927df7` (2025-12-08) | "Option B" (global path aliases) as claimed. |
| TASK-004 | Storybook 8 Migration | Complete | `packages/noodl-core-ui/package.json` pins `storybook`/`@storybook/*` at `8.6.14`; `.storybook/main.ts`, `manager.ts`, `preview.ts` present and a `storybook-static` build output exists, confirming it actually runs. `grep` over `*.stories.tsx` finds 95 files using CSF3 (`Meta`/`StoryObj`) and 0 using CSF2 (`ComponentStory`/`ComponentMeta`). Commit `e927df7` (2025-12-08) | Story count (95) is close to but not identical to the old doc's "92" — file set has grown slightly since; migration is still complete with zero CSF2 stragglers. |
| TASK-006 | TypeScript 5 Upgrade | Complete | Root and all package `package.json` files pin `typescript: ^5.9.3`. No `transpileOnly` found anywhere in webpack configs (`grep` across `packages/*/webpackconfigs`). Commit `ef1ffdd` "feat(typescript): upgrade TypeScript to 5.9.3, remove transpileOnly workaround" (2025-12-08) | Zod v4 still not present in any `package.json` — matches the old doc's "not yet installed, will add when AI features require it" note; still true as of 2026-07-23, not a defect. |

---

## Dependencies

Depends on: Phase 0 (Foundation) — unchanged from prior doc.

---

## Convention note

No per-developer `PROGRESS-*.md` exists for this phase to merge. If one is added in a future sprint on this phase, fold its verified content into this file per the REV-006 convention (see `dev-docs/guidelines/GIT-WORKFLOW.md`).
