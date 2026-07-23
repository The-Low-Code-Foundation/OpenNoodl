# Phase 3: Editor UX Overhaul — Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** 🟡 Mostly complete — core editor UX work landed; a handful of collaboration/automation sub-series were only ever specced.

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests. The task expected to close the gap is named, or "none identified" is stated explicitly.
- **Complete** — deliverable exists, is tested, AND has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Summary of true state vs. the old PROGRESS.md

The previous tracker (last touched 2026-01-18) only tracked 10 rows and significantly **understated** progress: it listed TASK-003 through TASK-006 as "Not Started" and TASK-007 as "In Progress." A code/git audit shows TASK-006 (expressions), TASK-007 (app config, both folders), TASK-008 (both folders), TASK-009 (both folders), TASK-010, TASK-011, and TASK-012 are all **Complete and wired**, several via a large "new code editor" / Blockly push that landed after the old tracker's last update. TASK-013 (integration bugfixes) is genuinely **In progress** as documented in its own tracker, which remains accurate. The old tracker also never listed TASK-001C, TASK-001D, TASK-002B, TASK-002C, TASK-006B, or TASK-013 at all — this folder grew from 10 to 22 task IDs and the shared file was never expanded to match.

The old tracker's "Not Started" calls for TASK-003 (shared component system), TASK-004 (AI project creation), and TASK-005 (deployment automation) are **confirmed accurate** — these remain planning-only. One genuine integration gap was found: GitHub Issue/PR **create/update/comment** methods (`GitHubClient.createIssue`, `.updateIssue`, `.createIssueComment`) are implemented and unit-tested but have **zero call sites in the UI** — the Issues/PRs panels are read-only browsers today. No task in this folder or elsewhere in the repo is named to close that specific gap (GIT-004D "issues-crud" is spec-only, not implemented); flagged below as Built–not wired with no closing task identified.

---

## Task Status

