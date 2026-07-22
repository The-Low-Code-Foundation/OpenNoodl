# Debug Infrastructure

> **Purpose:** Documents Noodl's existing runtime debugging capabilities that the Trigger Chain Debugger will extend.

**Status:** Initial documentation (Phase 1A of VIEW-003)  
**Last Updated:** January 3, 2026

---

## Overview

Noodl has powerful runtime debugging that shows what's happening in the preview window:

- **Connection pulsing** - Connections animate when data flows
- **Inspector values** - Shows live data in pinned inspectors
- **Runtime→Editor bridge** - Events flow from preview to editor canvas

The Trigger Chain Debugger extends this by **recording** these events into a reviewable timeline.

---

## DebugInspector System

**Location:** `packages/noodl-editor/src/editor/src/utils/debuginspector.js`

### Core Components

#### 1. `DebugInspector` (Singleton)

Manages connection pulse animations and inspector values.

**Key Properties:**

```javascript
{
  connectionsToPulseState: {},  // Active pulsing connections
  connectionsToPulseIDs: [],    // Cached array of IDs
  inspectorValues: {},           // Current inspector values
  enabled: true                  // Debug mode toggle
}
```

**Key Methods:**

- `setConnectionsToPulse(connections)` - Start pulsing connections
- `setInspectorValues(inspectorValues)` - Update inspector data
- `isConnectionPulsing(connection)` - Check if connection is animating
- `valueForConnection(connection)` - Get current value
- `reset()` - Clear all debug state

#### 2. `DebugInspector.InspectorsModel`

Manages pinned inspector positions and persistence.

**Key Methods:**

- `addInspectorForConnection(args)` - Pin a connection inspector
- `addInspectorForNode(args)` - Pin a node inspector
- `removeInspector(inspector)` - Unpin inspector

---

## Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    RUNTIME (Preview)                         │
│                                                              │
│  Node executes → Data flows → Connection pulses             │
│                                                              │
│                       │                                      │
│                       ▼                                      │
│            Sends event to editor                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 VIEWER CONNECTION                            │
│                                                              │
│  - Receives 'debuginspectorconnectionpulse' command          │
│  - Receives 'debuginspectorvalues' command                   │
│  - Forwards to DebugInspector                                │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 DEBUG INSPECTOR                              │
│                                                              │
│  - Updates connectionsToPulseState                           │
│  - Updates inspectorValues                                   │
│  - Notifies listeners                                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│               NODE GRAPH EDITOR                              │
│                                                              │
│  - Subscribes to 'DebugInspectorConnectionPulseChanged'      │
│  - Animates connections on canvas                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Events Emitted

DebugInspector uses `EventDispatcher` to notify listeners:

| Event Name                                | When Fired              | Data        |
| ----------------------------------------- | ----------------------- | ----------- |
| `DebugInspectorConnectionPulseChanged`    | Connection pulse state  | None        |
| `DebugInspectorDataChanged.<inspectorId>` | Inspector value updated | `{ value }` |
| `DebugInspectorReset`                     | Debug state cleared     | None        |
| `DebugInspectorEnabledChanged`            | Debug mode toggled      | None        |

---

## ViewerConnection Bridge

**Location:** `packages/noodl-editor/src/editor/src/ViewerConnection.ts`

### Commands from Runtime

| Command                         | Content                  | Handler                   |
| ------------------------------- | ------------------------ | ------------------------- |
| `debuginspectorconnectionpulse` | `{ connectionsToPulse }` | `setConnectionsToPulse()` |
| `debuginspectorvalues`          | `{ inspectors }`         | `setInspectorValues()`    |

### Commands to Runtime

| Command                 | Content          | Purpose                          |
| ----------------------- | ---------------- | -------------------------------- |
| `debuginspector`        | `{ inspectors }` | Send inspector config to runtime |
| `debuginspectorenabled` | `{ enabled }`    | Enable/disable debug mode        |

---

## Connection Pulse Animation

Connections "pulse" when data flows through them:

1. Runtime detects connection activity
2. Sends connection ID to editor
3. DebugInspector adds to `connectionsToPulseState`
4. Animation frame loop updates opacity/offset
5. Canvas redraws with animated styling

**Animation Properties:**

```javascript
{
  created: timestamp,   // When pulse started
  offset: number,       // Animation offset (life / 20)
  opacity: number,      // Fade in/out (0-1)
  removed: timestamp    // When pulse ended (or false)
}
```

---

## For Trigger Chain Recorder

**What we can leverage:**

✅ **Connection pulse events** - Tells us when nodes fire  
✅ **Inspector values** - Gives us data flowing through connections  
✅ **ViewerConnection bridge** - Already connects runtime↔editor  
✅ **Event timing** - `performance.now()` used for timestamps

**What we need to add:**

❌ **Causal tracking** - What triggered what?  
❌ **Component boundaries** - When entering/exiting components  
❌ **Event persistence** - Currently only shows "now", we need history  
❌ **Node types** - What kind of node fired (REST, Variable, etc.)

---

## Next Steps (Phase 1B)

1. Investigate runtime node execution hooks
2. Find where to intercept node events
3. Determine how to track causality
4. Design TriggerChainRecorder interface

---

## Running and Inspecting the Editor

