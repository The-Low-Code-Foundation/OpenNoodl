# Phase 37 — Project Tabs (Track V)

**Created:** 2026-08-02
**Origin:** not the roadmap. Richard asked whether the launcher could be the app's first tab, with
each opened project living in its own tab on its own port with its own backend — *"in theory you
could have multiple projects open simultaneously"*.

## What this phase is

Today NodeGX is a **single-project application wearing a launcher**. One window, one renderer, one
global `ProjectModel.instance`, one HTTP server on one fixed port, one preview window, one relay.
Opening a project *replaces* the launcher; opening a second project means closing the first.

Phase 37 makes the app **multi-project**: the launcher is tab 0 and never goes away, each project
opens in its own tab backed by its own renderer, its own HTTP/relay port allocated from a pool, and
its own backend process.

**The load-bearing claim of this phase is that this is cheap** — and it is cheap for one specific
reason, recorded here because every estimate depends on it.

## The design position

### The editor's globals are the whole problem, and separate renderers make them free

The editor's state is owned by module singletons.
[`router.tsx:155`](../../../packages/noodl-editor/src/editor/src/router.tsx#L155) says it out loud:

> *Set the global singleton here (and only here) to load the active project for this route*

`ProjectModel.instance` alone is referenced **462 times across 122 source files**. `NodeLibrary`,
`UndoQueue`, `WarningsModel`, `EventDispatcher` and `AiAssistantModel` are the same shape. Worse
than the count: the `ProjectModel.instance` setter calls
[`NodeLibrary.instance.registerModule(project)`](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L112),
so the **node-type namespace is app-global**. Two projects with same-named components, or different
`noodl_modules`, would collide in one JS context.

So there are two possible architectures, and they are not close:

| | **Tabs as renderers** (this phase) | Tabs in one renderer (rejected) |
|---|---|---|
| Project state | one set of globals **per tab**, untouched | 462 call sites re-scoped |
| Node library | isolated for free | needs per-project namespacing that does not exist |
| Editor code changed | port plumbing only | a rewrite of state ownership |
| Cross-tab drag & drop | ✗ | ✓ |
| Memory | linear per tab | shared |

**The globals are not refactored. They are made per-tab by making the tab a process.** Every hard
part of this phase is therefore in the *main* process, which is 1,203 lines and has exactly one
window variable to generalise.

### Per-tab ports are the isolation boundary, not a convenience

The first scoping pass assumed per-tab ports were an implementation detail — you need a free port,
so you take the next one. That is wrong, and the correction changes the design.

[`relay-server.js:54`](../../../packages/noodl-editor/src/main/src/relay-server.js#L54) —
`broadcastMessage` routes by **peer type only**. Every message from a `viewer` goes to **every**
socket registered as an `editor` on that relay. `clientId` targeting exists
([`:156`](../../../packages/noodl-editor/src/main/src/relay-server.js#L156)) but is opt-in per
message; the default path is a broadcast.

Two projects sharing one relay would **cross-wire**: project A's editor receives project B's preview
values, node-library announcements, trace events and warnings. Not a race, not a rare interleaving —
the default behaviour of the code as written.

So: **one server per tab, one relay per tab, one port per tab.** Not for tidiness. For correctness.

### The launcher is already a route; it is not already a tab

[`router.tsx:91`](../../../packages/noodl-editor/src/editor/src/router.tsx#L91) starts at
`ProjectsPage` and swaps to `EditorPage` in place. That is why "make the launcher a tab" reads as
easy — but the two routes are not symmetric today:

- The launcher **resizes the window** on mount:
  [`ProjectsPage.tsx:422`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx#L422)
  sends `main-window-resize` with `size: 'editor'`, and
  [`resizeMainWindow`](../../../packages/noodl-editor/src/main/main.js#L535) restores saved bounds
  and re-enables resize/maximise/minimise. Window geometry is currently a *route's* business.
- Routing project → project disposes the old `ProjectModel` on a `setTimeout(0)` with a documented
  white-screen hazard ([`router.tsx:162-175`](../../../packages/noodl-editor/src/editor/src/router.tsx#L162-L175)).

In the tab model, geometry becomes app-level and that disposal path stops being the interesting one —
**closing a tab destroys the renderer**, which is a stronger guarantee than `dispose()` ever gave.

### Cheap does not mean safe: the quit path is where this bites

[`flushRendererProjectSave()`](../../../packages/noodl-editor/src/main/main.js#L908) holds quit and
window-close open until the renderer confirms its debounced project save has landed. It listens with
a **bare `ipcMain.on('flush-project-save-done')` that carries no sender identity**
([`main.js:930`](../../../packages/noodl-editor/src/main/main.js#L930)).

With N tabs, **the first tab to answer resolves the promise for all of them** and the app quits with
N−1 debounced saves still pending. This repo already has a 1-second-quit data-loss defect in its
history at this exact seam. It is not a risk to watch; it is a defect that ships the day tab 2 opens
unless TAB-004 lands with TAB-001.

## Tasks

| ID | Title | Tier | Focus |
|---|---|---|---|
| [TAB-001](./TAB-001-TAB-HOST.md) | The tab host | 1 | Window shell, tab strip, view lifecycle, launcher as tab 0 |
| [TAB-002](./TAB-002-PER-TAB-PROJECT-SERVER.md) | Per-tab project server & port | 1 | One HTTP server + relay per tab; port delivered over IPC, not `process.env` |
| [TAB-003](./TAB-003-PER-TAB-PREVIEW.md) | Per-tab preview | 1 | Retire the single `viewerWindow`; one preview per tab |
| [TAB-004](./TAB-004-LIFECYCLE-AND-SAFE-QUIT.md) | Lifecycle & safe quit | 1 | Flush fan-out, close-tab semantics, crash isolation, backend lifecycle |
| [TAB-005](./TAB-005-APP-WIDE-VS-PER-TAB.md) | App-wide vs per-tab surfaces | 2 | Menus, protocol URIs, UDP discovery, design-tool import, settings |
| [TAB-006](./TAB-006-TAB-AWARE-AGENT-ACCESS.md) | Tab-aware agent access | 3 | Tab/port discovery for `nodegx-observe`; `noodl-mcp` targeting; per-tab AI |

**Tier 1 must ship together.** TAB-001 without TAB-002 cross-wires two projects' relays; TAB-001
without TAB-004 loses unsaved work on quit. There is no partial-credit stopping point inside tier 1 —
this is the one place this phase differs from phase 36, where tier 1 had a legitimate early stop.

Tier 2 is polish that becomes visible the first time a user right-clicks something. Tier 3 is the
part that makes this interesting to agents rather than only to humans.

## The recommended host: `WebContentsView`, not `<webview>`

Both work. The decision is recorded because it is the one architectural choice inside the cheap path.

The window loads a small **shell** (titlebar + tab strip, React + core-ui, themed) as its own
`webContents`. Each project tab is a `WebContentsView` added via `win.contentView.addChildView()`,
positioned by main below the 52px bar. The launcher is also a view, loading the same `index.html`
and staying on `ProjectsPage`.

**Why not `<webview>`**, despite `webviewTag: true` already being enabled
([`main.js:329`](../../../packages/noodl-editor/src/main/main.js#L329)) and the tag being used in
anger by [`CanvasView.ts`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts#L12),
[`VisualCanvas.tsx`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/VisualCanvas.tsx#L92)
and [`SandboxPreview.tsx`](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L60):

- Every existing `<webview>` in this repo hosts **app content**. Hosting the **editor** means a
  webview with `nodeintegration` plus `@electron/remote` — a materially different and more
  privileged configuration than anything currently proven here.
- Electron's own guidance is that `<webview>` is not guaranteed to remain and has architectural
  changes pending. Building the app's primary window structure on it is the wrong bet at the wrong
  altitude.

**What `WebContentsView` costs**, recorded so it is not discovered late: a child view is composited
*above* the window's own contents, so **shell DOM cannot overlay a project view**. Tab context menus
must be native (`Menu.popup`, the existing
[`ShowContextMenuInPopup`](../../../packages/noodl-editor/src/editor/src/views/ShowContextMenuInPopup.tsx)
pattern), and confirmations must be `dialog.showMessageBox`, not a React modal in the shell.

## Verified facts this phase rests on

Every one was read in source during scoping.

### What already does the right thing

| Fact | Where |
|---|---|
| Local backends are **already multi-instance**: `findAvailablePort()` walks up from 8578 skipping ports in use, and N supervisors run concurrently | [BackendManager.js:809](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L809) |
| Backend configs already carry a **`projectIds` array** — the many-projects-to-a-backend relation exists in the data model | [BackendManager.js:52](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L52), [:514](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L514) |
| Node copy/paste serialises through the **OS clipboard** (`electron.clipboard`), with the in-memory set only as a fallback — so **cross-tab paste works with no new code** | [EditorClipboard.ts:1](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/EditorClipboard.ts#L1), [:27](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/EditorClipboard.ts#L27) |
| The relay already authenticates every peer with a per-launch token, minted once per process — **one token stays correct across N ports** | [relay-token.js](../../../packages/noodl-editor/src/main/src/relay-token.js), [relay-server.js:92](../../../packages/noodl-editor/src/main/src/relay-server.js#L92) |
| `LSMultipleInstancesProhibited: true` on macOS, plus a single-instance guard that focuses the existing window | [package.json](../../../packages/noodl-editor/package.json) `build.mac.extendInfo`, [main.js:190](../../../packages/noodl-editor/src/main/main.js#L190) |
| Electron **43.2.0** — `WebContentsView` (Electron 30+) is available | [package.json](../../../packages/noodl-editor/package.json) `devDependencies.electron` |

### What is single-instance and must be generalised

| Fact | Where |
|---|---|
| `let win` — **one** module-global window, referenced ~40 times in main.js | [main.js:174](../../../packages/noodl-editor/src/main/main.js#L174) |
| The HTTP server + relay binds **one fixed port**, `NOODLPORT \|\| 8574` | [web-server.js:58](../../../packages/noodl-editor/src/main/src/web-server.js#L58), [:232](../../../packages/noodl-editor/src/main/src/web-server.js#L232) |
| `startServer()` runs **unconditionally at app-ready** — 8574 is bound just to display the launcher's project grid | [main.js:832](../../../packages/noodl-editor/src/main/main.js#L832) |
| The server resolves "which project am I serving?" by asking the single `win` over IPC | [main.js:255-261](../../../packages/noodl-editor/src/main/main.js#L255-L261) |
| `openViewer` **returns early if a viewer is already open**, against one module-global `viewerWindow`, sized from `win.getBounds()` | [main.js:437-442](../../../packages/noodl-editor/src/main/main.js#L437-L442), [:241](../../../packages/noodl-editor/src/main/main.js#L241) |
| The quit/close flush listens on a **sender-less** `ipcMain.on('flush-project-save-done')` | [main.js:908-931](../../../packages/noodl-editor/src/main/main.js#L908-L931) |
| UDP multicast advertises **one** `httpPort` + **one** `projectName` for device discovery | [main.js:1140-1148](../../../packages/noodl-editor/src/main/main.js#L1140-L1148) |
| `DesignToolImportServer` is a singleton on `NOODLPORT + 1` with a `setProjectName`/`setWindow` pair | [design-tool-import-server.js:24](../../../packages/noodl-editor/src/main/src/design-tool-import-server.js#L24), [main.js:424](../../../packages/noodl-editor/src/main/main.js#L424) |
| Window geometry is driven by a **route**, via `main-window-resize` from the launcher | [ProjectsPage.tsx:422](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx#L422) → [main.js:535](../../../packages/noodl-editor/src/main/main.js#L535) |

### The traps

| Fact | Where |
|---|---|
| ⚠️ **`process.env.NOODLPORT` is already a broken channel.** `createWindow()` runs *before* `startServer()`, so the renderer's env never sees the assignment — it works only because both sides independently default to 8574. Per-tab ports must go over IPC | [main.js:811](../../../packages/noodl-editor/src/main/main.js#L811) vs [:832](../../../packages/noodl-editor/src/main/main.js#L832); [web-server.js:252](../../../packages/noodl-editor/src/main/src/web-server.js#L252); read at module scope in [ViewerConnection.ts:15](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L15) and [InspectPopup.tsx:186](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/InspectJSONView/InspectPopup.tsx#L186) |
| ⚠️ **`BrowserWindow.getAllWindows()` does not enumerate `WebContentsView`s.** The backend status broadcast uses exactly that loop, so under TAB-001 it would reach the *shell* and no project tab — three panels silently stop updating | [BackendManager.js:385](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L385) |
| ⚠️ **`@electron/remote` is enabled per-`webContents`.** `enable()` is called once, on `win.webContents`. Every new tab needs its own call or the platform filesystem layer breaks in a way that looks nothing like a missing tab | [main.js:334](../../../packages/noodl-editor/src/main/main.js#L334); consumers include [platform-electron.ts](../../../packages/noodl-platform-electron/src/platform-electron.ts) and [filesystem-electron.ts](../../../packages/noodl-platform-electron/src/filesystem-electron.ts) |
| ⚠️ The relay's `broadcastMessage` is **type-scoped, not project-scoped** — see the design position above | [relay-server.js:54](../../../packages/noodl-editor/src/main/src/relay-server.js#L54) |

## Corrections this phase carries in

⚠️ **"888 references to `ProjectModel.instance`" was wrong.** The first scoping pass counted the
committed `index.bundle.js` alongside the sources. The real figure is **462 references across 122
source files**. The conclusion is unchanged — that is still rewrite-scale, and still the reason the
one-renderer architecture is rejected — but the number in any estimate should be the honest one.

⚠️ **Per-tab ports were first described as a convenience.** They are a correctness requirement; the
relay broadcasts to every editor peer on the socket. This inverted the argument for the design rather
than merely supporting it.

⚠️ **"Just make the launcher a tab" understates the launcher.** It currently owns window geometry
([`ProjectsPage.tsx:422`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx#L422)),
which has to move to the app before it can become a peer of the project tabs.

## What users get, stated plainly

- Two projects open at once, both previewing, both with running backends.
- Copy nodes from one project and paste them into another (free — OS clipboard).
- The launcher stays available; create, clone and import without closing your work.
- A crashed project no longer restarts the whole app —
  today [`main.js:405`](../../../packages/noodl-editor/src/main/main.js#L405) shows *"Oh No! Noodl
  has crashed"* and rebuilds the window.
- Per-project AI conversations that survive switching between projects. Today
  [`router.tsx:160`](../../../packages/noodl-editor/src/editor/src/router.tsx#L160) calls
  `resetContexts()` on every project change, so going launcher → project B destroys your project A
  conversation. Per-renderer tabs give this away for nothing.

### What users will ask for and not get

- **Cross-project drag and drop.** Separate renderers, separate DOMs. Clipboard yes, drag no.
- **A unified library, search, warnings or undo across tabs.** All per-renderer.
- **Free memory.** Each tab is a full renderer plus the editor bundle, plus a backend child process.
  Three projects ≈ three renderers and three Node processes. See open question 1.

## Open questions for Richard

1. **Background-tab suspension.** Three open projects is three renderers and three backends. Options:
   suspend nothing (simplest, heaviest); suspend the *renderer* of a background tab but keep its
   backend and preview alive; or unload the tab entirely and restore on click. The complication is
   that a suspended renderer kills an in-flight AI generation and drops a live preview connection —
   so any suspension needs a busy-tab exemption. **Recommendation: ship tier 1 with no suspension and
   a hard tab cap, and treat suspension as a phase 38 decision made against real memory numbers.**
2. **Tab cap.** Is there one? A soft warning at N tabs, a hard refusal, or nothing? Ports are not the
   constraint; RAM is.
3. **What does closing the last project tab do** — leave the launcher tab focused (recommended), or
   quit? Related: does closing the *launcher* tab make sense at all, or is tab 0 permanent?
4. **Does a project tab reopen on relaunch?** Session restore is a natural ask and is out of scope
   as written. If it is wanted, it changes TAB-001's persistence model, so it is better decided now
   than retrofitted.
5. **UDP device discovery under N tabs.** The multicast advertises one port and one project name
   ([`main.js:1142`](../../../packages/noodl-editor/src/main/main.js#L1142)). Options: advertise the
   *active* tab only, advertise all tabs as separate services, or drop the feature. Needs a call on
   whether phone-preview discovery is still a supported path at all.
6. **Does `noodl-mcp` get told which tab it corresponds to?** It reads a directory and needs no
   editor at all, so it works unchanged — but an agent holding both MCP servers cannot currently tell
   that "the project in tab 2" and "the directory I am editing" are the same project. See TAB-006.