| ID | Title | Status | Evidence (commit / path) | Notes |
|----|-------|--------|---------------------------|-------|
| TASK-001 | Dashboard UX Foundation (DASH-001…004) | Complete | `73b5a42`, `2e46ab7`; `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`, `packages/noodl-core-ui/src/preview/launcher/Launcher/` | New tabbed launcher (`Launcher.tsx`, `views/Projects.tsx`, `Templates.tsx`, `LearningCenter.tsx`) is the app's real default route (`router.tsx:92`). |
| TASK-001B | Launcher Fixes | Complete | `d9acb41` (ProjectCreationWizard); folder has README/SOLUTIONS docs for BUG-001…004 | CreateProjectModal, electron-store migration, list-view removal all present in `ProjectsPage.tsx` / `LocalProjectsModel.ts`. |
| TASK-001C | Legacy Runtime Detection | Complete | `ddcb9cd`; `models/migration/ProjectScanner.ts`, `LocalProjectsModel.detectProjectRuntime` | Runtime badges and migration entry point restored in the new launcher per the task's own "what already works" note, verified still wired. |
| TASK-001D | Legacy Read-Only Enforcement | Complete | `ddcb9cd`; `views/EditorBanner/EditorBanner.tsx` (wired into `nodegrapheditor.ts:1028`); `readOnly` guards at 10+ sites in `nodegrapheditor.ts` | `EditorBanner` is a real React component rendered by the canvas editor when `readOnly` is true; node create/drag/connect all gate on `this.readOnly`. PHASE-4-COMPLETE.md's corruption-bug fix (auto-default `runtimeVersion`, auto-save while read-only) is reflected in current `ProjectModel`. |
| TASK-002 | GitHub Integration (OAuth, status, clone) | Complete | `2845b1b`, `ddcb9cd`; `services/github/{GitHubClient,GitHubAuth,GitHubTokenStore}.ts`, `views/panels/GitHubPanel/` | OAuth (device flow), repo clone, dashboard git status all wired into `ProjectsPage.tsx` and `VersionControlPanel`. |
| TASK-002B | GitHub Advanced Integration | In progress | `ddcb9cd`, `bf07f1c` (GIT-004A-C); no code for GIT-004D-F, GIT-005-011 | GIT-004A (OAuth client), 004B (Issues list), 004C (PR list) are Complete and wired (`GitHubPanel/components/IssuesTab`, `PullRequestsTab`, `hooks/useIssues.ts`, `usePullRequests.ts`). GIT-004D (issues CRUD): client methods `createIssue`/`updateIssue`/`createIssueComment` exist in `GitHubClient.ts` and are unit-tested (`tests/services/github/GitHubClient.test.ts`) but have **no UI call site** — **Built–not wired, no closing task identified**. GIT-004E (component linking), GIT-004F (dashboard widgets), and the whole GIT-005…011 live-collaboration/community series (WebRTC, notifications, session discovery) have no code at all — **Not started**. A documented failed attempt (`GIT-004A-Phase5B-web-oauth-flow/FAILURE-REPORT.md`) shows the web-OAuth-flow alternative was abandoned in favor of the working device flow. |
| TASK-002C | GitHub Clone & Connect | Complete | `ddcb9cd`; `@noodl/git/src/core/clone` imported and called in `ProjectsPage.tsx:191`, `ConnectToGitHubView.tsx` | Clone, connect, and push/pull (via `VersionControlPanel`) all confirmed wired. |
| TASK-003 | Shared Component System (COMP-001…006) | Not started | No matching code found; `exportProjectComponets.ts` is the pre-existing zip-export flow the COMP series was meant to replace | No git-based component export, org-repo, version control, or fork/PR workflow exists. Docs are planning-only. |
| TASK-004 | AI Project Creation (AI-001…004) | Not started | `ProjectCreationWizard.tsx` header comment: "AI Builder stub (coming in V2)" | No scaffolding, suggestion, NL-editing, or design-assistance code beyond the stub label. The pre-existing "Clippy" AI assistant (`views/Clippy/`) is unrelated prior work, not this task's deliverable. |
| TASK-005 | Deployment Automation (DEPLOY-000…004) | Not started | `git log -- views/DeployPopup` shows only `8fed72d` (React 19 upgrade) and initial commit | `DeployPopup` only has a `DeployToFolderTab`; no Netlify/Vercel/GitHub Pages one-click deploy, preview deployments, or branch-deploy strategy exist. |
| TASK-006 | Expressions Overhaul (Phase 1 & 2) | Complete | `6f08163` and existing; `packages/noodl-runtime/src/nodes/std-library/expression.js`, `views/panels/propertyeditor/DataTypes/BasicType.ts` (uses `ExpressionEditorModal`/`PropertyPanelInputWithExpressionModal`) | Expression evaluator (dependency detection, reactive subscriptions) and inline property-expression UI both wired into the live property panel. |
| TASK-006B | Expression Canvas Rendering | Complete | `models/nodegraphmodel/NodeGraphNode.ts`, `views/panels/propertyeditor/components/NodeLabel/NodeLabel.tsx`, `views/panels/propertyeditor/DataTypes/BasicType.ts` | `ParameterValueResolver` (own PROGRESS.md claims complete) confirmed wired into node label / canvas display code, not just its unit test. |
| TASK-007-app-config | App Config (CONFIG-001…006) | Complete | `67b8ddc`; `views/panels/AppSetupPanel/sections/{IdentitySection,SEOSection,PWASection,VariablesSection}.tsx` | All four config sections exist and are mounted in `AppSetupPanel.tsx`. |
| TASK-007-app-config-system | App Config System (runtime plumbing) | Complete | `67b8ddc`; `packages/noodl-viewer-react/src/api/config.ts` + `noodl-js-api.js:22` (`global.Noodl.Config = createConfigAPI(...)`), consumed by `viewer.jsx` | The folder's own `INVESTIGATION-config-not-loading.md` documents a real bug (custom variables not reaching `Noodl.Config`); current code shows `createConfigAPI` is called from `noodl-js-api.js`, which is imported by the real viewer entry point (`viewer.jsx`) — the bug appears fixed, not merely worked around. |
| TASK-008-critical-runtime-bugs | Critical Runtime Bug Fixes | Complete | `addd4d9`; `styles/popuplayer.css` (theme-token tooltip colors), `nodes/std-library/{expression,simplejavascript}.js` | The task's own README header still says "🔴 Not Started" (stale, dated 2026-01-11) but its CHANGELOG.md documents both bugs fixed same day, and the fixes (methods vs. prototypeExtensions, Noodl API augmentation) are present in current runtime source. README status line should be treated as stale, not authoritative. |
| TASK-008-json-editor | Unified JSON Editor Component | Complete | `67b8ddc`; `packages/noodl-core-ui/src/components/json-editor/JSONEditor.tsx` (+ `EasyMode`) wired into `views/panels/AppSetupPanel/sections/VariablesSection.tsx` | Two-mode (Easy/Advanced) editor confirmed used by the live App Config Variables section. |
| TASK-009-monaco-replacement | Monaco Replacement (CodeMirror-based `JavaScriptEditor`) | Complete | `6f08163` "new code editor"; `packages/noodl-core-ui/src/components/code-editor/JavaScriptEditor.tsx` wired into `CodeEditorType.ts`, `ExpressionEditorModal.tsx`, `GeneratedCodeModal.tsx` | Own PROGRESS.md says "DEPLOYED AS DEFAULT" — confirmed by call sites in the live property-panel code editor path. |
| TASK-009-template-system-refactoring | Template System Refactoring | Complete | `199b4f9` "Fix app startup issues and add TASK-009 template system refactoring"; `utils/forge/template/{template,template-registry}.ts` + providers, consumed by `LocalProjectsModel.ts` | `LocalProjectsModel.ts` now references the embedded Hello World template provider rather than the old inline "minimal project" workaround described as temporary in the task doc. |
| TASK-010 | Code Editor Undo/Versioning System | Complete | `6f08163`; `models/CodeHistoryManager.ts` wired into `views/panels/propertyeditor/CodeEditor/CodeEditorType.ts` | Diff preview / restore-version system confirmed wired into the real code editor, matching the task's own "✅ COMPLETE" tracker. |
| TASK-011 | Advanced Code Editor (Phases 2-4) | Complete | `6f08163`, `addd4d9`; same `JavaScriptEditor`/`CodeEditorType.ts` call sites as TASK-009/010 | Phase 4 "document state corruption" fix is the same code path already confirmed live. |
| TASK-012 | Blockly Integration | Complete | `554dd9f` (Phase A), `9b3b299` (Phase C), `39fe8fb` (prototype finished); `utils/BlocklyEditorGlobals.ts`, `views/BlocklyEditor/`, wired into `views/nodegrapheditor.ts` and `views/CanvasTabs/CanvasTabs.tsx` | Own docs (PHASE-D-COMPLETE.md) claim full end-to-end MVP (visual editing → code gen → dynamic ports → runtime); drag-drop and dropdown-theming issues documented as fixed in POLISH-FIXES-SUMMARY.md. |
| TASK-013 | Integration Bugfixes (BUG-1…9) | In progress | `addd4d9`; folder's own PROGRESS.md (updated 2026-01-16, self-consistent, treated as reliable) | Per that tracker: Bugs 1, 2.1, 5, 6, 7A, 8A, 9 fixed and verified; Bug 2 (Blockly node deletion) investigated but not fixed; Bug 3 (comment UX overhaul) has a design doc only — no corresponding commits found in `views/CommentLayer/` since the React 19 upgrade, so treat as **not implemented** despite being checked off as "doc complete" in CHANGELOG.md; Bug 7B (canvas node icons) blocked on webpack config; Bug 8B (auto-expand) partially deferred; Bugs 10 (nav tab state) and 11 (viewer refresh) not started. |