The editor can be driven and inspected entirely from a terminal, via the Chrome
DevTools Protocol. No window-watching, and no OS screen-recording permission —
`Page.captureScreenshot` renders through the compositor.

```bash
npm run dev:debug          # full stack + CDP on :9222, logs to .logs/dev.log
npm run cdp -- health      # is React actually mounted?
npm run cdp -- console     # stream console + uncaught exceptions
npm run cdp -- screenshot shot.png
npm run cdp -- eval "location.href"
npm run cdp -- dom "<selector>" [text|html]
npm run cdp -- wait "<selector>" [timeoutMs]
```

`health` is the one to reach for first: it reports whether `#root` has children,
which distinguishes "window opened" from "app actually rendered".

`.logs/dev.log` aggregates the viewer, cloud runtime, main process, and the
renderer console (mirrored into main stdout in dev). Services: web server 8574,
cloud functions 8577, renderer dev server 8080, CDP 9222.

Tooling lives in `scripts/devtools/` (`dev-debug.js`, `cdp.js`). The
`.claude/skills/run-editor` skill documents the same workflow for agents.

### The two stale-bundle traps

Both cost significant debugging time before they were understood.

**Renderer.** `src/editor/index.html` picks its bundle at runtime:

```js
const path = process.env.devMode !== 'yes' ? '.' : 'http://localhost:8080/src/editor';
```

Nothing ever set `devMode` to `'yes'`, so the editor always loaded
`./index.bundle.js` from disk while the webpack dev server served fresh code to
nobody. HMR did nothing and code changes were invisible. Worse, a leftover
*production* bundle pairs production react-dom with the externalised
*development* react, which throws before first paint:

```
TypeError: dispatcher.getOwner is not a function
  at getOwner (node_modules/react/cjs/react.development.js:416)
  at createDialogLayer (router.tsx:59)
```

`getOwner` is dev-only ownership tracking; production react-dom never installs
it. The window opens black. `main.js` now sets `devMode = 'yes'` when `--dev` is
passed.

**Main process.** `src/main/main.bundle.js` is the Electron entry point, and
`npm run dev` only ever ran webpack-dev-server for the renderer — there was no
dev config for main at all. The bundle sat unchanged for months while
`src/main/main.js` was edited, so main-process changes did nothing in dev.
`webpack.main.dev.js` now exists and `scripts/start.ts` rebuilds it on every dev
launch.

If a change seems to have no effect, suspect a stale bundle first.

## Editor Test Harness

The editor suite does not run under Node + jsdom. A webpack build produces a test
bundle, Electron launches with `test.js` as its main entry, and Jasmine runs the
specs in the renderer — the real host environment, because much of the editor
touches Electron APIs, the filesystem, and the DOM.

### Running it

```bash
npm run test:editor   # webpack dev server on :8081, visible Electron window + DevTools
npm run test:ci       # bundle built to disk, hidden window, no dev server
```

Both exit non-zero on any spec failure, on a renderer crash, if no specs ran at
all, or if the run does not report results within 15 minutes.

### Failure signature: `Cannot read properties of undefined (reading 'on')`

```
/…/packages/noodl-editor/test.js:51
app.on('ready', function () {
    ^
TypeError: Cannot read properties of undefined (reading 'on')
Node.js v20.15.1
```

This means Electron booted as a **plain Node process** rather than as a main
process, so `require('electron')` returned the CLI shim (a path string) instead of
the API object. The cause is `ELECTRON_RUN_AS_NODE=1` in the environment — **VS
Code sets this in integrated terminals and in the extension host**, so the suite
fails inside the editor and passes in a bare terminal on the same machine.

`packages/noodl-editor/scripts/run-electron-tests.js` is the launcher that exists
to strip that variable; `scripts/test-editor.ts` strips it from the child
environment too. `test.js` now detects the condition and prints an explicit
message instead of the `TypeError` above.

To check the environment directly:

```bash
env | grep ELECTRON_RUN_AS_NODE
```

### Moving parts

| File | Role |
|------|------|
| `scripts/test-editor.ts` | Root entry; sets `LOCAL_GIT_DIRECTORY`, strips `ELECTRON_RUN_AS_NODE`, propagates the exit code |
| `packages/noodl-editor/scripts/run-electron-tests.js` | Spawns the Electron binary directly in main-process mode |
| `packages/noodl-editor/test.js` | Electron main process; owns the launch-mode guard, the watchdog, and the exit code |
| `packages/noodl-editor/tests/SpecRunner.html` | Renderer entry; Jasmine reporter that sends results back over IPC |
| `webpackconfigs/webpack.test.js` | Dev-server build; spawns Electron from `onListening` |
| `webpackconfigs/webpack.test-ci.js` | Disk build for CI; no dev server |

### Writing specs

Specs run under **Jasmine, not Jest**. Two idioms bite:

- `import { describe, it, expect } from '@jest/globals'` throws at module load and
  takes down the whole run. Use the Jasmine globals — no import needed.
- Jest's `toThrow('substring')` matches a substring; Jasmine's compares the whole
  thrown value. Use `toThrowError(/pattern/)`.

---

## References

- `packages/noodl-editor/src/editor/src/utils/debuginspector.js`
- `packages/noodl-editor/src/editor/src/ViewerConnection.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts` (pulse rendering)
