# TAB-001: The tab host

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TAB-001 |
| **Phase** | Phase 37 (Track V) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical — nothing else in the phase exists without it |
| **Difficulty** | 🟡 Medium |
| **Prerequisites** | none |
| **Ships with** | TAB-002, TAB-003, TAB-004 — tier 1 is indivisible |

## Objective

Turn the single editor window into a **tab host**: a shell that owns the titlebar and a tab strip,
with the launcher as tab 0 and each opened project as its own `WebContentsView` running its own
renderer.

## Current state

One `BrowserWindow` created at [`main.js:307`](../../../packages/noodl-editor/src/main/main.js#L307),
loading `src/editor/index.html`, held in a module-global `let win`
([`:174`](../../../packages/noodl-editor/src/main/main.js#L174)) that the rest of the file
dereferences roughly forty times. The renderer swaps between `ProjectsPage` and `EditorPage`
in place ([`router.tsx:189-199`](../../../packages/noodl-editor/src/editor/src/router.tsx#L189-L199)),
setting the global `ProjectModel.instance` on the way through.

Opening a project therefore *destroys* the launcher, and closing a project routes back and disposes
the project model on a `setTimeout(0)` with a documented white-screen hazard
([`router.tsx:162-175`](../../../packages/noodl-editor/src/editor/src/router.tsx#L162-L175)).

## Desired state

```
BrowserWindow
├── webContents ......... shell.html — titlebar + tab strip (React + core-ui)
└── contentView
    ├── view[0] ......... index.html, routed to ProjectsPage   (the launcher)
    ├── view[1] ......... index.html, routed to EditorPage      (project A)
    └── view[2] ......... index.html, routed to EditorPage      (project B)
```

Exactly one view is visible at a time; main sets its bounds to the window's content area minus the
52px bar and hides the rest. Each view is a full renderer, so every editor singleton is per-tab with
no editor-side change.

## Scope

### In scope

- [ ] A `TabManager` in main: `tabId → { view, kind: 'launcher' | 'project', projectPath, title }`
- [ ] `shell.html` + a shell renderer entry drawing the unified 52px titlebar and the tab strip
- [ ] IPC: `tabs:open-project`, `tabs:close`, `tabs:activate`, `tabs:list`, `tabs:changed`
- [ ] `ProjectsPage` opens a project by asking main for a tab instead of routing in place
- [ ] A `?route=editor` (or equivalent) boot parameter so a project view routes straight to
      `EditorPage` without flashing the launcher
- [ ] Per-view `require('@electron/remote/main').enable(view.webContents)` — see the trap below
- [ ] Window geometry moves from the launcher route to the app: retire `main-window-resize`
- [ ] Tab context menu via native `Menu.popup` (a shell DOM menu cannot overlay a view)
- [ ] Reuse, don't duplicate: opening an already-open project focuses its existing tab

### Out of scope

- Session restore across relaunch (open question 4)
- Background-tab suspension (open question 1)
- Tab reordering / drag-out-to-new-window
- Per-tab ports, preview, and quit safety — TAB-002, TAB-003, TAB-004

## Technical approach

### Key files

| File | Changes |
|------|---------|
| [`main/main.js`](../../../packages/noodl-editor/src/main/main.js) | `let win` → window + `TabManager`; `createWindow` splits into shell creation and view creation; ~40 `win` dereferences resolve to *shell*, *active tab*, or *every tab* — each one is a decision, not a rename |
| [`editor/src/router.tsx`](../../../packages/noodl-editor/src/editor/src/router.tsx) | Boot straight to the requested route; the project→project disposal path becomes dead for tabs (a closed tab is a destroyed renderer) |
| [`pages/ProjectsPage/ProjectsPage.tsx`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx) | The seven `router.route({ to: 'editor', … })` call sites become `tabs:open-project`; drop the `main-window-resize` on mount ([:422](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx#L422)) |

### New files

| File | Purpose |
|------|---------|
| `main/src/tabs/TabManager.js` | View lifecycle, bounds, activation, the id↔`webContents` map every other task needs |
| `main/src/tabs/index.js` | IPC registration |
| `editor/shell/index.html` + `editor/shell/src/` | The shell renderer: titlebar, tab strip, new-tab affordance |

### The `win` audit is the actual work

Each of the ~40 references resolves to one of three things. Getting one wrong is a silent bug, so
the audit is a deliverable, not a step:

| Category | Examples |
|---|---|
| **Shell** (window chrome) | `getBounds`, `setSize`, `setPosition`, `center`, `isMinimized`, `focus`, `windowBounds` persistence ([:531](../../../packages/noodl-editor/src/main/main.js#L531)) |
| **Active tab** | `open-noodl-uri` ([:200](../../../packages/noodl-editor/src/main/main.js#L200), [:863](../../../packages/noodl-editor/src/main/main.js#L863)), devtools toggle ([:640](../../../packages/noodl-editor/src/main/main.js#L640)), `DesignToolImportServer.setWindow` ([:424](../../../packages/noodl-editor/src/main/main.js#L424)), viewer geometry ([:442](../../../packages/noodl-editor/src/main/main.js#L442)) |
| **Every tab** | `window-focused` / `app-focused` ([:979](../../../packages/noodl-editor/src/main/main.js#L979)-[:983](../../../packages/noodl-editor/src/main/main.js#L983)), menu-driven `eventName` forwarding ([:714](../../../packages/noodl-editor/src/main/main.js#L714)), the quit flush (TAB-004) |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| ⚠️ **`@electron/remote` is enabled per-`webContents`** ([`main.js:334`](../../../packages/noodl-editor/src/main/main.js#L334)). A tab without it breaks `platform-electron`'s filesystem layer — a failure that presents as unrelated file errors, not as a missing tab | Enable inside `TabManager.createTab()`, never at a call site. Add a smoke check that a new tab can read the project directory |
| Shell DOM cannot overlay a child view — dropdowns and modals drawn in the shell will be clipped by the active tab | Native `Menu.popup` for tab menus; `dialog.showMessageBox` for confirmations. Decided up front, in scope above |
| The 52px bar is currently DOM chrome inside the editor renderer; two bars would stack | The shell owns the bar; project views render below it and must not draw their own. Check [`EditorTopbar.tsx`](../../../packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.tsx) and the macOS `trafficLightPosition` inset ([`main.js:325`](../../../packages/noodl-editor/src/main/main.js#L325)) |
| View bounds drift on window resize, full-screen, and display change | Bounds are set in one place in `TabManager`, driven by the window's `resize` event — never computed at a call site |
| Boot flash: a project view briefly renders the launcher before routing | Pass the route in the URL and branch in `router.tsx`'s constructor, not in an effect |

## Success criteria

- [ ] Launcher opens as tab 0 and stays open when a project is opened
- [ ] Two projects open simultaneously in separate tabs, each with its own `ProjectModel.instance`
- [ ] Closing a tab destroys its renderer; the remaining tabs are unaffected
- [ ] Opening an already-open project focuses its tab rather than creating a second
- [ ] Copy in tab A, paste in tab B works (should be free — verify, don't assume)
- [ ] Window bounds persist across restart with no route involved
- [ ] `npm run test:editor` and `test:main` green