---

## Integration gaps and their closing tasks

- **GitHub Issues/PRs CRUD (GIT-004D)** — `GitHubClient.createIssue` / `.updateIssue` / `.createIssueComment` are built and tested but not called from any UI. **No task in this repo (this folder or elsewhere) currently claims to wire this up.** If prioritized, it would naturally extend `views/panels/GitHubPanel/components/IssuesTab` / `PullRequestsTab`.
- **GIT-005…011 (live collaboration & community system)** — entirely unbuilt; TASK-002B's own docs already scope this as a large (501-662h) follow-on effort, so "not started" here is not a surprise finding, just confirmation.
- **TASK-013 Bug 3 (comment UX overhaul)** — checked off in the task's CHANGELOG as "doc complete" but no implementation commits exist; a future contributor reading only the CHANGELOG could mistake this for done. Flagged here explicitly.

---

## Items needing human review (evidence unclear or judgment calls made)

- **TASK-013 Bug 3** status — marked "not implemented" here based on absence of commits touching `CommentLayer` since the design doc was written, but no explicit "abandoned" note exists in the docs either. Worth a human confirming intent before closing it out.
- **TASK-008-critical-runtime-bugs README** carries a stale "🔴 Not Started" header contradicted by its own CHANGELOG and by the code; left as Complete here on the strength of the CHANGELOG + code, but the header itself was not corrected (out of scope — only this shared PROGRESS.md was to be rewritten, not task spec files).

---

## Dependencies

Depends on: Phase 2 (React Migration).

## Notes

- TASK-008 (granular deployment / UBA) — moved to Phase 6, out of scope here.
- TASK-000 (styles overhaul) — moved to Phase 9, out of scope here.
- This folder currently holds two unrelated pairs of duplicate-numbered tasks (`TASK-007-app-config` / `TASK-007-app-config-system`, `TASK-008-critical-runtime-bugs` / `TASK-008-json-editor`, `TASK-009-monaco-replacement` / `TASK-009-template-system-refactoring`) — both members of each pair were audited independently above; neither is a duplicate of the other in content.
- No per-developer `PROGRESS-*.md` files exist in this folder to merge; several task subfolders have their own task-level PROGRESS.md/CHANGELOG.md (treated as evidence source #3, verified against code before trusting, per the audit's evidence-priority order).
