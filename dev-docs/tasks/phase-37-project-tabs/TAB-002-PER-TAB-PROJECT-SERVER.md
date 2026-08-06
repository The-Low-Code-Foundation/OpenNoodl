# TAB-002: Per-tab project server & port

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TAB-002 |
| **Phase** | Phase 37 (Track V) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical — without it, two tabs corrupt each other's editor↔preview channel |
| **Difficulty** | 🟡 Medium |
| **Prerequisites** | TAB-001 (needs the tab↔`webContents` map) |

## Objective

Give every project tab its own HTTP server, its own WebSocket relay and its own port, allocated from
a pool — and make the launcher bind nothing at all.

## Why this is a correctness task, not a plumbing task

[`relay-server.js:54`](../../../packages/noodl-editor/src/main/src/relay-server.js#L54):

```js
function broadcastMessage(msg, type) {
  var broadcastToType = type === 'viewer' ? 'editor' : 'viewer';
  for (var i = 0; i < connectedSockets.length; i++) {
    ...
    if (!type || s.type === broadcastToType) s.ws.send(msg);
  }
}
```

Routing is by **peer type**. `clientId` targeting exists at
[`:156`](../../../packages/noodl-editor/src/main/src/relay-server.js#L156) but only when a message
carries `target`; the default path fans out to every editor peer.

Two projects on one relay means project A's editor receives project B's preview values, node-library
announcements, warnings and OBS-001 trace events. That is the code's normal behaviour, not an edge
case. **Port-per-tab is the isolation boundary.**

## Current state

| Fact | Where |
|---|---|
| One server, one port: `NOODLPORT \|\| 8574`, `listen(port)` | [web-server.js:58](../../../packages/noodl-editor/src/main/src/web-server.js#L58), [:232](../../../packages/noodl-editor/src/main/src/web-server.js#L232) |
| Started unconditionally at app-ready — bound while you are only looking at the launcher | [main.js:832](../../../packages/noodl-editor/src/main/main.js#L832) |
| "Which project?" is answered by asking the one window over IPC | [main.js:255-292](../../../packages/noodl-editor/src/main/main.js#L255-L292) |
| The relay attaches to that same HTTP server | [web-server.js](../../../packages/noodl-editor/src/main/src/web-server.js), `startWebSocketServer` |
| The relay token is **per launch, process-wide** — correct as-is for N ports | [relay-token.js](../../../packages/noodl-editor/src/main/src/relay-token.js) |

## The env-var trap

⚠️ **`process.env.NOODLPORT` is already a broken channel and this task cannot paper over it.**

[`web-server.js:252`](../../../packages/noodl-editor/src/main/src/web-server.js#L252) assigns
`process.env.NOODLPORT = port` — but `createWindow()` runs at
[`main.js:811`](../../../packages/noodl-editor/src/main/main.js#L811) and `startServer()` at
[`:832`](../../../packages/noodl-editor/src/main/main.js#L832), so the renderer process is spawned
**before** the assignment and never inherits it. It works today only because both sides
independently default to 8574.

The same trap is already documented in
[`main.js:267`](../../../packages/noodl-editor/src/main/main.js#L267) for the relay token, and was
solved there with `ipcMain.handle('relay-token')`. Do the same.

Renderer consumers that read the port at **module scope** and must become async:

- [`ViewerConnection.ts:15`](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L15)
- [`InspectPopup.tsx:186`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/InspectJSONView/InspectPopup.tsx#L186)
- the viewer frame's copy — check
  [`frames/viewer-frame/src/views/viewer.js`](../../../packages/noodl-editor/src/frames/viewer-frame/src/views/viewer.js)

`ViewerConnection` already caches an async token as a promise and defers its first connect; the port
should ride the **same** IPC round trip rather than adding a second.

## Scope

### In scope

- [ ] `startServer` → `createProjectServer(tabId)` returning `{ port, close() }`
- [ ] Port allocation from a pool, mirroring
      [`findAvailablePort()`](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L809):
      walk up from 8574, skip ports already taken by a tab **and** by a backend
- [ ] `projectGetInfo` / `projectGetSettings` / `projectGetComponentBundleExport` route to **that
      tab's** `webContents`, not the module-global `win`
      ([`main.js:255`](../../../packages/noodl-editor/src/main/main.js#L255))
- [ ] `ipcMain.handle('project-port')` returning the calling tab's port, resolved from `event.sender`
- [ ] Fold the port into the existing `relay-token` handle so there is one round trip
- [ ] The launcher binds **nothing** — no server, no port, no backend
- [ ] A tab's server closes when its tab closes; the port returns to the pool
- [ ] Port collision with a non-NodeGX process is handled by retrying the next port, not by dying

### Out of scope

- Backend process allocation — already correct
  ([BackendManager.js:809](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L809))
- External consumers discovering which port belongs to which project — TAB-006

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `_editorAPICallbacks` is a flat token map ([`main.js:253`](../../../packages/noodl-editor/src/main/main.js#L253)); with N tabs, a reply from the wrong tab would satisfy the wrong request | Key callbacks by `(tabId, token)` and verify `event.sender` on `editor-api-response` ([:275](../../../packages/noodl-editor/src/main/main.js#L275)) |
| A hardcoded `8574` somewhere else silently connects a tab to the wrong project | Grep is in scope. Known: [config.js](../../../packages/noodl-editor/src/shared/config/config.js) and its three siblings all carry `port: 8574`; `sandbox.viewer.bundle.js` carries `editorAddress: 'ws://localhost:8574'` |
| `certificate-error` is registered on `app` inside `startServer` ([web-server.js:46](../../../packages/noodl-editor/src/main/src/web-server.js#L46)) — calling it per tab registers N handlers | Move app-level handlers out of the per-tab factory into one-time setup |
| SSL mode (`process.env.ssl`) forks the server type per process, not per tab | Keep it process-wide; document that all tabs are http or all https |

## Success criteria

- [ ] Launcher-only: `lsof -i :8574` shows nothing
- [ ] Tab A gets 8574, tab B gets the next free port, both previews load their own project
- [ ] With both previewing, tab A's editor shows **no** values or warnings originating in tab B —
      this is the test that justifies the task and must be explicit, not incidental
- [ ] Closing tab A frees its port; a new tab reclaims it
- [ ] `ViewerConnection` connects with no reliance on `process.env.NOODLPORT`
