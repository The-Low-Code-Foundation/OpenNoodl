# TAB-004: Lifecycle & safe quit

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TAB-004 |
| **Phase** | Phase 37 (Track V) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical — this is the task that stops phase 37 from shipping a data-loss defect |
| **Difficulty** | 🔴 Hard — not in lines of code, in the number of ways to get it subtly wrong |
| **Prerequisites** | TAB-001 |

## Objective

Make quit, window close, tab close and renderer crash correct when there are N tabs, N debounced
autosaves, N HTTP servers and N backend processes in flight.

## The defect this task exists to prevent

[`flushRendererProjectSave()`](../../../packages/noodl-editor/src/main/main.js#L908) holds quit and
window-close open until the renderer confirms its pending project save has landed:

```js
ipcMain.on('flush-project-save-done', onDone);
win.webContents.send('flush-project-save');
```

The listener is **bare `ipcMain.on` with no sender identity**
([`main.js:930`](../../../packages/noodl-editor/src/main/main.js#L930)). With N tabs, **the first tab
to reply resolves the promise for every tab**, and the app proceeds to quit with N−1 debounced saves
unwritten.

⚠️ This is not a hypothetical. This repo already carries a fixed 1-second-quit data-loss defect at
this exact seam, and the fix is what put this handshake here. Reintroducing it — as a fan-out bug
rather than a missing-flush bug — is the single most likely way phase 37 hurts a user.

## Current state

| Behaviour | Where |
|---|---|
| `before-quit` preempts quit, flushes the renderer, then stops all backends with a timeout, then quits | [main.js:936-961](../../../packages/noodl-editor/src/main/main.js#L936-L961) |
| `win.on('close')` runs the same flush and stands down if `before-quit` is already draining | [main.js:383-395](../../../packages/noodl-editor/src/main/main.js#L383-L395) |
| A crashed renderer shows *"Oh No! Noodl has crashed"* and **rebuilds the whole window** | [main.js:405-419](../../../packages/noodl-editor/src/main/main.js#L405-L419) |
| A crashed renderer is checked explicitly so a crash does not sit out the full flush timeout | [main.js:913](../../../packages/noodl-editor/src/main/main.js#L913) |
| `backendManager.stopAll()` stops every backend, with a timeout | [main.js:952](../../../packages/noodl-editor/src/main/main.js#L952) |
| Backend status is broadcast with `for (const win of BrowserWindow.getAllWindows())` | [BackendManager.js:385](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L385) |

## Scope

### In scope

- [ ] `flushRendererProjectSave(tab)` — per tab, with the reply matched on `event.sender`
- [ ] `flushAllTabs()` — `Promise.all` over project tabs, each with its **own** timeout, so one wedged
      tab cannot consume the whole budget and silently skip the others
- [ ] Report which tabs timed out by name, not a single "timed out" line
- [ ] **Close-tab** is a first-class path: flush that tab, close its server (TAB-002), close its
      preview (TAB-003), stop or detach its backend, destroy the view
- [ ] Unsaved-changes confirmation on tab close via `dialog.showMessageBox` (the shell cannot draw a
      modal over a view — see TAB-001)
- [ ] Crash isolation: a crashed tab shows an in-tab error state and offers reload; it no longer
      rebuilds the window ([`main.js:405`](../../../packages/noodl-editor/src/main/main.js#L405))
- [ ] ⚠️ **Fix `BackendManager.broadcastStatusChanged`** — `BrowserWindow.getAllWindows()` does not
      enumerate `WebContentsView`s, so under TAB-001 it reaches the shell and **no project tab**.
      Three panels (Workflows, Execution History, Triggers) would silently stop updating, and the
      method's own docstring explains why that regression is expensive
- [ ] Backend ownership on tab close: a backend with other `projectIds`
      ([BackendManager.js:52](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L52))
      must **not** be stopped because one of its projects closed

### Out of scope

- Background-tab suspension (open question 1) — but do not build anything that forecloses it
- Session restore (open question 4)

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **The first-reply-wins bug**, reintroduced by refactor later | Match on `event.sender`, and add a main-process test with two fake senders where only the slow one has pending work. The test is the deliverable |
| Quit budget: N tabs × the flush timeout could exceed what macOS allows before it force-quits | Flushes run concurrently, not sequentially; total budget stays one timeout, not N |
| A tab closed while its backend is mid-request | Reuse the existing `withTimeout` + `stillRunning` semantics ([main.js:900](../../../packages/noodl-editor/src/main/main.js#L900)); a timeout here is reported, not thrown |
| `app.on('activate')` recreates a window when none exists ([main.js:966](../../../packages/noodl-editor/src/main/main.js#L966)) — must restore the *shell*, not a bare editor | Route through `TabManager` |
| Closing the last project tab is ambiguous | Open question 3. Default until answered: focus the launcher tab, do not quit |

## Testing plan

### Main-process tests (`npm run test:main --workspace noodl-editor` — the jest suite)

- [ ] Two tabs, one replies to `flush-project-save` immediately and one after a delay → the flush
      resolves only after **both**
- [ ] One tab crashed, one healthy → flush does not wait out the crashed tab's full timeout
- [ ] Backend shared by two projects; one tab closes → backend stays running
- [ ] Backend used by one project; that tab closes → backend stops
- [ ] `broadcastStatusChanged` reaches every project tab (this is a regression test for a trap, and
      it must fail against the current implementation before the fix)

### Manual

- [ ] Edit in tab A, edit in tab B, ⌘Q within the 1s debounce → **both** projects have the edit on disk
- [ ] Same via window close, and via closing each tab individually
- [ ] Crash a tab's renderer → other tabs keep working, the crashed tab offers reload

## Success criteria

- [ ] No path — quit, window close, tab close, crash — loses a debounced save in any tab
- [ ] A wedged tab delays quit by one timeout, not N, and is named in the log
- [ ] A crash is contained to its tab
- [ ] Backend lifetime follows `projectIds`, not tab count
