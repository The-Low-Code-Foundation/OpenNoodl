# TAB-005: App-wide vs per-tab surfaces

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TAB-005 |
| **Phase** | Phase 37 (Track V) |
| **Tier** | 2 |
| **Priority** | 🟠 High — invisible in a demo, immediate the first time a real user right-clicks |
| **Difficulty** | 🟢 Easy individually, 🟡 Medium in aggregate |
| **Prerequisites** | TAB-001 |

## Objective

Decide, for every surface that assumed one project, whether it is **app-wide**, **active-tab** or
**per-tab** — and make it so.

## Why it is its own task

Tier 1 makes tabs work. This task makes them *right*. Each item below is small; the value is in
having audited the full list once rather than discovering them one bug report at a time.

## The audit

| Surface | Where | Disposition |
|---|---|---|
| **App menu** — most items forward an event to the renderer | [main.js:714](../../../packages/noodl-editor/src/main/main.js#L714) | **Active tab.** Undo, Save, Zoom and friends must never reach a background tab |
| **Devtools toggle** | [main.js:636-644](../../../packages/noodl-editor/src/main/main.js#L636-L644) | **Active tab** — and note the shell now has devtools of its own worth reaching |
| **`open-url` / protocol URIs** (`nodegx://`) | [main.js:856-863](../../../packages/noodl-editor/src/main/main.js#L856-L863), [:200](../../../packages/noodl-editor/src/main/main.js#L200) | **Depends on the URI.** A project-open URI should open a *new tab*; an OAuth callback belongs to whichever tab started the flow. Today both land on the one window |
| **GitHub OAuth** | [github-oauth-handler.js](../../../packages/noodl-editor/src/main/github-oauth-handler.js), [main.js:820-824](../../../packages/noodl-editor/src/main/main.js#L820-L824) | **Originating tab.** A callback delivered to the wrong tab fails silently, which is the worst failure mode available here |
| **`DesignToolImportServer`** — one server on `NOODLPORT+1` with `setWindow` + `setProjectName` | [design-tool-import-server.js:24](../../../packages/noodl-editor/src/main/src/design-tool-import-server.js#L24), [main.js:424](../../../packages/noodl-editor/src/main/main.js#L424), [:1108](../../../packages/noodl-editor/src/main/main.js#L1108) | **Active tab.** One import endpoint, retargeted on tab activation. Per-tab servers would mean the design tool has to pick a port, which is worse |
| **UDP multicast device discovery** — advertises one `httpPort` + one `projectName` | [main.js:1140-1148](../../../packages/noodl-editor/src/main/main.js#L1140-L1148) | **Open question 5.** Advertise the active tab, advertise all, or retire the feature |
| **`StorageApi.setup(win)`** | [main.js:425](../../../packages/noodl-editor/src/main/main.js#L425), [StorageApi.js](../../../packages/noodl-editor/src/main/src/StorageApi.js) | Read it and classify — it takes the window at setup time, so it is single-instance by construction |
| **Auto-updater** — attached to `win` | [main.js:362](../../../packages/noodl-editor/src/main/main.js#L362), [autoupdater.js](../../../packages/noodl-editor/src/main/src/autoupdater.js) | **App-wide**, surfaced in the shell. An update prompt inside one project tab is wrong |
| **First-run legal notice** | [main.js:830](../../../packages/noodl-editor/src/main/main.js#L830), [legal-window.js](../../../packages/noodl-editor/src/main/src/legal-window.js) | **App-wide.** Already its own `BrowserWindow`; verify it parents to the window, not a tab |
| **Launcher settings** (theme, AI keys) | [LauncherSettingsDialog.tsx](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/LauncherSettingsDialog.tsx) | **App-wide** and already stored app-wide. Confirm a change made in the launcher tab reaches open project tabs live, or is at least not silently stale |
| **Theme** | [ThemeManager.ts](../../../packages/noodl-editor/src/editor/src/models/ThemeManager.ts), [main.js:315](../../../packages/noodl-editor/src/main/main.js#L315) | **App-wide.** The shell, every tab and the startup `backgroundColor` must agree — a theme switch that repaints one tab is a visible defect |
| **`window-focused` / `app-focused`** | [main.js:978-983](../../../packages/noodl-editor/src/main/main.js#L978-L983) | **Every tab**, plus a new per-tab *activated* event — several panels refresh on focus and will now also need to refresh on tab activation |
| **Execution history IPC** | [main.js:839-844](../../../packages/noodl-editor/src/main/main.js#L839-L844) | **App-wide store, per-tab view.** It already merges remote sources from running backends; confirm it does not assume one project |
| **`resizeMainWindow`** | [main.js:535](../../../packages/noodl-editor/src/main/main.js#L535) | **Retire.** Geometry is app-level once the launcher is a tab (TAB-001) |

## Scope

### In scope

- [ ] Work the table above; every row ends `app-wide`, `active-tab`, `per-tab` or `retired`
- [ ] A single `TabManager.getActiveTab()` used by every active-tab consumer — no call site
      re-deriving it
- [ ] A `tab-activated` renderer event for panels that currently only listen to window focus
- [ ] Record the dispositions in `NOTES.md` as a table, so the next person does not re-audit

### Out of scope

- Agent-facing surfaces — TAB-006
- Anything already handled in tier 1

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Menu accelerators firing into a background tab — silent, and reported as "undo did nothing" | Route every menu forward through `getActiveTab()`; add one test |
| OAuth callback delivered to the wrong tab | Correlate on the state parameter the flow already carries; do not broadcast |
| Theme change applying to the shell but not to open tabs (or vice versa) | One broadcast path; verify visually in both themes with two tabs open, per the phase 23 screenshot-corpus habit |

## Success criteria

- [ ] Every row in the audit table is dispositioned and implemented
- [ ] Menu actions provably act on the focused tab only
- [ ] An OAuth flow started in tab B completes in tab B with tab A open
- [ ] A theme switch repaints the shell and every open tab
- [ ] Design-tool import lands in the active tab's project
